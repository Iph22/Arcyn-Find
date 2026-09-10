import { createClient } from '@supabase/supabase-js'
import type { AIEntry } from './ai-data'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Client-side Supabase client (uses anon key)
// Use placeholder during build if env vars are missing (they'll be set at runtime)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key')

// Server-side Supabase client (uses service role key for admin operations)
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    // During Next.js build phase, return placeholder to allow build to complete
    // The build process evaluates modules but doesn't actually call APIs
    // At runtime, APIs will handle missing env vars gracefully
    const isBuildPhase = 
      process.env.NEXT_PHASE === 'phase-production-build' ||
      process.env.NEXT_PHASE === 'phase-export' ||
      (process.env.npm_lifecycle_event === 'build')
    
    if (isBuildPhase) {
      // Return placeholder during build - build will complete successfully
      return createClient('https://placeholder.supabase.co', 'placeholder-key')
    }
    
    // At runtime, throw error so developers know env vars are missing
    // APIs should catch and handle this gracefully
    throw new Error(
      'Missing required Supabase environment variables for admin operations. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    )
  }
  
  return createClient(supabaseUrl, serviceRoleKey)
}

// Explicit column list for ai_tools reads. `embedding` is a 768-dim pgvector
// column and `fts_vector` a tsvector — both are large, neither is used by any
// consumer of AIEntry/transformToAIEntry, so `select('*')` was pulling several
// KB of unused data over the wire on every list/filter/detail request.
export const AI_TOOLS_COLUMNS =
  'id, name, category, description, platform, region, access_type, pricing, tags, popularity, last_updated, is_trending, image, priority, pricing_model, price_monthly_min_usd, price_monthly_max_usd, has_free_tier, has_free_trial'

// Transform database row to AIEntry
export function transformToAIEntry(row: {
  id: string
  name: string
  category: string
  description?: string | null
  platform: string
  region: string
  access_type: string
  pricing?: string | null
  tags?: string[] | null
  popularity?: number | null
  last_updated?: string | null
  is_trending?: boolean | null
  image?: string | null
  pricing_model?: string | null
  price_monthly_min_usd?: number | string | null
  price_monthly_max_usd?: number | string | null
  has_free_tier?: boolean | null
  has_free_trial?: boolean | null
}): AIEntry {
  // Validate and cast accessType to the expected union type
  const validAccessTypes = ['Free', 'Freemium', 'Paid'] as const
  const accessType = validAccessTypes.includes(row.access_type as typeof validAccessTypes[number])
    ? (row.access_type as 'Free' | 'Freemium' | 'Paid')
    : 'Free' // Default to 'Free' if invalid
  
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description || '',
    platform: row.platform,
    region: row.region,
    accessType,
    pricing: row.pricing || '',
    tags: row.tags || [],
    popularity: row.popularity || 50,
    lastUpdated: row.last_updated || new Date().toISOString().split('T')[0],
    isTrending: row.is_trending || false,
    image: row.image || null,

    // Structured pricing. numeric(10,2) comes back from PostgREST as a STRING,
    // so coerce rather than passing it through — otherwise downstream numeric
    // comparisons silently become string comparisons ("9" > "100").
    pricingModel: (row.pricing_model as AIEntry['pricingModel']) ?? null,
    priceMonthlyMinUsd: toNumberOrNull(row.price_monthly_min_usd),
    priceMonthlyMaxUsd: toNumberOrNull(row.price_monthly_max_usd),
    hasFreeTier: row.has_free_tier ?? null,
    hasFreeTrial: row.has_free_trial ?? null,
  }
}

/** PostgREST returns numeric columns as strings to preserve precision. */
function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : null
}

// Transform AIEntry to database row
export function transformToDBRow(entry: AIEntry) {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    description: entry.description,
    platform: entry.platform,
    region: entry.region,
    access_type: entry.accessType,
    pricing: entry.pricing,
    tags: entry.tags || [],
    popularity: entry.popularity || 50,
    last_updated: entry.lastUpdated,
    is_trending: entry.isTrending || false,
    image: entry.image || null,
  }
}
