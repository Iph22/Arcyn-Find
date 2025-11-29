"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Home, Sparkles, Bookmark, User, Search, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { UserSearch } from "@/components/user-search"
import { usePreferences } from "@/contexts/preferences-context"
import { Button } from "@/components/ui/button"
import { useHaptic } from "@/hooks/use-haptic"

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { preferences } = usePreferences()
  const isAuthenticated = preferences?.isAuthenticated
  const { trigger: haptic } = useHaptic()

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle browser back button for search modal
  useEffect(() => {
    if (!isSearchOpen) return

    const handlePopState = (e: PopStateEvent) => {
      // If modal is open and user presses back, close modal instead
      if (isSearchOpen) {
        e.preventDefault()
        setIsSearchOpen(false)
        // Push current state to prevent navigation
        window.history.pushState({ modal: false }, '', window.location.pathname)
      }
    }

    // Push state when modal opens
    window.history.pushState({ modal: true }, '', window.location.pathname)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isSearchOpen])

  // Don't show on landing page, auth pages, or desktop
  if (!isMobile || pathname === '/' || pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up') || pathname?.startsWith('/contact') || pathname?.startsWith('/about') || pathname?.startsWith('/privacy') || pathname?.startsWith('/terms')) {
    return null
  }

  const navItems = [
    { href: "/home", label: "Home", icon: Home, requiresAuth: true },
    { href: "/tools", label: "Tools", icon: Sparkles, requiresAuth: false },
    { href: "/collections", label: "Saved", icon: Bookmark, requiresAuth: true },
    { href: "/profile", label: "Profile", icon: User, requiresAuth: true },
  ]

  const isActive = (href: string) => {
    if (href === "/home") return pathname === "/home"
    return pathname?.startsWith(href)
  }

  // For guests, show simplified navigation with sign-in prompt
  if (!isAuthenticated) {
    return (
      <>
        {/* Mobile Bottom Navigation for Guests */}
        <motion.nav
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-xl border-t border-border/50 safe-area-inset-bottom"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="flex items-center justify-around h-16 px-2 gap-2">
            {/* Tools Link */}
            <Link
              href="/tools"
              onClick={() => haptic("light")}
              className={cn(
                "flex flex-col items-center justify-center gap-1 relative transition-colors flex-1 min-w-0",
                pathname === "/tools"
                  ? "text-primary"
                  : "text-muted-foreground active:text-primary"
              )}
            >
              {pathname === "/tools" && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-b-full"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <motion.div whileTap={{ scale: 0.9 }}>
                <Sparkles className={cn("w-5 h-5 shrink-0", pathname === "/tools" && "scale-110")} />
              </motion.div>
              <span className="text-[10px] font-medium leading-tight">Tools</span>
            </Link>

            {/* Sign In Button */}
            <Button
              onClick={() => router.push("/sign-in")}
              className="flex-[2] h-12 mx-1 flex flex-col items-center justify-center gap-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              variant="default"
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span className="text-[10px] font-medium leading-tight text-center px-1 line-clamp-2">
                Sign in to use more tools
              </span>
            </Button>
          </div>
        </motion.nav>
      </>
    )
  }

  // For authenticated users, show full navigation
  return (
    <>
      {/* Mobile Bottom Navigation */}
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-xl border-t border-border/50 safe-area-inset-bottom"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => haptic("light")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 relative transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground active:text-primary"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-b-full"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Icon className={cn("w-5 h-5", active && "scale-110")} />
                </motion.div>
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </Link>
            )
          })}
          {/* Search Button */}
          <button
            onClick={() => {
              setIsSearchOpen(true)
              haptic("medium")
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-1 relative transition-colors",
              "text-muted-foreground active:text-primary"
            )}
          >
            <motion.div whileTap={{ scale: 0.9 }}>
              <Search className="w-5 h-5" />
            </motion.div>
            <span className="text-[10px] font-medium leading-tight">Search</span>
          </button>
        </div>
      </motion.nav>

      {/* Search Modal for Mobile */}
      {isSearchOpen && (
        <motion.div
          className="fixed inset-0 z-[100] md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-background/95 backdrop-blur-xl">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Search Users</h2>
                <button
                  onClick={() => {
                    setIsSearchOpen(false)
                    // Go back in history if we pushed a state, otherwise just close
                    if (window.history.state?.modal) {
                      window.history.back()
                    }
                  }}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <span className="text-lg">✕</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <UserSearch />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </>
  )
}

