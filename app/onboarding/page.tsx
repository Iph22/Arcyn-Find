"use client"

import { useState, useRef, useEffect, useLayoutEffect } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, ChevronDown, ArrowLeft, Code, GraduationCap, Briefcase, Palette, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePreferences } from "@/contexts/preferences-context"

// Define types locally since we can't import types easily in this environment
type UserRole = "developer" | "student" | "designer" | "business" | "enthusiast" | null

export default function OnboardingPage() {
  const router = useRouter()
  const { updatePreferences, logout } = usePreferences()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)

  // State for all questions
  const [role, setRole] = useState<UserRole>(null)
  const [purpose, setPurpose] = useState("")
  const [interests, setInterests] = useState<string[]>([])
  const [experience, setExperience] = useState("")

  // Ensure ref is attached to DOM before using useScroll
  useLayoutEffect(() => {
    if (containerRef.current) {
      setIsReady(true)
    }
  }, [])

  // Use useScroll with proper hydration handling
  const { scrollYProgress } = useScroll({
    container: isReady ? containerRef : undefined,
  })
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"])

  const handleComplete = () => {
    updatePreferences({
      userRole: role,
      purpose,
      categories: interests, // Mapping interests to categories
      level: experience,
      completed: true,
      timestamp: new Date().toISOString(),
    })
    router.push("/instructions")
  }

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div className="h-[100dvh] w-full bg-background text-foreground overflow-hidden relative">
      {/* Animated Background */}
      {isReady && (
        <motion.div style={{ y: backgroundY }} className="absolute inset-0 z-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_110%)]" />
        </motion.div>
      )}

      {/* Navigation */}
      <div className="absolute top-0 left-0 w-full z-50 p-4 sm:p-6 flex justify-between items-center bg-gradient-to-b from-background to-transparent">
        <Button
          variant="ghost"
          onClick={() => {
            logout()
            router.push("/")
          }}
          className="text-muted-foreground hover:text-foreground gap-2 text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to Home</span>
          <span className="sm:hidden">Back</span>
        </Button>

        <div className="flex gap-1 sm:gap-2">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-1 rounded-full transition-all duration-500 ${
                (step === 1 && role) ||
                (step === 2 && purpose) ||
                (step === 3 && interests.length > 0) ||
                (step === 4 && experience)
                  ? "w-4 sm:w-8 bg-primary"
                  : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Scroll Container */}
      <div ref={containerRef} className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar">
        {/* Section 1: Role */}
        <section
          id="section-1"
          className="h-[100dvh] w-full snap-start flex items-center justify-center p-4 sm:p-6 relative"
        >
          <div className="max-w-4xl w-full">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-8 sm:mb-12"
            >
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-chart-1">
                Who are you?
              </h2>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                Let's tailor the Arcyn experience to your background.
              </p>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto">
              {[
                { id: "developer", icon: Code, label: "Developer" },
                { id: "student", icon: GraduationCap, label: "Student" },
                { id: "designer", icon: Palette, label: "Designer" },
                { id: "business", icon: Briefcase, label: "Business" },
                { id: "enthusiast", icon: Heart, label: "Enthusiast" },
              ].map((item) => (
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setRole(item.id as UserRole)
                    setTimeout(() => scrollToSection("section-2"), 500)
                  }}
                  className={`p-4 sm:p-6 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 sm:gap-4 ${
                    role === item.id
                      ? "bg-primary/10 border-primary shadow-lg ring-1 ring-primary"
                      : "bg-card/50 border-border hover:bg-accent hover:border-accent-foreground/20"
                  }`}
                >
                  <item.icon
                    className={`w-6 h-6 sm:w-8 sm:h-8 ${role === item.id ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="font-medium text-base sm:text-lg">{item.label}</span>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground">
            <ChevronDown className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </section>

        {/* Section 2: Purpose */}
        <section
          id="section-2"
          className="h-[100dvh] w-full snap-start flex items-center justify-center p-4 sm:p-6 relative"
        >
          <div className="max-w-4xl w-full">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-8 sm:mb-12"
            >
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-chart-1 to-chart-2">
                What brings you here?
              </h2>
              <p className="text-lg sm:text-xl text-muted-foreground">We'll help you find exactly what you need.</p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
              {[
                { id: "work", title: "Work & Productivity", desc: "Automate tasks and boost efficiency" },
                { id: "creative", title: "Creative Projects", desc: "Generate art, music, and content" },
                { id: "learning", title: "Learning & Research", desc: "Expand knowledge and study better" },
                { id: "exploration", title: "Just Exploring", desc: "See what AI can do today" },
              ].map((item) => (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => {
                    setPurpose(item.id)
                    setTimeout(() => scrollToSection("section-3"), 500)
                  }}
                  className={`p-4 sm:p-6 rounded-2xl border cursor-pointer transition-all duration-300 ${
                    purpose === item.id
                      ? "bg-chart-1/10 border-chart-1 shadow-lg ring-1 ring-chart-1"
                      : "bg-card/50 border-border hover:bg-accent"
                  }`}
                >
                  <h3 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">{item.title}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Interests */}
        <section
          id="section-3"
          className="h-[100dvh] w-full snap-start flex items-center justify-center p-4 sm:p-6 relative"
        >
          <div className="max-w-4xl w-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-8 sm:mb-12"
            >
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-chart-2 to-chart-3">
                Pick your interests
              </h2>
              <p className="text-lg sm:text-xl text-muted-foreground">Select as many as you like.</p>
            </motion.div>

            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 max-w-3xl mx-auto">
              {["text", "vision", "coding", "agents", "automation", "knowledge", "research", "productivity"].map(
                (tag) => (
                  <motion.button
                    key={tag}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setInterests((prev) => (prev.includes(tag) ? prev.filter((i) => i !== tag) : [...prev, tag]))
                    }}
                    className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full border transition-all duration-300 capitalize text-sm sm:text-base ${
                      interests.includes(tag)
                        ? "bg-chart-2/20 border-chart-2 text-chart-2 shadow-lg"
                        : "bg-card/50 border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {tag}
                  </motion.button>
                ),
              )}
            </div>

            <div className="mt-8 sm:mt-12 text-center">
              <Button
                onClick={() => scrollToSection("section-4")}
                disabled={interests.length === 0}
                className="rounded-full px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg"
              >
                Continue <ChevronDown className="ml-2" />
              </Button>
            </div>
          </div>
        </section>

        {/* Section 4: Experience & Finish */}
        <section
          id="section-4"
          className="h-[100dvh] w-full snap-start flex items-center justify-center p-4 sm:p-6 relative"
        >
          <div className="max-w-4xl w-full">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-8 sm:mb-12"
            >
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-chart-3 to-chart-4">
                One last thing
              </h2>
              <p className="text-lg sm:text-xl text-muted-foreground">How familiar are you with AI tools?</p>
            </motion.div>

            <div className="space-y-3 sm:space-y-4 max-w-xl mx-auto mb-8 sm:mb-12">
              {[
                { id: "beginner", label: "Newbie", desc: "Just starting out" },
                { id: "intermediate", label: "Explorer", desc: "Used a few tools" },
                { id: "advanced", label: "Pro", desc: "Use AI daily" },
                { id: "expert", label: "Builder", desc: "I build AI tools" },
              ].map((item) => (
                <motion.div
                  key={item.id}
                  whileHover={{ x: 10 }}
                  onClick={() => setExperience(item.id)}
                  className={`p-3 sm:p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-all duration-300 ${
                    experience === item.id
                      ? "bg-chart-3/10 border-chart-3 ring-1 ring-chart-3"
                      : "bg-card/50 border-border hover:bg-accent"
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-base sm:text-lg">{item.label}</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  {experience === item.id && <Check className="text-chart-3 w-5 h-5 sm:w-6 sm:h-6" />}
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <Button
                onClick={handleComplete}
                disabled={!experience || !role || !purpose || interests.length === 0}
                className="bg-gradient-to-r from-primary to-chart-1 hover:from-primary/90 hover:to-chart-1/90 text-primary-foreground rounded-full px-8 sm:px-12 py-6 sm:py-8 text-lg sm:text-xl shadow-2xl transition-all duration-300 hover:scale-105 w-full sm:w-auto"
              >
                Start Your Journey <ArrowRight className="ml-2" />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
