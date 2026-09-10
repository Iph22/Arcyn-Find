-- ============================================================================
-- Phase 2: cache generated recommendations.
--
-- Measured problem this solves. Running the 26-query eval back to back:
--     reasoned  50%   <- 12x HTTP 429 + 1x 503 from the Gemini free tier
--     latency   p50 4011ms / p95 6474ms
-- Every degraded call still returned a usable recommendation from the
-- deterministic template, but half of them lost the actual reasoning about the
-- user's goal — which is the entire point of the feature. Bursty traffic makes
-- it worse, and repeat queries were paying full price every time.
--
-- Reuses search_cache rather than a new table: it is already keyed on
-- query_text (UNIQUE, indexed) and already caches this exact query's embedding
-- and NLP parse, so a recommendation lookup rides the same index and the same
-- row. One row per query, three cached artifacts.
-- ============================================================================

ALTER TABLE search_cache
  ADD COLUMN IF NOT EXISTS recommendation jsonb,
  ADD COLUMN IF NOT EXISTS recommendation_at timestamptz;

COMMENT ON COLUMN search_cache.recommendation IS
  'Cached /api/recommend response body. Only ever written for NON-degraded results — caching a deterministic-fallback recommendation would pin the lower-quality version in place for the whole TTL.';
COMMENT ON COLUMN search_cache.recommendation_at IS
  'When the cached recommendation was generated. Used for TTL expiry; the tool corpus changes slowly, so the TTL is days rather than minutes.';

-- Lets the freshness check (`recommendation_at > now() - interval`) be answered
-- from the index for rows that actually have a cached recommendation, instead
-- of touching every search_cache row.
CREATE INDEX IF NOT EXISTS idx_search_cache_recommendation_at
  ON search_cache (query_text, recommendation_at)
  WHERE recommendation IS NOT NULL;

ANALYZE search_cache;
