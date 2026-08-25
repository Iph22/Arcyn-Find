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
 * Fetch tools from ProductHunt via RSS feeds
 */
async function fetchFromProductHunt() {
  console.log('\n📦 Fetching from ProductHunt...\n')
  const tools = []

  const feeds = [
    { url: 'https://www.producthunt.com/feed?category=ai', topic: 'ai' },
    { url: 'https://www.producthunt.com/feed?category=developer-tools', topic: 'developer-tools' },
    { url: 'https://www.producthunt.com/feed?category=productivity', topic: 'productivity' },
  ]

  for (const feed of feeds) {
    try {
      await delay(3000)
      console.log(`  📡 Fetching RSS: ${feed.topic}...`)

      const response = await rateLimitedFetch(feed.url)
      if (!response || !response.ok) {
        console.log(`    ⚠️  RSS feed ${feed.topic} not available (${response?.status || 'no response'})`)
        continue
      }

      const xml = await response.text()

      // Parse RSS items
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi
      let match
      let count = 0
      while ((match = itemRegex.exec(xml)) !== null && count < 30) {
        const itemXml = match[1]
        const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/i)
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i)
        const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>|<description>([\s\S]*?)<\/description>/i)

        const title = (titleMatch?.[1] || titleMatch?.[2] || '').trim()
        const link = (linkMatch?.[1] || '').trim()
        const desc = (descMatch?.[1] || descMatch?.[2] || '').replace(/<[^>]*>/g, '').trim()

        if (!title || title.length < 3) continue

        // Check if AI-related
        const text = `${title} ${desc}`.toLowerCase()
        const aiKeywords = ['ai', 'artificial intelligence', 'machine learning', 'gpt', 'llm', 'chatbot', 'generative', 'neural', 'automation', 'nlp']
        const isAIRelated = feed.topic === 'ai' || aiKeywords.some(kw => text.includes(kw))
        if (!isAIRelated) continue

        tools.push({
          name: title.substring(0, 100),
          description: cleanDescription(desc || `AI tool: ${title}`, 200),
          platform: link,
          category: mapCategory(feed.topic),
          tags: extractTags(desc, feed.topic, title),
          accessType: 'Freemium',
          pricing: 'Check website',
          region: 'Global',
          popularity: 60,
          isTrending: false,
          source: 'producthunt',
        })
        count++
      }

      console.log(`    ✓ Found ${count} AI tools from ${feed.topic}`)
    } catch (error) {
      console.log(`    ⚠️  Error fetching ${feed.topic}: ${error.message}`)
    }
  }

  console.log(`\n✅ Found ${tools.length} tools from Product Hunt`)
  return tools
}

/**
 * Fetch tools from There's An AI For That (TAAFT)
 */
async function fetchFromTheresAnAIForThat() {
  console.log('\n📦 Fetching from There\'s An AI For That...\n')
  const tools = []
  const seenNames = new Set()

  const pages = [
    { url: 'https://theresanaiforthat.com/', label: 'homepage' },
    { url: 'https://theresanaiforthat.com/trending/', label: 'trending' },
    { url: 'https://theresanaiforthat.com/popular/', label: 'popular' },
  ]

  // Load cheerio dynamically (it's already a dependency)
  let cheerio
  try {
    cheerio = require('cheerio')
  } catch {
    console.log('  ⚠️  cheerio not available, skipping TAAFT scraping')
    return []
  }

  for (const page of pages) {
    try {
      await delay(4000)
      console.log(`  🔍 Scraping TAAFT ${page.label}...`)

      const response = await rateLimitedFetch(page.url)
      if (!response || !response.ok) {
        console.log(`    ⚠️  Could not reach TAAFT ${page.label} (${response?.status || 'no response'})`)
        continue
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // Find all links to individual AI tool pages (/ai/<slug>/)
      $('a[href*="/ai/"]').each((index, element) => {
        const href = $(element).attr('href') || ''
        const slugMatch = href.match(/\/ai\/([a-z0-9-]+)\/?$/i)
        if (!slugMatch) return

        const slug = slugMatch[1]
        if (['submit', 'login', 'register', 'settings', 'search'].includes(slug)) return

        const name = $(element).text().trim()
        if (!name || name.length < 2 || name.length > 100) return
        if (/^(v?\d|open|share|save|visit|close|login|sign)/i.test(name)) return

        const nameLower = name.toLowerCase().trim()
        if (seenNames.has(nameLower)) return
        seenNames.add(nameLower)

        // Find task category and tagline from parent
        const $parent = $(element).closest('li, article, div')
        let tagline = ''
        let task = ''

        if ($parent.length) {
          const $taskLink = $parent.find('a[href*="/task/"]').first()
          if ($taskLink.length) task = $taskLink.text().trim()

          $parent.find('p, span, div').each((_, el) => {
            const t = $(el).text().trim()
            if (t.length > 15 && t.length < 200 && !t.includes('Released') && !t.includes('Share') && t !== name) {
              if (!tagline) tagline = t
            }
          })
        }

        tools.push({
          name: name.substring(0, 100),
          description: cleanDescription(tagline || `${name} — AI tool for ${task || 'various tasks'}`, 200),
          platform: `https://theresanaiforthat.com/ai/${slug}/`,
          category: task ? mapCategory(task.toLowerCase()) : 'Generative AI',
          tags: ['taaft', ...(task ? [task.toLowerCase().replace(/\s+/g, '-')] : [])],
          accessType: 'Freemium',
          pricing: 'Check website',
          region: 'Global',
          popularity: page.label === 'trending' ? 75 : page.label === 'popular' ? 70 : 60,
          isTrending: page.label === 'trending',
          source: 'taaft',
        })
      })

      console.log(`    ✓ TAAFT ${page.label}: ${tools.length} tools total`)
    } catch (error) {
      console.error(`    ❌ TAAFT ${page.label}:`, error.message)
    }
  }

  console.log(`\n✅ Found ${tools.length} tools from TAAFT`)
  return tools
}

/**
 * Fetch tools from Futurepedia
 */
async function fetchFromFuturepedia() {
  console.log('\n📦 Fetching from Futurepedia...\n')
  const tools = []
  const seenNames = new Set()

  let cheerio
  try {
    cheerio = require('cheerio')
  } catch {
    console.log('  ⚠️  cheerio not available, skipping Futurepedia scraping')
    return []
  }

  const categories = [
    { url: 'https://www.futurepedia.io/ai-tools/ai-agents', category: 'Autonomous AI' },
    { url: 'https://www.futurepedia.io/ai-tools/code-assistant', category: 'Code Generation' },
    { url: 'https://www.futurepedia.io/ai-tools/chatbots', category: 'ChatBots' },
    { url: 'https://www.futurepedia.io/ai-tools/image-generators', category: 'Image Generation' },
    { url: 'https://www.futurepedia.io/ai-tools/video-generators', category: 'Video Generation' },
    { url: 'https://www.futurepedia.io/ai-tools/writing-generators', category: 'Text Generation' },
    { url: 'https://www.futurepedia.io/ai-tools/marketing', category: 'Marketing' },
    { url: 'https://www.futurepedia.io/ai-tools/personal-assistant', category: 'Productivity' },
    { url: 'https://www.futurepedia.io/ai-tools/music-generator', category: 'Audio/NLP' },
    { url: 'https://www.futurepedia.io/ai-tools/text-to-speech', category: 'Audio/NLP' },
    { url: 'https://www.futurepedia.io/ai-tools/no-code', category: 'Code Generation' },
    { url: 'https://www.futurepedia.io/ai-tools/workflows', category: 'Autonomous AI' },
    { url: 'https://www.futurepedia.io/ai-tools/social-media', category: 'Marketing' },
    { url: 'https://www.futurepedia.io/ai-tools/customer-support', category: 'ChatBots' },
  ]

  for (const cat of categories) {
    // Scrape first 2 pages per category
    for (let page = 1; page <= 2; page++) {
      try {
        const pageUrl = page === 1 ? cat.url : `${cat.url}?page=${page}`
        await delay(3000)
        console.log(`  🔍 Futurepedia ${cat.category} p${page}...`)

        const response = await rateLimitedFetch(pageUrl)
        if (!response || !response.ok) break

        const html = await response.text()
        const $ = cheerio.load(html)

        let toolsOnPage = 0

        // Find links to /tool/<slug> pages
        $('a[href*="/tool/"]').each((index, element) => {
          const href = $(element).attr('href') || ''
          const slugMatch = href.match(/\/tool\/([a-z0-9-]+)\/?$/i)
          if (!slugMatch) return

          const name = $(element).text().trim()
          if (!name || name.length < 2 || name.length > 80) return
          if (/^(visit|rated|show|view|sign|log|about|contact)/i.test(name)) return

          const nameLower = name.toLowerCase().trim()
          if (seenNames.has(nameLower)) return
          seenNames.add(nameLower)

          // Get description from parent
          const $parent = $(element).closest('div, article, li').first()
          let description = ''
          let visitUrl = ''

          if ($parent.length) {
            $parent.find('p, span, div').each((_, el) => {
              const t = $(el).text().trim()
              if (t.length > 20 && t.length < 300 && t !== name && !t.includes('Rated') && !t.includes('Visit')) {
                if (!description) description = t
              }
            })

            // Get actual tool URL
            $parent.find('a[href*="utm_source=futurepedia"]').each((_, el) => {
              const visitHref = $(el).attr('href')
              if (visitHref && visitHref.startsWith('http')) {
                visitUrl = visitHref.split('?')[0]
              }
            })
          }

          tools.push({
            name: name.substring(0, 100),
            description: cleanDescription(description || `${name} — AI ${cat.category.toLowerCase()} tool`, 200),
            platform: visitUrl || `https://www.futurepedia.io/tool/${slugMatch[1]}`,
            category: cat.category,
            tags: ['futurepedia', cat.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')],
            accessType: 'Freemium',
            pricing: 'Check website',
            region: 'Global',
            popularity: 60,
            isTrending: page === 1 && index < 5,
            source: 'futurepedia',
          })
          toolsOnPage++
        })

        if (toolsOnPage === 0) break // No tools found, stop pagination
        console.log(`    ✓ ${toolsOnPage} tools found`)
      } catch (error) {
        console.error(`    ❌ Futurepedia ${cat.category}:`, error.message)
        break
      }
    }
  }

  console.log(`\n✅ Found ${tools.length} tools from Futurepedia`)
  return tools
}

/**
 * Fetch tools from AI Tools Directory (various sources)
 */
async function fetchFromAIToolsDirectories() {
  console.log('\n📦 Fetching from AI Tools Directories...\n')
  const tools = []

  let cheerio
  try {
    cheerio = require('cheerio')
  } catch {
    console.log('  ⚠️  cheerio not available, skipping directory scraping')
    return []
  }

  const directories = [
    { name: 'AI Tools Club', url: 'https://www.aitoolsclub.com/' },
  ]

  for (const dir of directories) {
    try {
      await delay(4000)
      console.log(`  📂 Scraping ${dir.name}...`)

      const response = await rateLimitedFetch(dir.url)
      if (!response || !response.ok) {
        console.log(`    ⚠️  Could not fetch ${dir.name} (${response?.status || 'no response'})`)
        continue
      }

      const html = await response.text()
      const $ = cheerio.load(html)
      const seenNames = new Set()

      // Generic extraction: look for card/article structures
      $('article, [class*="card"], [class*="tool"], [class*="item"]').each((index, element) => {
        const $el = $(element)
        let name = $el.find('h2, h3, h4, strong, b').first().text().trim()
        if (!name) name = $el.find('a').first().text().trim()
        if (!name || name.length < 2 || name.length > 80) return
        if (/^(read|view|more|sign|log|about|home)/i.test(name)) return

        const nameLower = name.toLowerCase().trim()
        if (seenNames.has(nameLower)) return
        seenNames.add(nameLower)

        let desc = ''
        $el.find('p, [class*="desc"]').each((_, el) => {
          const t = $(el).text().trim()
          if (t.length > 15 && t.length < 300 && t !== name && !desc) desc = t
        })

        const link = $el.find('a').first().attr('href') || ''
        const fullUrl = link.startsWith('http') ? link : `${dir.url}${link.replace(/^\//, '')}`

        tools.push({
          name: name.substring(0, 100),
          description: cleanDescription(desc || `AI tool: ${name}`, 200),
          platform: fullUrl,
          category: 'Generative AI',
          tags: [dir.name.toLowerCase().replace(/\s+/g, '-')],
          accessType: 'Free',
          pricing: 'Check website',
          region: 'Global',
          popularity: 50,
          isTrending: false,
          source: dir.name.toLowerCase().replace(/\s+/g, '-'),
        })
      })

      console.log(`    ✓ Found ${tools.length} tools from ${dir.name}`)
    } catch (error) {
      console.error(`    ❌ ${dir.name}:`, error.message)
    }
  }

  console.log(`\n✅ Found ${tools.length} tools from AI Directories`)
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
    console.log('━'.repeat(60))
    
    // Source 1: GitHub Topics (always available)
    const githubTools = await fetchFromGitHubTopics()
    allTools.push(...githubTools)
    console.log(`\n📊 GitHub Topics: ${githubTools.length} tools`)
    
    // Source 2: Product Hunt (RSS-based, no auth required)
    console.log('\n━'.repeat(60))
    const productHuntTools = await fetchFromProductHunt()
    allTools.push(...productHuntTools)
    console.log(`📊 Product Hunt: ${productHuntTools.length} tools`)
    
    // Source 3: There's An AI For That
    console.log('\n━'.repeat(60))
    const taaftTools = await fetchFromTheresAnAIForThat()
    allTools.push(...taaftTools)
    console.log(`📊 TAAFT: ${taaftTools.length} tools`)
    
    // Source 4: Futurepedia
    console.log('\n━'.repeat(60))
    const futurepediaTools = await fetchFromFuturepedia()
    allTools.push(...futurepediaTools)
    console.log(`📊 Futurepedia: ${futurepediaTools.length} tools`)
    
    // Source 5: AI directories
    console.log('\n━'.repeat(60))
    const directoryTools = await fetchFromAIToolsDirectories()
    allTools.push(...directoryTools)
    console.log(`📊 AI Directories: ${directoryTools.length} tools`)
    
    console.log('\n━'.repeat(60))
    
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

