"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Menu, X, Camera, Upload, Bell, Shield, Palette, User, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { EmptyState } from "@/components/empty-state"
import { useAuth } from "@/contexts/auth-context"
import { uploadAvatar, uploadBanner } from "@/lib/storage"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePreferences } from "@/contexts/preferences-context"
import { useAvatar } from "@/contexts/avatar-context"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { logger } from "@/lib/logger"

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

export default function SettingsPage() {
  const router = useRouter()
  const { preferences, updatePreferences } = usePreferences()
  const { avatarUrl: contextAvatarUrl, refreshAvatar } = useAvatar()
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth()
  const { setTheme: setNextTheme } = useTheme()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Profile form state
  const [displayName, setDisplayName] = useState("")
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")

  // Image upload refs
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)

  // Notification settings
  const [pushEnabled, setPushEnabled] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [notificationPermission, setNotificationPermission] = useState("default")
  const [notifyNewFollowers, setNotifyNewFollowers] = useState(true)
  const [notifyReviews, setNotifyReviews] = useState(true)
  const [notifyMarketing, setNotifyMarketing] = useState(false)

  // Privacy settings
  const [profileVisibility, setProfileVisibility] = useState("public")
  const [showActivityStatus, setShowActivityStatus] = useState(true)
  const [allowSearchIndexing, setAllowSearchIndexing] = useState(true)
  const [showInSuggestions, setShowInSuggestions] = useState(true)

  // Theme settings
  const [theme, setTheme] = useState("system")

  useEffect(() => {
    let isMounted = true

    const loadUserData = async () => {
      try {
        if (isAuthLoading) return

        if (!isAuthenticated || !user) {
          if (isMounted) {
            router.push("/")
          }
          return
        }

        // Load user profile via API
        const response = await fetch('/api/user/profile')
        if (!isMounted) return

        if (response.ok) {
          try {
            const data = await response.json()
            const profile = data.profile

            if (isMounted) {
              if (profile) {
                setUserProfile(profile)
                // Use profile data but fallback to Clerk for empty fields
                setDisplayName(profile.display_name || user.name || user.email?.split("@")[0] || "")
                setUsername(profile.username || user.email?.split("@")[0]?.toLowerCase() || "")
                setBio(profile.bio || "")
                setAvatarUrl(profile.avatar_url || user.picture || "")
                setBannerUrl(profile.banner_url || "")
              } else {
                // Initialize with Clerk user data
                setDisplayName(user.name || user.email?.split("@")[0] || "")
                setUsername(user.email?.split("@")[0]?.toLowerCase() || "")
                setAvatarUrl(user.picture || "")
              }
            }
          } catch (err) {
            logger.error("Error parsing profile JSON:", err)
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          logger.error("Error loading user data:", error)
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
  }, [user, isAuthLoading, isAuthenticated, router])

  useEffect(() => {
    // Check notification permission on mount
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission)
      setPushEnabled(Notification.permission === "granted")
    }
  }, [])

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission()
      setNotificationPermission(result)
      if (result === "granted") {
        setPushEnabled(true)
        toast.success("Notifications enabled!")
      } else if (result === "denied") {
        toast.error("Notification permission denied")
      }
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB")
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    setIsSaving(true)
    try {
      const result = await uploadAvatar(user.id, file)
      if (result.success && result.url) {
        setAvatarUrl(result.url)
        toast.success("Avatar uploaded successfully")
      } else {
        toast.error(result.error || "Failed to upload avatar")
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        logger.error("Error uploading avatar:", error)
      }
      toast.error("Failed to upload avatar")
    } finally {
      setIsSaving(false)
    }
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size must be less than 10MB")
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setBannerPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    setIsSaving(true)
    try {
      const result = await uploadBanner(user.id, file)
      if (result.success && result.url) {
        setBannerUrl(result.url)
        toast.success("Banner uploaded successfully")
      } else {
        toast.error(result.error || "Failed to upload banner")
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        logger.error("Error uploading banner:", error)
      }
      toast.error("Failed to upload banner")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: displayName || undefined,
          username: username || undefined,
          bio: bio || undefined,
          avatar_url: avatarUrl || undefined,
          banner_url: bannerUrl || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setUserProfile(data.profile || null)
        // Update preferences context
        if (displayName) {
          updatePreferences({ userName: displayName })
        }
        // Refresh avatar context to sync across app
        await refreshAvatar()
        toast.success("Profile updated successfully")
        // Refresh the page to show updated profile
        router.refresh()
      } else {
        toast.error(data.error || "Failed to update profile")
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        logger.error("Error saving profile:", error)
      }
      toast.error("Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    if (!user) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_notifications: emailNotifications,
          notify_new_followers: notifyNewFollowers,
          notify_reviews: notifyReviews,
          notify_marketing: notifyMarketing,
        }),
      })

      if (response.ok) {
        toast.success("Notification preferences saved")
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to save preferences")
      }
    } catch (error) {
      logger.error("Error saving notifications:", error)
      toast.error("Failed to save notification preferences")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePrivacy = async () => {
    if (!user) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_visibility: profileVisibility,
          show_activity_status: showActivityStatus,
          allow_search_indexing: allowSearchIndexing,
          show_in_suggestions: showInSuggestions,
        }),
      })

      if (response.ok) {
        toast.success("Privacy settings saved")
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to save settings")
      }
    } catch (error) {
      logger.error("Error saving privacy:", error)
      toast.error("Failed to save privacy settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    // Use next-themes to set theme properly
    setNextTheme(newTheme)
    toast.success("Theme updated")
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
        <div className="container mx-auto max-w-4xl">
          <h1 className="mb-6 text-3xl font-bold">Settings</h1>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="notifications">
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="privacy">
                <Shield className="mr-2 h-4 w-4" />
                Privacy
              </TabsTrigger>
              <TabsTrigger value="appearance">
                <Palette className="mr-2 h-4 w-4" />
                Appearance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-6">
              <Card className="p-6">
                <h2 className="mb-6 text-xl font-semibold">Profile Settings</h2>

                {/* Banner Upload */}
                <div className="mb-6">
                  <Label className="mb-2 block">Banner Image</Label>
                  <div className="relative h-48 w-full overflow-hidden rounded-lg border border-border bg-muted">
                    {(bannerPreview || bannerUrl) ? (
                      <>
                        <Image
                          src={bannerPreview || bannerUrl}
                          alt="Banner"
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 800px"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute right-2 top-2"
                          onClick={() => {
                            setBannerUrl("")
                            setBannerPreview(null)
                            if (bannerInputRef.current) {
                              bannerInputRef.current.value = ""
                            }
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                          <Camera className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No banner image</p>
                        </div>
                      </div>
                    )}
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      className="absolute bottom-2 right-2"
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={isSaving}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {bannerUrl ? "Change Banner" : "Upload Banner"}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Recommended size: 1200x300px. Max file size: 10MB
                  </p>
                </div>

                {/* Avatar Upload */}
                <div className="mb-6">
                  <Label className="mb-2 block">Profile Picture</Label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={avatarPreview || avatarUrl || contextAvatarUrl || user?.picture} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-chart-1 text-2xl">
                          {displayName?.charAt(0).toUpperCase() || user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isSaving}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>
                    <div className="flex-1">
                      <Button
                        variant="outline"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isSaving}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {avatarUrl ? "Change Picture" : "Upload Picture"}
                      </Button>
                      {avatarUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2"
                          onClick={() => {
                            setAvatarUrl("")
                            setAvatarPreview(null)
                            if (avatarInputRef.current) {
                              avatarInputRef.current.value = ""
                            }
                          }}
                        >
                          Remove
                        </Button>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Recommended size: 400x400px. Max file size: 5MB
                      </p>
                    </div>
                  </div>

                  {/* Preview Section */}
                  <div className="mb-6">
                    <Label className="mb-2 block">Preview (How you appear in search)</Label>
                    <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
                      {/* Banner */}
                      <div className="relative h-24 bg-gradient-to-br from-primary/20 via-chart-1/20 to-chart-3/20">
                        {(bannerPreview || bannerUrl) && (
                          <Image
                            src={bannerPreview || bannerUrl}
                            alt="Banner preview"
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 400px"
                          />
                        )}

                        {/* Profile Picture - Overlapping banner */}
                        <div className="absolute bottom-0 left-4 translate-y-1/2">
                          <div className="relative">
                            <Avatar className="h-16 w-16 border-4 border-card ring-2 ring-border/20">
                              <AvatarImage src={avatarPreview || avatarUrl || contextAvatarUrl || user?.picture} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-chart-1 text-lg font-bold text-primary-foreground">
                                {displayName?.charAt(0).toUpperCase() || user?.name?.charAt(0).toUpperCase() || "U"}
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
                            <h3 className="font-bold text-lg truncate">{displayName || "Your Name"}</h3>
                            <p className="text-sm text-muted-foreground truncate">@{username || "username"}</p>
                          </div>
                          <div className="p-1.5 rounded-full bg-muted shrink-0">
                            <Plus className="h-3 w-3" />
                          </div>
                        </div>

                        {/* Bio Preview */}
                        {bio && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {bio}
                          </p>
                        )}
                        {!bio && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3 italic">
                            Your bio will appear here
                          </p>
                        )}

                        {/* Action Button Preview */}
                        <Button variant="default" size="sm" className="w-full" disabled>
                          View Profile
                        </Button>
                      </div>
                    </Card>
                    <p className="mt-2 text-xs text-muted-foreground">
                      This is how your profile appears when users search for you
                    </p>
                  </div>
                </div>

                {/* Display Name */}
                <div className="mb-4">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                    className="mt-2"
                  />
                </div>

                {/* Username */}
                <div className="mb-4">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="username"
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Only lowercase letters, numbers, and underscores allowed
                  </p>
                </div>

                {/* Bio */}
                <div className="mb-6">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    className="mt-2"
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bio.length}/500 characters
                  </p>
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="w-full sm:w-auto"
                >
                  {isSaving ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-6">
              <Card className="p-6">
                <h2 className="mb-6 text-xl font-semibold">Notification Settings</h2>

                {/* Push Notifications */}
                <div className="mb-6">
                  <Label className="mb-4 block text-base font-semibold">Push Notifications</Label>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">Browser Notifications</p>
                        <p className="text-sm text-muted-foreground">
                          Status: {notificationPermission === "granted" ? "✓ Enabled" : notificationPermission === "denied" ? "✗ Blocked" : "Not set"}
                        </p>
                      </div>
                      {notificationPermission !== "granted" && (
                        <Button onClick={requestNotificationPermission} size="sm">
                          Enable Notifications
                        </Button>
                      )}
                    </div>
                    {notificationPermission === "denied" && (
                      <p className="text-xs text-muted-foreground mt-2">
                        To enable notifications, please allow them in your browser settings.
                      </p>
                    )}
                  </div>
                </div>

                {/* Email Notifications */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Email Preferences</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className="text-sm text-muted-foreground">Receive updates via email</p>
                      </div>
                      <Switch
                        checked={emailNotifications}
                        onCheckedChange={setEmailNotifications}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">New Followers</p>
                        <p className="text-sm text-muted-foreground">When someone follows you</p>
                      </div>
                      <Switch
                        checked={notifyNewFollowers}
                        onCheckedChange={setNotifyNewFollowers}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Reviews & Comments</p>
                        <p className="text-sm text-muted-foreground">Activity on your content</p>
                      </div>
                      <Switch
                        checked={notifyReviews}
                        onCheckedChange={setNotifyReviews}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Marketing Emails</p>
                        <p className="text-sm text-muted-foreground">Updates and promotions</p>
                      </div>
                      <Switch
                        checked={notifyMarketing}
                        onCheckedChange={setNotifyMarketing}
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSaveNotifications}
                  disabled={isSaving}
                  className="w-full sm:w-auto mt-6"
                >
                  {isSaving ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    "Save Notification Preferences"
                  )}
                </Button>
              </Card>
            </TabsContent>

            <TabsContent value="privacy" className="mt-6">
              <Card className="p-6">
                <h2 className="mb-6 text-xl font-semibold">Privacy Settings</h2>

                {/* Profile Visibility */}
                <div className="mb-6">
                  <Label htmlFor="visibility" className="mb-2 block text-base font-semibold">
                    Profile Visibility
                  </Label>
                  <Select value={profileVisibility} onValueChange={setProfileVisibility}>
                    <SelectTrigger id="visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">
                        <div>
                          <p className="font-medium">Public</p>
                          <p className="text-xs text-muted-foreground">Anyone can see your profile</p>
                        </div>
                      </SelectItem>
                      <SelectItem value="followers">
                        <div>
                          <p className="font-medium">Followers Only</p>
                          <p className="text-xs text-muted-foreground">Only your followers can see</p>
                        </div>
                      </SelectItem>
                      <SelectItem value="private">
                        <div>
                          <p className="font-medium">Private</p>
                          <p className="text-xs text-muted-foreground">Only you can see your profile</p>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Data & Privacy Options */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Data & Privacy</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Show Activity Status</p>
                        <p className="text-sm text-muted-foreground">Let others see when you're online</p>
                      </div>
                      <Switch
                        checked={showActivityStatus}
                        onCheckedChange={setShowActivityStatus}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Allow Search Indexing</p>
                        <p className="text-sm text-muted-foreground">Let search engines find your profile</p>
                      </div>
                      <Switch
                        checked={allowSearchIndexing}
                        onCheckedChange={setAllowSearchIndexing}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Show in Suggestions</p>
                        <p className="text-sm text-muted-foreground">Appear in follow suggestions</p>
                      </div>
                      <Switch
                        checked={showInSuggestions}
                        onCheckedChange={setShowInSuggestions}
                      />
                    </div>
                  </div>
                </div>

                {/* Blocked Users */}
                <div className="mt-6">
                  <Label className="text-base font-semibold">Blocked Users</Label>
                  <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4 text-center">
                    <p className="text-sm text-muted-foreground">You haven't blocked anyone yet</p>
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSavePrivacy}
                  disabled={isSaving}
                  className="w-full sm:w-auto mt-6"
                >
                  {isSaving ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    "Save Privacy Settings"
                  )}
                </Button>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="mt-6">
              <Card className="p-6">
                <h2 className="mb-6 text-xl font-semibold">Appearance</h2>
                <div>
                  <Label htmlFor="theme" className="mb-2 block">Theme</Label>
                  <Select value={theme} onValueChange={handleThemeChange}>
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light Mode</SelectItem>
                      <SelectItem value="dark">Dark Mode</SelectItem>
                      <SelectItem value="system">System Default</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Choose how Arcyn Find looks to you. Changes apply immediately.
                  </p>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
