"use client"

import { useState, useEffect, useRef } from "react"
import type { Recommendation } from "@/lib/recommend"

type RecommendResponse = Recommendation & { message?: string; error?: string }

interface UseRecommendationReturn {
    recommendation: RecommendResponse | null
    isLoading: boolean
    /** Deliberately not surfaced as a user-facing error. See note below. */
    failed: boolean
}

/** Below this length a query isn't a goal, it's a fragment — not worth a
 *  reasoning call. `useAITools` will still search normally. */
const MIN_QUERY_LENGTH = 3

/**
 * Fetch an explained recommendation for a search query.
 *
 * Runs ALONGSIDE the normal tools search, never in front of it: the directory
 * grid renders as soon as /api/ai-models returns (~1-2s) while this fills in
 * when the reasoning call completes (~3-4s). That ordering is the whole point —
 * the results list must never wait on the AI panel.
 *
 * Expects an ALREADY-DEBOUNCED query. The caller (app/tools/page.tsx) shares
 * the same 450ms debounced value it feeds to useAITools, so a reasoning call
 * can't fire per keystroke.
 */
export function useRecommendation(query: string | undefined): UseRecommendationReturn {
    const [recommendation, setRecommendation] = useState<RecommendResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [failed, setFailed] = useState(false)
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => {
        const trimmed = (query ?? "").trim()

        if (trimmed.length < MIN_QUERY_LENGTH) {
            setRecommendation(null)
            setIsLoading(false)
            setFailed(false)
            return
        }

        // Cancel any in-flight call so a slow earlier query can't overwrite a
        // newer one's result — same race the search hook guards against.
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller

        setIsLoading(true)
        setFailed(false)

        fetch("/api/recommend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: trimmed }),
            signal: controller.signal,
        })
            .then(async res => {
                const data = await res.json()
                if (controller.signal.aborted) return
                if (!res.ok) {
                    setFailed(true)
                    setRecommendation(null)
                    return
                }
                setRecommendation(data)
            })
            .catch(err => {
                if (err instanceof DOMException && err.name === "AbortError") return
                // Intentionally silent to the user: this panel is an ENHANCEMENT
                // over the results list, which is rendering fine on its own. An
                // error banner here would imply the search failed when it didn't.
                setFailed(true)
                setRecommendation(null)
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false)
            })

        return () => controller.abort()
    }, [query])

    return { recommendation, isLoading, failed }
}
