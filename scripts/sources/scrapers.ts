/**
 * Phase 3: Web Scrapers
 * Scrapes additional AI tool directories and listing sites:
 *   - AITopTools
 *   - TopAI.tools
 *   - AI Tool Tracker / AI Scout sites
 */

import * as cheerio from 'cheerio'
import type { AIEntry } from '../../lib/ai-data'
import { mapCategory, determineAccessType, determineRegion, generateId, extractTags, cleanDescription, normalizePopularity } from '../utils/transformer'
import { rateLimiter } from '../utils/rate-limiter'

/**
 * Safe fetch with retry logic
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
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        signal: AbortSignal.timeout(20000),
        redirect: 'follow',
      })

      if (response.ok) {
        return response
      }

      if (response.status === 429 || response.status === 403) {
        console.warn(`  ⚠️  Rate limited (${response.status}) for ${url}, waiting ${(i + 1) * 5}s...`)
        await new Promise(resolve => setTimeout(resolve, 5000 * (i + 1)))
        continue
      }
    } catch (error: any) {
      if (i === retries - 1) {
        console.error(`[Scrapers] Failed to fetch ${url} after ${retries} attempts:`, error.message)
        return null
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)))
    }
  }
  return null
}

/**
 * Generic tool extractor — parses an HTML page for AI tool entries
 * Uses multiple selector strategies to find tools across different site structures
 */
function extractToolsFromHTML(
  html: string,
  source: string,
  defaultCategory: string,
  baseUrl: string
): AIEntry[] {
  const entries: AIEntry[] = []
  const seenNames = new Set<string>()
  const $ = cheerio.load(html)

  // Strategy 1: Look for article/card-like structures
  const selectors = [
    'article',
    '[class*="card"]',
    '[class*="tool"]',
    '[class*="item"]',
    'li:has(a[href*="http"])',
  ]

  for (const selector of selectors) {
    $(selector).each((_index, element) => {
      const $el = $(element)

      // Find the tool name — look for headings, then bold text, then first link
      let name = ''
      const $heading = $el.find('h1, h2, h3, h4, h5, h6').first()
      if ($heading.length) {
        name = $heading.text().trim()
      }
      if (!name) {
        const $bold = $el.find('strong, b').first()
        if ($bold.length) name = $bold.text().trim()
      }
      if (!name) {
        const $link = $el.find('a').first()
        if ($link.length) name = $link.text().trim()
      }

      // Validate name
      if (!name || name.length < 2 || name.length > 80) return
      if (/^(read more|view|visit|click|sign|log|about|contact|home|categories|submit)/i.test(name)) return

      const nameLower = name.toLowerCase().trim()
      if (seenNames.has(nameLower)) return
      seenNames.add(nameLower)

      // Find description
      let description = ''
      $el.find('p, [class*="desc"], [class*="excerpt"], [class*="summary"]').each((_, descEl) => {
        const t = $(descEl).text().trim()
        if (t.length > 15 && t.length < 300 && t !== name && !description) {
          description = t
        }
      })

      // Find link
      let link = $el.find('a').first().attr('href') || ''
      if (link && !link.startsWith('http')) {
        link = `${baseUrl}${link.startsWith('/') ? '' : '/'}${link}`
      }

      // Find category/tags
      let category = defaultCategory
      const $tags = $el.find('[class*="tag"], [class*="category"], [class*="badge"]')
      const tagTexts: string[] = []
      $tags.each((_, tagEl) => {
        const t = $(tagEl).text().trim()
        if (t.length > 1 && t.length < 40) tagTexts.push(t)
      })
      if (tagTexts.length > 0) {
        category = mapCategory(tagTexts[0])
      }

      // Find pricing
      let pricing = ''
      const $pricing = $el.find('[class*="price"], [class*="pricing"], [class*="plan"]')
      if ($pricing.length) {
        pricing = $pricing.first().text().trim()
      }

      entries.push({
        id: generateId(name, source, entries.length),
        name: name.substring(0, 100),
        category,
        description: cleanDescription(description || `AI ${defaultCategory.toLowerCase()} tool`, 300),
        platform: link || baseUrl,
        region: determineRegion(link),
        accessType: determineAccessType(pricing),
        pricing: pricing || 'Check website',
        tags: [source, ...tagTexts.map(t => t.toLowerCase().replace(/\s+/g, '-')).slice(0, 3), ...extractTags(description, category, name)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6),
        popularity: normalizePopularity(55),
        lastUpdated: new Date().toISOString().split('T')[0],
        isTrending: false,
      })
    })

    // If we found tools with this selector, don't try the others to avoid duplicates
    if (entries.length > 0) break
  }

  return entries
}

/**
 * Fetch from TopAI.tools
 */
async function fetchFromTopAITools(): Promise<AIEntry[]> {
  const allEntries: AIEntry[] = []
  const seenNames = new Set<string>()

  const categories = [
    { url: 'https://topai.tools/s/ai-writing-tools', category: 'Writing & Content' },
    { url: 'https://topai.tools/s/ai-image-generators', category: 'Image Generation' },
    { url: 'https://topai.tools/s/ai-video-generators', category: 'Video & Audio' },
    { url: 'https://topai.tools/s/ai-coding-tools', category: 'Code Generation' },
    { url: 'https://topai.tools/s/ai-chatbots', category: 'ChatBots' },
    { url: 'https://topai.tools/s/ai-productivity', category: 'Productivity' },
    { url: 'https://topai.tools/s/ai-marketing', category: 'Marketing' },
    { url: 'https://topai.tools/s/ai-design', category: 'Image Generation' },
  ]

  for (const cat of categories) {
    try {
      await rateLimiter.wait('topaitools', 3000)

      const response = await safeFetch(cat.url)
      if (!response) continue

      const html = await response.text()
      const $ = cheerio.load(html)

      // Look for tool listings — these sites typically use card layouts
      $('a[href*="/t/"], a[href*="/tool/"]').each((_index, element) => {
        const $link = $(element)
        const href = $link.attr('href') || ''

        const name = $link.text().trim()
        if (!name || name.length < 2 || name.length > 80) return
        if (/^(view|visit|show|more|sign|read|explore|try)/i.test(name)) return

        const nameLower = name.toLowerCase().trim()
        if (seenNames.has(nameLower)) return
        seenNames.add(nameLower)

        // Get description from sibling/parent elements
        const $parent = $link.closest('div, article, li').first()
        let description = ''
        if ($parent.length) {
          $parent.find('p, span, [class*="desc"]').each((_, el) => {
            const t = $(el).text().trim()
            if (t.length > 15 && t.length < 300 && t !== name && !description) {
              description = t
            }
          })
        }

        allEntries.push({
          id: generateId(name, 'topaitools', allEntries.length),
          name: name.substring(0, 100),
          category: cat.category,
          description: cleanDescription(description || `${name} — AI ${cat.category.toLowerCase()} tool`, 300),
          platform: href.startsWith('http') ? href : `https://topai.tools${href}`,
          region: 'Global',
          accessType: determineAccessType(),
          pricing: 'Check website',
          tags: ['topaitools', cat.category.toLowerCase().replace(/[^a-z0-9]+/g, '-'), ...extractTags(description, cat.category, name)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
          popularity: normalizePopularity(52),
          lastUpdated: new Date().toISOString().split('T')[0],
          isTrending: false,
        })
      })

      console.log(`  ✓ TopAI.tools ${cat.category}: ${allEntries.length} tools total`)
    } catch (error: any) {
      console.error(`  ❌ TopAI.tools ${cat.category}:`, error.message)
    }
  }

  console.log(`[Scrapers] Fetched ${allEntries.length} tools from TopAI.tools`)
  return allEntries
}

/**
 * Fetch from AI Tool directories using generic extractor
 */
async function fetchFromAIDirectories(): Promise<AIEntry[]> {
  const allEntries: AIEntry[] = []

  const directories = [
    { url: 'https://aitoptools.com/', name: 'aitoptools', category: 'Generative AI' },
    { url: 'https://www.aitoolsclub.com/', name: 'aitoolsclub', category: 'Generative AI' },
  ]

  for (const dir of directories) {
    try {
      await rateLimiter.wait(dir.name, 4000)

      const response = await safeFetch(dir.url)
      if (!response) {
        console.warn(`  ⚠️  Could not fetch ${dir.name}`)
        continue
      }

      const html = await response.text()
      const entries = extractToolsFromHTML(html, dir.name, dir.category, dir.url)
      allEntries.push(...entries)

      console.log(`  ✓ ${dir.name}: ${entries.length} tools`)
    } catch (error: any) {
      console.error(`  ❌ ${dir.name}:`, error.message)
    }
  }

  return allEntries
}

/**
 * Fetch from all scrapers
 */
export async function fetchFromScrapers(): Promise<AIEntry[]> {
  console.log('\n🕷️  Phase 3: Scraping from tool directories...\n')

  const allEntries: AIEntry[] = []

  // Run scrapers sequentially to respect rate limits
  const sources = [
    { name: 'TopAI.tools', fn: fetchFromTopAITools },
    { name: 'AI Directories', fn: fetchFromAIDirectories },
  ]

  for (const source of sources) {
    try {
      console.log(`  📦 Scraping ${source.name}...`)
      const results = await source.fn()
      allEntries.push(...results)
    } catch (error: any) {
      console.error(`  ❌ ${source.name} error:`, error.message)
    }
  }

  // Deduplicate
  const deduplicated: AIEntry[] = []
  const seenNames = new Set<string>()
  for (const entry of allEntries) {
    const key = entry.name.toLowerCase().trim()
    if (!seenNames.has(key)) {
      seenNames.add(key)
      deduplicated.push(entry)
    }
  }

  console.log(`\n✅ Phase 3 complete: Found ${deduplicated.length} unique tools from scrapers\n`)
  return deduplicated
}
