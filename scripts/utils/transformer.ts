/**
 * Transform utilities for converting external data to AIEntry format
 */

import type { AIEntry } from '../../lib/ai-data'

/**
 * Category mapping from various sources to our standard categories
 */
export const categoryMap: Record<string, string> = {
  // Text & Content Generation
  'text-generation': 'Text Generation',
  'text generation': 'Text Generation',
  'ai-writing': 'Text Generation',
  'ai writing': 'Text Generation',
  'content-generation': 'Text Generation',
  'content generation': 'Text Generation',
  'writing': 'Text Generation',
  'chat': 'Generative AI',
  'chatbot': 'ChatBots',
  'conversational-ai': 'ChatBots',
  'conversational ai': 'ChatBots',
  'llm': 'Generative AI',
  'language-model': 'Generative AI',
  'language model': 'Generative AI',
  'generative-ai': 'Generative AI',
  'generative ai': 'Generative AI',
  
  // Image & Visual
  'image-generation': 'Image Generation',
  'image generation': 'Image Generation',
  'image-editing': 'Computer Vision',
  'image editing': 'Computer Vision',
  'image-recognition': 'Computer Vision',
  'image recognition': 'Computer Vision',
  'computer-vision': 'Computer Vision',
  'computer vision': 'Computer Vision',
  'vision': 'Computer Vision',
  'image': 'Image Generation',
  
  // Audio & Speech
  'audio': 'Audio/NLP',
  'speech': 'Audio/NLP',
  'voice': 'Audio/NLP',
  'tts': 'Audio/NLP',
  'stt': 'Audio/NLP',
  'nlp': 'NLP Platform',
  'nlp-platform': 'NLP Platform',
  'nlp platform': 'NLP Platform',
  'transcription': 'Audio/NLP',
  'audio-nlp': 'Audio/NLP',
  'audio/nlp': 'Audio/NLP',
  
  // Code & Development
  'code': 'Code Generation',
  'coding': 'Code Generation',
  'programming': 'Code Generation',
  'developer': 'Code Generation',
  'code-assistant': 'Code Generation',
  'code assistant': 'Code Generation',
  'code-generation': 'Code Generation',
  'code generation': 'Code Generation',
  'ide': 'IDE',
  'ides': 'IDE',
  'development-environment': 'IDE',
  'development environment': 'IDE',
  'integrated-development-environment': 'IDE',
  'integrated development environment': 'IDE',
  'editor': 'IDE',
  'ai-coding-agents': 'AI Coding Agents',
  'ai coding agents': 'AI Coding Agents',
  'coding-agents': 'AI Coding Agents',
  'coding agents': 'AI Coding Agents',
  'code-agent': 'AI Coding Agents',
  'code agent': 'AI Coding Agents',
  'mcp': 'AI Coding Agents',
  'model-context-protocol': 'AI Coding Agents',
  'model context protocol': 'AI Coding Agents',
  
  // Video
  'video': 'Video Generation',
  'video-editing': 'Video Generation',
  'video editing': 'Video Generation',
  'video-generation': 'Video Generation',
  'video generation': 'Video Generation',
  'audio-video-processing': 'Audio/Video Processing',
  'audio/video processing': 'Audio/Video Processing',
  
  // Data & Analytics
  'data-analytics': 'Data Analytics',
  'data analytics': 'Data Analytics',
  'data-analysis': 'Data Analytics',
  'data analysis': 'Data Analytics',
  'ml-infrastructure': 'ML Infrastructure',
  'ml infrastructure': 'ML Infrastructure',
  'mlops': 'ML Infrastructure',
  'infrastructure': 'ML Infrastructure',
  'api': 'ML Infrastructure',
  
  // Research & Education
  'education': 'Learning & Education',
  'learning': 'Learning & Education',
  'learning-education': 'Learning & Education',
  'learning & education': 'Learning & Education',
  'study': 'Learning & Education',
  'tutoring': 'Learning & Education',
  'academic': 'Learning & Education',
  'search': 'Search/QA',
  'qa': 'Search/QA',
  'question-answering': 'Search/QA',
  'question answering': 'Search/QA',
  'research': 'Research',
  'search-qa': 'Search/QA',
  'search/qa': 'Search/QA',
  
  // Multimodal
  'multimodal': 'Multimodal Platform',
  'multi-modal': 'Multimodal Platform',
  'multimodal-platform': 'Multimodal Platform',
  'multimodal platform': 'Multimodal Platform',
  
  // Automation & Productivity
  'automation': 'Autonomous AI',
  'agent': 'Autonomous AI',
  'autonomous-ai': 'Autonomous AI',
  'autonomous ai': 'Autonomous AI',
  'workflow': 'Productivity',
  'productivity': 'Productivity',
  'business-automation': 'Productivity',
  'business automation': 'Productivity',
  
  // Marketing & Design
  'marketing': 'Marketing',
  'marketing-automation': 'Marketing',
  'marketing automation': 'Marketing',
  'design': 'Design',
  'design-assistance': 'Design',
  'design assistance': 'Design',
  
  // AI Detection
  'ai-detection': 'AI Detection Tool',
  'ai detection': 'AI Detection Tool',
  'detection': 'AI Detection Tool',
  'plagiarism': 'AI Detection Tool',
  'ai-detection-tool': 'AI Detection Tool',
  'ai detection tool': 'AI Detection Tool',
}

/**
 * Map category from external source to our standard category
 */
export function mapCategory(externalCategory: string): string {
  const normalized = externalCategory.toLowerCase().trim()
  return categoryMap[normalized] || 'Generative AI'
}

/**
 * Determine access type from pricing information
 */
export function determineAccessType(pricing?: string, tags?: string[]): 'Free' | 'Freemium' | 'Paid' {
  if (!pricing && !tags) return 'Free'
  
  const text = `${pricing || ''} ${tags?.join(' ') || ''}`.toLowerCase()
  
  if (text.includes('free') && (text.includes('paid') || text.includes('premium') || text.includes('pro'))) {
    return 'Freemium'
  }
  
  if (text.includes('paid') || text.includes('premium') || text.includes('pro') || text.includes('subscription')) {
    return 'Paid'
  }
  
  return 'Free'
}

/**
 * Determine region from URL or other indicators
 */
export function determineRegion(url?: string, tags?: string[]): string {
  if (!url && !tags) return 'Global'
  
  const text = `${url || ''} ${tags?.join(' ') || ''}`.toLowerCase()
  
  if (text.includes('.uk') || text.includes('europe') || text.includes('eu')) return 'EU'
  if (text.includes('.ca')) return 'Canada'
  if (text.includes('.cn') || text.includes('china')) return 'China'
  if (text.includes('.ae') || text.includes('uae')) return 'UAE'
  if (text.includes('.il') || text.includes('israel')) return 'Israel'
  if (text.includes('.us') || text.includes('usa') || text.includes('united states')) return 'USA'
  
  return 'Global'
}

/**
 * Generate a unique ID from name and source
 */
export function generateId(name: string, source: string, index?: number): string {
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
  
  const sourcePrefix = source.substring(0, 10).toLowerCase().replace(/[^a-z0-9]/g, '-')
  const suffix = index !== undefined ? `-${index}` : ''
  
  return `${sourcePrefix}-${cleanName}${suffix}`
}

/**
 * Extract tags from description and other fields
 */
export function extractTags(description?: string, category?: string, name?: string): string[] {
  const tags: string[] = []
  const text = `${description || ''} ${category || ''} ${name || ''}`.toLowerCase()
  
  // Common AI-related tags
  const commonTags = [
    'ai', 'artificial-intelligence', 'machine-learning', 'ml', 'deep-learning',
    'nlp', 'computer-vision', 'generative-ai', 'llm', 'chatbot', 'automation'
  ]
  
  for (const tag of commonTags) {
    if (text.includes(tag)) {
      tags.push(tag)
    }
  }
  
  // Add category as tag
  if (category) {
    tags.push(category.toLowerCase().replace(/\s+/g, '-'))
  }
  
  return [...new Set(tags)].slice(0, 5) // Limit to 5 tags
}

/**
 * Clean and truncate description
 */
export function cleanDescription(description: string, maxLength: number = 500): string {
  return description
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength)
    .replace(/\s+\S*$/, '') // Don't cut in the middle of a word
    + (description.length > maxLength ? '...' : '')
}

/**
 * Ensure popularity is an integer between 0 and 100
 */
export function normalizePopularity(popularity: number): number {
  return Math.max(0, Math.min(100, Math.round(popularity)))
}

