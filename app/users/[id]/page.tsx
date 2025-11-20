"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { User, Star, BookOpen, Heart, Users, Loader2, UserPlus, UserMinus } from "lucide-react"
import { getUserProfile } from "@/lib/auth"
import { getUserStats, followUser, unfollowUser, isFollowingUser } from "@/lib/community"
import { getPublicCollections } from "@/lib/collections"
import { getToolReviews } from "@/lib/reviews"
import { getCurrentUser } from "@/lib/auth"
import Link from "next/link"
import type { UserStats } from "@/lib/community"
import type { Collection } from "@/lib/collections"

export default function UserProfilePage() {
  const params = useParams()
  const userId = params.id as string
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followingLoading, setFollowingLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [userId])

  async function loadData() {
    try {
      setLoading(true)
      const [userProfile, userStats, userCollections, userReviews, current] = await Promise.all([
        getUserProfile(userId),
        getUserStats(userId),
        getPublicCollections(100, userId),
        getToolReviews("", userId, 10),
        getCurrentUser(),
      ])

      setProfile(userProfile)
      setStats(userStats)
      setCollections(userCollections)
      setReviews(userReviews.reviews || [])
      setCurrentUser(current)

      if (current && current.id !== userId) {
        const following = await isFollowingUser(userId)
        setIsFollowing(following)
      }
    } catch (error) {
      console.error("Error loading user profile:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleFollow() {
    if (!currentUser) return
    setFollowingLoading(true)
    try {
      if (isFollowing) {
        await unfollowUser(userId)
        setIsFollowing(false)
      } else {
        await followUser(userId)
        setIsFollowing(true)
      }
    } catch (error) {
      console.error("Error toggling follow:", error)
    } finally {
      setFollowingLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">User Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The user you're looking for doesn't exist
            </p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-accent px-4 py-2 text-accent-foreground hover:bg-accent/90"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isOwnProfile = currentUser && currentUser.id === userId

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || profile.username || "Profile"}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-accent/10 flex items-center justify-center">
                  <User className="h-10 w-10 text-accent" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold mb-1">
                  {profile.display_name || profile.username || "Anonymous"}
                </h1>
                {profile.username && (
                  <p className="text-muted-foreground">@{profile.username}</p>
                )}
                {profile.bio && (
                  <p className="mt-2 text-muted-foreground">{profile.bio}</p>
                )}
              </div>
              {!isOwnProfile && currentUser && (
                <button
                  onClick={handleFollow}
                  disabled={followingLoading}
                  className={`rounded-lg px-4 py-2 flex items-center gap-2 transition-colors ${
                    isFollowing
                      ? "border border-border hover:bg-muted"
                      : "bg-accent text-accent-foreground hover:bg-accent/90"
                  }`}
                >
                  {followingLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isFollowing ? (
                    <>
                      <UserMinus className="h-4 w-4" />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Follow
                    </>
                  )}
                </button>
              )}
              {isOwnProfile && (
                <Link
                  href="/profile"
                  className="rounded-lg border border-border px-4 py-2 hover:bg-muted"
                >
                  Edit Profile
                </Link>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <Star className="h-5 w-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.total_reviews}</div>
                <div className="text-xs text-muted-foreground">Reviews</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <BookOpen className="h-5 w-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.total_collections}</div>
                <div className="text-xs text-muted-foreground">Collections</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <Users className="h-5 w-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.followers_count}</div>
                <div className="text-xs text-muted-foreground">Followers</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <Heart className="h-5 w-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.total_helpful_votes}</div>
                <div className="text-xs text-muted-foreground">Helpful Votes</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Collections */}
        {collections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-xl font-bold mb-4">Public Collections</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {collections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/collections/${collection.id}`}
                  className="block rounded-xl border border-border bg-card p-4 hover:border-accent/50 transition-colors"
                >
                  <h3 className="font-semibold mb-1">{collection.name}</h3>
                  {collection.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {collection.description}
                    </p>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {collection.tool_count || 0} tools
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Reviews */}
        {reviews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xl font-bold mb-4">Recent Reviews</h2>
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <Link
                      href={`/ai/${review.tool_id}`}
                      className="font-semibold hover:text-accent"
                    >
                      {review.tool_name || "AI Tool"}
                    </Link>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {review.comment}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

