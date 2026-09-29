/**
 * What "compare two tools" means, in one place.
 *
 * The product has promised comparison since launch -- the landing page, the
 * /tools metadata, the category page titles and app-store-config.json all say
 * "compare" -- while the only thing that existed was a set of unreferenced
 * export helpers in lib/export-utils.ts. This module is the missing middle:
 * the URL shape, the field list, and the text projection of each field.
 *
 * Pure and dependency-free (pricing-display and tool-href are both pure too)
 * so a client component can import it without dragging in the Supabase admin
 * client that lives in lib/seo/catalog.ts -- the same constraint that shaped
 * lib/tool-href.ts.
 *
 * ONE field list, shared by the table and the CSV/JSON/print exports. They
 * were always going to drift otherwise: export-utils already carried three
 * separate copies of the same nine-row feature list, two of them subtly
 * different (`tags.join('; ')` vs `', '`, `popularity` vs `${popularity}%`).
 */

import { comparableMonthly, priceLabelCompact, type PricedLike } from './pricing-display'
import type { LinkableTool } from './tool-href'

/**
 * Four columns.
 *
 * Not an arbitrary round number: the table renders one column per tool beside
 * a label column, and five columns of 200-character scraped descriptions is
 * unreadable on a laptop and impossible on a phone. Four fits the 2x2 the
 * mobile layout falls back to.
 */
export const MAX_COMPARE = 4

/** The query parameter /compare reads. Named once, for the reason SEARCH_PARAM is. */
export const COMPARE_PARAM = 'tools'

/**
 * The shape the comparison needs. Structural, so CatalogTool (server, from
 * lib/seo/catalog.ts) and the lighter row the browser holds both satisfy it
 * without either module importing the other.
 */
export interface ComparableTool extends PricedLike, LinkableTool {
  id: string
  slug?: string | null
  name: string
  category?: string | null
  description?: string | null
  platform?: string | null
  accessType?: string | null
  pricing?: string | null
  tags?: string[] | null
  lastUpdated?: string | null
  image?: string | null
}

/**
 * The URL segment that identifies a tool in a compare link.
 *
 * Same precedence as toolHref(): slug first, id as the fallback. A row below
 * the publish floor has no slug and is still comparable -- it just costs the
 * uglier segment, which nothing redirects here because /compare resolves both
 * forms itself rather than sending the browser to /tools.
 */
export function compareSegment(tool: LinkableTool): string {
  return tool.slug?.trim() || tool.id
}

/**
 * The compare URL for a set of tools.
 *
 * Comma-separated rather than repeated `?tools=a&tools=b`, because both slugs
 * (slugify: `[a-z0-9-]`) and ids (generateId in lib/auto-update.ts: the same
 * alphabet plus a source prefix) are comma-free by construction, so the
 * shorter form is unambiguous here. parseCompareSegments accepts the repeated
 * form too, so a hand-written or older link still resolves.
 */
export function compareHref(tools: readonly LinkableTool[]): string {
  const segments = tools.slice(0, MAX_COMPARE).map(compareSegment).filter(Boolean)
  if (segments.length === 0) return '/compare'
  return `/compare?${COMPARE_PARAM}=${segments.map(encodeURIComponent).join(',')}`
}

/** Segments that could name a row. Anything else cannot match and is dropped. */
const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/

/**
 * Read `?tools=` into a clean, bounded, de-duplicated segment list.
 *
 * Deliberately total: every bad input degrades to a shorter list or an empty
 * one, never an exception and never an unbounded query. The cap is applied
 * here rather than at the database call so there is one place that decides how
 * many tools a comparison holds.
 */
export function parseCompareSegments(raw: string | string[] | undefined): string[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : []
  const seen = new Set<string>()
  const out: string[] = []

  for (const value of values) {
    for (const part of value.split(',')) {
      const segment = part.trim()
      if (!segment || !SEGMENT_PATTERN.test(segment)) continue
      const key = segment.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(segment)
      if (out.length >= MAX_COMPARE) return out
    }
  }
  return out
}

/** One comparable attribute: its heading, and its plain-text value per tool. */
export interface CompareField {
  key: string
  label: string
  /** Plain text for exports, and the default table cell. */
  text: (tool: ComparableTool) => string
}

/** The em-dash used wherever the catalog simply has no value. Never "N/A",
 *  never a zero, never a guess -- see docs/CORPUS_AND_CONSTRAINTS.md §1. */
export const NO_VALUE = '—'

function text(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim()
  return trimmed || NO_VALUE
}

function yesNo(value: boolean | null | undefined): string {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return NO_VALUE
}

function hostname(url: string | null | undefined): string {
  if (!url) return NO_VALUE
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return text(url)
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return NO_VALUE
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return text(value)
  return date.toISOString().slice(0, 10)
}

/**
 * The fields a comparison shows, in order.
 *
 * NOTHING HERE IS POPULARITY, AND THAT IS THE POINT. The browse cards render
 * `popularity / 20` as a star rating and `popularity * 100` as a save count;
 * both are ingest heuristics dressed as engagement, and docs/ROUTING.md
 * records that the real signals are 44 lifetime views and 9 favourites across
 * the whole catalog. A star rating is tolerable as decoration on a card. In a
 * table headed "compare", a number is a claim someone will act on, so the only
 * numbers here are ones the catalog actually holds.
 */
export const COMPARE_FIELDS: readonly CompareField[] = [
  {
    key: 'category',
    label: 'Category',
    text: (t) => text(t.category),
  },
  {
    key: 'price',
    label: 'Starting price',
    // priceLabelCompact already returns "Free", "Usage-based", "Custom" or
    // "—" rather than inventing a figure for metered and quote-based tools.
    text: (t) => priceLabelCompact(t),
  },
  { key: 'freeTier', label: 'Free tier', text: (t) => yesNo(t.hasFreeTier) },
  { key: 'freeTrial', label: 'Free trial', text: (t) => yesNo(t.hasFreeTrial) },
  {
    key: 'accessType',
    label: 'Access',
    text: (t) => text(t.accessType),
  },
  {
    key: 'pricingDetail',
    label: 'Pricing, as published',
    // The free-text column the structured figures were parsed out of. It is
    // the authoritative one (AIEntry calls it so) and it is what catches the
    // "$6/year stored as $0.50/mo" case the row above cannot express.
    text: (t) => text(t.pricing),
  },
  { key: 'platform', label: 'Website', text: (t) => hostname(t.platform) },
  {
    key: 'tags',
    label: 'Tags',
    text: (t) => (t.tags && t.tags.length > 0 ? t.tags.join(', ') : NO_VALUE),
  },
  {
    key: 'description',
    label: 'What it does',
    text: (t) => text(t.description),
  },
  {
    key: 'lastUpdated',
    label: 'Catalog entry updated',
    text: (t) => formatDate(t.lastUpdated),
  },
]

/** A field's values across the set, in the same order as the tools. */
export function fieldValues(field: CompareField, tools: readonly ComparableTool[]): string[] {
  return tools.map((tool) => field.text(tool))
}

/**
 * Whether every tool gives the same answer.
 *
 * A comparison is read for its differences, so the table mutes these rows
 * rather than letting four identical "Code & Development" cells compete for
 * attention with the row where the tools actually diverge. Muted, not dropped:
 * "all three are freemium" is a real answer to a real question, it just is not
 * the one the reader came for.
 */
export function isUniform(values: readonly string[]): boolean {
  return values.length > 1 && values.every((v) => v === values[0])
}

/**
 * The cheapest tool in the set, by the one axis that is genuinely comparable.
 *
 * Returns null when fewer than two tools carry a monthly figure, or when
 * everything in the set is free -- "cheapest: all of them" is not a finding.
 * This mirrors the gate in components/recommend/price-comparison.tsx, which
 * renders nothing for the same reason.
 */
export function cheapestId(tools: readonly ComparableTool[]): string | null {
  const priced = tools
    .map((tool) => ({ tool, monthly: comparableMonthly(tool) }))
    .filter((row): row is { tool: ComparableTool; monthly: number } => row.monthly !== null)

  if (priced.length < 2) return null
  const cheapest = priced.reduce((a, b) => (b.monthly < a.monthly ? b : a))
  const dearest = priced.reduce((a, b) => (b.monthly > a.monthly ? b : a))
  if (cheapest.monthly === dearest.monthly) return null
  return cheapest.tool.id
}

/** The comparison as a plain grid: header row, then one row per field. */
export function comparisonGrid(tools: readonly ComparableTool[]): string[][] {
  const header = ['Feature', ...tools.map((t) => t.name)]
  const rows = COMPARE_FIELDS.map((field) => [field.label, ...fieldValues(field, tools)])
  return [header, ...rows]
}
