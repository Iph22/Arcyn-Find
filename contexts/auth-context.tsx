"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"

export interface GoogleUser {
    id: string
    email: string
    name: string
    picture: string
}

interface AuthContextType {
    user: GoogleUser | null
    isLoading: boolean
    isAuthenticated: boolean
    signIn: () => void
    signOut: () => Promise<void>
    refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<GoogleUser | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()
    const pathname = usePathname()

    const refreshUser = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/session', {
                method: 'GET',
                credentials: 'include',
            })

            if (response.ok) {
                const data = await response.json()
                if (data.user) {
                    setUser(data.user)
                } else {
                    setUser(null)
                }
            } else {
                setUser(null)
            }
        } catch (error) {
            console.error('Error refreshing user:', error)
            setUser(null)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        refreshUser()
    }, [refreshUser])

    const signIn = useCallback(() => {
        // Store current path for redirect after auth
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('auth_redirect', pathname || '/home')
        }

        // Redirect to Google OAuth
        window.location.href = '/api/auth/google'
    }, [pathname])

    const signOut = useCallback(async () => {
        try {
            await fetch('/api/auth/signout', {
                method: 'POST',
                credentials: 'include',
            })
            setUser(null)
            router.push('/')
        } catch (error) {
            console.error('Error signing out:', error)
        }
    }, [router])

    const isAuthenticated = !!user

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated,
                signIn,
                signOut,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}

// Compatibility hooks for migration
export function useUser() {
    const { user, isLoading, isAuthenticated } = useAuth()
    return {
        user,
        isLoaded: !isLoading,
        isSignedIn: isAuthenticated,
    }
}

export function useSignIn() {
    const { signIn } = useAuth()
    return { signIn }
}

export function useSignOut() {
    const { signOut } = useAuth()
    return { signOut }
}
