-- ============================================================================
-- Phase 3: cache generated stacks.
--
-- Same reasoning as add_recommendation_cache.sql, but the case is stronger. A
-- stack costs one model call to decompose the goal PLUS one retrieval per step
-- (up to 5), so it is the most expensive thing this app computes. The Gemini
-- quota has been the binding constraint throughout Phase 2 and 3 — the
-- recommendation eval has been reporting `reasoned 0%` on the free tier — so a
-- stack that has already been built must not be rebuilt because someone
-- searched the same goal twice.
--
-- Additive and idempotent: two nullable columns on the table that already holds
-- this query's embedding, NLP parse and recommendation. One row per query, now
-- four cached artifacts, all reachable through the existing query_text index.
-- ============================================================================

ALTER TABLE search_cache
  ADD COLUMN IF NOT EXISTS stack jsonb,
  ADD COLUMN IF NOT EXISTS stack_at timestamptz;

COMMENT ON COLUMN search_cache.stack IS
  'Cached /api/stack response body. Only ever written for non-degraded stacks with at least one filled step — caching a "temporarily unavailable" result would pin it in place for the whole TTL, and quota exhaustion is exactly what produces those results.';
COMMENT ON COLUMN search_cache.stack_at IS
  'When the cached stack was generated. TTL is deliberately SHORTER than the recommendation TTL (3 days vs 7): a stack contains several tools, so it has several times the chance of holding something whose pricing changed, and one stale member makes the whole plan wrong.';

-- Mirrors idx_search_cache_recommendation_at: lets the freshness check
-- (`stack_at > now() - interval`) be answered from the index for rows that
-- actually have a cached stack, rather than touching every search_cache row.
CREATE INDEX IF NOT EXISTS idx_search_cache_stack_at
  ON search_cache (query_text, stack_at)
  WHERE stack IS NOT NULL;

ANALYZE search_cache;
