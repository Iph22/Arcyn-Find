-- Phase 1.1 — the tool profile fields Ask Arcyn needs to answer
-- "I have this problem, which tool solves it, and how do I use it?"
--
-- Additive only. Nothing is dropped or renamed, because the existing columns
-- are load-bearing for search (fts_vector, embedding), the public SEO layer
-- (slug, image, platform) and ranking (popularity, trending_score).
--
-- TWO DELIBERATE DEPARTURES FROM THE SPEC
--
-- 1. `id` stays TEXT, it does not become a uuid. Ids are source-derived
--    ('ot-6697dce1...', 'github-...', '38') and are referenced by tool_views,
--    favorites, reviews and collections. Re-keying 272,755 rows plus every
--    child table is a large, risky migration whose only benefit is cosmetic:
--    the public identity is already `slug`, which is a clean unique key.
--
-- 2. `website_url` and `logo_url` are NOT new columns. They already exist as
--    `platform` and `image` and are read by the SEO layer, the browser and the
--    ingest. Adding synonyms would give every consumer two places to look and
--    guarantee they drift. The TypeScript layer exposes the clearer names.
--
-- WHAT HAS TO BE GENERATED, AND WHAT DOES NOT
--
--   derivable now, free:   status, last_verified_at, categories, alternatives
--   needs an LLM:          long_description, short_description, free_tier_details,
--                          best_for, limitations, learning_curve
--
-- That distinction matters: there are 15,210 distinct products (measured
-- 2026-09-21; see docs/CORPUS_AND_CONSTRAINTS.md §1), so the generated fields
-- are a metered, paid backfill, not something a migration can fill in. The
-- columns are all nullable and every consumer must treat them as optional.

-- ---------------------------------------------------------------------------
-- Descriptions
-- ---------------------------------------------------------------------------

-- The existing `description` is scraped and hard-capped at exactly 200
-- characters, cut mid-word (946 of 1000 sampled rows are exactly 200 chars).
-- It is kept as the raw ingest value; these two are the curated pair.
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS long_description  text;

COMMENT ON COLUMN ai_tools.short_description IS
  '1-2 clean sentences. Curated; falls back to `description` when null.';
COMMENT ON COLUMN ai_tools.long_description IS
  'Multi-paragraph profile. Null until generated; never invent one at read time.';

-- ---------------------------------------------------------------------------
-- Classification
-- ---------------------------------------------------------------------------

-- `category` (singular text) stays: search, the SEO category pages and the
-- ingest all read it. `categories` is the multi-label successor — tools
-- genuinely belong to several, and forcing one is part of why ~2% of rows
-- contradict their own category (§1).
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS categories text[];

ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS best_for    text[];
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS limitations text[];

COMMENT ON COLUMN ai_tools.best_for IS
  'Concrete use cases in the user''s words ("turn long video into short clips"). '
  'This is the field problem-shaped queries should match against.';
COMMENT ON COLUMN ai_tools.limitations IS
  'What the tool is bad at or cannot do. Required for honest trade-offs; an '
  'empty array means "not yet assessed", not "no limitations".';

-- Constrained vocabulary rather than free text, so ranking can order by it.
DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tool_learning_curve') THEN
        CREATE TYPE tool_learning_curve AS ENUM ('beginner', 'intermediate', 'advanced');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tool_status') THEN
        CREATE TYPE tool_status AS ENUM ('active', 'dead', 'unknown');
    END IF;
END
$do$;

ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS learning_curve tool_learning_curve;

-- ---------------------------------------------------------------------------
-- Trust
-- ---------------------------------------------------------------------------

-- `last_updated` is the ingest timestamp — the cron bulk-writes it, so nearly
-- every row shares today's date and it says nothing about whether the tool
-- still exists. `last_verified_at` is set only when something actually checked
-- the site responded, which is what a "Last verified" badge may claim.
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

-- Defaults to 'unknown', not 'active': nothing has been checked yet, and
-- asserting 'active' for 272k unverified rows would be the same class of
-- unfounded claim as "Over 25,000 AI tools".
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS status tool_status NOT NULL DEFAULT 'unknown';

COMMENT ON COLUMN ai_tools.last_verified_at IS
  'When the website last returned a successful response. Null = never checked. '
  'NOT the same as last_updated, which is the ingest timestamp.';

-- ---------------------------------------------------------------------------
-- Relationships and pricing detail
-- ---------------------------------------------------------------------------

-- Curated overrides. Alternatives are computed at read time in
-- lib/similar-tools.ts; this column is for hand-picked ones, and a null means
-- "fall back to the computed list" rather than "no alternatives".
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS alternatives text[];

-- `has_free_tier` is a boolean and cannot express "5 free renders a month",
-- which is exactly what someone asking for a free option needs to know.
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS free_tier_details text;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Deliberately narrow. ai_tools already carries an IVFFlat vector index, and
-- §2 measured that every additional index multiplies the cost of each write —
-- 500-row updates already take 2.1s and 1000 exceeds the statement timeout.
-- So: one GIN for the array actually used in matching, and partial btrees that
-- only cover the rows the queries touch.

-- best_for is what problem-shaped queries match against.
CREATE INDEX IF NOT EXISTS ai_tools_best_for_gin ON ai_tools USING GIN (best_for);

-- Partial: the public layer only ever asks for live, published rows, so the
-- index stays a fraction of the table instead of indexing 272k rows.
CREATE INDEX IF NOT EXISTS ai_tools_live_published_idx
    ON ai_tools (popularity DESC)
    WHERE slug IS NOT NULL AND status <> 'dead';

-- Drives the re-verification sweep: oldest-checked first, live rows only.
CREATE INDEX IF NOT EXISTS ai_tools_verification_due_idx
    ON ai_tools (last_verified_at NULLS FIRST)
    WHERE status <> 'dead';

-- Without this the planner has no statistics for the new columns and will
-- mis-plan against them (§2 records this table's statistics going stale and
-- latency not recovering on its own).
ANALYZE ai_tools;
