import { getSupabaseAdmin } from './supabase'
import * as cheerio from 'cheerio'

// Types
interface Tool {
    id: string
    name: string
    category: string
    description: string
    platform: string
    region: string
    accessType: string
    pricing: string
    tags: string[]
    popularity: number
    isTrending: boolean
    source: string
}

const BUCKET_NAME = 'tools'
const DEFAULT_IMAGE_PATH = '/og-image.png'

// --- Helper Functions ---

function mapCategory(externalCategory: string): string {
    const normalized = externalCategory.toLowerCase().trim()
    const categoryMap: Record<string, string> = {
        'text-generation': 'Generative AI',
        'code-generation': 'Code & Development',
        'code generation': 'Code & Development',
        'code-assistant': 'Code & Development',
        'ide': 'Code & Development',
        'ides': 'Code & Development',
        'development-environment': 'Code & Development',
        'image-generation': 'Image Generation',
        'stable-diffusion': 'Image Generation',
        'text-to-image': 'Image Generation',
        'generative-ai': 'Generative AI',
        'ai-writing': 'Writing & Content',
        'chatbot': 'ChatBots',
        'chat-bots': 'ChatBots',
        'ai-tools': 'AI Agents',
        'ai-agent': 'AI Agents',
        'ai-agents': 'AI Agents',
        'artificial-intelligence': 'Generative AI',
        'machine-learning': 'Data & Analytics',
        'deep-learning': 'Data & Analytics',
        'llm': 'Generative AI',
        'ai-powered': 'Productivity',
        'text-to-speech': 'Audio & Music',
        'speech': 'Audio & Music',
        'computer-vision': 'Computer Vision',
        'nlp': 'NLP & Text Analysis',
        'video': 'Video Generation',
    }
    return categoryMap[normalized] || 'Generative AI'
}

function determineAccessType(pricing?: string, tags: string[] = []): string {
    if (!pricing && tags.length === 0) return 'Free'
    const text = `${pricing || ''} ${tags.join(' ')}`.toLowerCase()
    if (text.includes('free') && (text.includes('paid') || text.includes('premium') || text.includes('pro'))) {
        return 'Freemium'
    }
    if (text.includes('paid') || text.includes('premium') || text.includes('pro') || text.includes('subscription')) {
        return 'Paid'
    }
    return 'Free'
}

function determineRegion(url: string = '', tags: string[] = []): string {
    const text = `${url} ${tags.join(' ')}`.toLowerCase()
    if (text.includes('.uk') || text.includes('europe') || text.includes('eu')) return 'EU'
    if (text.includes('.ca')) return 'Canada'
    if (text.includes('.cn') || text.includes('china')) return 'China'
    if (text.includes('.ae') || text.includes('uae')) return 'UAE'
    if (text.includes('.il') || text.includes('israel')) return 'Israel'
    if (text.includes('.us') || text.includes('usa') || text.includes('united states')) return 'USA'
    if (text.includes('.in') || text.includes('india')) return 'India'
    if (text.includes('.jp') || text.includes('japan')) return 'Japan'
    return 'Global'
}

function generateId(name: string, source: string, index?: number): string {
    const cleanName = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50)
    const sourcePrefix = (source || 'discovery').substring(0, 10).toLowerCase().replace(/[^a-z0-9]/g, '-')
    const suffix = index !== undefined ? `-${index}` : ''
    return `${sourcePrefix}-${cleanName}${suffix}`
}

function extractTags(description: string, category: string, name: string): string[] {
    const tags: string[] = []
    const text = `${description || ''} ${category || ''} ${name || ''}`.toLowerCase()
    const commonTags = [
        'ai', 'artificial-intelligence', 'machine-learning', 'ml', 'deep-learning',
        'nlp', 'computer-vision', 'generative-ai', 'llm', 'chatbot', 'automation',
        'coding', 'writing', 'image', 'video', 'audio', 'voice', 'speech', 'music'
    ]
    for (const tag of commonTags) {
        if (text.includes(tag)) tags.push(tag)
    }
    if (category) tags.push(category.toLowerCase().replace(/\s+/g, '-'))
    return [...new Set(tags)].slice(0, 5)
}

function cleanDescription(description: string, maxLength = 500): string {
    if (!description) return ''
    return description
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, maxLength)
        .replace(/\s+\S*$/, '')
        + (description.length > maxLength ? '...' : '')
}

// --- Discovery Logic ---

export async function discoverNewTools() {
    const tools: Tool[] = []
    // Search ALL topics every run — not just 1 random one
    const topics = [
        'ai-tools', 'artificial-intelligence', 'machine-learning',
        'generative-ai', 'chatbot', 'code-assistant',
        'ai-agent', 'llm', 'stable-diffusion', 'deep-learning',
        'ai-powered', 'text-to-speech',
    ]

    const supabase = getSupabaseAdmin()
    let totalNew = 0
    const searchedTopics: string[] = []

    for (const topic of topics) {
        try {
            const response = await fetch(
                `https://api.github.com/search/repositories?q=topic:${topic}+stars:>30&sort=updated&order=desc&per_page=50`,
                { headers: { 'User-Agent': 'Arcyn-Auto-Update' } }
            )

            if (!response.ok) {
                if (response.status === 403) {
                    // Rate limited — stop searching
                    break
                }
                continue
            }

            const data = await response.json()
            const repos = data.items || []

            for (const repo of repos) {
                const desc = (repo.description || '').toLowerCase()
                // More inclusive filter — accept anything with a reasonable description
                if (desc.length > 15 &&
                    (desc.includes('tool') || desc.includes('platform') ||
                        desc.includes('ai') || desc.includes('gpt') ||
                        desc.includes('llm') || desc.includes('assistant') ||
                        desc.includes('model') || desc.includes('generator') ||
                        desc.includes('app') || desc.includes('framework'))) {

                    tools.push({
                        id: '',
                        name: repo.name,
                        description: cleanDescription(repo.description || 'AI tool', 300),
                        platform: repo.html_url,
                        category: mapCategory(topic),
                        tags: extractTags(repo.description, topic, repo.name),
                        accessType: 'Free',
                        pricing: 'Free / Open Source',
                        region: determineRegion(repo.html_url),
                        popularity: Math.min(100, Math.max(25, Math.floor(Math.log10(repo.stargazers_count + 1) * 15))),
                        isTrending: repo.stargazers_count > 500,
                        source: 'github-cron'
                    })
                }
            }

            searchedTopics.push(topic)

            // Small delay between topic searches to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 500))
        } catch {
            continue
        }
    }

    // Deduplicate tools against each other first (by name)
    const uniqueTools = new Map<string, Tool>()
    for (const tool of tools) {
        const key = tool.name.toLowerCase().trim()
        if (!uniqueTools.has(key)) {
            uniqueTools.set(key, tool)
        }
    }

    // Now deduplicate against DB
    const toolNames = [...uniqueTools.keys()]

    if (toolNames.length === 0) {
        return { topics: searchedTopics, count: 0 }
    }

    // Check DB in batches of 50 (Supabase IN clause limit)
    const existingNames = new Set<string>()
    for (let i = 0; i < toolNames.length; i += 50) {
        const batch = toolNames.slice(i, i + 50)
        const { data: existing } = await supabase
            .from('ai_tools')
            .select('name')
            .in('name', [...uniqueTools.values()].slice(i, i + 50).map(t => t.name))
            .limit(50)

        if (existing) {
            existing.forEach(t => existingNames.add(t.name.toLowerCase()))
        }
    }

    const newTools = [...uniqueTools.values()].filter(t =>
        !existingNames.has(t.name.toLowerCase())
    )

    if (newTools.length > 0) {
        // Insert in batches
        const batchSize = 50
        for (let i = 0; i < newTools.length; i += batchSize) {
            const batch = newTools.slice(i, i + batchSize)
            const dbTools = batch.map((tool, idx) => ({
                id: generateId(tool.name, tool.source, Date.now() + i + idx),
                name: tool.name,
                category: tool.category,
                description: tool.description,
                platform: tool.platform,
                region: tool.region,
                access_type: tool.accessType,
                pricing: tool.pricing,
                tags: tool.tags,
                popularity: tool.popularity,
                last_updated: new Date().toISOString().split('T')[0],
                is_trending: tool.isTrending,
                image: null
            }))

            await supabase.from('ai_tools').upsert(dbTools, { onConflict: 'id' as never })
        }
        totalNew = newTools.length
    }

    return { topics: searchedTopics, found: tools.length, unique: uniqueTools.size, newlyAdded: totalNew }
}

// --- Logo Fetch Logic ---

async function fetchHTML(url: string, timeout = 5000): Promise<string> {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArcynBot/1.0)' }
        })
        clearTimeout(timeoutId)
        if (!response.ok) return ''
        return await response.text()
    } catch {
        return ''
    }
}

async function checkImageUrl(url: string): Promise<boolean> {
    if (!url || !url.startsWith('http')) return false
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
        clearTimeout(timeoutId)
        const type = res.headers.get('content-type') || ''
        return res.ok && (type.startsWith('image/') || url.includes('favicon'))
    } catch {
        return false
    }
}

async function findLogoUrl(platformUrl: string): Promise<string | null> {
    try {
        const url = new URL(platformUrl)
        const baseUrl = `${url.protocol}//${url.hostname}`

        // 1. Try common paths
        const paths = ['/favicon.ico', '/favicon.png', '/apple-touch-icon.png']
        for (const p of paths) {
            const full = `${baseUrl}${p}`
            if (await checkImageUrl(full)) return full
        }

        // 2. Parse HTML
        const html = await fetchHTML(platformUrl)
        if (!html) return null
        const $ = cheerio.load(html)

        let bestIcon = $('link[rel="icon"]').attr('href') ||
            $('link[rel="shortcut icon"]').attr('href') ||
            $('meta[property="og:image"]').attr('content')

        if (bestIcon) {
            if (bestIcon.startsWith('//')) bestIcon = 'https:' + bestIcon
            else if (bestIcon.startsWith('/')) bestIcon = baseUrl + bestIcon
            else if (!bestIcon.startsWith('http')) bestIcon = baseUrl + '/' + bestIcon

            if (await checkImageUrl(bestIcon)) return bestIcon
        }
    } catch { /* ignore */ }
    return null
}

export async function fetchMissingLogos(limit = 5) {
    const supabase = getSupabaseAdmin()

    // Find tools with missing images
    const { data: tools } = await supabase
        .from('ai_tools')
        .select('id, name, platform')
        .is('image', null)
        .limit(limit)

    if (!tools || tools.length === 0) return { updated: 0 }

    let updated = 0
    for (const tool of tools) {
        if (!tool.platform) continue

        // Try to find a logo
        const logoUrl = await findLogoUrl(tool.platform)
        if (logoUrl) {
            // Download and upload to storage is too heavy for serverless usually
            // For this "lite" version, we will just save the URL directly if allowed
            // OR upload if we have time. Let's try to fetch and upload.

            try {
                const imgRes = await fetch(logoUrl)
                if (imgRes.ok) {
                    const buffer = await imgRes.arrayBuffer()
                    // Basic mime type detection
                    const contentType = imgRes.headers.get('content-type') || 'image/png'
                    const ext = contentType.split('/')[1]?.split(';')[0] || 'png'
                    const path = `tools/${tool.id}.${ext}`

                    const { data: uploadData, error } = await supabase.storage
                        .from('tools')
                        .upload(path, buffer, { upsert: true, contentType })

                    if (!error) {
                        const { data: { publicUrl } } = supabase.storage.from('tools').getPublicUrl(path)
                        await supabase.from('ai_tools').update({ image: publicUrl }).eq('id', tool.id)
                        updated++
                        continue
                    }
                }
            } catch (e) {
                console.error(`Failed to handle image for ${tool.name}`, e)
            }
        }

        // If failed or no logo, mark as processed with default placeholder to avoid endless retry loop in next runs
        // But maybe we retry later. For now, let's leave it null or set a flag. 
        // To handle "constantly updated", we can just try another batch next time.
    }

    return { updated, scanned: tools.length }
}
