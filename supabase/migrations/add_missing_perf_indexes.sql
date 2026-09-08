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

-- Refresh planner stats for both tables now that new indexes exist on them —
-- see fix_advanced_search_bounded_retrieval.sql for why this isn't optional.
ANALYZE tool_reviews;
ANALYZE user_follows;
