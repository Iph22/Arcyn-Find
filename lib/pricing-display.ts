/**
 * Presentation helpers for the structured pricing columns.
 *
 * Shared by the recommendation panel and the price comparison so both render
 * prices identically — the alternative was two copies of the same formatting
 * rules drifting apart.
 *
 * Structural input type on purpose: works for RecommendedTool, AIEntry, or any
 * row carrying the derived pricing fields, without those modules importing
 * each other.
 */

export interface PricedLike {
    pricingModel?: string | null
    priceMonthlyMinUsd?: number | null
    priceMonthlyMaxUsd?: number | null
    hasFreeTier?: boolean | null
    hasFreeTrial?: boolean | null
}

/**
 * Numeric sort key in USD/month, or null when the tool has no price that can be
 * meaningfully compared.
 *
 * Free counts as 0 — it IS comparable, and it's the cheapest thing there is.
 * `usage` and `custom` return null: metered and quote-based pricing genuinely
 * cannot be placed on a monthly axis, and inventing a number for them would be
 * the false-precision failure the product brief warns against.
 */
export function comparableMonthly(tool: PricedLike): number | null {
    if (tool.pricingModel === "free") return 0
    if (tool.pricingModel === "usage" || tool.pricingModel === "custom") return null

    const min = tool.priceMonthlyMinUsd
    if (typeof min === "number" && Number.isFinite(min)) return min

    // A free tier with no stated paid price is still effectively free to start.
    if (tool.hasFreeTier) return 0
    return null
}

export function hasComparablePrice(tool: PricedLike): boolean {
    return comparableMonthly(tool) !== null
}

function formatAmount(value: number): string {
    return value < 10
        ? `$${value.toFixed(2).replace(/\.00$/, "")}`
        : `$${Math.round(value)}`
}

/**
 * Short price label, or null when there is nothing trustworthy to show.
 *
 * Returning null is a normal outcome, not an error: most of the catalog is
 * scraped rows with no real price, and ~1.4% is unclassified. A missing badge
 * is better than a fabricated one.
 */
export function priceLabel(tool: PricedLike): string | null {
    const min = tool.priceMonthlyMinUsd
    const hasMin = typeof min === "number" && Number.isFinite(min)

    if (tool.pricingModel === "free" || min === 0) return "Free"
    if (tool.pricingModel === "usage") return "Usage-based"
    if (tool.pricingModel === "custom") return "Custom pricing"

    if (hasMin && (min as number) > 0) {
        const prefix = tool.hasFreeTier ? "Free tier · from " : "from "
        return `${prefix}${formatAmount(min as number)}/mo`
    }

    if (tool.hasFreeTier) return "Free tier available"
    if (tool.hasFreeTrial) return "Free trial"
    return null
}

/** Compact label for the comparison rows, where the column header already
 *  says these are monthly figures. */
export function priceLabelCompact(tool: PricedLike): string {
    const monthly = comparableMonthly(tool)
    if (monthly === 0) return tool.hasFreeTier && tool.pricingModel !== "free" ? "Free tier" : "Free"
    if (monthly === null) {
        if (tool.pricingModel === "usage") return "Usage-based"
        if (tool.pricingModel === "custom") return "Custom"
        return "—"
    }
    return `${formatAmount(monthly)}/mo`
}
