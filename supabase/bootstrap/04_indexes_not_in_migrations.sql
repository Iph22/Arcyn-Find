-- ============================================================================
-- 04 — Indexes that exist on the live database but in no migration file
--
-- Run LAST, after the migration files listed in README.md.
--
-- Measured 2026-09-21 against the live ai_tools: 25 indexes, ~281 MB, roughly
-- 45% of a 631 MB database. Eight of them appear in no migration. They were
-- created by hand in the SQL editor at some point and would simply not exist
-- on a new project, which for the vector index means semantic search silently
-- falls back to a sequential scan.
--
-- WHAT IS AND IS NOT VERIFIED HERE
--
-- I have each index's NAME, SIZE and SCAN COUNT, from pg_stat_user_indexes.
-- I do NOT have their definitions -- `indexdef` was requested but the output
-- never came back, so the statements below are RECONSTRUCTED from the column
-- names and from how each one is used in the code.
--
-- Capture the real definitions from the old project before it goes away. This
-- takes one query and removes all doubt:
--
--     SELECT indexdef FROM pg_indexes
--      WHERE tablename = 'ai_tools' AND indexname IN (
--        'idx_ai_tools_embedding_hnsw','idx_ai_tools_name_search',
--        'idx_ai_tools_fts_gin','idx_ai_tools_category',
--        'idx_ai_tools_priority_popularity','idx_ai_tools_access_type',
--        'idx_ai_tools_region','idx_ai_tools_is_trending');
--
-- Paste what it returns over this file. Until then, treat this as best effort.
-- ============================================================================

SET search_path = public, extensions;

-- ----------------------------------------------------------------------------
-- THE ONE THAT MATTERS. 16 MB, 2,168 scans on the live database.
--
-- This is the working vector index. add_semantic_search.sql creates an IVFFlat
-- index instead, which measured 28 MB and ZERO scans -- the planner picks HNSW
-- every time -- and drop_unused_indexes.sql removes it. So if you run the
-- migrations without this file, you finish with no usable vector index at all
-- and every semantic query degrades to a sequential scan over the corpus.
--
-- vector_cosine_ops because search_tools_advanced ranks on cosine distance
-- (`COALESCE(sim, 0.0) * 3.0` in the SQL, per CORPUS_AND_CONSTRAINTS §3).
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_tools_embedding_hnsw
  ON ai_tools USING hnsw (embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
-- Plain btrees on filter columns. These back the category/region/access-type
-- filters in app/api/ai-models and the category pages. Low-cardinality, so
-- they are small; reconstruction risk here is low.
--
-- Live sizes and scan counts, for reference:
--   idx_ai_tools_category              3840 kB    721 scans
--   idx_ai_tools_priority_popularity   3800 kB    276 scans
--   idx_ai_tools_access_type           3624 kB     21 scans
--   idx_ai_tools_region                3568 kB     11 scans
--   idx_ai_tools_is_trending            872 kB    108 scans
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_tools_category    ON ai_tools (category);
CREATE INDEX IF NOT EXISTS idx_ai_tools_access_type ON ai_tools (access_type);
CREATE INDEX IF NOT EXISTS idx_ai_tools_region      ON ai_tools (region);
CREATE INDEX IF NOT EXISTS idx_ai_tools_is_trending ON ai_tools (is_trending);

-- Ordering pair used by app/api/ai-models: `.order('priority', desc
-- nullsFirst:false).order('popularity', desc)`. Column order and the NULLS
-- placement both matter for the planner to use it for the sort.
CREATE INDEX IF NOT EXISTS idx_ai_tools_priority_popularity
  ON ai_tools (priority DESC NULLS LAST, popularity DESC);

-- ----------------------------------------------------------------------------
-- DELIBERATELY OMITTED — do not add these back without measuring first.
--
--   idx_ai_tools_name_search   28 MB, 0 scans
--   idx_ai_tools_fts_gin       34 MB, 3,647 scans
--   idx_ai_tools_platform_trgm 46 MB, 1 scan      (largest index on the table)
--
-- `idx_ai_tools_name_search` has never been scanned. `idx_ai_tools_fts_gin`
-- IS heavily used, but it sits alongside ai_tools_fts_idx (38 MB, 2,177 scans)
-- which add_advanced_search.sql already creates -- if the two are duplicate
-- GIN indexes over fts_vector, the planner is just splitting between them and
-- one is 34 MB of pure overhead. `idx_ai_tools_platform_trgm` is 46 MB for a
-- single lifetime scan.
--
-- Together that is ~108 MB, on a project that was 131 MB over its storage
-- quota. A new database is the one moment you get to not create them. Start
-- without, watch whether anything regresses, and add back only what proves it
-- earns the space.
-- ----------------------------------------------------------------------------

ANALYZE ai_tools;
