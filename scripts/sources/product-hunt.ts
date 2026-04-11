/**
 * Product Hunt AI Tools Source
 * Fetches trending AI products from Product Hunt via GraphQL API v2
 * Falls back to RSS feed parsing when API token is unavailable
 */

import type { AIEntry } from '../../lib/ai-data'
import { generateId, cleanDescription, normalizePopularity, mapCategory, determineAccessType, extractTags } from '../utils/transformer'
import { rateLimiter } from '../utils/rate-limiter'

const PH_GRAPHQL_ENDPOINT = 'https://api.producthunt.com/v2/api/graphql'

interface PHNode {
    id: string
    name: string
    tagline: string
    description?: string
    url: string
    website: string
    votesCount: number
    reviewsRating?: number
    topics?: { edges: { node: { name: string } }[] }
    thumbnail?: { url: string }
    createdAt?: string
}

/**
 * Map Product Hunt topics to our categories
 */
function mapTopicToCategory(topics: string[]): string {
    const topicStr = topics.join(' ').toLowerCase()

    if (topicStr.includes('writing') || topicStr.includes('copywriting') || topicStr.includes('content creation')) {
        return 'Writing & Content'
    }
    if (topicStr.includes('design') || topicStr.includes('image') || topicStr.includes('art') || topicStr.includes('graphics')) {
        return 'Image Generation'
    }
    if (topicStr.includes('video') || topicStr.includes('animation') || topicStr.includes('streaming')) {
        return 'Video & Audio'
    }
    if (topicStr.includes('audio') || topicStr.includes('music') || topicStr.includes('voice') || topicStr.includes('speech') || topicStr.includes('podcast')) {
        return 'Voice & Speech'
    }
    if (topicStr.includes('code') || topicStr.includes('developer tool') || topicStr.includes('programming') || topicStr.includes('devops')) {
        return 'Code Generation'
    }
    if (topicStr.includes('chat') || topicStr.includes('assistant') || topicStr.includes('conversational')) {
        return 'ChatBots'
    }
    if (topicStr.includes('productivity') || topicStr.includes('automation') || topicStr.includes('workflow') || topicStr.includes('task management')) {
        return 'Productivity'
    }
    if (topicStr.includes('marketing') || topicStr.includes('seo') || topicStr.includes('social media') || topicStr.includes('advertising')) {
        return 'Marketing'
    }
    if (topicStr.includes('education') || topicStr.includes('learning') || topicStr.includes('study') || topicStr.includes('e-learning')) {
        return 'Learning & Education'
    }
    if (topicStr.includes('data') || topicStr.includes('analytics') || topicStr.includes('research') || topicStr.includes('business intelligence')) {
        return 'Data & Analytics'
    }
    if (topicStr.includes('sales') || topicStr.includes('crm') || topicStr.includes('customer')) {
        return 'Sales & CRM'
    }
    if (topicStr.includes('health') || topicStr.includes('medical') || topicStr.includes('fitness')) {
        return 'Healthcare'
    }
    if (topicStr.includes('finance') || topicStr.includes('fintech') || topicStr.includes('crypto')) {
        return 'Finance'
    }

    return 'Generative AI'
}

/**
 * Determine access type from tagline/description
 */
function determineAccessTypeFromText(text: string): 'Free' | 'Freemium' | 'Paid' {
    const lower = text.toLowerCase()
    if (lower.includes('open source') || lower.includes('open-source')) return 'Free'
    if (lower.includes('free') && (lower.includes('paid') || lower.includes('pro') || lower.includes('premium') || lower.includes('plans'))) {
        return 'Freemium'
    }
    if (lower.includes('free')) return 'Free'
    if (lower.includes('$') || lower.includes('subscription') || lower.includes('pricing')) return 'Paid'
    return 'Freemium' // Default for Product Hunt tools — most have a free tier
}

/**
 * Fetch AI tools from Product Hunt via GraphQL API v2
 */
async function fetchViaGraphQL(apiToken: string): Promise<AIEntry[]> {
    console.log('  📡 Using Product Hunt GraphQL API v2...')
    const entries: AIEntry[] = []

    // Search for AI-related posts across multiple topic filters
    const searchTerms = [
        'artificial intelligence',
        'machine learning',
        'generative ai',
        'ai tools',
        'chatbot',
        'ai writing',
        'ai design',
        'ai coding',
    ]

    for (const term of searchTerms) {
        try {
            await rateLimiter.wait('producthunt-api', 2000)

            const query = `
                query {
                    posts(
                        order: VOTES_COUNT
                        topic: "${term}"
                        first: 50
                    ) {
                        edges {
                            node {
                                id
                                name
                                tagline
                                description
                                url
                                website
                                votesCount
                                reviewsRating
                                topics {
                                    edges {
                                        node {
                                            name
                                        }
                                    }
                                }
                                thumbnail {
                                    url
                                }
                                createdAt
                            }
                        }
                    }
                }
            `

            const response = await fetch(PH_GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ query }),
                signal: AbortSignal.timeout(15000),
            })

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.warn(`  ⚠️  API auth failed (${response.status}), will fall back to RSS`)
                    return [] // Signal to caller to try RSS fallback
                }
                console.warn(`  ⚠️  GraphQL error for "${term}": ${response.status}`)
                continue
            }

            const data = await response.json()
            const posts = data?.data?.posts?.edges || []

            for (const edge of posts) {
                const node: PHNode = edge.node
                if (!node.name) continue

                const topics = node.topics?.edges?.map(e => e.node.name) || []
                const category = mapTopicToCategory(topics)
                const description = node.description || node.tagline || `AI tool from Product Hunt: ${node.name}`

                entries.push({
                    id: generateId(node.name, 'producthunt', entries.length),
                    name: node.name.substring(0, 100),
                    category,
                    description: cleanDescription(description, 300),
                    platform: node.website || node.url || `https://www.producthunt.com/posts/${node.name.toLowerCase().replace(/\s+/g, '-')}`,
                    region: 'Global',
                    accessType: determineAccessTypeFromText(`${node.tagline} ${node.description || ''}`),
                    pricing: 'Check website',
                    tags: ['product-hunt', ...topics.slice(0, 3).map(t => t.toLowerCase().replace(/\s+/g, '-')), ...extractTags(description, category, node.name)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 8),
                    popularity: normalizePopularity(Math.min(100, 40 + Math.log10(node.votesCount + 1) * 15)),
                    lastUpdated: node.createdAt ? new Date(node.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    isTrending: node.votesCount > 500,
                    image: node.thumbnail?.url || undefined,
                })
            }

            console.log(`    ✓ "${term}": ${posts.length} products found`)
        } catch (error: any) {
            console.error(`    ❌ Error querying "${term}":`, error.message)
        }
    }

    return entries
}

/**
 * Fetch AI tools from Product Hunt via RSS feeds (fallback)
 */
async function fetchViaRSS(): Promise<AIEntry[]> {
    console.log('  📡 Falling back to Product Hunt RSS feeds...')
    const entries: AIEntry[] = []

    // Product Hunt has RSS feeds for topics
    const rssUrls = [
        { url: 'https://www.producthunt.com/feed?category=ai', topic: 'ai' },
        { url: 'https://www.producthunt.com/feed?category=developer-tools', topic: 'developer-tools' },
        { url: 'https://www.producthunt.com/feed?category=productivity', topic: 'productivity' },
    ]

    // Dynamic import rss-parser since it's CommonJS
    let Parser: any
    try {
        const rssParser = await import('rss-parser')
        Parser = rssParser.default || rssParser
    } catch {
        console.warn('  ⚠️  rss-parser not available, trying fetch-based RSS parsing')
    }

    for (const feed of rssUrls) {
        try {
            await rateLimiter.wait('producthunt-rss', 3000)

            if (Parser) {
                const parser = new Parser({ timeout: 15000 })
                const parsed = await parser.parseURL(feed.url)

                if (!parsed.items || parsed.items.length === 0) continue

                for (const item of parsed.items.slice(0, 30)) {
                    const title = item.title?.trim() || ''
                    const description = item.contentSnippet || item.content || item.description || ''
                    const link = item.link || ''

                    if (!title || title.length < 3) continue

                    // Check if it's AI-related
                    const text = `${title} ${description}`.toLowerCase()
                    const aiKeywords = ['ai', 'artificial intelligence', 'machine learning', 'gpt', 'llm', 'chatbot', 'generative', 'neural', 'deep learning', 'nlp', 'automation']
                    const isAIRelated = feed.topic === 'ai' || aiKeywords.some(kw => text.includes(kw))

                    if (!isAIRelated) continue

                    entries.push({
                        id: generateId(title, 'ph-rss', entries.length),
                        name: title.substring(0, 100),
                        category: mapCategory(feed.topic),
                        description: cleanDescription(description || `AI tool: ${title}`, 300),
                        platform: link,
                        region: 'Global',
                        accessType: determineAccessTypeFromText(description),
                        pricing: 'Check website',
                        tags: ['product-hunt', feed.topic, ...extractTags(description, feed.topic, title)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6),
                        popularity: normalizePopularity(55),
                        lastUpdated: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                        isTrending: false,
                    })
                }

                console.log(`    ✓ RSS "${feed.topic}": ${parsed.items.length} items parsed`)
            } else {
                // Minimal fetch-based RSS parsing
                const response = await fetch(feed.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/rss+xml, application/xml, text/xml',
                    },
                    signal: AbortSignal.timeout(15000),
                })

                if (!response.ok) {
                    console.warn(`    ⚠️  RSS feed ${feed.topic} returned ${response.status}`)
                    continue
                }

                const xml = await response.text()

                // Simple XML parsing for RSS items
                const itemRegex = /<item>([\s\S]*?)<\/item>/gi
                let match
                while ((match = itemRegex.exec(xml)) !== null) {
                    const itemXml = match[1]
                    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/i)
                    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i)
                    const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]>|<description>(.*?)<\/description>/i)

                    const title = (titleMatch?.[1] || titleMatch?.[2] || '').trim()
                    const link = (linkMatch?.[1] || '').trim()
                    const desc = (descMatch?.[1] || descMatch?.[2] || '').trim()

                    if (!title || title.length < 3) continue

                    const text = `${title} ${desc}`.toLowerCase()
                    const aiKeywords = ['ai', 'artificial intelligence', 'machine learning', 'gpt', 'llm', 'chatbot', 'generative']
                    const isAIRelated = feed.topic === 'ai' || aiKeywords.some(kw => text.includes(kw))

                    if (!isAIRelated) continue

                    entries.push({
                        id: generateId(title, 'ph-rss', entries.length),
                        name: title.substring(0, 100),
                        category: mapCategory(feed.topic),
                        description: cleanDescription(desc || title, 300),
                        platform: link,
                        region: 'Global',
                        accessType: determineAccessTypeFromText(desc),
                        pricing: 'Check website',
                        tags: ['product-hunt', feed.topic],
                        popularity: normalizePopularity(55),
                        lastUpdated: new Date().toISOString().split('T')[0],
                        isTrending: false,
                    })
                }
            }
        } catch (error: any) {
            console.error(`    ❌ RSS error for "${feed.topic}":`, error.message)
        }
    }

    return entries
}

/**
 * Fetch AI tools from Product Hunt — tries GraphQL API first, then RSS fallback
 */
export async function fetchFromProductHunt(): Promise<AIEntry[]> {
    console.log('\n🚀 Fetching from Product Hunt...\n')

    let entries: AIEntry[] = []

    try {
        const apiToken = process.env.PRODUCTHUNT_API_TOKEN

        if (apiToken) {
            entries = await fetchViaGraphQL(apiToken)
        }

        // If GraphQL returned nothing (no token, auth failed, or no results), try RSS
        if (entries.length === 0) {
            entries = await fetchViaRSS()
        }

        // Deduplicate by name
        const seen = new Set<string>()
        entries = entries.filter(entry => {
            const key = entry.name.toLowerCase().trim()
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })

        console.log(`[ProductHunt] Total: ${entries.length} unique AI tools`)
    } catch (error: any) {
        console.error('[ProductHunt] Error:', error.message)
    }

    return entries
}
