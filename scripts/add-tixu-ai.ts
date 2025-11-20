#!/usr/bin/env node

/**
 * Script to add Tixu.ai to the database
 */

import { getSupabaseAdmin, transformToDBRow } from '../lib/supabase'
import type { AIEntry } from '../lib/ai-data'
import { generateId, normalizePopularity } from './utils/transformer'

const TIXU_AI: AIEntry = {
  id: generateId('Tixu.ai', 'tixu'),
  name: 'Tixu.ai',
  category: 'Learning & Education',
  description: 'Tixu.ai offers comprehensive AI learning resources, including courses on ChatGPT, prompt engineering, and other AI tools. Perfect for anyone looking to master AI technologies and improve their prompt engineering skills.',
  platform: 'https://tixu.ai',
  region: 'Global',
  accessType: 'Freemium',
  pricing: 'Free courses available, premium options',
  tags: ['ai-learning', 'chatgpt', 'prompt-engineering', 'education', 'courses', 'tutorials', 'ai-tools'],
  popularity: normalizePopularity(65),
  lastUpdated: new Date().toISOString().split('T')[0],
  isTrending: false
}

async function addTixuAI() {
  console.log('🚀 Adding Tixu.ai to database...\n')
  
  const supabase = getSupabaseAdmin()
  
  try {
    // Check if already exists
    const { data: existing } = await supabase
      .from('ai_tools')
      .select('id, name')
      .ilike('name', '%tixu%')
      .limit(1)
    
    const dbRow = transformToDBRow(TIXU_AI)
    
    if (existing && existing.length > 0) {
      // Update existing
      const { data, error } = await supabase
        .from('ai_tools')
        .update(dbRow)
        .eq('id', existing[0].id)
        .select()
      
      if (error) {
        console.error('   ❌ Error updating Tixu.ai:', error.message)
        process.exit(1)
      } else {
        console.log('   ✓ Updated: Tixu.ai')
      }
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('ai_tools')
        .insert(dbRow)
        .select()
      
      if (error) {
        console.error('   ❌ Error inserting Tixu.ai:', error.message)
        process.exit(1)
      } else {
        console.log('   ✓ Inserted: Tixu.ai')
      }
    }
    
    console.log('\n✅ Done!')
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  addTixuAI()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n❌ Error:', error)
      process.exit(1)
    })
}

export { addTixuAI, TIXU_AI }

