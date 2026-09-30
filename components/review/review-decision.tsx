"use client"

import { useState } from "react"
import Image from "next/image"

import type { Screening } from "@/lib/submission-screening"

interface Props {
  token: string
  intent: "approve" | "reject"
  submission: {
    name: string
    description: string
    url: string
    category: string | null
    imageUrl: string | null
    submittedBy: string | null
    status: string
    submittedAt: string
  }
  screening: Screening | null
}

const DOT: Record<string, { glyph: string; className: string }> = {
  pass: { glyph: "✓", className: "text-emerald-600 dark:text-emerald-400" },
  fail: { glyph: "✗", className: "text-red-600 dark:text-red-400" },
  unknown: { glyph: "—", className: "text-muted-foreground" },
}

/**
 * The reviewer's one screen.
 *
 * Everything needed to decide is on it, because the alternative is deciding
 * from a subject line. The screening is shown in full rather than as a score:
 * the score is a summary of what could be determined, and what could NOT be
 * determined is often the interesting part -- a tool whose site refused an
 * automated request is unproven, not suspect.
 */
export function ReviewDecision({ token, intent, submission, screening }: Props) {
  const [pending, setPending] = useState<"approve" | "reject" | null>(null)
  const [done, setDone] = useState<{ action: string; published: boolean; notified: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState("")

  const alreadyReviewed = submission.status !== "pending"

  async function decide(action: "approve" | "reject") {
    setPending(action)
    setError(null)
    try {
      const res = await fetch("/api/submissions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, note }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "That did not work.")
        return
      }
      setDone({ action: data.action, published: data.published, notified: data.notifiedSubmitter })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPending(null)
    }
  }

  if (done) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold tracking-tight">
          {done.action === "approve" ? "Approved" : "Not approved"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          <strong className="text-foreground">{submission.name}</strong>{" "}
          {done.action === "approve"
            ? done.published
              ? "is in the catalog and searchable now."
              : "was approved, but publishing failed — check the logs."
            : "was not added."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {done.notified
            ? "The submitter has been emailed."
            : "No submitter email was on file, so nobody was notified."}
        </p>
        <p className="mt-6 text-sm text-muted-foreground">This link has been used and will not work again.</p>
      </Shell>
    )
  }

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Submission review</p>

      <div className="mt-4 flex items-start gap-4">
        {submission.imageUrl && (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border">
            <Image src={submission.imageUrl} alt="" fill className="object-cover" sizes="64px" unoptimized />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{submission.name}</h1>
          <a
            href={submission.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-1 block break-all text-sm text-primary hover:underline"
          >
            {submission.url}
          </a>
        </div>
      </div>

      <p className="mt-4 leading-relaxed text-foreground/90">{submission.description}</p>

      <p className="mt-3 text-xs text-muted-foreground">
        {submission.category || "Other"}
        {submission.submittedBy ? ` · from ${submission.submittedBy}` : " · no submitter email"}
        {` · ${new Date(submission.submittedAt).toLocaleDateString()}`}
      </p>

      {screening && (
        <div className="mt-7 rounded-xl border border-border/60 bg-card/50 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Automated checks</h2>
            <span className="text-sm text-muted-foreground">{screening.score}/100</span>
          </div>

          {screening.blocking.length > 0 && (
            <ul className="mb-4 space-y-1 rounded-lg border-l-2 border-red-500 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {screening.blocking.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}

          <ul className="space-y-2">
            {screening.checks.map((c) => {
              const dot = DOT[c.status] ?? DOT.unknown
              return (
                <li key={c.id} className="flex gap-3 text-sm">
                  <span className={`font-bold ${dot.className}`}>{dot.glyph}</span>
                  <span className="min-w-0">
                    {c.label}
                    <span className="block text-xs text-muted-foreground">{c.detail}</span>
                  </span>
                </li>
              )
            })}
          </ul>

          <p className="mt-3 text-xs text-muted-foreground">
            “—” means the check could not get an answer, not that it failed. A site that refuses
            automated requests is unproven, not suspect.
          </p>
        </div>
      )}

      {alreadyReviewed ? (
        <p className="mt-7 rounded-lg bg-muted px-4 py-3 text-sm">
          This submission was already {submission.status}.
        </p>
      ) : (
        <>
          <label className="mt-7 block text-sm">
            <span className="text-muted-foreground">Note to yourself (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Why this decision"
            />
          </label>

          {error && (
            <p className="mt-4 rounded-lg border-l-2 border-red-500 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => decide("approve")}
              disabled={pending !== null}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50 ${
                intent === "approve"
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-border hover:bg-accent"
              }`}
            >
              {pending === "approve" ? "Approving…" : "Approve and publish"}
            </button>
            <button
              onClick={() => decide("reject")}
              disabled={pending !== null}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50 ${
                intent === "reject"
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-border hover:bg-accent"
              }`}
            >
              {pending === "reject" ? "Rejecting…" : "Don't approve"}
            </button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            The submitter is emailed either way. This link works once.
          </p>
        </>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-xl">{children}</div>
    </div>
  )
}
