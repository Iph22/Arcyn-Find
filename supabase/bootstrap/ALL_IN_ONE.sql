-- ============================================================================
-- ARCYN FIND — complete schema for a NEW, EMPTY Supabase project.
--
-- Generated 2026-09-28. Paste the whole thing into the SQL editor
-- and run it once. It builds every table, index, function and trigger.
--
-- It creates NO DATA. Load that separately — see supabase/bootstrap/README.md.
--
-- Safe to re-run: every statement is CREATE ... IF NOT EXISTS or
-- CREATE OR REPLACE. If it stops with an error, the section banners below
-- tell you exactly which file it died in.
-- ============================================================================


-- ###########################################################################
-- ## STEP 01 of 26 — supabase/bootstrap/01_extensions.sql
-- ###########################################################################

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


-- ###########################################################################
-- ## STEP 02 of 26 — supabase/bootstrap/02_tables.sql
-- ###########################################################################

-- ============================================================================
-- 02 — Core tables
--
-- WHY THIS FILE EXISTS AT ALL
--
-- These eleven tables have no CREATE TABLE statement anywhere in this
-- repository. `supabase/schema.sql` is zero bytes, and
-- 001_clerk_compatible_schema.sql is a CONVERSION migration -- it drops
-- policies and retypes columns on tables it assumes already exist. So the
-- migrations directory could not build a new database, and was never able to.
--
-- HOW IT WAS PRODUCED
--
-- Generated 2026-09-24 from the live database's PostgREST OpenAPI schema
-- (GET /rest/v1/ with Accept: application/openapi+json), which reports the
-- real column list, the real Postgres type of each column, NOT NULL, and the
-- primary/foreign keys. It is a description of the database as it actually is,
-- not as the migrations imply it should be.
--
-- WHAT IT CANNOT KNOW  -- read before trusting this in production
--
-- The OpenAPI schema does not expose column DEFAULTs, CHECK constraints, or
-- UNIQUE constraints. Specifically:
--
--   * DEFAULTs below are INFERRED from the convention every other table in
--     this schema follows (`id uuid DEFAULT gen_random_uuid()`,
--     `created_at/updated_at DEFAULT now()`). They are not read from the
--     live database.
--   * CHECK constraints are absent. The live ai_tools almost certainly has
--     some (access_type is a small enum in practice).
--   * UNIQUE constraints are absent except where a later migration adds them
--     -- add_tool_slugs.sql creates the partial unique index on `slug`, and
--     add_missing_perf_indexes.sql notes UNIQUE(tool_id, user_id) on
--     tool_reviews and UNIQUE(follower_id, following_id) on user_follows,
--     neither of which is created anywhere in this repo.
--
-- To capture the real ones from the existing project before it goes away:
--
--     SELECT conrelid::regclass AS table, conname, pg_get_constraintdef(oid)
--       FROM pg_constraint
--      WHERE connamespace = 'public'::regnamespace
--      ORDER BY 1, 2;
--
--     SELECT table_name, column_name, column_default
--       FROM information_schema.columns
--      WHERE table_schema = 'public' AND column_default IS NOT NULL
--      ORDER BY 1, 2;
--
-- Foreign keys are applied at the bottom, after every table exists, so the
-- order of the CREATE statements cannot matter.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_follows (
  id uuid DEFAULT gen_random_uuid(),
  follower_id text NOT NULL,
  following_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS collections (
  id uuid DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  description text,
  is_public boolean,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS user_activities (
  id uuid DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  activity_type text NOT NULL,
  tool_id text,
  collection_id uuid,
  review_id uuid,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS ai_tools (
  id text,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  platform text NOT NULL,
  region text NOT NULL,
  access_type text NOT NULL,
  pricing text,
  tags text[],
  popularity integer,
  last_updated date,
  is_trending boolean,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  image text,
  priority integer,
  view_count integer,
  view_count_24h integer,
  view_count_7d integer,
  last_view_at timestamp with time zone,
  trending_score real,
  embedding public.vector(768),
  fts_vector tsvector,
  pricing_model text,
  price_monthly_min_usd numeric(10, 2),
  price_monthly_max_usd numeric(10, 2),
  has_free_tier boolean,
  has_free_trial boolean,
  slug text,
  short_description text,
  long_description text,
  categories text[],
  best_for text[],
  limitations text[],
  learning_curve public.tool_learning_curve,
  last_verified_at timestamp with time zone,
  status public.tool_status NOT NULL,
  alternatives text[],
  free_tier_details text,
  normalized_name text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS tool_reviews (
  id uuid DEFAULT gen_random_uuid(),
  tool_id text NOT NULL,
  user_id text,
  rating integer NOT NULL,
  title text,
  review_text text,
  helpful_count integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id text,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  banner_url text,
  user_role text,
  purpose text,
  experience_level text,
  categories text[],
  features text[],
  onboarding_completed boolean,
  instructions_seen boolean,
  onboarding_completed_at timestamp with time zone,
  preferences jsonb,
  email text,
  last_digest_sent_at timestamp with time zone,
  unsubscribe_token text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS collection_items (
  id uuid DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL,
  tool_id text NOT NULL,
  added_at timestamp with time zone,
  notes text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS pricing_history (
  id uuid DEFAULT gen_random_uuid(),
  tool_id text NOT NULL,
  pricing_text text,
  pricing_tier text,
  price_amount numeric,
  currency text,
  recorded_at timestamp with time zone,
  source text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS price_alerts (
  id uuid DEFAULT gen_random_uuid(),
  tool_id text NOT NULL,
  user_id text NOT NULL,
  alert_type text NOT NULL,
  threshold_price numeric,
  is_active boolean,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id uuid DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  tool_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id uuid DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL,
  user_id text NOT NULL,
  is_helpful boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Foreign keys, applied after every table exists so order cannot matter.
ALTER TABLE user_follows ADD CONSTRAINT user_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE user_follows ADD CONSTRAINT user_follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE collections ADD CONSTRAINT collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE user_activities ADD CONSTRAINT user_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE user_activities ADD CONSTRAINT user_activities_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES ai_tools(id) ON DELETE CASCADE;
ALTER TABLE user_activities ADD CONSTRAINT user_activities_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;
ALTER TABLE user_activities ADD CONSTRAINT user_activities_review_id_fkey FOREIGN KEY (review_id) REFERENCES tool_reviews(id) ON DELETE CASCADE;
ALTER TABLE tool_reviews ADD CONSTRAINT tool_reviews_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES ai_tools(id) ON DELETE CASCADE;
ALTER TABLE tool_reviews ADD CONSTRAINT tool_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE collection_items ADD CONSTRAINT collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;
ALTER TABLE collection_items ADD CONSTRAINT collection_items_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES ai_tools(id) ON DELETE CASCADE;
ALTER TABLE pricing_history ADD CONSTRAINT pricing_history_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES ai_tools(id) ON DELETE CASCADE;
ALTER TABLE price_alerts ADD CONSTRAINT price_alerts_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES ai_tools(id) ON DELETE CASCADE;
ALTER TABLE price_alerts ADD CONSTRAINT price_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE user_favorites ADD CONSTRAINT user_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE user_favorites ADD CONSTRAINT user_favorites_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES ai_tools(id) ON DELETE CASCADE;
ALTER TABLE review_helpful_votes ADD CONSTRAINT review_helpful_votes_review_id_fkey FOREIGN KEY (review_id) REFERENCES tool_reviews(id) ON DELETE CASCADE;
ALTER TABLE review_helpful_votes ADD CONSTRAINT review_helpful_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;


-- ###########################################################################
-- ## STEP 03 of 26 — supabase/bootstrap/03_view_and_grants.sql
-- ###########################################################################

-- ============================================================================
-- 03 — The user_stats view, and role grants
--
-- Lifted verbatim from 001_clerk_compatible_schema.sql, which is otherwise
-- skipped by this bootstrap: that file is a one-way conversion (UUID user ids
-- to TEXT, for Clerk) applied to a database that already existed. On a fresh
-- project the tables in 02 are already TEXT, so replaying it would at best do
-- nothing and at worst fail partway through a transaction that also drops
-- policies. These two pieces are the only parts of it a new database needs.
--
-- Run AFTER 02 — the view reads four tables defined there.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_stats
--
-- Read by lib/community.ts (getLeaderboard, getUserStats) and
-- app/api/users/[id]/stats. All ten columns are used.
--
-- Worth knowing before it gets slow: four LEFT JOINs with COUNT(DISTINCT ...)
-- grouped over the whole of user_profiles, so ORDER BY over this view
-- aggregates every user before applying LIMIT. Fine at current scale.
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS user_stats CASCADE;

CREATE VIEW user_stats AS
SELECT
  up.id,
  up.username,
  up.display_name,
  up.avatar_url,
  COUNT(DISTINCT tr.id) as total_reviews,
  COUNT(DISTINCT c.id) as total_collections,
  COUNT(DISTINCT uf_following.follower_id) as followers_count,
  COUNT(DISTINCT uf_follower.following_id) as following_count,
  COALESCE(SUM(tr.helpful_count), 0) as total_helpful_votes,
  MAX(tr.created_at) as last_review_date
FROM user_profiles up
LEFT JOIN tool_reviews tr ON up.id = tr.user_id
LEFT JOIN collections c ON up.id = c.user_id
LEFT JOIN user_follows uf_following ON up.id = uf_following.following_id
LEFT JOIN user_follows uf_follower ON up.id = uf_follower.follower_id
GROUP BY up.id, up.username, up.display_name, up.avatar_url;

GRANT SELECT ON user_stats TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Row Level Security
--
-- DELIBERATELY NOT CONFIGURED HERE, and that is a decision you need to make
-- rather than inherit.
--
-- 001_clerk_compatible_schema.sql states the current posture outright: "RLS
-- policies are permissive (auth handled in API layer with service role key)".
-- Every server route goes through getSupabaseAdmin(), which uses the service
-- role key and bypasses RLS entirely, and each route calls getCurrentUser()
-- itself -- that is where authorisation actually happens (see proxy.ts, which
-- describes its own check as optimistic and not the boundary).
--
-- So on the OLD project, RLS was not what kept one user's data away from
-- another. If you enable RLS on the new project without policies, reads
-- through the anon key return zero rows and the parts of the app that use the
-- browser client (lib/collections.ts, lib/storage.ts, lib/user-preferences.ts)
-- break silently rather than loudly.
--
-- Two coherent options. Pick one on purpose:
--
--   A. Match the old project. Leave RLS off, keep every data path server-side
--      behind the service role key. Cheapest, and it is what the code already
--      assumes. The risk is that the anon key is in the client bundle, so any
--      table left readable is world-readable.
--
--   B. Enable RLS and write policies. Correct, but it is real work and must be
--      done before the app points at this database, not after.
--
-- To see exactly what the old project had, run this against it while it still
-- exists:
--
--     SELECT schemaname, tablename, rowsecurity
--       FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
--
--     SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
--       FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
-- ----------------------------------------------------------------------------


-- ###########################################################################
-- ## STEP 04 of 26 — supabase/migrations/add_advanced_search.sql
-- ###########################################################################

-- ============================================
-- ADVANCED SEARCH MIGRATION
-- Adds Full-Text Search (FTS) for better keyword search and
-- a search_cache table to save API tokens for Gemini.
-- ============================================

BEGIN;

-- 1. Create a search cache table to persist Gemini NLP parses and embeddings
CREATE TABLE IF NOT EXISTS search_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_text TEXT NOT NULL UNIQUE,
    semantic_embedding vector(768),
    nlp_keywords TEXT[],
    nlp_categories TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    use_count INT DEFAULT 1
);

-- Index the cache on query text for very fast lookups
CREATE INDEX IF NOT EXISTS idx_search_cache_query ON search_cache (query_text);

-- 2. Add Full-Text Search (FTS) vector column to ai_tools
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS fts_vector tsvector;

-- 3. Create a function to automatically update the fts_vector
CREATE OR REPLACE FUNCTION update_ai_tools_fts_vector() RETURNS trigger AS $$
BEGIN
  -- We include name (weight A), tags (weight A), category (weight B), description (weight C)
  NEW.fts_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.platform, '')), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 4. Create trigger to keep fts_vector updated on insert or update
DROP TRIGGER IF EXISTS trg_ai_tools_fts_update ON ai_tools;
CREATE TRIGGER trg_ai_tools_fts_update
BEFORE INSERT OR UPDATE ON ai_tools
FOR EACH ROW EXECUTE FUNCTION update_ai_tools_fts_vector();

-- 5. Back-fill the fts_vector for existing rows
UPDATE ai_tools SET id = id WHERE fts_vector IS NULL;

-- 6. Create GIN index for blazing fast FTS
CREATE INDEX IF NOT EXISTS ai_tools_fts_idx ON ai_tools USING GIN (fts_vector);

-- 7. Advanced Hybrid Search Function that combines FTS and Semantic Search
-- If query_embedding is NULL, it falls back to pure FTS (much better than ILIKE)
-- v2: All signals normalized to 0–1 before weighting. Explicit weight formula.
DROP FUNCTION IF EXISTS search_tools_advanced(text, vector, float, int);
CREATE OR REPLACE FUNCTION search_tools_advanced(
  search_query text,           -- The raw text search query
  query_embedding vector(768) DEFAULT NULL, -- Optional semantic embedding
  match_threshold float DEFAULT 0.25,
  match_count int DEFAULT 30
)
RETURNS TABLE (
  id text,
  name text,
  category text,
  description text,
  platform text,
  region text,
  access_type text,
  pricing text,
  tags text[],
  popularity int,
  last_updated date,
  is_trending boolean,
  image text,
  priority int,
  similarity float,
  fts_score float,
  keyword_score float,
  source_trust_score float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
DECLARE
  tsquery_val tsquery;
BEGIN
  -- Convert user query "like google" into a tsquery
  -- Example: "best AI audio" -> 'best' & 'ai' & 'audio'
  tsquery_val := websearch_to_tsquery('english', search_query);

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.category,
    t.description,
    t.platform,
    t.region,
    t.access_type,
    t.pricing,
    t.tags,
    t.popularity,
    t.last_updated,
    t.is_trending,
    t.image,
    t.priority,

    -- Semantic Similarity (already 0–1 from cosine distance)
    CASE 
      WHEN t.embedding IS NOT NULL AND query_embedding IS NOT NULL 
      THEN (1 - (t.embedding <=> query_embedding))::double precision
      ELSE 0.0::double precision
    END as similarity,

    -- FTS Score: multiply by 4.0 then cap at 1.0 so it actually contributes
    LEAST(ts_rank(t.fts_vector, tsquery_val)::double precision * 4.0, 1.0) as fts_score,

    -- keyword_score: same normalized FTS value, kept separate for the ranking layer
    LEAST(ts_rank(t.fts_vector, tsquery_val)::double precision * 4.0, 1.0) as keyword_score,

    -- source_trust_score: derived from priority column, normalized 0–1
    LEAST(COALESCE(t.priority, 0)::double precision / 10.0, 1.0) as source_trust_score,

    -- Combined Score with explicit weights (all inputs normalized 0–1)
    (
      -- Semantic similarity × 3.0
      (CASE 
        WHEN t.embedding IS NOT NULL AND query_embedding IS NOT NULL 
        THEN (1 - (t.embedding <=> query_embedding))::double precision
        ELSE 0.0::double precision
       END * 3.0)
      +
      -- FTS / keyword match × 4.0 (highest weight — most direct relevance)
      (LEAST(ts_rank(t.fts_vector, tsquery_val)::double precision * 4.0, 1.0) * 4.0)
      +
      -- Source trust × 3.0
      (LEAST(COALESCE(t.priority, 0)::double precision / 10.0, 1.0) * 3.0)
      +
      -- Popularity normalized × 1.5
      (LEAST(COALESCE(t.popularity, 0)::double precision / 10000.0, 1.0) * 1.5)
      +
      -- Trending bonus × 1.0
      (CASE WHEN t.is_trending THEN 1.0::double precision ELSE 0.0::double precision END)
    )::double precision as combined_score

  FROM ai_tools t
  WHERE 
    -- Condition 1: Semantic match passes threshold
    (t.embedding IS NOT NULL AND query_embedding IS NOT NULL AND 1 - (t.embedding <=> query_embedding) > match_threshold)
    OR
    -- Condition 2: Full Text Search matches, even without perfect semantic score
    (tsquery_val @@ t.fts_vector)
  ORDER BY 
    combined_score DESC,
    t.is_trending DESC,
    t.popularity DESC NULLS LAST
  LIMIT match_count;
END;
$$;

-- 8. Function to atomically increment search popularity
-- Called fire-and-forget from the API to track popular searches
CREATE OR REPLACE FUNCTION increment_search_count(search_query text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO search_cache (query_text, use_count, last_used_at)
  VALUES (search_query, 1, NOW())
  ON CONFLICT (query_text) 
  DO UPDATE SET 
    use_count = search_cache.use_count + 1,
    last_used_at = NOW();
END;
$$;

-- 9. Index for fast popular search lookups (used by autocomplete)
CREATE INDEX IF NOT EXISTS idx_search_cache_popular 
ON search_cache (use_count DESC, last_used_at DESC);

COMMIT;



-- ###########################################################################
-- ## STEP 05 of 26 — supabase/migrations/add_semantic_search.sql
-- ###########################################################################

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to ai_tools table
-- 768 dimensions for Gemini's text-embedding-004 model
ALTER TABLE ai_tools 
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create index for fast similarity search
-- Using IVFFlat for balance between speed and accuracy
CREATE INDEX IF NOT EXISTS ai_tools_embedding_idx 
ON ai_tools 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function to search tools by semantic similarity
DROP FUNCTION IF EXISTS search_tools_semantic(vector, float, int);
CREATE OR REPLACE FUNCTION search_tools_semantic(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id text,
  name text,
  category text,
  description text,
  platform text,
  region text,
  access_type text,
  pricing text,
  tags text[],
  popularity int,
  last_updated date,
  is_trending boolean,
  image text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_tools.id,
    ai_tools.name,
    ai_tools.category,
    ai_tools.description,
    ai_tools.platform,
    ai_tools.region,
    ai_tools.access_type,
    ai_tools.pricing,
    ai_tools.tags,
    ai_tools.popularity,
    ai_tools.last_updated,
    ai_tools.is_trending,
    ai_tools.image,
    (1 - (ai_tools.embedding <=> query_embedding))::double precision as similarity
  FROM ai_tools
  WHERE ai_tools.embedding IS NOT NULL
    AND 1 - (ai_tools.embedding <=> query_embedding) > match_threshold
  ORDER BY ai_tools.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Hybrid search: combines semantic + keyword search with ranking
DROP FUNCTION IF EXISTS search_tools_hybrid(vector, text, float, int);
CREATE OR REPLACE FUNCTION search_tools_hybrid(
  query_embedding vector(768),
  search_text text DEFAULT '',
  match_threshold float DEFAULT 0.4,
  match_count int DEFAULT 30
)
RETURNS TABLE (
  id text,
  name text,
  category text,
  description text,
  platform text,
  region text,
  access_type text,
  pricing text,
  tags text[],
  popularity int,
  last_updated date,
  is_trending boolean,
  image text,
  similarity float,
  keyword_match boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.category,
    t.description,
    t.platform,
    t.region,
    t.access_type,
    t.pricing,
    t.tags,
    t.popularity,
    t.last_updated,
    t.is_trending,
    t.image,
    CASE 
      WHEN t.embedding IS NOT NULL THEN (1 - (t.embedding <=> query_embedding))::double precision
      ELSE 0.0::double precision
    END as similarity,
    (
      search_text != '' AND (
        t.name ILIKE '%' || search_text || '%' OR
        t.description ILIKE '%' || search_text || '%'
      )
    ) as keyword_match
  FROM ai_tools t
  WHERE 
    -- Include if semantic similarity is high enough
    (t.embedding IS NOT NULL AND 1 - (t.embedding <=> query_embedding) > match_threshold)
    OR
    -- Or if keyword matches (fallback)
    (search_text != '' AND (
      t.name ILIKE '%' || search_text || '%' OR
      t.description ILIKE '%' || search_text || '%'
    ))
  ORDER BY 
    -- Prioritize semantic matches, then keyword matches
    CASE 
      WHEN t.embedding IS NOT NULL THEN 1 - (t.embedding <=> query_embedding)
      ELSE 0.3
    END DESC,
    t.popularity DESC NULLS LAST
  LIMIT match_count;
END;
$$;

-- Add comment for documentation
COMMENT ON COLUMN ai_tools.embedding IS 'Semantic embedding vector (768 dimensions) generated from name + description using Gemini text-embedding-004';


-- ###########################################################################
-- ## STEP 06 of 26 — supabase/migrations/add_view_tracking.sql
-- ###########################################################################

-- Create table for tracking tool views (idempotent - safe to run multiple times)
-- This enables analytics and accurate trending calculations

CREATE TABLE IF NOT EXISTS tool_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tool_id TEXT NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_hash TEXT, -- Hashed IP for uniqueness (privacy-safe)
    session_id TEXT, -- Optional session tracking
    source TEXT DEFAULT 'web' -- web, api, etc.
);

-- Index for querying views by tool in time windows (use CREATE INDEX IF NOT EXISTS)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tool_views_tool_time') THEN
        CREATE INDEX idx_tool_views_tool_time ON tool_views(tool_id, viewed_at DESC);
    END IF;
END $$;

-- Index for time-based queries (trending calculations)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tool_views_time') THEN
        CREATE INDEX idx_tool_views_time ON tool_views(viewed_at DESC);
    END IF;
END $$;

-- Add view_count column to ai_tools for caching
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS view_count_24h INTEGER DEFAULT 0;
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS view_count_7d INTEGER DEFAULT 0;
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS last_view_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS trending_score REAL DEFAULT 0;

-- Indexes for ai_tools (use DO blocks for idempotency)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_tools_view_count') THEN
        CREATE INDEX idx_ai_tools_view_count ON ai_tools(view_count DESC);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_tools_trending_score') THEN
        CREATE INDEX idx_ai_tools_trending_score ON ai_tools(trending_score DESC);
    END IF;
END $$;

-- Comments on columns (safe to run multiple times)
COMMENT ON COLUMN ai_tools.view_count IS 'Total all-time view count';
COMMENT ON COLUMN ai_tools.view_count_24h IS 'Views in last 24 hours (updated by cron)';
COMMENT ON COLUMN ai_tools.view_count_7d IS 'Views in last 7 days (updated by cron)';
COMMENT ON COLUMN ai_tools.trending_score IS 'Calculated trending score (0-100)';


-- ###########################################################################
-- ## STEP 07 of 26 — supabase/migrations/add_tool_submissions.sql
-- ###########################################################################

-- ============================================
-- TOOL SUBMISSIONS TABLE
-- Allows users to submit new AI tools for review.
-- This is the #1 growth mechanism for AI tool directories.
-- ============================================

BEGIN;

-- Create the tool_submissions table for crowd-sourced tool discovery
CREATE TABLE IF NOT EXISTS tool_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT DEFAULT 'Other',
    pricing TEXT DEFAULT 'Unknown',
    access_type TEXT DEFAULT 'Unknown',
    tags TEXT[] DEFAULT '{}',
    submitted_by TEXT,               -- Email of submitter (optional)
    status TEXT DEFAULT 'pending',   -- pending, approved, rejected
    reviewed_by TEXT,                -- Admin who reviewed
    review_notes TEXT,               -- Notes from review
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    
    -- Prevent duplicate submissions
    CONSTRAINT unique_submission_name_url UNIQUE (name, url)
);

-- Index for fast lookups by status
CREATE INDEX IF NOT EXISTS idx_submissions_status 
ON tool_submissions (status, submitted_at DESC);

-- Index for duplicate checking
CREATE INDEX IF NOT EXISTS idx_submissions_name 
ON tool_submissions (lower(name));

COMMIT;


-- ###########################################################################
-- ## STEP 08 of 26 — supabase/migrations/add_priority_column.sql
-- ###########################################################################

-- Add priority column to ai_tools table
-- Priority is a score from 0-100 that determines search ranking
-- Higher priority = consumer-facing tools, lower = research/repos

ALTER TABLE ai_tools 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 50;

-- Create index for faster sorting by priority
CREATE INDEX IF NOT EXISTS idx_ai_tools_priority ON ai_tools(priority DESC);

-- Comment on column
COMMENT ON COLUMN ai_tools.priority IS 'Priority score 0-100 for search ranking. Higher = consumer tools, lower = research/repos';


-- ###########################################################################
-- ## STEP 09 of 26 — supabase/migrations/add_structured_pricing.sql
-- ###########################################################################

-- ============================================================================
-- Phase 2 foundation: structured pricing.
--
-- `ai_tools.pricing` is free text ("Free tier, Pro $20/mo", "Free tier +
-- $25-199/month", "$40/year, Free, $198/year"). Good for display, unusable as
-- data. Three Phase 2 features need it as data:
--   - pricing comparison between recommended tools
--   - price filtering / sorting in the directory
--   - the "pricing fit" term in the recommendation scoring formula
-- and the "best budget option" label becomes computable instead of being
-- inferred by the model from prose.
--
-- The free-text column is KEPT and stays authoritative for display. These
-- columns are a derived projection of it, populated by
-- scripts/database/backfill-pricing.js using the deterministic parser in
-- lib/pricing.ts (no LLM — 257k rows, and the text parses with rules; the
-- parser passes 12/12 hand-written expectations including yearly->monthly
-- normalization and price ranges).
--
-- Everything is normalized to MONTHLY USD so rows quoting different billing
-- periods are comparable.
-- ============================================================================

ALTER TABLE ai_tools
  ADD COLUMN IF NOT EXISTS pricing_model text,
  ADD COLUMN IF NOT EXISTS price_monthly_min_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS price_monthly_max_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS has_free_tier boolean,
  ADD COLUMN IF NOT EXISTS has_free_trial boolean;

COMMENT ON COLUMN ai_tools.pricing_model IS
  'Derived from pricing text by lib/pricing.ts: free | freemium | trial | paid | usage | custom | unknown';
COMMENT ON COLUMN ai_tools.price_monthly_min_usd IS
  'Cheapest paid tier normalized to USD/month (yearly quotes divided by 12). NULL when unpriced. 0 for free-only tools.';
COMMENT ON COLUMN ai_tools.price_monthly_max_usd IS
  'Most expensive paid tier normalized to USD/month.';
COMMENT ON COLUMN ai_tools.has_free_tier IS
  'A permanently free option exists. Distinct from has_free_trial.';
COMMENT ON COLUMN ai_tools.has_free_trial IS
  'A time-limited free trial exists. Kept separate from has_free_tier because the distinction drives budget recommendations.';

-- Supports "cheapest first" ordering and price-range filters. Partial: rows
-- with no derivable price are excluded rather than bloating the index, since
-- every query using it filters on a price being present.
CREATE INDEX IF NOT EXISTS idx_ai_tools_price_monthly_min
  ON ai_tools (price_monthly_min_usd)
  WHERE price_monthly_min_usd IS NOT NULL;

-- Supports faceted filtering ("free tools in category X").
CREATE INDEX IF NOT EXISTS idx_ai_tools_pricing_model
  ON ai_tools (pricing_model)
  WHERE pricing_model IS NOT NULL;

-- WORKLIST index for the backfill's resume mode.
--
-- The two indexes above are both `WHERE pricing_model IS NOT NULL`, which is
-- the opposite of what a resuming backfill needs: it looks for rows still
-- unclassified. Without this index, `WHERE pricing_model IS NULL ORDER BY id`
-- has to walk the primary key past ~240k already-done rows to accumulate one
-- page of work, and times out before returning anything.
--
-- This index only ever contains the rows still to do, so it starts small and
-- shrinks to empty as the backfill completes — at which point it costs
-- essentially nothing to keep. Safe to DROP once every row is classified:
--   DROP INDEX IF EXISTS idx_ai_tools_pricing_unclassified;
CREATE INDEX IF NOT EXISTS idx_ai_tools_pricing_unclassified
  ON ai_tools (id)
  WHERE pricing_model IS NULL;

-- ============================================================================
-- Bulk partial-column update for the backfill.
--
-- Supabase's .upsert() CANNOT do this. It generates
-- `INSERT ... ON CONFLICT (id) DO UPDATE`, and the INSERT half must satisfy
-- every NOT NULL column — so a payload carrying only the derived pricing
-- columns fails with `null value in column "name" violates not-null
-- constraint` before ON CONFLICT is ever reached. (Learned the hard way: the
-- first backfill run failed on every batch for exactly this reason.)
--
-- A real UPDATE ... FROM against an unnested JSON array does the whole batch
-- in one statement with correct update semantics, touching only these columns.
-- ============================================================================

-- IMPLEMENTATION NOTE: this loops single-row UPDATEs rather than doing one
-- set-based `UPDATE ... FROM jsonb_to_recordset(...)` join. The join version
-- was written first and TIMED OUT on every batch.
--
-- Reason: jsonb_to_recordset is a function scan, so the planner has no
-- statistics for it and falls back to a generic row estimate. With a few
-- hundred rows on one side and 257k on the other it costed a hash join —
-- meaning a full scan of ai_tools *per batch*, ~500 times over.
--
-- A loop of `WHERE id = <literal>` updates is guaranteed to use the primary
-- key index, and because the whole loop runs inside one function call there is
-- still only ONE network round trip per batch. Slightly more per-statement
-- overhead server-side, but predictable instead of pathological.
CREATE OR REPLACE FUNCTION bulk_update_tool_pricing(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  rec record;
  affected integer := 0;
BEGIN
  FOR rec IN
    SELECT * FROM jsonb_to_recordset(payload) AS src(
      id                    text,
      pricing_model         text,
      price_monthly_min_usd numeric,
      price_monthly_max_usd numeric,
      has_free_tier         boolean,
      has_free_trial        boolean
    )
  LOOP
    UPDATE ai_tools
    SET
      pricing_model         = rec.pricing_model,
      price_monthly_min_usd = rec.price_monthly_min_usd,
      price_monthly_max_usd = rec.price_monthly_max_usd,
      has_free_tier         = rec.has_free_tier,
      has_free_trial        = rec.has_free_trial
    WHERE id = rec.id;

    IF FOUND THEN
      affected := affected + 1;
    END IF;
  END LOOP;

  RETURN affected;
END;
$$;

ANALYZE ai_tools;


-- ###########################################################################
-- ## STEP 10 of 26 — supabase/migrations/add_tool_slugs.sql
-- ###########################################################################

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


-- ###########################################################################
-- ## STEP 11 of 26 — supabase/migrations/add_normalized_name.sql
-- ###########################################################################

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


-- ###########################################################################
-- ## STEP 12 of 26 — supabase/migrations/add_recommendation_cache.sql
-- ###########################################################################

-- ============================================================================
-- Phase 2: cache generated recommendations.
--
-- Measured problem this solves. Running the 26-query eval back to back:
--     reasoned  50%   <- 12x HTTP 429 + 1x 503 from the Gemini free tier
--     latency   p50 4011ms / p95 6474ms
-- Every degraded call still returned a usable recommendation from the
-- deterministic template, but half of them lost the actual reasoning about the
-- user's goal — which is the entire point of the feature. Bursty traffic makes
-- it worse, and repeat queries were paying full price every time.
--
-- Reuses search_cache rather than a new table: it is already keyed on
-- query_text (UNIQUE, indexed) and already caches this exact query's embedding
-- and NLP parse, so a recommendation lookup rides the same index and the same
-- row. One row per query, three cached artifacts.
-- ============================================================================

ALTER TABLE search_cache
  ADD COLUMN IF NOT EXISTS recommendation jsonb,
  ADD COLUMN IF NOT EXISTS recommendation_at timestamptz;

COMMENT ON COLUMN search_cache.recommendation IS
  'Cached /api/recommend response body. Only ever written for NON-degraded results — caching a deterministic-fallback recommendation would pin the lower-quality version in place for the whole TTL.';
COMMENT ON COLUMN search_cache.recommendation_at IS
  'When the cached recommendation was generated. Used for TTL expiry; the tool corpus changes slowly, so the TTL is days rather than minutes.';

-- Lets the freshness check (`recommendation_at > now() - interval`) be answered
-- from the index for rows that actually have a cached recommendation, instead
-- of touching every search_cache row.
CREATE INDEX IF NOT EXISTS idx_search_cache_recommendation_at
  ON search_cache (query_text, recommendation_at)
  WHERE recommendation IS NOT NULL;

ANALYZE search_cache;


-- ###########################################################################
-- ## STEP 13 of 26 — supabase/migrations/add_stack_cache.sql
-- ###########################################################################

-- ============================================================================
-- Phase 3: cache generated stacks.
--
-- Same reasoning as add_recommendation_cache.sql, but the case is stronger. A
-- stack costs one model call to decompose the goal PLUS one retrieval per step
-- (up to 5), so it is the most expensive thing this app computes. The Gemini
-- quota has been the binding constraint throughout Phase 2 and 3 — the
-- recommendation eval has been reporting `reasoned 0%` on the free tier — so a
-- stack that has already been built must not be rebuilt because someone
-- searched the same goal twice.
--
-- Additive and idempotent: two nullable columns on the table that already holds
-- this query's embedding, NLP parse and recommendation. One row per query, now
-- four cached artifacts, all reachable through the existing query_text index.
-- ============================================================================

ALTER TABLE search_cache
  ADD COLUMN IF NOT EXISTS stack jsonb,
  ADD COLUMN IF NOT EXISTS stack_at timestamptz;

COMMENT ON COLUMN search_cache.stack IS
  'Cached /api/stack response body. Only ever written for non-degraded stacks with at least one filled step — caching a "temporarily unavailable" result would pin it in place for the whole TTL, and quota exhaustion is exactly what produces those results.';
COMMENT ON COLUMN search_cache.stack_at IS
  'When the cached stack was generated. TTL is deliberately SHORTER than the recommendation TTL (3 days vs 7): a stack contains several tools, so it has several times the chance of holding something whose pricing changed, and one stale member makes the whole plan wrong.';

-- Mirrors idx_search_cache_recommendation_at: lets the freshness check
-- (`stack_at > now() - interval`) be answered from the index for rows that
-- actually have a cached stack, rather than touching every search_cache row.
CREATE INDEX IF NOT EXISTS idx_search_cache_stack_at
  ON search_cache (query_text, stack_at)
  WHERE stack IS NOT NULL;

ANALYZE search_cache;


-- ###########################################################################
-- ## STEP 14 of 26 — supabase/migrations/add_recommendation_feedback.sql
-- ###########################################################################

-- ============================================================================
-- Phase 2: recommendation feedback.
--
-- WHY THIS MATTERS MORE THAN IT LOOKS: right now the only signal on whether
-- recommendations are any good is a synthetic eval whose relevance check is a
-- loose substring match. It scored 100% while still surfacing "TLDR" for "find
-- and fix bugs in my codebase". This table is the first source of real
-- judgement from actual users, and the input the doc's ranking-improvement
-- loop needs.
--
-- Column types deliberately match the existing tables rather than what you'd
-- pick fresh: tool_id is text (ai_tools.id is text, e.g. "ot-6696a31e..."), and
-- user_id is text because the schema still carries Clerk-era ids
-- ("user_35tHpyxCP4sZRtlFJCeNdwQ0f3m") even though auth is Google OAuth now.
-- ============================================================================

CREATE TABLE IF NOT EXISTS recommendation_feedback (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- The goal the user typed, normalized the same way the recommendation
    -- cache normalizes it, so feedback joins to cached recommendations.
    query_text text NOT NULL,

    -- Which tool was being judged, and in which slot it appeared. Slot matters:
    -- "the best match was wrong" is a different signal from "this alternative
    -- was unhelpful", and ranking changes should be able to tell them apart.
    tool_id text NOT NULL,
    slot text NOT NULL DEFAULT 'best_match',

    verdict text NOT NULL,

    -- Only meaningful for a 'down' verdict. Constrained to a small set so it
    -- stays aggregatable — free-text would be unusable for ranking work.
    reason text,

    -- NULL for anonymous feedback. Deliberately allowed: requiring sign-in
    -- would collapse the volume of the only real quality signal we have.
    user_id text,

    created_at timestamptz DEFAULT now(),

    CONSTRAINT recommendation_feedback_verdict_check
        CHECK (verdict IN ('up', 'down')),
    CONSTRAINT recommendation_feedback_slot_check
        CHECK (slot IN ('best_match', 'alternative')),
    CONSTRAINT recommendation_feedback_reason_check
        CHECK (reason IS NULL OR reason IN (
            'not_relevant', 'too_expensive', 'missing_feature',
            'better_alternative', 'wrong_category', 'other'
        ))
);

-- One vote per signed-in user per (query, tool). Partial, because anonymous
-- rows have NULL user_id and NULLs don't collide in a unique index — anonymous
-- spam is handled by the endpoint's rate limit instead.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rec_feedback_unique_user_vote
    ON recommendation_feedback (user_id, query_text, tool_id)
    WHERE user_id IS NOT NULL;

-- "How does this tool perform when recommended?" — feeds tool-level ranking.
CREATE INDEX IF NOT EXISTS idx_rec_feedback_tool
    ON recommendation_feedback (tool_id, verdict);

-- "How do recommendations for this query perform?" — feeds query-level tuning.
CREATE INDEX IF NOT EXISTS idx_rec_feedback_query
    ON recommendation_feedback (query_text);

-- Recent-first analytics.
CREATE INDEX IF NOT EXISTS idx_rec_feedback_created
    ON recommendation_feedback (created_at DESC);

ANALYZE recommendation_feedback;


-- ###########################################################################
-- ## STEP 15 of 26 — supabase/migrations/fix_advanced_search_bounded_retrieval.sql
-- ###########################################################################

-- ============================================================================
-- Fix: search_tools_advanced was filtering the WHOLE ai_tools table with a
-- threshold-based WHERE clause on vector distance, which defeats the IVFFlat
-- index (ai_tools_embedding_idx). IVFFlat only accelerates
-- "ORDER BY embedding <=> query_embedding LIMIT k" queries — it cannot be used
-- to satisfy an arbitrary "WHERE 1 - (embedding <=> query_embedding) > x"
-- predicate, so every row with a non-null embedding was getting its distance
-- computed on every search (full sequential scan).
--
-- Same problem on the FTS side: the previous version scored (ts_rank) and
-- sorted every row matching ANY of {semantic, FTS, ILIKE, synonym} in one
-- combined WHERE-OR, uncapped, before the final LIMIT. A single common word
-- could pull thousands of ILIKE/FTS matches into that sort.
--
-- Fix: retrieve each candidate source through its own bounded,
-- index-accelerated query (ORDER BY ... LIMIT), union the candidate ids,
-- and only then join back to compute combined_score and do the final
-- ORDER BY + LIMIT match_count over that bounded set.
-- ============================================================================

-- ============================================================================
-- Fix: the traditional ILIKE fallback path (route.ts's buildBaseQuery, used
-- whenever hybridSearch degrades or returns nothing) was hitting a Postgres
-- statement timeout for common queries like "gauth ai". Root cause: two of
-- its OR-branches had no usable index at all —
--   - tags.cs.{word} (array containment) had NO index on ai_tools.tags. Any
--     unindexed branch in a Supabase `.or(...)` filter forces a sequential
--     scan for the WHOLE combined WHERE clause, even though name/description
--     already had trigram indexes — one unindexed OR branch defeats all of them.
--   - platform ILIKE had no trigram index either (only name/description got one
--     in update_advanced_search_v2.sql).
--
-- CORRECTION (added after measuring): adding these indexes was NOT sufficient,
-- and the original conclusion here was wrong. Trigram ILIKE on this table is
-- non-viable regardless of indexing — see the long note inside
-- search_tools_advanced below for the measurements and the reason. The tags
-- GIN index below is still worth keeping (array containment genuinely uses
-- it); the platform trigram index is retained only because dropping an index
-- is a separate decision, but nothing should be adding new ILIKE paths.
-- ============================================================================

-- "operator class gin_trgm_ops does not exist for access method gin" means
-- pg_trgm's operator classes aren't resolvable in the current search_path —
-- either the extension was never actually installed on this database (the
-- CREATE EXTENSION in update_advanced_search_v2.sql may never have been run,
-- or aborted partway through a multi-statement script), or Supabase installed
-- it into its dedicated "extensions" schema rather than "public", and this
-- session's search_path doesn't include it. Covering both: make sure the
-- extension exists, and make sure both plausible schemas are searched.
SET search_path = public, extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_ai_tools_platform_trgm
  ON ai_tools USING gin (platform gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ai_tools_tags_gin
  ON ai_tools USING gin (tags);

-- Every text tier below does `WHERE <fts match> ORDER BY popularity DESC LIMIT n`.
-- With only a GIN index available, Postgres must collect ALL matching rows and
-- sort them before applying the LIMIT — fine for a rare term (594ms measured
-- for "basketball highlight clipper"), but for a very common lexeme like "ai"
-- or "image" that means sorting ~100k rows (8-10s measured, sometimes timing
-- out). This index gives the planner a second option for exactly those cases:
-- walk popularity in index order and stop as soon as it has n FTS matches,
-- which terminates almost immediately when matches are dense. The planner
-- picks per query based on estimated selectivity, so rare terms keep the
-- bitmap plan and common terms get the ordered-scan plan.
CREATE INDEX IF NOT EXISTS idx_ai_tools_popularity
  ON ai_tools (popularity DESC NULLS LAST);

-- Supports the rewritten find_similar_tool_name below: a normalized-name
-- equality lookup, replacing the pg_trgm similarity scan that timed out.
CREATE INDEX IF NOT EXISTS idx_ai_tools_name_normalized
  ON ai_tools (lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')));

-- Refresh planner statistics so the newly created indexes above are costed
-- against current data rather than a stale snapshot. Worth doing after any
-- index creation on a table this size.
--
-- (Historical note, corrected: an earlier revision of this file claimed the
-- rare-term-slower-than-common-term inversion we observed — "gauth" at 8.5s
-- vs "for" at 287ms — was caused by stale statistics. That was wrong. The
-- real cause was trigram posting-list cost, explained in detail inside
-- search_tools_advanced below. This ANALYZE is still good practice, but it
-- was never the fix for that symptom.)
ANALYZE ai_tools;

DROP FUNCTION IF EXISTS search_tools_advanced(text, vector, float, int, text[]);

CREATE OR REPLACE FUNCTION search_tools_advanced(
  search_query text,
  query_embedding vector(768) DEFAULT NULL,
  match_threshold float DEFAULT 0.20,
  match_count int DEFAULT 30,
  extra_keywords text[] DEFAULT NULL
)
RETURNS TABLE (
  id text,
  name text,
  category text,
  description text,
  platform text,
  region text,
  access_type text,
  pricing text,
  tags text[],
  popularity int,
  last_updated date,
  is_trending boolean,
  image text,
  priority int,
  similarity float,
  fts_score float,
  keyword_score float,
  source_trust_score float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
DECLARE
  tsquery_val tsquery;      -- primary query, AND semantics (high precision)
  tsquery_broad tsquery;    -- same terms OR'd (breadth — replaces the ILIKE net)
  tsquery_synonym tsquery;  -- caller-supplied synonym expansion, OR'd
  tsquery_token tsquery;
  query_tokens text[];
  -- Candidate pool sizes: bounded multiples of match_count so a single common
  -- word/token can never force a full-table rank-and-sort. Floors keep small
  -- match_count requests (e.g. autocomplete-adjacent calls) from starving the
  -- candidate pool entirely.
  vector_pool_size int := GREATEST(match_count * 4, 40);
  text_pool_size int := GREATEST(match_count * 8, 80);
  tok text;
  -- Above this many matches, sorting the precise tier by popularity costs more
  -- than the ordering is worth (see the note on fts_candidates below).
  sort_safe_limit int := 5000;
  precise_matches int;
  sort_is_safe boolean;
BEGIN
  tsquery_val := websearch_to_tsquery('english', search_query);
  IF tsquery_val IS NULL OR numnode(tsquery_val) = 0 THEN
    tsquery_val := plainto_tsquery('english', search_query);
  END IF;

  SELECT array_agg(DISTINCT token) INTO query_tokens
  FROM unnest(regexp_split_to_array(lower(trim(search_query)), '\s+')) AS token
  WHERE length(token) >= 2;

  -- ==========================================================================
  -- Round 4 — and this time the fix is to STOP using ILIKE entirely.
  --
  -- Measured on this instance (257k rows), per mechanism:
  --     FTS  (fts_vector @@ tsquery)      421ms – 1.5s   <- viable
  --     ILIKE on name (trigram indexed)   8.5s           <- not viable
  --     ILIKE on description (indexed)    TIMEOUT        <- not viable
  --
  -- Trigram ILIKE cannot be made fast here, and rounds 1-3 of this migration
  -- (EXISTS/unnest, then JOIN/unnest, then LATERAL, then literal-pattern
  -- dynamic SQL) were all fighting an unwinnable battle. The reason ILIKE cost
  -- is so bad — and so unpredictable — is trigram commonality, not row
  -- selectivity: '%gauth%' decomposes to trigrams gau/aut/uth, and aut/uth are
  -- pervasive in an AI-tools corpus (automation, authentication, automatic),
  -- so GIN intersects enormous posting lists and rechecks thousands of heap
  -- rows to return a single match. A *rarer* search term can therefore be
  -- dramatically SLOWER than a common one, which makes latency impossible to
  -- reason about on a user-facing path.
  --
  -- FTS has none of these problems: lexeme postings are per-word, so cost
  -- tracks actual match counts. So the loose-text "safety net" that ILIKE used
  -- to provide is now served by a second, OR-semantics tsquery over the same
  -- GIN index, plus the caller's synonym list as a third OR'd tsquery. Typo
  -- tolerance is retained upstream by correctTypos() in lib/search-utils.ts,
  -- and FTS stemming covers morphological variants ("editing" -> "edit").
  --
  -- Semantics note: this drops MID-WORD substring matching. Searching "auth"
  -- will no longer match "Gauthier". That is a deliberate trade — it is the
  -- specific capability that cannot be delivered within the time budget.
  -- ==========================================================================

  -- Breadth query: same tokens, OR'd instead of AND'd.
  IF query_tokens IS NOT NULL THEN
    FOREACH tok IN ARRAY query_tokens LOOP
      tsquery_token := plainto_tsquery('english', tok);
      IF tsquery_token IS NOT NULL AND numnode(tsquery_token) > 0 THEN
        tsquery_broad := CASE
          WHEN tsquery_broad IS NULL THEN tsquery_token
          ELSE tsquery_broad || tsquery_token   -- || is tsquery OR
        END;
      END IF;
    END LOOP;
  END IF;

  -- Synonym expansion supplied by processSearchQuery() in the app layer.
  IF extra_keywords IS NOT NULL THEN
    FOREACH tok IN ARRAY extra_keywords LOOP
      tsquery_token := plainto_tsquery('english', tok);
      IF tsquery_token IS NOT NULL AND numnode(tsquery_token) > 0 THEN
        tsquery_synonym := CASE
          WHEN tsquery_synonym IS NULL THEN tsquery_token
          ELSE tsquery_synonym || tsquery_token
        END;
      END IF;
    END LOOP;
  END IF;

  -- Bounded probe: is the precise tier's match set small enough that sorting it
  -- by popularity is affordable? The probe itself is cheap because it's LIMITed
  -- (measured ~330ms even for the single most common lexeme in the corpus).
  SELECT count(*) INTO precise_matches
  FROM (
    SELECT 1
    FROM ai_tools t
    WHERE tsquery_val IS NOT NULL AND tsquery_val @@ t.fts_vector
    LIMIT sort_safe_limit
  ) probe;

  sort_is_safe := precise_matches < sort_safe_limit;

  -- NOTE on column naming below: RETURNS TABLE(id text, ...) implicitly declares
  -- a PL/pgSQL variable named "id" (and one per output column) visible to every
  -- SQL command in this function body. A bare, unqualified `id` anywhere in a
  -- query here is ambiguous between that variable and any FROM-list column
  -- also named "id" (42702 "column reference is ambiguous") — this bit us in
  -- production for the candidate_ids CTE below, which read `id` unqualified
  -- from each candidate CTE. Every candidate CTE now exposes the tool's id as
  -- `tool_id` instead, which cannot collide with any RETURNS TABLE column name,
  -- so it's safe to reference unqualified anywhere, including GROUP BY.
  RETURN QUERY
  WITH vector_candidates AS (
    -- Index-accelerated: ORDER BY <=> LIMIT is the access pattern IVFFlat
    -- supports. The similarity threshold is applied later, against this
    -- already-bounded pool, never as a full-table predicate.
    SELECT t.id AS tool_id, (1 - (t.embedding <=> query_embedding))::double precision AS sim
    FROM ai_tools t
    WHERE query_embedding IS NOT NULL AND t.embedding IS NOT NULL
    -- NO secondary sort key here, unlike every other tier in this function.
    -- `ORDER BY <=> LIMIT` on its own is the exact access pattern IVFFlat can
    -- serve from the index; adding a tie-breaker column generally forces a
    -- sort node and gives up that index scan. Exact float ties in cosine
    -- distance across 260k rows are vanishingly rare, so the determinism this
    -- would buy is not worth losing the vector index over. Do not "fix" this
    -- for consistency with the tiers below.
    ORDER BY t.embedding <=> query_embedding
    LIMIT vector_pool_size
  ),
  fts_candidates AS (
    -- Precise tier (AND semantics). Popularity ordering matters most here, so
    -- unlike the breadth tiers it is KEPT — but only when the match set is
    -- small enough to sort. Measured: "gauth & ai" (rare term narrows the
    -- intersection to 1 row) sorts in 1982ms, but a lone common lexeme like
    -- "ai", or "image & generator" where both terms are common, matches ~100k
    -- rows and the sort times out.
    --
    -- The two branches below are mutually exclusive on the `sort_is_safe`
    -- boolean computed above, which reaches the planner as a constant — so
    -- whichever branch is disabled has a constant-false WHERE and is skipped
    -- outright rather than executed and discarded.
    (
      SELECT t.id AS tool_id
      FROM ai_tools t
      WHERE sort_is_safe
        AND tsquery_val IS NOT NULL AND tsquery_val @@ t.fts_vector
      ORDER BY t.popularity DESC NULLS LAST, t.id ASC
      LIMIT text_pool_size
    )
    UNION ALL
    (
      SELECT t.id AS tool_id
      FROM ai_tools t
      WHERE NOT sort_is_safe
        AND tsquery_val IS NOT NULL AND tsquery_val @@ t.fts_vector
      ORDER BY t.id ASC
      LIMIT text_pool_size
    )
  ),
  -- ORDER BY t.id in the two OR tiers below. This REPLACES an earlier
  -- deliberate choice to leave them unordered, and the reason is correctness.
  --
  -- The original note read: "these tiers now contribute an ARBITRARY bounded
  -- slice of the match set rather than the most popular slice. That's
  -- acceptable because they exist purely for recall." That reasoning was
  -- wrong in one important way — an arbitrary slice is not a stable slice.
  -- Postgres re-streams a different 240 rows on every execution, so the
  -- recommendation for one goal changed on every request. Measured on
  -- search_tools_advanced with a fixed query, six consecutive FTS-only calls
  -- returned SIX COMPLETELY DISJOINT sets of 30 ids, and /api/recommend
  -- returned three different best matches over six identical calls. For a
  -- product whose job is to answer "which tool should I use", that is a
  -- trust bug, and it also made the eval unable to attribute any change
  -- (precision@1 moved 69% -> 65% between two runs of identical code).
  --
  -- ORDER BY t.id is affordable BECAUSE it is the primary key: Postgres walks
  -- the PK index and stops once it has LIMIT rows, instead of fetching and
  -- sorting the whole match set the way ORDER BY popularity requires.
  -- Re-measured on this table, LIMIT 240:
  --     "gauth | ai"          ORDER BY popularity   3598ms
  --     "gauth | ai"          ORDER BY id            918ms
  --     "image & generator"   ORDER BY popularity   5218ms
  --     "image & generator"   ORDER BY id           1609ms
  -- So the deterministic ordering is also the cheaper one, 3-4x. (The
  -- historical "TIMEOUT >9.1s" figure for ORDER BY popularity predates
  -- idx_ai_tools_popularity; it is 3598ms now, still 4x the id ordering.)
  --
  -- Cost of the trade: ordering by id biases the recall slice toward
  -- lexicographically smaller ids, which in this corpus means GitHub-scraped
  -- rows ("github-cro-...") ahead of others ("ot-..."). That is a known bias,
  -- accepted because these tiers exist only to widen recall and everything is
  -- re-ranked by combined_score below. A quality-ordered slice would need the
  -- popularity sort and its 4x cost.
  broad_candidates AS (
    -- Breadth tier: OR'd tokens over the same GIN index. This is what replaced
    -- the ILIKE safety net — same purpose (catch loose matches the strict AND
    -- query misses), viable mechanism.
    SELECT t.id AS tool_id
    FROM ai_tools t
    WHERE tsquery_broad IS NOT NULL AND tsquery_broad @@ t.fts_vector
    ORDER BY t.id ASC
    LIMIT text_pool_size
  ),
  synonym_candidates AS (
    SELECT t.id AS tool_id
    FROM ai_tools t
    WHERE tsquery_synonym IS NOT NULL AND tsquery_synonym @@ t.fts_vector
    ORDER BY t.id ASC
    LIMIT text_pool_size
  ),
  candidate_ids AS (
    -- Track provenance per tool so we can still require the semantic threshold
    -- for rows that ONLY qualified via vector similarity (a row with a weak
    -- vector match but a real text hit should still be kept).
    SELECT
      tool_id,
      bool_or(src = 'vector') AS via_vector,
      bool_or(src = 'text') AS via_text
    FROM (
      SELECT tool_id, 'vector' AS src FROM vector_candidates
      UNION ALL SELECT tool_id, 'text' FROM fts_candidates
      UNION ALL SELECT tool_id, 'text' FROM broad_candidates
      UNION ALL SELECT tool_id, 'text' FROM synonym_candidates
    ) u
    GROUP BY tool_id
  ),
  -- Score every surviving candidate. Column names are prefixed `o_` rather
  -- than reusing the RETURNS TABLE names (id, name, popularity, ...), because
  -- those are implicitly declared PL/pgSQL variables in this function body and
  -- a bare reference to one from the CTEs below would be ambiguous — the exact
  -- 42702 failure this file already hit once in production.
  scored AS (
    SELECT
      t.id AS o_id,
      t.name AS o_name,
      t.category AS o_category,
      t.description AS o_description,
      t.platform AS o_platform,
      t.region AS o_region,
      t.access_type AS o_access_type,
      t.pricing AS o_pricing,
      t.tags AS o_tags,
      t.popularity AS o_popularity,
      t.last_updated AS o_last_updated,
      t.is_trending AS o_is_trending,
      t.image AS o_image,
      t.priority AS o_priority,

      COALESCE(vc.sim, 0.0::double precision) AS o_similarity,

      -- OUTPUT column stays capped to [0,1]. It is returned twice below, once
      -- as fts_score and once as keyword_score, and lib/search-pipeline.ts
      -- does `keyword_score * 10  // Scale 0–1 → 0–10`, so widening the range
      -- here would silently corrupt the orchestrator's scoring.
      LEAST(COALESCE(ts_rank(t.fts_vector, tsquery_val)::double precision, 0) * 4.0, 1.0) AS o_fts_score,
      LEAST(COALESCE(t.priority, 50)::double precision / 100.0, 1.0) AS o_source_trust_score,

      (
        (COALESCE(vc.sim, 0.0::double precision) * 3.0)
        -- The cap here is DELIBERATE, and it was tested. Read this before
        -- removing it again.
        --
        -- The cap does saturate: `LEAST(ts_rank * 4.0, 1.0) * 4.0` contributes
        -- a flat 4.0 to every row whose ts_rank reaches 0.25, and on one goal
        -- query six of eight returned rows had o_fts_score of exactly 1.000 —
        -- so the highest-weighted relevance term stopped discriminating and
        -- priority/popularity/is_trending decided the winner among near-ties.
        --
        -- That reasoning is sound but the obvious fix is not. Uncapping it to
        -- `ts_rank * 16.0` (identical below the old cap, rising above it) was
        -- deployed and measured against the eval, at a fixed retrieval mix of
        -- hybrid:26 with reasoning off, two runs each:
        --
        --                     capped      uncapped
        --     precision@1     62%         62%        (no change)
        --     keyword hit     92%         88%        (worse)
        --     regressions     6           4          (misleading, see below)
        --
        -- Net: no gain, and one known-good answer regressed — "find and fix
        -- bugs in my codebase" went from Sweep (a real bug-fixing tool) back
        -- to TLDR (a summarizer). Two previously-passing queries also broke.
        -- The lower regression count was not an improvement: those failures
        -- had merely moved from "a rejected tool came back" to "no required
        -- term matched".
        --
        -- WHY it backfired: ts_rank rewards term FREQUENCY and does not
        -- normalize for document length, so a long scraped description that
        -- repeats the query's stems outscores a short precise one. The cap was
        -- crudely suppressing that keyword-stuffing signal. Anyone retrying
        -- this should use ts_rank's length-normalization flags (1 or 2, divide
        -- by document length) rather than raw uncapping, and must re-measure —
        -- scripts/eval/recommendation-eval.mjs is repeatable now, and
        -- scripts/eval/retrieval-determinism.js guards the latency side.
        + (LEAST(COALESCE(ts_rank(t.fts_vector, tsquery_val)::double precision, 0) * 4.0, 1.0) * 4.0)
        + (LEAST(COALESCE(t.priority, 50)::double precision / 100.0, 1.0) * 3.0)
        + (LEAST(COALESCE(t.popularity, 0)::double precision / 10000.0, 1.0) * 1.5)
        + (CASE WHEN t.is_trending THEN 1.0::double precision ELSE 0.0::double precision END)
      )::double precision AS o_combined_score,

      -- Dedup key. Matches idx_ai_tools_name_normalized exactly, so this is an
      -- indexed expression rather than a per-row computation.
      lower(regexp_replace(t.name, '[^a-zA-Z0-9]', '', 'g')) AS o_norm_name

    FROM candidate_ids ci
    JOIN ai_tools t ON t.id = ci.tool_id
    LEFT JOIN vector_candidates vc ON vc.tool_id = ci.tool_id
    WHERE
      ci.via_text
      OR (ci.via_vector AND vc.sim > match_threshold)
  ),
  -- ==========================================================================
  -- Collapse duplicate tools before the final LIMIT.
  --
  -- The corpus carries a lot of same-name-different-id rows (measured: ~250
  -- duplicated names per 1000 sampled rows, largely GitHub-scraped entries
  -- ingested more than once). candidate_ids groups by tool_id, which by
  -- definition cannot catch those, so the top of the result set was collapsing
  -- to a handful of distinct products — "chatbot for customer service" returned
  -- 10 rows containing only 2 distinct names (venom x7, wppconnect x3).
  --
  -- That is fatal for the recommendation flow specifically, which asks for a
  -- best match PLUS alternatives: with a degenerate candidate pool the
  -- "alternatives" are copies of the winner and there is nothing to compare.
  --
  -- Keep the highest-scoring row per normalized name, and dedupe BEFORE the
  -- LIMIT so we return match_count distinct products rather than match_count
  -- rows that might be one product. DISTINCT ON requires its expression to
  -- lead the ORDER BY, hence the re-sort in the outer query.
  -- ==========================================================================
  deduped AS (
    SELECT DISTINCT ON (o_norm_name) *
    FROM scored
    -- o_id last makes this a TOTAL order. Without it, two rows of the same
    -- product with equal score and equal popularity (common here — they are
    -- re-ingests of one GitHub project) leave DISTINCT ON free to keep either,
    -- so which duplicate survives varied between executions.
    ORDER BY o_norm_name, o_combined_score DESC, o_popularity DESC NULLS LAST, o_id ASC
  )
  SELECT
    o_id,
    o_name,
    o_category,
    o_description,
    o_platform,
    o_region,
    o_access_type,
    o_pricing,
    o_tags,
    o_popularity,
    o_last_updated,
    o_is_trending,
    o_image,
    o_priority,
    o_similarity,
    o_fts_score,
    o_fts_score,             -- keyword_score: same signal, kept for API compatibility
    o_source_trust_score,
    o_combined_score
  FROM deduped
  ORDER BY
    o_combined_score DESC,
    o_is_trending DESC,
    o_popularity DESC NULLS LAST,
    -- Total order. Measured combined scores cluster tightly (6.51 / 5.51 /
    -- 5.50 / 5.27 on one goal query), so ties at this point are the norm
    -- rather than an edge case, and an untied ORDER BY let them resolve
    -- differently per execution.
    o_id ASC
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Tool-name duplicate check used by the self-healing discovery flow to avoid
-- inserting a duplicate of an existing tool under a slightly different name
-- (e.g. "ChatGPT" vs "Chat GPT").
--
-- Originally implemented with pg_trgm's `%` similarity operator, which TIMED
-- OUT in production for exactly the same reason the ILIKE tiers did: trigram
-- posting-list cost. "ChatGPT" decomposes to cha/hat/atg/tgp/gpt, and cha/hat
-- are pervasive, so the similarity scan is enormous.
--
-- Rewritten as a normalized-name equality lookup against
-- idx_ai_tools_name_normalized (strip everything non-alphanumeric, lowercase).
-- This is a btree equality probe — effectively instant — and still catches the
-- motivating cases: "ChatGPT" / "Chat GPT" / "chat-gpt" / "Chat  G.P.T." all
-- normalize to "chatgpt".
--
-- What it no longer catches: names that differ by more than punctuation and
-- case, e.g. "ChatGPT" vs "ChatGPT Pro". That is an acceptable narrowing for
-- what is only a best-effort insert guard — callers already treat "no match"
-- and "lookup failed" identically and proceed with the insert.
--
-- The p_threshold parameter is retained for signature compatibility with the
-- existing caller (lib/embeddings.ts findSimilarToolByName) but is no longer
-- used; an exact normalized match is reported as similarity_score 1.0.
-- ============================================================================

DROP FUNCTION IF EXISTS find_similar_tool_name(text, float);

CREATE OR REPLACE FUNCTION find_similar_tool_name(
  p_name text,
  p_threshold float DEFAULT 0.35
)
RETURNS TABLE (id text, name text, similarity_score float)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  normalized_input text;
BEGIN
  normalized_input := lower(regexp_replace(COALESCE(p_name, ''), '[^a-zA-Z0-9]', '', 'g'));

  IF normalized_input = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.id, t.name, 1.0::float AS similarity_score
  FROM ai_tools t
  WHERE lower(regexp_replace(t.name, '[^a-zA-Z0-9]', '', 'g')) = normalized_input
  ORDER BY t.popularity DESC NULLS LAST
  LIMIT 1;
END;
$$;


-- ###########################################################################
-- ## STEP 16 of 26 — supabase/migrations/add_refresh_trending_stats.sql
-- ###########################################################################

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


-- ###########################################################################
-- ## STEP 17 of 26 — supabase/migrations/add_missing_perf_indexes.sql
-- ###########################################################################

-- ============================================================================
-- Perf pass: two lookup patterns that only had a UNIQUE(a, b) constraint,
-- which doesn't help a query that filters on just the SECOND column.
-- ============================================================================

-- tool_reviews: "my reviews" (GET /api/reviews?userId=) filters by user_id
-- alone, but the existing constraint is UNIQUE(tool_id, user_id) — user_id is
-- the trailing column, so this scan wasn't index-assisted.
CREATE INDEX IF NOT EXISTS idx_tool_reviews_user_id ON tool_reviews(user_id);

-- user_follows: "who follows me" (app/api/user/followers, app/api/user/stats)
-- filters by following_id alone, but the existing constraint is
-- UNIQUE(follower_id, following_id) — following_id is the trailing column.
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON user_follows(following_id);

-- /api/tools/trending is a public, homepage-hot endpoint and was taking ~6.4s.
-- It now filters to rows that have an image (the curated subset — see the long
-- note in app/api/tools/trending/route.ts) and orders by popularity, priority.
-- A PARTIAL index over just that subset keeps it small: most of the 257k rows
-- are image-less scraped entries and are excluded from the index entirely.
CREATE INDEX IF NOT EXISTS idx_ai_tools_trending_presentable
  ON ai_tools (popularity DESC, priority DESC NULLS LAST)
  WHERE image IS NOT NULL AND image <> '';

-- Refresh planner stats for both tables now that new indexes exist on them —
-- see fix_advanced_search_bounded_retrieval.sql for why this isn't optional.
ANALYZE tool_reviews;
ANALYZE user_follows;
ANALYZE ai_tools;


-- ###########################################################################
-- ## STEP 18 of 26 — supabase/migrations/add_seo_catalog_rpcs.sql
-- ###########################################################################

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


-- ###########################################################################
-- ## STEP 19 of 26 — supabase/migrations/add_cache_retention.sql
-- ###########################################################################

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


-- ###########################################################################
-- ## STEP 20 of 26 — supabase/migrations/add_catalog_stats.sql
-- ###########################################################################

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


-- ###########################################################################
-- ## STEP 21 of 26 — supabase/migrations/add_notification_digest.sql
-- ###########################################################################

-- ============================================================================
-- Notification digest: recipients, scheduling state, and a send log
-- ============================================================================
--
-- Stands up the storage a periodic email digest needs. Three problems to solve:
--
--   1. There were no recipient addresses. `UserProfile` has declared
--      `email?: string` since the Clerk migration, but `ensureProfile` only
--      ever used the OAuth `metadata.email` to derive a display name and a
--      username -- it never persisted the address. The column is added here
--      and `lib/profile-utils.ts` now writes it on every sign-in, so the
--      recipient list fills in as users return rather than in one backfill.
--
--   2. Nothing recorded what had already been sent. A cron that cannot tell
--      "already delivered" from "never tried" will double-send on any retry,
--      and a retry is exactly what the alert-on-failure workflow encourages.
--
--   3. Unsubscribe needs to work from an email client, which means a GET with
--      no session. The token is the credential.
--
-- Written defensively (ADD COLUMN IF NOT EXISTS, DO blocks) because
-- `user_profiles` has drifted: `preferences`, `user_role`, `experience_level`,
-- `onboarding_completed` and `instructions_seen` are all read by the API and
-- exist in the live database, but appear in no migration in this directory.
-- Assume nothing here about what is already present.
--
-- `user_profiles.id` is TEXT, not UUID -- changed in
-- `001_clerk_compatible_schema.sql` STEP 5. Foreign keys must match.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Recipient address
-- ----------------------------------------------------------------------------

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN user_profiles.email IS
  'Deliverable address from the OAuth provider, written by ensureProfile on '
  'each sign-in. May be an Apple private-relay address, which forwards and is '
  'genuinely deliverable -- do not filter these out.';

-- Partial: the digest query only ever asks for rows that have an address, and
-- most of the table will not until users sign in again.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_profiles_email_present') THEN
    CREATE INDEX idx_user_profiles_email_present
      ON user_profiles (id)
      WHERE email IS NOT NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Scheduling state and the unsubscribe credential
-- ----------------------------------------------------------------------------

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT;

COMMENT ON COLUMN user_profiles.last_digest_sent_at IS
  'When the last digest went out. Also the "new since" watermark for content '
  'selection, so a user who joins mid-week does not receive a backlog.';

COMMENT ON COLUMN user_profiles.unsubscribe_token IS
  'Bearer credential for one-click unsubscribe from an email client, where '
  'there is no session. Unguessable and per-user; rotating it invalidates the '
  'links in already-delivered mail.';

-- Backfill every existing row, then keep new rows covered by a default.
-- gen_random_uuid() is core since PG13; Supabase is well past that.
UPDATE user_profiles
   SET unsubscribe_token = gen_random_uuid()::text
 WHERE unsubscribe_token IS NULL;

ALTER TABLE user_profiles
  ALTER COLUMN unsubscribe_token SET DEFAULT gen_random_uuid()::text;

-- Unique so a token resolves to exactly one account, and indexed because the
-- unsubscribe route's only query is an equality hit on it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_profiles_unsubscribe_token') THEN
    CREATE UNIQUE INDEX idx_user_profiles_unsubscribe_token
      ON user_profiles (unsubscribe_token)
      WHERE unsubscribe_token IS NOT NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Send log
-- ----------------------------------------------------------------------------
--
-- Doubles as the idempotency guard. `digest_key` is the period identifier the
-- sender computes (ISO week, e.g. '2026-W38'); the UNIQUE constraint across
-- (user_id, kind, digest_key) means a second run in the same period cannot
-- produce a second email, however the first run ended.
--
-- The sender claims rows with INSERT ... ON CONFLICT DO NOTHING and sends only
-- to the users it actually claimed. That ordering matters: claiming first means
-- a crash mid-batch leaves a claimed-but-unsent row, and the user misses one
-- digest. Sending first would mean a crash leaves an unclaimed-but-sent row,
-- and the retry emails them twice. Missing one is the better failure.

CREATE TABLE IF NOT EXISTS notification_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  kind          TEXT NOT NULL,
  digest_key    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'claimed',
  message_id    TEXT,
  error         TEXT,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notification_log IS
  'One row per (user, notification kind, period). Audit trail and idempotency '
  'guard for the digest sender.';
COMMENT ON COLUMN notification_log.digest_key IS
  'Period identifier, ISO week (e.g. 2026-W38). Derived from the send time, not '
  'stored per-user, so all recipients of one run share a key.';
COMMENT ON COLUMN notification_log.status IS
  'claimed -> the row was reserved but the send has not resolved yet. '
  'sent -> the provider accepted it. failed -> it did not; error explains.';

-- The idempotency guard itself.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notification_log_period') THEN
    CREATE UNIQUE INDEX idx_notification_log_period
      ON notification_log (user_id, kind, digest_key);
  END IF;
END $$;

-- For the "how did last night's run go" query.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notification_log_recent') THEN
    CREATE INDEX idx_notification_log_recent
      ON notification_log (kind, created_at DESC);
  END IF;
END $$;

-- Foreign key added separately: if `user_profiles.id` is not TEXT in this
-- database the ALTER fails loudly here rather than silently creating an
-- unconstrained table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notification_log_user_id_fkey'
  ) THEN
    ALTER TABLE notification_log
      ADD CONSTRAINT notification_log_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
--
-- The sender runs on the service-role key, which bypasses RLS entirely. This
-- is about what a leaked anon key can reach: a send log names who uses the
-- product and when they were last emailed, so it gets no public policy at all.

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to notification_log" ON notification_log;
CREATE POLICY "No public access to notification_log"
  ON notification_log
  FOR SELECT
  USING (false);


-- ###########################################################################
-- ## STEP 22 of 26 — supabase/migrations/add_contact_submissions.sql
-- ###########################################################################

-- ============================================================================
-- Contact / feedback submissions.
--
-- WHY THIS EXISTS: /api/contact used to email and nothing else. A submission
-- lived only as a message to a hardcoded `hello@arcynfind.com`, which is not a
-- mailbox but an ImprovMX forwarding alias. On 2026-09-21 a beta feedback
-- report was accepted by Resend (the route returned 200) and never arrived —
-- and because nothing was persisted, there was no record it had ever been
-- sent. The content was simply gone, unrecoverably.
--
-- The route now writes here FIRST and emails second, so mail is a notification
-- channel rather than the system of record. Delivery can break at Resend, at
-- the forwarder, or in a spam filter, and the feedback still survives.
--
-- No RLS policies: this table is written and read through the service-role
-- key only, like tool_submissions and recommendation_feedback. Nothing in the
-- public client should ever see other people's messages.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS contact_submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Exactly the four fields contactFormSchema accepts. The schema is
    -- .strict(), so the feedback widget smuggles page context inside
    -- subject/message rather than adding keys; that is why message can be long.
    name text NOT NULL,
    email text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,

    -- 'feedback_widget' or 'contact_form'. Derived from the subject prefix the
    -- widget sets, because the strict schema leaves no room for the client to
    -- declare it. Worth separating: beta reports and cold contact-form mail
    -- get triaged differently.
    source text NOT NULL DEFAULT 'contact_form',

    -- What happened to the notification email, recorded AFTER the attempt.
    -- 'pending' is the value a row keeps if the process dies mid-send, which
    -- is itself the useful signal.
    email_status text NOT NULL DEFAULT 'pending',
    email_id text,      -- Resend message id, for matching against their logs
    email_error text,   -- provider error text when status = 'failed'

    -- Hashed, never raw: enough to spot one address flooding the form, not
    -- enough to identify anyone. Same treatment as tool_views.ip_hash.
    ip_hash text,

    created_at timestamptz DEFAULT now(),

    CONSTRAINT contact_submissions_email_status_check
        CHECK (email_status IN ('pending', 'sent', 'failed', 'not_configured'))
);

-- Triage order: newest first is how anyone actually reads these.
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created
    ON contact_submissions (created_at DESC);

-- The query this table was built for: "what did we fail to deliver?"
CREATE INDEX IF NOT EXISTS idx_contact_submissions_undelivered
    ON contact_submissions (email_status, created_at DESC)
    WHERE email_status <> 'sent';

-- Beta reports separately from general contact mail.
CREATE INDEX IF NOT EXISTS idx_contact_submissions_source
    ON contact_submissions (source, created_at DESC);

COMMIT;

ANALYZE contact_submissions;

-- Reading them back, until there is a UI:
--
--   SELECT created_at, source, name, email, subject, email_status
--   FROM contact_submissions
--   ORDER BY created_at DESC
--   LIMIT 50;
--
--   -- anything the mail path lost
--   SELECT * FROM contact_submissions
--   WHERE email_status <> 'sent'
--   ORDER BY created_at DESC;


-- ###########################################################################
-- ## STEP 23 of 26 — supabase/migrations/add_push_subscriptions.sql
-- ###########################################################################

-- ============================================================================
-- Web push subscriptions
-- ============================================================================
--
-- The browser half of notifications. `public/sw.js` has carried `push` and
-- `notificationclick` handlers since the PWA work, but nothing ever called
-- `pushManager.subscribe()`, so the settings page asked for permission and
-- then discarded the grant. This is where the grant now lands.
--
-- A subscription is per browser, not per user. One person with a laptop and a
-- phone has two rows; clearing site data or reinstalling produces a third and
-- silently orphans the old one. That shape drives the design:
--
--   - the endpoint URL is the identity, not the user
--   - rows are disposable, and the sender deletes them on a 404/410 from the
--     push service rather than retrying
--   - a user with zero rows is normal, not an error
--
-- `user_profiles.id` is TEXT, not UUID (001_clerk_compatible_schema.sql STEP 5).
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  -- The push service URL. Unique because re-subscribing the same browser must
  -- update the existing row rather than accumulate duplicates that all deliver
  -- to the same place -- that is how one person ends up getting six copies.
  endpoint    TEXT NOT NULL,
  -- Encryption material from PushSubscription.toJSON().keys. Without both the
  -- payload cannot be encrypted and the send fails.
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  -- Diagnostics: which browser, and when it last accepted a push. A row that
  -- has never succeeded is the signature of a bad VAPID configuration.
  user_agent  TEXT,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE push_subscriptions IS
  'One row per browser that has granted push permission. Disposable: the '
  'sender deletes rows the push service reports as gone (404/410).';
COMMENT ON COLUMN push_subscriptions.endpoint IS
  'Push service URL, unique per browser install. The subscription identity.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_push_subscriptions_endpoint') THEN
    CREATE UNIQUE INDEX idx_push_subscriptions_endpoint
      ON push_subscriptions (endpoint);
  END IF;
END $$;

-- The sender's only query: "every subscription for these users".
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_push_subscriptions_user') THEN
    CREATE INDEX idx_push_subscriptions_user
      ON push_subscriptions (user_id);
  END IF;
END $$;

-- Added separately so a mismatched `user_profiles.id` type fails loudly here
-- rather than leaving an unconstrained table behind.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_user_id_fkey'
  ) THEN
    ALTER TABLE push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
--
-- The sender runs on the service-role key and bypasses RLS. This is about what
-- a leaked anon key reaches: an endpoint URL plus its `p256dh`/`auth` pair is
-- everything needed to push a notification to that browser. Treat the row as a
-- credential and give it no public policy at all.

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to push_subscriptions" ON push_subscriptions;
CREATE POLICY "No public access to push_subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (false);


-- ###########################################################################
-- ## STEP 24 of 26 — supabase/migrations/add_tool_profile_fields.sql
-- ###########################################################################

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


-- ###########################################################################
-- ## STEP 25 of 26 — supabase/migrations/drop_unused_indexes.sql
-- ###########################################################################

-- ============================================================================
-- Reclaim storage by dropping indexes that are measurably unused.
--
-- READ THIS FIRST: an earlier version of this file was WRONG.
--
-- It dropped idx_ai_tools_description_trgm and idx_ai_tools_name_trgm, on the
-- reasoning that CORPUS_AND_CONSTRAINTS.md §2 measured ILIKE as non-viable and
-- that every caller was dead code. The reasoning was sound; the premise was
-- not. **Those two indexes do not exist on this database.**
-- update_advanced_search_v2.sql, which creates them, was evidently never
-- applied. The file was a no-op that also advised KEEPING
-- idx_ai_tools_platform_trgm as "small" -- it is 46 MB, the largest index on
-- the table, with 1 lifetime scan.
--
-- The lesson, recorded because it will happen again: this project's
-- supabase/migrations/ directory DOES NOT describe the live database. Six of
-- the 25 indexes on ai_tools appear in no migration file
-- (idx_ai_tools_name_search, idx_ai_tools_fts_gin, idx_ai_tools_embedding_hnsw,
-- idx_ai_tools_category, idx_ai_tools_priority_popularity,
-- idx_ai_tools_access_type, idx_ai_tools_region, idx_ai_tools_is_trending),
-- and at least one migration was never run. **Measure the live schema before
-- reasoning about it.**
--
-- ----------------------------------------------------------------------------
-- MEASURED 2026-09-21. ai_tools carries ~281 MB of indexes against a 631 MB
-- database, so indexes are ~45% of the total.
--
--   index                              size     idx_scan
--   idx_ai_tools_platform_trgm         46 MB           1
--   ai_tools_fts_idx                   38 MB        2177
--   idx_ai_tools_fts_gin               34 MB        3647
--   idx_ai_tools_name_search           28 MB           0
--   ai_tools_embedding_idx             28 MB           0
--   ai_tools_pkey                      26 MB     1802965
--   idx_ai_tools_embedding_hnsw        16 MB        2168
--   idx_ai_tools_trending_score        11 MB           4
--   idx_ai_tools_tags_gin            6728 kB           0
--   idx_ai_tools_tags                6704 kB         599
--   (18 smaller indexes omitted)
-- ----------------------------------------------------------------------------
--
-- This file now contains ONLY the drop I am confident in from that data.
-- The other candidates need their definitions checked first -- see the block
-- at the bottom. I am not writing DROP statements for indexes whose
-- definitions I have not seen, which is the mistake that produced the
-- earlier version of this file.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ai_tools_embedding_idx -- the IVFFlat vector index. 28 MB, 0 scans.
--
-- Superseded by idx_ai_tools_embedding_hnsw (16 MB, 2168 scans), which indexes
-- the same column for the same operator class and is what the planner actually
-- picks. Two vector indexes on one column, and only one earns its keep.
--
-- Dropping it reclaims 28 MB AND speeds up writes. §2 and §7 both record that
-- bulk writes to this table are superlinear because "every row maintains all
-- indexes on the table, IVFFlat included" -- writing 300 embeddings pushed an
-- unrelated query from 2828ms to a timeout. IVFFlat maintenance was a
-- measurable share of that, paid on every upsert by the daily ingest cron, for
-- an index nothing reads.
--
-- Verify before running (expect ivfflat and hnsw over the same column):
--     SELECT indexname, indexdef FROM pg_indexes
--      WHERE tablename = 'ai_tools'
--        AND indexname IN ('ai_tools_embedding_idx', 'idx_ai_tools_embedding_hnsw');
--
-- Rollback (slow -- rebuilding IVFFlat over 263k rows is write-heavy):
--     CREATE INDEX ai_tools_embedding_idx ON ai_tools
--       USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- ----------------------------------------------------------------------------

DROP INDEX IF EXISTS ai_tools_embedding_idx;

ANALYZE ai_tools;

-- ============================================================================
-- STILL TO DECIDE -- do not uncomment without running the checks first.
--
-- Together these are ~115 MB, which is the difference between being over the
-- 500 MB quota and under it. Each needs one fact confirmed first.
--
-- Run this, and match each index to its case below:
--
--     SELECT s.indexrelname,
--            pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
--            s.idx_scan,
--            i.indexdef
--       FROM pg_stat_user_indexes s
--       JOIN pg_indexes i ON i.indexname = s.indexrelname
--                        AND i.tablename = s.relname
--      WHERE s.relname = 'ai_tools'
--        AND s.indexrelname IN ('idx_ai_tools_platform_trgm',
--                               'idx_ai_tools_name_search',
--                               'idx_ai_tools_tags_gin',
--                               'idx_ai_tools_tags',
--                               'ai_tools_fts_idx',
--                               'idx_ai_tools_fts_gin')
--      ORDER BY pg_relation_size(s.indexrelid) DESC;
--
-- And confirm the zero counts are real rather than a recent stats reset:
--
--     SELECT stats_reset FROM pg_stat_database WHERE datname = current_database();
--
-- ----------------------------------------------------------------------------
-- 1. idx_ai_tools_platform_trgm -- 46 MB, 1 scan. Largest index on the table.
--
--    fix_advanced_search_bounded_retrieval.sql created it for platform
--    matching inside search_tools_advanced. If that were live, its scan count
--    would track the FTS index (2177) rather than sitting at 1.
--
--    CHECK: does the function actually use a trigram/ILIKE match on platform?
--        SELECT prosrc FROM pg_proc WHERE proname = 'search_tools_advanced';
--    If platform is matched with = or @@ rather than ILIKE/%, this index is
--    doing nothing and is the single biggest win available.
--
-- DROP INDEX IF EXISTS idx_ai_tools_platform_trgm;
--
-- ----------------------------------------------------------------------------
-- 2. idx_ai_tools_name_search -- 28 MB, 0 scans, in no migration file.
--
--    CHECK: its indexdef. If it is a trigram or FTS index over `name`, it is
--    the same non-viable ILIKE path §2 measured and nothing in the codebase
--    issues it any more. If it is a plain btree on name, confirm nothing
--    resolves a tool by exact name -- lib/seo/catalog.ts uses `slug`, and
--    find_published_slug_by_name() uses idx_ai_tools_name_normalized.
--
-- DROP INDEX IF EXISTS idx_ai_tools_name_search;
--
-- ----------------------------------------------------------------------------
-- 3. idx_ai_tools_tags_gin -- 6.7 MB, 0 scans.
--
--    Near-identical in size to idx_ai_tools_tags (6.7 MB, 599 scans); the pair
--    look like duplicate GIN indexes over `tags`, with the planner using one.
--
--    CHECK: both indexdefs are GIN over tags. Keep idx_ai_tools_tags -- it is
--    the one being used, and it serves the `.overlaps('tags', ...)` probe in
--    getRelatedTools until ai_tools_published_tags_idx exists.
--
-- DROP INDEX IF EXISTS idx_ai_tools_tags_gin;
--
-- ----------------------------------------------------------------------------
-- 4. ai_tools_fts_idx (38 MB, 2177) + idx_ai_tools_fts_gin (34 MB, 3647)
--
--    72 MB of full-text index. BOTH are being scanned, so neither is dead --
--    but if they are duplicate GIN indexes over fts_vector, the planner is
--    just splitting arbitrarily between them and one is pure overhead.
--
--    CHECK: if both indexdefs are `USING gin (fts_vector)`, drop ONE (keep
--    ai_tools_fts_idx -- it is the one add_advanced_search.sql declares and
--    the one the code comments name). If they differ -- e.g. one is over a
--    different column or has a WHERE clause -- keep both.
--
--    This is the only entry here where the index is demonstrably in use, so
--    it is the one to be most careful with. Drop it in a low-traffic window
--    and watch search latency; re-creating a GIN index over 263k rows is slow
--    but not destructive.
--
-- DROP INDEX IF EXISTS idx_ai_tools_fts_gin;
-- ============================================================================


-- ###########################################################################
-- ## STEP 26 of 26 — supabase/bootstrap/04_indexes_not_in_migrations.sql
-- ###########################################################################

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
