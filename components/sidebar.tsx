"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { User, Bookmark, Star, Users, Sparkles, LogOut, Settings, ChevronLeft, ChevronRight, Home, Search } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

  const navItems = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/profile", label: "Profile", icon: User },
    { href: "/collections", label: "Collections", icon: Bookmark },
    { href: "/reviews", label: "Reviews", icon: Star },
    { href: "/followers", label: "Followers", icon: Users },
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
          <button
            onClick={toggleCollapse}
            className="p-1.5 hover:bg-sidebar-accent rounded-lg transition-colors shrink-0"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-0.5">
          {navItems.map((item, index) => {
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

        {/* AI Tools Section */}
        {!isCollapsed && (
          <div className="mt-6">
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
          </div>
        )}

        {/* User Search Section */}
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
      </nav>

      {/* Footer Actions */}
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
    </motion.aside>
  )
}
