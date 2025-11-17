#!/usr/bin/env ts-node

/**
 * Script to add missing AI tools (like NotebookLM) and fetch new tools from OpenTools.ai
 * Then sync everything to Supabase
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://otrtjqomyukafgnyylij.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90cnRqcW9teXVrYWZnbnl5bGlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQyMDI4OSwiZXhwIjoyMDcxOTk2Mjg5fQ.7HbYt7VN2n_suJ2koccrjc282306D2lDsWFuJq2KQYA'

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey)
}

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

// NotebookLM entry
const notebookLM: AIEntry = {
  id: 'notebooklm-google',
  name: 'NotebookLM',
  category: 'Generative AI',
  description: 'NotebookLM is an AI-powered notebook from Google that helps you learn faster by creating study guides, summaries, and insights from your notes and documents. It can answer questions about your sources and help you understand complex topics.',
  platform: 'https://notebooklm.google/',
  region: 'Global',
  accessType: 'Free',
  pricing: 'Free',
  tags: ['AI notebook', 'study tool', 'document analysis', 'note-taking', 'Google', 'learning', 'education', 'summarization', 'research'],
  popularity: 85,
  lastUpdated: new Date().toISOString().split('T')[0],
  isTrending: true,
}

// Other potentially missing popular tools
const additionalTools: AIEntry[] = [
  {
    id: 'claude-anthropic',
    name: 'Claude',
    category: 'Generative AI',
    description: 'Claude is Anthropic\'s AI assistant, designed to be helpful, harmless, and honest. It excels at analysis, writing, coding, and conversation.',
    platform: 'https://claude.ai/',
    region: 'Global',
    accessType: 'Freemium',
    pricing: 'Free, Pro plans available',
    tags: ['AI assistant', 'chatbot', 'Anthropic', 'conversational AI', 'writing', 'analysis'],
    popularity: 95,
    lastUpdated: new Date().toISOString().split('T')[0],
    isTrending: true,
  },
  {
    id: 'perplexity-ai',
    name: 'Perplexity AI',
    category: 'Search/QA',
    description: 'Perplexity AI is an AI-powered search engine that provides accurate answers with sources. It combines the power of large language models with real-time web search.',
    platform: 'https://www.perplexity.ai/',
    region: 'Global',
    accessType: 'Freemium',
    pricing: 'Free, Pro plans available',
    tags: ['AI search', 'question answering', 'research', 'information retrieval', 'web search'],
    popularity: 90,
    lastUpdated: new Date().toISOString().split('T')[0],
    isTrending: true,
  },
]

async function addToolsToJSON() {
  console.log('📖 Reading existing JSON data...')
  const jsonPath = join(process.cwd(), 'public', 'ai-data.json')
  const data: AIEntry[] = JSON.parse(readFileSync(jsonPath, 'utf-8'))
  console.log(`✅ Found ${data.length} existing tools\n`)

  // Check which tools are missing
  const existingIds = new Set(data.map(t => t.id.toLowerCase()))
  const existingNames = new Set(data.map(t => t.name.toLowerCase()))

  const toolsToAdd: AIEntry[] = []

  // Check NotebookLM
  if (!existingIds.has('notebooklm-google') && !existingNames.has('notebooklm')) {
    toolsToAdd.push(notebookLM)
    console.log('✅ Will add NotebookLM')
  } else {
    console.log('ℹ️  NotebookLM already exists')
  }

  // Check other tools
  for (const tool of additionalTools) {
    if (!existingIds.has(tool.id.toLowerCase()) && !existingNames.has(tool.name.toLowerCase())) {
      toolsToAdd.push(tool)
      console.log(`✅ Will add ${tool.name}`)
    } else {
      console.log(`ℹ️  ${tool.name} already exists`)
    }
  }

  if (toolsToAdd.length === 0) {
    console.log('\n✅ All tools already exist in JSON!')
    return data
  }

  // Add new tools
  const updatedData = [...data, ...toolsToAdd]
  writeFileSync(jsonPath, JSON.stringify(updatedData, null, 2), 'utf-8')
  console.log(`\n✅ Added ${toolsToAdd.length} new tools to JSON`)
  console.log(`📊 Total tools now: ${updatedData.length}\n`)

  return updatedData
}

async function fetchNewToolsFromOpenTools() {
  console.log('🌐 Fetching new tools from OpenTools.ai...\n')
  
  const OPENTOOLS_API = 'https://opentools.ai/api/tools'
  const jsonPath = join(process.cwd(), 'public', 'ai-data.json')
  const existingData: AIEntry[] = JSON.parse(readFileSync(jsonPath, 'utf-8'))
  const existingNames = new Set(existingData.map(t => t.name.toLowerCase().trim()))
  
  let offset = 0
  const limit = 100
  let hasMore = true
  const newTools: any[] = []
  let totalFetched = 0

  while (hasMore && totalFetched < 1000) { // Limit to prevent infinite loops
    try {
      const url = `${OPENTOOLS_API}?offset=${offset}&limit=${limit}`
      console.log(`Fetching page ${Math.floor(offset / limit) + 1} (offset: ${offset})...`)
      
      const response = await fetch(url)
      if (!response.ok) {
        console.error(`Error fetching: ${response.status}`)
        break
      }

      const result = await response.json()
      const tools = result.tools || []

      if (tools.length === 0) {
        hasMore = false
        break
      }

      // Filter for new tools
      for (const tool of tools) {
        if (!tool.tool_name || tool.archived || !tool.published || tool.nsfw) {
          continue
        }

        const normalizedName = tool.tool_name.toLowerCase().trim()
        if (!existingNames.has(normalizedName)) {
          newTools.push(tool)
          existingNames.add(normalizedName)
        }
      }

      totalFetched += tools.length
      offset += limit

      // Check if we've reached the end
      if (tools.length < limit) {
        hasMore = false
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error) {
      console.error('Error fetching from OpenTools:', error)
      break
    }
  }

  if (newTools.length === 0) {
    console.log('✅ No new tools found from OpenTools.ai\n')
    return existingData
  }

  console.log(`\n✅ Found ${newTools.length} new tools from OpenTools.ai`)

  // Convert to our format
  const categoryMapping: Record<string, string> = {
    'Music Video Generator': 'Video Generation',
    'Deep Fake Nude Generator': 'Computer Vision',
    'Nude Generator': 'Computer Vision',
    'Summarization': 'Learning & Education',
    'Document Interaction': 'Learning & Education',
    'Data Analytics': 'ML Infrastructure',
    'Image Generation': 'Computer Vision',
    'Video Generation': 'Video Generation',
    'Audio/NLP': 'Audio/NLP',
    'Code Generation': 'Code Generation',
    'Generative AI': 'Generative AI',
    'Search/QA': 'Search/QA',
    'Computer Vision': 'Computer Vision',
    'NLP Platform': 'NLP Platform',
    'ML Infrastructure': 'ML Infrastructure',
    'Autonomous AI': 'Autonomous AI',
    'Multimodal Platform': 'Multimodal Platform',
    'Audio/Video Processing': 'Audio/Video Processing',
    'Learning & Education': 'Learning & Education',
  }

  const convertedTools: AIEntry[] = newTools.map((tool, index) => {
    const category = categoryMapping[tool.category] || 'Generative AI'
    const accessType = tool.pricing_plans?.some((p: any) => p.price === 0) 
      ? (tool.pricing_plans.some((p: any) => p.price > 0) ? 'Freemium' : 'Free')
      : 'Paid'
    
    const pricing = tool.pricing_plans?.length > 0
      ? tool.pricing_plans.map((p: any) => p.price === 0 ? 'Free' : `$${p.price}`).join(', ')
      : 'Contact for pricing'

    let popularity = 50
    if (tool.favouriteCount) {
      popularity = Math.min(100, Math.max(50, Math.floor(Math.log10(tool.favouriteCount + 1) * 15)))
    }
    if (tool.average_rating) {
      popularity = Math.min(100, popularity + (tool.average_rating - 3) * 10)
    }

    const tags: string[] = (tool.tags || [])
      .slice(0, 10)
      .map((t: any) => String(t))
      .filter((t: string) => t.length > 0)
    
    return {
      id: `ot-${tool.id}`,
      name: tool.tool_name.trim(),
      category,
      description: (tool.summary || tool.description || tool.headline || 'AI tool').substring(0, 200),
      platform: tool.tool_url || `https://opentools.ai/tools/${tool.slug}`,
      region: 'Global',
      accessType: accessType as 'Free' | 'Freemium' | 'Paid',
      pricing,
      tags: [...new Set(tags)],
      popularity: Math.round(popularity),
      lastUpdated: new Date().toISOString().split('T')[0],
      isTrending: tool.featured_default || false,
    } as AIEntry
  })

  // Add to existing data
  const updatedData = [...existingData, ...convertedTools]
  writeFileSync(jsonPath, JSON.stringify(updatedData, null, 2), 'utf-8')
  console.log(`✅ Added ${convertedTools.length} new tools to JSON`)
  console.log(`📊 Total tools now: ${updatedData.length}\n`)

  return updatedData
}

async function syncToSupabase(data: AIEntry[]) {
  console.log('🔄 Syncing to Supabase...\n')
  
  const supabase = getSupabaseAdmin()
  
  // Transform to database format
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

  console.log(`📦 Preparing to upsert ${tools.length} tools...\n`)

  // Upsert in batches of 1000
  const batchSize = 1000
  let totalUpserted = 0

  for (let i = 0; i < tools.length; i += batchSize) {
    const batch = tools.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(tools.length / batchSize)

    console.log(`📤 Upserting batch ${batchNum}/${totalBatches} (${batch.length} tools)...`)

    const { error } = await supabase
      .from('ai_tools')
      .upsert(batch, { onConflict: 'id' })

    if (error) {
      console.error(`❌ Error upserting batch ${batchNum}:`, error.message)
      throw error
    }

    totalUpserted += batch.length
    console.log(`✅ Batch ${batchNum} complete (${totalUpserted}/${tools.length} tools)\n`)
  }

  // Verify count
  const { count, error: countError } = await supabase
    .from('ai_tools')
    .select('*', { count: 'exact', head: true })

  if (!countError && count !== null) {
    console.log(`📊 Total tools in database: ${count}`)
  }

  console.log('\n🎉 Sync complete!')
}

async function main() {
  try {
    console.log('🚀 Starting tool sync process...\n')

    // Step 1: Add missing tools (NotebookLM, etc.)
    let data = await addToolsToJSON()

    // Step 2: Fetch new tools from OpenTools.ai
    data = await fetchNewToolsFromOpenTools()

    // Step 3: Sync everything to Supabase
    await syncToSupabase(data)

    console.log('\n✅ All done!')
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

main()

