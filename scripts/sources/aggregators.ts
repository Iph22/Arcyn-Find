/**
 * Phase 2: Aggregator Sources
 * Fetches AI tools from major aggregator directories:
 *   - There's An AI For That (TAAFT) — scrapes tool listings
 *   - Futurepedia — scrapes categorized tool pages
 *   - Toolify.ai — scrapes ranked tool listings
 */

import * as cheerio from 'cheerio'
import type { AIEntry } from '../../lib/ai-data'
import { mapCategory, determineAccessType, determineRegion, generateId, extractTags, cleanDescription, normalizePopularity } from '../utils/transformer'
import { rateLimiter } from '../utils/rate-limiter'

/**
 * Safe fetch with retry logic and rotating User-Agent
 */
async function safeFetch(url: string, retries = 3): Promise<Response | null> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  ]

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgents[i % userAgents.length],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: AbortSignal.timeout(20000), // 20 second timeout
        redirect: 'follow',
      })

      if (response.ok) {
        return response
      }

      // If we get rate limited (429) or forbidden (403), wait longer
      if (response.status === 429 || response.status === 403) {
        console.warn(`  ⚠️  Rate limited/blocked (${response.status}) for ${url}, waiting ${(i + 1) * 5}s...`)
        await new Promise(resolve => setTimeout(resolve, 5000 * (i + 1)))
        continue
      }
    } catch (error: any) {
      if (i === retries - 1) {
        console.error(`[Aggregators] Failed to fetch ${url} after ${retries} attempts:`, error.message)
        return null
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))) // Exponential backoff
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// THERE'S AN AI FOR THAT (TAAFT)
// Structure (from analysis): tool items are list items with links to /ai/<slug>/
// Each item has: tool name, tagline, task category, pricing, and a score number
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map TAAFT task names to our categories
 */
function mapTAAFTCategory(task: string): string {
  const taskLower = task.toLowerCase().trim()

  const taskMap: Record<string, string> = {
    'writing': 'Writing & Content',
    'copywriting': 'Writing & Content',
    'content creation': 'Writing & Content',
    'blog writing': 'Writing & Content',
    'seo': 'Marketing',
    'marketing': 'Marketing',
    'social media': 'Marketing',
    'advertising': 'Marketing',
    'email': 'Marketing',
    'sales': 'Sales & CRM',
    'customer support': 'ChatBots',
    'customer engagement': 'ChatBots',
    'chatbot': 'ChatBots',
    'chat': 'ChatBots',
    'image generation': 'Image Generation',
    'image editing': 'Image Generation',
    'product images': 'Image Generation',
    'design': 'Image Generation',
    'art': 'Image Generation',
    'logo': 'Image Generation',
    'video': 'Video & Audio',
    'video editing': 'Video & Audio',
    'animations': 'Video & Audio',
    'music': 'Audio & Music',
    'audio': 'Voice & Speech',
    'voice': 'Voice & Speech',
    'speech to text': 'Voice & Speech',
    'text to speech': 'Voice & Speech',
    'transcription': 'Voice & Speech',
    'code': 'Code Generation',
    'coding': 'Code Generation',
    'programming': 'Code Generation',
    'developer tools': 'Code Generation',
    'productivity': 'Productivity',
    'task automation': 'Productivity',
    'workflow': 'Productivity',
    'automation': 'Autonomous AI',
    'research': 'Research',
    'education': 'Learning & Education',
    'school': 'Learning & Education',
    'learning': 'Learning & Education',
    'data analysis': 'Data & Analytics',
    'analytics': 'Data & Analytics',
    'finance': 'Finance',
    'health': 'Healthcare',
    'travel plans': 'Productivity',
    'presentations': 'Productivity',
    'translation': 'Productivity',
    'summarization': 'Productivity',
    'religious guidance': 'Generative AI',
    'proposal evaluation': 'Productivity',
  }

  // Direct match
  if (taskMap[taskLower]) return taskMap[taskLower]

  // Partial match
  for (const [key, value] of Object.entries(taskMap)) {
    if (taskLower.includes(key) || key.includes(taskLower)) return value
  }

  return 'Generative AI'
}

/**
 * Parse TAAFT pricing string to access type
 */
function parseTAAFTPricing(pricingText: string): { accessType: 'Free' | 'Freemium' | 'Paid'; pricing: string } {
  const lower = pricingText.toLowerCase().trim()

  if (!lower || lower === 'no pricing') {
    return { accessType: 'Freemium', pricing: 'Check website' }
  }
  if (lower === '100% free' || lower === 'free') {
    return { accessType: 'Free', pricing: 'Free' }
  }
  if (lower.startsWith('free +') || lower.startsWith('free,') || lower.includes('free') && lower.includes('$')) {
    return { accessType: 'Freemium', pricing: pricingText }
  }
  if (lower.startsWith('from $') || lower.startsWith('$')) {
    return { accessType: 'Paid', pricing: pricingText }
  }

  return { accessType: 'Freemium', pricing: pricingText || 'Check website' }
}

/**
 * Fetch from There's An AI For That — scrapes the homepage and category pages
 */
async function fetchFromTheresAnAIForThat(): Promise<AIEntry[]> {
  const entries: AIEntry[] = []
  const seenNames = new Set<string>()

  // Scrape multiple pages: homepage (just-released), trending, popular
  const pages = [
    { url: 'https://theresanaiforthat.com/', label: 'homepage' },
    { url: 'https://theresanaiforthat.com/trending/', label: 'trending' },
    { url: 'https://theresanaiforthat.com/popular/', label: 'popular' },
    { url: 'https://theresanaiforthat.com/most-saved/', label: 'most-saved' },
  ]

  for (const page of pages) {
    try {
      await rateLimiter.wait('taaft', 4000)

      const response = await safeFetch(page.url)
      if (!response) {
        console.warn(`  ⚠️  Could not fetch TAAFT ${page.label}`)
        continue
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // TAAFT uses list items with links to /ai/<slug>/ format
      // Each tool has: name, tagline/description, task category, pricing
      // The structure from our analysis shows tool names in links like [ToolName](https://theresanaiforthat.com/ai/tool-slug/)
      // with taglines as nearby text and task links like [Task Name](https://theresanaiforthat.com/task/task-name/)

      // Strategy: Find all links to /ai/ pages, which are individual tool pages
      const toolLinks = $('a[href*="/ai/"]')
      const processedSlugs = new Set<string>()

      toolLinks.each((_index, element) => {
        const $link = $(element)
        const href = $link.attr('href') || ''

        // Match /ai/<slug>/ pattern but exclude generic paths
        const slugMatch = href.match(/\/ai\/([a-z0-9-]+)\/?$/i)
        if (!slugMatch) return

        const slug = slugMatch[1]
        if (processedSlugs.has(slug)) return
        if (['submit', 'login', 'register', 'settings', 'search', 'contact-us'].includes(slug)) return

        const name = $link.text().trim()
        if (!name || name.length < 2 || name.length > 100) return
        // Filter out version numbers, UI elements, and non-tool text
        if (/^(v?\d|open|share|save|visit|close|login|sign)/i.test(name)) return

        const nameLower = name.toLowerCase().trim()
        if (seenNames.has(nameLower)) return

        processedSlugs.add(slug)
        seenNames.add(nameLower)

        // Try to find the parent container for this tool to extract more info
        const $parent = $link.closest('li, article, div[class*="tool"], div[class*="item"]')
        let tagline = ''
        let task = ''
        let pricing = ''

        if ($parent.length) {
          // Look for tagline: usually the first p or descriptive text near the tool name
          const allText = $parent.text()
          // Find task links in the parent
          const $taskLink = $parent.find('a[href*="/task/"]').first()
          if ($taskLink.length) {
            task = $taskLink.text().trim()
          }

          // Find pricing text patterns
          const pricingMatch = allText.match(/(Free(?:\s*\+\s*from\s*\$[\d,.]+\/mo)?|From\s*\$[\d,.]+\/mo|100%\s*Free|\$[\d,.]+\/mo|No pricing)/i)
          if (pricingMatch) {
            pricing = pricingMatch[0]
          }

          // Get tagline — look for text that's not the tool name, task, or pricing
          $parent.find('p, span, div').each((_, el) => {
            const t = $(el).text().trim()
            if (t.length > 15 && t.length < 200 && !t.includes('Released') && !t.includes('Share') && !t.includes('Open') && t !== name) {
              if (!tagline) tagline = t
            }
          })
        }

        const category = task ? mapTAAFTCategory(task) : 'Generative AI'
        const { accessType, pricing: formattedPricing } = parseTAAFTPricing(pricing)

        entries.push({
          id: generateId(name, 'taaft', entries.length),
          name: name.substring(0, 100),
          category,
          description: cleanDescription(tagline || `${name} — AI tool for ${task || 'various tasks'}`, 300),
          platform: `https://theresanaiforthat.com/ai/${slug}/`,
          region: 'Global',
          accessType,
          pricing: formattedPricing,
          tags: ['taaft', ...(task ? [task.toLowerCase().replace(/\s+/g, '-')] : []), ...extractTags(tagline, category, name)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6),
          popularity: normalizePopularity(page.label === 'trending' ? 75 : page.label === 'popular' ? 70 : 60),
          lastUpdated: new Date().toISOString().split('T')[0],
          isTrending: page.label === 'trending',
        })
      })

      console.log(`  ✓ TAAFT ${page.label}: extracted ${entries.length} tools so far`)
    } catch (error: any) {
      console.error(`  ❌ TAAFT ${page.label} error:`, error.message)
    }
  }

  console.log(`[Aggregators] Fetched ${entries.length} tools from There's An AI For That`)
  return entries
}

// ─────────────────────────────────────────────────────────────────────────────
// FUTUREPEDIA
// Structure (from analysis): category pages list tools with:
//   - Tool name (linked to /tool/<slug>)
//   - Short description
//   - Category tags (linked to /ai-tools/<category>)
//   - Visit link (actual tool URL with utm params)
//   - Rating
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map Futurepedia categories to our standard categories
 */
function mapFuturepediaCategory(categories: string[]): string {
  const text = categories.join(' ').toLowerCase()

  if (text.includes('code') || text.includes('developer') || text.includes('sql')) return 'Code Generation'
  if (text.includes('chatbot')) return 'ChatBots'
  if (text.includes('image generator') || text.includes('design generator') || text.includes('text to image')) return 'Image Generation'
  if (text.includes('video generator') || text.includes('video editing') || text.includes('text to video')) return 'Video & Audio'
  if (text.includes('music') || text.includes('audio editing')) return 'Audio & Music'
  if (text.includes('text to speech') || text.includes('transcriber') || text.includes('speech')) return 'Voice & Speech'
  if (text.includes('writing') || text.includes('copywriting') || text.includes('paraphrasing') || text.includes('storyteller')) return 'Writing & Content'
  if (text.includes('marketing') || text.includes('social media') || text.includes('seo')) return 'Marketing'
  if (text.includes('research') || text.includes('personal assistant')) return 'Productivity'
  if (text.includes('ai agents') || text.includes('workflows') || text.includes('automation')) return 'Autonomous AI'
  if (text.includes('e-commerce') || text.includes('startup')) return 'Marketing'
  if (text.includes('customer support')) return 'ChatBots'
  if (text.includes('avatar') || text.includes('portrait') || text.includes('cartoon') || text.includes('logo')) return 'Image Generation'
  if (text.includes('3d')) return '3D & Spatial'
  if (text.includes('finance')) return 'Finance'
  if (text.includes('presentation') || text.includes('spreadsheet') || text.includes('translator')) return 'Productivity'
  if (text.includes('student') || text.includes('education')) return 'Learning & Education'

  return 'Generative AI'
}

/**
 * Fetch from Futurepedia — scrapes multiple category pages
 */
async function fetchFromFuturepedia(): Promise<AIEntry[]> {
  const entries: AIEntry[] = []
  const seenNames = new Set<string>()

  // Futurepedia category URLs to scrape (with pagination)
  const categoryPages = [
    { url: 'https://www.futurepedia.io/ai-tools/ai-agents', category: 'AI Agents' },
    { url: 'https://www.futurepedia.io/ai-tools/code-assistant', category: 'Code' },
    { url: 'https://www.futurepedia.io/ai-tools/chatbots', category: 'ChatBots' },
    { url: 'https://www.futurepedia.io/ai-tools/image-generators', category: 'Image Generation' },
    { url: 'https://www.futurepedia.io/ai-tools/video-generators', category: 'Video' },
    { url: 'https://www.futurepedia.io/ai-tools/writing-generators', category: 'Writing' },
    { url: 'https://www.futurepedia.io/ai-tools/marketing', category: 'Marketing' },
    { url: 'https://www.futurepedia.io/ai-tools/personal-assistant', category: 'Productivity' },
    { url: 'https://www.futurepedia.io/ai-tools/research-assistant', category: 'Research' },
    { url: 'https://www.futurepedia.io/ai-tools/music-generator', category: 'Music' },
    { url: 'https://www.futurepedia.io/ai-tools/text-to-speech', category: 'Voice' },
    { url: 'https://www.futurepedia.io/ai-tools/customer-support', category: 'Customer Support' },
    { url: 'https://www.futurepedia.io/ai-tools/no-code', category: 'Low-Code' },
    { url: 'https://www.futurepedia.io/ai-tools/workflows', category: 'Automation' },
    { url: 'https://www.futurepedia.io/ai-tools/social-media', category: 'Social Media' },
    { url: 'https://www.futurepedia.io/ai-tools/finance', category: 'Finance' },
    { url: 'https://www.futurepedia.io/ai-tools/3D-generator', category: '3D' },
    { url: 'https://www.futurepedia.io/ai-tools/video-editing', category: 'Video Editing' },
    { url: 'https://www.futurepedia.io/ai-tools/design-generators', category: 'Design' },
    { url: 'https://www.futurepedia.io/ai-tools/transcriber', category: 'Transcription' },
  ]

  for (const catPage of categoryPages) {
    // Scrape first 3 pages per category
    for (let page = 1; page <= 3; page++) {
      try {
        const pageUrl = page === 1 ? catPage.url : `${catPage.url}?page=${page}`
        await rateLimiter.wait('futurepedia', 3000)

        const response = await safeFetch(pageUrl)
        if (!response) {
          if (page === 1) console.warn(`  ⚠️  Could not fetch Futurepedia ${catPage.category}`)
          break
        }

        const html = await response.text()
        const $ = cheerio.load(html)

        let toolsFoundOnPage = 0

        // Futurepedia structure: links to /tool/<slug> are tool detail pages
        // Each tool listing contains: tool name, description, category tags, visit link
        $('a[href*="/tool/"]').each((_index, element) => {
          const $link = $(element)
          const href = $link.attr('href') || ''

          // Match /tool/<slug> pattern
          const slugMatch = href.match(/\/tool\/([a-z0-9-]+)\/?$/i)
          if (!slugMatch) return

          const name = $link.text().trim()
          if (!name || name.length < 2 || name.length > 80) return
          // Skip non-tool text
          if (/^(visit|rated|show|view|sign|log|about|contact)/i.test(name)) return

          const nameLower = name.toLowerCase().trim()
          if (seenNames.has(nameLower)) return
          seenNames.add(nameLower)

          // Find the parent container for more context
          const $parent = $link.closest('div, article, li, section').first()
          let description = ''
          let toolCategories: string[] = [catPage.category]
          let visitUrl = ''
          let ratingText = ''

          if ($parent.length) {
            // Look for the description — text content near the tool
            $parent.find('p, span, div').each((_, el) => {
              const t = $(el).text().trim()
              if (t.length > 20 && t.length < 300 && t !== name && !t.includes('Rated') && !t.includes('Visit')) {
                if (!description) description = t
              }
            })

            // Look for category tags (links to /ai-tools/<category>)
            $parent.find('a[href*="/ai-tools/"]').each((_, el) => {
              const catText = $(el).text().trim().replace('#', '')
              if (catText && catText.length > 1 && catText.length < 50) {
                toolCategories.push(catText)
              }
            })

            // Look for the actual visit URL (external links, typically with utm params)
            $parent.find('a[href*="utm_source=futurepedia"]').each((_, el) => {
              const visitHref = $(el).attr('href')
              if (visitHref && visitHref.startsWith('http')) {
                // Clean utm params to get the actual URL
                try {
                  const url = new URL(visitHref)
                  // Remove tracking params
                  url.searchParams.delete('utm_source')
                  url.searchParams.delete('utm_medium')
                  url.searchParams.delete('utm_campaign')
                  visitUrl = url.toString()
                } catch {
                  visitUrl = visitHref.split('?')[0]
                }
              }
            })

            // Look for rating
            const parentText = $parent.text()
            const ratingMatch = parentText.match(/Rated\s+([\d.]+)\s+out\s+of\s+5/i)
            if (ratingMatch) {
              ratingText = ratingMatch[1]
            }
          }

          const category = mapFuturepediaCategory(toolCategories)
          const rating = parseFloat(ratingText) || 0

          entries.push({
            id: generateId(name, 'futurepedia', entries.length),
            name: name.substring(0, 100),
            category,
            description: cleanDescription(description || `${name} — AI ${catPage.category.toLowerCase()} tool`, 300),
            platform: visitUrl || `https://www.futurepedia.io/tool/${slugMatch[1]}`,
            region: 'Global',
            accessType: determineAccessType(),
            pricing: 'Check website',
            tags: ['futurepedia', ...toolCategories.map(c => c.toLowerCase().replace(/[^a-z0-9]+/g, '-')), ...extractTags(description, category, name)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6),
            popularity: normalizePopularity(60 + (rating > 0 ? rating * 5 : 0)),
            lastUpdated: new Date().toISOString().split('T')[0],
            isTrending: page === 1 && _index < 5,
          })

          toolsFoundOnPage++
        })

        if (toolsFoundOnPage === 0) break // No tools on this page, stop pagination

        console.log(`    ✓ Futurepedia ${catPage.category} p${page}: ${toolsFoundOnPage} tools`)
      } catch (error: any) {
        console.error(`    ❌ Futurepedia ${catPage.category} p${page}:`, error.message)
        break
      }
    }
  }

  console.log(`[Aggregators] Fetched ${entries.length} tools from Futurepedia`)
  return entries
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLIFY.AI
// An additional aggregator source for more comprehensive coverage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch from Toolify.ai — another major AI tool directory
 */
async function fetchFromToolify(): Promise<AIEntry[]> {
  const entries: AIEntry[] = []
  const seenNames = new Set<string>()

  const pages = [
    { url: 'https://www.toolify.ai/best-ai-tools', label: 'best' },
    { url: 'https://www.toolify.ai/best-ai-tools/writing', label: 'writing' },
    { url: 'https://www.toolify.ai/best-ai-tools/image', label: 'image' },
    { url: 'https://www.toolify.ai/best-ai-tools/video', label: 'video' },
    { url: 'https://www.toolify.ai/best-ai-tools/code-it', label: 'code' },
    { url: 'https://www.toolify.ai/best-ai-tools/chatbot', label: 'chatbot' },
  ]

  for (const page of pages) {
    try {
      await rateLimiter.wait('toolify', 4000)

      const response = await safeFetch(page.url)
      if (!response) {
        console.warn(`  ⚠️  Could not fetch Toolify ${page.label}`)
        continue
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // Toolify lists tools with links to /ai-tool/<slug> detail pages
      $('a[href*="/ai-tool/"], a[href*="/best-ai-tools/"]').each((index, element) => {
        const $link = $(element)
        const href = $link.attr('href') || ''

        // Only process links to individual tool pages, not category pages
        if (!href.includes('/ai-tool/')) return

        const name = $link.text().trim()
        if (!name || name.length < 2 || name.length > 80) return
        if (/^(view|visit|show|more|sign|log|about)/i.test(name)) return

        const nameLower = name.toLowerCase().trim()
        if (seenNames.has(nameLower)) return
        seenNames.add(nameLower)

        // Get description from parent
        const $parent = $link.closest('div, li, article').first()
        let description = ''
        if ($parent.length) {
          $parent.find('p, span').each((_, el) => {
            const t = $(el).text().trim()
            if (t.length > 15 && t.length < 300 && t !== name) {
              if (!description) description = t
            }
          })
        }

        const category = mapCategory(page.label)

        entries.push({
          id: generateId(name, 'toolify', entries.length),
          name: name.substring(0, 100),
          category,
          description: cleanDescription(description || `AI ${page.label} tool: ${name}`, 300),
          platform: href.startsWith('http') ? href : `https://www.toolify.ai${href}`,
          region: 'Global',
          accessType: determineAccessType(),
          pricing: 'Check website',
          tags: ['toolify', page.label, ...extractTags(description, category, name)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
          popularity: normalizePopularity(55),
          lastUpdated: new Date().toISOString().split('T')[0],
          isTrending: false,
        })
      })

      console.log(`  ✓ Toolify ${page.label}: ${entries.length} tools total`)
    } catch (error: any) {
      console.error(`  ❌ Toolify ${page.label}:`, error.message)
    }
  }

  console.log(`[Aggregators] Fetched ${entries.length} tools from Toolify`)
  return entries
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch from all aggregators
 */
export async function fetchFromAggregators(): Promise<AIEntry[]> {
  console.log('\n🔍 Phase 2: Fetching from aggregators...\n')

  const allEntries: AIEntry[] = []

  // Run aggregators sequentially to respect rate limits
  const sources = [
    { name: "There's An AI For That", fn: fetchFromTheresAnAIForThat },
    { name: 'Futurepedia', fn: fetchFromFuturepedia },
    { name: 'Toolify', fn: fetchFromToolify },
  ]

  for (const source of sources) {
    try {
      console.log(`\n  📦 Fetching from ${source.name}...`)
      const results = await source.fn()
      allEntries.push(...results)
      console.log(`  ✅ ${source.name}: ${results.length} tools`)
    } catch (error: any) {
      console.error(`  ❌ ${source.name} error:`, error.message)
    }
  }

  // Deduplicate across all aggregator sources
  const deduplicated: AIEntry[] = []
  const seenNames = new Set<string>()
  for (const entry of allEntries) {
    const key = entry.name.toLowerCase().trim()
    if (!seenNames.has(key)) {
      seenNames.add(key)
      deduplicated.push(entry)
    }
  }

  console.log(`\n✅ Phase 2 complete: Found ${deduplicated.length} unique tools from aggregators (${allEntries.length} total before dedup)\n`)
  return deduplicated
}
