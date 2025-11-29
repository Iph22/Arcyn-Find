-- ============================================
-- COMPLETE CLERK COMPATIBILITY MIGRATION
-- ============================================
-- This migration converts the database schema from UUID-based user IDs to TEXT-based
-- Clerk-compatible user IDs and updates all RLS policies to work with Clerk authentication.
--
-- IMPORTANT: This migration is configured for Clerk authentication
-- - All user IDs are TEXT (Clerk-compatible, e.g., "user_xxxxx")
-- - RLS policies are permissive (auth handled in API layer with service role key)
-- - No auth.uid() references (Clerk doesn't integrate with Supabase Auth)
-- - Safe to run multiple times (idempotent)
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Drop dependent views
-- ============================================
DROP VIEW IF EXISTS user_stats CASCADE;

-- ============================================
-- STEP 2: Drop all RLS policies that depend on user_id columns
-- This must be done before changing column types
-- ============================================

-- tool_reviews policies
DROP POLICY IF EXISTS "Public read access" ON tool_reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON tool_reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON tool_reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON tool_reviews;
DROP POLICY IF EXISTS "Allow all read" ON tool_reviews;
DROP POLICY IF EXISTS "Allow all inserts" ON tool_reviews;
DROP POLICY IF EXISTS "Allow all updates" ON tool_reviews;
DROP POLICY IF EXISTS "Allow all deletes" ON tool_reviews;

-- review_helpful_votes policies
DROP POLICY IF EXISTS "Public read access" ON review_helpful_votes;
DROP POLICY IF EXISTS "Authenticated users can vote" ON review_helpful_votes;
DROP POLICY IF EXISTS "Allow all access" ON review_helpful_votes;

-- price_alerts policies
DROP POLICY IF EXISTS "Users can manage own alerts" ON price_alerts;
DROP POLICY IF EXISTS "Allow all access" ON price_alerts;

-- collections policies
DROP POLICY IF EXISTS "Public collections are readable" ON collections;
DROP POLICY IF EXISTS "Users can manage own collections" ON collections;
DROP POLICY IF EXISTS "Allow all read" ON collections;
DROP POLICY IF EXISTS "Allow all manage" ON collections;

-- collection_items policies
DROP POLICY IF EXISTS "Collection items are readable if collection is readable" ON collection_items;
DROP POLICY IF EXISTS "Collection items follow collection visibility" ON collection_items;
DROP POLICY IF EXISTS "Users can manage items in own collections" ON collection_items;
DROP POLICY IF EXISTS "Allow all access" ON collection_items;

-- user_favorites policies
DROP POLICY IF EXISTS "Users can manage own favorites" ON user_favorites;
DROP POLICY IF EXISTS "Public read access" ON user_favorites;
DROP POLICY IF EXISTS "Allow all access" ON user_favorites;

-- user_follows policies
DROP POLICY IF EXISTS "Public read access" ON user_follows;
DROP POLICY IF EXISTS "Users can view follows" ON user_follows;
DROP POLICY IF EXISTS "Users can manage own follows" ON user_follows;
DROP POLICY IF EXISTS "Allow all manage" ON user_follows;

-- user_activities policies
DROP POLICY IF EXISTS "Users can view relevant activities" ON user_activities;
DROP POLICY IF EXISTS "System can insert activities" ON user_activities;
DROP POLICY IF EXISTS "Allow all read" ON user_activities;

-- user_profiles policies
DROP POLICY IF EXISTS "Public read access" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow all read access" ON user_profiles;
DROP POLICY IF EXISTS "Allow all inserts" ON user_profiles;
DROP POLICY IF EXISTS "Allow all updates" ON user_profiles;

-- ============================================
-- STEP 3: Drop CHECK and UNIQUE constraints that involve user_id columns
-- ============================================

-- CHECK constraints
ALTER TABLE IF EXISTS user_follows DROP CONSTRAINT IF EXISTS user_follows_check;
ALTER TABLE IF EXISTS user_follows DROP CONSTRAINT IF EXISTS user_follows_follower_id_following_id_check;

-- UNIQUE constraints (to avoid potential issues during type conversion)
ALTER TABLE IF EXISTS tool_reviews DROP CONSTRAINT IF EXISTS tool_reviews_tool_id_user_id_key;
ALTER TABLE IF EXISTS review_helpful_votes DROP CONSTRAINT IF EXISTS review_helpful_votes_review_id_user_id_key;
ALTER TABLE IF EXISTS price_alerts DROP CONSTRAINT IF EXISTS price_alerts_tool_id_user_id_key;
ALTER TABLE IF EXISTS user_favorites DROP CONSTRAINT IF EXISTS user_favorites_user_id_tool_id_key;
ALTER TABLE IF EXISTS user_follows DROP CONSTRAINT IF EXISTS user_follows_follower_id_following_id_key;

-- ============================================
-- STEP 4: Drop existing foreign key constraints that reference user_profiles
-- ============================================

ALTER TABLE IF EXISTS tool_reviews DROP CONSTRAINT IF EXISTS tool_reviews_user_id_fkey;
ALTER TABLE IF EXISTS collections DROP CONSTRAINT IF EXISTS collections_user_id_fkey;
ALTER TABLE IF EXISTS user_follows DROP CONSTRAINT IF EXISTS user_follows_follower_id_fkey;
ALTER TABLE IF EXISTS user_follows DROP CONSTRAINT IF EXISTS user_follows_following_id_fkey;
ALTER TABLE IF EXISTS favorites DROP CONSTRAINT IF EXISTS favorites_user_id_fkey;
ALTER TABLE IF EXISTS user_favorites DROP CONSTRAINT IF EXISTS user_favorites_user_id_fkey;
ALTER TABLE IF EXISTS user_activities DROP CONSTRAINT IF EXISTS user_activities_user_id_fkey;
ALTER TABLE IF EXISTS review_helpful_votes DROP CONSTRAINT IF EXISTS review_helpful_votes_user_id_fkey;
ALTER TABLE IF EXISTS price_alerts DROP CONSTRAINT IF EXISTS price_alerts_user_id_fkey;

-- Drop the foreign key reference to auth.users (if it exists)
ALTER TABLE IF EXISTS user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- ============================================
-- STEP 5: Change user_profiles.id from UUID to TEXT (if needed)
-- ============================================
DO $$ 
BEGIN
  -- Only alter if column is not already TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'id' 
    AND data_type != 'text'
  ) THEN
    ALTER TABLE user_profiles ALTER COLUMN id TYPE TEXT;
  END IF;
END $$;

-- ============================================
-- STEP 6: Change all referencing columns to TEXT (if needed)
-- ============================================

-- tool_reviews
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tool_reviews' AND column_name = 'user_id' AND data_type != 'text'
  ) THEN
    ALTER TABLE tool_reviews ALTER COLUMN user_id TYPE TEXT;
  END IF;
END $$;

-- collections
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'collections' AND column_name = 'user_id' AND data_type != 'text'
  ) THEN
    ALTER TABLE collections ALTER COLUMN user_id TYPE TEXT;
  END IF;
END $$;

-- user_follows
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_follows' AND column_name = 'follower_id' AND data_type != 'text'
  ) THEN
    ALTER TABLE user_follows ALTER COLUMN follower_id TYPE TEXT;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_follows' AND column_name = 'following_id' AND data_type != 'text'
  ) THEN
    ALTER TABLE user_follows ALTER COLUMN following_id TYPE TEXT;
  END IF;
END $$;

-- user_favorites
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_favorites' AND column_name = 'user_id' AND data_type != 'text'
  ) THEN
    ALTER TABLE user_favorites ALTER COLUMN user_id TYPE TEXT;
  END IF;
END $$;

-- user_activities
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_activities' AND column_name = 'user_id' AND data_type != 'text'
  ) THEN
    ALTER TABLE user_activities ALTER COLUMN user_id TYPE TEXT;
  END IF;
END $$;

-- review_helpful_votes
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'review_helpful_votes' AND column_name = 'user_id' AND data_type != 'text'
  ) THEN
    ALTER TABLE review_helpful_votes ALTER COLUMN user_id TYPE TEXT;
  END IF;
END $$;

-- price_alerts
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_alerts' AND column_name = 'user_id' AND data_type != 'text'
  ) THEN
    ALTER TABLE price_alerts ALTER COLUMN user_id TYPE TEXT;
  END IF;
END $$;

-- favorites (if table exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'favorites'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'user_id' AND data_type != 'text'
  ) THEN
    ALTER TABLE favorites ALTER COLUMN user_id TYPE TEXT;
  END IF;
END $$;

-- ============================================
-- STEP 7: Recreate foreign key constraints
-- Since we're using Clerk, we don't need to reference auth.users anymore
-- ============================================

-- tool_reviews
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tool_reviews_user_id_fkey'
  ) THEN
    ALTER TABLE tool_reviews 
      ADD CONSTRAINT tool_reviews_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- collections
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'collections_user_id_fkey'
  ) THEN
    ALTER TABLE collections 
      ADD CONSTRAINT collections_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- user_follows
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_follows_follower_id_fkey'
  ) THEN
    ALTER TABLE user_follows 
      ADD CONSTRAINT user_follows_follower_id_fkey 
      FOREIGN KEY (follower_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_follows_following_id_fkey'
  ) THEN
    ALTER TABLE user_follows 
      ADD CONSTRAINT user_follows_following_id_fkey 
      FOREIGN KEY (following_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- user_favorites
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_favorites_user_id_fkey'
  ) THEN
    ALTER TABLE user_favorites 
      ADD CONSTRAINT user_favorites_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- user_activities
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_activities_user_id_fkey'
  ) THEN
    ALTER TABLE user_activities 
      ADD CONSTRAINT user_activities_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- review_helpful_votes
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'review_helpful_votes_user_id_fkey'
  ) THEN
    ALTER TABLE review_helpful_votes 
      ADD CONSTRAINT review_helpful_votes_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- price_alerts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'price_alerts_user_id_fkey'
  ) THEN
    ALTER TABLE price_alerts 
      ADD CONSTRAINT price_alerts_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- favorites (if table exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'favorites'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'favorites_user_id_fkey'
  ) THEN
    ALTER TABLE favorites 
      ADD CONSTRAINT favorites_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- STEP 8: Recreate CHECK and UNIQUE constraints
-- ============================================

-- Prevent users from following themselves
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_follows_follower_id_following_id_check'
  ) THEN
    ALTER TABLE user_follows 
      ADD CONSTRAINT user_follows_follower_id_following_id_check 
      CHECK (follower_id != following_id);
  END IF;
END $$;

-- Recreate UNIQUE constraints
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tool_reviews_tool_id_user_id_key'
  ) THEN
    ALTER TABLE tool_reviews 
      ADD CONSTRAINT tool_reviews_tool_id_user_id_key 
      UNIQUE (tool_id, user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'review_helpful_votes_review_id_user_id_key'
  ) THEN
    ALTER TABLE review_helpful_votes 
      ADD CONSTRAINT review_helpful_votes_review_id_user_id_key 
      UNIQUE (review_id, user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'price_alerts_tool_id_user_id_key'
  ) THEN
    ALTER TABLE price_alerts 
      ADD CONSTRAINT price_alerts_tool_id_user_id_key 
      UNIQUE (tool_id, user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_favorites_user_id_tool_id_key'
  ) THEN
    ALTER TABLE user_favorites 
      ADD CONSTRAINT user_favorites_user_id_tool_id_key 
      UNIQUE (user_id, tool_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_follows_follower_id_following_id_key'
  ) THEN
    ALTER TABLE user_follows 
      ADD CONSTRAINT user_follows_follower_id_following_id_key 
      UNIQUE (follower_id, following_id);
  END IF;
END $$;

-- ============================================
-- STEP 9: Create new RLS policies for Clerk
-- All policies are permissive since auth is handled in API layer
-- ============================================

-- user_profiles
CREATE POLICY "Allow all read access" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Allow all inserts" ON user_profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all updates" ON user_profiles
  FOR UPDATE USING (true);

-- tool_reviews
CREATE POLICY "Allow all read" ON tool_reviews FOR SELECT USING (true);
CREATE POLICY "Allow all inserts" ON tool_reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates" ON tool_reviews FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON tool_reviews FOR DELETE USING (true);

-- review_helpful_votes
CREATE POLICY "Allow all access" ON review_helpful_votes FOR ALL USING (true);

-- price_alerts
CREATE POLICY "Allow all access" ON price_alerts FOR ALL USING (true);

-- collections
CREATE POLICY "Allow all read" ON collections FOR SELECT USING (true);
CREATE POLICY "Allow all manage" ON collections FOR ALL USING (true);

-- collection_items
CREATE POLICY "Allow all access" ON collection_items FOR ALL USING (true);

-- user_favorites
CREATE POLICY "Allow all access" ON user_favorites FOR ALL USING (true);

-- user_follows
CREATE POLICY "Users can view follows" ON user_follows FOR SELECT USING (true);
CREATE POLICY "Allow all manage" ON user_follows FOR ALL USING (true);

-- user_activities
CREATE POLICY "Allow all read" ON user_activities FOR SELECT USING (true);
CREATE POLICY "System can insert activities" ON user_activities FOR INSERT WITH CHECK (true);

-- ============================================
-- STEP 10: Recreate user_stats view (updated for Clerk)
-- ============================================
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

-- Grant access to view
GRANT SELECT ON user_stats TO anon, authenticated;

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Note: With Clerk, we handle auth in the API layer using middleware
-- RLS policies are permissive since Supabase Auth is no longer the source of truth
-- All user IDs are now TEXT-compatible with Clerk's string-based IDs
-- ============================================

