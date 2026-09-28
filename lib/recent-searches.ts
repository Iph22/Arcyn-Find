/**
 * The signed-in user's own recent searches.
 *
 * Stored in localStorage rather than in Postgres, deliberately.
 *
 * The only search history the database keeps is `search_cache`, which is
 * global: `increment_search_count(query_text)` upserts on the query string
 * with no user column. It can answer "what is popular across the site", but
 * not "what did I search". Rendering it under a heading that says *Recent*
 * would be wrong twice over -- it is neither recent nor the reader's -- and it
 * would put one visitor's raw query text on every other visitor's home page,
 * which is a moderation surface nobody is watching.
 *
 * Local storage is genuinely per-user, needs no round trip, and cannot leak
 * between accounts on different machines. The cost is that history does not
 * follow a user to a second device. For a convenience shortcut that is the
 * right trade; if it ever needs to sync, it needs a real per-user table with
 * its own retention and delete-account handling.
 */

const STORAGE_KEY = 'arcyn:recent-searches'
const MAX_ENTRIES = 5

/**
 * localStorage is not always reachable: it throws on access in a blocked-
 * cookies context and in some private modes, and it is absent during SSR.
 * Every accessor here is wrapped, and every failure degrades to "no history"
 * rather than taking the page down with it.
 */
function read(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  } catch {
    return []
  }
}

export function getRecentSearches(): string[] {
  return read().slice(0, MAX_ENTRIES)
}

/**
 * Record a query, most recent first, de-duplicated case-insensitively.
 *
 * Returns the new list so a caller can set state from it without a second
 * read -- the write and the render then cannot disagree.
 */
export function addRecentSearch(query: string): string[] {
  const trimmed = query.trim()
  if (!trimmed) return getRecentSearches()

  const key = trimmed.toLowerCase()
  const next = [trimmed, ...read().filter((q) => q.toLowerCase() !== key)].slice(0, MAX_ENTRIES)

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Quota or blocked storage. The in-memory list still updates for this
      // session; only persistence is lost.
    }
  }
  return next
}

export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do -- if it cannot be removed it could not have been written.
  }
}

/**
 * Shown before a user has searched anything, so the panel is not an empty box
 * on a first visit. Labelled as suggestions in the UI, never as history.
 */
export const STARTER_SEARCHES = [
  'summarize long documents',
  'generate images from text',
  'write code from a description',
] as const
