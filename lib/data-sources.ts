import { AIEntry } from './ai-data'

/**
 * Fetches AI models from multiple external sources and merges them
 */
export async function fetchAIModelsFromSources(): Promise<AIEntry[]> {
  const sources: Promise<AIEntry[]>[] = []

  // Fetch from multiple sources in parallel
  if (process.env.HUGGINGFACE_API_KEY) {
    sources.push(fetchFromHuggingFace())
  }

  sources.push(fetchFromPapersWithCode())
  sources.push(fetchFromArXiv())

  if (process.env.GITHUB_TOKEN) {
    sources.push(fetchFromGitHub())
  }

  try {
    const results = await Promise.allSettled(sources)
    const allModels: AIEntry[] = []

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allModels.push(...result.value)
      } else {
        // Silently fail - individual source failures shouldn't break the whole fetch
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('Error fetching from source:', result.reason?.message || result.reason)
        }
      }
    })

    // Merge and deduplicate models
    return mergeAndDeduplicate(allModels)
  } catch (error) {
    // Silently fail - return empty array on error
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('Error fetching AI models:', error)
    }
    return []
  }
}

/**
 * Fetches models from Hugging Face API — searches across ALL major categories
 */
async function fetchFromHuggingFace(): Promise<AIEntry[]> {
  // Search across multiple model categories instead of just text-generation
  const categories = [
    'text-generation',
    'text-to-image',
    'image-to-text',
    'automatic-speech-recognition',
    'text-to-speech',
    'text-classification',
    'summarization',
    'translation',
    'image-classification',
    'object-detection',
    'text2text-generation',
    'fill-mask',
    'zero-shot-classification',
    'video-classification',
  ]

  const allModels: AIEntry[] = []

  for (const category of categories) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      const response = await fetch(
        `https://huggingface.co/api/models?filter=${category}&sort=downloads&direction=-1&limit=30`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          },
          next: { revalidate: 3600 },
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) continue

      const data = await response.json()
      const models = data.map((model: any, index: number) =>
        transformHuggingFaceModel(model, allModels.length + index)
      )
      allModels.push(...models)
    } catch {
      // Skip this category on error, continue with others
      continue
    }
  }

  console.log(`[HuggingFace] Fetched ${allModels.length} models across ${categories.length} categories`)
  return allModels
}

/**
 * Transforms Hugging Face model to AIEntry format
 */
function transformHuggingFaceModel(model: any, index: number): AIEntry {
  const categoryMapping: Record<string, string> = {
    'text-generation': 'Generative AI',
    'text2text-generation': 'Generative AI',
    'text-to-image': 'Image Generation',
    'image-to-text': 'Computer Vision',
    'image-classification': 'Computer Vision',
    'image-generation': 'Image Generation',
    'object-detection': 'Computer Vision',
    'video-classification': 'Computer Vision',
    'automatic-speech-recognition': 'Audio & Music',
    'text-to-speech': 'Audio & Music',
    'text-classification': 'NLP & Text Analysis',
    'summarization': 'Writing & Content',
    'translation': 'Translation & Language',
    'fill-mask': 'NLP & Text Analysis',
    'zero-shot-classification': 'NLP & Text Analysis',
  }

  const modelName = model.id?.split('/').pop() || 'Unknown Model'
  const author = model.id?.split('/')[0] || ''
  const description = model.cardData?.text ||
    `${modelName} — ${model.pipeline_tag || 'AI'} model by ${author} on Hugging Face. ${(model.downloads || 0).toLocaleString()} downloads.`

  return {
    id: `hf-${model.id?.replace(/\//g, '-') || index}`,
    name: modelName,
    category: categoryMapping[model.pipeline_tag || ''] || 'Generative AI',
    description: description.substring(0, 300),
    platform: `https://huggingface.co/${model.id}`,
    region: 'Global',
    accessType: 'Free' as const,
    pricing: 'Free / Open source',
    tags: [
      model.pipeline_tag || 'ai-model',
      'huggingface',
      'open-source',
      ...(model.tags || []).slice(0, 3),
    ],
    popularity: Math.min(100, Math.max(30, Math.log10((model.downloads || 1) + 1) * 12)),
    lastUpdated: model.updatedAt || new Date().toISOString().split('T')[0],
    isTrending: (model.downloads || 0) > 100000,
  }
}

/**
 * Fetches models from Papers with Code API
 */
async function fetchFromPapersWithCode(): Promise<AIEntry[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(
      'https://paperswithcode.com/api/v1/papers/?ordering=-stars&page_size=20',
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(`Papers with Code API returned status ${response.status}`)
      return []
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('Papers with Code API returned non-JSON response')
      return []
    }

    const data = await response.json()

    if (!data.results || !Array.isArray(data.results)) {
      console.warn('Papers with Code API returned unexpected format')
      return []
    }

    return data.results
      .slice(0, 10)
      .map((paper: any, index: number) => transformPapersWithCodePaper(paper, index))
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Papers with Code API request timed out')
    } else {
      console.error('Error fetching from Papers with Code:', error)
    }
    return []
  }
}

/**
 * Transforms Papers with Code paper to AIEntry format
 */
function transformPapersWithCodePaper(paper: any, index: number): AIEntry {
  return {
    id: `pwc-${paper.id || index}`,
    name: paper.title || 'Research Paper',
    category: 'Research Paper',
    description: paper.abstract?.substring(0, 200) + '...' || 'Research paper from Papers with Code',
    platform: paper.url_pdf || paper.paper_url || `https://paperswithcode.com/paper/${paper.id}`,
    region: 'Global',
    accessType: 'Free' as const,
    pricing: 'Free / Open access',
    tags: [
      'research-paper',
      'papers-with-code',
      ...(paper.tasks?.slice(0, 2) || []),
    ],
    popularity: Math.min(100, Math.max(50, 70 + index * 2)),
    lastUpdated: paper.published || new Date().toISOString().split('T')[0],
    isTrending: index < 3,
  }
}

/**
 * Fetches research papers from ArXiv API
 */
async function fetchFromArXiv(): Promise<AIEntry[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(
      'http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&max_results=15&sortBy=submittedDate&sortOrder=descending',
      {
        next: { revalidate: 3600 }, // Cache for 1 hour
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(`ArXiv API returned status ${response.status}`)
      return []
    }

    const xml = await response.text()
    return parseArXivResults(xml)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('ArXiv API request timed out')
    } else {
      console.error('Error fetching from ArXiv:', error)
    }
    return []
  }
}

/**
 * Parses ArXiv XML results and transforms to AIEntry format
 */
function parseArXivResults(xml: string): AIEntry[] {
  const entries: AIEntry[] = []

  // Simple XML parsing (for production, consider using a proper XML parser)
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match
  let index = 0

  while ((match = entryRegex.exec(xml)) !== null && index < 10) {
    const entryXml = match[1]
    const titleMatch = entryXml.match(/<title>(.*?)<\/title>/)
    const summaryMatch = entryXml.match(/<summary>(.*?)<\/summary>/)
    const idMatch = entryXml.match(/<id>(.*?)<\/id>/)
    const publishedMatch = entryXml.match(/<published>(.*?)<\/published>/)
    const authorsMatch = entryXml.match(/<author><name>(.*?)<\/name><\/author>/)

    if (titleMatch && idMatch) {
      const arxivId = idMatch[1].split('/').pop()?.replace('.v', '') || ''
      entries.push({
        id: `arxiv-${arxivId}`,
        name: titleMatch[1].replace(/\n/g, ' ').trim(),
        category: 'Research Paper',
        description: (summaryMatch?.[1] || titleMatch[1]).replace(/\n/g, ' ').substring(0, 200).trim() + '...',
        platform: `https://arxiv.org/abs/${arxivId}`,
        region: 'Global',
        accessType: 'Free' as const,
        pricing: 'Free / Open access',
        tags: ['research-paper', 'arxiv', authorsMatch?.[1]?.split(' ')[0] || 'ai'].filter(Boolean),
        popularity: Math.max(50, 100 - index * 2),
        lastUpdated: publishedMatch?.[1]?.split('T')[0] || new Date().toISOString().split('T')[0],
        isTrending: index < 5,
      })
      index++
    }
  }

  return entries
}

/**
 * Fetches open-source AI tools from GitHub — multiple search queries across many topics
 */
async function fetchFromGitHub(): Promise<AIEntry[]> {
  // Multiple search queries to cover the full AI tool landscape
  const searchQueries = [
    { q: 'topic:ai-tools+stars:>50', category: 'AI Agents' },
    { q: 'topic:llm+stars:>100', category: 'Generative AI' },
    { q: 'topic:generative-ai+stars:>50', category: 'Generative AI' },
    { q: 'topic:chatbot+stars:>50', category: 'ChatBots' },
    { q: 'topic:stable-diffusion+stars:>50', category: 'Image Generation' },
    { q: 'topic:text-to-speech+stars:>30', category: 'Audio & Music' },
    { q: 'topic:code-assistant+stars:>50', category: 'Code & Development' },
    { q: 'topic:ai-agent+stars:>30', category: 'AI Agents' },
    { q: 'topic:computer-vision+stars:>100', category: 'Computer Vision' },
    { q: 'topic:nlp+stars:>100', category: 'NLP & Text Analysis' },
    { q: 'topic:machine-learning+topic:tool+stars:>50', category: 'Data & Analytics' },
    { q: 'topic:ai-powered+stars:>30', category: 'Productivity' },
  ]

  const allRepos: AIEntry[] = []

  for (const search of searchQueries) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(search.q)}&sort=stars&order=desc&per_page=30`,
        {
          headers: {
            ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {}),
            'Accept': 'application/vnd.github.v3+json',
          },
          next: { revalidate: 3600 },
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        // GitHub rate limits — wait and skip
        if (response.status === 403) {
          console.warn(`[GitHub] Rate limited on query: ${search.q}`)
          break
        }
        continue
      }

      const data = await response.json()

      if (data.items && Array.isArray(data.items)) {
        const repos = data.items.map((repo: any, index: number) =>
          transformGitHubRepo(repo, allRepos.length + index, search.category)
        )
        allRepos.push(...repos)
      }
    } catch {
      continue
    }
  }

  console.log(`[GitHub] Fetched ${allRepos.length} repos across ${searchQueries.length} queries`)
  return allRepos
}

/**
 * Transforms GitHub repository to AIEntry format
 */
function transformGitHubRepo(repo: any, index: number, defaultCategory?: string): AIEntry {
  const topicCategoryMap: Record<string, string> = {
    'llm': 'Generative AI',
    'large-language-model': 'Generative AI',
    'language-model': 'Generative AI',
    'generative-ai': 'Generative AI',
    'image-generation': 'Image Generation',
    'stable-diffusion': 'Image Generation',
    'text-to-image': 'Image Generation',
    'computer-vision': 'Computer Vision',
    'nlp': 'NLP & Text Analysis',
    'natural-language-processing': 'NLP & Text Analysis',
    'speech': 'Audio & Music',
    'text-to-speech': 'Audio & Music',
    'chatbot': 'ChatBots',
    'ai-agent': 'AI Agents',
    'ai-agents': 'AI Agents',
    'autonomous-agents': 'AI Agents',
    'code-assistant': 'Code & Development',
    'coding': 'Code & Development',
    'productivity': 'Productivity',
    'machine-learning': 'Data & Analytics',
    'data-science': 'Data & Analytics',
    'video': 'Video Generation',
  }

  const category = repo.topics
    ?.map((topic: string) => topicCategoryMap[topic])
    .find((cat: string | undefined) => cat) || defaultCategory || 'Generative AI'

  return {
    id: `gh-${repo.id}`,
    name: repo.name,
    category,
    description: (repo.description || 'Open-source AI tool from GitHub').substring(0, 300),
    platform: repo.html_url,
    region: 'Global',
    accessType: 'Free' as const,
    pricing: 'Free / Open source',
    tags: [
      'open-source',
      'github',
      ...(repo.topics || []).slice(0, 5),
    ],
    popularity: Math.min(100, Math.max(30, Math.log10(repo.stargazers_count + 1) * 18)),
    lastUpdated: repo.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    isTrending: repo.stargazers_count > 3000,
  }
}

/**
 * Merges and deduplicates AI entries based on name similarity
 */
function mergeAndDeduplicate(entries: AIEntry[]): AIEntry[] {
  const seen = new Map<string, AIEntry>()
  const merged: AIEntry[] = []

  for (const entry of entries) {
    const key = entry.name.toLowerCase().trim()

    if (seen.has(key)) {
      // Merge with existing entry, keeping the one with higher popularity
      const existing = seen.get(key)!
      if (entry.popularity > existing.popularity) {
        seen.set(key, entry)
        const index = merged.findIndex((e) => e.id === existing.id)
        if (index !== -1) {
          merged[index] = entry
        }
      }
    } else {
      seen.set(key, entry)
      merged.push(entry)
    }
  }

  // Sort by popularity descending
  return merged.sort((a, b) => b.popularity - a.popularity)
}