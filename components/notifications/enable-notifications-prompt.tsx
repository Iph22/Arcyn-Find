"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { usePushSubscription } from "@/lib/hooks/use-push-subscription"
import { useLanguage } from "@/contexts/language-context"
import { toast } from "sonner"

/**
 * Asks people to turn browser notifications on.
 *
 * The native permission dialog is a one-shot resource: a browser that has been
 * denied will not ask again, and Chrome hides the prompt entirely for origins
 * users routinely dismiss. So this never calls `requestPermission()` on its
 * own. It shows our own card first, explains what the notification is for, and
 * only reaches the browser dialog on an explicit click — the standard
 * "pre-prompt" pattern, and the reason is that a dismissal here is recoverable
 * while a denial there is close to permanent.
 *
 * It appears only when every one of these holds:
 *
 *   - the visitor is signed in. A subscription is stored against a user id;
 *     there is nobody to store it against otherwise.
 *   - this browser has no subscription already.
 *   - permission is still `default`. Asking someone who has denied is asking
 *     the browser to ignore us, and asking someone already granted is noise.
 *   - the deployment has VAPID keys. Without them `subscribe()` cannot run and
 *     the card would promise something it cannot deliver.
 *   - they have not dismissed it recently, and have been on the page a moment.
 *
 * Dismissal is remembered for 30 days in localStorage. Per-browser rather than
 * per-account on purpose: the thing being asked for is per-browser too, so a
 * new laptop should ask again.
 */

const DISMISS_KEY = "arcynfind_push_prompt_dismissed_at"
const DISMISS_DAYS = 30

/**
 * Long enough that the card is not the first thing to happen on arrival.
 *
 * A prompt that appears before the page has been read is the one people
 * dismiss reflexively, and a reflexive dismissal costs the same 30 days as a
 * considered one.
 */
const APPEAR_AFTER_MS = 12_000

function dismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    // Private mode or blocked storage. Treat as "not dismissed" -- showing the
    // card is a smaller harm than never showing it.
    return false
  }
}

export function EnableNotificationsPrompt() {
  const { isAuthenticated } = useAuth()
  const { subscribed, permission, busy, available, subscribe } = usePushSubscription()
  const { t } = useLanguage()
  const [visible, setVisible] = useState(false)

  const eligible =
    isAuthenticated && available && !subscribed && permission === "default"

  useEffect(() => {
    if (!eligible || dismissedRecently()) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), APPEAR_AFTER_MS)
    return () => clearTimeout(timer)
  }, [eligible])

  const remember = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // Nothing to do; the card simply reappears next visit.
    }
  }

  const onEnable = async () => {
    const ok = await subscribe()
    setVisible(false)
    if (ok) {
      toast.success(t("toast.pushEnabled"))
    } else {
      // Covers both "denied" and a failed handshake. Either way, stop asking:
      // a denial is permanent until the reader changes it in site settings, and
      // re-offering a card that cannot work is worse than silence.
      remember()
    }
  }

  const onDismiss = () => {
    remember()
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          // Sits above the mobile nav bar rather than over it.
          className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg md:bottom-6 md:left-auto md:right-6"
          role="dialog"
          aria-label={t("push.promptTitle")}
        >
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10">
              <Bell className="size-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t("push.promptTitle")}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("push.promptBody")}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={onEnable} disabled={busy}>
                  {busy ? t("push.enabling") : t("push.enable")}
                </Button>
                <Button size="sm" variant="ghost" onClick={onDismiss} disabled={busy}>
                  {t("push.notNow")}
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t("push.dismiss")}
              className="-mr-1 -mt-1 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
