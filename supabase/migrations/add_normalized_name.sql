-- Make "how many tools do we have" cheap, and make the ingest able to answer
-- "do I already have this one?"
--
-- THE PROBLEM
--
-- ai_tools has 273,187 rows and 15,218 distinct products. Between 2026-09-21
-- and 2026-09-23 the ingest added 432 rows and 8 products: a 98% waste rate.
-- It re-inserts tools it already has, because its existence check cannot see
-- them (see lib/auto-update.ts).
--
-- Both the check and the headline count need the same thing: the normalized
-- name, computed once and indexed, instead of a regex evaluated across 273k
-- rows every time it is asked.
--
-- WHAT THIS COSTS TO APPLY
--
-- Adding a STORED generated column REWRITES THE TABLE and holds an
-- ACCESS EXCLUSIVE lock for the duration - reads and writes both block. At
-- this row count expect roughly 30-90 seconds. Run it when a short stall is
-- acceptable. The ingest crons run hourly/6-hourly/daily, so any quiet minute
-- works; there is no safe-to-interrupt midpoint, so let it finish.

-- The definition mirrors normalizeName() in lib/seo/slug.ts and the JS in
-- scripts/enrich/enrich-tools.mjs: lowercase, collapse every run of
-- non-alphanumerics to one space, trim. If one changes, change all three, or
-- the public figure stops matching what search de-duplicates to.
--
-- IMMUTABLE by construction: lower() and regexp_replace() both are, which is
-- what a generated column requires.
ALTER TABLE ai_tools
    ADD COLUMN IF NOT EXISTS normalized_name text
    GENERATED ALWAYS AS (
        btrim(regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g'))
    ) STORED;

COMMENT ON COLUMN ai_tools.normalized_name IS
    'Product identity: lower(name) with non-alphanumerics collapsed to spaces. '
    'Generated, so it cannot drift from name. 273,187 rows collapse to 15,218 '
    'of these - the difference is duplicate re-ingests of the same products.';

-- Not unique: the duplicates already exist and this migration does not delete
-- them. It exists so both the count and the ingest check are index scans.
CREATE INDEX IF NOT EXISTS ai_tools_normalized_name_idx
    ON ai_tools (normalized_name);

-- ---------------------------------------------------------------------------
-- The ingest's existence check
-- ---------------------------------------------------------------------------
-- An RPC rather than a PostgREST filter, because PostgREST cannot express
-- DISTINCT and silently caps responses at 1000 rows (§2). Asking "which of
-- these 100 names exist?" over a table where one name can occupy 665 rows
-- would return 1000 rows of mostly the same name and truncate the answer -
-- which is a more subtle version of the exact bug this replaces.
--
-- DISTINCT bounds the result at one row per input name, so it cannot truncate.
CREATE OR REPLACE FUNCTION existing_tool_names(p_names text[])
RETURNS TABLE (normalized_name text)
LANGUAGE sql
STABLE
AS $fn$
    SELECT DISTINCT t.normalized_name
      FROM ai_tools t
     WHERE t.normalized_name = ANY(p_names);
$fn$;

REVOKE ALL ON FUNCTION existing_tool_names(text[]) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Make the catalog count survivable
-- ---------------------------------------------------------------------------
-- The previous body ran
--     COUNT(DISTINCT btrim(regexp_replace(lower(name), ...)))
-- over every row. That fit inside the 8-9s statement timeout when written and
-- no longer does - a forced recompute on 2026-09-23 failed with
--     canceling statement due to statement timeout
-- leaving the cached figure frozen at its 2026-09-21 value. The site kept
-- serving (the cached read is ~800ms) but the number could no longer refresh.
--
-- Counting the stored column instead is an index scan.
CREATE OR REPLACE FUNCTION catalog_stats_current(
    p_max_age interval DEFAULT '24 hours'
)
RETURNS TABLE (
    distinct_products integer,
    published         integer,
    categories        integer,
    total_rows        integer,
    computed_at       timestamptz
)
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_fresh boolean;
BEGIN
    SELECT (s.computed_at > now() - p_max_age)
      INTO v_fresh
      FROM catalog_stats s
     WHERE s.id;

    IF COALESCE(v_fresh, false) THEN
        RETURN QUERY
        SELECT s.distinct_products, s.published, s.categories, s.total_rows, s.computed_at
          FROM catalog_stats s
         WHERE s.id;
        RETURN;
    END IF;

    WITH computed AS (
        SELECT
            COUNT(DISTINCT NULLIF(normalized_name, ''))::integer AS distinct_products,
            COUNT(*) FILTER (WHERE slug IS NOT NULL)::integer     AS published,
            COUNT(DISTINCT category) FILTER (WHERE slug IS NOT NULL)::integer AS categories,
            COUNT(*)::integer                                     AS total_rows
        FROM ai_tools
    )
    INSERT INTO catalog_stats AS cs (id, distinct_products, published, categories, total_rows, computed_at)
    SELECT true, c.distinct_products, c.published, c.categories, c.total_rows, now()
      FROM computed c
    ON CONFLICT (id) DO UPDATE
       SET distinct_products = EXCLUDED.distinct_products,
           published         = EXCLUDED.published,
           categories        = EXCLUDED.categories,
           total_rows        = EXCLUDED.total_rows,
           computed_at       = EXCLUDED.computed_at;

    RETURN QUERY
    SELECT s.distinct_products, s.published, s.categories, s.total_rows, s.computed_at
      FROM catalog_stats s
     WHERE s.id;
END;
$fn$;

REVOKE ALL ON FUNCTION catalog_stats_current(interval) FROM PUBLIC, anon, authenticated;

-- The new column and index have no statistics until this runs, and the
-- planner will not use an index it knows nothing about (§2).
ANALYZE ai_tools;

-- Refresh immediately so the frozen 2026-09-21 figure is replaced.
SELECT * FROM catalog_stats_current('0 seconds'::interval);
