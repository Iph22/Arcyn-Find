"use client"

import type React from "react"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, useScroll } from "framer-motion"
import { CodesandboxIcon, ArrowRight, Zap, Shield, Globe } from "lucide-react"
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
      <section className="min-h-screen w-full snap-start snap-always relative flex flex-col lg:flex-row pt-20 lg:pt-24 overflow-hidden z-0">
        {/* Left Column: Text & Auth */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 xl:px-12 py-8 lg:py-12 z-10 relative max-w-lg lg:max-w-xl">
          <div className="flex flex-col gap-6 lg:gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-serif font-medium tracking-tight leading-[1.1] flex flex-col">
                <span className="text-muted-foreground">Can't Find It?</span>
                <span className="text-foreground">Ask Arcyn.</span>
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground font-light max-w-lg leading-relaxed">
                Discover, compare, and master the tools of tomorrow.
              </p>
            </motion.div>

            {/* Auth Box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full max-w-sm bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 sm:p-6 shadow-xl"
            >
              <div className="mb-4 text-center">
                <h2 className="text-xl font-semibold mb-1">Get Started</h2>
                <p className="text-sm text-muted-foreground">
                  Sign in or create an account to continue
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => router.push('/sign-in')}
                  className="w-full h-11 text-base font-medium shadow-lg transition-all duration-300 hover:scale-[1.02]"
                >
                  Sign In
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/sign-up')}
                  className="w-full h-11 text-base font-normal bg-transparent hover:bg-muted/50"
                >
                  Create Account
                </Button>
              </div>

              <div className="mt-4 text-center text-xs text-muted-foreground">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Column: Browser Animation */}
        <div className="flex-1 relative min-h-[50vh] lg:min-h-screen bg-gradient-to-br from-muted/20 via-muted/10 to-transparent flex items-center justify-center overflow-visible lg:border-l border-border/30">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-transparent" />
          <div className="relative z-10 w-full h-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <BrowserSearchAnimation />
          </div>
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
              <Button size="lg" className="gap-2" onClick={() => router.push("/community")}>
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
              <Button size="lg" className="h-14 px-8 text-lg rounded-full" onClick={() => router.push("/sign-up")}>
                Get Started Now
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full bg-background/50" onClick={() => router.push("/home")}>
                Explore Tools
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Frame 5: Footer/Contact */}
      <section className="min-h-screen w-full snap-start snap-always flex items-center justify-center bg-background relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Get in Touch</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Have questions? We'd love to hear from you.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-center"
            >
              <h3 className="text-lg font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <a href="/contact" className="hover:text-primary transition-colors">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="mailto:support@arcyn-find.com" className="hover:text-primary transition-colors">
                    support@arcyn-find.com
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
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <a href="/privacy" className="hover:text-primary transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/terms" className="hover:text-primary transition-colors">
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
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <a href="/community" className="hover:text-primary transition-colors">
                    Community
                  </a>
                </li>
                <li>
                  <a href="/home" className="hover:text-primary transition-colors">
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
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <a href="/about" className="hover:text-primary transition-colors">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="https://github.com/Iph22/Arcyn-Find" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    GitHub
                  </a>
                </li>
              </ul>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-center pt-8 border-t border-border"
          >
            <p className="text-muted-foreground">
              © {new Date().getFullYear()} Arcyn Find. All rights reserved.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
