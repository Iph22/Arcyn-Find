"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { User, Bookmark, Star, Users, Sparkles, LogOut, Settings, ChevronLeft, ChevronRight, Home, Search, ArrowLeft, Lock } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePreferences } from "@/contexts/preferences-context"
import { useAvatar } from "@/contexts/avatar-context"
import { useClerk } from "@clerk/nextjs"
import { UserSearch } from "@/components/user-search"

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, preferences } = usePreferences()
  const { avatarUrl, displayName, username } = useAvatar()
  const { signOut } = useClerk()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true'
    }
    return false
  })

  const isAuthenticated = preferences?.isAuthenticated

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-collapsed', String(newState))
    }
  }

  const handleLogout = async () => {
    try {
      logout()
      localStorage.clear()
      sessionStorage.clear()
      await signOut({ redirectUrl: '/' })
    } catch (error) {
      console.error("Error signing out:", error)
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = '/'
    }
  }

  const handleBackToLanding = () => {
    router.push("/")
  }

  const navItems = [
    { href: "/home", label: "Home", icon: Home, requiresAuth: true },
    { href: "/profile", label: "Profile", icon: User, requiresAuth: true },
    { href: "/collections", label: "Collections", icon: Bookmark, requiresAuth: true },
    { href: "/reviews", label: "Reviews", icon: Star, requiresAuth: true },
    { href: "/followers", label: "Followers", icon: Users, requiresAuth: true },
  ]

  return (
    <motion.aside
      className={`flex h-screen ${isCollapsed ? 'w-20' : 'w-72'} flex-col border-r border-border/40 bg-sidebar/50 backdrop-blur-xl transition-all duration-300`}
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      {/* Profile Section */}
      <div className="border-b border-sidebar-border/40">
        <div className={`p-3 flex ${isCollapsed ? 'flex-col items-center gap-2' : 'items-center justify-between'}`}>
          <div className={`flex ${isCollapsed ? 'flex-col items-center' : 'items-center gap-3 flex-1 min-w-0'}`}>
            <Avatar className={`${isCollapsed ? 'h-10 w-10' : 'h-10 w-10'} ring-2 ring-primary/20 shrink-0`}>
              <AvatarImage src={avatarUrl || undefined} alt="User" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-chart-1 text-primary-foreground text-sm">
                {preferences?.userName ? preferences.userName.charAt(0).toUpperCase() : "U"}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h3 className="truncate font-semibold text-sidebar-foreground text-sm">{displayName || preferences?.userName || "Guest User"}</h3>
                <p className="truncate text-xs text-sidebar-foreground/60">
                  {username ? `@${username}` : preferences?.userRole ? `@${preferences.userRole}` : "@explorer"}
                </p>
              </div>
            )}
          </div>
          {!isAuthenticated && (
            <button
              onClick={handleBackToLanding}
              className="p-1.5 hover:bg-sidebar-accent rounded-lg transition-colors shrink-0"
              title="Back to landing page"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          {isAuthenticated && (
            <button
              onClick={toggleCollapse}
              className="p-1.5 hover:bg-sidebar-accent rounded-lg transition-colors shrink-0"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Guest Message */}
      {!isAuthenticated && !isCollapsed && (
        <div className="border-b border-sidebar-border/40 p-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-sidebar-accent/30 border border-primary/20">
            <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground mb-1">Sign in to use features</p>
              <p className="text-xs text-sidebar-foreground/60 mb-3">
                Create an account to save tools, write reviews, and access all features.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => router.push("/sign-in")}
                  className="h-7 text-xs"
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/sign-up")}
                  className="h-7 text-xs"
                >
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-0.5">
          {navItems.map((item, index) => {
            // Hide protected items for guests
            if (!isAuthenticated && item.requiresAuth) {
              return null
            }

            const isActive = pathname === item.href || (item.href === "/profile" && pathname?.startsWith("/profile"))
            const Icon = item.icon

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isCollapsed ? "justify-center px-2" : "",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* AI Tools Section - Show for both collapsed and expanded */}
        <div className={cn("mt-6", isCollapsed && "mt-4")}>
          {isCollapsed ? (
            <Link
              href="/tools"
              className="flex items-center justify-center rounded-lg px-2 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              title="AI Tools"
            >
              <Sparkles className="h-4 w-4 shrink-0" />
            </Link>
          ) : (
            <>
              <h4 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                Discover
              </h4>
              <Link
                href="/tools"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="truncate">AI Tools</span>
              </Link>
            </>
          )}
        </div>

        {/* Guest Sign In Button - Show collapsed version when collapsed */}
        {!isAuthenticated && isCollapsed && (
          <div className="mt-4">
            <button
              onClick={() => router.push("/sign-in")}
              className="flex items-center justify-center w-full rounded-lg px-2 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              title="Sign in to use features"
            >
              <Lock className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        {/* User Search Section - Only show for authenticated users */}
        {isAuthenticated && (
          <div className="mt-6">
            {isCollapsed ? (
              <div className="px-3">
                <UserSearch />
              </div>
            ) : (
              <div className="px-3">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                  Search
                </h4>
                <UserSearch />
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer Actions */}
      {isAuthenticated && (
        <div className="border-t border-sidebar-border/40 p-4 space-y-1">
          <Link
            href="/settings"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-all text-sm font-medium",
              isCollapsed ? "justify-center px-2" : ""
            )}
            title="Settings"
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="truncate">Settings</span>}
          </Link>

          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 transition-all text-sm font-medium",
              isCollapsed ? "justify-center px-2" : ""
            )}
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="truncate">Sign Out</span>}
          </button>
        </div>
      )}

      {/* Back Button for Guests */}
      {!isAuthenticated && (
        <div className="border-t border-sidebar-border/40 p-4">
          <Button
            onClick={handleBackToLanding}
            variant="outline"
            className={cn(
              "w-full flex items-center gap-3 justify-center",
              isCollapsed ? "px-2" : ""
            )}
            title={isCollapsed ? "Back to landing page" : undefined}
          >
            <ArrowLeft className="w-4 h-4" />
            {!isCollapsed && <span>Back to Landing</span>}
          </Button>
        </div>
      )}
    </motion.aside>
  )
}
