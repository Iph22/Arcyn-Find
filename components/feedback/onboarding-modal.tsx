"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, ArrowRight, ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface OnboardingModalProps {
  onComplete: () => void
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0)
  const [selectedPurpose, setSelectedPurpose] = useState<string[]>([])
  const [experienceLevel, setExperienceLevel] = useState(50)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [preferences, setPreferences] = useState({
    freeTools: true,
    openSource: false,
    collections: true,
    reviews: true,
    profiles: false,
    following: true,
    filters: true,
  })
  const [isLoading, setIsLoading] = useState(false)

  const purposes = [
    { id: "exploring", label: "Exploring AI tools", icon: "🔍" },
    { id: "work", label: "Finding tools for work", icon: "💼" },
    { id: "building", label: "Building a product", icon: "🚀" },
    { id: "research", label: "Research & learning", icon: "📚" },
    { id: "personal", label: "Personal projects", icon: "✨" },
  ]

  const interests = [
    "Text",
    "Vision",
    "Coding",
    "Agents",
    "Tools for work",
    "Automation",
    "Knowledge & search",
    "Research",
  ]

  const experienceLevels = ["Beginner", "Intermediate", "Advanced", "Expert"]

  const togglePurpose = (id: string) => {
    setSelectedPurpose((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) => (prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]))
  }

  const getExperienceLabel = () => {
    const index = Math.floor((experienceLevel / 100) * (experienceLevels.length - 1))
    return experienceLevels[index]
  }

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1)
    } else {
      handleFinish()
    }
  }

  const handleFinish = () => {
    setIsLoading(true)
    // Simulate loading and save preferences
    setTimeout(() => {
      localStorage.setItem("arcyn-onboarding-complete", "true")
      localStorage.setItem(
        "arcyn-preferences",
        JSON.stringify({
          purposes: selectedPurpose,
          experienceLevel: getExperienceLabel(),
          interests: selectedInterests,
          preferences,
        }),
      )
      onComplete()
    }, 2000)
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return selectedPurpose.length > 0
      case 3:
        return selectedInterests.length > 0
      default:
        return true
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-2xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
      >
        <Card className="overflow-hidden border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl">
          {/* Progress Bar */}
          <div className="h-1 bg-muted">
            <motion.div
              className="h-full bg-gradient-to-r from-primary via-chart-1 to-chart-3"
              initial={{ width: "0%" }}
              animate={{ width: `${((step + 1) / 6) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="p-8 md:p-12">
            <AnimatePresence mode="wait">
              {/* Step 0: Welcome */}
              {step === 0 && (
                <motion.div
                  key="step-0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="text-center"
                >
                  <motion.div
                    className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-1"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, repeatDelay: 1 }}
                  >
                    <Sparkles className="h-10 w-10 text-primary-foreground" />
                  </motion.div>
                  <h2 className="mb-4 text-3xl font-bold text-balance">Let's personalize Arcyn Find for you.</h2>
                  <p className="mb-8 text-lg text-muted-foreground text-balance">
                    Answer a few quick questions to get a tailored experience
                  </p>
                  <Button size="lg" onClick={handleNext} className="gap-2 px-8">
                    Start
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}

              {/* Step 1: Purpose */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="mb-2 text-2xl font-bold">Why are you here?</h2>
                  <p className="mb-6 text-muted-foreground">Select all that apply</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {purposes.map((purpose) => (
                      <motion.button
                        key={purpose.id}
                        onClick={() => togglePurpose(purpose.id)}
                        className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                          selectedPurpose.includes(purpose.id)
                            ? "border-primary bg-primary/10"
                            : "border-border/50 bg-card/50 hover:border-border hover:bg-accent"
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{purpose.icon}</span>
                          <span className="font-medium">{purpose.label}</span>
                        </div>
                        {selectedPurpose.includes(purpose.id) && (
                          <motion.div
                            className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Experience Level */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="mb-2 text-2xl font-bold">AI Experience Level</h2>
                  <p className="mb-8 text-muted-foreground">Help us understand your familiarity with AI tools</p>
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Beginner</span>
                        <span className="text-sm text-muted-foreground">Expert</span>
                      </div>
                      <Slider
                        value={[experienceLevel]}
                        onValueChange={(value) => setExperienceLevel(value[0])}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div className="text-center">
                      <Badge variant="secondary" className="px-6 py-2 text-base">
                        {getExperienceLabel()}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Interests */}
              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="mb-2 text-2xl font-bold">Interests</h2>
                  <p className="mb-6 text-muted-foreground">What types of AI tools interest you?</p>
                  <div className="flex flex-wrap gap-2">
                    {interests.map((interest) => (
                      <motion.button
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
                          selectedInterests.includes(interest)
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-card/50 text-foreground hover:bg-accent"
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {interest}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 4: Feature Preferences */}
              {step === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="mb-2 text-2xl font-bold">Feature Preferences</h2>
                  <p className="mb-6 text-muted-foreground">Customize your experience</p>
                  <div className="space-y-4">
                    {Object.entries(preferences).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-4"
                      >
                        <Label htmlFor={key} className="cursor-pointer text-base font-medium capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </Label>
                        <Switch
                          id={key}
                          checked={value}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, [key]: checked })}
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 5: Finish */}
              {step === 5 && (
                <motion.div
                  key="step-5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="text-center"
                >
                  {!isLoading ? (
                    <>
                      <motion.div
                        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-1"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
                      >
                        <Check className="h-10 w-10 text-primary-foreground" />
                      </motion.div>
                      <h2 className="mb-4 text-3xl font-bold text-balance">You're all set!</h2>
                      <p className="mb-8 text-lg text-muted-foreground text-balance">
                        Ready to explore AI tools personalized for you
                      </p>
                    </>
                  ) : (
                    <>
                      <motion.div
                        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-1"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                      >
                        <Sparkles className="h-10 w-10 text-primary-foreground" />
                      </motion.div>
                      <h2 className="mb-4 text-3xl font-bold text-balance">Your personalized feed is loading...</h2>
                      <p className="text-lg text-muted-foreground text-balance">This will only take a moment</p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            {step < 5 && (
              <div className="mt-8 flex items-center justify-between gap-4">
                <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-full transition-all ${
                        i === step ? "w-8 bg-primary" : i < step ? "bg-primary/50" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <Button onClick={handleNext} disabled={!canProceed()} className="gap-2">
                  {step === 4 ? "Finish" : "Next"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
