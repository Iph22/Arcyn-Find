-- ============================================================================
-- 05 — Row Level Security, and taking the anon key's write access away
--
-- Run LAST, after 04 and after the data load.
--
-- WHAT THIS FIXES
--
-- Measured on the new project 2026-09-28, immediately after the bootstrap:
--
--     RLS enabled on            2 of 19 tables
--     anon / authenticated held DELETE, INSERT, SELECT, TRUNCATE, UPDATE
--                               on ALL 19 tables
--
-- The anon key ships in the public client bundle and this repository is
-- public, so that combination meant anyone could read every user's email or
-- issue `TRUNCATE ai_tools` against production. Those grants are not something
-- 03 created -- Supabase's default privileges grant everything on new public
-- tables to anon and authenticated, on the assumption that RLS is the gate.
-- Creating tables from the SQL editor leaves RLS off, so the gate was open.
--
-- WHY IT WAS SAFE TO REVOKE
--
-- The app never needed those grants from the browser. Verified before
-- changing anything: NO "use client" component touches `supabase.` at all,
-- and the one that imports lib/collections.ts takes a type, which is erased at
-- compile time.
--
-- What did need them was SERVER code holding the anon client --
-- lib/google-auth.ts (imported by 21 API routes) upserted and deleted
-- user_profiles with it, and collections/community/reviews did the same. Those
-- four modules now use getSupabaseAdmin(), so the service role does the work
-- it was always doing everywhere else. That change and this file go together:
-- apply this without it and sign-in breaks.
--
-- WHY RLS *AND* REVOKE, RATHER THAN EITHER
--
-- RLS does not restrict TRUNCATE. A role holding the TRUNCATE privilege can
-- empty a table whatever the policies say, so revoking is the only thing that
-- stops it. Conversely the revoke alone would be undone by anyone re-granting,
-- and RLS is the posture Supabase's own tooling expects. Both.
--
-- Deliberately NO policies. service_role bypasses RLS entirely, and every
-- database path in this app is a server route using it. A table with RLS on
-- and no policy is closed to anon and authenticated, which is exactly right
-- here. If a client component ever needs direct table access, add a narrow
-- policy for that table then -- do not re-grant wholesale.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Take the privileges away.
--
-- Existing objects first, then the defaults, so a table created later does not
-- quietly arrive world-writable again. The default privileges are owned by the
-- role that creates objects, which on Supabase is `postgres`.
-- ----------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- The service role must keep everything: it is what every API route uses.
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Turn RLS on everywhere.
--
-- Driven off the catalog rather than a hand-written list, so a table added
-- later is covered by re-running this file instead of by someone remembering.
-- Views are skipped -- RLS is not a thing views have; user_stats is protected
-- by the revoke above and by the RLS on the tables it reads.
-- ----------------------------------------------------------------------------

DO $rls$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    END LOOP;
END
$rls$;

-- ----------------------------------------------------------------------------
-- 3. Check it took.
--
-- Both numbers should be zero. If the first is not, something re-granted; if
-- the second is not, a table was created after the loop above ran.
-- ----------------------------------------------------------------------------

DO $verify$
DECLARE
    leaked  integer;
    open_t  integer;
BEGIN
    SELECT count(*) INTO leaked
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated');

    SELECT count(*) INTO open_t
      FROM pg_tables
     WHERE schemaname = 'public' AND NOT rowsecurity;

    RAISE NOTICE 'anon/authenticated grants remaining: %', leaked;
    RAISE NOTICE 'tables without RLS: %', open_t;

    IF leaked > 0 OR open_t > 0 THEN
        RAISE EXCEPTION 'lockdown incomplete: % grants, % tables without RLS', leaked, open_t;
    END IF;
END
$verify$;
