-- Fix: Update search functions for gemini-embedding-001 model
-- We use outputDimensionality=768 so column stays vector(768)
-- The old text-embedding-004 model was shut down Jan 2026

-- Recreate the semantic search function (same as before, just refreshing)
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

-- Hybrid search function (same as before, just refreshing)
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

COMMENT ON COLUMN ai_tools.embedding IS 'Semantic embedding vector (768 dimensions) generated using gemini-embedding-001 with outputDimensionality=768';
