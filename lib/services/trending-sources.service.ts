/**
 * Enhanced API-based Trending Sources
 * 
 * Uses reliable APIs instead of fragile web scraping where possible
 */

import { logger } from '@/lib/logger'

interface TrendingItem {
    name: string
    score: number
    source: string
}

const REQUEST_DELAY = 1000

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch trending from Hugging Face API (very reliable)
 */
export async function fetchHuggingFaceTrending(): Promise<TrendingItem[]> {
    try {
        await delay(REQUEST_DELAY)

        const response = await fetch('https://huggingface.co/api/models?sort=trending&limit=30', {
            headers: {
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) return []

        const models = await response.json()
        const trending: TrendingItem[] = []

        models.slice(0, 30).forEach((model: any, index: number) => {
            const name = model.modelId?.split('/').pop() || model.id
            if (name) {
                trending.push({
                    name: name.toLowerCase(),
                    score: (30 - index) * 2 + (model.downloads || 0) / 10000,
                    source: 'huggingface'
                })
            }
        })

        return trending
    } catch (error) {
        logger.error('[Trending:HuggingFace] Error:', error)
        return []
    }
}

/**
 * Fetch trending from GitHub API (reliable with rate limits)
 */
export async function fetchGitHubTrendingAPI(): Promise<TrendingItem[]> {
    try {
        await delay(REQUEST_DELAY)

        // Search for trending AI repos created/updated recently
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const dateStr = oneWeekAgo.toISOString().split('T')[0]

        const queries = [
            `topic:ai pushed:>${dateStr} stars:>50`,
            `topic:llm pushed:>${dateStr} stars:>50`,
            `topic:machine-learning pushed:>${dateStr} stars:>50`,
        ]

        const trending: TrendingItem[] = []

        for (const query of queries) {
            await delay(REQUEST_DELAY)

            try {
                const response = await fetch(
                    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=15`,
                    {
                        headers: {
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'ArcynFind/1.0'
                        },
                        signal: AbortSignal.timeout(10000),
                    }
                )

                if (!response.ok) continue

                const data = await response.json()

                data.items?.slice(0, 15).forEach((repo: any, index: number) => {
                    const name = repo.name?.toLowerCase()
                    if (name && !trending.find(t => t.name === name)) {
                        trending.push({
                            name,
                            score: (15 - index) * 1.5 + Math.min((repo.stargazers_count || 0) / 500, 20),
                            source: 'github'
                        })
                    }
                })
            } catch (error) {
                logger.error(`[Trending:GitHub] Query error for "${query}":`, error)
            }
        }

        return trending
    } catch (error) {
        logger.error('[Trending:GitHub] Error:', error)
        return []
    }
}

/**
 * Fetch trending from Hacker News API (official, very reliable)
 */
export async function fetchHackerNewsTrending(): Promise<TrendingItem[]> {
    try {
        await delay(REQUEST_DELAY)

        // Get top stories
        const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
            signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) return []

        const storyIds: number[] = await response.json()
        const trending: TrendingItem[] = []

        const aiKeywords = [
            'ai', 'gpt', 'llm', 'claude', 'gemini', 'openai', 'anthropic',
            'chatgpt', 'copilot', 'machine learning', 'deep learning',
            'neural', 'transformer', 'language model', 'stable diffusion',
            'midjourney', 'dall-e', 'sora', 'whisper', 'llama', 'mistral'
        ]

        // Check top 50 stories for AI content
        for (const id of storyIds.slice(0, 50)) {
            await delay(100) // Small delay between requests

            try {
                const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
                    signal: AbortSignal.timeout(5000),
                })

                if (!storyRes.ok) continue

                const story = await storyRes.json()
                if (!story || !story.title) continue

                const titleLower = story.title.toLowerCase()
                const isAI = aiKeywords.some(kw => titleLower.includes(kw))

                if (isAI) {
                    // Extract potential tool name
                    const toolName = extractToolNameFromTitle(story.title)
                    if (toolName) {
                        trending.push({
                            name: toolName,
                            score: (story.score || 0) * 0.1 + (story.descendants || 0) * 0.05,
                            source: 'hackernews'
                        })
                    }
                }
            } catch {
                // Skip failed story fetches
            }
        }

        return trending
    } catch (error) {
        logger.error('[Trending:HackerNews] Error:', error)
        return []
    }
}

/**
 * Extract tool name from a title
 */
function extractToolNameFromTitle(title: string): string | null {
    // Common AI tool name patterns
    const patterns = [
        /^([A-Z][a-zA-Z0-9-]+)\s*[:–-]/,
        /(?:Introducing|Announcing|Launching|New:?)\s+([A-Z][a-zA-Z0-9-]+)/i,
        /([A-Z][a-zA-Z0-9-]+)\s+(?:AI|GPT|LLM)/i,
        /^([A-Z][a-zA-Z0-9-]+)\s+/,
    ]

    for (const pattern of patterns) {
        const match = title.match(pattern)
        if (match && match[1]) {
            const name = match[1].trim()
            if (name.length >= 2 && name.length <= 30) {
                // Filter out common words
                const skipWords = ['the', 'a', 'an', 'new', 'how', 'why', 'what', 'when', 'show', 'ask', 'tell']
                if (!skipWords.includes(name.toLowerCase())) {
                    return name.toLowerCase()
                }
            }
        }
    }

    return null
}

/**
 * Fetch trending from Reddit JSON API (official)
 */
export async function fetchRedditTrending(): Promise<TrendingItem[]> {
    const subreddits = ['MachineLearning', 'ChatGPT', 'OpenAI', 'LocalLLaMA', 'artificial']
    const trending: TrendingItem[] = []

    for (const subreddit of subreddits) {
        await delay(REQUEST_DELAY)

        try {
            const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=15`, {
                headers: {
                    'User-Agent': 'ArcynFind/1.0 (Educational Research)'
                },
                signal: AbortSignal.timeout(10000),
            })

            if (!response.ok) continue

            const data = await response.json()
            const posts = data.data?.children || []

            posts.forEach((post: any, index: number) => {
                if (!post.data?.title) return

                const toolName = extractToolNameFromTitle(post.data.title)
                if (toolName && !trending.find(t => t.name === toolName)) {
                    trending.push({
                        name: toolName,
                        score: (15 - index) + (post.data.score || 0) * 0.05 + (post.data.num_comments || 0) * 0.02,
                        source: `reddit-${subreddit}`
                    })
                }
            })
        } catch (error) {
            logger.error(`[Trending:Reddit] r/${subreddit} error:`, error)
        }
    }

    return trending
}

/**
 * Fetch all trending data from reliable APIs
 */
export async function fetchAllReliableTrending(): Promise<{
    items: TrendingItem[]
    sources: Record<string, number>
}> {
    const [huggingFace, github, hackerNews, reddit] = await Promise.allSettled([
        fetchHuggingFaceTrending(),
        fetchGitHubTrendingAPI(),
        fetchHackerNewsTrending(),
        fetchRedditTrending()
    ])

    const allItems: TrendingItem[] = []
    const sources: Record<string, number> = {}

    if (huggingFace.status === 'fulfilled') {
        allItems.push(...huggingFace.value)
        sources.huggingFace = huggingFace.value.length
    }

    if (github.status === 'fulfilled') {
        allItems.push(...github.value)
        sources.github = github.value.length
    }

    if (hackerNews.status === 'fulfilled') {
        allItems.push(...hackerNews.value)
        sources.hackerNews = hackerNews.value.length
    }

    if (reddit.status === 'fulfilled') {
        allItems.push(...reddit.value)
        sources.reddit = reddit.value.length
    }

    return { items: allItems, sources }
}
