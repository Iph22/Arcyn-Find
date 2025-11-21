"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Menu, X, Star, ThumbsUp, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { getCurrentUser } from "@/lib/auth"

const reviews = [
  {
    id: 1,
    tool: "GPT-4 Turbo",
    rating: 5,
    title: "Incredible AI Assistant",
    content:
      "GPT-4 Turbo has completely transformed how I work. The reasoning capabilities are outstanding and it handles complex tasks with ease.",
    date: "2 days ago",
    likes: 24,
    comments: 5,
  },
  {
    id: 2,
    tool: "Midjourney",
    rating: 5,
    title: "Best Image Generation Tool",
    content:
      "The quality and consistency of Midjourney's outputs are unmatched. Perfect for professional projects and creative exploration.",
    date: "1 week ago",
    likes: 42,
    comments: 12,
  },
  {
    id: 3,
    tool: "GitHub Copilot",
    rating: 4,
    title: "Great Coding Assistant",
    content:
      "Copilot has sped up my development workflow significantly. It's not perfect but it's a valuable pair programming partner.",
    date: "2 weeks ago",
    likes: 18,
    comments: 7,
  },
]

export default function ReviewsPage() {
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
                
                <span className="text-lg font-bold">Reviews</span>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </motion.header>

        {/* Reviews Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-6 py-8">
            {/* Page Title */}
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h1 className="mb-2 text-4xl font-bold">My Reviews</h1>
              <p className="text-lg text-muted-foreground">Share your experiences with AI tools</p>
            </motion.div>

            {/* Reviews List */}
            <div className="space-y-6">
              {reviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-md">
                    <div className="p-6">
                      {/* Review Header */}
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 ring-2 ring-border/20">
                            <AvatarImage src="/placeholder.svg?key=u1" alt="User" />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-chart-1 text-primary-foreground">
                              JD
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">John Doe</h3>
                              <span className="text-sm text-muted-foreground">reviewed</span>
                              <Badge variant="secondary" className="text-xs">
                                {review.tool}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{review.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating ? "fill-primary text-primary" : "fill-muted text-muted"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Review Content */}
                      <div className="mb-4">
                        <h4 className="mb-2 text-lg font-semibold">{review.title}</h4>
                        <p className="text-muted-foreground leading-relaxed">{review.content}</p>
                      </div>

                      {/* Review Actions */}
                      <div className="flex items-center gap-4 border-t border-border/40 pt-4">
                        <Button variant="ghost" size="sm" className="gap-2">
                          <ThumbsUp className="h-4 w-4" />
                          {review.likes}
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-2">
                          <MessageSquare className="h-4 w-4" />
                          {review.comments}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
