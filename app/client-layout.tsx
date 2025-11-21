"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import { OnboardingModal } from "@/components/onboarding-modal"
import { initMobileOptimizations } from "@/lib/mobile-utils"

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    // Initialize mobile optimizations
    initMobileOptimizations()

    // Check if user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem("arcyn-onboarding-complete")
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true)
    }
  }, [])

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
  }

  return (
    <>
      {/* Onboarding modal */}
      <AnimatePresence>{showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}</AnimatePresence>
      {children}
    </>
  )
}
