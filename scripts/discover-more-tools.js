#!/usr/bin/env node

/**
 * Script to discover more AI tools from multiple sources
 * Sources: GitHub Topics, ProductHunt, AlternativeTo, AI tool directories
 */

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')
// Helper functions (since transformer.ts is TypeScript)
function mapCategory(externalCategory) {
  const normalized = externalCategory.toLowerCase().trim()
  const categoryMap = {
    'text-generation': 'Text Generation',
    'code-generation': 'Code Generation',
    'code generation': 'Code Generation',
    'ide': 'IDE',
    'ides': 'IDE',
    'development-environment': 'IDE',
    'image-generation': 'Image Generation',
    'generative-ai': 'Generative AI',
    'ai-writing': 'Text Generation',
    'chatbot': 'ChatBots',
    'chat-bots': 'ChatBots',
  }
  return categoryMap[normalized] || 'Generative AI'
}

function determineAccessType(pricing, tags) {
  if (!pricing && !tags) return 'Free'
  const text = `${pricing || ''} ${(tags || []).join(' ')}`.toLowerCase()
  if (text.includes('free') && (text.includes('paid') || text.includes('premium') || text.includes('pro'))) {
    return 'Freemium'
  }
  if (text.includes('paid') || text.includes('premium') || text.includes('pro') || text.includes('subscription')) {
    return 'Paid'
  }
  return 'Free'
}

function determineRegion(url, tags) {
  if (!url && !tags) return 'Global'
  const text = `${url || ''} ${(tags || []).join(' ')}`.toLowerCase()
  if (text.includes('.uk') || text.includes('europe') || text.includes('eu')) return 'EU'
  if (text.includes('.ca')) return 'Canada'
  if (text.includes('.cn') || text.includes('china')) return 'China'
  if (text.includes('.ae') || text.includes('uae')) return 'UAE'
  if (text.includes('.il') || text.includes('israel')) return 'Israel'
  if (text.includes('.us') || text.includes('usa') || text.includes('united states')) return 'USA'
  return 'Global'
}

function generateId(name, source, index) {
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
  const sourcePrefix = (source || 'discovery').substring(0, 10).toLowerCase().replace(/[^a-z0-9]/g, '-')
  const suffix = index !== undefined ? `-${index}` : ''
  return `${sourcePrefix}-${cleanName}${suffix}`
}

function extractTags(description, category, name) {
  const tags = []
  const text = `${description || ''} ${category || ''} ${name || ''}`.toLowerCase()
  const commonTags = [
    'ai', 'artificial-intelligence', 'machine-learning', 'ml', 'deep-learning',
    'nlp', 'computer-vision', 'generative-ai', 'llm', 'chatbot', 'automation'
  ]
  for (const tag of commonTags) {
    if (text.includes(tag)) tags.push(tag)
  }
  if (category) tags.push(category.toLowerCase().replace(/\s+/g, '-'))
  return [...new Set(tags)].slice(0, 5)
}

function cleanDescription(description, maxLength = 500) {
  return description
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength)
    .replace(/\s+\S*$/, '')
    + (description.length > maxLength ? '...' : '')
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// Rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const rateLimit = {
  lastRequest: 0,
  minDelay: 1000, // 1 second between requests
}

async function rateLimitedFetch(url, options = {}) {
  const now = Date.now()
  const timeSinceLastRequest = now - rateLimit.lastRequest
  if (timeSinceLastRequest < rateLimit.minDelay) {
    await delay(rateLimit.minDelay - timeSinceLastRequest)
  }
  rateLimit.lastRequest = Date.now()
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI Tool Discovery Bot/1.0)',
        ...options.headers,
      },
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Fetch tools from GitHub Topics
 */
async function fetchFromGitHubTopics() {
  console.log('\n📦 Fetching from GitHub Topics...\n')
  const tools = []
  
  const topics = [
    'ai-tools',
    'artificial-intelligence',
    'machine-learning',
    'deep-learning',
    'nlp',
    'computer-vision',
    'generative-ai',
    'ai-assistant',
    'ai-powered',
    'chatbot',
    'code-assistant',
    'ai-productivity',
    'ai-development',
  ]
  
  for (const topic of topics) {
    try {
      console.log(`  Searching topic: ${topic}...`)
      const url = `https://api.github.com/search/repositories?q=topic:${topic}+stars:>50&sort=stars&order=desc&per_page=100`
      const response = await rateLimitedFetch(url)
      
      if (!response.ok) {
        console.log(`    ⚠️  Rate limited or error for ${topic}`)
        await delay(5000) // Wait 5 seconds on rate limit
        continue
      }
      
      const data = await response.json()
      const repos = data.items || []
      
      for (const repo of repos) {
        // Only include repos that are likely AI tools (not libraries/frameworks)
        if (repo.description && 
            (repo.description.toLowerCase().includes('tool') ||
             repo.description.toLowerCase().includes('app') ||
             repo.description.toLowerCase().includes('platform') ||
             repo.description.toLowerCase().includes('ai') ||
             repo.description.toLowerCase().includes('assistant'))) {
          
          const tool = {
            name: repo.name,
            description: cleanDescription(repo.description || 'AI tool', 200),
            platform: repo.html_url,
            category: mapCategory(topic),
            tags: extractTags(repo.description, topic, repo.name),
            accessType: 'Free', // GitHub repos are typically free
            pricing: 'Free',
            region: determineRegion(repo.html_url),
            popularity: Math.min(100, Math.max(30, Math.floor(Math.log10(repo.stargazers_count + 1) * 15))),
            isTrending: repo.stargazers_count > 1000,
            source: 'github',
          }
          tools.push(tool)
        }
      }
      
      console.log(`    ✓ Found ${repos.length} repositories`)
      await delay(2000) // Wait between topics
    } catch (error) {
      console.error(`    ❌ Error fetching ${topic}:`, error.message)
    }
  }
  
  console.log(`\n✅ Found ${tools.length} tools from GitHub Topics`)
  return tools
}

/**
 * Fetch tools from AlternativeTo (via web scraping simulation)
 * Note: AlternativeTo doesn't have a public API, so we'll use a curated list
 */
async function fetchFromAlternativeTo() {
  console.log('\n📦 Fetching from AlternativeTo (curated list)...\n')
  
  // Curated list of AI tool categories on AlternativeTo
  const aiCategories = [
    { name: 'ChatGPT Alternatives', url: 'https://alternativeto.net/software/chatgpt/' },
    { name: 'Midjourney Alternatives', url: 'https://alternativeto.net/software/midjourney/' },
    { name: 'GitHub Copilot Alternatives', url: 'https://alternativeto.net/software/github-copilot/' },
  ]
  
  // Since we can't easily scrape, we'll return an empty array
  // In production, you might use a scraping service or manual curation
  console.log('  ⚠️  AlternativeTo requires web scraping (not implemented)')
  console.log('  💡 Consider using a scraping service or manual curation for AlternativeTo')
  
  return []
}

/**
 * Fetch tools from ProductHunt
 */
async function fetchFromProductHunt() {
  console.log('\n📦 Fetching from ProductHunt...\n')
  const tools = []
  
  // ProductHunt doesn't have a free public API anymore
  // We can use RSS feeds or manual curation
  console.log('  ⚠️  ProductHunt API requires authentication')
  console.log('  💡 Consider using ProductHunt RSS feeds or manual curation')
  
  // Example: You could fetch from ProductHunt RSS feeds
  try {
    const rssUrl = 'https://www.producthunt.com/feed?category=artificial-intelligence'
    console.log('  📡 Attempting to fetch from RSS feed...')
    // RSS parsing would require additional libraries
    // For now, we'll skip this source
  } catch (error) {
    console.log('  ⚠️  RSS feed not available')
  }
  
  return []
}

/**
 * Fetch tools from There's An AI For That
 */
async function fetchFromTheresAnAIForThat() {
  console.log('\n📦 Fetching from There\'s An AI For That...\n')
  const tools = []
  
  try {
    // There's An AI For That API endpoint (if available)
    // This is a placeholder - actual implementation would require API access
    console.log('  ⚠️  API endpoint not publicly documented')
    console.log('  💡 Consider manual curation from https://theresanaiforthat.com')
  } catch (error) {
    console.error('  ❌ Error:', error.message)
  }
  
  return tools
}

/**
 * Fetch tools from Futurepedia
 */
async function fetchFromFuturepedia() {
  console.log('\n📦 Fetching from Futurepedia...\n')
  const tools = []
  
  try {
    // Futurepedia might have an API or allow scraping
    console.log('  ⚠️  API endpoint not publicly documented')
    console.log('  💡 Consider manual curation from https://www.futurepedia.io')
  } catch (error) {
    console.error('  ❌ Error:', error.message)
  }
  
  return tools
}

/**
 * Fetch tools from AI Tools Directory (various sources)
 */
async function fetchFromAIToolsDirectories() {
  console.log('\n📦 Fetching from AI Tools Directories...\n')
  const tools = []
  
  // List of AI tool directories (some might have APIs)
  const directories = [
    { name: 'AI Tools List', url: 'https://aitoolslist.com' },
    { name: 'AI Tools Club', url: 'https://aitoolsclub.com' },
  ]
  
  for (const dir of directories) {
    console.log(`  📂 Checking ${dir.name}...`)
    // Most directories don't have public APIs
    // Would require web scraping or manual curation
    console.log(`    ⚠️  No API available for ${dir.name}`)
  }
  
  return tools
}

/**
 * Check if tool already exists in database
 */
async function checkExistingTools(toolNames, toolPlatforms) {
  const { data: existingTools } = await supabase
    .from('ai_tools')
    .select('name, platform')
    .in('name', toolNames.length > 0 ? toolNames : [''])
    .limit(10000)
  
  const existingNames = new Set((existingTools || []).map(t => t.name.toLowerCase().trim()))
  const existingPlatforms = new Set((existingTools || []).map(t => t.platform.toLowerCase().trim()))
  
  return { existingNames, existingPlatforms }
}

/**
 * Process and deduplicate tools
 */
async function processTools(allTools) {
  console.log('\n🔄 Processing and deduplicating tools...\n')
  
  // Get existing tools
  const toolNames = allTools.map(t => t.name)
  const { existingNames, existingPlatforms } = await checkExistingTools(toolNames, [])
  
  // Deduplicate and filter
  const uniqueTools = []
  const seen = new Set()
  
  for (const tool of allTools) {
    const nameKey = tool.name.toLowerCase().trim()
    const platformKey = tool.platform.toLowerCase().trim()
    const combinedKey = `${nameKey}::${platformKey}`
    
    // Skip if already seen in this batch
    if (seen.has(combinedKey)) continue
    
    // Skip if already exists in database
    if (existingNames.has(nameKey) || existingPlatforms.has(platformKey)) {
      continue
    }
    
    seen.add(combinedKey)
    uniqueTools.push(tool)
  }
  
  console.log(`✅ Processed ${allTools.length} tools, ${uniqueTools.length} are new`)
  return uniqueTools
}

/**
 * Add tools to Supabase
 */
async function addToolsToSupabase(tools) {
  if (tools.length === 0) {
    console.log('\n✅ No new tools to add!')
    return { inserted: 0, errors: 0 }
  }
  
  console.log(`\n📤 Adding ${tools.length} tools to Supabase...\n`)
  
  // Transform to database format
  const dbTools = tools.map((tool, index) => {
    const toolId = generateId(tool.name, tool.source || 'discovery', index)
    return {
      id: toolId,
      name: tool.name,
      category: tool.category,
      description: tool.description || '',
      platform: tool.platform,
      region: tool.region || determineRegion(tool.platform),
      access_type: tool.accessType || 'Free',
      pricing: tool.pricing || 'Free',
      tags: tool.tags || [],
      popularity: tool.popularity || 50,
      last_updated: new Date().toISOString().split('T')[0],
      is_trending: tool.isTrending || false,
      image: null, // Images will be fetched separately
    }
  })
  
  // Insert in batches
  const batchSize = 50
  let totalInserted = 0
  let totalErrors = 0
  
  for (let i = 0; i < dbTools.length; i += batchSize) {
    const batch = dbTools.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(dbTools.length / batchSize)
    
    console.log(`  📦 Inserting batch ${batchNum}/${totalBatches} (${batch.length} tools)...`)
    
    try {
      const { data, error } = await supabase
        .from('ai_tools')
        .upsert(batch, { onConflict: 'id' })
        .select()
      
      if (error) {
        console.error(`    ❌ Error:`, error.message)
        totalErrors += batch.length
      } else {
        totalInserted += data?.length || 0
        console.log(`    ✅ Inserted ${data?.length || 0} tools`)
      }
    } catch (error) {
      console.error(`    ❌ Exception:`, error.message)
      totalErrors += batch.length
    }
    
    // Delay between batches
    if (i + batchSize < dbTools.length) {
      await delay(1000)
    }
  }
  
  console.log(`\n✅ Insertion complete: ${totalInserted} inserted, ${totalErrors} errors`)
  return { inserted: totalInserted, errors: totalErrors }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting AI Tool Discovery...\n')
  console.log('📡 This script will search multiple sources for AI tools\n')
  
  const allTools = []
  
  try {
    // Fetch from all sources
    const githubTools = await fetchFromGitHubTopics()
    allTools.push(...githubTools)
    
    // Add more sources as they become available
    // const alternativeToTools = await fetchFromAlternativeTo()
    // allTools.push(...alternativeToTools)
    
    // const productHuntTools = await fetchFromProductHunt()
    // allTools.push(...productHuntTools)
    
    // Process and deduplicate
    const uniqueTools = await processTools(allTools)
    
    if (uniqueTools.length === 0) {
      console.log('\n✅ No new tools found from discovery sources')
      return
    }
    
    // Show summary
    console.log('\n📊 Discovery Summary:')
    console.log(`  Total tools discovered: ${allTools.length}`)
    console.log(`  New tools to add: ${uniqueTools.length}`)
    console.log(`  Duplicates/existing: ${allTools.length - uniqueTools.length}`)
    
    // Add to Supabase
    const result = await addToolsToSupabase(uniqueTools)
    
    console.log('\n🎉 Discovery complete!')
    console.log(`\n📈 Results:`)
    console.log(`  ✅ Successfully added: ${result.inserted} tools`)
    console.log(`  ❌ Errors: ${result.errors} tools`)
    console.log(`\n💡 Next steps:`)
    console.log(`  1. Run: npm run fetch:logos (to fetch images for new tools)`)
    console.log(`  2. Review the new tools in your database`)
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

module.exports = {
  fetchFromGitHubTopics,
  fetchFromAlternativeTo,
  fetchFromProductHunt,
  processTools,
  addToolsToSupabase,
}

