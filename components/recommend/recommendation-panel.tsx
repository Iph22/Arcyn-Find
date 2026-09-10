"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Check, TriangleAlert, ArrowUpRight, ChevronDown, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Recommendation, RecommendedTool, RecommendationLabel } from "@/lib/recommend"

const LABEL_TEXT: Record<RecommendationLabel, string> = {
    best_match: "Best match",
    best_budget: "Best budget option",
    best_for_beginners: "Best for beginners",
    best_for_professionals: "Best for professionals",
    most_popular: "Most popular",
    strong_alternative: "Strong alternative",
}

/**
 * Short price label from the structured pricing columns.
 *
 * Returns null when there's nothing trustworthy to show — roughly 1.4% of the
 * catalog is unclassified and most scraped rows carry no real price, so "no
 * badge" is a normal outcome, not an error state. Showing a fabricated or
 * empty price would be worse than showing none.
 */
function priceLabel(tool: RecommendedTool): string | null {
    const min = tool.priceMonthlyMinUsd
    const hasMin = typeof min === "number" && Number.isFinite(min)

    if (tool.pricingModel === "free" || min === 0) return "Free"
    if (tool.pricingModel === "usage") return "Usage-based"
    if (tool.pricingModel === "custom") return "Custom pricing"

    if (hasMin && (min as number) > 0) {
        const amount = (min as number) < 10
            ? `$${(min as number).toFixed(2).replace(/\.00$/, "")}`
            : `$${Math.round(min as number)}`
        const prefix = tool.hasFreeTier ? "Free tier · from " : "from "
        return `${prefix}${amount}/mo`
    }

    if (tool.hasFreeTier) return "Free tier available"
    if (tool.hasFreeTrial) return "Free trial"
    return null
}

interface RecommendationPanelProps {
    query: string
    recommendation: (Recommendation & { message?: string }) | null
    isLoading: boolean
}

/**
 * Sits ABOVE the tools grid on /tools, in the same position Google puts its AI
 * answer: our take first, the full directory underneath. Deliberately compact —
 * it must not push the actual results below the fold on a laptop.
 *
 * Renders nothing at all when there's no usable recommendation. An empty
 * "AI" box is worse than no box: it implies the feature is broken when the
 * results list right below it is working fine.
 */
export function RecommendationPanel({ query, recommendation, isLoading }: RecommendationPanelProps) {
    const [collapsed, setCollapsed] = useState(false)

    if (isLoading) return <RecommendationPanelSkeleton />
    if (!recommendation?.bestMatch) return null

    const { bestMatch, alternatives, degraded } = recommendation

    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-6"
        >
            <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary/[0.04] to-transparent">
                {/* Header */}
                <button
                    type="button"
                    onClick={() => setCollapsed(c => !c)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left sm:px-5"
                >
                    <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm font-semibold">Arcyn&apos;s recommendation</span>
                    <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                        for &ldquo;{query}&rdquo;
                    </span>
                    {degraded && (
                        <span className="hidden text-xs text-muted-foreground md:inline">
                            · quick match
                        </span>
                    )}
                    <ChevronDown
                        className={cn(
                            "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                            collapsed && "-rotate-90"
                        )}
                    />
                </button>

                {!collapsed && (
                    <div className="border-t border-border/50 px-4 pb-4 pt-4 sm:px-5">
                        {/* Best match */}
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                                        {LABEL_TEXT[bestMatch.label]}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                        {bestMatch.category}
                                    </Badge>
                                    {priceLabel(bestMatch) && (
                                        <Badge variant="outline" className="text-xs font-normal">
                                            {priceLabel(bestMatch)}
                                        </Badge>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold leading-tight">{bestMatch.name}</h3>
                                <p className="mt-1 text-sm text-muted-foreground">{bestMatch.reason}</p>
                            </div>

                            <a
                                href={bestMatch.platform}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                            >
                                Try it
                                <ArrowUpRight className="h-3.5 w-3.5" />
                            </a>
                        </div>

                        {/* Why it fits — capped at 3 so the panel stays short */}
                        {bestMatch.strengths.length > 0 && (
                            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                                {bestMatch.strengths.slice(0, 3).map(strength => (
                                    <li
                                        key={strength}
                                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                                    >
                                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                                        {strength}
                                    </li>
                                ))}
                            </ul>
                        )}

                        {bestMatch.limitation && (
                            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>
                                    <span className="font-medium text-foreground">Worth knowing: </span>
                                    {bestMatch.limitation}
                                </span>
                            </p>
                        )}

                        {/* Alternatives */}
                        {alternatives.length > 0 && (
                            <div className="mt-4 border-t border-border/50 pt-3">
                                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Also worth considering
                                </p>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {alternatives.map(alt => (
                                        <AlternativeChip key={alt.id} tool={alt} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </motion.div>
    )
}

function AlternativeChip({ tool }: { tool: RecommendedTool }) {
    return (
        <a
            href={tool.platform}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg border border-border/50 bg-card/50 p-2.5 transition-colors hover:border-primary/30 hover:bg-accent/40"
        >
            <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {LABEL_TEXT[tool.label]}
                </p>
                {priceLabel(tool) && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">{priceLabel(tool)}</span>
                )}
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
                <span className="truncate">{tool.name}</span>
                <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{tool.reason}</p>
        </a>
    )
}

function RecommendationPanelSkeleton() {
    return (
        <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
            <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium text-muted-foreground">
                    Working out the best fit for your goal…
                </span>
            </div>
        </Card>
    )
}
