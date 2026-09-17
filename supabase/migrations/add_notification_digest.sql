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
