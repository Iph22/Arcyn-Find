-- ============================================
-- ADVANCED SEARCH MIGRATION
-- Adds Full-Text Search (FTS) for better keyword search and
-- a search_cache table to save API tokens for Gemini.
-- ============================================

BEGIN;

-- 1. Create a search cache table to persist Gemini NLP parses and embeddings
CREATE TABLE IF NOT EXISTS search_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_text TEXT NOT NULL UNIQUE,
    semantic_embedding vector(768),
    nlp_keywords TEXT[],
    nlp_categories TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    use_count INT DEFAULT 1
);

-- Index the cache on query text for very fast lookups
CREATE INDEX IF NOT EXISTS idx_search_cache_query ON search_cache (query_text);

-- 2. Add Full-Text Search (FTS) vector column to ai_tools
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS fts_vector tsvector;

-- 3. Create a function to automatically update the fts_vector
CREATE OR REPLACE FUNCTION update_ai_tools_fts_vector() RETURNS trigger AS $$
BEGIN
  -- We include name (weight A), tags (weight A), category (weight B), description (weight C)
  NEW.fts_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.platform, '')), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 4. Create trigger to keep fts_vector updated on insert or update
DROP TRIGGER IF EXISTS trg_ai_tools_fts_update ON ai_tools;
CREATE TRIGGER trg_ai_tools_fts_update
BEFORE INSERT OR UPDATE ON ai_tools
FOR EACH ROW EXECUTE FUNCTION update_ai_tools_fts_vector();

-- 5. Back-fill the fts_vector for existing rows
UPDATE ai_tools SET id = id WHERE fts_vector IS NULL;

-- 6. Create GIN index for blazing fast FTS
CREATE INDEX IF NOT EXISTS ai_tools_fts_idx ON ai_tools USING GIN (fts_vector);

-- 7. Advanced Hybrid Search Function that combines FTS and Semantic Search
-- If query_embedding is NULL, it falls back to pure FTS (much better than ILIKE)
CREATE OR REPLACE FUNCTION search_tools_advanced(
  search_query text,           -- The raw text search query
  query_embedding vector(768) DEFAULT NULL, -- Optional semantic embedding
  match_threshold float DEFAULT 0.4,
  match_count int DEFAULT 30
)
RETURNS TABLE (
  id text,
  name text,
  category text,
  description text,
  platform text,
  region text,
  access_type text,
  pricing text,
  tags text[],
  popularity int,
  last_updated text,
  is_trending boolean,
  image text,
  priority int,
  similarity float,
  fts_score float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
DECLARE
  tsquery_val tsquery;
BEGIN
  -- Convert user query "like google" into a tsquery
  -- Example: "best AI audio" -> 'best' & 'ai' & 'audio'
  tsquery_val := websearch_to_tsquery('english', search_query);

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.category,
    t.description,
    t.platform,
    t.region,
    t.access_type,
    t.pricing,
    t.tags,
    t.popularity,
    t.last_updated,
    t.is_trending,
    t.image,
    t.priority,
    -- Calculate Semantic Similarity 
    CASE 
      WHEN t.embedding IS NOT NULL AND query_embedding IS NOT NULL 
      THEN 1 - (t.embedding <=> query_embedding)
      ELSE 0.0
    END as similarity,
    -- Calculate FTS Score (how well keywords match, based on weights A/B/C/D)
    ts_rank(t.fts_vector, tsquery_val) as fts_score,
    -- Calculate Combined Score
    -- Semantic similarity is bounded 0 to 1. FTS rank is unbounded but generally small.
    (
      (CASE 
        WHEN t.embedding IS NOT NULL AND query_embedding IS NOT NULL 
        THEN 1 - (t.embedding <=> query_embedding)
        ELSE 0.0
       END * 2.0) -- Weight semantic higher if present
      + 
      ts_rank(t.fts_vector, tsquery_val)
      +
      -- Boost for trending/popularity
      (COALESCE(t.popularity, 0)::float / 1000.0)
      +
      (CASE WHEN t.is_trending THEN 0.1 ELSE 0.0 END)
    ) as combined_score
  FROM ai_tools t
  WHERE 
    -- Condition 1: Semantic match passes threshold
    (t.embedding IS NOT NULL AND query_embedding IS NOT NULL AND 1 - (t.embedding <=> query_embedding) > match_threshold)
    OR
    -- Condition 2: Full Text Search matches, even without perfect semantic score
    (tsquery_val @@ t.fts_vector)
  ORDER BY 
    combined_score DESC,
    t.priority DESC NULLS LAST,
    t.popularity DESC NULLS LAST
  LIMIT match_count;
END;
$$;

-- 8. Function to atomically increment search popularity
-- Called fire-and-forget from the API to track popular searches
CREATE OR REPLACE FUNCTION increment_search_count(search_query text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO search_cache (query_text, use_count, last_used_at)
  VALUES (search_query, 1, NOW())
  ON CONFLICT (query_text) 
  DO UPDATE SET 
    use_count = search_cache.use_count + 1,
    last_used_at = NOW();
END;
$$;

-- 9. Index for fast popular search lookups (used by autocomplete)
CREATE INDEX IF NOT EXISTS idx_search_cache_popular 
ON search_cache (use_count DESC, last_used_at DESC);

COMMIT;

