/**
 * The app's category vocabulary.
 *
 * Moved out of components/tools/tools-browser.tsx so it can be checked by a
 * script. The failure this guards against is silent: an in-app tile links to
 * `/browse?category=<slug>`, the browser fails to resolve that slug, and it
 * falls back to "All" -- so the user clicks "Image Generation" and gets the
 * unfiltered list, with nothing in the UI admitting that the filter was
 * dropped. Nothing about that shows up in a type check.
 *
 * TWO VOCABULARIES, AND NEITHER IS THE OTHER'S SLUG
 *
 * The catalog layer (lib/seo/catalog.ts, /api/categories) speaks raw
 * `ai_tools.category` values and slugifies them: "Marketing & Sales" becomes
 * `marketing-sales`. The browser speaks display names, where that same
 * category is "Marketing" and slugifies to `marketing`. Links get built from
 * the first and consumed by the second, so both have to be indexed.
 */

import { slugify } from './seo/slug'

/**
 * Database category value -> the display name the browser shows for it.
 * Based on the actual category values in the corpus.
 */
export const categoryMapping: Record<string, string> = {
  'Generative AI': 'Generative AI',
  'Research & Open Source': 'Research & Open Source',
  ChatBots: 'Chatbots',
  Productivity: 'Productivity',
  'Image Generation': 'Image Generation',
  'Writing & Content': 'Writing & Content',
  'Audio & Music': 'Audio & Music',
  'Marketing & Sales': 'Marketing',
  'Learning & Education': 'Education',
  'Video Generation': 'Video Generation',
  'Data & Analytics': 'Data & Analytics',
  'Code & Development': 'Code & Development',
  'Translation & Language': 'Translation',
  Finance: 'Finance',
  Healthcare: 'Healthcare',
  'Customer Service': 'Customer Service',
  'Gaming & Entertainment': 'Gaming',
  'NLP & Text Analysis': 'NLP & Text',
  'AI Agents': 'AI Agents',
  '3D & Spatial': '3D & Spatial',
  'Computer Vision': 'Computer Vision',
}

/**
 * Display name -> the database values to query for it.
 *
 * Not simply the inverse of the above: one display name can cover several
 * database spellings, and the API applies OR logic across them.
 */
export const reverseCategoryMapping: Record<string, string[]> = {
  'Generative AI': ['Generative AI'],
  Chatbots: ['ChatBots'],
  'Image Generation': ['Image Generation'],
  'Video Generation': ['Video Generation'],
  'Audio & Music': ['Audio & Music'],
  'Writing & Content': ['Writing & Content'],
  'Code & Development': ['Code & Development'],
  Productivity: ['Productivity'],
  'Data & Analytics': ['Data & Analytics'],
  Marketing: ['Marketing & Sales'],
  Education: ['Learning & Education'],
  Research: ['Research & Open Source'],
  'AI Agents': ['AI Agents'],
  'AI Detection': ['AI Detection'],
  'HR & Recruiting': ['HR & Recruiting'],
  Translation: ['Translation & Language'],
  'NLP & Text': ['NLP & Text Analysis'],
  'Customer Service': ['Customer Service'],
  Finance: ['Finance'],
  Healthcare: ['Healthcare'],
  Gaming: ['Gaming & Entertainment'],
  '3D & Spatial': ['3D & Spatial'],
  'Computer Vision': ['Computer Vision'],
}

/** The curated chip row, in the order it is rendered. */
export const displayCategories = [
  'All',
  'AI Agents', // 18.3% - Autonomous AI agents
  'Code & Development', // 17.7% - Coding tools, IDEs
  'Chatbots', // 10.2% - ChatGPT, Claude, etc.
  'Writing & Content', // 8.8% - Content creation
  'Image Generation', // 8.4% - DALL-E, Midjourney, etc.
  'Productivity', // 6.0% - Workflow automation
  'Audio & Music', // 4.7% - Voice, music, audio
  'Data & Analytics', // 4.0% - Data analysis
  'Education', // 3.7% - Learning tools
  'Marketing', // 3.2% - Marketing tools
  'Video Generation', // 2.3% - Video AI tools
  'AI Detection', // 1.3% - GPTZero, Originality.ai, etc.
  'HR & Recruiting', // 1.7% - Resume builders, interview prep
  'Customer Service', // 1.4% - Support tools
  'Translation', // 1.2% - Translation tools
  'Research', // 3.5% - Research & Open Source
]

/**
 * A category slug from anywhere else in the app -> the display category the
 * browser filters on.
 *
 * Database names are indexed last so they win on collision, because that is
 * what /api/categories emits and therefore what every in-app link carries.
 */
export const CATEGORY_SLUG_TO_DISPLAY: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const display of displayCategories) {
    if (display !== 'All') map[slugify(display)] = display
  }
  for (const [dbName, display] of Object.entries(categoryMapping)) {
    map[slugify(dbName)] = display
  }
  return map
})()

/** The display category for a slug, or "All" when it does not resolve. */
export function displayCategoryForSlug(slug: string | null | undefined): string {
  return CATEGORY_SLUG_TO_DISPLAY[(slug || '').trim()] || 'All'
}
