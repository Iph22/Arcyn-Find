"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { Menu, X, Camera, Upload, Bell, Shield, Palette, User, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/layout/sidebar"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { EmptyState } from "@/components/feedback/empty-state"
import { useAuth } from "@/contexts/auth-context"
import { uploadAvatar, uploadBanner } from "@/lib/storage"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePreferences } from "@/contexts/preferences-context"
import { useLanguage } from "@/contexts/language-context"
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

/**
 * Convert a VAPID public key to the byte array `pushManager.subscribe()` wants.
 *
 * The key is distributed as base64url (`-` and `_`, no padding) because it
 * travels in URLs and headers, but `applicationServerKey` takes raw bytes.
 * Passing the string through unconverted fails at subscribe time with an
 * opaque `InvalidAccessError`, which is a miserable thing to debug.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)

  // The ArrayBuffer is allocated explicitly rather than via
  // `new Uint8Array(length)`. Since TypeScript 5.7 the typed arrays are
  // generic over their buffer, and that shorthand widens to
  // `Uint8Array<ArrayBufferLike>` -- which admits SharedArrayBuffer and so is
  // not assignable to `BufferSource`, the type `applicationServerKey` wants.
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export default function SettingsPage() {
  const router = useRouter()
  const { preferences, updatePreferences } = usePreferences()
  const { t } = useLanguage()
  const { avatarUrl: contextAvatarUrl, refreshAvatar } = useAvatar()
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth()
  const { setTheme: setNextTheme } = useTheme()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
  const [notifyDigest, setNotifyDigest] = useState(true)
  const [isSubscribingPush, setIsSubscribingPush] = useState(false)

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

  // Hydrate the notification and privacy switches from what was actually saved.
  //
  // These were previously display-only on load: every switch reset to its
  // hardcoded default on each visit, so the page showed "Email Notifications:
  // on" to someone who had turned it off. Harmless while nothing read the
  // flags; not harmless now that the digest sender does -- a user who
  // unsubscribed would open this page, see the toggle on, save an unrelated
  // tab and quietly re-subscribe themselves.
  //
  // Runs once, on the first load that produces preferences. Re-running would
  // overwrite edits the user has made but not yet saved.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current || !preferences) return
    hydratedRef.current = true

    // The context spreads the stored JSONB over its own typed fields, so these
    // keys are present at runtime but absent from OnboardingData.
    const saved = preferences as unknown as Record<string, unknown>
    const bool = (key: string, fallback: boolean) =>
      typeof saved[key] === "boolean" ? (saved[key] as boolean) : fallback

    setEmailNotifications(bool("email_notifications", true))
    setNotifyNewFollowers(bool("notify_new_followers", true))
    setNotifyReviews(bool("notify_reviews", true))
    setNotifyMarketing(bool("notify_marketing", false))
    setNotifyDigest(bool("notify_digest", true))
    setShowActivityStatus(bool("show_activity_status", true))
    setAllowSearchIndexing(bool("allow_search_indexing", true))
    setShowInSuggestions(bool("show_in_suggestions", true))
    if (typeof saved.profile_visibility === "string") {
      setProfileVisibility(saved.profile_visibility)
    }
  }, [preferences])

  /**
   * A browser push subscription is per *browser*, not per account, so the
   * switch has to reflect what this browser is actually subscribed to rather
   * than a stored preference. Asked on mount and after every change.
   */
  useEffect(() => {
    let cancelled = false
    const read = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!cancelled) setPushEnabled(Boolean(sub))
      } catch {
        // A browser that refuses to report its subscription is one we cannot
        // claim is subscribed.
        if (!cancelled) setPushEnabled(false)
      }
    }
    read()
    return () => { cancelled = true }
  }, [])

  /**
   * Turn browser notifications on for this browser.
   *
   * Permission alone does nothing — that was the previous bug here. Granting
   * it without calling `pushManager.subscribe()` produces a browser the server
   * has no way to reach, while the UI cheerfully reports notifications as
   * enabled. The grant is only the first of three steps: permission, then a
   * subscription, then handing that subscription to the server.
   */
  const enableBrowserNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("This browser does not support notifications")
      return
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("This browser does not support push notifications")
      return
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      toast.error("Push is not configured on this deployment")
      return
    }

    setIsSubscribingPush(true)
    try {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)

      if (permission !== "granted") {
        if (permission === "denied") toast.error("Notification permission denied")
        return
      }

      const reg = await navigator.serviceWorker.ready
      // Reuse an existing subscription rather than creating a second one for
      // the same browser; `subscribe()` on an already-subscribed registration
      // with a different key throws rather than replacing.
      const existing = await reg.pushManager.getSubscription()
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          // Required by Chrome: a push that cannot be shown to the user is not
          // permitted, and silent pushes are rejected outright.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }))

      const response = await fetch("/api/notifications/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      })

      if (!response.ok) {
        // The browser is subscribed but the server cannot reach it, which is
        // the exact half-configured state this flow exists to avoid. Undo the
        // local subscription so the switch does not lie.
        await sub.unsubscribe().catch(() => {})
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Could not save the subscription")
      }

      setPushEnabled(true)
      toast.success("Browser notifications enabled")
    } catch (error) {
      logger.error("Error enabling push:", error)
      setPushEnabled(false)
      toast.error(error instanceof Error ? error.message : "Could not enable notifications")
    } finally {
      setIsSubscribingPush(false)
    }
  }

  /** Turn them off for this browser only, leaving other devices subscribed. */
  const disableBrowserNotifications = async () => {
    setIsSubscribingPush(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()

      // Tell the server first: if the local unsubscribe succeeds and this
      // fails, the row survives with no browser behind it and we keep pushing
      // into the void until the push service reports it gone.
      await fetch("/api/notifications/push-subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub?.endpoint ?? "" }),
      })

      await sub?.unsubscribe()
      setPushEnabled(false)
      toast.success("Browser notifications turned off")
    } catch (error) {
      logger.error("Error disabling push:", error)
      toast.error("Could not turn off notifications")
    } finally {
      setIsSubscribingPush(false)
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
          notify_digest: notifyDigest,
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
      <div className="flex h-dvh items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">{t("settings.loading")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile drawer. Settings was the one Sidebar page that never had one:
          the sidebar was `hidden md:block` with no toggle, so on a phone
          Reviews, Followers and Sign Out could not be reached from here at all
          without typing a URL. `md:hidden` on the drawer so it cannot appear
          alongside the persistent desktop sidebar above. */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 glass-overlay z-30 md:hidden"
            />
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-40 h-full w-72 md:hidden"
            >
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-[calc(1rem_+_var(--mobile-nav-clearance))] md:pb-6">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-4 md:mb-6 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-10 w-10 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold">{t("settings.title")}</h1>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="flex w-full overflow-x-auto md:grid md:grid-cols-4 h-auto p-1 gap-1">
              <TabsTrigger value="profile" className="flex-1 min-w-[100px]">
                <User className="mr-2 h-4 w-4" />
                {t("nav.profile")}
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex-1 min-w-[100px]">
                <Bell className="mr-2 h-4 w-4" />
                {t("settings.tab.notifications")}
              </TabsTrigger>
              <TabsTrigger value="privacy" className="flex-1 min-w-[100px]">
                <Shield className="mr-2 h-4 w-4" />
                {t("settings.tab.privacy")}
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex-1 min-w-[100px]">
                <Palette className="mr-2 h-4 w-4" />
                {t("settings.tab.appearance")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-4 md:mt-6">
              <Card className="p-4 md:p-6">
                <h2 className="mb-6 text-xl font-semibold">{t("settings.profile.heading")}</h2>

                {/* Banner Upload */}
                <div className="mb-6">
                  <Label className="mb-2 block">{t("settings.profile.banner")}</Label>
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
                          <p className="text-sm text-muted-foreground">{t("settings.profile.noBanner")}</p>
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
                      {bannerUrl ? t("settings.profile.changeBanner") : t("settings.profile.uploadBanner")}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("settings.profile.bannerHint")}
                  </p>
                </div>

                {/* Avatar Upload */}
                <div className="mb-6">
                  <Label className="mb-2 block">{t("settings.profile.picture")}</Label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
                        {avatarUrl ? t("settings.profile.changePicture") : t("settings.profile.uploadPicture")}
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
                        {t("settings.profile.pictureHint")}
                      </p>
                    </div>
                  </div>

                  {/* Preview Section */}
                  <div className="mb-6">
                    <Label className="mb-2 block">{t("settings.profile.preview")}</Label>
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
                            {t("settings.profile.bioEmpty")}
                          </p>
                        )}

                        {/* Action Button Preview */}
                        <Button variant="default" size="sm" className="w-full" disabled>
                          View Profile
                        </Button>
                      </div>
                    </Card>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("settings.profile.previewHint")}
                    </p>
                  </div>
                </div>

                {/* Display Name */}
                <div className="mb-4">
                  <Label htmlFor="displayName">{t("settings.profile.displayName")}</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("settings.profile.displayNamePlaceholder")}
                    className="mt-2"
                  />
                </div>

                {/* Username */}
                <div className="mb-4">
                  <Label htmlFor="username">{t("settings.profile.username")}</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="username"
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("settings.profile.usernameHint")}
                  </p>
                </div>

                {/* Bio */}
                <div className="mb-6">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t("settings.profile.bioPlaceholder")}
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
                      {t("settings.saving")}
                    </>
                  ) : (
                    t("settings.save")
                  )}
                </Button>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-4 md:mt-6">
              <Card className="p-4 md:p-6">
                <h2 className="mb-6 text-xl font-semibold">{t("settings.notif.heading")}</h2>

                {/* Push Notifications */}
                <div className="mb-6">
                  <Label className="mb-4 block text-base font-semibold">{t("settings.notif.push")}</Label>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{t("settings.notif.browser")}</p>
                        <p className="text-sm text-muted-foreground">
                          {pushEnabled
                            ? t("settings.notif.browserOn")
                            : notificationPermission === "denied"
                              ? t("settings.notif.browserBlocked")
                              : t("settings.notif.browserHint")}
                        </p>
                      </div>
                      {/* Reflects this browser's actual subscription, not a
                          stored preference — the same account on another
                          device is subscribed separately. */}
                      <Switch
                        checked={pushEnabled}
                        disabled={isSubscribingPush || notificationPermission === "denied"}
                        onCheckedChange={(next) =>
                          next ? enableBrowserNotifications() : disableBrowserNotifications()
                        }
                        aria-label="Browser notifications"
                      />
                    </div>
                    {notificationPermission === "denied" && (
                      <p className="text-xs text-muted-foreground mt-2">
                        You have blocked notifications for this site. Re-enable them in your
                        browser&apos;s site settings, then turn this on.
                      </p>
                    )}
                  </div>
                </div>

                {/* Email Notifications */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">{t("settings.notif.emailPrefs")}</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{t("settings.notif.email")}</p>
                        <p className="text-sm text-muted-foreground">{t("settings.notif.emailDesc")}</p>
                      </div>
                      <Switch
                        checked={emailNotifications}
                        onCheckedChange={setEmailNotifications}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{t("settings.notif.digest")}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("settings.notif.digestDesc")}
                        </p>
                      </div>
                      <Switch
                        checked={notifyDigest}
                        onCheckedChange={setNotifyDigest}
                        disabled={!emailNotifications}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{t("settings.notif.newFollowers")}</p>
                        <p className="text-sm text-muted-foreground">{t("settings.notif.newFollowersDesc")}</p>
                      </div>
                      <Switch
                        checked={notifyNewFollowers}
                        onCheckedChange={setNotifyNewFollowers}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{t("settings.notif.reviews")}</p>
                        <p className="text-sm text-muted-foreground">{t("settings.notif.reviewsDesc")}</p>
                      </div>
                      <Switch
                        checked={notifyReviews}
                        onCheckedChange={setNotifyReviews}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{t("settings.notif.marketing")}</p>
                        <p className="text-sm text-muted-foreground">{t("settings.notif.marketingDesc")}</p>
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
                      {t("settings.saving")}
                    </>
                  ) : (
                    t("settings.notif.save")
                  )}
                </Button>
              </Card>
            </TabsContent>

            <TabsContent value="privacy" className="mt-4 md:mt-6">
              <Card className="p-4 md:p-6">
                <h2 className="mb-6 text-xl font-semibold">{t("settings.privacy.heading")}</h2>

                {/* Profile Visibility */}
                <div className="mb-6">
                  <Label htmlFor="visibility" className="mb-2 block text-base font-semibold">
                    {t("settings.privacy.visibility")}
                  </Label>
                  <Select value={profileVisibility} onValueChange={setProfileVisibility}>
                    <SelectTrigger id="visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">
                        <div>
                          <p className="font-medium">{t("settings.privacy.public")}</p>
                          <p className="text-xs text-muted-foreground">{t("settings.privacy.publicDesc")}</p>
                        </div>
                      </SelectItem>
                      <SelectItem value="followers">
                        <div>
                          <p className="font-medium">{t("settings.privacy.followersOnly")}</p>
                          <p className="text-xs text-muted-foreground">{t("settings.privacy.followersOnlyDesc")}</p>
                        </div>
                      </SelectItem>
                      <SelectItem value="private">
                        <div>
                          <p className="font-medium">{t("settings.privacy.private")}</p>
                          <p className="text-xs text-muted-foreground">{t("settings.privacy.privateDesc")}</p>
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
                        <p className="font-medium">{t("settings.privacy.activity")}</p>
                        <p className="text-sm text-muted-foreground">Let others see when you're online</p>
                      </div>
                      <Switch
                        checked={showActivityStatus}
                        onCheckedChange={setShowActivityStatus}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{t("settings.privacy.indexing")}</p>
                        <p className="text-sm text-muted-foreground">{t("settings.privacy.indexingDesc")}</p>
                      </div>
                      <Switch
                        checked={allowSearchIndexing}
                        onCheckedChange={setAllowSearchIndexing}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{t("settings.privacy.suggestions")}</p>
                        <p className="text-sm text-muted-foreground">{t("settings.privacy.suggestionsDesc")}</p>
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
                      {t("settings.saving")}
                    </>
                  ) : (
                    t("settings.privacy.save")
                  )}
                </Button>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="mt-4 md:mt-6">
              <Card className="p-4 md:p-6">
                <h2 className="mb-6 text-xl font-semibold">{t("settings.appearance.heading")}</h2>
                <div>
                  <Label htmlFor="theme" className="mb-2 block">{t("settings.appearance.theme")}</Label>
                  <Select value={theme} onValueChange={handleThemeChange}>
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t("settings.appearance.light")}</SelectItem>
                      <SelectItem value="dark">{t("settings.appearance.dark")}</SelectItem>
                      <SelectItem value="system">{t("settings.appearance.system")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("settings.appearance.hint")}
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
