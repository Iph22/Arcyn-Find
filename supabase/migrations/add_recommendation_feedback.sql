-- ============================================================================
-- Phase 2: recommendation feedback.
--
-- WHY THIS MATTERS MORE THAN IT LOOKS: right now the only signal on whether
-- recommendations are any good is a synthetic eval whose relevance check is a
-- loose substring match. It scored 100% while still surfacing "TLDR" for "find
-- and fix bugs in my codebase". This table is the first source of real
-- judgement from actual users, and the input the doc's ranking-improvement
-- loop needs.
--
-- Column types deliberately match the existing tables rather than what you'd
-- pick fresh: tool_id is text (ai_tools.id is text, e.g. "ot-6696a31e..."), and
-- user_id is text because the schema still carries Clerk-era ids
-- ("user_35tHpyxCP4sZRtlFJCeNdwQ0f3m") even though auth is Google OAuth now.
-- ============================================================================

CREATE TABLE IF NOT EXISTS recommendation_feedback (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- The goal the user typed, normalized the same way the recommendation
    -- cache normalizes it, so feedback joins to cached recommendations.
    query_text text NOT NULL,

    -- Which tool was being judged, and in which slot it appeared. Slot matters:
    -- "the best match was wrong" is a different signal from "this alternative
    -- was unhelpful", and ranking changes should be able to tell them apart.
    tool_id text NOT NULL,
    slot text NOT NULL DEFAULT 'best_match',

    verdict text NOT NULL,

    -- Only meaningful for a 'down' verdict. Constrained to a small set so it
    -- stays aggregatable — free-text would be unusable for ranking work.
    reason text,

    -- NULL for anonymous feedback. Deliberately allowed: requiring sign-in
    -- would collapse the volume of the only real quality signal we have.
    user_id text,

    created_at timestamptz DEFAULT now(),

    CONSTRAINT recommendation_feedback_verdict_check
        CHECK (verdict IN ('up', 'down')),
    CONSTRAINT recommendation_feedback_slot_check
        CHECK (slot IN ('best_match', 'alternative')),
    CONSTRAINT recommendation_feedback_reason_check
        CHECK (reason IS NULL OR reason IN (
            'not_relevant', 'too_expensive', 'missing_feature',
            'better_alternative', 'wrong_category', 'other'
        ))
);

-- One vote per signed-in user per (query, tool). Partial, because anonymous
-- rows have NULL user_id and NULLs don't collide in a unique index — anonymous
-- spam is handled by the endpoint's rate limit instead.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rec_feedback_unique_user_vote
    ON recommendation_feedback (user_id, query_text, tool_id)
    WHERE user_id IS NOT NULL;

-- "How does this tool perform when recommended?" — feeds tool-level ranking.
CREATE INDEX IF NOT EXISTS idx_rec_feedback_tool
    ON recommendation_feedback (tool_id, verdict);

-- "How do recommendations for this query perform?" — feeds query-level tuning.
CREATE INDEX IF NOT EXISTS idx_rec_feedback_query
    ON recommendation_feedback (query_text);

-- Recent-first analytics.
CREATE INDEX IF NOT EXISTS idx_rec_feedback_created
    ON recommendation_feedback (created_at DESC);

ANALYZE recommendation_feedback;
