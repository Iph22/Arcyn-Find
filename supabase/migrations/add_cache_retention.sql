-- ============================================================================
-- Retention for the two tables that only ever grew.
--
-- 1. search_cache had NO eviction anywhere in the codebase. Every row carries
--    a vector(768) (~3KB), plus `recommendation` and `stack` jsonb payloads
--    and two text arrays. docs/CORPUS_AND_CONSTRAINTS.md §4 measured that 321
--    of 444 cached queries were keystroke fragments ("ai t", "ai too",
--    "ai tool"...) and 338 were never repeated a second time. Those rows were
--    permanent.
--
-- 2. discovery_queue was insert-only. app/api/ai-models/route.ts wrote to it
--    when it skipped inline discovery on a low time budget, with the comment
--    "this queue is a TODO"; nothing in the repository -- no route, script,
--    migration or workflow -- ever read or drained it.
--
-- Neither is the biggest storage item in this database -- indexes are ~281 MB
-- of a 631 MB total, see drop_unused_indexes.sql -- but both grow without
-- bound, so fixing them is what stops the problem coming back.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- search_cache
-- ----------------------------------------------------------------------------

-- The prune predicate filters on last_used_at, which had no index of its own.
-- idx_search_cache_popular is (use_count DESC, last_used_at DESC) -- use_count
-- leads, so it cannot serve a last_used_at range scan.
CREATE INDEX IF NOT EXISTS idx_search_cache_last_used
  ON search_cache (last_used_at);

CREATE OR REPLACE FUNCTION prune_search_cache(
    p_one_shot_days   integer DEFAULT 30,
    p_idle_days       integer DEFAULT 180,
    p_payload_days    integer DEFAULT 30,
    p_delete_limit    integer DEFAULT 2000
)
RETURNS TABLE (
    deleted_one_shot  integer,
    deleted_idle      integer,
    cleared_payloads  integer
)
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_now         timestamptz := now();
    v_one_shot    integer := 0;
    v_idle        integer := 0;
    v_payloads    integer := 0;
BEGIN
    -- 1. Queries that were cached once and never looked up again. use_count
    --    defaults to 1 on insert and is incremented on every cache hit, so
    --    `<= 1` is exactly "nobody ever asked for this a second time". §4
    --    measured this as ~76% of the table, almost all of it keystroke
    --    fragments from a search box.
    --
    --    Bounded by p_delete_limit for the reason in §7: writes against an
    --    indexed table are superlinear in chunk size, and this table carries
    --    four indexes plus a vector column. The caller loops.
    WITH doomed AS (
        SELECT id FROM search_cache
         WHERE use_count <= 1
           AND last_used_at < v_now - (p_one_shot_days || ' days')::interval
         LIMIT p_delete_limit
    )
    DELETE FROM search_cache c USING doomed d WHERE c.id = d.id;
    GET DIAGNOSTICS v_one_shot = ROW_COUNT;

    -- 2. Anything untouched for a long time, however popular it once was.
    --    A query nobody has run in six months is not a cache entry, it is a
    --    record of a search that happened.
    WITH doomed AS (
        SELECT id FROM search_cache
         WHERE last_used_at < v_now - (p_idle_days || ' days')::interval
         LIMIT p_delete_limit
    )
    DELETE FROM search_cache c USING doomed d WHERE c.id = d.id;
    GET DIAGNOSTICS v_idle = ROW_COUNT;

    -- 3. Drop generated payloads the application already considers stale, on
    --    rows worth keeping for their embedding and NLP parse.
    --
    --    add_recommendation_cache.sql sets the recommendation TTL in days and
    --    add_stack_cache.sql sets the stack TTL shorter still (3 days, because
    --    a stack holds several tools and one stale member makes the whole plan
    --    wrong). p_payload_days is deliberately far longer than both: the app
    --    decides freshness, this only reclaims space from payloads that could
    --    not possibly still be served.
    UPDATE search_cache
       SET recommendation = NULL,
           recommendation_at = NULL
     WHERE recommendation IS NOT NULL
       AND recommendation_at < v_now - (p_payload_days || ' days')::interval;
    GET DIAGNOSTICS v_payloads = ROW_COUNT;

    UPDATE search_cache
       SET stack = NULL,
           stack_at = NULL
     WHERE stack IS NOT NULL
       AND stack_at < v_now - (p_payload_days || ' days')::interval;

    RETURN QUERY SELECT v_one_shot, v_idle, v_payloads;
END;
$fn$;

COMMENT ON FUNCTION prune_search_cache(integer, integer, integer, integer) IS
  'Retention for search_cache, which previously had none. Deletes are bounded '
  'by p_delete_limit; the caller loops until a pass returns zero. Called from '
  '/api/cron/update-trending.';

-- Only the service role runs retention.
REVOKE ALL ON FUNCTION prune_search_cache(integer, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- discovery_queue
--
-- Dropped rather than truncated, because an empty table that nothing reads is
-- the same trap one release later: the next person sees it, assumes something
-- consumes it, and writes to it again. The insert in
-- app/api/ai-models/route.ts is removed in the same change.
--
-- To bring the feature back, build the consumer FIRST, then recreate the table
-- with the schema below. A queue with no consumer is a log, and this one was
-- never read:
--
--   CREATE TABLE discovery_queue (
--       id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
--       query_text  text NOT NULL,
--       status      text NOT NULL DEFAULT 'pending',
--       created_at  timestamptz DEFAULT now()
--   );
--   CREATE INDEX idx_discovery_queue_pending
--     ON discovery_queue (created_at) WHERE status = 'pending';
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS discovery_queue;

ANALYZE search_cache;
