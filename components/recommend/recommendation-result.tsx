"use client"

import { ArrowRight, Check, TriangleAlert } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Recommendation, RecommendedTool, RecommendationLabel } from "@/lib/recommend"

const LABEL_TEXT: Record<RecommendationLabel, string> = {
    best_match: "Best match",
    best_budget: "Best budget option",
    best_for_beginners: "Best for beginners",
    best_for_professionals: "Best for professionals",
    most_popular: "Most popular",
    strong_alternative: "Strong alternative",
}

interface RecommendationResultProps {
    query: string
    recommendation: Recommendation & { message?: string }
}

export function RecommendationResult({ query, recommendation }: RecommendationResultProps) {
    const { bestMatch, alternatives, degraded, message } = recommendation

    if (!bestMatch) {
        return (
            <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                    {message || "We couldn't find a strong match for this goal yet. Try rephrasing, or browse the full directory."}
                </p>
            </Card>
        )
    }

    return (
        <div className="space-y-8">
            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Your goal</p>
                <p className="text-lg font-medium text-foreground">{query}</p>
            </div>

            <Card className="p-6 border-primary/30">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                        {LABEL_TEXT[bestMatch.label]}
                    </span>
                    {degraded && (
                        <span className="text-xs text-muted-foreground">
                            Quick match — full reasoning is temporarily unavailable
                        </span>
                    )}
                </div>

                <h2 className="text-2xl font-bold mb-2">{bestMatch.name}</h2>
                <p className="text-muted-foreground mb-4">{bestMatch.reason}</p>

                {bestMatch.strengths.length > 0 && (
                    <div className="mb-4">
                        <p className="text-sm font-medium mb-2">Why it fits</p>
                        <ul className="space-y-1.5">
                            {bestMatch.strengths.map((strength) => (
                                <li key={strength} className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    {strength}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {bestMatch.limitation && (
                    <div className="mb-4 flex items-start gap-2 text-sm bg-muted/50 rounded-lg p-3">
                        <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                        <span className="text-muted-foreground">
                            <span className="font-medium text-foreground">Worth knowing: </span>
                            {bestMatch.limitation}
                        </span>
                    </div>
                )}

                <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">{bestMatch.pricing || bestMatch.accessType}</span>
                    <Button asChild>
                        <a href={bestMatch.platform} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                            Try {bestMatch.name}
                            <ArrowRight className="w-4 h-4" />
                        </a>
                    </Button>
                </div>
            </Card>

            {alternatives.length > 0 && (
                <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Other strong options
                    </p>
                    <div className="grid gap-4 sm:grid-cols-3">
                        {alternatives.map((alt) => (
                            <AlternativeCard key={alt.id} tool={alt} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function AlternativeCard({ tool }: { tool: RecommendedTool }) {
    return (
        <Card className="p-4 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {LABEL_TEXT[tool.label]}
            </span>
            <h3 className="font-semibold mt-1 mb-1">{tool.name}</h3>
            <p className="text-sm text-muted-foreground mb-3 flex-1">{tool.reason}</p>
            <a
                href={tool.platform}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
                Learn more
                <ArrowRight className="w-3 h-3" />
            </a>
        </Card>
    )
}
