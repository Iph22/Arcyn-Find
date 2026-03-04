-- ============================================
-- TOOL SUBMISSIONS TABLE
-- Allows users to submit new AI tools for review.
-- This is the #1 growth mechanism for AI tool directories.
-- ============================================

BEGIN;

-- Create the tool_submissions table for crowd-sourced tool discovery
CREATE TABLE IF NOT EXISTS tool_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT DEFAULT 'Other',
    pricing TEXT DEFAULT 'Unknown',
    access_type TEXT DEFAULT 'Unknown',
    tags TEXT[] DEFAULT '{}',
    submitted_by TEXT,               -- Email of submitter (optional)
    status TEXT DEFAULT 'pending',   -- pending, approved, rejected
    reviewed_by TEXT,                -- Admin who reviewed
    review_notes TEXT,               -- Notes from review
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    
    -- Prevent duplicate submissions
    CONSTRAINT unique_submission_name_url UNIQUE (name, url)
);

-- Index for fast lookups by status
CREATE INDEX IF NOT EXISTS idx_submissions_status 
ON tool_submissions (status, submitted_at DESC);

-- Index for duplicate checking
CREATE INDEX IF NOT EXISTS idx_submissions_name 
ON tool_submissions (lower(name));

COMMIT;
