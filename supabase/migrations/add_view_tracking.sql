-- Create table for tracking tool views (idempotent - safe to run multiple times)
-- This enables analytics and accurate trending calculations

CREATE TABLE IF NOT EXISTS tool_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tool_id TEXT NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_hash TEXT, -- Hashed IP for uniqueness (privacy-safe)
    session_id TEXT, -- Optional session tracking
    source TEXT DEFAULT 'web' -- web, api, etc.
);

-- Index for querying views by tool in time windows (use CREATE INDEX IF NOT EXISTS)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tool_views_tool_time') THEN
        CREATE INDEX idx_tool_views_tool_time ON tool_views(tool_id, viewed_at DESC);
    END IF;
END $$;

-- Index for time-based queries (trending calculations)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tool_views_time') THEN
        CREATE INDEX idx_tool_views_time ON tool_views(viewed_at DESC);
    END IF;
END $$;

-- Add view_count column to ai_tools for caching
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS view_count_24h INTEGER DEFAULT 0;
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS view_count_7d INTEGER DEFAULT 0;
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS last_view_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE ai_tools ADD COLUMN IF NOT EXISTS trending_score REAL DEFAULT 0;

-- Indexes for ai_tools (use DO blocks for idempotency)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_tools_view_count') THEN
        CREATE INDEX idx_ai_tools_view_count ON ai_tools(view_count DESC);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_tools_trending_score') THEN
        CREATE INDEX idx_ai_tools_trending_score ON ai_tools(trending_score DESC);
    END IF;
END $$;

-- Comments on columns (safe to run multiple times)
COMMENT ON COLUMN ai_tools.view_count IS 'Total all-time view count';
COMMENT ON COLUMN ai_tools.view_count_24h IS 'Views in last 24 hours (updated by cron)';
COMMENT ON COLUMN ai_tools.view_count_7d IS 'Views in last 7 days (updated by cron)';
COMMENT ON COLUMN ai_tools.trending_score IS 'Calculated trending score (0-100)';
