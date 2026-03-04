import type { AIEntry } from './ai-data'

/**
 * Real-time fallback search — searches GitHub and HuggingFace APIs
 * directly when the local database has no results.
 * 
 * This does NOT require Gemini API tokens. It uses free public APIs.
 * Called as a last resort when DB search returns 0 or very few results.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''

interface FallbackResult {
    results: AIEntry[]
    source: string
    query: string
}

/**
 * Search GitHub repos in real-time for a user's query
 */
async function searchGitHubLive(query: string, limit = 15): Promise<AIEntry[]> {
    try {
        const encoded = encodeURIComponent(query)
        const headers: Record<string, string> = {
            'User-Agent': 'Arcyn-Find',
            'Accept': 'application/vnd.github.v3+json',
        }
        if (GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`
        }

        const response = await fetch(
            `https://api.github.com/search/repositories?q=${encoded}+in:name,description,topics&sort=stars&order=desc&per_page=${limit}`,
            { headers, signal: AbortSignal.timeout(8000) }
        )

        if (!response.ok) return []

        const data = await response.json()
        const repos = data.items || []

        return repos
            .filter((repo: any) => repo.description && repo.description.length > 10)
            .map((repo: any, idx: number) => {
                const topics = repo.topics || []
                let category = 'Generative AI'
                if (topics.some((t: string) => ['chatbot', 'chat'].includes(t))) category = 'ChatBots'
                else if (topics.some((t: string) => ['image-generation', 'stable-diffusion', 'text-to-image'].includes(t))) category = 'Image Generation'
                else if (topics.some((t: string) => ['code-assistant', 'ide', 'code-generation', 'developer-tools'].includes(t))) category = 'Code & Development'
                else if (topics.some((t: string) => ['tts', 'text-to-speech', 'music', 'audio'].includes(t))) category = 'Audio & Music'
                else if (topics.some((t: string) => ['video', 'video-generation'].includes(t))) category = 'Video Generation'
                else if (topics.some((t: string) => ['agent', 'ai-agent', 'autonomous'].includes(t))) category = 'AI Agents'

                return {
                    id: `gh-live-${repo.id}`,
                    name: repo.name,
                    category,
                    description: (repo.description || '').substring(0, 300),
                    platform: repo.html_url,
                    region: 'Global',
                    accessType: 'Free',
                    pricing: 'Free / Open Source',
                    tags: topics.slice(0, 5),
                    popularity: Math.min(100, Math.max(20, Math.floor(Math.log10((repo.stargazers_count || 1) + 1) * 15))),
                    lastUpdated: repo.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                    isTrending: (repo.stargazers_count || 0) > 500,
                    image: repo.owner?.avatar_url || '',
                } as AIEntry
            })
    } catch (err) {
        console.warn('[Fallback] GitHub live search failed:', err)
        return []
    }
}

/**
 * Search HuggingFace models in real-time for a user's query
 */
async function searchHuggingFaceLive(query: string, limit = 10): Promise<AIEntry[]> {
    try {
        const encoded = encodeURIComponent(query)
        const response = await fetch(
            `https://huggingface.co/api/models?search=${encoded}&sort=downloads&direction=-1&limit=${limit}`,
            {
                headers: { 'User-Agent': 'Arcyn-Find' },
                signal: AbortSignal.timeout(8000),
            }
        )

        if (!response.ok) return []

        const models = await response.json()
        if (!Array.isArray(models)) return []

        return models.map((model: any) => {
            const pipeline = model.pipeline_tag || ''
            let category = 'Generative AI'
            if (pipeline.includes('text-generation')) category = 'Generative AI'
            else if (pipeline.includes('text-to-image') || pipeline.includes('image')) category = 'Image Generation'
            else if (pipeline.includes('text-to-speech') || pipeline.includes('audio') || pipeline.includes('automatic-speech')) category = 'Audio & Music'
            else if (pipeline.includes('translation')) category = 'Translation'
            else if (pipeline.includes('summarization') || pipeline.includes('text2text')) category = 'Writing & Content'
            else if (pipeline.includes('object-detection') || pipeline.includes('image-classification')) category = 'Computer Vision'
            else if (pipeline.includes('text-to-video') || pipeline.includes('video')) category = 'Video Generation'

            const downloads = model.downloads || 0
            const likes = model.likes || 0

            return {
                id: `hf-live-${model.modelId?.replace(/\//g, '-') || model._id}`,
                name: model.modelId || model._id || 'Unknown',
                category,
                description: `HuggingFace model: ${model.modelId}. Pipeline: ${pipeline || 'general'}. ${downloads > 0 ? `Downloads: ${downloads.toLocaleString()}.` : ''} ${likes > 0 ? `Likes: ${likes.toLocaleString()}.` : ''}`,
                platform: `https://huggingface.co/${model.modelId || model._id}`,
                region: 'Global',
                accessType: 'Free',
                pricing: 'Free / Open Source',
                tags: [pipeline, 'huggingface', ...(model.tags || []).slice(0, 3)].filter(Boolean),
                popularity: Math.min(100, Math.max(15, Math.floor(Math.log10(downloads + 1) * 10))),
                lastUpdated: model.lastModified?.split('T')[0] || new Date().toISOString().split('T')[0],
                isTrending: downloads > 10000 || likes > 100,
                image: '',
            } as AIEntry
        })
    } catch (err) {
        console.warn('[Fallback] HuggingFace live search failed:', err)
        return []
    }
}

/**
 * Main fallback: search both GitHub and HuggingFace in parallel
 * Called when the database returns fewer than `minResults` for a query
 */
export async function searchExternalFallback(
    query: string,
    existingResults: AIEntry[] = [],
    maxResults = 20
): Promise<FallbackResult> {
    if (!query || query.trim().length < 2) {
        return { results: existingResults, source: 'database', query }
    }

    // Search both in parallel
    const [githubResults, hfResults] = await Promise.allSettled([
        searchGitHubLive(query, 15),
        searchHuggingFaceLive(query, 10),
    ])

    const github = githubResults.status === 'fulfilled' ? githubResults.value : []
    const hf = hfResults.status === 'fulfilled' ? hfResults.value : []

    // Combine: existing DB results first, then external results
    const existingNames = new Set(existingResults.map(r => r.name.toLowerCase()))

    // Deduplicate externals against existing results
    const newGithub = github.filter(r => !existingNames.has(r.name.toLowerCase()))
    const newHf = hf.filter(r => !existingNames.has(r.name.toLowerCase()))

    // Interleave GitHub and HuggingFace for variety
    const external: AIEntry[] = []
    const maxEach = Math.ceil(maxResults / 2)
    for (let i = 0; i < maxEach; i++) {
        if (i < newGithub.length) external.push(newGithub[i])
        if (i < newHf.length) external.push(newHf[i])
    }

    const combined = [...existingResults, ...external].slice(0, maxResults)
    const source = existingResults.length > 0 ? 'database+external' : 'external'

    return { results: combined, source, query }
}
