-- Create ai_tools table in Supabase
CREATE TABLE IF NOT EXISTS ai_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('Free', 'Freemium', 'Paid')),
  pricing TEXT,
  tags TEXT[] DEFAULT '{}',
  popularity INTEGER DEFAULT 50 CHECK (popularity >= 0 AND popularity <= 100),
  last_updated DATE DEFAULT CURRENT_DATE,
  is_trending BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_ai_tools_category ON ai_tools(category);
CREATE INDEX IF NOT EXISTS idx_ai_tools_region ON ai_tools(region);
CREATE INDEX IF NOT EXISTS idx_ai_tools_access_type ON ai_tools(access_type);
CREATE INDEX IF NOT EXISTS idx_ai_tools_popularity ON ai_tools(popularity DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tools_is_trending ON ai_tools(is_trending) WHERE is_trending = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_tools_tags ON ai_tools USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_ai_tools_name_search ON ai_tools USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Enable Row Level Security
ALTER TABLE ai_tools ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access
DROP POLICY IF EXISTS "Public read access" ON ai_tools;
CREATE POLICY "Public read access" ON ai_tools
  FOR SELECT USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_ai_tools_updated_at ON ai_tools;
CREATE TRIGGER update_ai_tools_updated_at
    BEFORE UPDATE ON ai_tools
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

