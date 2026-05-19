/**
 * ArcynFind Search Orchestrator
 *
 * A strict, deterministic search ranking engine.
 *
 * Pipeline:
 *   Step 1 — Retrieval Gate       : Assess input pool quality
 *   Step 2 — Intent Detection     : Classify query into one intent type
 *   Step 3 — Hard Filtering       : Remove duplicates, stubs, irrelevant results
 *   Step 4 — Scoring              : Compute FINAL_SCORE per result
 *   Step 5 — Sort & Limit         : Deterministic sort, cap at 10, min 3
 *   Step 6 — Stability Guard      : Assign tier_A / tier_B / tier_C
 *   Step 7 — Niche Authority Boost: Apply +2 / -1 adjustments
 *
 * ABSOLUTE RULES enforced in this module:
 *   - Never invent a result, URL, or tool name
 *   - Never randomize result order
 *   - Never pad results to hit a count
 *   - Never exceed 10 results
 *   - Never score a missing field as anything other than 0
 *   - Never promote a tier_C result into the initial result set
 *   - Never modify the database during a query
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single candidate result supplied to the orchestrator */
export interface CandidateResult {
  /** Unique identifier for the record */
  id?: string
  /** Display title of the tool / page */
  title: string
  /** Detailed description of the content */
  description?: string | null
  /** Canonical URL or source identifier */
  source?: string | null
  /** Comma-separated or array of tags/categories */
  tags?: string[] | string | null
  /** 0–10 score from a keyword matching system */
  keyword_score?: number | null
  /** 0–10 cosine-similarity score from a vector/embedding search */
  vector_score?: number | null
  /** 0–10 normalised popularity signal */
  popularity_score?: number | null
  /** 0–10 trust score for the originating source */
  source_trust_score?: number | null
  /** ISO 8601 date string — used to compute freshness */
  freshness_date?: string | null
  /** Whether this result is verified/curated by ArcynFind */
  is_verified?: boolean
  /** Whether this result was auto-indexed without human review */
  auto_indexed?: boolean
  /** Category string (used for niche authority check) */
  category?: string | null
}

export type QueryIntent =
  | 'navigational'
  | 'informational'
  | 'transactional'
  | 'comparative'
  | 'exploratory'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type StabilityTier = 'tier_A' | 'tier_B' | 'tier_C'

export interface RankedResult {
  rank: number
  id?: string
  title: string
  summary: string
  source: string
  relevance_reason: string
  stability_tier: StabilityTier
  score: number
}

export interface PipelineHealth {
  input_pool_size: number
  after_filter_size: number
  weak_input_detected: boolean
}

export interface OrchestratorOutput {
  query_intent: QueryIntent
  confidence_level: ConfidenceLevel
  results: RankedResult[]
  pipeline_health: PipelineHealth
  notes: string
}

// ---------------------------------------------------------------------------
// Step 1 helpers — Retrieval Gate
// ---------------------------------------------------------------------------

interface RetrievalGateResult {
  isLowQuality: boolean
  reason: string
}

function assessInputPool(
  query: string,
  candidates: CandidateResult[]
): RetrievalGateResult {
  const issues: string[] = []

  if (candidates.length < 3) {
    issues.push(`Fewer than 3 candidate results (got ${candidates.length}).`)
  }

  const noDescriptionCount = candidates.filter(
    (c) => !c.description || c.description.trim().length < 10
  ).length

  if (candidates.length > 0 && noDescriptionCount / candidates.length > 0.7) {
    issues.push(
      `${noDescriptionCount}/${candidates.length} results have no meaningful description (>${Math.round(70)}% threshold exceeded).`
    )
  }

  // Surface-level relevance: at least one keyword from the query appears in
  // at least one candidate's title or description.
  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)

  if (queryTerms.length > 0 && candidates.length > 0) {
    const hasAnyRelevantResult = candidates.some((c) => {
      const haystack = `${c.title} ${c.description ?? ''}`.toLowerCase()
      return queryTerms.some((term) => haystack.includes(term))
    })
    if (!hasAnyRelevantResult) {
      issues.push('No candidates show surface-level relevance to the query.')
    }
  }

  return {
    isLowQuality: issues.length > 0,
    reason: issues.join(' '),
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Intent Detection
// ---------------------------------------------------------------------------

const NAVIGATIONAL_SIGNALS = [
  'open', 'go to', 'navigate', 'website', 'site', 'page', 'homepage',
  'official', 'login', 'sign in', 'sign up',
]
const INFORMATIONAL_SIGNALS = [
  'what is', 'how does', 'explain', 'difference', 'meaning',
  'definition', 'learn', 'understand', 'guide', 'tutorial', 'why',
]
const TRANSACTIONAL_SIGNALS = [
  'download', 'buy', 'purchase', 'subscribe', 'get', 'use', 'access',
  'free trial', 'install', 'try', 'register',
]
const COMPARATIVE_SIGNALS = [
  'vs', 'versus', 'compare', 'alternative', 'alternatives',
  'best', 'top', 'ranked', 'better', 'difference between',
]

function detectIntent(query: string): QueryIntent {
  const q = query.toLowerCase()

  if (COMPARATIVE_SIGNALS.some((s) => q.includes(s))) return 'comparative'
  if (NAVIGATIONAL_SIGNALS.some((s) => q.includes(s))) return 'navigational'
  if (TRANSACTIONAL_SIGNALS.some((s) => q.includes(s))) return 'transactional'
  if (INFORMATIONAL_SIGNALS.some((s) => q.includes(s))) return 'informational'

  return 'exploratory'
}

// ---------------------------------------------------------------------------
// Step 3 — Hard Filtering
// ---------------------------------------------------------------------------

const MIN_DESCRIPTION_LENGTH = 15

/** Normalise a title for near-duplicate detection */
function normalisedTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hardFilter(
  query: string,
  candidates: CandidateResult[],
  intent: QueryIntent
): CandidateResult[] {
  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)

  const seenTitles = new Set<string>()
  const filtered: CandidateResult[] = []

  for (const c of candidates) {
    // Reject: no meaningful description
    if (!c.description || c.description.trim().length < MIN_DESCRIPTION_LENGTH) {
      continue
    }

    // Reject: near-duplicate title
    const nt = normalisedTitle(c.title)
    if (seenTitles.has(nt)) continue
    seenTitles.add(nt)

    // Reject: placeholder / stub detection heuristics
    const descLower = c.description.toLowerCase()
    const STUB_PATTERNS = ['lorem ipsum', 'coming soon', 'placeholder', 'under construction', 'no description']
    if (STUB_PATTERNS.some((p) => descLower.includes(p))) continue

    // Reject: no relevance to query at all (must share ≥1 term)
    if (queryTerms.length > 0) {
      const haystack = `${c.title} ${c.description} ${Array.isArray(c.tags) ? c.tags.join(' ') : c.tags ?? ''}`.toLowerCase()
      const hasRelevance = queryTerms.some((term) => haystack.includes(term))
      if (!hasRelevance) continue
    }

    // Intent-specific filter: transactional — prefer active/live tools
    // (We keep all that pass basic checks, but flag for scoring later)

    filtered.push(c)
  }

  return filtered
}

// ---------------------------------------------------------------------------
// Step 4 — Scoring
// ---------------------------------------------------------------------------

/** Clamp a value to [0, maxVal], treating null/undefined as 0 */
function safe(val: number | null | undefined, maxVal = 10): number {
  if (val == null || isNaN(val)) return 0
  return Math.max(0, Math.min(maxVal, val))
}

/** Compute a 0–10 freshness score from an ISO date string */
function freshnessScore(date: string | null | undefined): number {
  if (!date) return 0
  const parsed = Date.parse(date)
  if (isNaN(parsed)) return 0

  const nowMs = Date.now()
  const ageMs = nowMs - parsed
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  // 10 → updated today, decays linearly to 0 at 730 days (2 years)
  return Math.max(0, 10 - (ageDays / 730) * 10)
}

/**
 * Compute a 0–10 semantic match score from keyword/vector scores,
 * adjusted for intent emphasis.
 */
function computeSemanticMatch(
  c: CandidateResult,
  intent: QueryIntent
): number {
  // Use vector_score if present, otherwise approximate from keyword_score
  const vectorBase = safe(c.vector_score)
  const kwBase = safe(c.keyword_score)

  // Informational intent weights semantic richness higher
  if (intent === 'informational') {
    return Math.max(vectorBase, kwBase * 0.8)
  }
  return Math.max(vectorBase, kwBase * 0.6)
}

/**
 * Compute a 0–10 exact keyword match score.
 * Uses the provided keyword_score and boosts on exact title match.
 */
function computeExactKeywordMatch(
  c: CandidateResult,
  queryTerms: string[],
  intent: QueryIntent
): number {
  let base = safe(c.keyword_score)

  const titleLower = c.title.toLowerCase()
  const exactTitleMatch = queryTerms.some(
    (term) => titleLower === term || titleLower.includes(term)
  )

  if (exactTitleMatch) {
    base = Math.min(10, base + 3)
  }

  // navigational intent doubles exact match weight (handled in formula)
  return base
}

/**
 * Compute a 0–10 user intent fit score.
 * Checks how well the result type matches the detected intent.
 */
function computeIntentFit(c: CandidateResult, intent: QueryIntent): number {
  const descLower = (c.description ?? '').toLowerCase()
  const titleLower = c.title.toLowerCase()
  const haystack = `${titleLower} ${descLower}`

  switch (intent) {
    case 'navigational': {
      // Intent fit if it looks like a product page or official tool
      if (c.source && c.source.startsWith('http')) return 8
      return 5
    }
    case 'transactional': {
      // Prefer items that feel like usable apps/tools over blog posts
      const isApp = ['tool', 'app', 'platform', 'service', 'software'].some((kw) =>
        haystack.includes(kw)
      )
      return isApp ? 8 : 4
    }
    case 'informational': {
      // Prefer items with richer descriptions
      const len = (c.description ?? '').trim().length
      return Math.min(10, 4 + len / 100)
    }
    case 'comparative': {
      // Rewarded if the result explicitly mentions alternatives or comparisons
      const hasCompare = ['vs', 'compare', 'alternative', 'pros', 'cons'].some((kw) =>
        haystack.includes(kw)
      )
      return hasCompare ? 9 : 5
    }
    case 'exploratory': {
      // Rewarded for having tags/categories (broader category coverage)
      const tagCount = Array.isArray(c.tags)
        ? c.tags.length
        : c.tags
        ? c.tags.split(',').length
        : 0
      return Math.min(10, 5 + tagCount)
    }
  }
}

/** Raw FINAL_SCORE before niche boost — following the spec formula exactly */
function computeRawScore(
  c: CandidateResult,
  query: string,
  intent: QueryIntent
): number {
  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)

  const exactKW = computeExactKeywordMatch(c, queryTerms, intent)
  const semantic = computeSemanticMatch(c, intent)
  const intentFit = computeIntentFit(c, intent)
  const trust = safe(c.source_trust_score)
  const popularity = safe(c.popularity_score)
  const freshness = freshnessScore(c.freshness_date)

  let score =
    exactKW * 4 +
    semantic * 3 +
    intentFit * 4 +
    trust * 3 +
    popularity * 1 +
    freshness * 1

  // navigational: exact match weight doubles (we add another ×4 pass)
  if (intent === 'navigational') {
    score += exactKW * 4
  }

  // comparative: no score change here — diversity handled as tiebreaker
  // informational: freshness already weighted ×1; bump to ×2
  if (intent === 'informational') {
    score += freshness * 1
  }

  return score
}

// ---------------------------------------------------------------------------
// Step 7 — Niche Authority Boost (applied BEFORE sort)
// ---------------------------------------------------------------------------

function applyNicheBoost(rawScore: number, c: CandidateResult): number {
  let adjusted = rawScore

  // +2: verified/curated entries
  if (c.is_verified === true) {
    adjusted += 2
  }

  // -1: generic aggregator content (auto-indexed, no tags/category)
  if (c.auto_indexed === true) {
    adjusted -= 1
  }

  const tagCount = Array.isArray(c.tags)
    ? c.tags.length
    : c.tags
    ? c.tags.split(',').filter(Boolean).length
    : 0

  if (!c.category && tagCount === 0) {
    adjusted -= 1
  }

  return Math.max(0, adjusted)
}

// ---------------------------------------------------------------------------
// Step 6 — Stability Tier
// ---------------------------------------------------------------------------

function assignTier(score: number): StabilityTier {
  if (score >= 8) return 'tier_A'
  if (score >= 5) return 'tier_B'
  return 'tier_C'
}

// ---------------------------------------------------------------------------
// Summary generation (deterministic — no AI calls)
// ---------------------------------------------------------------------------

function generateSummary(c: CandidateResult): string {
  const desc = (c.description ?? '').trim()
  if (desc.length <= 120) return desc

  // Truncate at the last complete word before 120 chars
  const truncated = desc.substring(0, 120)
  const lastSpace = truncated.lastIndexOf(' ')
  return `${truncated.substring(0, lastSpace > 60 ? lastSpace : 120)}…`
}

function buildRelevanceReason(
  c: CandidateResult,
  rank: number,
  score: number,
  intent: QueryIntent
): string {
  const parts: string[] = []

  if (rank === 1) parts.push('Highest overall FINAL_SCORE in the ranked set.')

  if (c.is_verified) parts.push('Verified ArcynFind entry (+2 niche boost).')

  const kw = safe(c.keyword_score)
  if (kw >= 7) parts.push(`Strong keyword match (score: ${kw.toFixed(1)}).`)

  const vec = safe(c.vector_score)
  if (vec >= 7) parts.push(`High semantic similarity (vector score: ${vec.toFixed(1)}).`)

  if (intent === 'navigational' && c.source?.startsWith('http')) {
    parts.push('Direct URL match for navigational query.')
  }
  if (intent === 'transactional' && c.category) {
    parts.push(`Active tool in category: ${c.category}.`)
  }
  if (intent === 'informational') {
    const len = (c.description ?? '').trim().length
    if (len > 200) parts.push('Rich description provides depth for informational query.')
  }

  return parts.length > 0 ? parts.join(' ') : `FINAL_SCORE: ${score.toFixed(2)}.`
}

// ---------------------------------------------------------------------------
// Main Orchestrator Function
// ---------------------------------------------------------------------------

/**
 * Run the full 7-step ArcynFind Search Orchestrator pipeline.
 *
 * @param query      The raw user search query
 * @param candidates The candidate result pool retrieved from the index/database
 * @returns          A deterministic, ranked OrchestratorOutput (strict JSON shape)
 */
export function runSearchOrchestrator(
  query: string,
  candidates: CandidateResult[]
): OrchestratorOutput {
  if (!query || query.trim().length === 0) {
    return {
      query_intent: 'exploratory',
      confidence_level: 'low',
      results: [],
      pipeline_health: {
        input_pool_size: 0,
        after_filter_size: 0,
        weak_input_detected: true,
      },
      notes: 'Empty query supplied — no processing performed.',
    }
  }

  const notesList: string[] = []

  // ── STEP 1: Retrieval Gate ──────────────────────────────────────────────
  const gate = assessInputPool(query, candidates)
  let confidenceLevel: ConfidenceLevel = 'high'

  if (gate.isLowQuality) {
    confidenceLevel = 'low'
    notesList.push(`LOW QUALITY input detected: ${gate.reason}`)
  }

  // ── STEP 2: Intent Detection ────────────────────────────────────────────
  const intent = detectIntent(query)

  // ── STEP 3: Hard Filtering ──────────────────────────────────────────────
  const filtered = hardFilter(query, candidates, intent)

  if (filtered.length < candidates.length) {
    notesList.push(
      `Hard filter removed ${candidates.length - filtered.length} results (stubs, duplicates, or irrelevant).`
    )
  }

  if (filtered.length < 3 && candidates.length >= 3) {
    notesList.push('After filtering, fewer than 3 results remain — retrieval quality may be low.')
    confidenceLevel = 'low'
  } else if (filtered.length >= 3 && filtered.length < candidates.length * 0.5) {
    // Many results removed — downgrade confidence unless already low
    if (confidenceLevel === 'high') confidenceLevel = 'medium'
  }

  // ── STEP 4: Scoring ─────────────────────────────────────────────────────
  // Compute raw scores + niche authority boost
  const scored = filtered.map((c) => {
    const rawScore = computeRawScore(c, query, intent)
    const finalScore = applyNicheBoost(rawScore, c)
    return { candidate: c, score: finalScore }
  })

  // ── STEP 5: Sort & Limit ────────────────────────────────────────────────
  // Deterministic descending sort; tiebreakers applied sequentially:
  //   1. Prefer verified/official source
  //   2. Prefer broader category coverage (exploratory)
  //   3. Prefer more recently updated content
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score

    // Tiebreaker 1: verified
    const aVer = a.candidate.is_verified ? 1 : 0
    const bVer = b.candidate.is_verified ? 1 : 0
    if (bVer !== aVer) return bVer - aVer

    // Tiebreaker 2: tag breadth (for comparative/exploratory)
    const aTags = Array.isArray(a.candidate.tags)
      ? a.candidate.tags.length
      : a.candidate.tags
      ? a.candidate.tags.split(',').length
      : 0
    const bTags = Array.isArray(b.candidate.tags)
      ? b.candidate.tags.length
      : b.candidate.tags
      ? b.candidate.tags.split(',').length
      : 0
    if (bTags !== aTags) return bTags - aTags

    // Tiebreaker 3: freshness
    const aFresh = freshnessScore(a.candidate.freshness_date)
    const bFresh = freshnessScore(b.candidate.freshness_date)
    return bFresh - aFresh
  })

  // Cap at 10 — NEVER pad
  const cappedResults = scored.slice(0, 10)

  // ── STEP 6: Stability Guard + tier assignment ───────────────────────────
  // Only tier_A and tier_B results enter the initial result set.
  const initialResults = cappedResults.filter(
    ({ score }) => assignTier(score) !== 'tier_C'
  )

  // Surface note if tier_C results exist
  const tierCCount = cappedResults.length - initialResults.length
  if (tierCCount > 0) {
    notesList.push(
      `${tierCCount} result(s) suppressed to tier_C (score < 5) — not shown in initial set.`
    )
  }

  // Build final ranked array
  const results: RankedResult[] = initialResults.map(({ candidate, score }, idx) => ({
    rank: idx + 1,
    id: candidate.id,
    title: candidate.title,
    summary: generateSummary(candidate),
    source: candidate.source ?? 'Unknown',
    relevance_reason: buildRelevanceReason(candidate, idx + 1, score, intent),
    stability_tier: assignTier(score),
    score: parseFloat(score.toFixed(2)),
  }))

  // Confidence downgrade if result set is too small
  if (results.length === 0) {
    confidenceLevel = 'low'
    notesList.push('Zero results passed all pipeline stages.')
  } else if (results.length < 3 && confidenceLevel === 'high') {
    confidenceLevel = 'medium'
  }

  return {
    query_intent: intent,
    confidence_level: confidenceLevel,
    results,
    pipeline_health: {
      input_pool_size: candidates.length,
      after_filter_size: filtered.length,
      weak_input_detected: gate.isLowQuality,
    },
    notes: notesList.join(' | ') || 'Pipeline completed normally.',
  }
}
