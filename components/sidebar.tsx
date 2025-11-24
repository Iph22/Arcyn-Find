"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { User, Bookmark, Star, Users, Sparkles, LogOut, Settings, ChevronLeft, ChevronRight, Home } from "lucide-react"
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
        {/* Collapse Button */}
        <div className="p-4 flex justify-end">
          <button
            onClick={toggleCollapse}
            className="p-2 hover:bg-sidebar-accent rounded-lg transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>
        
        <div className={`px-4 pb-6 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className={`flex ${isCollapsed ? 'flex-col items-center gap-2' : 'items-center gap-3'}`}>
            <Avatar className={`${isCollapsed ? 'h-10 w-10' : 'h-12 w-12'} ring-2 ring-primary/20`}>
              <AvatarImage src={avatarUrl || undefined} alt="User" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-chart-1 text-primary-foreground">
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
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {navItems.map((item, index) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                    isCollapsed ? "justify-center" : "",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5" />
                  {!isCollapsed && item.label}
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* AI Tools Section */}
        <div className="mt-8">
          <h4 className="mb-3 px-4 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">
            Discover
          </h4>
          <Link
            href="/tools"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          >
            <Sparkles className="h-5 w-5" />
            AI Tools
          </Link>
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="border-t border-sidebar-border/40 p-4 space-y-2">
        {!isCollapsed && (
          <div className="mb-2">
            <UserSearch />
          </div>
        )}
        
        <Link
          href="/settings"
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-all text-sm font-medium",
            isCollapsed ? "justify-center" : ""
          )}
          title="Settings"
        >
          <Settings className="w-5 h-5" />
          {!isCollapsed && "Settings"}
        </Link>

        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-all text-sm font-medium",
            isCollapsed ? "justify-center" : ""
          )}
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && "Sign Out"}
        </button>
      </div>
    </motion.aside>
  )
}
