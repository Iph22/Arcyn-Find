/**
 * The tool profile: the shape Ask Arcyn reasons over.
 *
 * Mirrors supabase/migrations/add_tool_profile_fields.sql. Two naming choices
 * differ from the database on purpose:
 *
 *   websiteUrl  <- ai_tools.platform
 *   logoUrl     <- ai_tools.image
 *
 * The columns keep their historical names because search, the ingest and the
 * SEO layer all read them; adding synonyms in SQL would give every consumer
 * two places to look. The clearer names exist only here, at the boundary.
 *
 * EVERY GENERATED FIELD IS OPTIONAL, AND THAT IS LOAD-BEARING.
 *
 * There are 15,210 distinct products (measured 2026-09-21). `longDescription`,
 * `bestFor`, `limitations`, `learningCurve` and `freeTierDetails` do not exist
 * in the scraped data — they have to be generated, which is metered and paid.
 * So at any moment most rows will not have them. Code that renders or ranks
 * must degrade when they are absent rather than assume a backfill finished.
 */

/** How much prior knowledge a tool assumes. */
export type LearningCurve = 'beginner' | 'intermediate' | 'advanced'

/**
 * Whether the tool still exists.
 *
 * `unknown` is the default and the honest state for anything never checked —
 * which is currently almost everything. Do not display "active" for `unknown`.
 */
export type ToolStatus = 'active' | 'dead' | 'unknown'

/** Pricing shape, derived from the scraped pricing text by lib/pricing.ts. */
export type PricingModel =
  | 'free'
  | 'freemium'
  | 'trial'
  | 'paid'
  | 'usage'
  | 'custom'
  | 'unknown'

export interface ToolProfile {
  id: string
  /** Public URL segment. Null until the row earns a public page. */
  slug: string | null
  name: string

  /**
   * Curated one-or-two-sentence summary, or null.
   *
   * Prefer this over `description`. The raw `description` is scraped and
   * hard-capped at exactly 200 characters, cut mid-word — 946 of 1000 sampled
   * rows are exactly 200 chars long.
   */
  shortDescription: string | null
  /** Multi-paragraph profile, or null when not yet generated. */
  longDescription: string | null
  /** The raw scraped blurb. Always present; usually truncated mid-word. */
  description: string

  /** The tool's own site. Stored as `platform`. */
  websiteUrl: string | null
  /** Stored as `image`. */
  logoUrl: string | null

  /** Single primary category. ~2% of rows contradict their own (§1). */
  category: string
  /** Multi-label successor to `category`. Empty until backfilled. */
  categories: string[]
  tags: string[]

  /**
   * Concrete use cases, phrased the way someone describes a problem.
   * This is what problem-shaped queries should match against.
   */
  bestFor: string[]
  /**
   * What the tool is bad at. Empty means "not yet assessed", NOT
   * "no limitations" — the difference matters when stating trade-offs.
   */
  limitations: string[]
  learningCurve: LearningCurve | null

  pricingModel: PricingModel | null
  /** Human-readable pricing text. Authoritative for display. */
  pricing: string | null
  /** Cheapest paid tier, USD/month. Annual plans are stored monthly (§1). */
  priceMonthlyMinUsd: number | null
  priceMonthlyMaxUsd: number | null
  hasFreeTier: boolean | null
  hasFreeTrial: boolean | null
  /** What the free tier actually includes. A boolean cannot say "5/month". */
  freeTierDetails: string | null

  status: ToolStatus
  /**
   * When the site last responded. Null = never checked.
   * Not `lastUpdated`, which is the ingest timestamp and is bulk-written.
   */
  lastVerifiedAt: string | null
  /** Ingest timestamp. Says nothing about whether the tool still exists. */
  lastUpdated: string | null

  /** Hand-picked alternatives. Empty = fall back to the computed list. */
  alternatives: string[]

  popularity: number
  createdAt: string | null
  updatedAt: string | null
}

/** Columns to select for a full profile. Never `*` — that pulls `embedding`. */
export const TOOL_PROFILE_COLUMNS = [
  'id',
  'slug',
  'name',
  'short_description',
  'long_description',
  'description',
  'platform',
  'image',
  'category',
  'categories',
  'tags',
  'best_for',
  'limitations',
  'learning_curve',
  'pricing_model',
  'pricing',
  'price_monthly_min_usd',
  'price_monthly_max_usd',
  'has_free_tier',
  'has_free_trial',
  'free_tier_details',
  'status',
  'last_verified_at',
  'last_updated',
  'alternatives',
  'popularity',
  'created_at',
  'updated_at',
].join(', ')

type Row = Record<string, unknown>

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

/** PostgREST returns numeric columns as strings to preserve precision (§2). */
const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

const LEARNING_CURVES: readonly string[] = ['beginner', 'intermediate', 'advanced']
const STATUSES: readonly string[] = ['active', 'dead', 'unknown']

/** Map a database row to a ToolProfile. The only place this shape is built. */
export function toToolProfile(row: Row): ToolProfile {
  const curve = String(row.learning_curve ?? '')
  const status = String(row.status ?? 'unknown')

  return {
    id: String(row.id ?? ''),
    slug: str(row.slug),
    name: String(row.name ?? ''),

    shortDescription: str(row.short_description),
    longDescription: str(row.long_description),
    description: String(row.description ?? ''),

    websiteUrl: str(row.platform),
    logoUrl: str(row.image),

    category: String(row.category ?? ''),
    categories: arr(row.categories),
    tags: arr(row.tags),

    bestFor: arr(row.best_for),
    limitations: arr(row.limitations),
    learningCurve: LEARNING_CURVES.includes(curve) ? (curve as LearningCurve) : null,

    pricingModel: (str(row.pricing_model) as PricingModel) ?? null,
    pricing: str(row.pricing),
    priceMonthlyMinUsd: num(row.price_monthly_min_usd),
    priceMonthlyMaxUsd: num(row.price_monthly_max_usd),
    hasFreeTier: typeof row.has_free_tier === 'boolean' ? row.has_free_tier : null,
    hasFreeTrial: typeof row.has_free_trial === 'boolean' ? row.has_free_trial : null,
    freeTierDetails: str(row.free_tier_details),

    // Unrecognised values collapse to 'unknown' rather than being asserted.
    status: STATUSES.includes(status) ? (status as ToolStatus) : 'unknown',
    lastVerifiedAt: str(row.last_verified_at),
    lastUpdated: str(row.last_updated),

    alternatives: arr(row.alternatives),

    popularity: num(row.popularity) ?? 0,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

/** The best description available, preferring curated over scraped. */
export function bestDescription(tool: ToolProfile): string {
  return tool.shortDescription ?? tool.description
}

/**
 * Whether a profile is complete enough for Ask Arcyn to reason about it
 * properly — i.e. it can state what the tool is for and where it falls short.
 */
export function hasRichProfile(tool: ToolProfile): boolean {
  return (
    tool.bestFor.length > 0 &&
    tool.longDescription !== null &&
    tool.learningCurve !== null
  )
}
