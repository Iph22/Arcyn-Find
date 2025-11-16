"use client"

import { motion } from "framer-motion"
import { ArrowLeft, Sparkles, Search, Filter, Heart, GitCompare, Keyboard, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"

export default function AboutPage() {
    const router = useRouter()

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Theme Toggle */}
            <div className="fixed top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <div className="mx-auto max-w-4xl px-3 sm:px-4 py-6 sm:py-8 md:py-12">
                {/* Back Button */}
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => router.back()}
                    className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                    <span>Back</span>
                </motion.button>

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
                        <h1 className="mb-3 text-4xl font-bold text-foreground md:text-5xl">About Arcyn Find</h1>
                        <p className="text-lg text-muted-foreground">
                            Your comprehensive guide to discovering AI tools worldwide
                        </p>
                    </div>

                    {/* Documentation Section */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-semibold text-foreground">Documentation Guide</h2>

                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Search */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-6"
                            >
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20">
                                    <Search className="h-6 w-6 text-accent" />
                                </div>
                                <h3 className="mb-2 text-lg font-semibold text-foreground">Smart Search</h3>
                                <p className="mb-3 text-sm text-muted-foreground">
                                    Use natural language queries or advanced operators to find exactly what you need.
                                </p>
                                <div className="space-y-2 text-xs text-muted-foreground">
                                    <p><strong>Natural Language:</strong> "I want an AI to edit my video"</p>
                                    <p><strong>Operators:</strong></p>
                                    <ul className="ml-4 list-disc space-y-1">
                                        <li><code className="bg-muted px-1 py-0.5 rounded">tag:api</code> - Filter by tag</li>
                                        <li><code className="bg-muted px-1 py-0.5 rounded">category:vision</code> - Filter by category</li>
                                        <li><code className="bg-muted px-1 py-0.5 rounded">region:global</code> - Filter by region</li>
                                        <li><code className="bg-muted px-1 py-0.5 rounded">access:free</code> - Filter by access type</li>
                                    </ul>
                                </div>
                            </motion.div>

                            {/* Filters */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-6"
                            >
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20">
                                    <Filter className="h-6 w-6 text-accent" />
                                </div>
                                <h3 className="mb-2 text-lg font-semibold text-foreground">Filter & Explore</h3>
                                <p className="mb-3 text-sm text-muted-foreground">
                                    Narrow down your search using multiple filter options.
                                </p>
                                <div className="space-y-2 text-xs text-muted-foreground">
                                    <p><strong>Categories:</strong> Vision, NLP, Audio, Code, and more</p>
                                    <p><strong>Regions:</strong> Global, US, EU, Asia, etc.</p>
                                    <p><strong>Access Types:</strong> Free, Freemium, Paid</p>
                                </div>
                            </motion.div>

                            {/* Favorites */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-6"
                            >
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20">
                                    <Heart className="h-6 w-6 text-accent" />
                                </div>
                                <h3 className="mb-2 text-lg font-semibold text-foreground">Save Favorites</h3>
                                <p className="text-sm text-muted-foreground">
                                    Click the heart icon on any AI tool card to save it to your favorites. Your favorites are stored locally in your browser and persist across sessions.
                                </p>
                            </motion.div>

                            {/* Compare */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-6"
                            >
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20">
                                    <GitCompare className="h-6 w-6 text-accent" />
                                </div>
                                <h3 className="mb-2 text-lg font-semibold text-foreground">Compare Tools</h3>
                                <p className="text-sm text-muted-foreground">
                                    Select up to 3 AI tools using the compare icon to view them side-by-side. Compare features, pricing, and capabilities to make informed decisions.
                                </p>
                            </motion.div>
                        </div>

                        {/* Keyboard Shortcuts */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                            className="rounded-lg border border-border/50 bg-muted/30 p-6"
                        >
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20">
                                <Keyboard className="h-6 w-6 text-accent" />
                            </div>
                            <h3 className="mb-3 text-lg font-semibold text-foreground">Keyboard Shortcuts</h3>
                            <div className="grid gap-3 md:grid-cols-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Focus Search</span>
                                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">/</kbd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Clear Focus</span>
                                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">Esc</kbd>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Category Guide Section */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-semibold text-foreground">Category Guide</h2>
                        <p className="text-muted-foreground">
                            Not sure which category to choose? Here's what each category includes:
                        </p>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <h3 className="mb-2 font-semibold text-foreground">📝 Chat & Writing</h3>
                                <p className="text-sm text-muted-foreground">
                                    ChatGPT, Claude, writing assistants, content creation tools. Perfect for essays, articles, and creative writing.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.85 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <h3 className="mb-2 font-semibold text-foreground">🖼️ Images & Visual</h3>
                                <p className="text-sm text-muted-foreground">
                                    Image generation, photo editing, DALL-E, Midjourney. Create and edit images, art, and visual content.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.9 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <h3 className="mb-2 font-semibold text-foreground">🎤 Voice & Audio</h3>
                                <p className="text-sm text-muted-foreground">
                                    Voice assistants, speech-to-text, music generation. Convert speech, create music, and work with audio.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.95 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <h3 className="mb-2 font-semibold text-foreground">💻 Coding & Programming</h3>
                                <p className="text-sm text-muted-foreground">
                                    Code assistants, GitHub Copilot, programming help. Get help with coding, debugging, and software development.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.0 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <h3 className="mb-2 font-semibold text-foreground">🎓 Learning & Education</h3>
                                <p className="text-sm text-muted-foreground">
                                    Study tools, tutors, homework help, learning platforms. Khan Academy, Duolingo, research tools, and more.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.05 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <h3 className="mb-2 font-semibold text-foreground">🎬 Video Tools</h3>
                                <p className="text-sm text-muted-foreground">
                                    Video creation, editing, Runway, Pika Labs. Create, edit, and enhance videos for projects and presentations.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.1 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <h3 className="mb-2 font-semibold text-foreground">🔍 Search & Research</h3>
                                <p className="text-sm text-muted-foreground">
                                    Research tools, Q&A systems, Perplexity, academic search. Find information and answer questions quickly.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.15 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <h3 className="mb-2 font-semibold text-foreground">🎨 Multi-Media Tools</h3>
                                <p className="text-sm text-muted-foreground">
                                    Tools that handle multiple media types (text, image, video). Unified platforms for diverse content creation.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.2 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <h3 className="mb-2 font-semibold text-foreground">🤖 AI Automation</h3>
                                <p className="text-sm text-muted-foreground">
                                    AI agents, workflow automation, task automation. Automate repetitive tasks and workflows.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.25 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <h3 className="mb-2 font-semibold text-foreground">🎵 Media Processing</h3>
                                <p className="text-sm text-muted-foreground">
                                    Audio/video processing, multimedia editing. Process and enhance media files.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.3 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <h3 className="mb-2 font-semibold text-foreground">🌐 Language Tools</h3>
                                <p className="text-sm text-muted-foreground">
                                    Natural language processing, text analysis platforms. Advanced language understanding and processing.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.35 }}
                                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                            >
                                <h3 className="mb-2 font-semibold text-foreground">⚙️ Developer Tools</h3>
                                <p className="text-sm text-muted-foreground">
                                    ML infrastructure, APIs, model hosting, MLOps. Tools for developers and data scientists.
                                </p>
                            </motion.div>
                        </div>
                    </div>

                    {/* Creators & Partners Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="rounded-lg border border-border/50 bg-gradient-to-br from-accent/10 to-accent/5 p-6"
                    >
                        <h2 className="mb-4 text-2xl font-semibold text-foreground">Created With Love By</h2>
                        <div className="space-y-4">
                            {/* Creator */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <p className="text-lg font-medium text-foreground">David Iphy</p>
                                    <p className="text-sm text-muted-foreground">Developer & Creator</p>
                                </div>
                                <a
                                    href="https://22-bio.vercel.app/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-all hover:bg-accent/90 hover:shadow-lg"
                                >
                                    Visit Portfolio
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            </div>

                            {/* Partners Section */}
                            <div className="pt-4 border-t border-border/50">
                                <h3 className="mb-3 text-base font-semibold text-foreground">Partnered With</h3>
                                <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div>
                                            <p className="font-medium text-foreground">Christian Tetteh</p>
                                        </div>
                                        <a
                                            href="https://www.instagram.com/chriso_lega/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                                        >
                                            @chriso_lega
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div>
                                            <p className="font-medium text-foreground">Fadila Abubakar</p>
                                        </div>
                                        <a
                                            href="https://www.instagram.com/girllike_.dilah/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                                        >
                                            @girllike_.dilah
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Social Links */}
                            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border/50">
                                <span className="text-sm text-muted-foreground">Follow us:</span>
                                <a
                                    href="https://www.instagram.com/iphy._/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                                >
                                    @iphy._
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                                <span className="text-muted-foreground">•</span>
                                <a
                                    href="https://instagram.com/arcyn.x"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                                >
                                    @arcyn.x
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>

            <Footer />
        </div>
    )
}

