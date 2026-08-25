"use client"

import { motion } from "framer-motion"

/**
 * Premium skeleton loading cards that match the tool card layout.
 * Shows a shimmer animation while results are loading — much better UX than a spinner.
 */
export function SearchSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm"
                >
                    {/* Image skeleton */}
                    <div className="relative h-40 md:h-48 bg-muted/50 overflow-hidden">
                        <div className="absolute inset-0 skeleton-shimmer" />
                    </div>

                    {/* Content skeleton */}
                    <div className="p-4 md:p-5 space-y-3">
                        {/* Title */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="h-5 w-3/4 rounded-md bg-muted/60 skeleton-shimmer" />
                            <div className="h-8 w-8 rounded-lg bg-muted/40 shrink-0 skeleton-shimmer" />
                        </div>

                        {/* Description lines */}
                        <div className="space-y-2">
                            <div className="h-3 w-full rounded bg-muted/40 skeleton-shimmer" />
                            <div className="h-3 w-5/6 rounded bg-muted/40 skeleton-shimmer" />
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-20 rounded-full bg-muted/50 skeleton-shimmer" />
                            <div className="h-5 w-16 rounded-full bg-muted/40 skeleton-shimmer" />
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-3">
                                <div className="h-4 w-12 rounded bg-muted/40 skeleton-shimmer" />
                                <div className="h-4 w-12 rounded bg-muted/40 skeleton-shimmer" />
                            </div>
                            <div className="h-7 w-16 rounded-md bg-muted/40 skeleton-shimmer" />
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    )
}

/**
 * Inline skeleton for autocomplete suggestions
 */
export function SuggestionSkeleton({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-1 p-1">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-sm">
                    <div className="h-4 w-4 rounded bg-muted/50 skeleton-shimmer" />
                    <div className="h-4 flex-1 rounded bg-muted/40 skeleton-shimmer" style={{ maxWidth: `${60 + Math.random() * 30}%` }} />
                </div>
            ))}
        </div>
    )
}
