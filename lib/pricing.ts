/**
 * Pricing normalization — Phase 2 foundation.
 *
 * WHY: `ai_tools.pricing` is free text ("Free tier, Pro $20/mo", "Free tier +
 * $25-199/month", "$40/year, Free, $198/year"). That's fine for display and
 * useless for anything else. Three Phase 2 features need pricing as DATA:
 * pricing comparison, price filtering, and the "pricing fit" term in the
 * recommendation scoring formula. A "best budget option" label is currently
 * guessed by the model from prose; with this it becomes computable.
 *
 * DETERMINISTIC ON PURPOSE — no LLM. 257k rows makes per-row inference
 * absurd on both cost and time, and measurement showed the text is regular
 * enough to parse with rules. An LLM pass is only worth considering for the
 * residue this can't classify.
 *
 * Everything is normalized to MONTHLY USD so values are comparable across
 * rows that quote different billing periods.
 */

export type PricingModel =
    | "free"      // no paid tier at all
    | "freemium"  // permanently free tier AND paid tiers
    | "trial"     // time-limited free trial, then paid
    | "paid"      // paid only
    | "usage"     // metered / per-token / credits
    | "custom"    // "contact us", enterprise quote
    | "unknown"   // could not classify

export interface ParsedPricing {
    model: PricingModel
    /** Cheapest paid tier, normalized to USD/month. Null when unpriced. */
    monthlyMinUsd: number | null
    /** Most expensive paid tier, normalized to USD/month. */
    monthlyMaxUsd: number | null
    /** A permanently free option exists (not merely a trial). */
    hasFreeTier: boolean
    /** A time-limited trial exists. Distinct from hasFreeTier — the
     *  difference matters for "best budget option" and users care about it. */
    hasFreeTrial: boolean
}

/**
 * Sanity ceilings. Without these the parser produced values like $161,270/mo
 * (from the string "Free, $161270") and $49,900/mo — bare numbers with no
 * billing period, which are almost certainly amounts in cents or scraped junk.
 * A nonsense MINIMUM is much worse than a missing one: it breaks price sorting
 * and would make "best budget option" pick the wrong tool.
 *
 * So: a bare price above BARE_PERIOD_CEILING is treated as "priced, period
 * unknown" — it still marks the tool as paid, but contributes no monthly
 * figure. And any computed monthly above MAX_PLAUSIBLE_MONTHLY is discarded
 * outright, since no self-serve SaaS tier costs that much.
 */
const BARE_PERIOD_CEILING = 2_000
const MAX_PLAUSIBLE_MONTHLY = 10_000

const EMPTY: ParsedPricing = {
    model: "unknown",
    monthlyMinUsd: null,
    monthlyMaxUsd: null,
    hasFreeTier: false,
    hasFreeTrial: false,
}

/** Matches `$20/mo`, `$19.99/month`, `$99/year`, `$25-199/month`, bare `$50`. */
const PRICE_PATTERN =
    /\$\s?(\d+(?:[.,]\d+)?)\s*(?:-|–|to)\s*\$?\s?(\d+(?:[.,]\d+)?)|\$\s?(\d+(?:[.,]\d+)?)/gi

const num = (s: string | undefined): number | null => {
    if (!s) return null
    const n = parseFloat(s.replace(",", "."))
    return Number.isFinite(n) ? n : null
}

/**
 * Billing period immediately following a price token.
 *
 * The window is cut at the first tier boundary — a comma, semicolon, slash-free
 * separator, or the next `$`. Without that cut the period of a LATER tier leaks
 * into this one: for "Free, $12/month, $144/year, $32/month" the raw window
 * after `$144` is "/year, $32/month, ..." and, because month is tested first,
 * $144 was read as monthly instead of yearly (producing $144/mo rather than
 * $12/mo). Observed live on Writepaw.
 */
function periodAfter(text: string, index: number): "month" | "year" | "once" | null {
    const window = text.slice(index, index + 28)
    const tail = window.split(/[,;]|\$/)[0].toLowerCase()

    if (/\/\s?(yr|year)|per year|annually|annual/.test(tail)) return "year"
    if (/\/\s?(mo|month)|per month|monthly/.test(tail)) return "month"
    if (/one[- ]?time|lifetime|once/.test(tail)) return "once"
    return null
}

export function parsePricing(raw: string | null | undefined, accessType?: string | null): ParsedPricing {
    const text = String(raw ?? "").trim()
    if (!text) {
        return accessType === "Free"
            ? { ...EMPTY, model: "free", monthlyMinUsd: 0, hasFreeTier: true }
            : EMPTY
    }

    const lower = text.toLowerCase()

    // "free trial" must be tested before the generic free-tier check, so a
    // trial-only product isn't mislabelled as having a permanent free tier.
    const hasFreeTrial = /free\s+trial|trial\s+available|\d+[- ]day\s+trial/.test(lower)
    const hasFreeTier =
        /free\s+(tier|plan|forever|version)|freemium|open[\s-]?source|\bfree\b(?!\s*trial)/.test(lower)

    const usageBased =
        /per\s+(token|request|call|minute|image|credit|word|character|seat)|\/\s?(token|request|call|credit)|usage[\s-]based|pay[\s-]as[\s-]you[\s-]go|api pricing|\bcredits?\b/.test(lower)
    const custom = /custom(\s+pricing)?|contact\s+(us|sales|for)|enterprise\s+only|request\s+a?\s?quote|on\s+request/.test(lower)

    // Collect priced tiers, normalizing each to monthly.
    const monthly: number[] = []
    let sawOneTime = false

    for (const m of text.matchAll(PRICE_PATTERN)) {
        const period = periodAfter(text, (m.index ?? 0) + m[0].length)
        const values = m[3] !== undefined ? [num(m[3])] : [num(m[1]), num(m[2])]

        for (const v of values) {
            if (v === null || v <= 0) continue

            if (period === "year") {
                monthly.push(v / 12)
            } else if (period === "once") {
                sawOneTime = true
            } else if (v > BARE_PERIOD_CEILING) {
                // Bare number, implausibly large for a monthly price. Almost
                // certainly cents, a one-off, or junk — count it as evidence
                // the tool is paid, but don't invent a monthly figure from it.
                sawOneTime = true
            } else {
                // Bare price within a plausible monthly range. Assumed monthly,
                // which is the dominant convention in this data.
                monthly.push(v)
            }
        }
    }

    const hasPaid = monthly.length > 0 || sawOneTime

    let model: PricingModel
    if (usageBased) model = "usage"
    else if (hasPaid && hasFreeTier) model = "freemium"
    else if (hasPaid && hasFreeTrial) model = "trial"
    else if (hasPaid) model = "paid"
    else if (hasFreeTier) model = "free"
    else if (custom) model = "custom"
    else model = "unknown"

    const round = (n: number) => Math.round(n * 100) / 100
    const plausible = monthly.filter(n => n <= MAX_PLAUSIBLE_MONTHLY)

    return {
        model,
        monthlyMinUsd: plausible.length
            ? round(Math.min(...plausible))
            : model === "free"
                ? 0
                : null,
        monthlyMaxUsd: plausible.length ? round(Math.max(...plausible)) : null,
        hasFreeTier,
        hasFreeTrial,
    }
}
