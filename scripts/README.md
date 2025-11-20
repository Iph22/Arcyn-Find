# AI Tools Data Fetching System

This directory contains scripts to fetch AI tools from multiple sources and keep the database up to date.

## Architecture

```
scripts/
├── sources/           # Data source fetchers
│   ├── rss-feeds.ts      # Phase 1: RSS feeds (MIT, ZDNet, Google AI, etc.)
│   ├── aggregators.ts    # Phase 2: Aggregator sites (Futurepedia, etc.)
│   ├── scrapers.ts       # Phase 3: Web scrapers (AITopTools, AIxploria, etc.)
│   └── community.ts      # Phase 4: Community sources (Reddit, HackerNoon)
├── utils/             # Utility functions
│   ├── rate-limiter.ts   # Rate limiting to prevent overwhelming APIs
│   ├── deduplicator.ts   # Deduplication logic
│   └── transformer.ts    # Data transformation utilities
└── fetch-from-all-sources.ts  # Main orchestrator
```

## Usage

### Manual Execution

Run the main script to fetch from all sources:

```bash
npm run fetch:all-sources
```

### Automatic Execution (Vercel Cron)

The system is configured to run automatically via Vercel Cron:

- **Schedule**: Daily at 2 AM UTC
- **Endpoint**: `/api/cron/fetch-tools`
- **Configuration**: `vercel.json`

To enable cron authentication, set `CRON_SECRET` in your environment variables.

## Data Sources

### Phase 1: RSS Feeds
- MIT Technology Review
- ZDNet AI
- Google AI Blog
- DeepMind Blog
- KDnuggets
- MarkTechPost

### Phase 2: Aggregators
- There's An AI For That
- Futurepedia

### Phase 3: Web Scrapers
- AITopTools
- AIxploria
- AI Tools Directory

### Phase 4: Community Sources
- Reddit (r/MachineLearning, r/LocalLLaMA, etc.)
- HackerNoon

## Features

- **Rate Limiting**: Prevents overwhelming external APIs
- **Error Handling**: Graceful failures - one source failure doesn't break others
- **Deduplication**: Smart matching to avoid duplicate tools
- **Batch Processing**: Efficient Supabase inserts
- **Retry Logic**: Automatic retries for failed requests
- **Comprehensive Logging**: Detailed logs for debugging

## Adding New Sources

1. Create a new function in the appropriate source file
2. Follow the existing pattern for fetching and transforming data
3. Add the function to the main orchestrator
4. Test with `npm run fetch:all-sources`

## Notes

- Some sources may have anti-scraping measures - adjust delays as needed
- RSS feeds are the most reliable source
- Web scraping may break if site structure changes
- Always respect robots.txt and terms of service

