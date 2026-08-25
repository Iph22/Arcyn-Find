#!/usr/bin/env node

/**
 * Script to add known new AI models to the database
 * Specifically targets newer models like Gemini 3, GPT-5, Claude 4, etc.
 */

import { getSupabaseAdmin, transformToDBRow } from '../../lib/supabase'
import type { AIEntry } from '../../lib/ai-data'
import { generateId, normalizePopularity } from '../utils/transformer'

/**
 * Known new models to add
 */
const NEW_MODELS: AIEntry[] = [
  {
    id: generateId('Gemini 3', 'google'),
    name: 'Gemini 3',
    category: 'Generative AI',
    description: 'Google\'s latest and most advanced multimodal AI model, launched November 18, 2025. Features significant improvements in coding, reasoning, and multimodal understanding. Integrated into Google Search, Gemini app, and powers the new Antigravity development platform. Available through Vertex AI and Gemini Enterprise for enterprise customers.',
    platform: 'https://gemini.google.com',
    region: 'USA',
    accessType: 'Freemium',
    pricing: 'Free tier + $20/month Pro, Enterprise pricing available',
    tags: ['language-model', 'multimodal', 'generative', 'coding', 'reasoning', 'gemini', 'google'],
    popularity: normalizePopularity(98),
    lastUpdated: '2025-11-18',
    isTrending: true
  },
  {
    id: generateId('Antigravity', 'google'),
    name: 'Antigravity',
    category: 'ML Infrastructure',
    description: 'Google\'s new AI-powered development platform where AI agents can autonomously handle software tasks. Built on Gemini 3, designed for enterprise customers to streamline development workflows.',
    platform: 'https://cloud.google.com/antigravity',
    region: 'USA',
    accessType: 'Paid',
    pricing: 'Enterprise pricing',
    tags: ['development-platform', 'ai-agents', 'automation', 'enterprise', 'google', 'gemini'],
    popularity: normalizePopularity(85),
    lastUpdated: '2025-11-18',
    isTrending: true
  },
  {
    id: generateId('Gemini Agent', 'google'),
    name: 'Gemini Agent',
    category: 'Autonomous AI',
    description: 'Advanced AI agent powered by Gemini 3 that can execute complex tasks such as managing emails and booking travel. Part of Google\'s new agentic AI capabilities.',
    platform: 'https://gemini.google.com',
    region: 'USA',
    accessType: 'Freemium',
    pricing: 'Free tier + Pro subscription',
    tags: ['ai-agent', 'autonomous', 'task-automation', 'gemini', 'google'],
    popularity: normalizePopularity(90),
    lastUpdated: '2025-11-18',
    isTrending: true
  },
  {
    id: generateId('GPT-5', 'openai'),
    name: 'GPT-5',
    category: 'Generative AI',
    description: 'OpenAI\'s next-generation language model (rumored/upcoming). Expected to feature significant improvements in reasoning, coding, and multimodal capabilities.',
    platform: 'https://openai.com',
    region: 'USA',
    accessType: 'Paid',
    pricing: 'TBA',
    tags: ['language-model', 'generative', 'openai', 'gpt', 'upcoming'],
    popularity: normalizePopularity(95),
    lastUpdated: new Date().toISOString().split('T')[0],
    isTrending: true
  },
  {
    id: generateId('Claude 4', 'anthropic'),
    name: 'Claude 4',
    category: 'Generative AI',
    description: 'Anthropic\'s next-generation AI model (rumored/upcoming). Expected successor to Claude 3.5 with enhanced capabilities.',
    platform: 'https://www.anthropic.com',
    region: 'USA',
    accessType: 'Paid',
    pricing: 'TBA',
    tags: ['language-model', 'generative', 'anthropic', 'claude', 'upcoming'],
    popularity: normalizePopularity(92),
    lastUpdated: new Date().toISOString().split('T')[0],
    isTrending: true
  },
  {
    id: generateId('Gemini 2.5', 'google'),
    name: 'Gemini 2.5',
    category: 'Generative AI',
    description: 'Google\'s Gemini 2.5 model with enhanced capabilities. Powers tools like Nano Banana for image editing.',
    platform: 'https://gemini.google.com',
    region: 'USA',
    accessType: 'Freemium',
    pricing: 'Free tier + paid options',
    tags: ['language-model', 'multimodal', 'generative', 'gemini', 'google'],
    popularity: normalizePopularity(88),
    lastUpdated: new Date().toISOString().split('T')[0],
    isTrending: false
  }
]

/**
 * Add new models to Supabase
 */
async function addNewModels() {
  console.log('🚀 Adding new AI models to database...\n')
  console.log('='.repeat(60))
  
  const supabase = getSupabaseAdmin()
  let totalInserted = 0
  let totalUpdated = 0
  let totalErrors = 0
  
  // Get existing tools to check for duplicates
  const { data: existingTools } = await supabase
    .from('ai_tools')
    .select('id, name, platform')
    .limit(10000)
  
  const existingMap = new Map<string, { id: string; name: string }>()
  existingTools?.forEach(tool => {
    const key = tool.name.toLowerCase().trim()
    existingMap.set(key, { id: tool.id, name: tool.name })
  })
  
  // Process each model
  for (const model of NEW_MODELS) {
    try {
      const existing = existingMap.get(model.name.toLowerCase().trim())
      const dbRow = transformToDBRow(model)
      
      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('ai_tools')
          .update(dbRow)
          .eq('id', existing.id)
          .select()
        
        if (error) {
          console.error(`   ❌ Error updating ${model.name}:`, error.message)
          totalErrors++
        } else {
          console.log(`   ✓ Updated: ${model.name}`)
          totalUpdated++
        }
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('ai_tools')
          .insert(dbRow)
          .select()
        
        if (error) {
          console.error(`   ❌ Error inserting ${model.name}:`, error.message)
          totalErrors++
        } else {
          console.log(`   ✓ Inserted: ${model.name}`)
          totalInserted++
        }
      }
      
      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error: any) {
      console.error(`   ❌ Exception for ${model.name}:`, error.message)
      totalErrors++
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log(`\n📈 Summary:`)
  console.log(`   ✓ Inserted: ${totalInserted}`)
  console.log(`   ✓ Updated: ${totalUpdated}`)
  if (totalErrors > 0) {
    console.log(`   ⚠️  Errors: ${totalErrors}`)
  }
  console.log('\n✅ Done!')
}

// Run if executed directly
if (require.main === module) {
  addNewModels()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error)
      process.exit(1)
    })
}

export { addNewModels, NEW_MODELS }

