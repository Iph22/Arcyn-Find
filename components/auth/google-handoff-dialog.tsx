"use client"

import { ArrowRight, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Shown on Android immediately before handing off to Google.
 *
 * WHY THIS EXISTS: people with Google accounts were ending up in Google's
 * account *creation* flow and being told their address already exists.
 *
 * Google's sign-in page only offers an account chooser when the browser has a
 * Google session. On Android the account usually belongs to the device rather
 * than to the browser, so there is nothing to offer and Google renders an
 * empty "Email or phone" box with `Create account` directly beneath it. A new
 * user, mid-way through signing up for something, reads that as the button for
 * them.
 *
 * Nothing on the OAuth request changes this. Measured against production on an
 * emulated Pixel 8: `prompt=select_account`, `prompt` omitted entirely, and
 * `login_hint` set to a real address all produce the same screen, and
 * Instagram, Facebook and generic WebView user agents get it too. Google
 * Identity Services would not help either — One Tap and FedCM surface accounts
 * the *browser* already knows, which is precisely what is missing.
 *
 * So the last place this can be influenced is here, on the screen before.
 *
 * Android only, by the product owner's decision: iOS users should not pay an
 * extra tap for a problem that has only been reported on Android. Worth
 * knowing that the underlying cause is not Android-specific — any browser
 * without a Google session lands on the same page — so if iOS reports appear,
 * widen the condition in contexts/auth-context.tsx rather than assuming
 * something new is wrong.
 */
export function GoogleHandoffDialog({
  open,
  onCancel,
  onContinue,
}: {
  open: boolean
  onCancel: () => void
  onContinue: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Signing in with Google</DialogTitle>
          <DialogDescription>
            You&apos;ll see Google&apos;s own sign-in screen next.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              1
            </span>
            <span>
              Enter the Google address you <strong className="font-semibold">already use</strong>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              2
            </span>
            <span>
              Tap <strong className="font-semibold">Next</strong>
            </span>
          </li>
        </ol>

        <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <p className="text-muted-foreground">
            Don&apos;t tap <strong className="font-semibold text-foreground">Create account</strong> —
            you already have one, and Google will say it&apos;s taken.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancel} className="min-h-[44px]">
            Cancel
          </Button>
          <Button onClick={onContinue} className="min-h-[44px]">
            Continue to Google
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
