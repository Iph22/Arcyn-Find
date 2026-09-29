'use client'

/**
 * The tools the reader has picked out to compare, while they are still
 * browsing.
 *
 * localStorage, for the reasons lib/recent-searches.ts spells out: it is
 * genuinely per-user, needs no round trip, works signed-out, and cannot leak
 * between accounts. A comparison is a scratchpad -- you assemble it over a
 * minute of browsing and then look at it -- so it does not need to survive to
 * a second device, and giving it a table would mean giving it retention and
 * delete-account handling for no benefit.
 *
 * The URL is the other half of this. Once you are ON /compare, the query
 * string is the source of truth and this store is synced from it (see
 * components/compare/compare-sync.tsx), so a shared link and the tray can
 * never disagree about what is being compared.
 *
 * Only what the tray has to render is stored -- id, slug, name. The comparison
 * itself re-reads every row on the server, so a stale price or a renamed tool
 * cannot be served from a visitor's browser storage.
 */

import { useCallback, useSyncExternalStore } from 'react'

import { MAX_COMPARE } from './compare'

const STORAGE_KEY = 'arcyn:compare'

/** Broadcast within the tab; `storage` only fires in the OTHER tabs. Without
 *  this, adding from a card would not update the tray sitting next to it. */
const CHANGE_EVENT = 'arcyn:compare-change'

export interface CompareItem {
  id: string
  slug?: string | null
  name: string
}

/**
 * Stable empty reference. useSyncExternalStore compares snapshots by identity
 * and re-renders forever if the snapshot is a fresh `[]` each call, so both
 * the server snapshot and every failure path return THIS array.
 */
const EMPTY: readonly CompareItem[] = Object.freeze([])

/**
 * Snapshot cache, keyed on the raw string it was parsed from. getSnapshot runs
 * on every render; re-parsing is cheap but a new array identity each time is
 * the infinite-loop bug above, so the parse result is memoised until the
 * underlying string actually changes -- which also makes cross-tab `storage`
 * events work with no extra plumbing.
 */
let cachedRaw: string | null = null
let cachedItems: readonly CompareItem[] = EMPTY

function parse(raw: string | null): readonly CompareItem[] {
  if (!raw) return EMPTY
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY

    const items = parsed
      .filter((v): v is CompareItem => {
        if (!v || typeof v !== 'object') return false
        const item = v as Partial<CompareItem>
        return typeof item.id === 'string' && item.id.length > 0 && typeof item.name === 'string'
      })
      .slice(0, MAX_COMPARE)

    return items.length > 0 ? items : EMPTY
  } catch {
    return EMPTY
  }
}

function readRaw(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Blocked cookies, or a private mode that throws on access. No selection.
    return null
  }
}

function getSnapshot(): readonly CompareItem[] {
  const raw = readRaw()
  if (raw === cachedRaw) return cachedItems
  cachedRaw = raw
  cachedItems = parse(raw)
  return cachedItems
}

function getServerSnapshot(): readonly CompareItem[] {
  return EMPTY
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** Read the current selection outside React (the tray's link, mainly). */
export function getCompareSelection(): readonly CompareItem[] {
  return getSnapshot()
}

function write(items: readonly CompareItem[]): void {
  if (typeof window === 'undefined') return
  try {
    if (items.length === 0) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_COMPARE)))
  } catch {
    // Quota or blocked storage. The event below still fires, so the UI stays
    // consistent for this page view; only persistence across a reload is lost.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * Add a tool, or remove it if it is already selected.
 *
 * Returns what happened so the caller can say so -- 'full' is the one outcome
 * that needs explaining, because nothing visibly changes.
 */
export function toggleCompare(item: CompareItem): 'added' | 'removed' | 'full' {
  const current = getSnapshot()
  const existing = current.findIndex((t) => t.id === item.id)

  if (existing !== -1) {
    write(current.filter((_, i) => i !== existing))
    return 'removed'
  }
  if (current.length >= MAX_COMPARE) return 'full'

  write([...current, item])
  return 'added'
}

export function removeFromCompare(id: string): void {
  const current = getSnapshot()
  const next = current.filter((t) => t.id !== id)
  if (next.length !== current.length) write(next)
}

export function clearCompare(): void {
  if (getSnapshot().length > 0) write(EMPTY)
}

/**
 * Replace the selection wholesale.
 *
 * Used when /compare resolves its query string: the URL wins, so a link
 * someone shared does not silently merge into whatever the recipient had
 * sitting in their tray. No-ops when the set is already identical, so it can
 * run in an effect without looping.
 */
export function setCompareSelection(items: readonly CompareItem[]): void {
  const current = getSnapshot()
  const next = items.slice(0, MAX_COMPARE)
  const same =
    current.length === next.length && current.every((tool, i) => tool.id === next[i].id)
  if (!same) write(next)
}

export interface CompareSelection {
  items: readonly CompareItem[]
  count: number
  isFull: boolean
  isSelected: (id: string) => boolean
  toggle: (item: CompareItem) => 'added' | 'removed' | 'full'
  remove: (id: string) => void
  clear: () => void
}

/**
 * The selection, live.
 *
 * useSyncExternalStore rather than useState + useEffect because every card in
 * the grid and the tray below them read the same store: a state-per-component
 * approach would have each of them holding its own copy and only the one you
 * clicked updating.
 *
 * It is also what makes this SSR-safe. The server snapshot is empty, which is
 * the honest answer -- localStorage does not exist there -- and React reconciles
 * on hydration rather than mismatching.
 */
export function useCompareSelection(): CompareSelection {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const isSelected = useCallback((id: string) => items.some((t) => t.id === id), [items])

  return {
    items,
    count: items.length,
    isFull: items.length >= MAX_COMPARE,
    isSelected,
    toggle: toggleCompare,
    remove: removeFromCompare,
    clear: clearCompare,
  }
}
