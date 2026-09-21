-- ============================================================================
-- Remove the stale four-argument search_tools_advanced.
--
-- THE BUG: two overloads of this function exist in the live database.
--
--   search_tools_advanced(text, vector, float, int)             <- stale
--   search_tools_advanced(text, vector, float, int, text[])     <- current
--
-- How they both survived: add_advanced_search.sql created the four-argument
-- version. fix_advanced_search_bounded_retrieval.sql then introduced
-- `extra_keywords`, but its DROP named the *five*-argument signature — the one
-- that did not exist yet — so the four-argument original was left in place
-- beside the new one. update_advanced_search_v2.sql drops both and would have
-- cleaned this up, so the live database is evidently not at v2.
--
-- WHY IT MATTERS: every parameter after the first has a DEFAULT, so a call
-- naming fewer than five arguments matches both overloads and PostgREST
-- refuses it outright:
--
--   Could not choose the best candidate function between:
--     public.search_tools_advanced(search_query => text, query_embedding =>
--     public.vector, match_threshold => double precision, match_count =>
--     integer), public.search_tools_advanced(search_query => text, ...
--     extra_keywords => text[])
--
-- Nothing is broken today only because every caller happens to pass all five
-- arguments, nulls included (lib/embeddings.ts, lib/landing/search-demo.ts).
-- The first caller that omits one gets a hard 300 from PostgREST, and the
-- error names schema internals rather than anything a reader would connect to
-- their own query. Measured against the live database 2026-09-21.
--
-- Safe to run more than once, and safe to run before or after v2.
-- ============================================================================

BEGIN;

-- Only the four-argument signature. The five-argument one is the live search
-- path and must survive this migration.
DROP FUNCTION IF EXISTS public.search_tools_advanced(text, vector, float, int);

-- Fail loudly rather than leave the database with no search function at all.
-- These migrations are applied by hand in the SQL editor, so a silent partial
-- result here would surface later as an empty directory.
DO $do$
DECLARE
    remaining int;
BEGIN
    SELECT count(*) INTO remaining
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'search_tools_advanced';

    IF remaining <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one search_tools_advanced after this migration, found %. Rolling back.',
            remaining;
    END IF;
END
$do$;

COMMIT;

-- Confirm afterwards — one row, five arguments ending in text[]:
--
--   SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'search_tools_advanced';
