"use client"

import { motion } from "framer-motion"
import { ChevronDown, HelpCircle, GraduationCap, Code } from "lucide-react"
import { useState } from "react"

interface FilterBarProps {
  onCategoryChange: (category: string) => void
  onRegionChange: (region: string) => void
  onAccessTypeChange: (type: string) => void
  selectedCategory: string
  selectedRegion: string
  selectedAccessType: string
}

// Developer category mapping: Display name -> Internal category name
// For developers, we show the actual technical category names
const developerCategoryMap: Record<string, string> = {
  "All": "",
  "Generative AI": "Generative AI",
  "Computer Vision": "Computer Vision",
  "Audio/NLP": "Audio/NLP",
  "Code Generation": "Code Generation",
  "Learning & Education": "Learning & Education",
  "Video Generation": "Video Generation",
  "Search/QA": "Search/QA",
  "Multimodal Platform": "Multimodal Platform",
  "Autonomous AI": "Autonomous AI",
  "Audio/Video Processing": "Audio/Video Processing",
  "NLP Platform": "NLP Platform",
  "ML Infrastructure": "ML Infrastructure",
}

// Student-friendly category mapping
const studentCategoryMap: Record<string, string> = {
  "All": "",
  "Chat & Study Help": "Generative AI",
  "Images & Art": "Computer Vision",
  "Voice & Music": "Audio/NLP",
  "Coding Help": "Code Generation",
  "Study Tools": "Learning & Education",
  "Video Creation": "Video Generation",
  "Research & Answers": "Search/QA",
  "Multi-Purpose Tools": "Multimodal Platform",
  "Task Automation": "Autonomous AI",
  "Media Editing": "Audio/Video Processing",
  "Language Learning": "NLP Platform",
  "Tech & Development": "ML Infrastructure",
}

// Reverse mapping for display (developer)
const reverseDeveloperCategoryMap: Record<string, string> = Object.fromEntries(
  Object.entries(developerCategoryMap).map(([display, internal]) => [internal, display])
)

// Reverse mapping for display (student)
const reverseStudentCategoryMap: Record<string, string> = Object.fromEntries(
  Object.entries(studentCategoryMap).map(([display, internal]) => [internal, display])
)

// Developer category descriptions for tooltips
const developerCategoryDescriptions: Record<string, string> = {
  "Generative AI": "Large language models, text generation, conversational AI (GPT, Claude, Gemini)",
  "Computer Vision": "Image generation, object detection, visual recognition (DALL-E, Midjourney, YOLO)",
  "Audio/NLP": "Speech-to-text, text-to-speech, audio processing, voice synthesis",
  "Code Generation": "AI code assistants, autocomplete, pair programming (GitHub Copilot, Cursor)",
  "Learning & Education": "Educational tools, tutoring, study aids, learning platforms",
  "Video Generation": "AI video creation, editing, synthesis (Runway, Pika Labs, Synthesia)",
  "Search/QA": "Question answering, semantic search, information retrieval",
  "Multimodal Platform": "Tools handling multiple media types (text, image, video, audio)",
  "Autonomous AI": "AI agents, autonomous systems, workflow automation",
  "Audio/Video Processing": "Media editing, transcription, multimedia processing",
  "NLP Platform": "Natural language processing APIs, text analysis, language models",
  "ML Infrastructure": "MLOps, model hosting, APIs, infrastructure tools",
}

// Student-friendly category descriptions
const studentCategoryDescriptions: Record<string, string> = {
  "Chat & Study Help": "AI chatbots like ChatGPT to help with homework, essays, and studying",
  "Images & Art": "Create images, edit photos, make art for projects and presentations",
  "Voice & Music": "Voice assistants, transcribe lectures, generate music for projects",
  "Coding Help": "Get help with programming assignments and coding projects",
  "Study Tools": "Flashcards, tutors, note-taking, homework help, and learning platforms",
  "Video Creation": "Make videos for presentations, projects, and social media",
  "Research & Answers": "Find information, answer questions, research papers and articles",
  "Multi-Purpose Tools": "Tools that can do multiple things (text, images, videos)",
  "Task Automation": "Automate repetitive tasks and save time on assignments",
  "Media Editing": "Edit audio and video files for projects and presentations",
  "Language Learning": "Learn new languages, translate text, improve writing",
  "Tech & Development": "Advanced tools for tech projects and development work",
}

const regions = ["All", "USA", "EU", "Canada", "China", "Israel", "UAE", "Global"]
const accessTypes = ["All", "Free", "Freemium", "Paid"]

export function FilterBar({
  onCategoryChange,
  onRegionChange,
  onAccessTypeChange,
  selectedCategory,
  selectedRegion,
  selectedAccessType,
}: FilterBarProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"student" | "developer">("developer")
  
  // Get current category map and descriptions based on view mode
  const categoryMap = viewMode === "student" ? studentCategoryMap : developerCategoryMap
  const reverseCategoryMap = viewMode === "student" ? reverseStudentCategoryMap : reverseDeveloperCategoryMap
  const categoryDescriptions = viewMode === "student" ? studentCategoryDescriptions : developerCategoryDescriptions
  const displayCategories = Object.keys(categoryMap)
  
  // Convert internal category to display name
  const displaySelectedCategory = selectedCategory 
    ? (reverseCategoryMap[selectedCategory] || selectedCategory)
    : "All"
  
  const handleCategoryChange = (displayName: string) => {
    const internalCategory = categoryMap[displayName] || displayName
    onCategoryChange(internalCategory)
  }
  
  const toggleViewMode = () => {
    const newMode = viewMode === "student" ? "developer" : "student"
    setViewMode(newMode)
    // Reset category when switching views
    onCategoryChange("")
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2.5 sm:py-3 md:py-4">
        {/* View Mode Toggle */}
        <div className="flex items-center justify-between mb-2.5 sm:mb-3 pb-2.5 sm:pb-3 border-b border-border/30">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            <span className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground whitespace-nowrap">
              Category View:
            </span>
            <button
              onClick={toggleViewMode}
              className="relative inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-colors duration-150 text-[10px] sm:text-xs md:text-sm font-medium touch-manipulation flex-shrink-0"
              aria-label={`Switch to ${viewMode === "student" ? "Developer" : "Student"} view`}
            >
              {viewMode === "student" ? (
                <>
                  <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  <span className="hidden xs:inline">Student View</span>
                  <span className="xs:hidden">Student</span>
                </>
              ) : (
                <>
                  <Code className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  <span className="hidden xs:inline">Developer View</span>
                  <span className="xs:hidden">Developer</span>
                </>
              )}
            </button>
          </div>
          {viewMode === "student" && (
            <div className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block whitespace-nowrap">
              <HelpCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-0.5 sm:mr-1" />
              Student-friendly names
            </div>
          )}
        </div>
        
        {/* Mobile: Stack vertically, Desktop: Horizontal */}
        <div className="flex flex-col gap-2.5 sm:gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Category Filter */}
          <div className="flex flex-col gap-1 sm:gap-1.5 sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
            <label htmlFor="category-filter" className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground whitespace-nowrap">
              Category:
            </label>
            <div className="relative flex-1 sm:flex-initial group">
              <select
                id="category-filter"
                value={displaySelectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                onMouseEnter={() => setHoveredCategory(displaySelectedCategory)}
                onMouseLeave={() => setHoveredCategory(null)}
                className="w-full sm:w-auto appearance-none rounded-lg border border-border/50 bg-card/50 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-2 pr-8 sm:pr-10 text-base sm:text-sm text-foreground transition-colors duration-150 hover:bg-card focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 touch-manipulation"
              >
                {displayCategories.map((displayCat) => (
                  <option key={displayCat} value={displayCat}>
                    {displayCat}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 sm:right-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
              
              {/* Tooltip */}
              {hoveredCategory && categoryDescriptions[hoveredCategory] && (
                <div className="absolute left-0 top-full mt-2 z-50 hidden sm:block pointer-events-none">
                  <div className="bg-popover border border-border rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs text-popover-foreground shadow-lg max-w-xs">
                    <div className="flex items-start gap-1.5 sm:gap-2">
                      <HelpCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <span className="text-xs">{categoryDescriptions[hoveredCategory]}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Region Filter */}
          <div className="flex flex-col gap-1 sm:gap-1.5 sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
            <label htmlFor="region-filter" className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground whitespace-nowrap">
              Region:
            </label>
            <div className="relative flex-1 sm:flex-initial">
              <select
                id="region-filter"
                value={selectedRegion}
                onChange={(e) => onRegionChange(e.target.value)}
                className="w-full sm:w-auto appearance-none rounded-lg border border-border/50 bg-card/50 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-2 pr-8 sm:pr-10 text-base sm:text-sm text-foreground transition-colors duration-150 hover:bg-card focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 touch-manipulation"
              >
                {regions.map((reg) => (
                  <option key={reg} value={reg === "All" ? "" : reg}>
                    {reg}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 sm:right-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Access Type Filter */}
          <div className="flex flex-col gap-1 sm:gap-1.5 sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
            <label htmlFor="access-filter" className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground whitespace-nowrap">
              Access:
            </label>
            <div className="relative flex-1 sm:flex-initial">
              <select
                id="access-filter"
                value={selectedAccessType}
                onChange={(e) => onAccessTypeChange(e.target.value)}
                className="w-full sm:w-auto appearance-none rounded-lg border border-border/50 bg-card/50 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-2 pr-8 sm:pr-10 text-base sm:text-sm text-foreground transition-colors duration-150 hover:bg-card focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 touch-manipulation"
              >
                {accessTypes.map((type) => (
                  <option key={type} value={type === "All" ? "" : type}>
                    {type}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 sm:right-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
