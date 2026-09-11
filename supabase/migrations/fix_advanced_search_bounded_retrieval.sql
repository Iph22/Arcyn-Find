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
    -- NO secondary sort key here, unlike every other tier in this function.
    -- `ORDER BY <=> LIMIT` on its own is the exact access pattern IVFFlat can
    -- serve from the index; adding a tie-breaker column generally forces a
    -- sort node and gives up that index scan. Exact float ties in cosine
    -- distance across 260k rows are vanishingly rare, so the determinism this
    -- would buy is not worth losing the vector index over. Do not "fix" this
    -- for consistency with the tiers below.
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
      ORDER BY t.popularity DESC NULLS LAST, t.id ASC
      LIMIT text_pool_size
    )
    UNION ALL
    (
      SELECT t.id AS tool_id
      FROM ai_tools t
      WHERE NOT sort_is_safe
        AND tsquery_val IS NOT NULL AND tsquery_val @@ t.fts_vector
      ORDER BY t.id ASC
      LIMIT text_pool_size
    )
  ),
  -- ORDER BY t.id in the two OR tiers below. This REPLACES an earlier
  -- deliberate choice to leave them unordered, and the reason is correctness.
  --
  -- The original note read: "these tiers now contribute an ARBITRARY bounded
  -- slice of the match set rather than the most popular slice. That's
  -- acceptable because they exist purely for recall." That reasoning was
  -- wrong in one important way — an arbitrary slice is not a stable slice.
  -- Postgres re-streams a different 240 rows on every execution, so the
  -- recommendation for one goal changed on every request. Measured on
  -- search_tools_advanced with a fixed query, six consecutive FTS-only calls
  -- returned SIX COMPLETELY DISJOINT sets of 30 ids, and /api/recommend
  -- returned three different best matches over six identical calls. For a
  -- product whose job is to answer "which tool should I use", that is a
  -- trust bug, and it also made the eval unable to attribute any change
  -- (precision@1 moved 69% -> 65% between two runs of identical code).
  --
  -- ORDER BY t.id is affordable BECAUSE it is the primary key: Postgres walks
  -- the PK index and stops once it has LIMIT rows, instead of fetching and
  -- sorting the whole match set the way ORDER BY popularity requires.
  -- Re-measured on this table, LIMIT 240:
  --     "gauth | ai"          ORDER BY popularity   3598ms
  --     "gauth | ai"          ORDER BY id            918ms
  --     "image & generator"   ORDER BY popularity   5218ms
  --     "image & generator"   ORDER BY id           1609ms
  -- So the deterministic ordering is also the cheaper one, 3-4x. (The
  -- historical "TIMEOUT >9.1s" figure for ORDER BY popularity predates
  -- idx_ai_tools_popularity; it is 3598ms now, still 4x the id ordering.)
  --
  -- Cost of the trade: ordering by id biases the recall slice toward
  -- lexicographically smaller ids, which in this corpus means GitHub-scraped
  -- rows ("github-cro-...") ahead of others ("ot-..."). That is a known bias,
  -- accepted because these tiers exist only to widen recall and everything is
  -- re-ranked by combined_score below. A quality-ordered slice would need the
  -- popularity sort and its 4x cost.
  broad_candidates AS (
    -- Breadth tier: OR'd tokens over the same GIN index. This is what replaced
    -- the ILIKE safety net — same purpose (catch loose matches the strict AND
    -- query misses), viable mechanism.
    SELECT t.id AS tool_id
    FROM ai_tools t
    WHERE tsquery_broad IS NOT NULL AND tsquery_broad @@ t.fts_vector
    ORDER BY t.id ASC
    LIMIT text_pool_size
  ),
  synonym_candidates AS (
    SELECT t.id AS tool_id
    FROM ai_tools t
    WHERE tsquery_synonym IS NOT NULL AND tsquery_synonym @@ t.fts_vector
    ORDER BY t.id ASC
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
  ),
  -- Score every surviving candidate. Column names are prefixed `o_` rather
  -- than reusing the RETURNS TABLE names (id, name, popularity, ...), because
  -- those are implicitly declared PL/pgSQL variables in this function body and
  -- a bare reference to one from the CTEs below would be ambiguous — the exact
  -- 42702 failure this file already hit once in production.
  scored AS (
    SELECT
      t.id AS o_id,
      t.name AS o_name,
      t.category AS o_category,
      t.description AS o_description,
      t.platform AS o_platform,
      t.region AS o_region,
      t.access_type AS o_access_type,
      t.pricing AS o_pricing,
      t.tags AS o_tags,
      t.popularity AS o_popularity,
      t.last_updated AS o_last_updated,
      t.is_trending AS o_is_trending,
      t.image AS o_image,
      t.priority AS o_priority,

      COALESCE(vc.sim, 0.0::double precision) AS o_similarity,

      -- OUTPUT column stays capped to [0,1]. It is returned twice below, once
      -- as fts_score and once as keyword_score, and lib/search-pipeline.ts
      -- does `keyword_score * 10  // Scale 0–1 → 0–10`, so widening the range
      -- here would silently corrupt the orchestrator's scoring.
      LEAST(COALESCE(ts_rank(t.fts_vector, tsquery_val)::double precision, 0) * 4.0, 1.0) AS o_fts_score,
      LEAST(COALESCE(t.priority, 50)::double precision / 100.0, 1.0) AS o_source_trust_score,

      (
        (COALESCE(vc.sim, 0.0::double precision) * 3.0)
        -- The cap here is DELIBERATE, and it was tested. Read this before
        -- removing it again.
        --
        -- The cap does saturate: `LEAST(ts_rank * 4.0, 1.0) * 4.0` contributes
        -- a flat 4.0 to every row whose ts_rank reaches 0.25, and on one goal
        -- query six of eight returned rows had o_fts_score of exactly 1.000 —
        -- so the highest-weighted relevance term stopped discriminating and
        -- priority/popularity/is_trending decided the winner among near-ties.
        --
        -- That reasoning is sound but the obvious fix is not. Uncapping it to
        -- `ts_rank * 16.0` (identical below the old cap, rising above it) was
        -- deployed and measured against the eval, at a fixed retrieval mix of
        -- hybrid:26 with reasoning off, two runs each:
        --
        --                     capped      uncapped
        --     precision@1     62%         62%        (no change)
        --     keyword hit     92%         88%        (worse)
        --     regressions     6           4          (misleading, see below)
        --
        -- Net: no gain, and one known-good answer regressed — "find and fix
        -- bugs in my codebase" went from Sweep (a real bug-fixing tool) back
        -- to TLDR (a summarizer). Two previously-passing queries also broke.
        -- The lower regression count was not an improvement: those failures
        -- had merely moved from "a rejected tool came back" to "no required
        -- term matched".
        --
        -- WHY it backfired: ts_rank rewards term FREQUENCY and does not
        -- normalize for document length, so a long scraped description that
        -- repeats the query's stems outscores a short precise one. The cap was
        -- crudely suppressing that keyword-stuffing signal. Anyone retrying
        -- this should use ts_rank's length-normalization flags (1 or 2, divide
        -- by document length) rather than raw uncapping, and must re-measure —
        -- scripts/eval/recommendation-eval.mjs is repeatable now, and
        -- scripts/eval/retrieval-determinism.js guards the latency side.
        + (LEAST(COALESCE(ts_rank(t.fts_vector, tsquery_val)::double precision, 0) * 4.0, 1.0) * 4.0)
        + (LEAST(COALESCE(t.priority, 50)::double precision / 100.0, 1.0) * 3.0)
        + (LEAST(COALESCE(t.popularity, 0)::double precision / 10000.0, 1.0) * 1.5)
        + (CASE WHEN t.is_trending THEN 1.0::double precision ELSE 0.0::double precision END)
      )::double precision AS o_combined_score,

      -- Dedup key. Matches idx_ai_tools_name_normalized exactly, so this is an
      -- indexed expression rather than a per-row computation.
      lower(regexp_replace(t.name, '[^a-zA-Z0-9]', '', 'g')) AS o_norm_name

    FROM candidate_ids ci
    JOIN ai_tools t ON t.id = ci.tool_id
    LEFT JOIN vector_candidates vc ON vc.tool_id = ci.tool_id
    WHERE
      ci.via_text
      OR (ci.via_vector AND vc.sim > match_threshold)
  ),
  -- ==========================================================================
  -- Collapse duplicate tools before the final LIMIT.
  --
  -- The corpus carries a lot of same-name-different-id rows (measured: ~250
  -- duplicated names per 1000 sampled rows, largely GitHub-scraped entries
  -- ingested more than once). candidate_ids groups by tool_id, which by
  -- definition cannot catch those, so the top of the result set was collapsing
  -- to a handful of distinct products — "chatbot for customer service" returned
  -- 10 rows containing only 2 distinct names (venom x7, wppconnect x3).
  --
  -- That is fatal for the recommendation flow specifically, which asks for a
  -- best match PLUS alternatives: with a degenerate candidate pool the
  -- "alternatives" are copies of the winner and there is nothing to compare.
  --
  -- Keep the highest-scoring row per normalized name, and dedupe BEFORE the
  -- LIMIT so we return match_count distinct products rather than match_count
  -- rows that might be one product. DISTINCT ON requires its expression to
  -- lead the ORDER BY, hence the re-sort in the outer query.
  -- ==========================================================================
  deduped AS (
    SELECT DISTINCT ON (o_norm_name) *
    FROM scored
    -- o_id last makes this a TOTAL order. Without it, two rows of the same
    -- product with equal score and equal popularity (common here — they are
    -- re-ingests of one GitHub project) leave DISTINCT ON free to keep either,
    -- so which duplicate survives varied between executions.
    ORDER BY o_norm_name, o_combined_score DESC, o_popularity DESC NULLS LAST, o_id ASC
  )
  SELECT
    o_id,
    o_name,
    o_category,
    o_description,
    o_platform,
    o_region,
    o_access_type,
    o_pricing,
    o_tags,
    o_popularity,
    o_last_updated,
    o_is_trending,
    o_image,
    o_priority,
    o_similarity,
    o_fts_score,
    o_fts_score,             -- keyword_score: same signal, kept for API compatibility
    o_source_trust_score,
    o_combined_score
  FROM deduped
  ORDER BY
    o_combined_score DESC,
    o_is_trending DESC,
    o_popularity DESC NULLS LAST,
    -- Total order. Measured combined scores cluster tightly (6.51 / 5.51 /
    -- 5.50 / 5.27 on one goal query), so ties at this point are the norm
    -- rather than an edge case, and an untied ORDER BY let them resolve
    -- differently per execution.
    o_id ASC
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
