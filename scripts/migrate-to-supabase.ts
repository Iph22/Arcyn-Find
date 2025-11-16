import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = 'https://otrtjqomyukafgnyylij.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90cnRqcW9teXVrYWZnbnl5bGlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQyMDI4OSwiZXhwIjoyMDcxOTk2Mjg5fQ.7HbYt7VN2n_suJ2koccrjc282306D2lDsWFuJq2KQYA'

const supabase = createClient(supabaseUrl, supabaseKey)

interface AIEntry {
  id: string
  name: string
  category: string
  description: string
  platform: string
  region: string
  accessType: 'Free' | 'Freemium' | 'Paid'
  pricing: string
  tags: string[]
  popularity: number
  lastUpdated: string
  isTrending?: boolean
}

async function migrate() {
  console.log('🚀 Starting migration to Supabase...\n')
  
  try {
    // Load JSON data
    const jsonPath = join(process.cwd(), 'public', 'ai-data.json')
    console.log(`📖 Reading data from ${jsonPath}...`)
    const data: AIEntry[] = JSON.parse(readFileSync(jsonPath, 'utf-8'))
    console.log(`✅ Loaded ${data.length} entries from JSON\n`)
    
    // Transform to match database schema
    const tools = data.map((entry) => ({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      description: entry.description || '',
      platform: entry.platform,
      region: entry.region,
      access_type: entry.accessType,
      pricing: entry.pricing || '',
      tags: entry.tags || [],
      popularity: entry.popularity || 50,
      last_updated: entry.lastUpdated || new Date().toISOString().split('T')[0],
      is_trending: entry.isTrending || false,
    }))
    
    console.log(`📦 Preparing to insert ${tools.length} tools...\n`)
    
    // Insert in batches of 1000
    const batchSize = 1000
    let totalInserted = 0
    
    for (let i = 0; i < tools.length; i += batchSize) {
      const batch = tools.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(tools.length / batchSize)
      
      console.log(`📤 Inserting batch ${batchNum}/${totalBatches} (${batch.length} tools)...`)
      
      const { data: inserted, error } = await supabase
        .from('ai_tools')
        .upsert(batch, { onConflict: 'id' })
        .select()
      
      if (error) {
        console.error(`❌ Error inserting batch ${batchNum}:`, error.message)
        throw error
      }
      
      totalInserted += batch.length
      console.log(`✅ Batch ${batchNum} complete (${totalInserted}/${tools.length} tools inserted)\n`)
    }
    
    console.log(`\n🎉 Migration complete!`)
    console.log(`✅ Successfully migrated ${totalInserted} tools to Supabase`)
    
    // Verify count
    const { count, error: countError } = await supabase
      .from('ai_tools')
      .select('*', { count: 'exact', head: true })
    
    if (!countError && count !== null) {
      console.log(`📊 Total tools in database: ${count}`)
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

migrate()

