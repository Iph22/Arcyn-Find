import { createClient } from '@supabase/supabase-js'
import type { AIEntry } from './ai-data'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://otrtjqomyukafgnyylij.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90cnRqcW9teXVrYWZnbnl5bGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjAyODksImV4cCI6MjA3MTk5NjI4OX0.RN5EOwFIf10jC3ffvF3KDeqZDms7KlEVpfkD5rBHW6A'

// Client-side Supabase client (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side Supabase client (uses service role key for admin operations)
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90cnRqcW9teXVrYWZnbnl5bGlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQyMDI4OSwiZXhwIjoyMDcxOTk2Mjg5fQ.7HbYt7VN2n_suJ2koccrjc282306D2lDsWFuJq2KQYA'
  return createClient(supabaseUrl, serviceRoleKey)
}

// Transform database row to AIEntry
export function transformToAIEntry(row: any): AIEntry {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description || '',
    platform: row.platform,
    region: row.region,
    accessType: row.access_type,
    pricing: row.pricing || '',
    tags: row.tags || [],
    popularity: row.popularity || 50,
    lastUpdated: row.last_updated || new Date().toISOString().split('T')[0],
    isTrending: row.is_trending || false,
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
  }
}

