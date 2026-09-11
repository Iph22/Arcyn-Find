-- ============================================================================
-- Rebuild the IVFFlat embedding index after the embedding backfill.
--
-- WHY: IVFFlat is a clustering index. It computes `lists` centroids ONCE, from
-- the vectors present at build time, and thereafter assigns new vectors to the
-- nearest existing centroid. This index was built when embedding coverage was
-- about 11% of the most-viewed rows (measured 221/2000), so its centroids
-- describe a small and non-representative sample of the corpus. Every vector
-- added by scripts/database/backfill-embeddings.js has been filed against those
-- stale centroids.
--
-- The consequence is silent: queries still work and still return results, but
-- probes visit lists whose centroids no longer reflect where the data sits, so
-- genuinely-near neighbours get missed. That is a recall problem, and recall
-- loss in the vector tier is invisible from the outside — you get a plausible
-- answer that simply is not the best one.
--
-- REINDEX recomputes the centroids over the current data.
--
-- WHEN TO RUN: after a substantial backfill, not after every few hundred rows.
-- Rebuilding is proportional to the number of indexed vectors.
--
-- COST: REINDEX takes an ACCESS EXCLUSIVE lock, so vector search blocks for the
-- duration. On a table this size that is disruptive but brief. If that is not
-- acceptable, the CONCURRENTLY form below avoids the lock at the cost of extra
-- disk and a slower rebuild.
-- ============================================================================

-- Preferred when a short stall is acceptable:
REINDEX INDEX ai_tools_embedding_idx;

-- Non-blocking alternative — run this INSTEAD of the line above if vector
-- search must stay available throughout. Cannot run inside a transaction block.
--
--   REINDEX INDEX CONCURRENTLY ai_tools_embedding_idx;

-- Refresh statistics so the planner costs the rebuilt index against current
-- data rather than the distribution it saw at 11% coverage.
ANALYZE ai_tools;

-- ============================================================================
-- WORTH REVISITING, not done here: the `lists` parameter itself.
--
-- pgvector's guidance is roughly rows/1000 lists for tables up to ~1M rows,
-- which for ~260k rows suggests ~260. Whatever this index was created with was
-- chosen for the row count at the time. Changing it requires DROP + CREATE
-- rather than REINDEX, and it should be driven by a recall measurement rather
-- than by the rule of thumb — so it is deliberately left alone until the
-- backfill is far enough along that measuring recall is meaningful.
-- ============================================================================
