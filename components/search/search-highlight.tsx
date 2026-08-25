"use client"

import React from "react"

/**
 * Highlights matching search terms within text.
 * Like Google — shows users exactly WHY a result matched their query.
 */
export function HighlightedText({
    text,
    query,
    className = "",
    highlightClassName = "bg-primary/20 text-primary font-medium rounded-sm px-0.5",
}: {
    text: string
    query: string
    className?: string
    highlightClassName?: string
}) {
    if (!query || query.trim().length < 2) {
        return <span className={className}>{text}</span>
    }

    // Split query into individual words, filter short ones
    const words = query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 2)

    if (words.length === 0) {
        return <span className={className}>{text}</span>
    }

    // Build a regex that matches any of the search words
    const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    const regex = new RegExp(`(${escaped.join("|")})`, "gi")

    const parts = text.split(regex)

    return (
        <span className={className}>
            {parts.map((part, i) => {
                const isMatch = words.some(
                    (w) => part.toLowerCase() === w.toLowerCase()
                )
                return isMatch ? (
                    <mark key={i} className={highlightClassName}>
                        {part}
                    </mark>
                ) : (
                    <React.Fragment key={i}>{part}</React.Fragment>
                )
            })}
        </span>
    )
}
