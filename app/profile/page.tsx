"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Menu, X, Settings, MapPin, LinkIcon, Calendar, Star, Bookmark, Users, LogOut, Trash2, Share2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { usePreferences } from "@/contexts/preferences-context"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useUser, useClerk } from "@clerk/nextjs"

interface UserProfile {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string
  banner_url?: string
  bio?: string
  created_at: string
  updated_at: string
}

interface UserStats {
  followers: number
  following: number
  reviews: number
  savedTools: number
  collections: number
}

interface SavedTool {
  id: string
  created_at: string
  tool: {
    id: string
    name: string
    description?: string
    image?: string
    category?: string
    access_type?: string
    tags?: string[]
  }
}

interface Activity {
  id: string
  action: string
  target: string
  time: string
  type: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { preferences, clearPreferences } = usePreferences()
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const [sidebarOpen, setSidebarOpen] = useState(false) // Hidden by default on mobile
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [savedTools, setSavedTools] = useState<SavedTool[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleShareProfile = async () => {
    const profileUrl = `${window.location.origin}/profile/${user?.id || userProfile?.id}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${displayName}'s Profile`,
          text: `Check out ${displayName}'s profile on Arcyn Find`,
          url: profileUrl
        })
      } else {
        await navigator.clipboard.writeText(profileUrl)
        toast.success("Profile link copied to clipboard!")
      }
    } catch (error) {
      console.error("Error sharing:", error)
      // Fallback: just copy to clipboard
      try {
        await navigator.clipboard.writeText(profileUrl)
        toast.success("Profile link copied to clipboard!")
      } catch (e) {
        toast.error("Failed to copy link")
      }
    }
  }

  useEffect(() => {
    // Check authentication and load user data
    let isMounted = true
    
    const loadUserData = async () => {
      try {
        if (!isLoaded) return
        
        if (!user) {
          // Not authenticated, redirect to landing
          if (isMounted) {
            router.push("/")
          }
          return
        }

        // Load user profile via API
        const [profileRes, statsRes, toolsRes, activityRes] = await Promise.all([
          fetch('/api/user/profile'),
          fetch('/api/user/stats'),
          fetch('/api/user/saved-tools'),
          fetch('/api/user/activity')
        ])
        
        if (!isMounted) return
        
        if (profileRes.ok) {
          try {
            const data = await profileRes.json()
            if (isMounted) {
              setUserProfile(data.profile)
            }
          } catch (err) {
            console.error("Error parsing profile JSON:", err)
          }
        }
        
        if (statsRes.ok) {
          try {
            const data = await statsRes.json()
            if (isMounted) {
              setUserStats(data.stats)
            }
          } catch (err) {
            console.error("Error parsing stats JSON:", err)
          }
        }
        
        if (toolsRes.ok) {
          try {
            const data = await toolsRes.json()
            if (isMounted) {
              setSavedTools(data.savedTools)
            }
          } catch (err) {
            console.error("Error parsing tools JSON:", err)
          }
        }
        
        if (activityRes.ok) {
          try {
            const data = await activityRes.json()
            if (isMounted) {
              setActivities(data.activities)
            }
          } catch (err) {
            console.error("Error parsing activity JSON:", err)
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error("Error loading user data:", error)
        }
        if (isMounted) {
          router.push("/")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadUserData()
    
    return () => {
      isMounted = false
    }
  }, [user, isLoaded, router])

  const handleSignOut = async () => {
    try {
      // Clear all local storage first
      clearPreferences()
      localStorage.clear()
      sessionStorage.clear()
      
      // Sign out from Clerk with redirect
      await signOut({ redirectUrl: '/' })
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Error signing out:", error)
      }
      // Force redirect on error
      window.location.href = '/'
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch('/api/user/delete-account', {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success("Account deleted successfully")
        
        clearPreferences()
        // Clear all localStorage items
        localStorage.removeItem("arcyn-authenticated")
        localStorage.removeItem("arcyn-onboarding-complete")
        localStorage.removeItem("arcyn-instructions-seen")
        localStorage.removeItem("arcyn-preferences")
        localStorage.removeItem("arcyn_onboarding")
        
        // Sign out and redirect
        await signOut()
        router.push("/?deleted=true")
      } else {
        toast.error(data.error || "Failed to delete account")
        setIsDeleting(false)
        setShowDeleteDialog(false)
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Error deleting account:", error)
      }
      toast.error("An error occurred while deleting your account")
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  // Get display name and avatar
  const displayName = userProfile?.display_name || user?.fullName || preferences?.userName || "User"
  const username = userProfile?.username || user?.username || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || "user"
  const avatarUrl = userProfile?.avatar_url || user?.imageUrl || null
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  // Get join date
  const joinDate = user?.createdAt 
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
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

  // Helper to format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Hidden on mobile */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <>
            {/* Mobile overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30"
            />
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-40 h-full w-72"
            >
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden pb-20 md:pb-0">
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
                {/* Cover Image / Banner */}
                {userProfile?.banner_url ? (
                  <div className="h-32 sm:h-48 relative">
                    <img 
                      src={userProfile.banner_url} 
                      alt="Profile banner" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-32 sm:h-48 bg-gradient-to-br from-primary/20 via-chart-1/20 to-chart-3/20" />
                )}

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
                        {user?.emailAddresses[0]?.emailAddress && (
                          <p className="text-sm text-muted-foreground">{user.emailAddresses[0].emailAddress}</p>
                        )}
              </div>
              </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2 bg-transparent"
                        onClick={() => router.push("/settings")}
                      >
                        <Settings className="h-4 w-4" />
                        Edit Profile
                      </Button>
                      <Button size="sm" className="gap-2" onClick={handleShareProfile}>
                        <Share2 className="h-4 w-4" />
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
                      <span className="font-bold">{userStats?.savedTools || 0}</span>
                      <span className="ml-1 text-sm text-muted-foreground">Saved Tools</span>
                    </div>
                    <div>
                      <span className="font-bold">{userStats?.reviews || 0}</span>
                      <span className="ml-1 text-sm text-muted-foreground">Reviews</span>
                    </div>
                    <div>
                      <span className="font-bold">{userStats?.followers || 0}</span>
                      <span className="ml-1 text-sm text-muted-foreground">Followers</span>
                    </div>
                    <div>
                      <span className="font-bold">{userStats?.following || 0}</span>
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

                  {/* Danger Zone */}
                  <div className="mt-8 rounded-xl border border-destructive/20 bg-destructive/5 p-6">
                    <h3 className="mb-2 text-sm font-semibold text-destructive">Danger Zone</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Account
                    </Button>
                  </div>
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
                  {savedTools.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {savedTools.map((savedTool, index) => (
                        <motion.div
                          key={savedTool.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <Card className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-md">
                            <div className="flex gap-4 p-4">
                              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                                {savedTool.tool?.image ? (
                                  <img
                                    src={savedTool.tool.image}
                                    alt={savedTool.tool.name}
                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-chart-1/20">
                                    <Sparkles className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="mb-1 truncate font-semibold">{savedTool.tool?.name || 'Unknown Tool'}</h3>
                                {savedTool.tool?.category && (
                                  <Badge variant="secondary" className="text-xs">
                                    {savedTool.tool.category}
                                  </Badge>
                                )}
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <Bookmark className="h-4 w-4 fill-current" />
                              </Button>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <Card className="border-border/50 bg-card/50 p-8 text-center backdrop-blur-sm">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                        <Bookmark className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold">No saved tools yet</h3>
                      <p className="text-muted-foreground">Start exploring and save tools you find interesting</p>
                    </Card>
                  )}
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
                  {activities.length > 0 ? (
                    <div className="space-y-4">
                      {activities.map((activity, index) => (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <Card className="border-border/50 bg-card/50 p-4 backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">
                                  {activity.action} {activity.target && <span className="text-primary">{activity.target}</span>}
                                </p>
                                <p className="text-sm text-muted-foreground">{formatRelativeTime(activity.time)}</p>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <Card className="border-border/50 bg-card/50 p-8 text-center backdrop-blur-sm">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold">No activity yet</h3>
                      <p className="text-muted-foreground">Your activity will appear here as you interact with tools</p>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
          </motion.div>
          </div>
        </main>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you absolutely sure? This action cannot be undone. This will permanently delete your account
              and remove all of your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">This includes:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Your profile and preferences</li>
              <li>All your reviews and ratings</li>
              <li>Your collections and saved tools</li>
              <li>Your favorites and activity history</li>
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Deleting...
                </>
              ) : (
                "Yes, delete my account"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
