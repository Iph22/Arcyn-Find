# Hybrid Rendering Strategy

This document outlines the hybrid rendering approach used in Arcyn Find, combining static generation, ISR (Incremental Static Regeneration), and dynamic rendering for optimal performance.

## Rendering Strategies

### 1. Static Pages (○)
Fully static pages that are pre-rendered at build time and never change:

- **`/`** - Landing page (static content)
- **`/auth`** - Authentication page (static UI)
- **`/auth/reset-password`** - Password reset page (static UI)
- **`/instructions`** - Instructions page (static content)
- **`/settings`** - Settings page (static UI, data fetched client-side)
- **`/_not-found`** - 404 page (static)

**Configuration:**
```typescript
export const dynamic = 'force-static';
```

### 2. ISR Pages (○ with Revalidate)
Static pages with Incremental Static Regeneration - pre-rendered at build time and periodically revalidated:

- **`/home`** - Home page
  - Revalidate: **30 minutes**
  - Reason: Personalized content that changes moderately
  
- **`/tools`** - Tools listing page
  - Revalidate: **1 hour**
  - Reason: AI tools list updates periodically but not in real-time

- **`/tools/[id]`** - Tool detail pages
  - Revalidate: **2 hours**
  - Reason: Tool details change infrequently

- **`/collections/[id]`** - Collection detail pages
  - Revalidate: **1 hour**
  - Reason: Collection contents may change but not constantly

**Configuration:**
```typescript
export const revalidate = 1800; // 30 minutes (for /home)
export const revalidate = 3600; // 1 hour (for /tools, /collections/[id])
export const revalidate = 7200; // 2 hours (for /tools/[id])
```

### 3. Dynamic Pages (ƒ)
Server-rendered on demand for user-specific or real-time content:

- **`/profile`** - User profile (user-specific)
- **`/collections`** - User collections list (user-specific)
- **`/reviews`** - User reviews (user-specific)
- **`/followers`** - User followers (user-specific)
- **`/onboarding`** - Onboarding flow (user-specific)
- **`/auth/callback`** - OAuth callback (session-dependent)

**Configuration:**
```typescript
export const dynamic = 'force-dynamic';
```

### 4. API Routes (ƒ)
All API routes are dynamic and handle requests on-demand:

- `/api/ai-models` - AI tools data
- `/api/collections` - Collections CRUD
- `/api/favorites` - Favorites management
- `/api/reviews` - Reviews management
- `/api/users/[id]` - User data
- `/api/trending` - Trending data
- `/api/cron/*` - Cron jobs

## Benefits of Hybrid Approach

### Performance
- **Faster Initial Load**: Static and ISR pages are pre-rendered, reducing server load
- **Better SEO**: Search engines can crawl static content easily
- **Reduced Server Costs**: Less server-side rendering for frequently accessed pages

### Freshness
- **ISR**: Balances performance with data freshness
- **Dynamic**: Ensures real-time data for user-specific content
- **Configurable**: Revalidation intervals can be adjusted based on update frequency

### User Experience
- **Instant Page Loads**: Static pages load instantly
- **Progressive Enhancement**: Client-side features work on top of static base
- **Scalability**: Can handle high traffic on static/ISR pages

## Revalidation Strategy

### Short Revalidation (30 minutes)
- Home page: Personalized content that changes moderately

### Medium Revalidation (1 hour)
- Tools listing: AI tools are added/updated periodically
- Collection details: Collections may be updated by users

### Long Revalidation (2 hours)
- Tool details: Individual tool information changes infrequently

### On-Demand Revalidation
For critical updates, you can trigger revalidation programmatically:
```typescript
import { revalidatePath } from 'next/cache'

// Revalidate a specific path
revalidatePath('/tools')
revalidatePath('/tools/[id]', 'page')
```

## Monitoring

Monitor the following metrics:
- Static page hit rate
- ISR revalidation frequency
- Dynamic page response times
- Cache hit rates

## Future Optimizations

1. **On-Demand ISR**: Trigger revalidation when data changes
2. **Edge Caching**: Use edge functions for global distribution
3. **Partial Prerendering**: Combine static shell with dynamic islands
4. **Streaming SSR**: Stream dynamic content while static shell loads

