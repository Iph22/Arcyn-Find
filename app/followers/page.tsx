"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Menu, X, UserPlus, Users, UserMinus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sidebar } from "@/components/layout/sidebar"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { LanguagePicker } from "@/components/layout/language-picker"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"

interface UserData {
  id: string
  user: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
    bio: string
  }
  isFollowing: boolean
  created_at: string
}

export default function FollowersPage() {
  const router = useRouter()
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false) // Hidden by default on mobile
  const [activeTab, setActiveTab] = useState<"followers" | "following">("followers")
  const [followers, setFollowers] = useState<UserData[]>([])
  const [following, setFollowing] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/")
      return
    }
    if (user) {
      loadFollowers()
    }
  }, [user, isAuthLoading, isAuthenticated, router])

  const loadFollowers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/user/followers')
      if (response.ok) {
        const data = await response.json()
        setFollowers(data.followers || [])
        setFollowing(data.following || [])
      }
    } catch (error) {
      console.error('Error loading followers:', error)
      toast.error('Failed to load followers')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFollowToggle = async (targetUserId: string, currentlyFollowing: boolean) => {
    try {
      setActionLoading(targetUserId)
      const response = await fetch('/api/user/followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          action: currentlyFollowing ? 'unfollow' : 'follow'
        })
      })

      if (response.ok) {
        toast.success(currentlyFollowing ? 'Unfollowed successfully' : 'Followed successfully')
        await loadFollowers()
      } else {
        throw new Error('Failed to update follow status')
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
      toast.error('Failed to update follow status')
    } finally {
      setActionLoading(null)
    }
  }

  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const UserCard = ({ userData }: { userData: UserData }) => (
    <Card className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-md">
      <div className="flex items-center gap-4 p-4">
        <Avatar className="h-16 w-16 ring-2 ring-primary/20">
          <AvatarImage src={userData.user.avatar_url || undefined} alt={userData.user.display_name} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-chart-1 text-lg font-bold text-primary-foreground">
            {userData.user.display_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="truncate font-semibold">{userData.user.display_name}</h3>
          <p className="truncate text-sm text-muted-foreground">@{userData.user.username}</p>
          {userData.user.bio && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{userData.user.bio}</p>}
        </div>
        <Button
          variant={userData.isFollowing ? "outline" : "default"}
          size="sm"
          className="shrink-0 gap-2"
          onClick={() => handleFollowToggle(userData.user.id, userData.isFollowing)}
          disabled={actionLoading === userData.user.id}
        >
          {actionLoading === userData.user.id ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : userData.isFollowing ? (
            <>
              <UserMinus className="h-4 w-4" />
              Following
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Follow
            </>
          )}
        </Button>
      </div>
    </Card>
  )

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

                <span className="text-lg font-bold">Community</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguagePicker />
              <ThemeToggle />
            </div>
          </div>
        </motion.header>

        {/* Followers Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-6 py-8">
            {/* Page Title */}
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h1 className="mb-2 text-4xl font-bold">Community</h1>
              <p className="text-lg text-muted-foreground">Connect with other AI enthusiasts</p>
            </motion.div>

            {/* Search Bar */}
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="border-border/50 bg-card/50 p-2 backdrop-blur-sm">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by name or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 border-0 bg-transparent pl-12 text-base focus-visible:ring-0"
                  />
                </div>
              </Card>
            </motion.div>

            {/* Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Tabs defaultValue="followers" className="w-full">
                <TabsList className="mb-6 w-full justify-start rounded-xl bg-card/50 p-1">
                  <TabsTrigger value="followers" className="gap-2 rounded-lg">
                    <Users className="h-4 w-4" />
                    Followers ({followers.filter(f => {
                      const u = f.user;
                      return !searchQuery || u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
                    }).length})
                  </TabsTrigger>
                  <TabsTrigger value="following" className="gap-2 rounded-lg">
                    <UserPlus className="h-4 w-4" />
                    Following ({following.filter(f => {
                      const u = f.user;
                      return !searchQuery || u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
                    }).length})
                  </TabsTrigger>
                </TabsList>

                {/* Followers Tab */}
                <TabsContent value="followers">
                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                  ) : followers.filter(f => {
                    const u = f.user;
                    return !searchQuery || u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
                  }).length === 0 ? (
                    <Card className="border-border/50 bg-card/50 p-12 text-center backdrop-blur-sm">
                      <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                      <h3 className="mb-2 text-lg font-semibold">{searchQuery ? 'No followers found' : 'No followers yet'}</h3>
                      <p className="text-muted-foreground">{searchQuery ? 'Try a different search term' : 'Share your profile to gain followers'}</p>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {followers.filter(f => {
                        const u = f.user;
                        return !searchQuery || u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
                      }).map((userItem, index) => (
                        <motion.div
                          key={userItem.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <UserCard userData={userItem} />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Following Tab */}
                <TabsContent value="following">
                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                  ) : following.filter(f => {
                    const u = f.user;
                    return !searchQuery || u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
                  }).length === 0 ? (
                    <Card className="border-border/50 bg-card/50 p-12 text-center backdrop-blur-sm">
                      <UserPlus className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                      <h3 className="mb-2 text-lg font-semibold">{searchQuery ? 'No users found' : 'Not following anyone yet'}</h3>
                      <p className="text-muted-foreground">{searchQuery ? 'Try a different search term' : 'Start following users to see them here'}</p>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {following.filter(f => {
                        const u = f.user;
                        return !searchQuery || u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
                      }).map((userItem, index) => (
                        <motion.div
                          key={userItem.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <UserCard userData={userItem} />
                        </motion.div>
                      ))}
                    </div>
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
