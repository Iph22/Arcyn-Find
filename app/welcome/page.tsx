"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Search, Filter, Heart, GitCompare, Sparkles, ArrowRight, Keyboard } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

const WELCOME_MODAL_KEY = 'arcyn-find-welcome-seen'
const WELCOME_SESSION_KEY = 'arcyn-find-welcome-session'

export default function WelcomePage() {
    const router = useRouter()
    const [dontShowAgain, setDontShowAgain] = useState(false)

    const handleGetStarted = () => {
        if (typeof window !== 'undefined') {
            if (dontShowAgain) {
                // Permanent: Store in localStorage
                localStorage.setItem(WELCOME_MODAL_KEY, 'true')
            } else {
                // Temporary: Store in sessionStorage (clears when browser closes)
                sessionStorage.setItem(WELCOME_SESSION_KEY, 'true')
            }
        }
        router.push('/')
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Theme Toggle */}
            <div className="fixed top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            {/* Main Content */}
            <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-8"
                >
                    {/* Header */}
                    <div className="text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring" }}
                            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/20"
                        >
                            <Sparkles className="h-10 w-10 text-accent" />
                        </motion.div>
                        <h1 className="mb-3 text-4xl font-bold text-foreground md:text-5xl">Welcome to Arcyn Find!</h1>
                        <p className="text-lg text-muted-foreground">
                            Your gateway to discovering AI tools worldwide
                        </p>
                    </div>

                    {/* How to Use Section */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-semibold text-foreground">How to Use</h2>

                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Search */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="flex gap-4 rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-accent/20">
                                    <Search className="h-6 w-6 text-accent" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="mb-2 font-semibold text-foreground">Smart Search</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Type natural language queries like "I want an AI to edit my video" or use advanced operators like <code className="text-xs bg-muted px-1 py-0.5 rounded">tag:api</code> or <code className="text-xs bg-muted px-1 py-0.5 rounded">category:vision</code>
                                    </p>
                                </div>
                            </motion.div>

                            {/* Filters */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="flex gap-4 rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-accent/20">
                                    <Filter className="h-6 w-6 text-accent" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="mb-2 font-semibold text-foreground">Filter & Explore</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Use category, region, and access type filters to narrow down your search. Categories use student-friendly names like "Chat & Writing" and "Learning & Education". Hover over categories for descriptions. Click any card to view detailed information.
                                    </p>
                                </div>
                            </motion.div>

                            {/* Favorites */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="flex gap-4 rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-accent/20">
                                    <Heart className="h-6 w-6 text-accent" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="mb-2 font-semibold text-foreground">Save Favorites</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Click the heart icon on any AI tool card to save it to your favorites for quick access later.
                                    </p>
                                </div>
                            </motion.div>

                            {/* Compare */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                className="flex gap-4 rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-accent/20">
                                    <GitCompare className="h-6 w-6 text-accent" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="mb-2 font-semibold text-foreground">Compare Tools</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Click the compare icon on cards to add up to 3 tools for side-by-side comparison.
                                    </p>
                                </div>
                            </motion.div>
                        </div>

                        {/* Keyboard Shortcuts */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                            className="flex gap-4 rounded-lg border border-border/50 bg-muted/30 p-4"
                        >
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-accent/20">
                                <Keyboard className="h-6 w-6 text-accent" />
                            </div>
                            <div className="flex-1">
                                <h3 className="mb-2 font-semibold text-foreground">Keyboard Shortcuts</h3>
                                <p className="text-sm text-muted-foreground">
                                    Press <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">/</kbd> to focus search, <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">Esc</kbd> to clear focus.
                                </p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Creators Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="rounded-lg border border-border/50 bg-gradient-to-br from-accent/10 to-accent/5 p-6"
                    >
                        <h2 className="mb-4 text-2xl font-semibold text-foreground">Created With Love By</h2>
                        <div className="space-y-4">
                            {/* Creator */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-lg font-medium text-foreground">David Iphy</p>
                                    <p className="text-sm text-muted-foreground">Developer & Creator</p>
                                </div>
                                <a
                                    href="https://22-bio.vercel.app/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-all hover:bg-accent/90 hover:shadow-lg"
                                >
                                    Visit Portfolio
                                    <ArrowRight className="ml-2 inline h-4 w-4" />
                                </a>
                            </div>

                            {/* Partners Section */}
                            <div className="pt-4 border-t border-border/50">
                                <h3 className="mb-3 text-base font-semibold text-foreground">Partnered With</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-foreground">Christian Tetteh</p>
                                        </div>
                                        <a
                                            href="https://www.instagram.com/chriso_lega/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm font-medium text-accent hover:underline"
                                        >
                                            @chriso_lega
                                        </a>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-foreground">Fadila Abubakar</p>
                                        </div>
                                        <a
                                            href="https://www.instagram.com/girllike_.dilah/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm font-medium text-accent hover:underline"
                                        >
                                            @girllike_.dilah
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Social Links */}
                            <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                                <span className="text-sm text-muted-foreground">Follow us:</span>
                                <a
                                    href="https://www.instagram.com/iphy._/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-accent hover:underline"
                                >
                                    @iphy._
                                </a>
                                <span className="text-muted-foreground">•</span>
                                <a
                                    href="https://instagram.com/arcyn.x"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-accent hover:underline"
                                >
                                    @arcyn.x
                                </a>
                            </div>
                        </div>
                    </motion.div>

                    {/* Footer Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 }}
                        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border/50 bg-card p-6"
                    >
                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                            <input
                                type="checkbox"
                                checked={dontShowAgain}
                                onChange={(e) => setDontShowAgain(e.target.checked)}
                                className="rounded border-border"
                            />
                            <span>Don't show this page again</span>
                        </label>
                        <button
                            onClick={handleGetStarted}
                            className="rounded-lg bg-accent px-8 py-3 text-base font-medium text-accent-foreground transition-all hover:bg-accent/90 hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                        >
                            Get Started
                            <ArrowRight className="h-5 w-5" />
                        </button>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    )
}

