"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

interface OnboardingData {
  userName?: string | null
  userEmail?: string | null
  userRole?: "developer" | "student" | "designer" | "business" | "enthusiast" | null
  isAuthenticated?: boolean
  purpose: string
  level: string
  categories: string[]
  features: string[]
  completed: boolean
  timestamp: string
}

interface PreferencesContextType {
  preferences: OnboardingData | null
  isLoading: boolean
  updatePreferences: (data: Partial<OnboardingData>) => void
  clearPreferences: () => void
  hasCompletedOnboarding: boolean
  login: (name: string, email: string) => void
  logout: () => void
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<OnboardingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load preferences from localStorage
    const stored = localStorage.getItem("arcyn_onboarding")
    if (stored) {
      try {
        const data = JSON.parse(stored)
        setPreferences(data)
      } catch (error) {
        console.error("Failed to parse preferences:", error)
      }
    }
    setIsLoading(false)
  }, [])

  const updatePreferences = (data: Partial<OnboardingData>) => {
    const updated = { ...preferences, ...data } as OnboardingData
    setPreferences(updated)
    localStorage.setItem("arcyn_onboarding", JSON.stringify(updated))
  }

  const login = (name: string, email: string) => {
    updatePreferences({ userName: name, userEmail: email, isAuthenticated: true })
  }

  const logout = () => {
    updatePreferences({
      userName: null,
      userEmail: null,
      isAuthenticated: false,
      userRole: null,
      completed: false, // Reset onboarding on logout if desired, or keep it
    })
  }

  const clearPreferences = () => {
    setPreferences(null)
    localStorage.removeItem("arcyn_onboarding")
  }

  const hasCompletedOnboarding = preferences?.completed ?? false

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        isLoading,
        updatePreferences,
        clearPreferences,
        hasCompletedOnboarding,
        login,
        logout,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider")
  }
  return context
}
