"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { User, Bookmark, Star, Users, Sparkles, LogOut, Settings } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { usePreferences } from "@/contexts/preferences-context"

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, preferences } = usePreferences()

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const navItems = [
    { href: "/profile", label: "Profile", icon: User },
    { href: "/collections", label: "Collections", icon: Bookmark },
    { href: "/reviews", label: "Reviews", icon: Star },
    { href: "/followers", label: "Followers", icon: Users },
  ]

  return (
    <motion.aside
      className="flex h-screen w-72 flex-col border-r border-border/40 bg-sidebar/50 backdrop-blur-xl"
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      {/* Profile Section */}
      <div className="border-b border-sidebar-border/40 p-6">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 ring-2 ring-primary/20">
            <AvatarImage src="/abstract-geometric-shapes.png" alt="User" />
            <AvatarFallback className="bg-gradient-to-br from-primary to-chart-1 text-primary-foreground">
              {preferences?.userName ? preferences.userName.charAt(0).toUpperCase() : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="truncate font-semibold text-sidebar-foreground">{preferences?.userName || "Guest User"}</h3>
            <p className="truncate text-sm text-sidebar-foreground/60">
              {preferences?.userRole ? `@${preferences.userRole}` : "@explorer"}
            </p>
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
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
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
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-all text-sm font-medium">
          <Settings className="w-5 h-5" />
          Settings
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-all text-sm font-medium"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </motion.aside>
  )
}
