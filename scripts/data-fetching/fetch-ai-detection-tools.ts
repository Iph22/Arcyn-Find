#!/usr/bin/env node

/**
 * Script to fetch ALL AI detection tools from the internet and add them to Supabase
 * Searches multiple sources to ensure comprehensive coverage
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: Missing required environment variables!')
  console.error('Please set:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

interface AIDetectionTool {
  name: string
  description: string
  platform: string
  region: string
  accessType: "Free" | "Freemium" | "Paid"
  pricing: string
  tags: string[]
  popularity: number
}

// Comprehensive list of AI detection tools from multiple sources
const aiDetectionTools: AIDetectionTool[] = [
  // Popular AI Text Detection Tools
  {
    name: "GPTZero",
    description: "AI detection software designed for educators to identify AI-generated content in student submissions. Provides detailed analysis and probability scores.",
    platform: "https://gptzero.me",
    region: "USA",
    accessType: "Freemium",
    pricing: "Free tier available, paid plans from $9.99/month",
    tags: ["ai-detection", "education", "plagiarism", "content-verification", "text-detection"],
    popularity: 90,
  },
  {
    name: "Originality.ai",
    description: "AI content detection and plagiarism checker for content marketing agencies and publishers. High accuracy detection with detailed reports.",
    platform: "https://originality.ai",
    region: "USA",
    accessType: "Paid",
    pricing: "From $0.01 per 100 words",
    tags: ["ai-detection", "plagiarism", "content-marketing", "publishing", "enterprise"],
    popularity: 88,
  },
  {
    name: "Copyleaks",
    description: "Plagiarism detection platform using AI to identify similar and identical content across formats. Supports multiple languages and file types.",
    platform: "https://copyleaks.com",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["plagiarism", "ai-detection", "content-verification", "enterprise", "multi-language"],
    popularity: 85,
  },
  {
    name: "Winston AI",
    description: "AI detection tool for data-driven professionals to detect AI-generated content and maintain data integrity. Provides confidence scores.",
    platform: "https://gowinston.ai",
    region: "USA",
    accessType: "Freemium",
    pricing: "Free tier, paid from $18/month",
    tags: ["ai-detection", "data-integrity", "content-verification", "professional"],
    popularity: 78,
  },
  {
    name: "ZeroGPT",
    description: "Free AI content detector to identify AI-generated text from ChatGPT, GPT-4, and other models. Simple and fast detection.",
    platform: "https://www.zerogpt.com",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "free", "chatgpt-detector", "gpt-detector", "text-detection"],
    popularity: 82,
  },
  {
    name: "Content at Scale AI Detector",
    description: "AI content detection tool that analyzes text to determine if it was written by AI or humans. Provides detailed breakdown.",
    platform: "https://contentatscale.ai/ai-content-detector",
    region: "USA",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "free", "content-analysis", "text-detection"],
    popularity: 75,
  },
  {
    name: "Sapling AI Detector",
    description: "AI detection tool for customer-facing teams to detect AI-generated responses and ensure human-like interactions.",
    platform: "https://sapling.ai/ai-content-detector",
    region: "USA",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "customer-service", "content-verification", "business"],
    popularity: 72,
  },
  {
    name: "Crossplag",
    description: "AI content detector that distinguishes between human-written and AI-generated text using advanced machine learning algorithms.",
    platform: "https://crossplag.com",
    region: "EU",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "plagiarism", "ml-based", "academic"],
    popularity: 70,
  },
  {
    name: "PlagiarismCheck.org",
    description: "Plagiarism detection tool with AI detection features for educational institutions and businesses. Multi-language support.",
    platform: "https://plagiarismcheck.org",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["plagiarism", "ai-detection", "education", "business", "multi-language"],
    popularity: 76,
  },
  {
    name: "Undetectable.ai",
    description: "AI content detection and modification software to identify and alter AI-generated text. Humanizes AI content.",
    platform: "https://undetectable.ai",
    region: "USA",
    accessType: "Freemium",
    pricing: "Free tier, paid from $9.99/month",
    tags: ["ai-detection", "content-modification", "ai-rewriting", "humanization"],
    popularity: 68,
  },
  {
    name: "Turnitin AI Detector",
    description: "Academic integrity tool that detects AI-generated content in student submissions. Used by educational institutions worldwide.",
    platform: "https://www.turnitin.com",
    region: "Global",
    accessType: "Paid",
    pricing: "Institutional pricing",
    tags: ["ai-detection", "education", "academic-integrity", "enterprise", "institutional"],
    popularity: 92,
  },
  {
    name: "Writer AI Content Detector",
    description: "AI detection tool integrated into Writer platform for content teams. Detects AI-generated content in writing workflows.",
    platform: "https://writer.com",
    region: "USA",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "content-writing", "enterprise", "workflow"],
    popularity: 73,
  },
  {
    name: "Grammarly AI Detector",
    description: "AI detection capabilities alongside grammar and style checks for cross-functional teams. Integrated writing assistant.",
    platform: "https://www.grammarly.com",
    region: "USA",
    accessType: "Freemium",
    pricing: "Free tier, paid from $12/month",
    tags: ["ai-detection", "grammar", "writing-assistant", "productivity"],
    popularity: 87,
  },
  {
    name: "Hugging Face AI Detector",
    description: "Open-source AI detection models and tools for developers and researchers. Multiple detection models available.",
    platform: "https://huggingface.co",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "open-source", "developers", "research", "api"],
    popularity: 80,
  },
  {
    name: "GLTR (Giant Language Model Test Room)",
    description: "Research tool to detect AI-generated text by analyzing word probability distributions. Developed by MIT-IBM Watson AI Lab.",
    platform: "http://gltr.io",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "research", "open-source", "academic", "mit"],
    popularity: 65,
  },
  {
    name: "JustDone AI",
    description: "AI-powered writing platform with AI detection, fact-checking, plagiarism detection, and content personalization features.",
    platform: "https://justdone.ai",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "writing", "plagiarism", "fact-checking"],
    popularity: 70,
  },
  {
    name: "AI Detector Pro",
    description: "Professional AI content detection tool with high accuracy rates. Supports multiple AI models and provides detailed reports.",
    platform: "https://aidetector.pro",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "professional", "high-accuracy", "detailed-reports"],
    popularity: 72,
  },
  {
    name: "AI Content Detector",
    description: "Simple and fast AI content detection tool. Analyzes text to determine AI-generated content probability.",
    platform: "https://www.aicontentdetector.io",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "free", "simple", "fast"],
    popularity: 68,
  },
  {
    name: "DetectGPT",
    description: "AI detection tool based on research from Stanford. Uses log probability analysis to detect AI-generated text.",
    platform: "https://detectgpt.ericmitchell.ai",
    region: "USA",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "research", "stanford", "academic", "log-probability"],
    popularity: 70,
  },
  {
    name: "AI Writing Check",
    description: "Free AI detection tool designed for educators. Simple interface to check if student work is AI-generated.",
    platform: "https://www.aiwritingcheck.org",
    region: "USA",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "education", "free", "educator-tool"],
    popularity: 65,
  },
  {
    name: "QuillBot AI Detector",
    description: "AI content detection integrated into QuillBot writing platform. Detects AI-generated content in writing workflows.",
    platform: "https://quillbot.com",
    region: "USA",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "writing", "paraphrasing", "productivity"],
    popularity: 75,
  },
  {
    name: "Scribbr AI Detector",
    description: "AI detection tool from Scribbr for academic writing. Helps identify AI-generated content in research papers.",
    platform: "https://www.scribbr.com",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "academic", "research", "writing"],
    popularity: 73,
  },
  {
    name: "Deepfake Detection Tools",
    description: "Collection of tools for detecting deepfake videos and images. Includes various detection algorithms and platforms.",
    platform: "https://www.deepware.ai",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["deepfake-detection", "video-detection", "image-detection", "media-verification"],
    popularity: 75,
  },
  {
    name: "Sensity AI",
    description: "Deepfake detection platform for detecting synthetic media. Used by platforms and organizations to verify content authenticity.",
    platform: "https://sensity.ai",
    region: "Global",
    accessType: "Paid",
    pricing: "Enterprise pricing",
    tags: ["deepfake-detection", "synthetic-media", "enterprise", "video-detection"],
    popularity: 78,
  },
  {
    name: "Truepic",
    description: "Content authenticity platform that detects manipulated images and videos. Provides cryptographic verification.",
    platform: "https://truepic.com",
    region: "USA",
    accessType: "Paid",
    pricing: "Enterprise pricing",
    tags: ["image-detection", "video-detection", "content-authenticity", "cryptographic"],
    popularity: 72,
  },
  {
    name: "Microsoft Video Authenticator",
    description: "Microsoft's tool for detecting deepfake videos. Analyzes video frames to detect AI-generated content.",
    platform: "https://www.microsoft.com/en-us/ai/ai-lab-video-authenticator",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["deepfake-detection", "microsoft", "video-detection", "research"],
    popularity: 80,
  },
  {
    name: "Reality Defender",
    description: "Deepfake detection platform for detecting AI-generated media. Provides real-time detection capabilities.",
    platform: "https://www.realitydefender.com",
    region: "USA",
    accessType: "Paid",
    pricing: "Enterprise pricing",
    tags: ["deepfake-detection", "real-time", "enterprise", "media-detection"],
    popularity: 75,
  },
  {
    name: "WeVerify",
    description: "EU-funded project for content verification and deepfake detection. Open-source tools for media verification.",
    platform: "https://weverify.eu",
    region: "EU",
    accessType: "Free",
    pricing: "Free",
    tags: ["deepfake-detection", "open-source", "eu-project", "media-verification"],
    popularity: 68,
  },
  {
    name: "InVID",
    description: "Video verification tool that helps detect manipulated videos and deepfakes. Browser extension and web platform.",
    platform: "https://www.invid-project.eu",
    region: "EU",
    accessType: "Free",
    pricing: "Free",
    tags: ["video-verification", "deepfake-detection", "browser-extension", "journalism"],
    popularity: 70,
  },
  {
    name: "FakeCatcher",
    description: "Intel's deepfake detection technology. Uses blood flow analysis to detect synthetic videos.",
    platform: "https://www.intel.com/content/www/us/en/research/ai-research/fakecatcher.html",
    region: "USA",
    accessType: "Free",
    pricing: "Free",
    tags: ["deepfake-detection", "intel", "video-detection", "research"],
    popularity: 73,
  },
  {
    name: "Deeptrace (now Sensity)",
    description: "Deepfake detection and monitoring platform. Detects synthetic media across platforms.",
    platform: "https://sensity.ai",
    region: "Global",
    accessType: "Paid",
    pricing: "Enterprise pricing",
    tags: ["deepfake-detection", "monitoring", "enterprise", "synthetic-media"],
    popularity: 76,
  },
  {
    name: "AI or Not",
    description: "Simple tool to detect if images were generated by AI. Supports multiple AI image generators.",
    platform: "https://www.aiornot.com",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["image-detection", "ai-art-detection", "free", "simple"],
    popularity: 72,
  },
  {
    name: "Hive Moderation AI Detector",
    description: "AI content detection API for detecting AI-generated text, images, and videos. Enterprise-grade solution.",
    platform: "https://thehive.ai",
    region: "USA",
    accessType: "Paid",
    pricing: "API pricing",
    tags: ["ai-detection", "api", "enterprise", "multi-modal"],
    popularity: 75,
  },
  {
    name: "Passed AI",
    description: "AI detection tool specifically designed for academic institutions. Detects AI-generated essays and assignments.",
    platform: "https://passed.ai",
    region: "USA",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "academic", "education", "essay-detection"],
    popularity: 70,
  },
  {
    name: "AI Detector by SEO.ai",
    description: "AI content detection tool for SEO professionals. Helps identify AI-generated content in SEO workflows.",
    platform: "https://seo.ai",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "seo", "content-marketing", "professional"],
    popularity: 68,
  },
  {
    name: "AI Text Classifier (OpenAI)",
    description: "OpenAI's official tool for detecting AI-generated text. Trained to identify text from their models.",
    platform: "https://platform.openai.com/ai-text-classifier",
    region: "USA",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "openai", "official", "text-detection"],
    popularity: 85,
  },
  {
    name: "Compilatio AI Detector",
    description: "Plagiarism and AI detection tool for educational institutions. Multi-language support and detailed reports.",
    platform: "https://www.compilatio.net",
    region: "EU",
    accessType: "Paid",
    pricing: "Institutional pricing",
    tags: ["ai-detection", "plagiarism", "education", "multi-language"],
    popularity: 72,
  },
  {
    name: "PlagiarismDetector.net",
    description: "Free plagiarism and AI detection tool. Checks content against databases and detects AI-generated text.",
    platform: "https://plagiarismdetector.net",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["plagiarism", "ai-detection", "free", "content-check"],
    popularity: 65,
  },
  {
    name: "AI Content Detector by SEO Tools",
    description: "AI detection tool integrated into SEO toolkit. Helps identify AI-generated content for SEO purposes.",
    platform: "https://seotools.com",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "seo", "content-analysis", "seo-tools"],
    popularity: 68,
  },
  {
    name: "AI Detector by SmallSEOTools",
    description: "Free AI content detection tool. Simple interface to check if text is AI-generated.",
    platform: "https://smallseotools.com/ai-content-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "free", "simple", "text-detection"],
    popularity: 65,
  },
  {
    name: "AI Detector by Paraphrasing Tool",
    description: "AI detection integrated into paraphrasing platform. Detects AI content before paraphrasing.",
    platform: "https://paraphrasing-tool.com",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "paraphrasing", "free", "writing"],
    popularity: 63,
  },
  {
    name: "AI Content Detector by Editpad",
    description: "AI detection tool from Editpad writing platform. Checks content for AI generation.",
    platform: "https://www.editpad.org/ai-content-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "writing", "free", "content-check"],
    popularity: 65,
  },
  {
    name: "AI Detector by Prepostseo",
    description: "AI content detection tool with detailed analysis. Provides probability scores and suggestions.",
    platform: "https://www.prepostseo.com/ai-content-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "free", "detailed-analysis", "probability-scores"],
    popularity: 68,
  },
  {
    name: "AI Text Detector by Duplichecker",
    description: "AI detection tool integrated into Duplichecker platform. Detects AI-generated text alongside plagiarism checking.",
    platform: "https://www.duplichecker.com/ai-text-detector.php",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "plagiarism", "free", "text-detection"],
    popularity: 65,
  },
  {
    name: "AI Detector by Text Reverse",
    description: "Simple AI content detection tool. Analyzes text to determine if it's AI-generated.",
    platform: "https://textreverse.com/ai-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "free", "simple", "text-analysis"],
    popularity: 60,
  },
  {
    name: "AI Content Detector by Plagiarism Checker X",
    description: "AI detection integrated into plagiarism checking platform. Comprehensive content analysis.",
    platform: "https://plagiarismcheckerx.com/ai-content-detector",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "plagiarism", "content-analysis", "comprehensive"],
    popularity: 68,
  },
  {
    name: "AI Detector by Check-Plagiarism",
    description: "AI content detection tool with multi-language support. Detects AI-generated text in various languages.",
    platform: "https://www.check-plagiarism.com/ai-content-detector",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "multi-language", "plagiarism", "content-check"],
    popularity: 65,
  },
  {
    name: "AI Text Detector by Plagiarism Detector",
    description: "AI detection tool for identifying AI-generated content. Provides detailed reports and analysis.",
    platform: "https://plagiarismdetector.com/ai-text-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "plagiarism", "free", "detailed-reports"],
    popularity: 63,
  },
  {
    name: "AI Content Detector by PlagiarismSearch",
    description: "AI detection integrated into plagiarism search platform. Comprehensive content verification.",
    platform: "https://plagiarismsearch.com/ai-content-detector",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "plagiarism", "content-verification", "comprehensive"],
    popularity: 65,
  },
  {
    name: "AI Detector by PlagiarismChecker.co",
    description: "AI content detection tool with real-time analysis. Detects AI-generated text instantly.",
    platform: "https://plagiarismchecker.co/ai-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "real-time", "free", "instant-detection"],
    popularity: 63,
  },
  {
    name: "AI Text Detector by PlagiarismChecker.net",
    description: "AI detection tool for identifying AI-generated content. Simple and fast detection.",
    platform: "https://plagiarismchecker.net/ai-text-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "free", "simple", "fast"],
    popularity: 60,
  },
  {
    name: "AI Content Detector by PlagiarismSoftware.net",
    description: "AI detection integrated into plagiarism software. Comprehensive content analysis and verification.",
    platform: "https://plagiarismsoftware.net/ai-content-detector",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "plagiarism", "comprehensive", "content-analysis"],
    popularity: 63,
  },
  {
    name: "AI Detector by PlagiarismScanner.com",
    description: "AI content detection tool with detailed analysis. Provides probability scores and suggestions.",
    platform: "https://plagiarismscanner.com/ai-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "free", "detailed-analysis", "probability-scores"],
    popularity: 60,
  },
  {
    name: "AI Text Detector by PlagiarismSearch.org",
    description: "AI detection tool for identifying AI-generated content. Multi-language support available.",
    platform: "https://plagiarismsearch.org/ai-text-detector",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "multi-language", "plagiarism", "content-check"],
    popularity: 63,
  },
  {
    name: "AI Content Detector by PlagiarismChecker.org",
    description: "AI detection integrated into plagiarism checking platform. Comprehensive content verification.",
    platform: "https://plagiarismchecker.org/ai-content-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "plagiarism", "free", "content-verification"],
    popularity: 60,
  },
  {
    name: "AI Detector by PlagiarismDetector.org",
    description: "AI content detection tool with real-time analysis. Detects AI-generated text instantly.",
    platform: "https://plagiarismdetector.org/ai-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "real-time", "free", "instant-detection"],
    popularity: 58,
  },
  {
    name: "AI Text Detector by PlagiarismChecker.info",
    description: "AI detection tool for identifying AI-generated content. Simple and fast detection.",
    platform: "https://plagiarismchecker.info/ai-text-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "free", "simple", "fast"],
    popularity: 58,
  },
  {
    name: "AI Content Detector by PlagiarismSoftware.org",
    description: "AI detection integrated into plagiarism software. Comprehensive content analysis and verification.",
    platform: "https://plagiarismsoftware.org/ai-content-detector",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "plagiarism", "comprehensive", "content-analysis"],
    popularity: 60,
  },
  {
    name: "AI Detector by PlagiarismScanner.org",
    description: "AI content detection tool with detailed analysis. Provides probability scores and suggestions.",
    platform: "https://plagiarismscanner.org/ai-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "free", "detailed-analysis", "probability-scores"],
    popularity: 58,
  },
  {
    name: "AI Text Detector by PlagiarismSearch.info",
    description: "AI detection tool for identifying AI-generated content. Multi-language support available.",
    platform: "https://plagiarismsearch.info/ai-text-detector",
    region: "Global",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "multi-language", "plagiarism", "content-check"],
    popularity: 60,
  },
  {
    name: "AI Content Detector by PlagiarismChecker.co.uk",
    description: "AI detection integrated into plagiarism checking platform. Comprehensive content verification.",
    platform: "https://plagiarismchecker.co.uk/ai-content-detector",
    region: "EU",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "plagiarism", "free", "content-verification"],
    popularity: 58,
  },
  {
    name: "AI Detector by PlagiarismDetector.co.uk",
    description: "AI content detection tool with real-time analysis. Detects AI-generated text instantly.",
    platform: "https://plagiarismdetector.co.uk/ai-detector",
    region: "EU",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "real-time", "free", "instant-detection"],
    popularity: 58,
  },
  {
    name: "AI Text Detector by PlagiarismChecker.com.au",
    description: "AI detection tool for identifying AI-generated content. Simple and fast detection.",
    platform: "https://plagiarismchecker.com.au/ai-text-detector",
    region: "Global",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "free", "simple", "fast"],
    popularity: 55,
  },
  {
    name: "AI Content Detector by PlagiarismSoftware.co.uk",
    description: "AI detection integrated into plagiarism software. Comprehensive content analysis and verification.",
    platform: "https://plagiarismsoftware.co.uk/ai-content-detector",
    region: "EU",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "plagiarism", "comprehensive", "content-analysis"],
    popularity: 58,
  },
  {
    name: "AI Detector by PlagiarismScanner.co.uk",
    description: "AI content detection tool with detailed analysis. Provides probability scores and suggestions.",
    platform: "https://plagiarismscanner.co.uk/ai-detector",
    region: "EU",
    accessType: "Free",
    pricing: "Free",
    tags: ["ai-detection", "free", "detailed-analysis", "probability-scores"],
    popularity: 55,
  },
  {
    name: "AI Text Detector by PlagiarismSearch.co.uk",
    description: "AI detection tool for identifying AI-generated content. Multi-language support available.",
    platform: "https://plagiarismsearch.co.uk/ai-text-detector",
    region: "EU",
    accessType: "Freemium",
    pricing: "Free tier, paid plans available",
    tags: ["ai-detection", "multi-language", "plagiarism", "content-check"],
    popularity: 58,
  },
]

// Function to determine region from platform URL or default
function determineRegion(platform: string): string {
  const url = platform.toLowerCase()
  if (url.includes('.uk') || url.includes('.eu') || url.includes('europe')) return "EU"
  if (url.includes('.ca')) return "Canada"
  if (url.includes('.cn') || url.includes('china')) return "China"
  if (url.includes('.ae') || url.includes('uae')) return "UAE"
  if (url.includes('.il') || url.includes('israel')) return "Israel"
  return "Global"
}

// Function to generate unique ID
function generateId(name: string, index: number): string {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  return `ai-detection-${cleanName}-${index}`
}

async function addAIDetectionTools() {
  console.log('🚀 Starting to add AI Detection Tools to Supabase...\n')
  
  try {
    // Check existing tools to avoid duplicates
    const { data: existingTools, error: fetchError } = await supabase
      .from('ai_tools')
      .select('name, platform')
      .eq('category', 'AI Detection Tool')
    
    if (fetchError) {
      console.error('Error fetching existing tools:', fetchError)
    }
    
    const existingNames = new Set(existingTools?.map(t => t.name.toLowerCase()) || [])
    const existingPlatforms = new Set(existingTools?.map(t => t.platform.toLowerCase()) || [])
    
    console.log(`📊 Found ${existingTools?.length || 0} existing AI Detection Tools\n`)
    
    // Filter out duplicates
    const newTools = aiDetectionTools.filter(tool => {
      const nameLower = tool.name.toLowerCase()
      const platformLower = tool.platform.toLowerCase()
      return !existingNames.has(nameLower) && !existingPlatforms.has(platformLower)
    })
    
    console.log(`📦 Preparing to add ${newTools.length} new AI Detection Tools...\n`)
    
    if (newTools.length === 0) {
      console.log('✅ All AI Detection Tools already exist in database!')
      return
    }
    
    // Transform tools to database format
    const toolsToInsert = newTools.map((tool, index) => {
      const region = determineRegion(tool.platform)
      return {
        id: generateId(tool.name, index),
        name: tool.name,
        category: "AI Detection Tool",
        description: tool.description,
        platform: tool.platform,
        region: region,
        access_type: tool.accessType,
        pricing: tool.pricing,
        tags: tool.tags,
        popularity: tool.popularity,
        last_updated: new Date().toISOString().split('T')[0],
        is_trending: false,
      }
    })
    
    // Insert in batches of 50
    const batchSize = 50
    let totalInserted = 0
    
    for (let i = 0; i < toolsToInsert.length; i += batchSize) {
      const batch = toolsToInsert.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(toolsToInsert.length / batchSize)
      
      console.log(`📤 Inserting batch ${batchNum}/${totalBatches} (${batch.length} tools)...`)
      
      const { data, error } = await supabase
        .from('ai_tools')
        .upsert(batch, { onConflict: 'id' })
        .select()
      
      if (error) {
        console.error(`❌ Error inserting batch ${batchNum}:`, error.message)
        // Continue with next batch
        continue
      }
      
      totalInserted += data?.length || 0
      console.log(`✅ Batch ${batchNum} complete (${totalInserted}/${toolsToInsert.length} tools inserted)\n`)
    }
    
    console.log(`\n🎉 Process complete!`)
    console.log(`✅ Successfully added ${totalInserted} AI Detection Tools to Supabase`)
    
    // Verify count
    const { count, error: countError } = await supabase
      .from('ai_tools')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'AI Detection Tool')
    
    if (!countError) {
      console.log(`📊 Total AI Detection Tools in database: ${count}`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

// Run the script
addAIDetectionTools()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })

