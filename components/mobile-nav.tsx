"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Home, Sparkles, Bookmark, User, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { UserSearch } from "@/components/user-search"

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Don't show on landing page, auth pages, or desktop
  if (!isMobile || pathname === '/' || pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up') || pathname?.startsWith('/contact') || pathname?.startsWith('/about') || pathname?.startsWith('/privacy') || pathname?.startsWith('/terms')) {
    return null
  }

  const navItems = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/tools", label: "Tools", icon: Sparkles },
    { href: "/collections", label: "Saved", icon: Bookmark },
    { href: "/profile", label: "Profile", icon: User },
  ]

  const isActive = (href: string) => {
    if (href === "/home") return pathname === "/home"
    return pathname?.startsWith(href)
  }

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
                <Icon className={cn("w-5 h-5", active && "scale-110")} />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </Link>
            )
          })}
          {/* Search Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 relative transition-colors",
              "text-muted-foreground active:text-primary"
            )}
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight">Search</span>
          </button>
        </div>
      </motion.nav>

      {/* Search Modal for Mobile */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-background/95 backdrop-blur-xl">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Search Users</h2>
                <button
                  onClick={() => setIsSearchOpen(false)}
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
        </div>
      )}
    </>
  )
}

