"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useAuth } from "@/contexts/auth-context"
import { loadUserPreferences, saveUserPreferences } from "@/lib/user-preferences"

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
  instructionsSeen?: boolean
}

interface PreferencesContextType {
  preferences: OnboardingData | null
  isLoading: boolean
  updatePreferences: (data: Partial<OnboardingData>) => Promise<void>
  clearPreferences: () => void
  hasCompletedOnboarding: boolean
  login: (name: string, email: string) => void
  logout: () => void
  refresh: () => Promise<void>
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const [preferences, setPreferences] = useState<OnboardingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadPreferences = async () => {
    try {
      if (authLoading) return

      // Load from database (single source of truth)
      if (isAuthenticated && user) {
        const dbPreferences = await loadUserPreferences()
        if (dbPreferences) {
          setPreferences({
            ...dbPreferences,
            userName: user.name || user.email?.split("@")[0] || null,
            userEmail: user.email || null,
            isAuthenticated: true,
          } as OnboardingData)
        } else {
          // No preferences yet - user is new
          setPreferences({
            isAuthenticated: true,
            userName: user.name || user.email?.split("@")[0] || null,
            userEmail: user.email || null,
            purpose: "",
            level: "",
            categories: [],
            features: [],
            completed: false,
            timestamp: "",
            instructionsSeen: false,
          })
        }
      } else {
        // Not authenticated
        setPreferences(null)
      }
    } catch (error) {
      console.error("Error loading preferences:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPreferences()
  }, [user, authLoading, isAuthenticated])

  const updatePreferences = async (data: Partial<OnboardingData>) => {
    const updated = { ...preferences, ...data } as OnboardingData
    setPreferences(updated)

    // Save to database (single source of truth)
    try {
      if (isAuthenticated) {
        await saveUserPreferences(data)
      }
    } catch (error) {
      console.error("Error saving preferences to database:", error)
    }
  }

  const login = (name: string, email: string) => {
    setPreferences(prev => ({
      ...prev,
      userName: name,
      userEmail: email,
      isAuthenticated: true,
    } as OnboardingData))
  }

  const logout = async () => {
    setPreferences(prev => ({
      ...prev,
      userName: null,
      userEmail: null,
      isAuthenticated: false,
    } as OnboardingData))
  }

  const clearPreferences = () => {
    setPreferences(null)
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
        refresh: loadPreferences,
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
