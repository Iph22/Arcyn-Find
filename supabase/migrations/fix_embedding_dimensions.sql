-- Fix: Update embedding column from 768 to 3072 dimensions
-- The old text-embedding-004 model (768 dims) was shut down Jan 2026
-- The new gemini-embedding-001 model uses 3072 dimensions

-- Drop the old index
DROP INDEX IF EXISTS ai_tools_embedding_idx;

-- Change column type to 3072 dimensions
ALTER TABLE ai_tools 
ALTER COLUMN embedding TYPE vector(3072);

-- Recreate index with new dimensions
CREATE INDEX IF NOT EXISTS ai_tools_embedding_idx 
ON ai_tools 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Update the search functions to use 3072 dimensions

-- Function to search tools by semantic similarity
CREATE OR REPLACE FUNCTION search_tools_semantic(
  query_embedding vector(3072),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
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
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_tools.id,
    ai_tools.name,
    ai_tools.category,
    ai_tools.description,
    ai_tools.platform,
    ai_tools.region,
    ai_tools.access_type,
    ai_tools.pricing,
    ai_tools.tags,
    ai_tools.popularity,
    ai_tools.last_updated,
    ai_tools.is_trending,
    ai_tools.image,
    1 - (ai_tools.embedding <=> query_embedding) as similarity
  FROM ai_tools
  WHERE ai_tools.embedding IS NOT NULL
    AND 1 - (ai_tools.embedding <=> query_embedding) > match_threshold
  ORDER BY ai_tools.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Hybrid search: combines semantic + keyword search with ranking
CREATE OR REPLACE FUNCTION search_tools_hybrid(
  query_embedding vector(3072),
  search_text text DEFAULT '',
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
  similarity float,
  keyword_match boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
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
    CASE 
      WHEN t.embedding IS NOT NULL THEN 1 - (t.embedding <=> query_embedding)
      ELSE 0.0
    END as similarity,
    (
      search_text != '' AND (
        t.name ILIKE '%' || search_text || '%' OR
        t.description ILIKE '%' || search_text || '%'
      )
    ) as keyword_match
  FROM ai_tools t
  WHERE 
    (t.embedding IS NOT NULL AND 1 - (t.embedding <=> query_embedding) > match_threshold)
    OR
    (search_text != '' AND (
      t.name ILIKE '%' || search_text || '%' OR
      t.description ILIKE '%' || search_text || '%'
    ))
  ORDER BY 
    CASE 
      WHEN t.embedding IS NOT NULL THEN 1 - (t.embedding <=> query_embedding)
      ELSE 0.3
    END DESC,
    t.popularity DESC NULLS LAST
  LIMIT match_count;
END;
$$;

COMMENT ON COLUMN ai_tools.embedding IS 'Semantic embedding vector (3072 dimensions) generated using gemini-embedding-001';
