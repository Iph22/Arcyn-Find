"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Menu, X, Settings, MapPin, LinkIcon, Calendar, Star, Bookmark, Users, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { usePreferences } from "@/contexts/preferences-context"
import { getCurrentUser, getUserProfile, signOut } from "@/lib/auth"
import type { UserProfile } from "@/lib/auth"

export default function ProfilePage() {
  const router = useRouter()
  const { preferences, clearPreferences } = usePreferences()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check authentication and load user data
    const loadUserData = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
          // Not authenticated, redirect to landing
          router.push("/")
        return
      }

      setUser(currentUser)

        // Load user profile
        const profile = await getUserProfile(currentUser.id)
        setUserProfile(profile)
      } catch (error) {
        console.error("Error loading user data:", error)
        router.push("/")
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [router])

  const handleSignOut = async () => {
    try {
      await signOut()
      clearPreferences()
      // Clear all localStorage items
      localStorage.removeItem("arcyn-authenticated")
      localStorage.removeItem("arcyn-onboarding-complete")
      localStorage.removeItem("arcyn-instructions-seen")
      localStorage.removeItem("arcyn-preferences")
      localStorage.removeItem("arcyn_onboarding")
      router.push("/")
      window.location.reload()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  // Get display name and avatar
  const displayName = userProfile?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || preferences?.userName || "User"
  const username = userProfile?.username || user?.user_metadata?.preferred_username || user?.email?.split("@")[0] || "user"
  const avatarUrl = userProfile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  // Get join date
  const joinDate = user?.created_at 
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Recently"

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  const savedTools = [
    { name: "GPT-4 Turbo", category: "AI Writing", image: "/placeholder.svg?key=ai1" },
    { name: "Midjourney", category: "Image Generation", image: "/placeholder.svg?key=ai2" },
    { name: "GitHub Copilot", category: "Code Assistants", image: "/placeholder.svg?key=ai3" },
    { name: "Claude AI", category: "AI Writing", image: "/placeholder.svg?key=ai4" },
  ]

  const recentActivity = [
    { action: "Saved", tool: "GPT-4 Turbo", time: "2 hours ago" },
    { action: "Reviewed", tool: "Midjourney", time: "5 hours ago" },
    { action: "Followed", user: "Sarah Chen", time: "1 day ago" },
    { action: "Saved", tool: "Claude AI", time: "2 days ago" },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative z-20"
          >
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <motion.header
          className="border-b border-border/40 bg-card/50 backdrop-blur-xl"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-10 w-10">
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">Profile</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
                    <LogOut className="h-4 w-4" />
                    Sign Out
              </Button>
            </div>
          </div>
        </motion.header>

        {/* Profile Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-6 py-8">
            {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
                {/* Cover Image */}
                <div className="h-32 bg-gradient-to-br from-primary/20 via-chart-1/20 to-chart-3/20" />

                <div className="px-8 pb-8">
                  {/* Avatar & Basic Info */}
                  <div className="relative -mt-16 mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex items-end gap-4">
                      <Avatar className="h-32 w-32 border-4 border-card ring-2 ring-border/20">
                        <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-chart-1 text-3xl font-bold text-primary-foreground">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="mb-2">
                        <h1 className="text-2xl font-bold">{displayName}</h1>
                        <p className="text-muted-foreground">@{username}</p>
                        {user?.email && (
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        )}
              </div>
              </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                        <Settings className="h-4 w-4" />
                        Edit Profile
                      </Button>
                      <Button size="sm" className="gap-2">
                        Share
                      </Button>
              </div>
            </div>

                  {/* Bio */}
                  {userProfile?.bio && (
                    <p className="mb-4 text-muted-foreground leading-relaxed">{userProfile.bio}</p>
                  )}
                  {!userProfile?.bio && (
                    <p className="mb-4 text-muted-foreground leading-relaxed">
                      {preferences?.purpose === "building"
                        ? "AI enthusiast and builder. Always exploring the latest tools to create something amazing."
                        : preferences?.purpose === "research"
                          ? "AI researcher passionate about discovering cutting-edge tools and technologies."
                          : preferences?.purpose === "work"
                            ? "Professional using AI tools to boost productivity and streamline workflows."
                            : "AI enthusiast and tech explorer. Always on the lookout for the next breakthrough tool."}
                    </p>
                  )}

                  {/* Meta Info */}
                  <div className="mb-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {userProfile?.bio && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {userProfile.bio}
            </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Joined {joinDate}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-6">
                    <div>
                      <span className="font-bold">128</span>
                      <span className="ml-1 text-sm text-muted-foreground">Saved Tools</span>
                    </div>
                    <div>
                      <span className="font-bold">45</span>
                      <span className="ml-1 text-sm text-muted-foreground">Reviews</span>
                    </div>
                    <div>
                      <span className="font-bold">842</span>
                      <span className="ml-1 text-sm text-muted-foreground">Followers</span>
                    </div>
                    <div>
                      <span className="font-bold">1.2K</span>
                      <span className="ml-1 text-sm text-muted-foreground">Following</span>
                    </div>
                  </div>

                  {/* User Preferences Section */}
                  {preferences?.categories && preferences.categories.length > 0 && (
                    <div className="mt-6 rounded-xl border border-border/50 bg-card/30 p-4">
                      <h3 className="mb-3 text-sm font-semibold">Interests</h3>
                      <div className="flex flex-wrap gap-2">
                        {preferences.categories.map((category) => (
                          <Badge key={category} variant="secondary">
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </Badge>
                        ))}
                      </div>
                      {preferences.level && (
                        <div className="mt-3">
                          <span className="text-sm text-muted-foreground">Experience: </span>
                          <Badge variant="outline">
                            {preferences.level.charAt(0).toUpperCase() + preferences.level.slice(1)}
                          </Badge>
                        </div>
                      )}
                      {preferences.userRole && (
                        <div className="mt-3">
                          <span className="text-sm text-muted-foreground">Role: </span>
                          <Badge variant="outline">
                            {preferences.userRole.charAt(0).toUpperCase() + preferences.userRole.slice(1)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Profile Tabs */}
            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Tabs defaultValue="saved" className="w-full">
                <TabsList className="mb-6 w-full justify-start rounded-xl bg-card/50 p-1">
                  <TabsTrigger value="saved" className="gap-2 rounded-lg">
                    <Bookmark className="h-4 w-4" />
                    Saved Tools
                  </TabsTrigger>
                  <TabsTrigger value="reviews" className="gap-2 rounded-lg">
                    <Star className="h-4 w-4" />
                    Reviews
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="gap-2 rounded-lg">
                    <Users className="h-4 w-4" />
                    Activity
                  </TabsTrigger>
                </TabsList>

                {/* Saved Tools Tab */}
                <TabsContent value="saved">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {savedTools.map((tool, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <Card className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-md">
                          <div className="flex gap-4 p-4">
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                              <img
                                src={tool.image || "/placeholder.svg"}
                                alt={tool.name}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="mb-1 truncate font-semibold">{tool.name}</h3>
                              <Badge variant="secondary" className="text-xs">
                                {tool.category}
                              </Badge>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <Bookmark className="h-4 w-4 fill-current" />
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>

                {/* Reviews Tab */}
                <TabsContent value="reviews">
                  <Card className="border-border/50 bg-card/50 p-8 text-center backdrop-blur-sm">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                      <Star className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold">No reviews yet</h3>
                    <p className="text-muted-foreground">Start reviewing AI tools to help the community</p>
                  </Card>
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity">
                  <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <Card className="border-border/50 bg-card/50 p-4 backdrop-blur-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {activity.action} <span className="text-primary">{activity.tool || activity.user}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">{activity.time}</p>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
              ))}
            </div>
                </TabsContent>
              </Tabs>
          </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}
