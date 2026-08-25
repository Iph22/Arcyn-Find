#!/usr/bin/env node

/**
 * Script to verify new models are in the database
 */

import { getSupabaseAdmin } from '../../lib/supabase'

async function verifyNewModels() {
  console.log('🔍 Verifying new models in database...\n')
  
  const supabase = getSupabaseAdmin()
  const modelsToCheck = ['Gemini 3', 'Antigravity', 'Gemini Agent', 'GPT-5', 'Claude 4', 'Gemini 2.5']
  
  for (const modelName of modelsToCheck) {
    const { data, error } = await supabase
      .from('ai_tools')
      .select('id, name, category, description, platform, is_trending, last_updated')
      .ilike('name', `%${modelName}%`)
      .limit(1)
    
    if (error) {
      console.error(`   ❌ Error checking ${modelName}:`, error.message)
    } else if (data && data.length > 0) {
      const model = data[0]
      console.log(`   ✓ Found: ${model.name}`)
      console.log(`     Category: ${model.category}`)
      console.log(`     Platform: ${model.platform}`)
      console.log(`     Trending: ${model.is_trending}`)
      console.log(`     Last Updated: ${model.last_updated}`)
      console.log(`     Description: ${model.description?.substring(0, 100)}...`)
      console.log('')
    } else {
      console.log(`   ⚠️  Not found: ${modelName}`)
    }
  }
  
  // Get total count
  const { count } = await supabase
    .from('ai_tools')
    .select('*', { count: 'exact', head: true })
  
  console.log(`\n📊 Total tools in database: ${count}`)
  console.log('\n✅ Verification complete!')
}

if (require.main === module) {
  verifyNewModels()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n❌ Error:', error)
      process.exit(1)
    })
}

export { verifyNewModels }

