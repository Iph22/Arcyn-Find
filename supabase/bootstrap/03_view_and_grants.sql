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
