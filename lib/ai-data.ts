export interface AIEntry {
  id: string
  /**
   * The public URL segment, when this tool has a page of its own.
   *
   * NULL below the publish floor and for anything ingested since the last slug
   * backfill. Use toolHref() rather than reading it directly -- /tools/<id>
   * still resolves, so a missing slug is a redirect, not a dead link.
   */
  slug?: string | null
  name: string
  category: string
  description: string
  platform: string
  region: string
  accessType: "Free" | "Freemium" | "Paid"
  /** Human-readable pricing text — authoritative for display. */
  pricing: string
  tags: string[]
  popularity: number
  lastUpdated: string
  isTrending?: boolean
  image?: string | null

  // Structured pricing, derived from `pricing` by lib/pricing.ts and stored in
  // dedicated columns (see supabase/migrations/add_structured_pricing.sql).
  // Optional because ~1.4% of rows are still unclassified and because older
  // callers construct AIEntry objects without them.
  pricingModel?: "free" | "freemium" | "trial" | "paid" | "usage" | "custom" | "unknown" | null
  /** Cheapest paid tier in USD/month. 0 for free tools, null when unpriced. */
  priceMonthlyMinUsd?: number | null
  priceMonthlyMaxUsd?: number | null
  hasFreeTier?: boolean | null
  /** Time-limited trial — deliberately distinct from hasFreeTier. */
  hasFreeTrial?: boolean | null
}

/*
 * The 6,231-entry `aiEntries` array that used to live here was removed on
 * 2026-09-28. It was 4.1 MB of seed data from before the catalogue moved to
 * Supabase, and nothing read it.
 *
 * Verified before deleting, because "nothing uses it" is easy to get wrong:
 *
 *   - Every import of this module is `import type { AIEntry }`. The two that
 *     write `import { AIEntry }` still import only the interface.
 *   - The `aiEntries` identifiers in app/api/ai-models/route.ts are a LOCAL
 *     variable of the same name, not this export.
 *   - No dynamic `import()` or `require()` of this module exists anywhere.
 *   - The only real consumer was scripts/reports/convert-to-json.js, which
 *     parses this file as TEXT with indexOf rather than importing it. That
 *     script reported on seed data that the database superseded.
 *
 * The live catalogue is 15,371 rows in Supabase, read through
 * lib/seo/catalog.ts and lib/supabase.ts. If you need the old seed, it is in
 * git history at the commit that removed it.
 *
 * Why it mattered: Vercel deployment storage had exceeded its 10 GB limit
 * across 83 deployments, and this file was the largest source artefact in the
 * repository by an order of magnitude.
 */
