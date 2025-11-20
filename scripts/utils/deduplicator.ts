/**
 * Deduplication utilities for AI tools
 */

import type { AIEntry } from '../../lib/ai-data'

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  const len1 = str1.length
  const len2 = str2.length

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[len1][len2]
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '')
}

/**
 * Check if two URLs are similar (same domain)
 */
function isSimilarURL(url1: string, url2: string): boolean {
  try {
    const domain1 = new URL(url1).hostname.replace(/^www\./, '')
    const domain2 = new URL(url2).hostname.replace(/^www\./, '')
    return domain1 === domain2
  } catch {
    return false
  }
}

/**
 * Check if two AI entries are duplicates
 */
export function areDuplicates(entry1: AIEntry, entry2: AIEntry): boolean {
  // Check exact name match
  if (normalizeString(entry1.name) === normalizeString(entry2.name)) {
    return true
  }

  // Check URL similarity
  if (entry1.platform && entry2.platform && isSimilarURL(entry1.platform, entry2.platform)) {
    return true
  }

  // Check name similarity (Levenshtein distance)
  const name1 = normalizeString(entry1.name)
  const name2 = normalizeString(entry2.name)
  const distance = levenshteinDistance(name1, name2)
  const maxLength = Math.max(name1.length, name2.length)
  const similarity = 1 - distance / maxLength

  // If names are 85% similar, consider them duplicates
  if (similarity > 0.85) {
    return true
  }

  return false
}

/**
 * Deduplicate an array of AI entries
 */
export function deduplicateEntries(entries: AIEntry[]): AIEntry[] {
  const seen: AIEntry[] = []
  const duplicates: string[] = []

  for (const entry of entries) {
    const isDuplicate = seen.some(existing => areDuplicates(entry, existing))

    if (!isDuplicate) {
      seen.push(entry)
    } else {
      duplicates.push(entry.name)
    }
  }

  if (duplicates.length > 0 && process.env.NODE_ENV === 'development') {
    console.log(`Found ${duplicates.length} duplicates:`, duplicates.slice(0, 5))
  }

  return seen
}

/**
 * Merge entries, keeping the one with higher popularity
 */
export function mergeEntries(entries: AIEntry[]): AIEntry[] {
  const merged = new Map<string, AIEntry>()

  for (const entry of entries) {
    const key = normalizeString(entry.name)
    const existing = merged.get(key)

    if (!existing) {
      merged.set(key, entry)
    } else if (entry.popularity > existing.popularity) {
      // Keep the entry with higher popularity
      merged.set(key, entry)
    } else if (entry.description && entry.description.length > existing.description.length) {
      // If popularity is same, keep the one with more detailed description
      merged.set(key, entry)
    }
  }

  return Array.from(merged.values())
}

