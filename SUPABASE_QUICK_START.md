# Quick Start: Supabase Integration

## ✅ What's Been Done

1. ✅ Installed `@supabase/supabase-js` package
2. ✅ Created database schema (`supabase/schema.sql`)
3. ✅ Created Supabase client configuration (`lib/supabase.ts`)
4. ✅ Created migration script (`scripts/migrate-to-supabase.ts`)
5. ✅ Updated API routes to use Supabase
6. ✅ Updated metadata and sitemap generation

## 🚀 Next Steps (Do This Now!)

### 1. Set Up Database Schema

1. Go to your Supabase project: https://supabase.com/dashboard/project/otrtjqomyukafgnyylij
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase/schema.sql`
5. Paste and click **Run** (or press Cmd/Ctrl + Enter)

### 2. Migrate Your Data

Run this command to move all your AI tools from JSON to Supabase:

```bash
npm run migrate:supabase
```

This will:
- Read all 6,231 tools from `public/ai-data.json`
- Insert them into Supabase in batches
- Show progress as it runs

### 3. Verify It Works

1. Check Supabase dashboard → **Table Editor** → `ai_tools`
2. You should see all your tools there
3. Test the API: Visit `http://localhost:3000/api/ai-models` in your browser

## 📊 Performance Improvements

**Before (JSON file)**:
- Load 4.47 MB on every request
- ~200-500ms response time
- All data in memory

**After (Supabase)**:
- Query only what you need (e.g., 25 tools)
- ~10-50ms response time with indexes
- Server-side pagination
- Scalable to millions of records

## 🔧 API Endpoints

Your API now supports:

```
GET /api/ai-models
GET /api/ai-models?category=Generative AI
GET /api/ai-models?search=gpt&limit=25
GET /api/ai-models?region=USA&accessType=Free
```

## 🎯 What Changed

- **API Route**: Now queries Supabase instead of JSON file
- **Metadata Generation**: Loads from Supabase
- **Sitemap**: Generates from Supabase data
- **Migration Script**: Ready to move your data

## ⚠️ Important Notes

- The Supabase keys are hardcoded in `lib/supabase.ts` for now
- For production, move them to environment variables
- Never commit your service role key to git!

## 🐛 Troubleshooting

**Migration fails?**
- Make sure you ran the SQL schema first
- Check that the `ai_tools` table exists
- Verify your service role key is correct

**API returns empty?**
- Check Row Level Security policies
- Verify data was migrated
- Check browser console for errors

**Build errors?**
- This is normal if database isn't set up yet
- Complete steps 1-2 above first

