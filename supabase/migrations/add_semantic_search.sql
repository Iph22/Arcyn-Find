-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to ai_tools table
-- 768 dimensions for Gemini's text-embedding-004 model
ALTER TABLE ai_tools 
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create index for fast similarity search
-- Using IVFFlat for balance between speed and accuracy
CREATE INDEX IF NOT EXISTS ai_tools_embedding_idx 
ON ai_tools 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function to search tools by semantic similarity
DROP FUNCTION IF EXISTS search_tools_semantic(vector, float, int);
CREATE OR REPLACE FUNCTION search_tools_semantic(
  query_embedding vector(768),
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
  last_updated date,
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
    (1 - (ai_tools.embedding <=> query_embedding))::double precision as similarity
  FROM ai_tools
  WHERE ai_tools.embedding IS NOT NULL
    AND 1 - (ai_tools.embedding <=> query_embedding) > match_threshold
  ORDER BY ai_tools.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Hybrid search: combines semantic + keyword search with ranking
DROP FUNCTION IF EXISTS search_tools_hybrid(vector, text, float, int);
CREATE OR REPLACE FUNCTION search_tools_hybrid(
  query_embedding vector(768),
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
  last_updated date,
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
      WHEN t.embedding IS NOT NULL THEN (1 - (t.embedding <=> query_embedding))::double precision
      ELSE 0.0::double precision
    END as similarity,
    (
      search_text != '' AND (
        t.name ILIKE '%' || search_text || '%' OR
        t.description ILIKE '%' || search_text || '%'
      )
    ) as keyword_match
  FROM ai_tools t
  WHERE 
    -- Include if semantic similarity is high enough
    (t.embedding IS NOT NULL AND 1 - (t.embedding <=> query_embedding) > match_threshold)
    OR
    -- Or if keyword matches (fallback)
    (search_text != '' AND (
      t.name ILIKE '%' || search_text || '%' OR
      t.description ILIKE '%' || search_text || '%'
    ))
  ORDER BY 
    -- Prioritize semantic matches, then keyword matches
    CASE 
      WHEN t.embedding IS NOT NULL THEN 1 - (t.embedding <=> query_embedding)
      ELSE 0.3
    END DESC,
    t.popularity DESC NULLS LAST
  LIMIT match_count;
END;
$$;

-- Add comment for documentation
COMMENT ON COLUMN ai_tools.embedding IS 'Semantic embedding vector (768 dimensions) generated from name + description using Gemini text-embedding-004';
