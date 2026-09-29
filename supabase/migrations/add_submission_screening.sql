-- ============================================================================
-- Screening results and an image for submitted tools.
--
-- Submissions land in tool_submissions with status 'pending' and, until now,
-- nothing else. Approving one meant opening the URL, reading the page, judging
-- whether the description matched it and whether the tool already existed --
-- by hand, per submission. That does not scale past a handful, and the thing
-- that breaks first is not throughput, it is care: the tenth review is less
-- thorough than the first, and an inauthentic listing costs more trust than a
-- missing one.
--
-- lib/submission-screening.ts does that gathering automatically and writes what
-- it found here. It does not decide -- `status` is still set by a person.
--
-- WHY `screening` IS jsonb AND NOT COLUMNS
--
-- The set of checks will change as we learn what actually predicts a bad
-- submission. Each check is {id, label, status, detail, weight}, and a column
-- per check would mean a migration every time one is added and a table full of
-- nulls for submissions screened before it existed. The reviewer reads the
-- list; nothing queries an individual check.
--
-- `screening_score` is broken out because it IS queried -- the review queue
-- orders by it, so the clearest submissions can be handled first.
-- ============================================================================

ALTER TABLE tool_submissions
  ADD COLUMN IF NOT EXISTS screening jsonb,
  ADD COLUMN IF NOT EXISTS screening_score integer,
  -- A logo or screenshot supplied by the submitter, in the `user-uploads`
  -- bucket. Nullable: a submission without one is still a submission, and a
  -- required image would cost more good entries than it saves bad ones.
  ADD COLUMN IF NOT EXISTS image_url text;

-- The review queue's only ordering: unreviewed first, least evidence first.
-- Partial on 'pending' because approved and rejected rows are never listed
-- this way and there will eventually be far more of them.
CREATE INDEX IF NOT EXISTS idx_submissions_pending_score
  ON tool_submissions (screening_score ASC NULLS FIRST, submitted_at ASC)
  WHERE status = 'pending';

COMMENT ON COLUMN tool_submissions.screening IS
  'Output of lib/submission-screening.ts: checks[], score, blocking[], screenedAt. Evidence for a human decision, never a decision.';
COMMENT ON COLUMN tool_submissions.screening_score IS
  '0-100 over the checks that returned an answer. Checks that could not answer (a site refusing bots, a timeout) are excluded rather than counted as failures -- 23% of the most popular published tools answer 403 to an automated request.';
COMMENT ON COLUMN tool_submissions.image_url IS
  'Submitter-supplied logo or screenshot in the user-uploads bucket.';
