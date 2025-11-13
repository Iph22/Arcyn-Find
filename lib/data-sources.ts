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
        console.error('Error fetching from source:', result.reason)
      }
    })

    // Merge and deduplicate models
    return mergeAndDeduplicate(allModels)
  } catch (error) {
    console.error('Error fetching AI models:', error)
    return []
  }
}

/**
 * Fetches models from Hugging Face API
 */
async function fetchFromHuggingFace(): Promise<AIEntry[]> {
  try {
    const response = await fetch(
      'https://huggingface.co/api/models?filter=text-generation&sort=downloads&direction=-1&limit=50',
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    )

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status}`)
    }

    const data = await response.json()
    return data.map((model: any, index: number) => transformHuggingFaceModel(model, index))
  } catch (error) {
    console.error('Error fetching from Hugging Face:', error)
    return []
  }
}

/**
 * Transforms Hugging Face model to AIEntry format
 */
function transformHuggingFaceModel(model: any, index: number): AIEntry {
  const categories: Record<string, string> = {
    'text-generation': 'Generative AI',
    'text2text-generation': 'Generative AI',
    'image-generation': 'Computer Vision',
    'image-classification': 'Computer Vision',
    'object-detection': 'Computer Vision',
    'automatic-speech-recognition': 'NLP/Audio',
    'text-to-speech': 'Audio/NLP',
  }

  return {
    id: `hf-${model.id || index}`,
    name: model.id?.split('/').pop() || 'Unknown Model',
    category: categories[model.pipeline_tag || ''] || 'Generative AI',
    description: model.modelId || model.id || 'AI model from Hugging Face',
    platform: `https://huggingface.co/${model.id}`,
    region: 'Global',
    accessType: 'Free' as const,
    pricing: 'Free / Open source',
    tags: [
      model.pipeline_tag || 'ai-model',
      ...(model.tags || []).slice(0, 3),
    ],
    popularity: Math.min(100, Math.max(50, (model.downloads || 0) / 10000)),
    lastUpdated: model.updatedAt || new Date().toISOString().split('T')[0],
    isTrending: (model.downloads || 0) > 100000,
  }
}

/**
 * Fetches models from Papers with Code API
 */
async function fetchFromPapersWithCode(): Promise<AIEntry[]> {
  try {
    const response = await fetch(
      'https://paperswithcode.com/api/v1/models/?ordering=-stars&page_size=50',
      {
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    )

    if (!response.ok) {
      throw new Error(`Papers with Code API error: ${response.status}`)
    }

    const data = await response.json()
    return data.results?.map((model: any, index: number) =>
      transformPapersWithCodeModel(model, index)
    ) || []
  } catch (error) {
    console.error('Error fetching from Papers with Code:', error)
    return []
  }
}

/**
 * Transforms Papers with Code model to AIEntry format
 */
function transformPapersWithCodeModel(model: any, index: number): AIEntry {
  return {
    id: `pwc-${model.id || index}`,
    name: model.name || 'Unknown Model',
    category: model.tasks?.[0]?.task?.name || 'Generative AI',
    description: model.description || 'AI model from Papers with Code',
    platform: model.url || `https://paperswithcode.com/model/${model.name}`,
    region: 'Global',
    accessType: model.is_pretrained ? ('Free' as const) : ('Paid' as const),
    pricing: model.is_pretrained ? 'Free / Open source' : 'Research / Commercial',
    tags: [
      'research',
      'papers-with-code',
      ...(model.tasks?.map((t: any) => t.task?.name) || []).slice(0, 2),
    ],
    popularity: Math.min(100, Math.max(50, (model.stars || 0) / 100)),
    lastUpdated: model.published_date || new Date().toISOString().split('T')[0],
    isTrending: (model.stars || 0) > 1000,
  }
}

/**
 * Fetches research papers from ArXiv API
 */
async function fetchFromArXiv(): Promise<AIEntry[]> {
  try {
    const response = await fetch(
      'http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&max_results=30&sortBy=submittedDate&sortOrder=descending',
      {
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    )

    if (!response.ok) {
      throw new Error(`ArXiv API error: ${response.status}`)
    }

    const xml = await response.text()
    return parseArXivResults(xml)
  } catch (error) {
    console.error('Error fetching from ArXiv:', error)
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

  while ((match = entryRegex.exec(xml)) !== null && index < 20) {
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
 * Fetches open-source AI models from GitHub
 */
async function fetchFromGitHub(): Promise<AIEntry[]> {
  try {
    const response = await fetch(
      'https://api.github.com/search/repositories?q=language:python+topic:ai-model+topic:ml+stars:>100&sort=stars&order=desc&per_page=30',
      {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data = await response.json()
    return data.items?.map((repo: any, index: number) =>
      transformGitHubRepo(repo, index)
    ) || []
  } catch (error) {
    console.error('Error fetching from GitHub:', error)
    return []
  }
}

/**
 * Transforms GitHub repository to AIEntry format
 */
function transformGitHubRepo(repo: any, index: number): AIEntry {
  const categories: Record<string, string> = {
    'llm': 'Generative AI',
    'language-model': 'Generative AI',
    'image-generation': 'Computer Vision',
    'computer-vision': 'Computer Vision',
    'nlp': 'NLP Platform',
    'speech': 'NLP/Audio',
  }

  const category = repo.topics
    ?.map((topic: string) => categories[topic])
    .find((cat: string) => cat) || 'Generative AI'

  return {
    id: `gh-${repo.id}`,
    name: repo.name,
    category,
    description: repo.description || 'Open-source AI model from GitHub',
    platform: repo.html_url,
    region: 'Global',
    accessType: 'Free' as const,
    pricing: 'Free / Open source',
    tags: [
      'open-source',
      'github',
      ...(repo.topics || []).slice(0, 3),
    ],
    popularity: Math.min(100, Math.max(50, Math.log10(repo.stargazers_count + 1) * 20)),
    lastUpdated: repo.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    isTrending: repo.stargazers_count > 5000,
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

