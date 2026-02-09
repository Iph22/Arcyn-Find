import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

// Tiered model system to handle strict quotas
const PRIMARY_MODEL = "gemini-3-flash-preview"
const FALLBACK_MODEL = "gemini-flash-latest" // Usually 1.5 Flash with much higher quota

export const geminiModel = genAI.getGenerativeModel({ model: PRIMARY_MODEL })
const fallbackModel = genAI.getGenerativeModel({ model: FALLBACK_MODEL })

// Helper to handle tiered generation with retries
async function generateWithFallback(prompt: string) {
    const MAX_RETRIES = 2
    const RETRY_DELAY_MS = 1000

    // Try with main model first
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const result = await geminiModel.generateContent(prompt)
            return await result.response
        } catch (error: any) {
            const isRetryable = error.status === 429 || error.status === 503

            // If it's a retryable error and we have attempts left, wait and retry
            if (isRetryable && attempt < MAX_RETRIES - 1) {
                console.warn(`[AI] ${PRIMARY_MODEL} error (${error.status}), retrying in ${RETRY_DELAY_MS * (attempt + 1)}ms...`)
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)))
                continue
            }

            // If it's a quota/overload error, try fallback model
            if (isRetryable) {
                console.warn(`[AI] ${PRIMARY_MODEL} unavailable (${error.status}). Falling back to ${FALLBACK_MODEL}`)
                break
            }

            throw error
        }
    }

    // Try fallback model
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const result = await fallbackModel.generateContent(prompt)
            return await result.response
        } catch (error: any) {
            const isRetryable = error.status === 429 || error.status === 503

            if (isRetryable && attempt < MAX_RETRIES - 1) {
                console.warn(`[AI] ${FALLBACK_MODEL} error (${error.status}), retrying...`)
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)))
                continue
            }

            // Mark as AI unavailable so callers can use keyword fallback
            const aiUnavailableError = new Error('AI_UNAVAILABLE')
                ; (aiUnavailableError as any).isAIUnavailable = true
            throw aiUnavailableError
        }
    }

    // This shouldn't be reached, but just in case
    const aiUnavailableError = new Error('AI_UNAVAILABLE')
        ; (aiUnavailableError as any).isAIUnavailable = true
    throw aiUnavailableError
}

export interface NLPSeachParams {
    keywords: string[]
    categories: string[]
    tags: string[]
    intent: string
    suggestDiscovery?: boolean
}

export interface DiscoveredTool {
    name: string
    category: string
    description: string
    platform: string
    region: string
    accessType: "Free" | "Freemium" | "Paid"
    pricing: string
    tags: string[]
}

/**
 * Uses Gemini to parse a natural language search query into structured parameters
 */
export async function parseNaturalLanguageSearch(query: string): Promise<NLPSeachParams | null> {
    if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY is not set. NLP search will be disabled.")
        return null
    }

    try {
        const prompt = `
      You are an expert at parsing search queries for an AI tool directory.
      The user typed: "${query}"
      
      Extract the following information in JSON format:
      1. keywords: Key technical terms or tool names.
      2. categories: Match against these allowed categories: [Generative AI, AI Agents, Code & Development, Chatbots, Writing & Content, Image Generation, Productivity, Audio & Music, Data & Analytics, Education, Marketing, Video Generation, AI Detection, HR & Recruiting, Customer Service, Translation, Research].
      3. tags: Relevant search tags like "pdf", "word", "video", "coding", "automation".
      4. intent: A brief description of what the user is trying to achieve.

      Example Mapping:
      Input: "I want a tool that can convert pdf to word"
      Output: {
        "keywords": ["pdf converter", "pdf to word"],
        "categories": ["Productivity", "Writing & Content"],
        "tags": ["pdf", "word", "converter"],
        "intent": "convert pdf files to word documents"
      }

      Return ONLY the JSON.
    `

        const response = await generateWithFallback(prompt)
        const text = response.text()

        // Clean potential markdown formatting
        const jsonStr = text.replace(/```json|```/g, "").trim()
        return JSON.parse(jsonStr) as NLPSeachParams
    } catch (error) {
        console.error("Error parsing NLP search with Gemini:", error)
        return null
    }
}

/**
 * Validates if the search results actually match the user's natural language intent
 */
export async function validateSearchResults(query: string, results: any[]): Promise<{ isRelevant: boolean, feedback: string }> {
    if (!process.env.GEMINI_API_KEY || results.length === 0) {
        return { isRelevant: results.length > 0, feedback: "" }
    }

    try {
        const resultsSummary = results.map(r => `${r.name}: ${r.description}`).join("\n")
        const prompt = `
      User Query: "${query}"
      Search Results:
      ${resultsSummary}

      Evaluate if THE MAJORITY of these results actually help the user achieve their goal.
      Be lenient: if the tool is technically capable of the task described in the query, it IS relevant.
      Return JSON:
      {
        "isRelevant": boolean,
        "feedback": "Why it is relevant or why not"
      }
    `

        const response = await generateWithFallback(prompt)
        const text = response.text()
        const jsonStr = text.replace(/```json|```/g, "").trim()
        return JSON.parse(jsonStr)
    } catch (error) {
        console.error("Error validating search results:", error)
        return { isRelevant: true, feedback: "" }
    }
}

/**
 * Discovers real-world AI tools related to a query that might be missing from the database
 */
export async function discoverNewTools(query: string): Promise<DiscoveredTool[]> {
    if (!process.env.GEMINI_API_KEY) return []

    try {
        const prompt = `
      The user is looking for: "${query}"
      We couldn't find good matches in our database. 
      Suggest 3-5 REAL, functional AI software tools or platforms (SaaS) that would be perfect for this query.
      
      CRITICAL: DO NOT suggest research papers, GitHub repositories with no UI, or academic datasets.
      Focus on tools a non-technical user could sign up for and use.
      
      Return ONLY a JSON array of objects with:
      name, category, description (max 150 chars), platform (URL), region (e.g. USA, EU, Global), accessType (Free, Freemium, Paid), pricing (brief string), tags (array).
      
      Allowed categories: [Generative AI, AI Agents, Code & Development, Chatbots, Writing & Content, Image Generation, Productivity, Audio & Music, Data & Analytics, Education, Marketing, Video Generation, AI Detection, HR & Recruiting, Customer Service, Translation, Research].
      
      Example:
      [{
        "name": "Example Tool",
        "category": "Productivity",
        "description": "Short description of a functional app",
        "platform": "https://example.com",
        "region": "Global",
        "accessType": "Freemium",
        "pricing": "Free tier available",
        "tags": ["productivity", "webapp"]
      }]
    `

        const response = await generateWithFallback(prompt)
        const text = response.text()
        const jsonStr = text.replace(/```json|```/g, "").trim()
        return JSON.parse(jsonStr)
    } catch (error) {
        console.error("Error discovering new tools:", error)
        return []
    }
}
