-- Trending refresh as one set-based call instead of a full-table walk.
--
-- WHY THIS EXISTS
--
-- `updateAllTrendingStats()` paginated the whole of ai_tools in 500-row
-- `.range()` batches and recomputed a score for every row. Measured against the
-- live table (263,548 rows, so 528 batches):
--
--     .range(0,      499)     520ms
--     .range(10000,  10499)  3100ms
--     .range(50000,  50499)  5221ms
--     .range(100000, 100499) statement timeout
--     .range(200000, 200499) statement timeout
--
-- It could not even read past ~100k rows, let alone finish, and the endpoint's
-- budget is 60s. The cron had failed 40 runs out of 40, going back at least to
-- 2026-09-04, with `curl: (22) ... error: 504` every time. This is the deep
-- `.range()` offset degradation recorded in docs/CORPUS_AND_CONSTRAINTS.md §6.
--
-- THE INSIGHT
--
-- Almost none of that work was needed. With no views, calculateTrendingScore()
-- reduces to `popularity * 0.2`, which maxes out around 20 and can never reach
-- the 60 threshold. A tool with no views cannot become trending, and its score
-- does not change between runs. Only two sets of rows matter:
--
--   1. tools with views in the retention window  -> rescore
--   2. tools currently flagged is_trending       -> demote if they went quiet
--
-- Set (1) is bounded by tool_views. Set (2) is currently large (>=12,000 rows
-- of stale flags left by a job that never completed).
--
-- WHY THE CHUNK IS SMALL
--
-- Demotion is one UPDATE per chunk, and ai_tools carries many indexes including
-- the IVFFlat vector index, so every row written maintains all of them. Measured
-- cost of a single call by chunk size:
--
--     p_cleanup_limit=  50    753ms
--     p_cleanup_limit= 200    855ms
--     p_cleanup_limit= 500   2147ms
--     p_cleanup_limit=1000   statement timeout
--     p_cleanup_limit=2000   statement timeout
--
-- It is superlinear and falls off a cliff between 500 and 1000 — the blast
-- radius §2 records, where writing only 300 embeddings pushed an unrelated
-- query from 2.8s into a timeout. So one call does one small chunk, and the
-- caller loops against a wall-clock budget (refreshTrendingStats() in
-- lib/services/view-tracking.service.ts). Small statements, many of them,
-- rather than one big statement that cannot finish.
--
-- The scoring below is a faithful port of calculateTrendingScore() in
-- lib/services/view-tracking.service.ts. If one changes, change both.

-- Signature changed (p_demote_only added). CREATE OR REPLACE with a different
-- argument list would create an overload and leave the old 2-arg version
-- callable, so drop it explicitly first.
DROP FUNCTION IF EXISTS refresh_trending_stats(integer, integer);

CREATE OR REPLACE FUNCTION refresh_trending_stats(
    p_cleanup_limit  integer DEFAULT 250,
    p_retention_days integer DEFAULT 30,
    -- Set by the caller's loop after the first iteration: rescoring and purging
    -- are already done for this run, and only the demotion backlog remains.
    p_demote_only    boolean DEFAULT false
)
RETURNS TABLE (scored integer, demoted integer, purged integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_now         timestamptz := now();
    v_day_ago     timestamptz := now() - interval '24 hours';
    v_week_ago    timestamptz := now() - interval '7 days';
    v_max_24h     numeric;
    v_max_7d      numeric;
    v_scored      integer := 0;
    v_demoted     integer := 0;
    v_purged      integer := 0;
BEGIN
    -- Per-tool counts for the 7-day window; the 24h window is a subset, so one
    -- pass gives both and the two can never disagree.
    CREATE TEMP TABLE _tv_counts ON COMMIT DROP AS
    SELECT
        tool_id,
        COUNT(*) FILTER (WHERE viewed_at >= v_day_ago)::integer  AS views_24h,
        COUNT(*)::integer                                        AS views_7d,
        MAX(viewed_at)                                           AS last_view_at
    FROM tool_views
    WHERE viewed_at >= v_week_ago
    GROUP BY tool_id;

    -- Normalisation denominators, floored exactly as the TypeScript does
    -- (Math.max(max || 100, 100) and Math.max(max || 500, 500)).
    SELECT GREATEST(COALESCE(MAX(views_24h), 0), 100),
           GREATEST(COALESCE(MAX(views_7d),  0), 500)
      INTO v_max_24h, v_max_7d
      FROM _tv_counts;

    -- 1. Rescore every tool that has views in the window.
    IF NOT p_demote_only THEN
    WITH scored_rows AS (
        SELECT
            c.tool_id,
            c.views_24h,
            c.views_7d,
            c.last_view_at,
            ROUND(
                (
                    LEAST(100, (c.views_24h / v_max_24h) * 100) * 0.5
                  + LEAST(100, (c.views_7d  / v_max_7d)  * 100) * 0.3
                  + COALESCE(t.popularity, 50) * 0.2
                )
                -- EXTRACT is cast explicitly: it returns numeric on PG14+ but
                -- double precision on 13 and earlier, and there is no
                -- round(double precision, integer) — the whole statement would
                -- fail with "function round(double precision, integer) does not
                -- exist" on an older server.
                * CASE
                    WHEN EXTRACT(EPOCH FROM (v_now - c.last_view_at))::numeric / 3600 > 24
                    THEN GREATEST(
                            0.5,
                            1 - ((EXTRACT(EPOCH FROM (v_now - c.last_view_at))::numeric / 86400) * 0.1)
                         )
                    ELSE 1
                  END
            , 1)::real AS score
        FROM _tv_counts c
        JOIN ai_tools t ON t.id = c.tool_id
    )
    UPDATE ai_tools t
       SET view_count_24h = s.views_24h,
           view_count_7d   = s.views_7d,
           last_view_at    = s.last_view_at,
           trending_score  = s.score,
           -- Mirrors `newScore >= 60 || views24h > 10`.
           is_trending     = (s.score >= 60 OR s.views_24h > 10)
      FROM scored_rows s
     WHERE t.id = s.tool_id;

    GET DIAGNOSTICS v_scored = ROW_COUNT;
    END IF;

    -- 2. Demote tools THIS JOB promoted that have since gone quiet.
    --
    --    Deliberately not "every row where is_trending is true". That column has
    --    two writers with different meanings:
    --
    --      - the ingest (lib/auto-update.ts, lib/data-sources.ts) sets it from
    --        source heuristics — GitHub stars > 500/3000, HuggingFace downloads
    --        > 100k, top-5 index. It means "popular where it came from", and it
    --        is true for ~60,332 of 263,548 rows (~25% of the catalog).
    --      - this function sets it from real views on Arcyn Find.
    --
    --    Demoting the first group would churn 60k rows through every index on
    --    the table (IVFFlat included) to clear a column nothing ranks on —
    --    app/api/tools/trending/route.ts stopped trusting is_trending precisely
    --    because ~25% coverage carries no signal — and the ingest would simply
    --    set them again on its next cycle. The two jobs would fight forever.
    --
    --    So demotion is scoped to rows carrying view history, which only this
    --    job writes: view_count_7d > 0 means we promoted it. (24h views are a
    --    subset of 7d, so the 7d test alone is sufficient.) Measured scope at
    --    the time of writing: 0 rows.
    --    The view_count_7d test is written as a bare `> 0`, NOT
    --    `COALESCE(view_count_7d, 0) > 0`. They mean the same thing here — NULL
    --    > 0 is NULL, which filters out exactly like false — but the planner
    --    cannot prove COALESCE(x,0) > 0 implies x > 0, so the COALESCE form does
    --    not match ai_tools_promoted_trending_idx's predicate and the index is
    --    skipped. That silently turned this into a scan of the ~60k is_trending
    --    rows and put the whole function back over the statement timeout.
    --    A partial index only helps when the query's predicate matches it.
    WITH stale AS (
        SELECT t.id
          FROM ai_tools t
         WHERE t.is_trending IS TRUE
           AND t.view_count_7d > 0
           AND NOT EXISTS (SELECT 1 FROM _tv_counts c WHERE c.tool_id = t.id)
         LIMIT p_cleanup_limit
    )
    UPDATE ai_tools t
       SET is_trending    = false,
           view_count_24h = 0,
           view_count_7d  = 0,
           trending_score = ROUND(COALESCE(t.popularity, 50) * 0.2, 1)::real
      FROM stale
     WHERE t.id = stale.id;

    GET DIAGNOSTICS v_demoted = ROW_COUNT;

    -- 3. Purge view rows outside the retention window.
    IF NOT p_demote_only THEN
        DELETE FROM tool_views
         WHERE viewed_at < v_now - (p_retention_days || ' days')::interval;

        GET DIAGNOSTICS v_purged = ROW_COUNT;
    END IF;

    RETURN QUERY SELECT v_scored, v_demoted, v_purged;
END;
$fn$;

-- Only the service role calls this; it is not part of the public API surface.
REVOKE ALL ON FUNCTION refresh_trending_stats(integer, integer, boolean) FROM PUBLIC, anon, authenticated;

-- Supports both halves of step 1 and the demotion scan.
CREATE INDEX IF NOT EXISTS tool_views_viewed_at_idx ON tool_views (viewed_at);
CREATE INDEX IF NOT EXISTS tool_views_tool_id_viewed_at_idx ON tool_views (tool_id, viewed_at);

-- Makes the demotion scan in step 2 an index scan over a tiny set. The
-- predicate matches step 2's WHERE clause exactly, so the index covers only
-- rows this job promoted — not the ~60k the ingest flagged, which a
-- `WHERE is_trending IS TRUE` index would have to hold.
-- An earlier revision of this migration created an index over every
-- is_trending row (~60k). It is superseded by the narrow one below: it indexed
-- rows this job never touches, costing write amplification on a table that
-- already maintains an IVFFlat index.
DROP INDEX IF EXISTS ai_tools_is_trending_idx;

-- Predicate is the single condition `view_count_7d > 0`, not the compound
-- `is_trending IS TRUE AND view_count_7d > 0`. Measured: with the compound
-- predicate the planner did not use the index and step 2 took 6.4s to prove
-- zero rows matched (it had to walk all ~60k is_trending rows), which put the
-- function back over the statement timeout. A single simple predicate is one
-- the planner reliably matches, and it is just as selective — almost nothing
-- ever has view_count_7d > 0, so the index stays tiny. The is_trending test is
-- then applied to the handful of rows the index returns.
DROP INDEX IF EXISTS ai_tools_promoted_trending_idx;

CREATE INDEX IF NOT EXISTS ai_tools_viewed_7d_idx
    ON ai_tools (id)
    WHERE view_count_7d > 0;

-- Without this the planner has no statistics for the new index and can still
-- choose a sequential scan. docs/CORPUS_AND_CONSTRAINTS.md §2 records this
-- table's statistics going stale and latency not recovering on its own.
ANALYZE ai_tools;

-- Record what these two columns actually mean, because the names suggest
-- otherwise and that has already cost real time.
--
-- Deliberately NOT cleaning up the ~56,900 ingest-set is_trending rows: nothing
-- ranks on the column any more (app/api/tools/trending/route.ts stopped
-- trusting it, and components/tools/tools-browser.tsx stopped rendering a
-- "Featured" badge from it), so rewriting 57k rows would churn every index on
-- the table — IVFFlat included — for no read-side benefit, and the ingest would
-- set them again on its next cycle.
COMMENT ON COLUMN ai_tools.is_trending IS
  'AMBIGUOUS — two writers. The ingest (lib/auto-update.ts, lib/data-sources.ts) '
  'sets it from source heuristics: GitHub stars > 500/3000, HuggingFace downloads '
  '> 100k, top-5 index. That means "popular where it was scraped from", not '
  '"trending on Arcyn Find", and it is true for ~25% of the catalog. '
  'refresh_trending_stats() also writes it, but only for rows with real views. '
  'Do not rank on this column; use trending_score.';

COMMENT ON COLUMN ai_tools.trending_score IS
  'Engagement score 0-100, maintained by refresh_trending_stats() from tool_views. '
  'This is the real trending signal. Was NULL for every row until 2026-09-14, '
  'because the job that populates it had never completed successfully.';
