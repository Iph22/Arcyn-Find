-- Add priority column to ai_tools table
-- Priority is a score from 0-100 that determines search ranking
-- Higher priority = consumer-facing tools, lower = research/repos

ALTER TABLE ai_tools 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 50;

-- Create index for faster sorting by priority
CREATE INDEX IF NOT EXISTS idx_ai_tools_priority ON ai_tools(priority DESC);

-- Comment on column
COMMENT ON COLUMN ai_tools.priority IS 'Priority score 0-100 for search ranking. Higher = consumer tools, lower = research/repos';
