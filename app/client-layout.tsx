"use client"

import type React from "react"

import { MobileNav } from "@/components/layout/mobile-nav"

/**
 * Client shell around every route.
 *
 * This used to call `initMobileOptimizations()` from lib/mobile-utils on
 * mount. That module is gone: everything in it was dead.
 *
 *  - It wrote `is-mobile` / `is-ios` / `is-android` / `is-touch` onto <html>,
 *    and nothing in the app -- no stylesheet, no component -- ever read any of
 *    them. They were also computed once on mount and never recomputed, so a
 *    rotation or a resize left them stale.
 *  - It registered `touchstart` and `touchmove` listeners on `document` whose
 *    handlers ended in an empty `if` block, so every touchmove on every page
 *    ran a handler that did nothing.
 *  - Its remaining exports (isMobile, isIOS, getSafeAreaInsets, ...) had no
 *    callers at all.
 *
 * What it was reaching for is now done in CSS, where it belongs: `pointer:
 * coarse` and `hover: none` ask about the input device directly rather than
 * sniffing the user agent, and they stay correct when the device changes
 * underneath us.
 */
export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      {children}
      <MobileNav />
    </>
  )
}
