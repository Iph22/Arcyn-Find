"use client"

import type React from "react"
import { useEffect } from "react"
import { initMobileOptimizations } from "@/lib/mobile-utils"
import { MobileNav } from "@/components/layout/mobile-nav"

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  useEffect(() => {
    // Initialize mobile optimizations
    initMobileOptimizations()
  }, [])

  return (
    <>
      {children}
      <MobileNav />
    </>
  )
}
