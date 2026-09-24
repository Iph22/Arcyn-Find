-- ============================================================================
-- 01 — Extensions
--
-- Run FIRST, before anything else. Several later files declare columns and
-- indexes whose types come from these, and Postgres will not defer resolving
-- them.
--
-- Supabase installs extensions into the `extensions` schema rather than
-- `public`. fix_advanced_search_bounded_retrieval.sql records what that cost
-- the last time it was missed: "operator class gin_trgm_ops does not exist for
-- access method gin", because the session's search_path did not include it.
-- Setting the path here covers both layouts.
-- ============================================================================

SET search_path = public, extensions;

-- Semantic search. ai_tools.embedding is vector(768) (gemini-embedding-001 at
-- outputDimensionality=768) and the HNSW index in 04 depends on this.
CREATE EXTENSION IF NOT EXISTS vector;

-- Trigram matching. Note that ILIKE against ai_tools is NOT viable at any
-- indexing on a corpus this size -- docs/CORPUS_AND_CONSTRAINTS.md §2 measured
-- 8.5s on name and a timeout on description. This is here because
-- search_tools_advanced uses trigram matching on `platform`, which is a short
-- URL column, and because `show_trgm`/`show_limit` are exposed.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- gen_random_uuid(), used as the default on most primary keys.
-- Built into Postgres 13+, but declared so this file does not silently depend
-- on the server version.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Enum types
--
-- These MUST exist before 02_tables.sql runs: ai_tools.learning_curve and
-- ai_tools.status are declared with them, so the CREATE TABLE fails outright
-- with "type public.tool_status does not exist" if they are missing.
--
-- They are defined in add_tool_profile_fields.sql, which sits late in the
-- migration order — far too late for a table that needs them at creation time.
-- Copied here verbatim, guarded the same way, so running that migration later
-- is still a no-op rather than an error.
-- ----------------------------------------------------------------------------
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
