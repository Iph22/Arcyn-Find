"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Activity, Heart, MessageSquare, BookOpen, Star, Users, Loader2 } from "lucide-react"
import { getActivityFeed, type UserActivity } from "@/lib/community"
import { getCurrentUser } from "@/lib/auth"
import { AuthModal } from "@/components/auth-modal"
import Link from "next/link"

const activityIcons = {
  review_created: MessageSquare,
  collection_created: BookOpen,
  tool_favorited: Heart,
  tool_added_to_collection: BookOpen,
  review_helpful_voted: Star,
}

const activityLabels = {
  review_created: "reviewed",
  collection_created: "created collection",
  tool_favorited: "favorited",
  tool_added_to_collection: "added to collection",
  review_helpful_voted: "voted helpful on review for",
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<UserActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadActivities()
    } else {
      setLoading(false)
    }
  }, [user])

  async function loadUser() {
    const currentUser = await getCurrentUser()
    setUser(currentUser)
    if (!currentUser) {
      setShowAuth(true)
    }
  }

  async function loadActivities() {
    try {
      setLoading(true)
      const data = await getActivityFeed(50)
      setActivities(data)
    } catch (error) {
      console.error("Error loading activities:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">Sign In Required</h1>
            <p className="text-muted-foreground mb-6">
              Please sign in to view your activity feed
            </p>
            <button
              onClick={() => setShowAuth(true)}
              className="rounded-lg bg-accent px-4 py-2 text-accent-foreground hover:bg-accent/90"
            >
              Sign In
            </button>
          </div>
        </div>
        <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-6 w-6 text-accent" />
            <h1 className="text-3xl font-bold">Activity Feed</h1>
          </div>
          <p className="text-muted-foreground">
            See what's happening with tools and users you follow
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">No Activity Yet</h2>
            <p className="text-muted-foreground mb-6">
              Start following users or interact with tools to see activity here
            </p>
            <Link
              href="/leaderboard"
              className="inline-block rounded-lg bg-accent px-4 py-2 text-accent-foreground hover:bg-accent/90"
            >
              Discover Users
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, idx) => {
              const Icon = activityIcons[activity.activity_type] || Activity
              const label = activityLabels[activity.activity_type] || "did something with"

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="rounded-xl border border-border bg-card p-4 sm:p-6 hover:border-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-accent/10 p-2 flex-shrink-0">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {activity.user && (
                          <span className="font-semibold">
                            {activity.user.display_name || activity.user.username || "Anonymous"}
                          </span>
                        )}
                        <span className="text-muted-foreground">{label}</span>
                        {activity.tool && (
                          <Link
                            href={`/ai/${activity.tool_id}`}
                            className="font-semibold text-accent hover:underline truncate"
                          >
                            {activity.tool.name}
                          </Link>
                        )}
                        {activity.collection && (
                          <Link
                            href={`/collections/${activity.collection_id}`}
                            className="font-semibold text-accent hover:underline truncate"
                          >
                            {activity.collection.name}
                          </Link>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

