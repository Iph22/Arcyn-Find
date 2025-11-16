# Real-Time Trending Implementation

## Overview

This document describes the comprehensive real-time web scraping system implemented for trending AI tools. The system scrapes data from multiple sources and combines it with local user activity to provide accurate, up-to-date trending information.

## Architecture

### 1. API Route: `/api/trending`

**Location:** `app/api/trending/route.ts`

This server-side API route handles all web scraping operations. It:
- Scrapes from 7+ different sources
- Implements rate limiting and delays
- Handles errors gracefully
- Aggregates and normalizes data
- Returns cached results (5-minute cache)

### 2. Trending Utils: `lib/trending-utils.ts`

**Client-side utilities** that:
- Track local user views/clicks
- Fetch trending data from the API
- Match scraped data to your AI tools
- Calculate combined trending scores
- Maintain category diversity

## Data Sources

### 1. **Product Hunt** (`scrapeProductHunt`)
- Scrapes trending AI tools from Product Hunt
- Extracts product names and vote counts
- Scores based on position and votes

### 2. **Hacker News** (`scrapeHackerNews`)
- Uses Hacker News Firebase API
- Filters for AI-related keywords
- Scores based on story position and upvotes
- Processes in batches to respect rate limits

### 3. **Reddit** (`scrapeReddit`)
- Scrapes multiple AI-related subreddits:
  - r/MachineLearning
  - r/artificial
  - r/ChatGPT
  - r/OpenAI
  - r/LocalLLaMA
  - r/singularity
  - r/agi
- Scores based on post position, upvotes, and comments

### 4. **GitHub Trending** (`scrapeGitHubTrending`)
- Uses GitHub Search API
- Searches for AI-related repositories
- Scores based on stars and position

### 5. **There's An AI For That** (`scrapeTheresAnAIForThat`)
- Uses their public API
- Gets trending AI tools
- Scores based on position and ratings

### 6. **Futurepedia** (`scrapeFuturepedia`)
- Scrapes trending tools from Futurepedia
- Scores based on position and views

### 7. **AI Tools Directory** (`scrapeAIToolsDirectory`)
- Scrapes from aitoolsdirectory.com
- Falls back to HTML scraping if API unavailable
- Scores based on position

## Rate Limiting & Compliance

### Implemented Safeguards:

1. **Request Delays**
   - 1 second delay between requests (`REQUEST_DELAY = 1000ms`)
   - Prevents overwhelming target servers

2. **Retry Logic**
   - Maximum 2 retries per request
   - Exponential backoff on failures

3. **User-Agent Headers**
   - Proper browser user-agent strings
   - Identifies as educational/research tool

4. **Error Handling**
   - Each source wrapped in try-catch
   - Failures don't break entire system
   - Graceful degradation

5. **Caching**
   - 5-minute cache on API responses
   - Reduces load on target servers
   - Faster response times

6. **Respect for APIs**
   - Uses official APIs where available (Hacker News, GitHub)
   - Only scrapes when API unavailable
   - Follows robots.txt guidelines

## Data Aggregation

### Scoring System:

1. **Individual Source Scores**
   - Each source calculates scores independently
   - Based on position, votes, stars, etc.

2. **Multi-Source Boost**
   - Tools mentioned in multiple sources get 20% boost per additional source
   - Example: Tool in 3 sources = 1.4x multiplier

3. **Normalization**
   - Tool names normalized (lowercase, trimmed, spaces/hyphens handled)
   - Prevents duplicate entries

4. **Final Ranking**
   - Top 100 tools by aggregated score
   - Sorted by total score

## Matching Algorithm

### Advanced Fuzzy Matching:

The system uses sophisticated matching to connect scraped tool names to your AI tools:

1. **Exact Match**
   - Direct name match = 100% score

2. **Name Variations**
   - Handles spaces, hyphens, capitalization
   - Removes common prefixes/suffixes ("the", "AI", "GPT", etc.)

3. **Similarity Matching**
   - Levenshtein distance algorithm
   - 70%+ similarity threshold
   - Score adjusted by similarity percentage

4. **Substring Matching**
   - "copilot" matches "github-copilot"
   - 75% score for substring matches

## Combined Trending Score

### Formula:

```
Final Score = (Local Views × 0.4) + (Online Trending × 0.6)
```

Where:
- **Local Views (40%)**: Based on clicks/views on your site (last 48 hours)
- **Online Trending (60%)**: Based on scraped data (80% real-time scraping + 20% GitHub)

### Benefits:

- **Real-time**: Reflects what's trending online right now
- **Personalized**: Includes your users' activity
- **Balanced**: Combines multiple signals for accuracy

## Caching Strategy

### Client-Side (localStorage):
- Cache duration: 5 minutes
- Key: `arcyn-find-online-trending`
- Stores: Trending data + timestamp

### Server-Side (Next.js):
- Cache duration: 5 minutes
- Stale-while-revalidate: 10 minutes
- Headers: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`

## Error Handling

### Graceful Degradation:

1. **Source Failures**
   - If one source fails, others continue
   - System never completely breaks

2. **API Failures**
   - Falls back to GitHub trending
   - Falls back to local views only
   - Always returns some trending data

3. **Network Issues**
   - Retries with exponential backoff
   - Timeout handling
   - User-friendly error messages

## Performance

### Optimizations:

1. **Parallel Fetching**
   - All sources fetched in parallel
   - Reduces total fetch time

2. **Batch Processing**
   - Hacker News processed in batches
   - Prevents API rate limit issues

3. **Efficient Matching**
   - Cached name variations
   - Early exit on exact matches

4. **Response Size**
   - Limited to top 100 tools
   - Reduces payload size

## Monitoring

### Metrics Tracked:

- Processing time (ms)
- Items per source
- Total unique tools
- Cache hit rate
- Error rates per source

### Response Format:

```json
{
  "trending": {
    "tool-name": score,
    ...
  },
  "sources": {
    "productHunt": 15,
    "hackerNews": 8,
    "reddit": 45,
    ...
  },
  "totalItems": 120,
  "uniqueTools": 85,
  "processingTimeMs": 3500,
  "timestamp": 1705123456789
}
```

## Future Enhancements

### Potential Additions:

1. **Twitter/X Integration**
   - Requires API credentials
   - Track mentions and hashtags

2. **Google Trends API**
   - Official trending data
   - Regional trends

3. **News Aggregation**
   - Tech news sites
   - AI-focused publications

4. **Database Storage**
   - Historical trending data
   - Trend analysis over time

5. **Machine Learning**
   - Predict trending tools
   - Anomaly detection

## Usage

### Client-Side:

```typescript
import { getTrendingAIs } from '@/lib/trending-utils'

const trending = await getTrendingAIs(aiModels, 3)
// Returns top 3 trending AI tools with category diversity
```

### API Endpoint:

```bash
GET /api/trending
```

Returns real-time trending data from all sources.

## Compliance Notes

- ✅ Respects rate limits with delays
- ✅ Uses official APIs where available
- ✅ Proper User-Agent headers
- ✅ Error handling prevents abuse
- ✅ Caching reduces server load
- ⚠️ Some sources may require API keys for production
- ⚠️ Check robots.txt for each domain
- ⚠️ Review terms of service for each source

## Troubleshooting

### Common Issues:

1. **No trending data**
   - Check network connectivity
   - Verify API endpoints are accessible
   - Check browser console for errors

2. **Slow loading**
   - Normal: First load takes 3-5 seconds
   - Subsequent loads use cache (instant)
   - Check processing time in response

3. **Missing tools**
   - Name matching may need adjustment
   - Check similarity threshold
   - Verify tool names in database

## Support

For issues or questions:
- Check console logs for detailed error messages
- Verify API endpoints are accessible
- Review rate limiting settings
- Check cache expiration times

