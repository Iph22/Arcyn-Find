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
