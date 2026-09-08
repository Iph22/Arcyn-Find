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

-- ============================================================================
-- Fix: the traditional ILIKE fallback path (route.ts's buildBaseQuery, used
-- whenever hybridSearch degrades or returns nothing) was hitting a Postgres
-- statement timeout for common queries like "gauth ai". Root cause: two of
-- its OR-branches had no usable index at all —
--   - tags.cs.{word} (array containment) had NO index on ai_tools.tags. Any
--     unindexed branch in a Supabase `.or(...)` filter forces a sequential
--     scan for the WHOLE combined WHERE clause, even though name/description
--     already had trigram indexes — one unindexed OR branch defeats all of them.
--   - platform ILIKE had no trigram index either (only name/description got one
--     in update_advanced_search_v2.sql).
--
-- CORRECTION (added after measuring): adding these indexes was NOT sufficient,
-- and the original conclusion here was wrong. Trigram ILIKE on this table is
-- non-viable regardless of indexing — see the long note inside
-- search_tools_advanced below for the measurements and the reason. The tags
-- GIN index below is still worth keeping (array containment genuinely uses
-- it); the platform trigram index is retained only because dropping an index
-- is a separate decision, but nothing should be adding new ILIKE paths.
-- ============================================================================

-- "operator class gin_trgm_ops does not exist for access method gin" means
-- pg_trgm's operator classes aren't resolvable in the current search_path —
-- either the extension was never actually installed on this database (the
-- CREATE EXTENSION in update_advanced_search_v2.sql may never have been run,
-- or aborted partway through a multi-statement script), or Supabase installed
-- it into its dedicated "extensions" schema rather than "public", and this
-- session's search_path doesn't include it. Covering both: make sure the
-- extension exists, and make sure both plausible schemas are searched.
SET search_path = public, extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_ai_tools_platform_trgm
  ON ai_tools USING gin (platform gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ai_tools_tags_gin
  ON ai_tools USING gin (tags);

-- Every text tier below does `WHERE <fts match> ORDER BY popularity DESC LIMIT n`.
-- With only a GIN index available, Postgres must collect ALL matching rows and
-- sort them before applying the LIMIT — fine for a rare term (594ms measured
-- for "basketball highlight clipper"), but for a very common lexeme like "ai"
-- or "image" that means sorting ~100k rows (8-10s measured, sometimes timing
-- out). This index gives the planner a second option for exactly those cases:
-- walk popularity in index order and stop as soon as it has n FTS matches,
-- which terminates almost immediately when matches are dense. The planner
-- picks per query based on estimated selectivity, so rare terms keep the
-- bitmap plan and common terms get the ordered-scan plan.
CREATE INDEX IF NOT EXISTS idx_ai_tools_popularity
  ON ai_tools (popularity DESC NULLS LAST);

-- Supports the rewritten find_similar_tool_name below: a normalized-name
-- equality lookup, replacing the pg_trgm similarity scan that timed out.
CREATE INDEX IF NOT EXISTS idx_ai_tools_name_normalized
  ON ai_tools (lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')));

-- Refresh planner statistics so the newly created indexes above are costed
-- against current data rather than a stale snapshot. Worth doing after any
-- index creation on a table this size.
--
-- (Historical note, corrected: an earlier revision of this file claimed the
-- rare-term-slower-than-common-term inversion we observed — "gauth" at 8.5s
-- vs "for" at 287ms — was caused by stale statistics. That was wrong. The
-- real cause was trigram posting-list cost, explained in detail inside
-- search_tools_advanced below. This ANALYZE is still good practice, but it
-- was never the fix for that symptom.)
ANALYZE ai_tools;

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
  tsquery_val tsquery;      -- primary query, AND semantics (high precision)
  tsquery_broad tsquery;    -- same terms OR'd (breadth — replaces the ILIKE net)
  tsquery_synonym tsquery;  -- caller-supplied synonym expansion, OR'd
  tsquery_token tsquery;
  query_tokens text[];
  -- Candidate pool sizes: bounded multiples of match_count so a single common
  -- word/token can never force a full-table rank-and-sort. Floors keep small
  -- match_count requests (e.g. autocomplete-adjacent calls) from starving the
  -- candidate pool entirely.
  vector_pool_size int := GREATEST(match_count * 4, 40);
  text_pool_size int := GREATEST(match_count * 8, 80);
  tok text;
  -- Above this many matches, sorting the precise tier by popularity costs more
  -- than the ordering is worth (see the note on fts_candidates below).
  sort_safe_limit int := 5000;
  precise_matches int;
  sort_is_safe boolean;
BEGIN
  tsquery_val := websearch_to_tsquery('english', search_query);
  IF tsquery_val IS NULL OR numnode(tsquery_val) = 0 THEN
    tsquery_val := plainto_tsquery('english', search_query);
  END IF;

  SELECT array_agg(DISTINCT token) INTO query_tokens
  FROM unnest(regexp_split_to_array(lower(trim(search_query)), '\s+')) AS token
  WHERE length(token) >= 2;

  -- ==========================================================================
  -- Round 4 — and this time the fix is to STOP using ILIKE entirely.
  --
  -- Measured on this instance (257k rows), per mechanism:
  --     FTS  (fts_vector @@ tsquery)      421ms – 1.5s   <- viable
  --     ILIKE on name (trigram indexed)   8.5s           <- not viable
  --     ILIKE on description (indexed)    TIMEOUT        <- not viable
  --
  -- Trigram ILIKE cannot be made fast here, and rounds 1-3 of this migration
  -- (EXISTS/unnest, then JOIN/unnest, then LATERAL, then literal-pattern
  -- dynamic SQL) were all fighting an unwinnable battle. The reason ILIKE cost
  -- is so bad — and so unpredictable — is trigram commonality, not row
  -- selectivity: '%gauth%' decomposes to trigrams gau/aut/uth, and aut/uth are
  -- pervasive in an AI-tools corpus (automation, authentication, automatic),
  -- so GIN intersects enormous posting lists and rechecks thousands of heap
  -- rows to return a single match. A *rarer* search term can therefore be
  -- dramatically SLOWER than a common one, which makes latency impossible to
  -- reason about on a user-facing path.
  --
  -- FTS has none of these problems: lexeme postings are per-word, so cost
  -- tracks actual match counts. So the loose-text "safety net" that ILIKE used
  -- to provide is now served by a second, OR-semantics tsquery over the same
  -- GIN index, plus the caller's synonym list as a third OR'd tsquery. Typo
  -- tolerance is retained upstream by correctTypos() in lib/search-utils.ts,
  -- and FTS stemming covers morphological variants ("editing" -> "edit").
  --
  -- Semantics note: this drops MID-WORD substring matching. Searching "auth"
  -- will no longer match "Gauthier". That is a deliberate trade — it is the
  -- specific capability that cannot be delivered within the time budget.
  -- ==========================================================================

  -- Breadth query: same tokens, OR'd instead of AND'd.
  IF query_tokens IS NOT NULL THEN
    FOREACH tok IN ARRAY query_tokens LOOP
      tsquery_token := plainto_tsquery('english', tok);
      IF tsquery_token IS NOT NULL AND numnode(tsquery_token) > 0 THEN
        tsquery_broad := CASE
          WHEN tsquery_broad IS NULL THEN tsquery_token
          ELSE tsquery_broad || tsquery_token   -- || is tsquery OR
        END;
      END IF;
    END LOOP;
  END IF;

  -- Synonym expansion supplied by processSearchQuery() in the app layer.
  IF extra_keywords IS NOT NULL THEN
    FOREACH tok IN ARRAY extra_keywords LOOP
      tsquery_token := plainto_tsquery('english', tok);
      IF tsquery_token IS NOT NULL AND numnode(tsquery_token) > 0 THEN
        tsquery_synonym := CASE
          WHEN tsquery_synonym IS NULL THEN tsquery_token
          ELSE tsquery_synonym || tsquery_token
        END;
      END IF;
    END LOOP;
  END IF;

  -- Bounded probe: is the precise tier's match set small enough that sorting it
  -- by popularity is affordable? The probe itself is cheap because it's LIMITed
  -- (measured ~330ms even for the single most common lexeme in the corpus).
  SELECT count(*) INTO precise_matches
  FROM (
    SELECT 1
    FROM ai_tools t
    WHERE tsquery_val IS NOT NULL AND tsquery_val @@ t.fts_vector
    LIMIT sort_safe_limit
  ) probe;

  sort_is_safe := precise_matches < sort_safe_limit;

  -- NOTE on column naming below: RETURNS TABLE(id text, ...) implicitly declares
  -- a PL/pgSQL variable named "id" (and one per output column) visible to every
  -- SQL command in this function body. A bare, unqualified `id` anywhere in a
  -- query here is ambiguous between that variable and any FROM-list column
  -- also named "id" (42702 "column reference is ambiguous") — this bit us in
  -- production for the candidate_ids CTE below, which read `id` unqualified
  -- from each candidate CTE. Every candidate CTE now exposes the tool's id as
  -- `tool_id` instead, which cannot collide with any RETURNS TABLE column name,
  -- so it's safe to reference unqualified anywhere, including GROUP BY.
  RETURN QUERY
  WITH vector_candidates AS (
    -- Index-accelerated: ORDER BY <=> LIMIT is the access pattern IVFFlat
    -- supports. The similarity threshold is applied later, against this
    -- already-bounded pool, never as a full-table predicate.
    SELECT t.id AS tool_id, (1 - (t.embedding <=> query_embedding))::double precision AS sim
    FROM ai_tools t
    WHERE query_embedding IS NOT NULL AND t.embedding IS NOT NULL
    ORDER BY t.embedding <=> query_embedding
    LIMIT vector_pool_size
  ),
  fts_candidates AS (
    -- Precise tier (AND semantics). Popularity ordering matters most here, so
    -- unlike the breadth tiers it is KEPT — but only when the match set is
    -- small enough to sort. Measured: "gauth & ai" (rare term narrows the
    -- intersection to 1 row) sorts in 1982ms, but a lone common lexeme like
    -- "ai", or "image & generator" where both terms are common, matches ~100k
    -- rows and the sort times out.
    --
    -- The two branches below are mutually exclusive on the `sort_is_safe`
    -- boolean computed above, which reaches the planner as a constant — so
    -- whichever branch is disabled has a constant-false WHERE and is skipped
    -- outright rather than executed and discarded.
    (
      SELECT t.id AS tool_id
      FROM ai_tools t
      WHERE sort_is_safe
        AND tsquery_val IS NOT NULL AND tsquery_val @@ t.fts_vector
      ORDER BY t.popularity DESC NULLS LAST
      LIMIT text_pool_size
    )
    UNION ALL
    (
      SELECT t.id AS tool_id
      FROM ai_tools t
      WHERE NOT sort_is_safe
        AND tsquery_val IS NOT NULL AND tsquery_val @@ t.fts_vector
      LIMIT text_pool_size
    )
  ),
  -- IMPORTANT — no ORDER BY in the two OR tiers below, deliberately.
  --
  -- Measured, isolating this exact tier:
  --     "gauth | ai"  + ORDER BY popularity LIMIT 240   TIMEOUT (>9.1s)
  --     "gauth | ai"    no ORDER BY,        LIMIT 240   1626ms
  --     "image | generator" no ORDER BY,    LIMIT 240    291ms
  --
  -- An OR of a common lexeme matches ~100k rows. With ORDER BY, Postgres must
  -- fetch and sort that entire match set before applying LIMIT. Without it,
  -- the bitmap heap scan streams and stops as soon as it has LIMIT rows.
  --
  -- The trade-off is real and intentional: these tiers now contribute an
  -- ARBITRARY bounded slice of the match set rather than the most popular
  -- slice. That's acceptable because they exist purely for recall — the
  -- precise AND tier below keeps its popularity ordering, the vector tier is
  -- ordered by similarity, and everything is re-ranked by combined_score in
  -- the final SELECT anyway. The one case it degrades is a query where ONLY
  -- the breadth tier matches, where results will be less popularity-weighted
  -- than before.
  broad_candidates AS (
    -- Breadth tier: OR'd tokens over the same GIN index. This is what replaced
    -- the ILIKE safety net — same purpose (catch loose matches the strict AND
    -- query misses), viable mechanism.
    SELECT t.id AS tool_id
    FROM ai_tools t
    WHERE tsquery_broad IS NOT NULL AND tsquery_broad @@ t.fts_vector
    LIMIT text_pool_size
  ),
  synonym_candidates AS (
    SELECT t.id AS tool_id
    FROM ai_tools t
    WHERE tsquery_synonym IS NOT NULL AND tsquery_synonym @@ t.fts_vector
    LIMIT text_pool_size
  ),
  candidate_ids AS (
    -- Track provenance per tool so we can still require the semantic threshold
    -- for rows that ONLY qualified via vector similarity (a row with a weak
    -- vector match but a real text hit should still be kept).
    SELECT
      tool_id,
      bool_or(src = 'vector') AS via_vector,
      bool_or(src = 'text') AS via_text
    FROM (
      SELECT tool_id, 'vector' AS src FROM vector_candidates
      UNION ALL SELECT tool_id, 'text' FROM fts_candidates
      UNION ALL SELECT tool_id, 'text' FROM broad_candidates
      UNION ALL SELECT tool_id, 'text' FROM synonym_candidates
    ) u
    GROUP BY tool_id
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
  JOIN ai_tools t ON t.id = ci.tool_id
  LEFT JOIN vector_candidates vc ON vc.tool_id = ci.tool_id
  WHERE
    ci.via_text
    OR (ci.via_vector AND vc.sim > match_threshold)
  ORDER BY
    combined_score DESC,
    t.is_trending DESC,
    t.popularity DESC NULLS LAST
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Tool-name duplicate check used by the self-healing discovery flow to avoid
-- inserting a duplicate of an existing tool under a slightly different name
-- (e.g. "ChatGPT" vs "Chat GPT").
--
-- Originally implemented with pg_trgm's `%` similarity operator, which TIMED
-- OUT in production for exactly the same reason the ILIKE tiers did: trigram
-- posting-list cost. "ChatGPT" decomposes to cha/hat/atg/tgp/gpt, and cha/hat
-- are pervasive, so the similarity scan is enormous.
--
-- Rewritten as a normalized-name equality lookup against
-- idx_ai_tools_name_normalized (strip everything non-alphanumeric, lowercase).
-- This is a btree equality probe — effectively instant — and still catches the
-- motivating cases: "ChatGPT" / "Chat GPT" / "chat-gpt" / "Chat  G.P.T." all
-- normalize to "chatgpt".
--
-- What it no longer catches: names that differ by more than punctuation and
-- case, e.g. "ChatGPT" vs "ChatGPT Pro". That is an acceptable narrowing for
-- what is only a best-effort insert guard — callers already treat "no match"
-- and "lookup failed" identically and proceed with the insert.
--
-- The p_threshold parameter is retained for signature compatibility with the
-- existing caller (lib/embeddings.ts findSimilarToolByName) but is no longer
-- used; an exact normalized match is reported as similarity_score 1.0.
-- ============================================================================

DROP FUNCTION IF EXISTS find_similar_tool_name(text, float);

CREATE OR REPLACE FUNCTION find_similar_tool_name(
  p_name text,
  p_threshold float DEFAULT 0.35
)
RETURNS TABLE (id text, name text, similarity_score float)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  normalized_input text;
BEGIN
  normalized_input := lower(regexp_replace(COALESCE(p_name, ''), '[^a-zA-Z0-9]', '', 'g'));

  IF normalized_input = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.id, t.name, 1.0::float AS similarity_score
  FROM ai_tools t
  WHERE lower(regexp_replace(t.name, '[^a-zA-Z0-9]', '', 'g')) = normalized_input
  ORDER BY t.popularity DESC NULLS LAST
  LIMIT 1;
END;
$$;
