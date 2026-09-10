-- ============================================================================
-- Phase 2 foundation: structured pricing.
--
-- `ai_tools.pricing` is free text ("Free tier, Pro $20/mo", "Free tier +
-- $25-199/month", "$40/year, Free, $198/year"). Good for display, unusable as
-- data. Three Phase 2 features need it as data:
--   - pricing comparison between recommended tools
--   - price filtering / sorting in the directory
--   - the "pricing fit" term in the recommendation scoring formula
-- and the "best budget option" label becomes computable instead of being
-- inferred by the model from prose.
--
-- The free-text column is KEPT and stays authoritative for display. These
-- columns are a derived projection of it, populated by
-- scripts/database/backfill-pricing.js using the deterministic parser in
-- lib/pricing.ts (no LLM — 257k rows, and the text parses with rules; the
-- parser passes 12/12 hand-written expectations including yearly->monthly
-- normalization and price ranges).
--
-- Everything is normalized to MONTHLY USD so rows quoting different billing
-- periods are comparable.
-- ============================================================================

ALTER TABLE ai_tools
  ADD COLUMN IF NOT EXISTS pricing_model text,
  ADD COLUMN IF NOT EXISTS price_monthly_min_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS price_monthly_max_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS has_free_tier boolean,
  ADD COLUMN IF NOT EXISTS has_free_trial boolean;

COMMENT ON COLUMN ai_tools.pricing_model IS
  'Derived from pricing text by lib/pricing.ts: free | freemium | trial | paid | usage | custom | unknown';
COMMENT ON COLUMN ai_tools.price_monthly_min_usd IS
  'Cheapest paid tier normalized to USD/month (yearly quotes divided by 12). NULL when unpriced. 0 for free-only tools.';
COMMENT ON COLUMN ai_tools.price_monthly_max_usd IS
  'Most expensive paid tier normalized to USD/month.';
COMMENT ON COLUMN ai_tools.has_free_tier IS
  'A permanently free option exists. Distinct from has_free_trial.';
COMMENT ON COLUMN ai_tools.has_free_trial IS
  'A time-limited free trial exists. Kept separate from has_free_tier because the distinction drives budget recommendations.';

-- Supports "cheapest first" ordering and price-range filters. Partial: rows
-- with no derivable price are excluded rather than bloating the index, since
-- every query using it filters on a price being present.
CREATE INDEX IF NOT EXISTS idx_ai_tools_price_monthly_min
  ON ai_tools (price_monthly_min_usd)
  WHERE price_monthly_min_usd IS NOT NULL;

-- Supports faceted filtering ("free tools in category X").
CREATE INDEX IF NOT EXISTS idx_ai_tools_pricing_model
  ON ai_tools (pricing_model)
  WHERE pricing_model IS NOT NULL;

-- WORKLIST index for the backfill's resume mode.
--
-- The two indexes above are both `WHERE pricing_model IS NOT NULL`, which is
-- the opposite of what a resuming backfill needs: it looks for rows still
-- unclassified. Without this index, `WHERE pricing_model IS NULL ORDER BY id`
-- has to walk the primary key past ~240k already-done rows to accumulate one
-- page of work, and times out before returning anything.
--
-- This index only ever contains the rows still to do, so it starts small and
-- shrinks to empty as the backfill completes — at which point it costs
-- essentially nothing to keep. Safe to DROP once every row is classified:
--   DROP INDEX IF EXISTS idx_ai_tools_pricing_unclassified;
CREATE INDEX IF NOT EXISTS idx_ai_tools_pricing_unclassified
  ON ai_tools (id)
  WHERE pricing_model IS NULL;

-- ============================================================================
-- Bulk partial-column update for the backfill.
--
-- Supabase's .upsert() CANNOT do this. It generates
-- `INSERT ... ON CONFLICT (id) DO UPDATE`, and the INSERT half must satisfy
-- every NOT NULL column — so a payload carrying only the derived pricing
-- columns fails with `null value in column "name" violates not-null
-- constraint` before ON CONFLICT is ever reached. (Learned the hard way: the
-- first backfill run failed on every batch for exactly this reason.)
--
-- A real UPDATE ... FROM against an unnested JSON array does the whole batch
-- in one statement with correct update semantics, touching only these columns.
-- ============================================================================

-- IMPLEMENTATION NOTE: this loops single-row UPDATEs rather than doing one
-- set-based `UPDATE ... FROM jsonb_to_recordset(...)` join. The join version
-- was written first and TIMED OUT on every batch.
--
-- Reason: jsonb_to_recordset is a function scan, so the planner has no
-- statistics for it and falls back to a generic row estimate. With a few
-- hundred rows on one side and 257k on the other it costed a hash join —
-- meaning a full scan of ai_tools *per batch*, ~500 times over.
--
-- A loop of `WHERE id = <literal>` updates is guaranteed to use the primary
-- key index, and because the whole loop runs inside one function call there is
-- still only ONE network round trip per batch. Slightly more per-statement
-- overhead server-side, but predictable instead of pathological.
CREATE OR REPLACE FUNCTION bulk_update_tool_pricing(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  rec record;
  affected integer := 0;
BEGIN
  FOR rec IN
    SELECT * FROM jsonb_to_recordset(payload) AS src(
      id                    text,
      pricing_model         text,
      price_monthly_min_usd numeric,
      price_monthly_max_usd numeric,
      has_free_tier         boolean,
      has_free_trial        boolean
    )
  LOOP
    UPDATE ai_tools
    SET
      pricing_model         = rec.pricing_model,
      price_monthly_min_usd = rec.price_monthly_min_usd,
      price_monthly_max_usd = rec.price_monthly_max_usd,
      has_free_tier         = rec.has_free_tier,
      has_free_trial        = rec.has_free_trial
    WHERE id = rec.id;

    IF FOUND THEN
      affected := affected + 1;
    END IF;
  END LOOP;

  RETURN affected;
END;
$$;

ANALYZE ai_tools;
