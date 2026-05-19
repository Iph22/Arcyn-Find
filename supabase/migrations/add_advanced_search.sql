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
-- v2: All signals normalized to 0–1 before weighting. Explicit weight formula.
DROP FUNCTION IF EXISTS search_tools_advanced(text, vector, float, int);
CREATE OR REPLACE FUNCTION search_tools_advanced(
  search_query text,           -- The raw text search query
  query_embedding vector(768) DEFAULT NULL, -- Optional semantic embedding
  match_threshold float DEFAULT 0.25,
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
  last_updated date,
  is_trending boolean,
  image text,
  priority int,
  similarity float,
  fts_score float,
  keyword_score float,
  source_trust_score float,
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

    -- Semantic Similarity (already 0–1 from cosine distance)
    CASE 
      WHEN t.embedding IS NOT NULL AND query_embedding IS NOT NULL 
      THEN (1 - (t.embedding <=> query_embedding))::double precision
      ELSE 0.0::double precision
    END as similarity,

    -- FTS Score: multiply by 4.0 then cap at 1.0 so it actually contributes
    LEAST(ts_rank(t.fts_vector, tsquery_val)::double precision * 4.0, 1.0) as fts_score,

    -- keyword_score: same normalized FTS value, kept separate for the ranking layer
    LEAST(ts_rank(t.fts_vector, tsquery_val)::double precision * 4.0, 1.0) as keyword_score,

    -- source_trust_score: derived from priority column, normalized 0–1
    LEAST(COALESCE(t.priority, 0)::double precision / 10.0, 1.0) as source_trust_score,

    -- Combined Score with explicit weights (all inputs normalized 0–1)
    (
      -- Semantic similarity × 3.0
      (CASE 
        WHEN t.embedding IS NOT NULL AND query_embedding IS NOT NULL 
        THEN (1 - (t.embedding <=> query_embedding))::double precision
        ELSE 0.0::double precision
       END * 3.0)
      +
      -- FTS / keyword match × 4.0 (highest weight — most direct relevance)
      (LEAST(ts_rank(t.fts_vector, tsquery_val)::double precision * 4.0, 1.0) * 4.0)
      +
      -- Source trust × 3.0
      (LEAST(COALESCE(t.priority, 0)::double precision / 10.0, 1.0) * 3.0)
      +
      -- Popularity normalized × 1.5
      (LEAST(COALESCE(t.popularity, 0)::double precision / 10000.0, 1.0) * 1.5)
      +
      -- Trending bonus × 1.0
      (CASE WHEN t.is_trending THEN 1.0::double precision ELSE 0.0::double precision END)
    )::double precision as combined_score

  FROM ai_tools t
  WHERE 
    -- Condition 1: Semantic match passes threshold
    (t.embedding IS NOT NULL AND query_embedding IS NOT NULL AND 1 - (t.embedding <=> query_embedding) > match_threshold)
    OR
    -- Condition 2: Full Text Search matches, even without perfect semantic score
    (tsquery_val @@ t.fts_vector)
  ORDER BY 
    combined_score DESC,
    t.is_trending DESC,
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

