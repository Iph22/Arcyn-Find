-- ============================================================================
-- Fix: hybrid search retrieval, ranking, and query understanding bugs
-- Covers Problems 1-3 from the Search Diagnosis & Fix Plan.
-- ============================================================================

-- 0. pg_trgm for ILIKE fallback index
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_ai_tools_name_trgm
  ON ai_tools USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ai_tools_description_trgm
  ON ai_tools USING gin (description gin_trgm_ops);

-- 1. Fix 1b -- backfill fts_vector, scoped to only the rows that need it.
UPDATE ai_tools
SET name = name
WHERE fts_vector IS NULL;

-- 2. Replace search_tools_advanced to fix retrieval, ranking, query understanding
DROP FUNCTION IF EXISTS search_tools_advanced(text, vector, float, int);
DROP FUNCTION IF EXISTS search_tools_advanced(text, vector, float, int, text[]);

CREATE OR REPLACE FUNCTION search_tools_advanced(
  search_query text,
  query_embedding vector(768) DEFAULT NULL,
  match_threshold float DEFAULT 0.20,       -- Fix 1a/1d: was 0.25
  match_count int DEFAULT 30,
  extra_keywords text[] DEFAULT NULL        -- Fix 3a/3b: synonyms from processSearchQuery
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
  query_tokens text[];
BEGIN
  -- Fix 1c: Check if websearch_to_tsquery is empty
  tsquery_val := websearch_to_tsquery('english', search_query);
  IF tsquery_val IS NULL OR numnode(tsquery_val) = 0 THEN
    tsquery_val := plainto_tsquery('english', search_query);
  END IF;

  -- Fix 1a/1d: tokenize the WHOLE query for the ILIKE fallback.
  SELECT array_agg(DISTINCT token) INTO query_tokens
  FROM unnest(regexp_split_to_array(lower(trim(search_query)), '\s+')) AS token
  WHERE length(token) >= 2;

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
    
    -- Similarity
    CASE 
      WHEN t.embedding IS NOT NULL AND query_embedding IS NOT NULL 
      THEN (1 - (t.embedding <=> query_embedding))::double precision
      ELSE 0.0::double precision
    END as similarity,

    -- FTS Score
    LEAST(COALESCE(ts_rank(t.fts_vector, tsquery_val)::double precision, 0) * 4.0, 1.0) as fts_score,

    -- Keyword Score
    LEAST(COALESCE(ts_rank(t.fts_vector, tsquery_val)::double precision, 0) * 4.0, 1.0) as keyword_score,

    -- Source Trust Score (Fix 2a/2b: divide by 100.0 instead of 10.0, default to 50)
    LEAST(COALESCE(t.priority, 50)::double precision / 100.0, 1.0) as source_trust_score,

    -- Combined Score
    (
      -- Semantic similarity x 3.0
      (CASE 
        WHEN t.embedding IS NOT NULL AND query_embedding IS NOT NULL 
        THEN (1 - (t.embedding <=> query_embedding))::double precision
        ELSE 0.0::double precision
       END * 3.0)
      +
      -- FTS / keyword match x 4.0
      (LEAST(COALESCE(ts_rank(t.fts_vector, tsquery_val)::double precision, 0) * 4.0, 1.0) * 4.0)
      +
      -- Source trust x 3.0
      (LEAST(COALESCE(t.priority, 50)::double precision / 100.0, 1.0) * 3.0)
      +
      -- Popularity normalized x 1.5
      (LEAST(COALESCE(t.popularity, 0)::double precision / 10000.0, 1.0) * 1.5)
      +
      -- Trending bonus x 1.0
      (CASE WHEN t.is_trending THEN 1.0::double precision ELSE 0.0::double precision END)
    )::double precision as combined_score

  FROM ai_tools t
  WHERE 
    -- Path 1: semantic similarity above threshold
    (t.embedding IS NOT NULL AND query_embedding IS NOT NULL AND 1 - (t.embedding <=> query_embedding) > match_threshold)
    
    OR
    -- Path 2: FTS matches
    (tsquery_val IS NOT NULL AND tsquery_val @@ t.fts_vector)
    
    OR
    -- Path 3: ILIKE safety net over every token
    (query_tokens IS NOT NULL AND EXISTS (
        SELECT 1 FROM unnest(query_tokens) qt
        WHERE t.name ILIKE '%' || qt || '%' OR t.description ILIKE '%' || qt || '%'
    ))

    OR
    -- Path 4: synonym-expanded keywords
    (extra_keywords IS NOT NULL AND EXISTS (
        SELECT 1 FROM unnest(extra_keywords) kw
        WHERE t.name ILIKE '%' || kw || '%' OR t.description ILIKE '%' || kw || '%'
    ))
  ORDER BY 
    combined_score DESC,
    t.is_trending DESC,
    t.popularity DESC NULLS LAST
  LIMIT match_count;
END;
$$;
