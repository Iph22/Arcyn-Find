"use client"

import { useEffect } from "react"

/**
 * Tool ids already reported during this page session.
 *
 * Module level rather than per-component, so closing and re-opening the same
 * tool's modal does not report a second view. The counter this feeds drives
 * `popularity` and the trending score, and letting one person inflate it by
 * toggling a dialog is the same abuse `/api/track-view`'s rate limit exists to
 * stop — this just declines to generate the traffic in the first place.
 *
 * A full page load starts a new session and will report again, which is the
 * intended granularity: "this person opened this tool again later" is a real
 * view, "this dialog re-mounted" is not.
 */
const reportedThisSession = new Set<string>()

/**
 * Report that a tool was viewed.
 *
 * Pass `null` while the tool is not actually on screen (a closed modal); the
 * request fires when a non-null id first appears, so the caller can pass
 * `isOpen ? tool.id : null` without writing its own effect.
 *
 * Fire-and-forget by design. A failed view report is invisible to the reader
 * and must stay that way, and `keepalive` lets the request finish after the
 * document goes away — on a directory page, clicking straight through to the
 * tool's own site is the common path, and without it the view is lost exactly
 * for the tools people engage with most.
 */
export function useTrackToolView(toolId: string | null | undefined) {
  useEffect(() => {
    if (!toolId || reportedThisSession.has(toolId)) return

    // Claimed before the request starts: React runs effects twice in
    // development StrictMode, and the marker has to beat the second pass.
    reportedThisSession.add(toolId)

    void fetch("/api/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiId: toolId }),
      keepalive: true,
    }).catch(() => {
      // Network failure, not a rejection: let a later mount try again.
      reportedThisSession.delete(toolId)
    })
  }, [toolId])
}
