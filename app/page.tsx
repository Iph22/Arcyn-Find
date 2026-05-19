"use client"

import type React from "react"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, useScroll } from "framer-motion"
import { CodesandboxIcon, ArrowRight, Zap, Shield, Globe, Instagram, Twitter, Heart, Linkedin, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"

const ThemeToggle = dynamic(() => import("@/components/theme-toggle").then(mod => mod.ThemeToggle), { ssr: false })
const BrowserSearchAnimation = dynamic(() => import("@/components/browser-search-animation").then(mod => mod.BrowserSearchAnimation), { ssr: false })
import { supabase } from "@/lib/supabase"
import { usePreferences } from "@/contexts/preferences-context"
import { useAuth } from "@/contexts/auth-context"

// Google icon component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const { preferences } = usePreferences()
  const { isAuthenticated, isLoading, signIn } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [toolCount, setToolCount] = useState<number>(0)

  // Ensure ref is attached to DOM before using useScroll
  useLayoutEffect(() => {
    if (containerRef.current) {
      setIsReady(true)
    }
  }, [])

  // Fetch tool count on mount
  useEffect(() => {
    async function fetchCount() {
      try {
        const { count } = await supabase
          .from('ai_tools')
          .select('*', { count: 'exact', head: true })

        if (count) {
          setToolCount(count)
        }
      } catch (error) {
        console.error('Failed to fetch tool count:', error)
      }
    }

    fetchCount()
  }, [])

  // Use useScroll with proper hydration handling
  const { scrollYProgress } = useScroll({
    target: isReady ? containerRef : undefined,
    offset: ["start start", "end end"],
  })

  // Redirect authenticated users (but not for bots/crawlers)
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Check if this is a bot/crawler - don't redirect them
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      const isBot = /bot|googlebot|crawler|spider|robot|crawling|bingbot|slurp|duckduckbot|baidu|yandex|sogou|exabot|facebot|facebook|ia_archiver|inspection|google/i.test(userAgent)

      if (!isBot) {
        // Use replace to avoid preserving query params from Google search
        router.replace('/home')
      }
    }
  }, [isLoading, isAuthenticated, router])

  const handleSignIn = () => {
    signIn()
  }

  return (
    <div ref={containerRef} className="min-h-dvh w-full overflow-y-scroll snap-y snap-mandatory bg-background text-foreground scroll-smooth">
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
        <div className="mx-auto max-w-[1400px] px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CodesandboxIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              <span className="text-lg sm:text-xl font-bold tracking-tight">Arcyn Find</span>
            </div>
            <nav className="flex items-center gap-4 sm:gap-6">
              <ThemeToggle />
            </nav>
          </div>
        </div>
      </motion.header>

      {/* Frame 1: Hero & Auth */}
      <section className="min-h-dvh w-full snap-start snap-always relative flex flex-col lg:flex-row pt-16 sm:pt-20 lg:pt-24 overflow-hidden z-0 pb-8 sm:pb-0">
        {/* Left Column: Text & Auth */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 xl:px-12 py-6 sm:py-8 lg:py-12 z-10 relative max-w-lg lg:max-w-xl mx-auto lg:mx-0">
          <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-3 sm:space-y-4"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-serif font-medium tracking-tight leading-[1.1] flex flex-col">
                <span className="text-muted-foreground">Can't Find It?</span>
                <span className="text-foreground">Ask Arcyn.</span>
              </h1>
              <div className="flex flex-col gap-2">
                <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground font-light max-w-lg leading-relaxed">
                  Discover, compare, and master the tools of tomorrow.
                </p>
                {toolCount > 0 && (
                  <div className="inline-flex items-center gap-2 text-sm text-primary/80 font-medium animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    Searching across {toolCount.toLocaleString()}+ AI tools
                  </div>
                )}
              </div>
            </motion.div>

            {/* Auth Box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full max-w-sm mx-auto lg:mx-0 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 sm:p-5 md:p-6 shadow-xl"
            >
              <div className="mb-4 text-center">
                <h2 className="text-lg sm:text-xl font-semibold mb-1">Welcome</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Join the community or sign in to continue
                </p>
              </div>

              <div className="space-y-3">
                {/* Sign Up Button (Primary) */}
                <Button
                  onClick={handleSignIn}
                  className="w-full h-12 sm:h-11 text-sm sm:text-base font-medium shadow-lg transition-all duration-300 active:scale-[0.98] bg-primary hover:bg-primary/90 text-primary-foreground border-none"
                  variant="default"
                >
                  <GoogleIcon className="w-5 h-5 mr-3 fill-current" />
                  Sign Up with Google
                </Button>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Already have an account?</span>
                  </div>
                </div>

                {/* Sign In Button (Secondary) */}
                <Button
                  onClick={handleSignIn}
                  className="w-full h-12 sm:h-11 text-sm sm:text-base font-medium transition-all duration-300 active:scale-[0.98] bg-secondary/50 hover:bg-secondary text-secondary-foreground border border-border/50"
                  variant="outline"
                >
                  <GoogleIcon className="w-5 h-5 mr-3" />
                  Sign In
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => router.push('/tools')}
                  className="w-full h-12 sm:h-11 text-sm sm:text-base font-normal hover:bg-muted/50 active:scale-[0.98]"
                >
                  Explore Tools First
                </Button>
              </div>

              <div className="mt-3 sm:mt-4 text-center text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Column: Browser Animation */}
        <div className="flex-1 relative min-h-[40vh] sm:min-h-[50vh] lg:min-h-dvh bg-gradient-to-br from-muted/20 via-muted/10 to-transparent flex items-center justify-center overflow-visible lg:border-l border-border/30">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-transparent" />
          <div className="relative z-10 w-full h-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <BrowserSearchAnimation />
          </div>
        </div>
      </section>

      {/* Frame 2: Features */}
      <section className="min-h-dvh w-full snap-start snap-always flex items-center justify-center bg-muted/20 relative overflow-hidden py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8 sm:mb-12 md:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">Why Arcyn Find?</h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              The most powerful discovery engine for the AI era.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
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
                className="bg-card border border-border/50 p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 sm:mb-6 text-primary">
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">{feature.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Frame 3: Stats */}
      <section className="min-h-dvh w-full snap-start snap-always flex items-center justify-center bg-background relative py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 md:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center lg:text-left"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 sm:mb-8 leading-tight flex flex-col">
                <span>Trusted by</span>
                <span className="text-primary">Innovators</span>
                <span>Everywhere</span>
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8">
                Join the fastest growing community of AI enthusiasts and developers.
              </p>
              <Button size="lg" className="gap-2 h-12 sm:h-11 text-sm sm:text-base" onClick={() => router.push("/community")}>
                View Community <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
              {[
                { label: "Active Users", value: "50K+" },
                { label: "AI Tools", value: toolCount > 0 ? `${(Math.floor(toolCount / 100) / 10).toFixed(1)}K+` : "7K+" },
                { label: "Daily Searches", value: "150K+" },
                { label: "Countries", value: "120+" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-muted/30 p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl text-center"
                >
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-1 sm:mb-2">{stat.value}</div>
                  <div className="text-xs sm:text-sm md:text-base text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Frame 3.5: Appreciation */}
      <section className="min-h-dvh w-full snap-start snap-always flex items-center justify-center bg-gradient-to-br from-primary/10 via-muted/20 to-background relative overflow-hidden py-12 sm:py-16">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8 sm:mb-12"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/20 mb-4 sm:mb-6">
              <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-primary fill-primary" />
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4">With Gratitude</h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Built with passion and dedication by an amazing team
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12">
            {/* Creator & Designer */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl sm:rounded-2xl p-5 sm:p-6 md:p-8 shadow-xl"
            >
              <div className="text-center mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-bold mb-2">Creator & Designer</h3>
                <p className="text-base sm:text-lg text-primary font-semibold">David Iphy</p>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground text-center mb-4 sm:mb-6">
                The visionary behind Arcyn Find, bringing together design excellence and technical innovation.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-4">
                <a
                  href="https://22-bio.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 active:scale-[0.98] transition-colors text-xs sm:text-sm font-medium min-h-[44px]"
                >
                  <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Blog
                </a>
                <a
                  href="https://instagram.com/iphy._"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 active:scale-[0.98] transition-colors text-xs sm:text-sm font-medium min-h-[44px]"
                >
                  <Instagram className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Instagram
                </a>
                <a
                  href="https://linkedin.com/in/david-iphy-613189381/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 active:scale-[0.98] transition-colors text-xs sm:text-sm font-medium min-h-[44px]"
                >
                  <Linkedin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  LinkedIn
                </a>
              </div>
            </motion.div>

            {/* Special Thanks */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl sm:rounded-2xl p-5 sm:p-6 md:p-8 shadow-xl"
            >
              <div className="text-center mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-bold mb-2">Special Thanks</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">For Marketing & Creative Thought</p>
              </div>
              <div className="space-y-4 sm:space-y-6">
                <div className="text-center">
                  <p className="font-semibold text-base sm:text-lg mb-2">Christian Tetteh</p>
                  <a
                    href="https://instagram.com/chriso_lega"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 active:scale-[0.98] transition-colors text-xs sm:text-sm font-medium min-h-[44px]"
                  >
                    <Instagram className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    @chriso_lega
                  </a>
                </div>
                <div className="border-t border-border/50 pt-4 sm:pt-6 text-center">
                  <p className="font-semibold text-base sm:text-lg mb-2">Fadila Abubakar</p>
                  <a
                    href="https://www.instagram.com/girllike_.dilah/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 active:scale-[0.98] transition-colors text-xs sm:text-sm font-medium min-h-[44px]"
                  >
                    <Instagram className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    @girllike_.dilah
                  </a>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center"
          >
            <p className="text-muted-foreground italic">
              "Peace fuels my rhythm. Precision builds my dream."
            </p>
            <p className="text-sm text-muted-foreground/70 mt-2">— David Iphy</p>
          </motion.div>
        </div>
      </section>

      {/* Frame 4: CTA */}
      <section className="min-h-dvh w-full snap-start snap-always flex items-center justify-center bg-primary/5 relative overflow-hidden py-12 sm:py-16">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 sm:mb-8 tracking-tight">Ready to start?</h2>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-8 sm:mb-10 md:mb-12 max-w-2xl mx-auto px-4">
              Join Arcyn Find today and discover the tools that will power your next big idea.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button
                size="lg"
                className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base md:text-lg rounded-full w-full sm:w-auto active:scale-[0.98]"
                onClick={handleSignIn}
              >
                <GoogleIcon className="w-5 h-5 mr-2" />
                Get Started with Google
              </Button>
              <Button size="lg" variant="outline" className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base md:text-lg rounded-full bg-background/50 w-full sm:w-auto active:scale-[0.98]" onClick={() => {
                // Navigate to tools page (public, no auth required for guests)
                router.push("/tools")
              }}>
                Explore Tools
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Frame 5: Footer/Contact */}
      <section className="min-h-dvh w-full snap-start snap-always flex items-center justify-center bg-background relative overflow-hidden py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8 sm:mb-10 md:mb-12"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">Get in Touch</h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Have questions? We'd love to hear from you.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-10 md:mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-center"
            >
              <h3 className="text-lg font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <a href="/contact" className="hover:text-primary transition-colors min-h-[44px] flex items-center justify-center">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="mailto:arcynflow@gmail.com" className="hover:text-primary transition-colors min-h-[44px] flex items-center justify-center break-all">
                    arcynflow@gmail.com
                  </a>
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center"
            >
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <a href="/privacy" className="hover:text-primary transition-colors min-h-[44px] flex items-center justify-center">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/terms" className="hover:text-primary transition-colors min-h-[44px] flex items-center justify-center">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center"
            >
              <h3 className="text-lg font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <a href="/community" className="hover:text-primary transition-colors min-h-[44px] flex items-center justify-center">
                    Community
                  </a>
                </li>
                <li>
                  <a href="/home" className="hover:text-primary transition-colors min-h-[44px] flex items-center justify-center">
                    Browse Tools
                  </a>
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-center"
            >
              <h3 className="text-lg font-semibold mb-4">Connect</h3>
              <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <a href="/about" className="hover:text-primary transition-colors min-h-[44px] flex items-center justify-center">
                    About Us
                  </a>
                </li>
                <li className="flex items-center justify-center gap-2 min-h-[44px]">
                  <Instagram className="w-4 h-4" />
                  <a href="https://instagram.com/arcynfind" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    Instagram
                  </a>
                </li>
                <li className="flex items-center justify-center gap-2 min-h-[44px]">
                  <Twitter className="w-4 h-4" />
                  <a href="https://x.com/Arcyn_x" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    X (Twitter)
                  </a>
                </li>
              </ul>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-center pt-6 sm:pt-8 border-t border-border"
          >
            <p className="text-xs sm:text-sm text-muted-foreground">
              © {new Date().getFullYear()} Arcyn Find. All rights reserved.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
