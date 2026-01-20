/**
 * Product Hunt AI Tools Source
 * Fetches trending AI products from Product Hunt
 */

import * as cheerio from 'cheerio'
import type { AIEntry } from '../../lib/ai-data'
import { generateId, cleanDescription, normalizePopularity } from '../utils/transformer'
import { rateLimiter } from '../utils/rate-limiter'

interface ProductHuntTool {
    name: string
    tagline: string
    url: string
    votes: number
    topics: string[]
}

/**
 * Map Product Hunt topics to our categories
 */
function mapTopicToCategory(topics: string[]): string {
    const topicStr = topics.join(' ').toLowerCase()

    if (topicStr.includes('writing') || topicStr.includes('copywriting') || topicStr.includes('content')) {
        return 'Writing & Content'
    }
    if (topicStr.includes('design') || topicStr.includes('image') || topicStr.includes('art')) {
        return 'Image Generation'
    }
    if (topicStr.includes('video') || topicStr.includes('animation')) {
        return 'Video & Audio'
    }
    if (topicStr.includes('audio') || topicStr.includes('music') || topicStr.includes('voice') || topicStr.includes('speech')) {
        return 'Voice & Speech'
    }
    if (topicStr.includes('code') || topicStr.includes('developer') || topicStr.includes('programming')) {
        return 'Code Generation'
    }
    if (topicStr.includes('chat') || topicStr.includes('assistant') || topicStr.includes('conversational')) {
        return 'ChatBots'
    }
    if (topicStr.includes('productivity') || topicStr.includes('automation') || topicStr.includes('workflow')) {
        return 'Productivity'
    }
    if (topicStr.includes('marketing') || topicStr.includes('seo') || topicStr.includes('social')) {
        return 'Marketing'
    }
    if (topicStr.includes('education') || topicStr.includes('learning') || topicStr.includes('study')) {
        return 'Learning & Education'
    }
    if (topicStr.includes('data') || topicStr.includes('analytics') || topicStr.includes('research')) {
        return 'Data & Analytics'
    }
    if (topicStr.includes('sales') || topicStr.includes('crm') || topicStr.includes('customer')) {
        return 'Sales & CRM'
    }

    return 'Generative AI'
}

/**
 * Determine access type from description/tagline
 */
function determineAccessType(text: string): 'Free' | 'Freemium' | 'Paid' {
    const lower = text.toLowerCase()
    if (lower.includes('free') && (lower.includes('paid') || lower.includes('pro') || lower.includes('premium'))) {
        return 'Freemium'
    }
    if (lower.includes('free') || lower.includes('open source') || lower.includes('open-source')) {
        return 'Free'
    }
    return 'Freemium' // Default for Product Hunt tools
}

/**
 * Safe fetch with retry
 */
async function safeFetch(url: string, retries = 3): Promise<Response | null> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
                signal: AbortSignal.timeout(15000),
            })

            if (response.ok) return response
        } catch (error: any) {
            if (i === retries - 1) {
                console.error(`[ProductHunt] Failed to fetch ${url}:`, error.message)
                return null
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
        }
    }
    return null
}

/**
 * Fetch AI tools from Product Hunt
 */
export async function fetchFromProductHunt(): Promise<AIEntry[]> {
    console.log('\n🚀 Fetching from Product Hunt...\n')

    const entries: AIEntry[] = []

    try {
        await rateLimiter.wait('producthunt', 3000)

        // Fetch the AI topics page
        const urls = [
            'https://www.producthunt.com/topics/artificial-intelligence',
            'https://www.producthunt.com/topics/generative-ai',
            'https://www.producthunt.com/topics/chatgpt',
        ]

        for (const url of urls) {
            const response = await safeFetch(url)
            if (!response) continue

            const html = await response.text()
            const $ = cheerio.load(html)

            // Look for product listings
            $('[data-test="product-item"], .styles_item__Dk_nz, [class*="ProductItem"]').each((index, element) => {
                const $el = $(element)
                const name = $el.find('[data-test="product-name"], h3, [class*="title"]').first().text().trim()
                const tagline = $el.find('[data-test="product-tagline"], [class*="tagline"], p').first().text().trim()
                const link = $el.find('a').first().attr('href') || ''
                const votesText = $el.find('[data-test="vote-count"], [class*="vote"]').first().text().trim()
                const votes = parseInt(votesText.replace(/\D/g, '')) || 0

                if (name && name.length > 2 && name.length < 100) {
                    const fullUrl = link.startsWith('http') ? link : `https://www.producthunt.com${link}`

                    entries.push({
                        id: generateId(name, 'producthunt', index),
                        name,
                        category: 'Generative AI', // Will be refined later
                        description: cleanDescription(tagline || `AI tool from Product Hunt: ${name}`, 300),
                        platform: fullUrl,
                        region: 'Global',
                        accessType: determineAccessType(tagline),
                        pricing: 'Check website',
                        tags: ['product-hunt', 'ai-tool', 'startup'],
                        popularity: normalizePopularity(50 + Math.min(votes / 100, 40)),
                        lastUpdated: new Date().toISOString().split('T')[0],
                        isTrending: votes > 500
                    })
                }
            })

            await rateLimiter.wait('producthunt', 2000)
        }

        console.log(`[ProductHunt] Fetched ${entries.length} tools`)
    } catch (error: any) {
        console.error('[ProductHunt] Error:', error.message)
    }

    return entries
}
