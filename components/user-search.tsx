"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { createPortal } from "react-dom"
import { Search, User, X, UserPlus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { logger } from "@/lib/logger"

interface UserResult {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  banner_url: string | null
  bio: string | null
  isFollowing?: boolean
}

interface UserSearchProps {
  trigger?: React.ReactNode
}

export function UserSearch({ trigger }: UserSearchProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState<UserResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setResults([])
        return
      }

      setIsSearching(true)
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data.users || [])
        }
      } catch (error) {
        logger.error('Error searching users:', error)
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  const handleUserClick = (userId: string) => {
    setIsOpen(false)
    setSearchQuery("")
    setResults([])
    router.push(`/profile/${userId}`)
  }

  const searchModal = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
          />

          {/* Search Panel - Positioned in main content area, outside sidebar */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) {
                setIsOpen(false)
              }
            }}
            className="fixed inset-x-0 bottom-0 z-[9999] md:fixed md:top-24 md:left-1/2 md:right-auto md:bottom-auto md:-translate-x-1/2 md:w-full md:max-w-lg md:px-4"
          >
            <div className="md:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-3" />
            <Card className="h-[85vh] md:h-auto md:max-h-[80vh] flex flex-col rounded-t-3xl md:rounded-2xl border-0 md:border border-white/10 bg-black/80 md:bg-black/60 backdrop-blur-xl shadow-2xl ring-1 ring-white/10">
              {/* Search Input */}
              <div className="flex items-center gap-3 p-4 border-b border-white/5">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="pl-10 bg-white/5 border-white/10 focus:bg-white/10 focus:border-primary/50 transition-all h-11 rounded-xl"
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Results - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isSearching ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : results.length === 0 && searchQuery ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No users found</p>
                  </div>
                ) : results.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {results.map((user) => {
                      const displayName = user.display_name || user.username || 'Unknown User'
                      const initials = displayName.charAt(0).toUpperCase()

                      return (
                        <motion.div
                          key={user.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Card
                            className="overflow-hidden border-white/5 bg-white/5 hover:bg-white/10 backdrop-blur-md cursor-pointer hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group h-full flex flex-col"
                            onClick={() => handleUserClick(user.id)}
                          >
                            {/* Banner */}
                            <div className="relative h-24 bg-gradient-to-br from-primary/20 via-chart-1/20 to-chart-3/20">
                              {user.banner_url && (
                                <Image
                                  src={user.banner_url}
                                  alt="Banner"
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                />
                              )}

                              {/* Profile Picture - Overlapping banner */}
                              <div className="absolute bottom-0 left-4 translate-y-1/2">
                                <div className="relative">
                                  <Avatar className="h-16 w-16 border-4 border-card ring-2 ring-border/20">
                                    <AvatarImage src={user.avatar_url || undefined} />
                                    <AvatarFallback className="bg-gradient-to-br from-primary to-chart-1 text-lg font-bold text-primary-foreground">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  {/* Online Status Indicator */}
                                  <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card bg-green-500"></div>
                                </div>
                              </div>
                            </div>

                            {/* User Info */}
                            <div className="pt-8 px-4 pb-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-bold text-lg truncate">{displayName}</h3>
                                  <p className="text-sm text-muted-foreground truncate">@{user.username || 'unknown'}</p>
                                </div>
                                {/* Follow Button */}
                                <Button
                                  variant={user.isFollowing ? "outline" : "default"}
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={async (e) => {
                                    e.stopPropagation()

                                    // Optimistic update
                                    const newIsFollowing = !user.isFollowing
                                    setResults(prev => prev.map(u =>
                                      u.id === user.id ? { ...u, isFollowing: newIsFollowing } : u
                                    ))

                                    try {
                                      const response = await fetch(`/api/users/${user.id}/follow`, {
                                        method: user.isFollowing ? "DELETE" : "POST",
                                      })

                                      if (!response.ok) {
                                        throw new Error("Failed to update follow status")
                                      }

                                      toast.success(newIsFollowing ? `Following ${displayName}` : `Unfollowed ${displayName}`)
                                    } catch (error) {
                                      // Revert on error
                                      setResults(prev => prev.map(u =>
                                        u.id === user.id ? { ...u, isFollowing: user.isFollowing } : u
                                      ))
                                      toast.error("Failed to update follow status")
                                    }
                                  }}
                                >
                                  {user.isFollowing ? (
                                    "Following"
                                  ) : (
                                    <>
                                      <UserPlus className="h-3 w-3 mr-1" />
                                      Follow
                                    </>
                                  )}
                                </Button>
                              </div>

                              {/* Bio */}
                              {user.bio && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                  {user.bio}
                                </p>
                              )}

                              {/* Action Button */}
                              <Button
                                variant="default"
                                size="sm"
                                className="w-full gap-2 font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all mt-auto"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleUserClick(user.id)
                                }}
                              >
                                View Profile
                              </Button>
                            </div>
                          </Card>
                        </motion.div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Search for users by name or username</p>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return (
    <>
      {/* Search Trigger Button */}
      {trigger ? (
        <div onClick={() => setIsOpen(true)} className="contents cursor-pointer">
          {trigger}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all"
          title="Search users"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">Search users...</span>
        </button>
      )}

      {/* Render modal outside sidebar using portal */}
      {mounted && typeof window !== 'undefined' && createPortal(searchModal, document.body)}
    </>
  )
}
