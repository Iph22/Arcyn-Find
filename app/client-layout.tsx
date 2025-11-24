"use client"

import type React from "react"
import { useEffect } from "react"
import { initMobileOptimizations } from "@/lib/mobile-utils"

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  useEffect(() => {
    // Initialize mobile optimizations
    initMobileOptimizations()
  }, [])

  return <>{children}</>
}
