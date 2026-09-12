-- Public SEO URLs for tool pages.
--
-- Tool ids are opaque and source-dependent ('38', 'ot-6601dc5da1b2b5ce0d243776',
-- 'github-cro-chatgpt-lite-1767555388102'), so they cannot be the public URL.
-- A slug column is the only viable lookup key here: docs/CORPUS_AND_CONSTRAINTS.md
-- §2 measured ILIKE on this table at 8.5s-to-timeout at any indexing, so
-- resolving a URL by pattern-matching the name is not an option. An exact
-- equality hit on a unique btree index is.
--
-- Additive and reversible: the column is nullable, and only rows that earn a
-- public page get one (see scripts/seo/backfill-slugs.mjs). A NULL slug means
-- "not published", which is also what the sitemap and page generation read.

ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS slug text;

-- Unique, but only over rows that have a slug. A plain UNIQUE constraint would
-- treat every unpublished row as distinct-NULL and still bloat the index with
-- ~257k useless entries; the partial index stays small (~2.7k).
CREATE UNIQUE INDEX IF NOT EXISTS ai_tools_slug_key
  ON ai_tools (slug)
  WHERE slug IS NOT NULL;

-- The sitemap and directory pages walk "published rows, ordered by id" using
-- keyset pagination (§6: deep .range() offsets timed out at ~87k rows).
CREATE INDEX IF NOT EXISTS ai_tools_slug_published_idx
  ON ai_tools (id)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN ai_tools.slug IS
  'URL segment for the public page at /tools/<slug>. NULL = not published. '
  'One slug per distinct product: duplicate re-ingests of the same tool share '
  'a name, and only the best row of each group is given a slug.';
