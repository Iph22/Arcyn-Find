# AI Tools Fetching System - Complete Implementation

## Overview

A comprehensive system to fetch AI tools from multiple sources and keep your database up to date automatically.

## What's Implemented

### ✅ Phase 1: RSS Feeds
- MIT Technology Review
- ZDNet AI
- Google AI Blog
- DeepMind Blog
- KDnuggets
- MarkTechPost

### ✅ Phase 2: Aggregators
- There's An AI For That
- Futurepedia

### ✅ Phase 3: Web Scrapers
- AITopTools
- AIxploria
- AI Tools Directory

### ✅ Phase 4: Community Sources
- Reddit (r/MachineLearning, r/LocalLLaMA, r/artificial, r/ChatGPT, r/OpenAI)
- HackerNoon

## Features

- **Rate Limiting**: Prevents overwhelming external APIs
- **Error Handling**: Graceful failures - one source failure doesn't break others
- **Smart Deduplication**: Uses Levenshtein distance and URL matching
- **Batch Processing**: Efficient Supabase inserts (50 tools per batch)
- **Retry Logic**: Automatic retries with exponential backoff
- **Comprehensive Logging**: Detailed logs for debugging

## Usage

### Manual Execution

```bash
npm run fetch:all-sources
```

This will:
1. Fetch from all sources (RSS, aggregators, scrapers, community)
2. Deduplicate tools
3. Merge entries (keeping highest popularity)
4. Store in Supabase

### Automatic Execution (Vercel Cron)

The system runs automatically daily at 2 AM UTC via Vercel Cron.

**To enable:**
1. Deploy to Vercel
2. The cron job is configured in `vercel.json`
3. Optionally set `CRON_SECRET` environment variable for authentication

## Configuration

### Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `CRON_SECRET` (optional) - Secret for cron endpoint authentication

### Rate Limiting

Default delays between requests:
- RSS feeds: 2 seconds
- Aggregators: 3 seconds
- Scrapers: 3 seconds
- Community: 2 seconds

Adjust in `scripts/utils/rate-limiter.ts` if needed.

## Adding New Sources

1. **RSS Feed**: Add to `scripts/sources/rss-feeds.ts` in `RSS_SOURCES` array
2. **Aggregator**: Add function to `scripts/sources/aggregators.ts`
3. **Scraper**: Add function to `scripts/sources/scrapers.ts`
4. **Community**: Add function to `scripts/sources/community.ts`
5. **Update orchestrator**: Add to `fetchFromAllSources()` in `scripts/fetch-from-all-sources.ts`

## Troubleshooting

### Some sources return no results
- Check if the site structure has changed
- Verify the site is accessible
- Check rate limiting - may need to increase delays

### Duplicate tools appearing
- Adjust similarity threshold in `scripts/utils/deduplicator.ts`
- Check if tools have different names but same URL

### Timeout errors
- Increase timeout in `safeFetch` functions
- Reduce number of pages/categories scraped
- Check network connectivity

## Performance

- **Expected runtime**: 5-10 minutes for all sources
- **Tools per run**: 100-500+ new tools (depending on sources)
- **Database impact**: Minimal (batch inserts, upserts)

## Notes

- RSS feeds are the most reliable source
- Web scraping may break if site structure changes
- Always respect robots.txt and terms of service
- Some sites may block scrapers - adjust user-agent if needed

