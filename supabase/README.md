# Supabase Database Schema

## Overview

This directory contains the database schema files for Arcyn Find.

## Files

### `schema.sql` (Base Schema)
- **Purpose**: Core AI tools table and indexes
- **Run First**: This must be run before any other schema files
- **Contains**: 
  - `ai_tools` table
  - Indexes for performance
  - Row Level Security policies
  - Timestamp update triggers

### `complete-schema.sql` (Unified Schema - Phase 2 & 3)
- **Purpose**: All Phase 2 and Phase 3 features in one file
- **Run After**: Run after `schema.sql`
- **Idempotent**: Safe to run multiple times (uses `IF NOT EXISTS` and `DROP IF EXISTS`)
- **Contains**:
  - User profiles
  - Reviews & ratings system
  - Pricing history & alerts
  - Collections/playlists
  - User following system
  - Activity feed
  - Leaderboard views
  - All triggers and functions

## Setup Instructions

### Step 1: Run Base Schema
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `schema.sql`
3. Run the SQL

### Step 2: Run Complete Schema
1. In the same SQL Editor
2. Copy contents of `complete-schema.sql`
3. Run the SQL

**Note**: The complete schema is idempotent, so you can run it multiple times safely. It will:
- Create tables if they don't exist
- Drop and recreate policies (to update them)
- Drop and recreate triggers (to update them)
- Drop and recreate views (to update them)

## Updating the Schema

When you need to make changes:

1. **Edit `complete-schema.sql`** directly
2. **Add new tables/functions** using `IF NOT EXISTS` or `CREATE OR REPLACE`
3. **Update policies** using `DROP POLICY IF EXISTS` then `CREATE POLICY`
4. **Update triggers** using `DROP TRIGGER IF EXISTS` then `CREATE TRIGGER`
5. **Run the updated file** in Supabase SQL Editor

The file is designed to be continuously updated - just modify it and re-run it.

## Schema Structure

### Phase 2 Features
- `user_profiles` - User profile information
- `tool_reviews` - Reviews and ratings
- `review_helpful_votes` - Helpfulness votes
- `pricing_history` - Historical pricing data
- `price_alerts` - User price alerts
- `collections` - User collections/playlists
- `collection_items` - Tools in collections

### Phase 3 Features
- `user_follows` - User following relationships
- `user_activities` - Activity feed entries
- `user_stats` (view) - Aggregated user statistics

## Migration Notes

- All tables use `IF NOT EXISTS` for safe creation
- All policies use `DROP POLICY IF EXISTS` before creation
- All triggers use `DROP TRIGGER IF EXISTS` before creation
- All views use `DROP VIEW IF EXISTS CASCADE` before creation
- All functions use `CREATE OR REPLACE` for updates

This ensures the schema can be updated incrementally without breaking existing data.

## Troubleshooting

### "Relation already exists" errors
- The schema uses `IF NOT EXISTS` - this shouldn't happen
- If it does, the table might have been created manually
- Drop the table manually and re-run the schema

### Policy conflicts
- Policies are dropped before creation
- If you see conflicts, check for manually created policies
- Drop them manually: `DROP POLICY "policy_name" ON table_name;`

### Trigger conflicts
- Triggers are dropped before creation
- If conflicts occur, drop manually: `DROP TRIGGER trigger_name ON table_name;`

## Best Practices

1. **Always backup** before running schema changes
2. **Test in development** first
3. **Review changes** before running in production
4. **Document changes** in commit messages
5. **Keep schema.sql separate** from complete-schema.sql for clarity

