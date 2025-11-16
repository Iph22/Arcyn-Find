# Supabase Setup Guide

This guide will help you set up Supabase for your AI tools database.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Create a new project
3. Note your project URL and API keys

## Step 2: Run Database Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/schema.sql`
4. Click **Run** to execute the SQL

This will create:
- `ai_tools` table with all necessary columns
- Indexes for fast queries
- Row Level Security policies
- Automatic timestamp updates

## Step 3: Migrate Data

Run the migration script to move your JSON data to Supabase:

```bash
npm run migrate:supabase
```

This will:
- Read data from `public/ai-data.json`
- Transform it to match the database schema
- Insert/update all tools in Supabase (in batches of 1000)

## Step 4: Environment Variables

The Supabase keys are already configured in `lib/supabase.ts`, but for production, you should use environment variables:

Create or update `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://otrtjqomyukafgnyylij.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important**: Never commit your service role key to git! It has admin access.

## Step 5: Verify Setup

1. Check your Supabase dashboard → Table Editor → `ai_tools`
2. You should see all your AI tools there
3. Test the API: `http://localhost:3000/api/ai-models`

## Performance Benefits

✅ **Before**: Loading 4.47 MB JSON file on every request  
✅ **After**: Query only needed data (e.g., 25 tools) with indexes

- Query time: ~10-50ms vs ~200-500ms
- Bundle size: No data in client bundle
- Scalability: Can handle millions of tools
- Real-time: Update data without redeploying

## API Usage

The API now supports query parameters:

```
GET /api/ai-models?category=Generative AI&limit=25&offset=0&search=gpt
```

Parameters:
- `category` - Filter by category
- `region` - Filter by region
- `accessType` - Filter by access type (Free/Freemium/Paid)
- `search` - Full-text search on name and description
- `limit` - Number of results (default: 1000)
- `offset` - Pagination offset (default: 0)

## Troubleshooting

### Migration fails
- Check that the `ai_tools` table exists
- Verify your service role key is correct
- Check Supabase logs for errors

### API returns empty
- Verify Row Level Security policy allows SELECT
- Check that data was migrated successfully
- Look at browser console and server logs

### Slow queries
- Ensure indexes were created (check in Supabase dashboard)
- Use `limit` parameter to reduce result size
- Check query performance in Supabase dashboard → Database → Query Performance

## Next Steps

- Set up automatic backups in Supabase
- Configure real-time subscriptions for live updates
- Add user authentication for favorites/ratings
- Set up database functions for complex queries

