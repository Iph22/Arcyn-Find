"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Menu, X, UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { getCurrentUser } from "@/lib/auth"

const followers = [
  {
    id: 1,
    name: "Sarah Chen",
    username: "@sarahchen",
    bio: "AI researcher and tech enthusiast",
    avatar: "/placeholder.svg?key=f1",
    following: false,
  },
  {
    id: 2,
    name: "Michael Ross",
    username: "@mross",
    bio: "Building the future with AI",
    avatar: "/placeholder.svg?key=f2",
    following: true,
  },
  {
    id: 3,
    name: "Emily Watson",
    username: "@emilyw",
    bio: "Product designer | AI tools explorer",
    avatar: "/placeholder.svg?key=f3",
    following: false,
  },
  {
    id: 4,
    name: "David Kim",
    username: "@davidkim",
    bio: "Developer advocate for AI",
    avatar: "/placeholder.svg?key=f4",
    following: true,
  },
]

const following = [
  {
    id: 5,
    name: "Alex Turner",
    username: "@alexturner",
    bio: "AI artist and creative technologist",
    avatar: "/placeholder.svg?key=f5",
    following: true,
  },
  {
    id: 6,
    name: "Lisa Martinez",
    username: "@lisamartinez",
    bio: "Machine learning engineer",
    avatar: "/placeholder.svg?key=f6",
    following: true,
  },
  {
    id: 7,
    name: "James Wilson",
    username: "@jameswilson",
    bio: "Building AI tools for creators",
    avatar: "/placeholder.svg?key=f7",
    following: true,
  },
]

export default function FollowersPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (!user) {
          router.push("/")
          return
        }
      } catch (error) {
        console.error("Auth check error:", error)
        router.push("/")
      } finally {
        setIsAuthLoading(false)
      }
    }

    checkAuth()
  }, [router])

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

  const UserCard = ({ user }: { user: (typeof followers)[0] }) => (
    <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-md">
      <div className="flex items-center gap-4 p-4">
        <Avatar className="h-14 w-14 ring-2 ring-border/20">
          <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-chart-1 text-primary-foreground">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="truncate font-semibold">{user.name}</h3>
          <p className="truncate text-sm text-muted-foreground">{user.username}</p>
          <p className="truncate text-sm text-muted-foreground">{user.bio}</p>
        </div>
        <Button variant={user.following ? "outline" : "default"} size="sm" className="shrink-0">
          {user.following ? "Following" : "Follow"}
        </Button>
      </div>
    </Card>
  )

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
                
                <span className="text-lg font-bold">Community</span>
              </div>
            </div>
            <ThemeToggle />
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

            {/* Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Tabs defaultValue="followers" className="w-full">
                <TabsList className="mb-6 w-full justify-start rounded-xl bg-card/50 p-1">
                  <TabsTrigger value="followers" className="gap-2 rounded-lg">
                    <Users className="h-4 w-4" />
                    Followers ({followers.length})
                  </TabsTrigger>
                  <TabsTrigger value="following" className="gap-2 rounded-lg">
                    <UserPlus className="h-4 w-4" />
                    Following ({following.length})
                  </TabsTrigger>
                </TabsList>

                {/* Followers Tab */}
                <TabsContent value="followers">
                  <div className="space-y-4">
                    {followers.map((user, index) => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <UserCard user={user} />
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>

                {/* Following Tab */}
                <TabsContent value="following">
                  <div className="space-y-4">
                    {following.map((user, index) => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <UserCard user={user} />
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
