"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'

interface AvatarContextType {
  avatarUrl: string | null
  displayName: string | null
  username: string | null
  refreshAvatar: () => Promise<void>
  updateAvatar: (url: string) => void
}

const AvatarContext = createContext<AvatarContextType | undefined>(undefined)

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)

  const refreshAvatar = useCallback(async () => {
    try {
      if (user) {
        const response = await fetch('/api/user/profile')
        if (response.ok) {
          const data = await response.json()
          if (data.profile) {
            setAvatarUrl(data.profile.avatar_url || user.imageUrl || null)
            setDisplayName(data.profile.display_name || user.fullName || null)
            setUsername(data.profile.username || user.username || null)
          } else {
            // Fallback to Clerk data if no profile exists
            setAvatarUrl(user.imageUrl || null)
            setDisplayName(user.fullName || null)
            setUsername(user.username || null)
          }
        }
      }
    } catch (error) {
      console.error("Error loading avatar:", error)
      // Fallback to Clerk data on error
      if (user) {
        setAvatarUrl(user.imageUrl || null)
        setDisplayName(user.fullName || null)
        setUsername(user.username || null)
      }
    }
  }, [user])

  const updateAvatar = useCallback((url: string) => {
    setAvatarUrl(url)
  }, [])

  useEffect(() => {
    if (user) {
      refreshAvatar()
    }
  }, [user, refreshAvatar])

  return (
    <AvatarContext.Provider value={{ avatarUrl, displayName, username, refreshAvatar, updateAvatar }}>
      {children}
    </AvatarContext.Provider>
  )
}

export function useAvatar() {
  const context = useContext(AvatarContext)
  if (context === undefined) {
    // Return default values instead of throwing error
    // This handles cases where hook is called before provider mounts
    return {
      avatarUrl: null,
      displayName: null,
      username: null,
      refreshAvatar: async () => {},
      updateAvatar: () => {}
    }
  }
  return context
}
