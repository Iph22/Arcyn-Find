"use client"

import { useState } from "react"
import { ThumbsUp, ThumbsDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const REASONS: { value: string; label: string }[] = [
    { value: "not_relevant", label: "Not relevant" },
    { value: "too_expensive", label: "Too expensive" },
    { value: "missing_feature", label: "Missing a feature" },
    { value: "better_alternative", label: "Know a better one" },
    { value: "wrong_category", label: "Wrong category" },
    { value: "other", label: "Other" },
]

interface RecommendationFeedbackProps {
    query: string
    toolId: string
    slot?: "best_match" | "alternative"
}

/**
 * Thumbs up/down on a recommendation, with an optional reason on a down vote.
 *
 * Fire-and-forget by design: the vote is recorded optimistically and a failed
 * request is not surfaced to the user. Feedback is a side channel — an error
 * toast here would interrupt someone who is trying to find a tool, over a
 * request whose only purpose is to help US. Failures are logged server-side.
 */
export function RecommendationFeedback({ query, toolId, slot = "best_match" }: RecommendationFeedbackProps) {
    const [verdict, setVerdict] = useState<"up" | "down" | null>(null)
    const [reasonGiven, setReasonGiven] = useState(false)

    const send = (body: Record<string, unknown>) => {
        void fetch("/api/recommend/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, toolId, slot, ...body }),
        }).catch(() => {
            // Intentionally silent — see the note above.
        })
    }

    const vote = (next: "up" | "down") => {
        if (verdict) return
        setVerdict(next)
        send({ verdict: next })
    }

    const pickReason = (reason: string) => {
        setReasonGiven(true)
        send({ verdict: "down", reason })
    }

    if (verdict === "up") {
        return (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary" />
                Thanks — that helps us rank better.
            </p>
        )
    }

    if (verdict === "down") {
        return reasonGiven ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary" />
                Thanks — noted.
            </p>
        ) : (
            <div className="mt-3">
                <p className="mb-1.5 text-xs text-muted-foreground">What was off?</p>
                <div className="flex flex-wrap gap-1.5">
                    {REASONS.map(r => (
                        <button
                            key={r.value}
                            type="button"
                            onClick={() => pickReason(r.value)}
                            className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/50 hover:text-foreground"
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Was this useful?</span>
            <button
                type="button"
                onClick={() => vote("up")}
                aria-label="This recommendation was useful"
                className={cn(
                    "rounded-md p-1 text-muted-foreground transition-colors",
                    "hover:bg-accent/60 hover:text-primary"
                )}
            >
                <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                onClick={() => vote("down")}
                aria-label="This recommendation was not useful"
                className={cn(
                    "rounded-md p-1 text-muted-foreground transition-colors",
                    "hover:bg-accent/60 hover:text-destructive"
                )}
            >
                <ThumbsDown className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}
