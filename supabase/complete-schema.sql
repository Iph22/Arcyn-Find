-- Complete Database Schema for Arcyn Find
-- This file includes all Phase 2 and Phase 3 features
-- Safe to run multiple times (idempotent)
-- Run this after the base schema.sql

-- ============================================
-- USER PROFILES (extends Supabase Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Create policies
CREATE POLICY "Public read access" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- REVIEWS & RATINGS
-- ============================================
CREATE TABLE IF NOT EXISTS tool_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT NOT NULL REFERENCES ai_tools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  review_text TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tool_id, user_id) -- One review per user per tool
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tool_reviews_tool_id ON tool_reviews(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_reviews_user_id ON tool_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_reviews_rating ON tool_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_tool_reviews_created_at ON tool_reviews(created_at DESC);

-- Enable RLS
ALTER TABLE tool_reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public read access" ON tool_reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON tool_reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON tool_reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON tool_reviews;

-- Create policies
CREATE POLICY "Public read access" ON tool_reviews
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert reviews" ON tool_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews" ON tool_reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews" ON tool_reviews
  FOR DELETE USING (auth.uid() = user_id);

-- Review helpfulness votes
CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES tool_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, user_id) -- One vote per user per review
);

CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_review_id ON review_helpful_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_user_id ON review_helpful_votes(user_id);

ALTER TABLE review_helpful_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON review_helpful_votes;
DROP POLICY IF EXISTS "Authenticated users can vote" ON review_helpful_votes;

CREATE POLICY "Public read access" ON review_helpful_votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote" ON review_helpful_votes
  FOR ALL USING (auth.uid() = user_id);

-- Function to update helpful_count
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tool_reviews
  SET helpful_count = (
    SELECT COUNT(*) FROM review_helpful_votes
    WHERE review_id = NEW.review_id AND is_helpful = true
  )
  WHERE id = NEW.review_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_helpful_count_trigger ON review_helpful_votes;
CREATE TRIGGER update_helpful_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON review_helpful_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_review_helpful_count();

-- ============================================
-- PRICING HISTORY & TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT NOT NULL REFERENCES ai_tools(id) ON DELETE CASCADE,
  pricing_text TEXT,
  pricing_tier TEXT, -- e.g., "Free", "Pro", "Enterprise"
  price_amount DECIMAL(10, 2), -- Numeric price if available
  currency TEXT DEFAULT 'USD',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source TEXT -- e.g., "manual", "scraper", "api"
);

CREATE INDEX IF NOT EXISTS idx_pricing_history_tool_id ON pricing_history(tool_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_recorded_at ON pricing_history(recorded_at DESC);

ALTER TABLE pricing_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON pricing_history;
CREATE POLICY "Public read access" ON pricing_history
  FOR SELECT USING (true);

-- Price alerts (users can set alerts for price changes)
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT NOT NULL REFERENCES ai_tools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'price_increase', 'any_change')),
  threshold_price DECIMAL(10, 2), -- Optional threshold
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tool_id, user_id) -- One alert per user per tool
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_tool_id ON price_alerts(tool_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);

ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own alerts" ON price_alerts;
CREATE POLICY "Users can manage own alerts" ON price_alerts
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- COLLECTIONS/PLAYLISTS
-- ============================================
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_is_public ON collections(is_public) WHERE is_public = true;

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public collections are readable" ON collections;
DROP POLICY IF EXISTS "Users can manage own collections" ON collections;

CREATE POLICY "Public collections are readable" ON collections
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can manage own collections" ON collections
  FOR ALL USING (auth.uid() = user_id);

-- Collection items (tools in collections)
CREATE TABLE IF NOT EXISTS collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL REFERENCES ai_tools(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT, -- Optional notes about why this tool is in the collection
  UNIQUE(collection_id, tool_id) -- One tool per collection
);

CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_tool_id ON collection_items(tool_id);

ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Collection items follow collection visibility" ON collection_items;
DROP POLICY IF EXISTS "Users can manage items in own collections" ON collection_items;

CREATE POLICY "Collection items follow collection visibility" ON collection_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
      AND (collections.is_public = true OR collections.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage items in own collections" ON collection_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
      AND collections.user_id = auth.uid()
    )
  );

-- ============================================
-- USER FOLLOWING (Phase 3)
-- ============================================
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id) -- Can't follow yourself
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view follows" ON user_follows;
DROP POLICY IF EXISTS "Users can manage own follows" ON user_follows;

CREATE POLICY "Users can view follows" ON user_follows
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own follows" ON user_follows
  FOR ALL USING (auth.uid() = follower_id);

-- ============================================
-- ACTIVITY FEED (Phase 3)
-- ============================================
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'review_created',
    'collection_created',
    'tool_favorited',
    'tool_added_to_collection',
    'review_helpful_voted'
  )),
  tool_id TEXT REFERENCES ai_tools(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  review_id UUID REFERENCES tool_reviews(id) ON DELETE CASCADE,
  metadata JSONB, -- Additional activity data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON user_activities(activity_type);

ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant activities" ON user_activities;
DROP POLICY IF EXISTS "System can insert activities" ON user_activities;

-- Users can see activities from users they follow or their own
CREATE POLICY "Users can view relevant activities" ON user_activities
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_follows
      WHERE user_follows.follower_id = auth.uid()
      AND user_follows.following_id = user_activities.user_id
    )
  );

-- Only system can insert activities (via triggers)
CREATE POLICY "System can insert activities" ON user_activities
  FOR INSERT WITH CHECK (true);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for tool_reviews
DROP TRIGGER IF EXISTS update_tool_reviews_updated_at ON tool_reviews;
CREATE TRIGGER update_tool_reviews_updated_at
    BEFORE UPDATE ON tool_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for collections
DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at
    BEFORE UPDATE ON collections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate average rating for a tool
CREATE OR REPLACE FUNCTION get_tool_avg_rating(tool_id_param TEXT)
RETURNS TABLE (
  avg_rating NUMERIC,
  total_reviews BIGINT,
  rating_distribution JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(AVG(rating)::NUMERIC, 2) as avg_rating,
    COUNT(*)::BIGINT as total_reviews,
    jsonb_object_agg(
      rating::TEXT,
      count::TEXT
    ) as rating_distribution
  FROM (
    SELECT rating, COUNT(*) as count
    FROM tool_reviews
    WHERE tool_id = tool_id_param
    GROUP BY rating
  ) rating_counts
  CROSS JOIN (
    SELECT AVG(rating) as avg_rating, COUNT(*) as total
    FROM tool_reviews
    WHERE tool_id = tool_id_param
  ) stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ACTIVITY FEED TRIGGERS (Phase 3)
-- ============================================

-- Trigger: Create activity when review is created
CREATE OR REPLACE FUNCTION create_review_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_activities (user_id, activity_type, tool_id, review_id)
  VALUES (NEW.user_id, 'review_created', NEW.tool_id, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_review_activity ON tool_reviews;
CREATE TRIGGER trigger_review_activity
  AFTER INSERT ON tool_reviews
  FOR EACH ROW
  EXECUTE FUNCTION create_review_activity();

-- Trigger: Create activity when collection is created
CREATE OR REPLACE FUNCTION create_collection_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_activities (user_id, activity_type, collection_id)
  VALUES (NEW.user_id, 'collection_created', NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_collection_activity ON collections;
CREATE TRIGGER trigger_collection_activity
  AFTER INSERT ON collections
  FOR EACH ROW
  EXECUTE FUNCTION create_collection_activity();

-- Trigger: Create activity when tool is added to collection
CREATE OR REPLACE FUNCTION create_collection_item_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_activities (user_id, activity_type, tool_id, collection_id)
  SELECT user_id, 'tool_added_to_collection', NEW.tool_id, NEW.collection_id
  FROM collections
  WHERE id = NEW.collection_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_collection_item_activity ON collection_items;
CREATE TRIGGER trigger_collection_item_activity
  AFTER INSERT ON collection_items
  FOR EACH ROW
  EXECUTE FUNCTION create_collection_item_activity();

-- ============================================
-- LEADERBOARDS / STATS (Phase 3)
-- ============================================

-- View: User stats for leaderboards
CREATE OR REPLACE VIEW user_stats AS
SELECT
  u.id,
  up.username,
  up.display_name,
  up.avatar_url,
  COUNT(DISTINCT tr.id) as total_reviews,
  COUNT(DISTINCT c.id) as total_collections,
  COUNT(DISTINCT uf_following.follower_id) as followers_count,
  COUNT(DISTINCT uf_follower.following_id) as following_count,
  COALESCE(SUM(tr.helpful_count), 0) as total_helpful_votes,
  MAX(tr.created_at) as last_review_date
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
LEFT JOIN tool_reviews tr ON u.id = tr.user_id
LEFT JOIN collections c ON u.id = c.user_id
LEFT JOIN user_follows uf_following ON u.id = uf_following.following_id
LEFT JOIN user_follows uf_follower ON u.id = uf_follower.follower_id
GROUP BY u.id, up.username, up.display_name, up.avatar_url;

-- View: User stats for leaderboards
DROP VIEW IF EXISTS user_stats CASCADE;
CREATE VIEW user_stats AS
SELECT
  u.id,
  up.username,
  up.display_name,
  up.avatar_url,
  COUNT(DISTINCT tr.id) as total_reviews,
  COUNT(DISTINCT c.id) as total_collections,
  COUNT(DISTINCT uf_following.follower_id) as followers_count,
  COUNT(DISTINCT uf_follower.following_id) as following_count,
  COALESCE(SUM(tr.helpful_count), 0) as total_helpful_votes,
  MAX(tr.created_at) as last_review_date
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
LEFT JOIN tool_reviews tr ON u.id = tr.user_id
LEFT JOIN collections c ON u.id = c.user_id
LEFT JOIN user_follows uf_following ON u.id = uf_following.following_id
LEFT JOIN user_follows uf_follower ON u.id = uf_follower.follower_id
GROUP BY u.id, up.username, up.display_name, up.avatar_url;

-- Grant access to view
GRANT SELECT ON user_stats TO anon, authenticated;

