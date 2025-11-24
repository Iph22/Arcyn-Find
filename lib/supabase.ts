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
  }
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
