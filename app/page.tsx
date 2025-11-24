"use client"

import type React from "react"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, useScroll } from "framer-motion"
import { CodesandboxIcon, ArrowRight, Zap, Shield, Globe, Instagram, Twitter, Heart, Linkedin, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { usePreferences } from "@/contexts/preferences-context"
import { BrowserSearchAnimation } from "@/components/browser-search-animation"
import { useAuth } from "@clerk/nextjs"

export default function LandingPage() {
  const router = useRouter()
  const { preferences } = usePreferences()
  const { isSignedIn, isLoaded } = useAuth()
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

  // Redirect authenticated users
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/home')
    }
  }, [isLoaded, isSignedIn, router])

  return (
    <div ref={containerRef} className="min-h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-background text-foreground scroll-smooth">
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
      <section className="min-h-screen w-full snap-start snap-always relative flex flex-col lg:flex-row pt-16 sm:pt-20 lg:pt-24 overflow-hidden z-0 pb-8 sm:pb-0">
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
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground font-light max-w-lg leading-relaxed">
                Discover, compare, and master the tools of tomorrow.
              </p>
            </motion.div>

            {/* Auth Box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full max-w-sm mx-auto lg:mx-0 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 sm:p-5 md:p-6 shadow-xl"
            >
              <div className="mb-4 text-center">
                <h2 className="text-lg sm:text-xl font-semibold mb-1">Get Started</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Sign in or create an account to continue
                </p>
              </div>

              <div className="space-y-2.5 sm:space-y-3">
                <Button
                  onClick={() => router.push('/sign-in')}
                  className="w-full h-12 sm:h-11 text-sm sm:text-base font-medium shadow-lg transition-all duration-300 active:scale-[0.98]"
                >
                  Sign In
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/sign-up')}
                  className="w-full h-12 sm:h-11 text-sm sm:text-base font-normal bg-transparent hover:bg-muted/50 active:scale-[0.98]"
                >
                  Create Account
                </Button>
              </div>

              <div className="mt-3 sm:mt-4 text-center text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Column: Browser Animation */}
        <div className="flex-1 relative min-h-[40vh] sm:min-h-[50vh] lg:min-h-screen bg-gradient-to-br from-muted/20 via-muted/10 to-transparent flex items-center justify-center overflow-visible lg:border-l border-border/30">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-transparent" />
          <div className="relative z-10 w-full h-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <BrowserSearchAnimation />
          </div>
        </div>
      </section>

      {/* Frame 2: Features */}
      <section className="min-h-screen w-full snap-start snap-always flex items-center justify-center bg-muted/20 relative overflow-hidden py-12 sm:py-16">
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
      <section className="min-h-screen w-full snap-start snap-always flex items-center justify-center bg-background relative py-12 sm:py-16">
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
                { label: "AI Tools", value: "2,000+" },
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
      <section className="min-h-screen w-full snap-start snap-always flex items-center justify-center bg-gradient-to-br from-primary/10 via-muted/20 to-background relative overflow-hidden py-12 sm:py-16">
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
      <section className="min-h-screen w-full snap-start snap-always flex items-center justify-center bg-primary/5 relative overflow-hidden py-12 sm:py-16">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 sm:mb-8 tracking-tight">Ready to start?</h2>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-8 sm:mb-10 md:mb-12 max-w-2xl mx-auto px-4">
              Join Arcyn Find today and discover the tools that will power your next big idea.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button size="lg" className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base md:text-lg rounded-full w-full sm:w-auto active:scale-[0.98]" onClick={() => router.push("/sign-up")}>
                Get Started Now
              </Button>
              <Button size="lg" variant="outline" className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base md:text-lg rounded-full bg-background/50 w-full sm:w-auto active:scale-[0.98]" onClick={() => router.push("/home")}>
                Explore Tools
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Frame 5: Footer/Contact */}
      <section className="min-h-screen w-full snap-start snap-always flex items-center justify-center bg-background relative overflow-hidden py-12 sm:py-16">
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
                  <a href="https://instagram.com/arcyn.x" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
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
