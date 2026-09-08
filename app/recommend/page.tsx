"use client"

import { useState } from "react"
import { Loader2, TriangleAlert } from "lucide-react"
import { PremiumSearchInput } from "@/components/search/premium-search-input"
import { RecommendationResult } from "@/components/recommend/recommendation-result"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Recommendation } from "@/lib/recommend"

const EXAMPLE_GOALS = [
    "Create short videos from my podcasts",
    "Build an AI-powered website",
    "Research academic papers",
    "Generate product photos",
    "Automate my business",
]

type RecommendResponse = Recommendation & { message?: string; error?: string }

export default function RecommendPage() {
    const [query, setQuery] = useState("")
    const [submittedQuery, setSubmittedQuery] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<RecommendResponse | null>(null)

    const runRecommendation = async (raw: string) => {
        const trimmed = raw.trim()
        if (!trimmed || isLoading) return

        setSubmittedQuery(trimmed)
        setIsLoading(true)
        setError(null)
        setResult(null)

        try {
            const res = await fetch("/api/recommend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: trimmed }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data?.error || "Something went wrong. Please try again.")
                return
            }
            setResult(data)
        } catch {
            setError("Network error — please check your connection and try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const showExamples = !isLoading && !error && !result

    return (
        <div className="min-h-dvh bg-background">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24">
                <div className="text-center mb-10">
                    <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4 text-balance">
                        Find the right AI for what you&apos;re trying to do.
                    </h1>
                    <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto text-balance">
                        Describe what you want to accomplish. Arcyn Find understands the task, compares relevant
                        AI tools, and recommends the best solution for you.
                    </p>
                </div>

                <PremiumSearchInput
                    value={query}
                    onChange={setQuery}
                    onSubmit={() => runRecommendation(query)}
                    placeholder="What are you trying to accomplish?"
                    showButton
                    autoFocus
                />

                {showExamples && (
                    <div className="flex flex-wrap gap-2 justify-center mt-6">
                        {EXAMPLE_GOALS.map((goal) => (
                            <button
                                key={goal}
                                type="button"
                                onClick={() => {
                                    setQuery(goal)
                                    runRecommendation(goal)
                                }}
                                className="text-sm px-3 py-1.5 rounded-full border border-border/60 hover:border-primary/40 hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                            >
                                {goal}
                            </button>
                        ))}
                    </div>
                )}

                <div className="mt-10">
                    {isLoading && <RecommendationLoading />}

                    {error && (
                        <Card className="p-6 flex items-start gap-3 border-destructive/30">
                            <TriangleAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm text-foreground mb-3">{error}</p>
                                <Button size="sm" variant="outline" onClick={() => runRecommendation(submittedQuery)}>
                                    Try again
                                </Button>
                            </div>
                        </Card>
                    )}

                    {result && !isLoading && !error && (
                        <RecommendationResult query={submittedQuery} recommendation={result} />
                    )}
                </div>
            </div>
        </div>
    )
}

function RecommendationLoading() {
    return (
        <Card className="p-8 flex flex-col items-center gap-3 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
                Comparing tools and working out the best fit for your goal…
            </p>
        </Card>
    )
}
