"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { GoogleHandoffDialog } from "@/components/auth/google-handoff-dialog"

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
    /** True only once we are actually navigating to Google. While the Android
     *  hand-off dialog is open this stays false: the dialog is the feedback,
     *  and a button spinner behind it would be stranded if you cancelled. */
    isRedirectingToGoogle: boolean
    signOut: () => Promise<void>
    refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<GoogleUser | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [showGoogleHandoff, setShowGoogleHandoff] = useState(false)
    const [isRedirectingToGoogle, setIsRedirectingToGoogle] = useState(false)
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

    const goToGoogle = useCallback(() => {
        setIsRedirectingToGoogle(true)

        // Store current path for redirect after auth
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('auth_redirect', pathname || '/home')
        }

        // Redirect to Google OAuth
        window.location.href = '/api/auth/google'
    }, [pathname])

    /**
     * Android gets one screen of guidance before the hand-off; everyone else
     * goes straight through, unchanged.
     *
     * Google only offers an account chooser when the *browser* holds a Google
     * session. On Android the account typically belongs to the device instead,
     * so Google renders an empty email box with "Create account" under it and
     * people were taking that button, then being told their address already
     * exists. See components/auth/google-handoff-dialog.tsx for what was
     * measured and ruled out.
     *
     * Gating on Android is the product owner's call: iOS has not reported this
     * and should not pay an extra tap for it. The cause is not actually
     * Android-specific, so widen this condition rather than re-diagnosing if
     * iOS reports ever appear.
     *
     * Every entry point — the landing CTA, the sidebar, /sign-in and /sign-up —
     * calls signIn(), so putting it here covers all of them once.
     */
    const signIn = useCallback(() => {
        const isAndroid =
            typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)

        if (isAndroid) {
            setShowGoogleHandoff(true)
            return
        }

        goToGoogle()
    }, [goToGoogle])

    const signOut = useCallback(async () => {
        try {
            await fetch('/api/auth/signout', {
                method: 'POST',
                credentials: 'include',
            })

            // Clearing the session cookie does not clear Cache Storage, which is
            // per-origin rather than per-user. The service worker no longer
            // caches anything behind a session, but a browser that ran an older
            // version still holds those entries, and this is the moment to drop
            // them -- on a shared machine the next person is about to use it.
            //
            // Best effort by design: a failure here must not block signing out.
            try {
                if ('caches' in window) {
                    const names = await caches.keys()
                    await Promise.all(names.map((n) => caches.delete(n)))
                }
                navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_CACHES' })
            } catch {
                // Storage unavailable (private mode, blocked site data). Nothing
                // to clear, and nothing worth failing the sign-out over.
            }

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
                isRedirectingToGoogle,
                signOut,
                refreshUser,
            }}
        >
            {children}
            <GoogleHandoffDialog
                open={showGoogleHandoff}
                onCancel={() => setShowGoogleHandoff(false)}
                onContinue={goToGoogle}
            />
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
