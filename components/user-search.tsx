"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import { Search, User, X, Plus, UserPlus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

interface UserResult {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  banner_url: string | null
  bio: string | null
  isFollowing?: boolean
}

export function UserSearch() {
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
        console.error('Error searching users:', error)
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
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 z-[9999] px-4"
            style={{
              // Position centered in viewport, appearing in main content area
              // This ensures it's always visible outside the sidebar
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'min(90vw, 48rem)',
              maxWidth: '800px'
            }}
          >
            <Card className="p-4 shadow-2xl max-h-[calc(100vh-8rem)] flex flex-col">
                {/* Search Input */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name or username..."
                      className="pl-10"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-accent rounded-lg transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Results - Scrollable */}
                <div className="flex-1 overflow-y-auto">
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
                              className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm cursor-pointer hover:border-border hover:shadow-lg transition-all group"
                              onClick={() => handleUserClick(user.id)}
                            >
                              {/* Banner */}
                              <div className="relative h-24 bg-gradient-to-br from-primary/20 via-chart-1/20 to-chart-3/20">
                                {user.banner_url && (
                                  <img
                                    src={user.banner_url}
                                    alt="Banner"
                                    className="w-full h-full object-cover"
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
                                  {/* Add Status Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      // TODO: Add status functionality
                                    }}
                                    className="p-1.5 rounded-full bg-muted hover:bg-accent transition-colors shrink-0"
                                    title="Add Status"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
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
                                  className="w-full gap-2"
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
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all"
        title="Search users"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search users...</span>
      </button>

      {/* Render modal outside sidebar using portal */}
      {mounted && typeof window !== 'undefined' && createPortal(searchModal, document.body)}
    </>
  )
}
