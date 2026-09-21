-- Honest, cheap catalog statistics for the public landing page.
--
-- WHY THIS EXISTS
--
-- The landing page claimed numbers the data does not support. Measured
-- 2026-09-21 by walking the whole table:
--
--     rows in ai_tools          272,755
--     DISTINCT PRODUCTS          15,210
--     duplicate rows            257,545   (94.4%)
--     with a public page          2,913
--
-- Two separate problems came out of that:
--
--   1. `/api/tools/count` returned the planner's ROW estimate (272,753), and
--      the page rendered it as "272.7K+ AI Tools". That is an 18x overstatement,
--      because 94.4% of rows are duplicate re-ingests of the same products.
--      (docs/CORPUS_AND_CONSTRAINTS.md §1 recorded 55% from a top-5,000 sample;
--      across the full table it is far worse.)
--   2. Google was showing "Over 25,000 AI tools", a figure with no basis in the
--      data at all, while a visitor browsing the public directory could only
--      reach 2,913. The site looked like it was inflating.
--
-- The defensible number is the distinct-product count: 15,210. That is what
-- `search_tools_advanced` effectively presents, since it applies
-- DISTINCT ON (normalized name), and it is what this function computes.
--
-- WHY IT IS CACHED IN A TABLE
--
-- COUNT(DISTINCT normalized_name) over 272k rows is a full scan with a regexp
-- per row. That is fine once a day and completely unacceptable per page view,
-- and this table's statement timeout is 8-9s (§2). So the expensive query runs
-- at most once per p_max_age and everything else reads one cached row.

CREATE TABLE IF NOT EXISTS catalog_stats (
    -- Single-row table: the CHECK pins the key to true so a second row cannot
    -- be inserted, which makes the upsert below trivially correct.
    id                boolean PRIMARY KEY DEFAULT true CHECK (id),
    distinct_products integer     NOT NULL,
    published         integer     NOT NULL,
    categories        integer     NOT NULL,
    total_rows        integer     NOT NULL,
    computed_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE catalog_stats IS
  'One cached row of public-facing catalog counts. Refreshed by '
  'catalog_stats_current(). distinct_products is the honest headline figure; '
  'total_rows is NOT, because 94.4% of rows are duplicate re-ingests.';

/**
 * Current stats, recomputing only when the cached row is older than p_max_age.
 */
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

    -- Recompute. The normalisation mirrors normalizeName() in lib/seo/slug.ts:
    -- lowercase, collapse every run of non-alphanumerics to a single space,
    -- trim. If one changes, change both, or the public figure stops matching
    -- what search actually de-duplicates to.
    WITH computed AS (
        SELECT
            COUNT(DISTINCT NULLIF(btrim(regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g')), ''))::integer
                AS distinct_products,
            COUNT(*) FILTER (WHERE slug IS NOT NULL)::integer
                AS published,
            COUNT(DISTINCT category) FILTER (WHERE slug IS NOT NULL)::integer
                AS categories,
            COUNT(*)::integer
                AS total_rows
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

-- Read-only for the public roles: the figures are shown on the landing page,
-- but only the service role should be able to trigger a recompute.
REVOKE ALL ON FUNCTION catalog_stats_current(interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE catalog_stats FROM PUBLIC, anon, authenticated;

-- Warm it once now, so the first visitor after deploy does not pay for the
-- scan and the numbers are available immediately.
SELECT * FROM catalog_stats_current('0 seconds'::interval);
