"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Layers, ArrowUpRight, Loader2, TriangleAlert, CornerDownRight } from "lucide-react"
import { priceLabelCompact } from "@/lib/pricing-display"
import { cn } from "@/lib/utils"
import type { Stack } from "@/lib/stack"

interface StackBuilderProps {
    goal: string
}

/**
 * Phase 3 "Build my stack" — opt-in, inline, below the recommendation.
 *
 * DELIBERATELY BEHIND A BUTTON rather than built automatically for every
 * search. A stack costs one model call to decompose the goal plus one retrieval
 * per stage, and the Gemini quota is the binding constraint on this whole
 * feature set — the recommendation eval has been reporting `reasoned 0%`
 * throughout. Spending that budget on every searcher, most of whom want one
 * tool, would starve the users who actually asked for a plan.
 */
export function StackBuilder({ goal }: StackBuilderProps) {
    const [stack, setStack] = useState<Stack | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const build = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/stack", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ goal }),
            })
            const body = await res.json()
            if (!res.ok) {
                setError(body?.error || "Could not build a stack for this goal.")
                return
            }
            setStack(body as Stack)
        } catch {
            setError("Could not reach the stack builder. Check your connection and try again.")
        } finally {
            setIsLoading(false)
        }
    }

    if (!stack && !isLoading && !error) {
        return (
            <div className="mt-4 border-t border-border/50 pt-3">
                <button
                    type="button"
                    onClick={build}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/50 hover:text-foreground"
                >
                    <Layers className="h-3.5 w-3.5" />
                    Build my stack
                </button>
                <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                    One tool rarely covers a whole goal. This works out the full sequence and what it costs.
                </p>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Working out the stages and matching a tool to each…
            </div>
        )
    }

    if (error) {
        return (
            <div className="mt-4 border-t border-border/50 pt-3">
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {error}
                </p>
            </div>
        )
    }

    if (!stack) return null

    // Degraded, or a goal that genuinely doesn't decompose. Both get the real
    // message rather than an empty "stack" box implying we found nothing.
    if (stack.steps.length === 0) {
        return (
            <div className="mt-4 border-t border-border/50 pt-3">
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {stack.message || "This goal doesn't break down into a sequence of tools."}
                </p>
            </div>
        )
    }

    const filled = stack.steps.filter(s => s.tool).length

    return (
        <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4 border-t border-border/50 pt-3"
        >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    Your stack — {stack.steps.length} {stack.steps.length === 1 ? "stage" : "stages"}
                    {/* Said out loud when the stages came from a
                        hand-authored sequence for a recognised goal rather
                        than analysis of this specific goal. The tools are
                        retrieved identically either way, but claiming we
                        reasoned about their goal when we matched a keyword
                        would be a claim we cannot support. */}
                    {stack.source === "template" && (
                        <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
                            · standard sequence for this kind of goal
                        </span>
                    )}
                </p>
                <p className="text-xs text-muted-foreground">
                    {/* "from", never a flat total: unpriced members are excluded
                        from the sum rather than counted as zero. */}
                    <span className="font-semibold text-foreground">
                        from ${stack.monthlyCostMin}/mo
                    </span>
                    {stack.unpricedToolCount > 0 && (
                        <span>
                            {" "}
                            + {stack.unpricedToolCount} priced by usage or quote
                        </span>
                    )}
                </p>
            </div>

            <ol className="space-y-2">
                {stack.steps.map(step => (
                    <li key={step.order} className="flex gap-2.5">
                        <span
                            className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                                step.tool
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted text-muted-foreground"
                            )}
                        >
                            {step.order}
                        </span>

                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                                <span className="text-sm font-medium">{step.role}</span>
                                {step.tool && (
                                    <span className="text-[11px] text-muted-foreground">
                                        {priceLabelCompact(step.tool)}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">{step.purpose}</p>

                            {step.tool ? (
                                <a
                                    href={step.tool.platform}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                >
                                    {step.tool.name}
                                    <ArrowUpRight className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
                                </a>
                            ) : step.coveredByStep ? (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                    <CornerDownRight className="h-3 w-3 shrink-0" />
                                    Covered by step {step.coveredByStep} — no extra tool needed.
                                </p>
                            ) : (
                                /* Shown, not hidden. A gap in the plan is
                                   information; quietly dropping the stage would
                                   imply the goal needs less than it does. */
                                <p className="mt-0.5 text-xs text-muted-foreground/80">
                                    No good match in our catalog yet.
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ol>

            <p className="mt-2.5 text-[11px] text-muted-foreground/70">
                {filled} of {stack.steps.length} stages matched. Cheapest tier per tool, each billed
                separately — verify pricing before committing.
            </p>
        </motion.div>
    )
}
