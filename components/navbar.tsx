"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Search, Menu, X, User, LogOut, Settings, Bookmark, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { usePreferences } from "@/contexts/preferences-context"
import { useAvatar } from "@/contexts/avatar-context"
import { useUser, useClerk } from "@clerk/nextjs"
import { cn } from "@/lib/utils"

interface NavbarProps {
  className?: string
}

export function Navbar({ className }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, preferences } = usePreferences()
  const { avatarUrl, displayName } = useAvatar()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      // Clear all preferences first
      logout()
      localStorage.clear()
      sessionStorage.clear()
      
      // Sign out from Clerk with redirect
      await signOut({ redirectUrl: '/' })
    } catch (error) {
      console.error("Error signing out:", error)
      // Force clear and redirect on error
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = '/'
    }
  }

  const isAuthPage = pathname === "/" || pathname.startsWith("/auth")
  const isAuthenticated = preferences?.isAuthenticated

  if (isAuthPage) {
    return null
  }

  // Determine logo link based on authentication
  const logoLink = isAuthenticated ? "/home" : "/"

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl",
        className
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href={logoLink} className="flex items-center gap-2">
            <span className="text-xl font-bold">Arcyn Find</span>
          </Link>
          {/* Show navigation links for both authenticated and guest users */}
          <div className="hidden md:flex items-center gap-1">
            {isAuthenticated ? (
              <>
                <Link
                  href="/home"
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === "/home"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  Home
                </Link>
                <Link
                  href="/tools"
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === "/tools"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  Tools
                </Link>
                <Link
                  href="/collections"
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === "/collections"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  Collections
                </Link>
              </>
            ) : (
              <Link
                href="/tools"
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === "/tools"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                Tools
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback>
                      {preferences?.userName
                        ? preferences.userName.charAt(0).toUpperCase()
                        : "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">
                    {displayName || preferences?.userName || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.emailAddresses[0]?.emailAddress || preferences?.userEmail || ""}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/collections" className="cursor-pointer">
                    <Bookmark className="mr-2 h-4 w-4" />
                    Collections
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/reviews" className="cursor-pointer">
                    <Star className="mr-2 h-4 w-4" />
                    Reviews
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => router.push("/sign-in")}>
                Sign In
              </Button>
              <Button onClick={() => router.push("/sign-up")}>
                Get Started
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

