"use client"

import { comparableMonthly, priceLabelCompact } from "@/lib/pricing-display"
import { cn } from "@/lib/utils"
import type { RecommendedTool } from "@/lib/recommend"

interface PriceComparisonProps {
    bestMatch: RecommendedTool
    alternatives: RecommendedTool[]
}

/**
 * Side-by-side monthly cost for the recommended set.
 *
 * DELIBERATELY OFTEN RENDERS NOTHING. Measured on the live table: of ~257k
 * tools only 2,580 have a non-zero monthly price — everything else is free,
 * free-tier, or unpriced. So the common case is a set where a "comparison" is
 * either a column of "Free" (which the badges above already say) or a single
 * priced row next to two blanks. Both are noise dressed as analysis.
 *
 * It renders only when the numbers actually carry information:
 *   - at least two tools have a price that can go on a monthly axis, AND
 *   - at least one of them costs something.
 *
 * Tools priced by usage or by quote are excluded from the bars rather than
 * assigned a guessed number — see comparableMonthly. They're still listed with
 * their real label so their absence from the axis is visible, not hidden.
 */
export function PriceComparison({ bestMatch, alternatives }: PriceComparisonProps) {
    const rows = [bestMatch, ...alternatives].map(tool => ({
        tool,
        monthly: comparableMonthly(tool),
        isBest: tool.id === bestMatch.id,
    }))

    const comparable = rows.filter(r => r.monthly !== null)
    const highest = Math.max(...comparable.map(r => r.monthly as number), 0)

    if (comparable.length < 2 || highest <= 0) return null

    // Cheapest first — the whole point of the strip is "what does the budget
    // option cost". Ties keep their incoming (relevance) order.
    const sorted = [...comparable].sort((a, b) => (a.monthly as number) - (b.monthly as number))
    const unpriced = rows.filter(r => r.monthly === null)
    const cheapest = sorted[0].monthly as number

    // Bars are scaled against a ceiling that ignores a lone extreme outlier,
    // because one enterprise tier otherwise flattens every other bar to the
    // minimum stub and the strip stops communicating anything. Observed live on
    // "answer customer support questions automatically": three tools at $0,
    // $2.42 and $19 next to one at $2,083/mo.
    //
    // Only the BAR is clamped. Every number shown is the real figure, and the
    // outlier's bar simply runs full width — order is preserved and nothing is
    // understated.
    const secondHighest = sorted.length >= 2 ? (sorted[sorted.length - 2].monthly as number) : highest
    const ceiling = secondHighest > 0 && highest > secondHighest * 4 ? secondHighest : highest

    return (
        <div className="mt-4 border-t border-border/50 pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Starting monthly cost
            </p>

            <ul className="space-y-1.5">
                {sorted.map(({ tool, monthly, isBest }) => {
                    const value = monthly as number
                    // Free sits at 0 width, which would render as an invisible
                    // bar; a 2% stub keeps the row readable as a bar row. The
                    // upper clamp is what lets a clamped outlier max out rather
                    // than overflow its track.
                    const width = ceiling > 0 ? Math.min(Math.max((value / ceiling) * 100, 2), 100) : 2

                    return (
                        <li key={tool.id} className="flex items-center gap-2 text-xs">
                            <span
                                className={cn(
                                    "w-[38%] shrink-0 truncate sm:w-[30%]",
                                    isBest ? "font-semibold text-foreground" : "text-muted-foreground"
                                )}
                                title={tool.name}
                            >
                                {tool.name}
                            </span>

                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                                <span
                                    className={cn(
                                        "block h-full rounded-full",
                                        value === cheapest ? "bg-primary" : "bg-primary/35"
                                    )}
                                    style={{ width: `${width}%` }}
                                />
                            </span>

                            <span
                                className={cn(
                                    "w-[72px] shrink-0 text-right tabular-nums",
                                    value === cheapest ? "font-medium text-foreground" : "text-muted-foreground"
                                )}
                            >
                                {priceLabelCompact(tool)}
                            </span>
                        </li>
                    )
                })}
            </ul>

            {unpriced.length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                    {unpriced.map(r => r.tool.name).join(", ")}{" "}
                    {unpriced.length === 1 ? "is" : "are"} priced by{" "}
                    {unpriced.every(r => r.tool.pricingModel === "custom") ? "quote" : "usage"} — not
                    comparable monthly.
                </p>
            )}

            {/* The prices come from parsing each tool's own pricing copy, which
                is scraped and sometimes stale. Saying so is cheaper than being
                wrong about someone's budget.

                The annual note is not boilerplate: an annual plan is stored as
                its monthly equivalent, so BrandCrowd's real "$6/year" shows
                here as $0.50/mo. That is the right number for comparing costs
                and the wrong number to expect on a monthly invoice. A
                billing-period column would let us say "$6/yr" instead. */}
            <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                Cheapest tier from each tool&apos;s published pricing, shown per month — annual
                plans are converted and may require yearly billing. Verify before buying.
            </p>
        </div>
    )
}
