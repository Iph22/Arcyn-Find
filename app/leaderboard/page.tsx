"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Trophy, Star, BookOpen, Heart, Users, Award, Loader2 } from "lucide-react"
import { getLeaderboard, type UserStats } from "@/lib/community"
import Link from "next/link"

type LeaderboardCategory = "reviews" | "collections" | "helpful" | "followers"

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<UserStats[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<LeaderboardCategory>("helpful")

  useEffect(() => {
    loadLeaderboard()
  }, [category])

  async function loadLeaderboard() {
    try {
      setLoading(true)
      const data = await getLeaderboard(50)
      
      // Sort by selected category
      const sorted = [...data].sort((a, b) => {
        switch (category) {
          case "reviews":
            return b.total_reviews - a.total_reviews
          case "collections":
            return b.total_collections - a.total_collections
          case "helpful":
            return b.total_helpful_votes - a.total_helpful_votes
          case "followers":
            return b.followers_count - a.followers_count
          default:
            return 0
        }
      })
      
      setLeaderboard(sorted)
    } catch (error) {
      console.error("Error loading leaderboard:", error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />
    if (rank === 2) return <Award className="h-5 w-5 text-gray-400" />
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />
    return <span className="text-muted-foreground font-semibold">#{rank}</span>
  }

  const getCategoryValue = (user: UserStats) => {
    switch (category) {
      case "reviews":
        return user.total_reviews
      case "collections":
        return user.total_collections
      case "helpful":
        return user.total_helpful_votes
      case "followers":
        return user.followers_count
      default:
        return 0
    }
  }

  const categories = [
    { id: "helpful" as LeaderboardCategory, label: "Most Helpful", icon: Heart },
    { id: "reviews" as LeaderboardCategory, label: "Top Reviewers", icon: Star },
    { id: "collections" as LeaderboardCategory, label: "Collection Creators", icon: BookOpen },
    { id: "followers" as LeaderboardCategory, label: "Most Followed", icon: Users },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="h-6 w-6 text-accent" />
            <h1 className="text-3xl font-bold">Leaderboard</h1>
          </div>
          <p className="text-muted-foreground">
            Top contributors and most active users
          </p>
        </motion.div>

        {/* Category Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((cat) => {
            const Icon = cat.icon
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
                  category === cat.id
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">No Rankings Yet</h2>
            <p className="text-muted-foreground">
              Be the first to contribute and appear on the leaderboard!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((user, idx) => {
              const rank = idx + 1
              const value = getCategoryValue(user)

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="rounded-xl border border-border bg-card p-4 sm:p-6 hover:border-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 flex items-center justify-center">
                      {getRankIcon(rank)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/users/${user.id}`}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.display_name || user.username || "User"}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                            <Users className="h-6 w-6 text-accent" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate">
                            {user.display_name || user.username || "Anonymous"}
                          </h3>
                          {user.username && user.display_name && (
                            <p className="text-sm text-muted-foreground">@{user.username}</p>
                          )}
                        </div>
                      </Link>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-2xl font-bold">{value}</div>
                        <div className="text-xs text-muted-foreground">
                          {categories.find((c) => c.id === category)?.label.split(" ")[1] || "points"}
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="text-center">
                          <div className="font-semibold">{user.total_reviews}</div>
                          <div className="text-xs">Reviews</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold">{user.total_collections}</div>
                          <div className="text-xs">Collections</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold">{user.followers_count}</div>
                          <div className="text-xs">Followers</div>
                        </div>
                      </div>
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

