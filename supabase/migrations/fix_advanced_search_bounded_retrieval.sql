-- ============================================================================
-- Fix: search_tools_advanced was filtering the WHOLE ai_tools table with a
-- threshold-based WHERE clause on vector distance, which defeats the IVFFlat
-- index (ai_tools_embedding_idx). IVFFlat only accelerates
-- "ORDER BY embedding <=> query_embedding LIMIT k" queries — it cannot be used
-- to satisfy an arbitrary "WHERE 1 - (embedding <=> query_embedding) > x"
-- predicate, so every row with a non-null embedding was getting its distance
-- computed on every search (full sequential scan).
--
-- Same problem on the FTS side: the previous version scored (ts_rank) and
-- sorted every row matching ANY of {semantic, FTS, ILIKE, synonym} in one
-- combined WHERE-OR, uncapped, before the final LIMIT. A single common word
-- could pull thousands of ILIKE/FTS matches into that sort.
--
-- Fix: retrieve each candidate source through its own bounded,
-- index-accelerated query (ORDER BY ... LIMIT), union the candidate ids,
-- and only then join back to compute combined_score and do the final
-- ORDER BY + LIMIT match_count over that bounded set.
-- ============================================================================

DROP FUNCTION IF EXISTS search_tools_advanced(text, vector, float, int, text[]);

CREATE OR REPLACE FUNCTION search_tools_advanced(
  search_query text,
  query_embedding vector(768) DEFAULT NULL,
  match_threshold float DEFAULT 0.20,
  match_count int DEFAULT 30,
  extra_keywords text[] DEFAULT NULL
)
RETURNS TABLE (
  id text,
  name text,
  category text,
  description text,
  platform text,
  region text,
  access_type text,
  pricing text,
  tags text[],
  popularity int,
  last_updated date,
  is_trending boolean,
  image text,
  priority int,
  similarity float,
  fts_score float,
  keyword_score float,
  source_trust_score float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
DECLARE
  tsquery_val tsquery;
  query_tokens text[];
  -- Candidate pool sizes: bounded multiples of match_count so a single common
  -- word/token can never force a full-table rank-and-sort. Floors keep small
  -- match_count requests (e.g. autocomplete-adjacent calls) from starving the
  -- candidate pool entirely.
  vector_pool_size int := GREATEST(match_count * 4, 40);
  text_pool_size int := GREATEST(match_count * 8, 80);
BEGIN
  tsquery_val := websearch_to_tsquery('english', search_query);
  IF tsquery_val IS NULL OR numnode(tsquery_val) = 0 THEN
    tsquery_val := plainto_tsquery('english', search_query);
  END IF;

  SELECT array_agg(DISTINCT token) INTO query_tokens
  FROM unnest(regexp_split_to_array(lower(trim(search_query)), '\s+')) AS token
  WHERE length(token) >= 2;

  RETURN QUERY
  WITH vector_candidates AS (
    -- Index-accelerated: ORDER BY <=> LIMIT is the access pattern IVFFlat
    -- supports. The similarity threshold is applied later, against this
    -- already-bounded pool, never as a full-table predicate.
    SELECT t.id, (1 - (t.embedding <=> query_embedding))::double precision AS sim
    FROM ai_tools t
    WHERE query_embedding IS NOT NULL AND t.embedding IS NOT NULL
    ORDER BY t.embedding <=> query_embedding
    LIMIT vector_pool_size
  ),
  fts_candidates AS (
    -- Capped BEFORE ranking: take the top `text_pool_size` FTS matches by a
    -- cheap ordering (popularity) first, THEN rank within that bounded set.
    -- A common word matching thousands of rows still only ever contributes
    -- text_pool_size candidates.
    SELECT capped.id
    FROM (
      SELECT t.id, t.popularity
      FROM ai_tools t
      WHERE tsquery_val IS NOT NULL AND tsquery_val @@ t.fts_vector
      ORDER BY t.popularity DESC NULLS LAST
      LIMIT text_pool_size
    ) capped
  ),
  ilike_candidates AS (
    SELECT capped.id
    FROM (
      SELECT t.id, t.popularity
      FROM ai_tools t
      WHERE query_tokens IS NOT NULL AND EXISTS (
        SELECT 1 FROM unnest(query_tokens) qt
        WHERE t.name ILIKE '%' || qt || '%' OR t.description ILIKE '%' || qt || '%'
      )
      ORDER BY t.popularity DESC NULLS LAST
      LIMIT text_pool_size
    ) capped
  ),
  synonym_candidates AS (
    SELECT capped.id
    FROM (
      SELECT t.id, t.popularity
      FROM ai_tools t
      WHERE extra_keywords IS NOT NULL AND EXISTS (
        SELECT 1 FROM unnest(extra_keywords) kw
        WHERE t.name ILIKE '%' || kw || '%' OR t.description ILIKE '%' || kw || '%'
      )
      ORDER BY t.popularity DESC NULLS LAST
      LIMIT text_pool_size
    ) capped
  ),
  candidate_ids AS (
    -- Track provenance per id so we can still require the semantic threshold
    -- for rows that ONLY qualified via vector similarity (a row with a weak
    -- vector match but a real FTS/ILIKE/synonym hit should still be kept).
    SELECT
      id,
      bool_or(src = 'vector') AS via_vector,
      bool_or(src = 'fts') AS via_fts,
      bool_or(src = 'ilike') AS via_ilike,
      bool_or(src = 'synonym') AS via_synonym
    FROM (
      SELECT id, 'vector' AS src FROM vector_candidates
      UNION ALL SELECT id, 'fts' FROM fts_candidates
      UNION ALL SELECT id, 'ilike' FROM ilike_candidates
      UNION ALL SELECT id, 'synonym' FROM synonym_candidates
    ) u
    GROUP BY id
  )
  SELECT
    t.id,
    t.name,
    t.category,
    t.description,
    t.platform,
    t.region,
    t.access_type,
    t.pricing,
    t.tags,
    t.popularity,
    t.last_updated,
    t.is_trending,
    t.image,
    t.priority,

    COALESCE(vc.sim, 0.0::double precision) AS similarity,

    LEAST(COALESCE(ts_rank(t.fts_vector, tsquery_val)::double precision, 0) * 4.0, 1.0) AS fts_score,
    LEAST(COALESCE(ts_rank(t.fts_vector, tsquery_val)::double precision, 0) * 4.0, 1.0) AS keyword_score,
    LEAST(COALESCE(t.priority, 50)::double precision / 100.0, 1.0) AS source_trust_score,

    (
      (COALESCE(vc.sim, 0.0::double precision) * 3.0)
      + (LEAST(COALESCE(ts_rank(t.fts_vector, tsquery_val)::double precision, 0) * 4.0, 1.0) * 4.0)
      + (LEAST(COALESCE(t.priority, 50)::double precision / 100.0, 1.0) * 3.0)
      + (LEAST(COALESCE(t.popularity, 0)::double precision / 10000.0, 1.0) * 1.5)
      + (CASE WHEN t.is_trending THEN 1.0::double precision ELSE 0.0::double precision END)
    )::double precision AS combined_score

  FROM candidate_ids ci
  JOIN ai_tools t ON t.id = ci.id
  LEFT JOIN vector_candidates vc ON vc.id = ci.id
  WHERE
    ci.via_fts OR ci.via_ilike OR ci.via_synonym
    OR (ci.via_vector AND vc.sim > match_threshold)
  ORDER BY
    combined_score DESC,
    t.is_trending DESC,
    t.popularity DESC NULLS LAST
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- New: fuzzy tool-name lookup used by the self-healing discovery flow to
-- avoid inserting a duplicate of an existing tool under a slightly different
-- name (e.g. "ChatGPT" vs "Chat GPT"). Reuses the trigram index already
-- created in update_advanced_search_v2.sql (idx_ai_tools_name_trgm).
-- ============================================================================

DROP FUNCTION IF EXISTS find_similar_tool_name(text, float);

CREATE OR REPLACE FUNCTION find_similar_tool_name(
  p_name text,
  p_threshold float DEFAULT 0.35
)
RETURNS TABLE (id text, name text, similarity_score float)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  -- Transaction-local: lowers pg_trgm's default match bar (0.3) only for this
  -- call so p_threshold controls recall directly via the index-assisted `%`
  -- operator, without touching the session/global setting.
  PERFORM set_config('pg_trgm.similarity_threshold', LEAST(p_threshold, 0.3)::text, true);

  RETURN QUERY
  SELECT t.id, t.name, similarity(t.name, p_name)::float AS similarity_score
  FROM ai_tools t
  WHERE t.name % p_name
    AND similarity(t.name, p_name) >= p_threshold
  ORDER BY similarity_score DESC
  LIMIT 1;
END;
$$;
