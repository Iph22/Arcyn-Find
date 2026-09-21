-- ============================================================================
-- Stop the public SEO layer downloading the whole published catalog to render
-- one page.
--
-- THE PROBLEM THIS SOLVES
--
-- lib/seo/catalog.ts getPublishedTools() keyset-walks every published row
-- (~2,929 rows x 17 columns, ~3-4MB) and the callers then reduce that array
-- in JavaScript:
--
--   getRelatedTools()   scores all ~2,929 and returns 8
--   deriveCategories()  counts all ~2,929 into ~30 category rows
--   getCategoryBySlug() filters all ~2,929 down to one category
--
-- React's cache() memoises that within a single render, but not across
-- requests -- so every ISR revalidation of every tool page paid for the whole
-- catalog again. At ~2,600 tool pages on a 2-hour revalidate that is the
-- dominant line item in this project's Supabase egress.
--
-- The fix is to do the reduction in SQL, where it is an aggregate over an
-- index rather than 3-4MB over the wire.
--
-- Additive and idempotent: two functions and two partial indexes. Nothing is
-- dropped and no existing query changes behaviour. lib/seo/catalog.ts falls
-- back to the old in-JavaScript derivation if these functions are absent, so
-- the application keeps working before this migration is applied.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Indexes. Both are PARTIAL over `slug IS NOT NULL`, which is ~2,900 of
-- ~263,000 rows, so they are small -- the same reasoning as
-- ai_tools_slug_key in add_tool_slugs.sql.
-- ----------------------------------------------------------------------------

-- Serves getRelatedTools() and getCategoryBySlug(): published rows in one
-- category, most popular first.
CREATE INDEX IF NOT EXISTS ai_tools_published_category_popularity_idx
  ON ai_tools (category, popularity DESC)
  WHERE slug IS NOT NULL;

-- Serves the tag-overlap half of getRelatedTools(). idx_ai_tools_tags_gin
-- already exists but spans all 263k rows; this one covers only the published
-- band, so the overlap probe never touches the large index.
CREATE INDEX IF NOT EXISTS ai_tools_published_tags_idx
  ON ai_tools USING gin (tags)
  WHERE slug IS NOT NULL;

-- ----------------------------------------------------------------------------
-- published_category_stats()
--
-- Replaces deriveCategories() walking the full catalog. Returns one row per
-- category with a total and an indexable count.
--
-- !! KEEP IN SYNC WITH isIndexable() IN lib/seo/catalog.ts !!
--
-- The predicate below is a direct translation of that function. There are two
-- implementations of one rule, which is a real drift risk, so it is worth
-- being explicit about why: the JavaScript version has to exist because it
-- decides `robots: noindex` per page from a row already in memory, and this
-- version has to exist because counting 2,929 rows in JavaScript costs 3-4MB
-- of egress per request. If you change one, change the other, and re-run
-- `npm run seo:audit` -- it reports the counts both gates produce.
--
-- The gate, as measured on 2026-09-12 over the 2,913 distinct products in the
-- popularity>=90 band (see §6.1 of docs/CORPUS_AND_CONSTRAINTS.md):
--
--     >=120 chars + tags + not a stub                 2,704
--     + >=2 tags + image                              2,701
--     + >=25 words                                    2,603   <- this gate
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION published_category_stats()
RETURNS TABLE (
    category         text,
    total_count      bigint,
    indexable_count  bigint
)
LANGUAGE sql
STABLE
AS $fn$
    SELECT
        t.category::text,
        count(*) AS total_count,
        count(*) FILTER (
            WHERE length(btrim(coalesce(t.description, ''))) >= 120
              AND btrim(coalesce(t.description, '')) !~* '^AI tool mentioned in:'
              AND array_length(
                      regexp_split_to_array(btrim(coalesce(t.description, '')), '\s+'),
                      1
                  ) >= 25
              AND coalesce(array_length(t.tags, 1), 0) >= 2
              AND t.image IS NOT NULL    AND t.image <> ''
              AND t.platform IS NOT NULL AND t.platform <> ''
        ) AS indexable_count
      FROM ai_tools t
     WHERE t.slug IS NOT NULL
       AND t.category IS NOT NULL
       AND t.category <> ''
     GROUP BY t.category
$fn$;

COMMENT ON FUNCTION published_category_stats() IS
  'Per-category counts over published rows (slug IS NOT NULL). indexable_count '
  'mirrors isIndexable() in lib/seo/catalog.ts -- change both together. '
  'Replaces a ~3-4MB full-catalog read that was reduced to ~30 rows in JS.';

-- ----------------------------------------------------------------------------
-- find_published_slug_by_name(p_name)
--
-- Replaces getToolByNormalizedName(), which walked the whole catalog to answer
-- "this id has no slug of its own -- does a duplicate re-ingest of the same
-- product hold one?" (§1: 55% of the corpus is duplicate re-ingests).
--
-- Uses idx_ai_tools_name_normalized from
-- fix_advanced_search_bounded_retrieval.sql, so the expression here must match
-- that index's expression EXACTLY or the index is skipped:
--
--     lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))
--
-- Note this normalisation is not identical to normalizeName() in
-- lib/seo/slug.ts, which also strips diacritics via NFKD. For an accented
-- name the two disagree, the lookup misses, and resolveToolRoute falls through
-- to `kind: 'unpublished'` -- which renders the page noindex instead of
-- redirecting to the canonical one. That is the same outcome as no match at
-- all, so it degrades safely rather than 404ing. Matching the index was worth
-- more than matching the JS: the alternative was the full walk this replaces.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION find_published_slug_by_name(p_name text)
RETURNS text
LANGUAGE sql
STABLE
AS $fn$
    SELECT t.slug
      FROM ai_tools t
     WHERE t.slug IS NOT NULL
       AND lower(regexp_replace(t.name, '[^a-zA-Z0-9]', '', 'g'))
         = lower(regexp_replace(p_name, '[^a-zA-Z0-9]', '', 'g'))
     ORDER BY t.popularity DESC NULLS LAST, t.id
     LIMIT 1
$fn$;

COMMENT ON FUNCTION find_published_slug_by_name(text) IS
  'Canonical published slug for a product name, for resolving duplicate '
  're-ingests to the row that owns the public page. Expression matches '
  'idx_ai_tools_name_normalized exactly -- do not "tidy" it.';

-- ----------------------------------------------------------------------------
-- ai_tools_estimated_count()
--
-- The landing page displays a total ("Searching across N AI tools"). It got
-- that from a client-side `select('*', { count: 'exact', head: true })` on
-- every single visit -- a full count over ~263k rows, per visitor, for a
-- marketing figure. §2 measured `count: 'exact'` on this table as a shape that
-- times out.
--
-- reltuples is the planner's own row estimate. It costs a single lookup in
-- pg_class with no access to the table at all, and it is maintained by the
-- same ANALYZE that every migration here already runs. For a headline number
-- rounded to "263.5K+" the estimate and the exact count are the same string.
--
-- Returns -1 on a table that has never been analyzed; the caller treats any
-- non-positive value as "no number available" and falls back to its own
-- placeholder, which is what it already did when the count query failed.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ai_tools_estimated_count()
RETURNS bigint
LANGUAGE sql
STABLE
AS $fn$
    SELECT c.reltuples::bigint
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = 'ai_tools'
       AND n.nspname = 'public'
$fn$;

COMMENT ON FUNCTION ai_tools_estimated_count() IS
  'Planner row estimate for ai_tools, for the landing page headline. Replaces '
  'a per-visit exact count over ~263k rows. Accurate to within a fraction of '
  'a percent after ANALYZE, and free.';

-- These are read-only and only expose already-public data, so the anon role
-- may call them. The SEO layer runs server-side with the service role, but
-- keeping anon workable means a client component can use them without a new
-- API route.
GRANT EXECUTE ON FUNCTION published_category_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION find_published_slug_by_name(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION ai_tools_estimated_count() TO anon, authenticated;

-- New indexes need fresh statistics before the planner will cost them
-- correctly -- see the note in fix_advanced_search_bounded_retrieval.sql.
ANALYZE ai_tools;
