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
