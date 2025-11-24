# Supabase Migrations for Clerk Integration

## Migration 002: Clerk-Compatible User IDs

This migration updates the database schema to support Clerk authentication by changing user ID columns from `UUID` to `TEXT`.

### What it does:
1. Changes `user_profiles.id` from UUID to TEXT (to support Clerk's string IDs like "user_xxxxx")
2. Updates all foreign key references to use TEXT
3. Removes references to `auth.users` (since Clerk handles auth)
4. Updates RLS policies to work with Clerk (auth handled in API layer)

### How to apply:

**Option 1: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `002_clerk_compatible_ids.sql`
4. Run the migration

**Option 2: Using Supabase CLI**
```bash
# If you have Supabase CLI installed
supabase db reset
# Or apply the specific migration
psql $DATABASE_URL < supabase/migrations/002_clerk_compatible_ids.sql
```

### Important Notes:
- This migration will **drop and recreate foreign key constraints**
- Existing data will be preserved but user IDs must be valid
- If you have existing UUID-based user data, you'll need to migrate it to Clerk user IDs
- RLS policies are now permissive since Clerk handles authorization in the API layer

### After applying:
1. Restart your Next.js development server
2. Test onboarding flow
3. Verify user profile creation works
