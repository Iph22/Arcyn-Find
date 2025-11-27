"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, Calendar, Star, Bookmark, Users, Share2, UserPlus, UserCheck, ArrowLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"

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

interface Review {
  id: string
  rating: number
  title?: string
  review_text?: string
  created_at: string
  tool: {
    id: string
    name: string
    image?: string
  }
}

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { user: currentUser } = useUser()
  const userId = params?.id as string
  
  const [sidebarOpen, setSidebarOpen] = useState(false) // Hidden by default on mobile
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [savedTools, setSavedTools] = useState<SavedTool[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isFollowingLoading, setIsFollowingLoading] = useState(false)

  // Check if viewing own profile
  const isOwnProfile = currentUser?.id === userId

  // Redirect to own profile page if viewing own profile
  useEffect(() => {
    if (currentUser && userId && currentUser.id === userId) {
      router.push("/profile")
      return
    }
  }, [currentUser, userId, router])

  useEffect(() => {
    let isMounted = true
    
    const loadUserData = async () => {
      if (!userId) {
        if (isMounted) {
          router.push("/")
        }
        return
      }

      // Don't load if redirecting to own profile
      if (currentUser && currentUser.id === userId) {
        return
      }

      try {
        if (isMounted) {
          setIsLoading(true)
        }

        // Fetch user profile
        const profileRes = await fetch(`/api/users/${userId}`)
        if (!isMounted) return
        
        if (!profileRes.ok) {
          if (profileRes.status === 404) {
            if (isMounted) {
              toast.error("User not found")
              router.push("/")
            }
            return
          }
          throw new Error("Failed to fetch user profile")
        }

        try {
          const profileData = await profileRes.json()
          if (isMounted) {
            setUserProfile(profileData.user)
          }
        } catch (err) {
          console.error("Error parsing profile JSON:", err)
        }

        // Fetch user stats
        const statsRes = await fetch(`/api/users/${userId}/stats`)
        if (statsRes.ok && isMounted) {
          try {
            const statsData = await statsRes.json()
            if (isMounted) {
              setUserStats(statsData.stats)
            }
          } catch (err) {
            console.error("Error parsing stats JSON:", err)
          }
        }

        // Fetch saved tools (public)
        const toolsRes = await fetch(`/api/users/${userId}/saved-tools`)
        if (toolsRes.ok && isMounted) {
          try {
            const toolsData = await toolsRes.json()
            if (isMounted) {
              setSavedTools(toolsData.savedTools || [])
            }
          } catch (err) {
            console.error("Error parsing tools JSON:", err)
          }
        }

        // Fetch reviews
        const reviewsRes = await fetch(`/api/users/${userId}/reviews`)
        if (reviewsRes.ok && isMounted) {
          try {
            const reviewsData = await reviewsRes.json()
            if (isMounted) {
              setReviews(reviewsData.reviews || [])
            }
          } catch (err) {
            console.error("Error parsing reviews JSON:", err)
          }
        }

        // Check follow status if not own profile
        if (!isOwnProfile && currentUser && isMounted) {
          const followRes = await fetch(`/api/users/${userId}/follow-status`)
          if (followRes.ok) {
            try {
              const followData = await followRes.json()
              if (isMounted) {
                setIsFollowing(followData.isFollowing || false)
              }
            } catch (err) {
              console.error("Error parsing follow status JSON:", err)
            }
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error)
        if (isMounted) {
          toast.error("Failed to load user profile")
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
  }, [userId, currentUser, isOwnProfile, router])

  const handleFollow = async () => {
    if (!currentUser) {
      toast.error("Please sign in to follow users")
      return
    }

    setIsFollowingLoading(true)
    try {
      const response = await fetch(`/api/users/${userId}/follow`, {
        method: isFollowing ? "DELETE" : "POST",
      })

      if (response.ok) {
        setIsFollowing(!isFollowing)
        toast.success(isFollowing ? "Unfollowed" : "Following")
        // Refresh stats
        const statsRes = await fetch(`/api/users/${userId}/stats`)
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setUserStats(statsData.stats)
        }
      } else {
        toast.error("Failed to update follow status")
      }
    } catch (error) {
      console.error("Error following user:", error)
      toast.error("An error occurred")
    } finally {
      setIsFollowingLoading(false)
    }
  }

  const handleShareProfile = async () => {
    const profileUrl = `${window.location.origin}/profile/${userId}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${userProfile?.display_name || userProfile?.username || "User"}'s Profile`,
          text: `Check out ${userProfile?.display_name || userProfile?.username || "this user"}'s profile on Arcyn Find`,
          url: profileUrl,
        })
      } else {
        await navigator.clipboard.writeText(profileUrl)
        toast.success("Profile link copied to clipboard!")
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(profileUrl)
          toast.success("Profile link copied to clipboard!")
        } catch (e) {
          toast.error("Failed to copy link")
        }
      }
    }
  }

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

  if (!userProfile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-destructive">User not found</p>
          <Button onClick={() => router.push("/")}>Go Home</Button>
        </div>
      </div>
    )
  }

  const displayName = userProfile.display_name || userProfile.username || "User"
  const username = userProfile.username || "user"
  const avatarUrl = userProfile.avatar_url || null
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  const joinDate = userProfile.created_at
    ? new Date(userProfile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Recently"

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
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
              <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">Profile</span>
              </div>
            </div>
            <ThemeToggle />
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
                {userProfile.banner_url ? (
                  <div className="h-32 sm:h-48 relative">
                    <Image
                      src={userProfile.banner_url}
                      alt="Profile banner"
                      fill
                      className="object-cover"
                      sizes="100vw"
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
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!isOwnProfile && currentUser && (
                        <Button
                          variant={isFollowing ? "outline" : "default"}
                          size="sm"
                          className="gap-2"
                          onClick={handleFollow}
                          disabled={isFollowingLoading}
                        >
                          {isFollowing ? (
                            <>
                              <UserCheck className="h-4 w-4" />
                              Following
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4" />
                              Follow
                            </>
                          )}
                        </Button>
                      )}
                      {isOwnProfile && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 bg-transparent"
                          onClick={() => router.push("/settings")}
                        >
                          Edit Profile
                        </Button>
                      )}
                      <Button size="sm" className="gap-2" onClick={handleShareProfile}>
                        <Share2 className="h-4 w-4" />
                        Share
                      </Button>
                    </div>
                  </div>

                  {/* Bio */}
                  {userProfile.bio && (
                    <p className="mb-4 text-muted-foreground leading-relaxed">{userProfile.bio}</p>
                  )}

                  {/* Meta Info */}
                  <div className="mb-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
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
                          <Card
                            className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-md cursor-pointer"
                            onClick={() => router.push(`/tools/${savedTool.tool.id}`)}
                          >
                            <div className="flex gap-4 p-4">
                              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                                {savedTool.tool?.image ? (
                                  <Image
                                    src={savedTool.tool.image}
                                    alt={savedTool.tool.name}
                                    fill
                                    className="object-cover transition-transform group-hover:scale-105"
                                    sizes="64px"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-chart-1/20">
                                    <Sparkles className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="mb-1 truncate font-semibold">{savedTool.tool?.name || "Unknown Tool"}</h3>
                                {savedTool.tool?.category && (
                                  <Badge variant="secondary" className="text-xs">
                                    {savedTool.tool.category}
                                  </Badge>
                                )}
                              </div>
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
                      <p className="text-muted-foreground">This user hasn't saved any tools yet</p>
                    </Card>
                  )}
                </TabsContent>

                {/* Reviews Tab */}
                <TabsContent value="reviews">
                  {reviews.length > 0 ? (
                    <div className="space-y-4">
                      {reviews.map((review, index) => (
                        <motion.div
                          key={review.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <Card
                            className="border-border/50 bg-card/50 p-4 backdrop-blur-sm cursor-pointer hover:border-border transition-colors"
                            onClick={() => router.push(`/tools/${review.tool.id}`)}
                          >
                            <div className="flex gap-4">
                              {review.tool?.image && (
                                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                                  <Image
                                    src={review.tool.image}
                                    alt={review.tool.name}
                                    fill
                                    className="object-cover"
                                    sizes="64px"
                                  />
                                </div>
                              )}
                              <div className="flex-1">
                                <div className="mb-2 flex items-center gap-2">
                                  <h3 className="font-semibold">{review.tool?.name}</h3>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`h-4 w-4 ${
                                          i < review.rating
                                            ? "fill-primary text-primary"
                                            : "text-muted-foreground"
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                                {review.title && <p className="mb-1 font-medium">{review.title}</p>}
                                {review.review_text && (
                                  <p className="text-sm text-muted-foreground">{review.review_text}</p>
                                )}
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {formatRelativeTime(review.created_at)}
                                </p>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <Card className="border-border/50 bg-card/50 p-8 text-center backdrop-blur-sm">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                        <Star className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold">No reviews yet</h3>
                      <p className="text-muted-foreground">This user hasn't written any reviews yet</p>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}

