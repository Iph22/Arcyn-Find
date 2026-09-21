-- ============================================================================
-- Contact / feedback submissions.
--
-- WHY THIS EXISTS: /api/contact used to email and nothing else. A submission
-- lived only as a message to a hardcoded `hello@arcynfind.com`, which is not a
-- mailbox but an ImprovMX forwarding alias. On 2026-09-21 a beta feedback
-- report was accepted by Resend (the route returned 200) and never arrived —
-- and because nothing was persisted, there was no record it had ever been
-- sent. The content was simply gone, unrecoverably.
--
-- The route now writes here FIRST and emails second, so mail is a notification
-- channel rather than the system of record. Delivery can break at Resend, at
-- the forwarder, or in a spam filter, and the feedback still survives.
--
-- No RLS policies: this table is written and read through the service-role
-- key only, like tool_submissions and recommendation_feedback. Nothing in the
-- public client should ever see other people's messages.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS contact_submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Exactly the four fields contactFormSchema accepts. The schema is
    -- .strict(), so the feedback widget smuggles page context inside
    -- subject/message rather than adding keys; that is why message can be long.
    name text NOT NULL,
    email text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,

    -- 'feedback_widget' or 'contact_form'. Derived from the subject prefix the
    -- widget sets, because the strict schema leaves no room for the client to
    -- declare it. Worth separating: beta reports and cold contact-form mail
    -- get triaged differently.
    source text NOT NULL DEFAULT 'contact_form',

    -- What happened to the notification email, recorded AFTER the attempt.
    -- 'pending' is the value a row keeps if the process dies mid-send, which
    -- is itself the useful signal.
    email_status text NOT NULL DEFAULT 'pending',
    email_id text,      -- Resend message id, for matching against their logs
    email_error text,   -- provider error text when status = 'failed'

    -- Hashed, never raw: enough to spot one address flooding the form, not
    -- enough to identify anyone. Same treatment as tool_views.ip_hash.
    ip_hash text,

    created_at timestamptz DEFAULT now(),

    CONSTRAINT contact_submissions_email_status_check
        CHECK (email_status IN ('pending', 'sent', 'failed', 'not_configured'))
);

-- Triage order: newest first is how anyone actually reads these.
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created
    ON contact_submissions (created_at DESC);

-- The query this table was built for: "what did we fail to deliver?"
CREATE INDEX IF NOT EXISTS idx_contact_submissions_undelivered
    ON contact_submissions (email_status, created_at DESC)
    WHERE email_status <> 'sent';

-- Beta reports separately from general contact mail.
CREATE INDEX IF NOT EXISTS idx_contact_submissions_source
    ON contact_submissions (source, created_at DESC);

COMMIT;

ANALYZE contact_submissions;

-- Reading them back, until there is a UI:
--
--   SELECT created_at, source, name, email, subject, email_status
--   FROM contact_submissions
--   ORDER BY created_at DESC
--   LIMIT 50;
--
--   -- anything the mail path lost
--   SELECT * FROM contact_submissions
--   WHERE email_status <> 'sent'
--   ORDER BY created_at DESC;
