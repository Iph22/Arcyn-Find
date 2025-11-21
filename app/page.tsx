"use client"

import type React from "react"

import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { motion, useScroll } from "framer-motion"
import { CodesandboxIcon, Github, ArrowRight, Zap, Shield, Globe } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import { usePreferences } from "@/contexts/preferences-context"
import { BrowserSearchAnimation } from "@/components/browser-search-animation"
import { signInWithProvider, signIn, signUp, getCurrentUser } from "@/lib/auth"

export default function LandingPage() {
  const router = useRouter()
  const { login, preferences } = usePreferences()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)

  // Ensure ref is attached to DOM before using useScroll
  useLayoutEffect(() => {
    if (containerRef.current) {
      setIsReady(true)
    }
  }, [])

  // Use useScroll with proper hydration handling
  const { scrollYProgress } = useScroll({
    target: isReady ? containerRef : undefined,
    offset: ["start start", "end end"],
  })

  // Redirect if already authenticated
  useEffect(() => {
    if (preferences?.isAuthenticated) {
      router.push("/home")
    }
  }, [preferences?.isAuthenticated, router])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (!email || !email.includes("@")) {
        setError("Please enter a valid email address")
        setIsLoading(false)
        return
      }

      if (!password || password.length < 6) {
        setError("Password must be at least 6 characters")
        setIsLoading(false)
        return
      }

      let result
      if (mode === "signin") {
        result = await signIn(email, password)
      } else {
        result = await signUp(email, password)
      }

      if (result.success) {
        // Get user from Supabase
        const user = await getCurrentUser()
        if (user) {
          login(
            user.email?.split("@")[0] || "User",
            user.email || ""
          )
          localStorage.setItem("arcyn-authenticated", "true")
          router.push("/onboarding")
        } else {
          setError("Failed to get user information")
        }
      } else {
        setError(result.error || "Authentication failed")
      }
    } catch (error) {
      console.error("Auth error:", error)
      setError(error instanceof Error ? error.message : "Authentication failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    try {
      const result = await signInWithProvider("google")
      if (!result.success) {
        alert(result.error || "Google sign-in failed")
        setIsLoading(false)
      }
      // OAuth redirect will happen automatically
    } catch (error) {
      console.error("Google auth error:", error)
      alert("Google sign-in failed. Please try again.")
      setIsLoading(false)
    }
  }

  const handleGitHubAuth = async () => {
    setIsLoading(true)
    try {
      const result = await signInWithProvider("github")
      if (!result.success) {
        alert(result.error || "GitHub sign-in failed")
        setIsLoading(false)
      }
      // OAuth redirect will happen automatically
    } catch (error) {
      console.error("GitHub auth error:", error)
      alert("GitHub sign-in failed. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div ref={containerRef} className="h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-background text-foreground scroll-smooth">
      <motion.header
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {isReady && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[1px] bg-primary origin-left"
            style={{ scaleX: scrollYProgress }}
          />
        )}
        <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CodesandboxIcon className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold tracking-tight">Arcyn Find</span>
            </div>
            <nav className="flex items-center gap-6">
              <ThemeToggle />
            </nav>
          </div>
        </div>
      </motion.header>

      {/* Frame 1: Hero & Auth */}
      <section className="h-screen w-full snap-start snap-always relative flex flex-col lg:flex-row pt-20 lg:pt-0 overflow-hidden">
        {/* Left Column: Text & Auth */}
        <div className="flex-1 flex flex-col justify-between px-4 sm:px-8 lg:px-16 xl:px-24 py-8 lg:py-12 z-10 relative">
          <div className="flex-1 flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8 lg:mb-0"
            >
              <h1 className="text-5xl sm:text-6xl lg:text-8xl font-serif font-medium tracking-tight mb-6 leading-[1.1] flex flex-col">
                <span>Impossible?</span>
                <span className="text-foreground">Possible.</span>
              </h1>
              <p className="text-xl sm:text-2xl text-muted-foreground font-light max-w-md">
                The AI for problem solvers. Discover, compare, and master the tools of tomorrow.
              </p>
            </motion.div>
          </div>

          {/* Auth Box - Bottom Left */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-md bg-card border border-border/50 rounded-2xl p-6 sm:p-8 shadow-2xl mb-8 lg:mb-0"
          >
            <div className="space-y-3 mb-6">
              <Button
                variant="outline"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full h-11 text-base font-normal justify-center gap-2 relative bg-transparent hover:bg-muted/50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </Button>
              <Button
                variant="outline"
                onClick={handleGitHubAuth}
                disabled={isLoading}
                className="w-full h-11 text-base font-normal justify-center gap-2 bg-transparent hover:bg-muted/50"
              >
                <Github className="w-5 h-5" />
                Continue with GitHub
              </Button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div className="mb-4 text-center">
              <h2 className="text-xl font-semibold mb-1">
                {mode === "signin" ? "Welcome Back" : "Create Account"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === "signin" ? "Sign in to continue" : "Sign up to get started"}
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="h-11 bg-background/50 border-border/50"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-11 bg-background/50 border-border/50"
                  disabled={isLoading}
                  minLength={6}
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 text-base font-medium shadow-lg transition-all duration-300 hover:scale-[1.02]"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                ) : (
                  mode === "signin" ? "Sign In" : "Sign Up"
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              {mode === "signin" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup")
                      setError(null)
                    }}
                    className="text-primary hover:underline"
                    disabled={isLoading}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin")
                      setError(null)
                    }}
                    className="text-primary hover:underline"
                    disabled={isLoading}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Browser Animation */}
        <div className="flex-1 relative h-[40vh] lg:h-auto bg-muted/30 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10" />
          <BrowserSearchAnimation />
        </div>
      </section>

      {/* Frame 2: Features */}
      <section className="h-screen w-full snap-start snap-always flex items-center justify-center bg-muted/20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Why Arcyn Find?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The most powerful discovery engine for the AI era.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: "Lightning Fast",
                desc: "Instant results powered by edge computing.",
              },
              {
                icon: Shield,
                title: "Verified Tools",
                desc: "Every tool is manually tested and verified.",
              },
              {
                icon: Globe,
                title: "Global Community",
                desc: "Join thousands of developers worldwide.",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.2 }}
                className="bg-card border border-border/50 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Frame 3: Stats */}
      <section className="h-screen w-full snap-start snap-always flex items-center justify-center bg-background relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl md:text-6xl font-bold mb-8 leading-tight flex flex-col">
                <span>Trusted by</span>
                <span className="text-primary">Innovators</span>
                <span>Everywhere</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Join the fastest growing community of AI enthusiasts and developers.
              </p>
              <Button size="lg" className="gap-2">
                View Community <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>

            <div className="grid grid-cols-2 gap-6">
              {[
                { label: "Active Users", value: "50K+" },
                { label: "AI Tools", value: "2,000+" },
                { label: "Daily Searches", value: "150K+" },
                { label: "Countries", value: "120+" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-muted/30 p-8 rounded-2xl text-center"
                >
                  <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
                  <div className="text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Frame 4: CTA */}
      <section className="h-screen w-full snap-start snap-always flex items-center justify-center bg-primary/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <h2 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight">Ready to start?</h2>
            <p className="text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Join Arcyn Find today and discover the tools that will power your next big idea.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-14 px-8 text-lg rounded-full" onClick={() => router.push("/onboarding")}>
                Get Started Now
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full bg-background/50">
                Explore Tools
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
