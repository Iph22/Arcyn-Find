"use client"

/**
 * Floating "Send feedback" control for the private review round.
 *
 * Deliberately posts to the existing `/api/contact` route rather than a new
 * endpoint: that route is already rate limited, schema validated and
 * XSS sanitised, and reusing it means this feature ships without a migration,
 * a new table or a new attack surface on the day of the release.
 *
 * `contactFormSchema` is `.strict()`, so the body may carry exactly
 * name/email/subject/message and nothing else. The page a reviewer was looking
 * at -- the single most useful field for acting on a report -- therefore rides
 * inside `subject` and `message` instead of as its own key.
 *
 * Gated on NEXT_PUBLIC_FEEDBACK_MODE so the round can be ended from the Vercel
 * dashboard rather than by shipping a revert.
 */

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { MessageSquarePlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

const IDENTITY_KEY = "arcyn-feedback-identity"
const MIN_MESSAGE = 10
const MAX_MESSAGE = 5000

export function FeedbackWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  // Reviewers file several notes across a session; asking who they are every
  // time is the friction that turns the fifth report into no report.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(IDENTITY_KEY)
      if (!saved) return
      const parsed = JSON.parse(saved) as { name?: string; email?: string }
      if (parsed.name) setName(parsed.name)
      if (parsed.email) setEmail(parsed.email)
    } catch {
      // A blocked or corrupt localStorage costs a prefill, not the widget.
    }
  }, [])

  const submit = async () => {
    const trimmed = message.trim()
    if (trimmed.length < MIN_MESSAGE) {
      toast.error(`Please add a little more detail (at least ${MIN_MESSAGE} characters).`)
      return
    }

    setSending(true)
    try {
      // Captured at send time so the context describes the page the reviewer is
      // actually reporting on, not wherever they drifted to afterwards.
      const context = [
        `Page: ${pathname}`,
        `URL: ${typeof window !== "undefined" ? window.location.href : pathname}`,
        `Viewport: ${typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "unknown"}`,
        `User agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "unknown"}`,
      ].join("\n")

      const body = `${trimmed}\n\n---\n${context}`

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Anonymous reviewer",
          email: email.trim(),
          // 200-char ceiling on the column; the path is what makes one report
          // distinguishable from the next in an inbox.
          subject: `[Beta feedback] ${pathname}`.slice(0, 200),
          message: body.slice(0, MAX_MESSAGE),
        }),
      })

      if (!response.ok) {
        // Two different error shapes come back from this route, and the useful
        // sentence is in a different key in each:
        //
        //   createRateLimitResponse -> { error: "Too Many Requests", message: "<copy>" }
        //   createErrorResponse     -> { error: "<copy>" }
        //
        // `message` is checked first so a rate-limited reviewer is told to wait
        // rather than being shown the bare status. At 3 submissions per minute
        // this is the failure they are most likely to meet -- filing three
        // quick notes on one page is exactly the intended use.
        const data = await response.json().catch(() => null)
        const detail =
          typeof data?.message === "string"
            ? data.message
            : typeof data?.error === "string"
              ? data.error
              : null
        throw new Error(detail || "Could not send that feedback.")
      }

      try {
        localStorage.setItem(IDENTITY_KEY, JSON.stringify({ name, email }))
      } catch {
        // Not worth failing a successful send over.
      }

      toast.success("Thanks — that went through.")
      setMessage("")
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that feedback.")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Sits above the mobile bottom nav rather than on top of it. Both are
          `z-50` and the nav occupies the last 56px + safe-area inset of the
          viewport, so at `bottom-5` this button landed squarely over the nav's
          right-hand item -- Search for signed-in users, which is how you open
          search on a phone. Desktop is unchanged: the nav is `md:hidden`. */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(1.25rem_+_var(--mobile-nav-clearance))] right-5 z-50 h-12 rounded-full shadow-lg gap-2 px-5 md:bottom-5"
        aria-label="Send feedback about this page"
      >
        <MessageSquarePlus className="w-5 h-5" />
        <span className="hidden sm:inline">Feedback</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              About <span className="font-mono text-xs">{pathname}</span>. The page and your
              browser details are attached automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="feedback-name">Name</Label>
                <Input
                  id="feedback-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feedback-email">Email</Label>
                <Input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  maxLength={200}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="feedback-message">What did you notice?</Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What you expected, what happened, and anything that felt confusing."
                rows={5}
                maxLength={MAX_MESSAGE}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={sending}>
              {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {sending ? "Sending…" : "Send feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
