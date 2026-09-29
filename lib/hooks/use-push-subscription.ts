"use client"

import { useCallback, useEffect, useState } from "react"
import { logger } from "@/lib/logger"

/**
 * Browser push subscription, as one piece of state two places can use.
 *
 * Extracted from the settings page because a second caller arrived — the
 * prompt that asks people to turn notifications on. Two copies of this would
 * drift, and the half that drifted would be the one nobody tested: subscribing
 * is three steps (permission, `pushManager.subscribe()`, tell the server) and
 * skipping the third leaves a browser the server cannot reach while the UI
 * says it is subscribed. That was the original bug here.
 */

export type PushPermission = "default" | "granted" | "denied" | "unsupported"

export interface PushSubscriptionState {
  /** Whether THIS browser currently holds a subscription. */
  subscribed: boolean
  permission: PushPermission
  busy: boolean
  /** False when the browser or the deployment cannot do push at all. */
  available: boolean
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<void>
}

/**
 * Convert a VAPID public key to the byte array `pushManager.subscribe()` wants.
 *
 * The key travels as base64url (`-`/`_`, unpadded) because it lives in URLs and
 * headers, but `applicationServerKey` takes raw bytes. Passing the string
 * through unconverted fails with an opaque `InvalidAccessError`.
 *
 * The ArrayBuffer is allocated explicitly: since TypeScript 5.7 the typed
 * arrays are generic over their buffer, and `new Uint8Array(length)` widens to
 * `Uint8Array<ArrayBufferLike>`, which admits SharedArrayBuffer and is not
 * assignable to `BufferSource`.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

function readPermission(): PushPermission {
  if (typeof window === "undefined") return "unsupported"
  if (!("Notification" in window)) return "unsupported"
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported"
  return Notification.permission as PushPermission
}

export function usePushSubscription(): PushSubscriptionState {
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState<PushPermission>("default")
  const [busy, setBusy] = useState(false)

  // A subscription belongs to a browser, not an account, so the switch has to
  // reflect what this browser actually holds rather than a stored preference.
  useEffect(() => {
    let cancelled = false
    setPermission(readPermission())

    const read = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!cancelled) setSubscribed(Boolean(sub))
      } catch {
        // A browser that will not report its subscription is one we cannot
        // claim is subscribed.
        if (!cancelled) setSubscribed(false)
      }
    }
    read()
    return () => {
      cancelled = true
    }
  }, [])

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const available = permission !== "unsupported" && Boolean(vapidKey)

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!available || !vapidKey) return false

    setBusy(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result as PushPermission)
      if (result !== "granted") return false

      const reg = await navigator.serviceWorker.ready
      // Reuse an existing subscription rather than creating a second one:
      // `subscribe()` on an already-subscribed registration with a different
      // key throws rather than replacing.
      const existing = await reg.pushManager.getSubscription()
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          // Chrome rejects silent pushes outright.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }))

      const response = await fetch("/api/notifications/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      })

      if (!response.ok) {
        // Subscribed locally but unreachable from the server is the exact
        // half-configured state this flow exists to avoid. Undo it so the UI
        // does not claim something untrue.
        await sub.unsubscribe().catch(() => {})
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Could not save the subscription")
      }

      setSubscribed(true)
      return true
    } catch (error) {
      logger.error("Error enabling push:", error)
      setSubscribed(false)
      return false
    } finally {
      setBusy(false)
    }
  }, [available, vapidKey])

  const unsubscribe = useCallback(async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()

      // Server first: if the local unsubscribe succeeds and this fails, the row
      // outlives the browser behind it and we push into the void until the push
      // service reports it gone.
      await fetch("/api/notifications/push-subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub?.endpoint ?? "" }),
      })

      await sub?.unsubscribe()
      setSubscribed(false)
    } catch (error) {
      logger.error("Error disabling push:", error)
    } finally {
      setBusy(false)
    }
  }, [])

  return { subscribed, permission, busy, available, subscribe, unsubscribe }
}
