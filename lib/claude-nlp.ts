/**
 * Query understanding + tool discovery, backed by Claude.
 *
 * Replaces lib/gemini.ts. Behaviour contract is deliberately identical to what
 * it replaced — every function still returns null / [] / a lenient default on
 * failure, so all existing callers and their deterministic fallbacks work
 * unchanged.
 *
 * The one real improvement: responses are schema-validated via structured
 * outputs instead of hand-parsed. The old code stripped markdown fences, hunted
 * for the first and last brace, then JSON.parse'd and hoped — a malformed
 * response surfaced as a caught exception at best, or a wrong-shaped object at
 * worst. Now the shape is guaranteed or we get null.
 */

import { z } from "zod"
import { parseWithClaude } from "./claude"

const ALLOWED_CATEGORIES = [
    "Generative AI", "AI Agents", "Code & Development", "Chatbots",
    "Writing & Content", "Image Generation", "Productivity", "Audio & Music",
    "Data & Analytics", "Education", "Marketing", "Video Generation",
    "AI Detection", "HR & Recruiting", "Customer Service", "Translation", "Research",
] as const

// Timeouts. These sit inside a request that has its own overall budget
// (see TIME_BUDGET_MS in app/api/ai-models/route.ts) — the route's stage gates
// are sized to accommodate the worst case here.
const PARSE_TIMEOUT_MS = 10_000
const VALIDATE_TIMEOUT_MS = 8_000
const DISCOVER_TIMEOUT_MS = 20_000

// ---------------------------------------------------------------------------
// Query parsing
// ---------------------------------------------------------------------------

const NLPSearchParamsSchema = z.object({
    keywords: z.array(z.string()).describe("Key technical terms or tool names"),
    categories: z.array(z.enum(ALLOWED_CATEGORIES)).describe("Matching categories from the allowed list"),
    tags: z.array(z.string()).describe('Relevant search tags like "pdf", "video", "coding"'),
    intent: z.string().describe("Brief description of what the user is trying to achieve"),
})

export type NLPSeachParams = z.infer<typeof NLPSearchParamsSchema> & {
    suggestDiscovery?: boolean
}

/**
 * Parse a natural-language search query into structured search parameters.
 * Returns null when unavailable — callers fall back to raw keyword search.
 */
export async function parseNaturalLanguageSearch(query: string): Promise<NLPSeachParams | null> {
    return parseWithClaude(
        NLPSearchParamsSchema,
        `Parse this search query for an AI tool directory.

User query: "${query}"

Extract the search keywords, matching categories, relevant tags, and the
underlying intent. Example — for "I want a tool that can convert pdf to word":
keywords ["pdf converter", "pdf to word"], categories ["Productivity", "Writing & Content"],
tags ["pdf", "word", "converter"], intent "convert pdf files to word documents".`,
        {
            timeoutMs: PARSE_TIMEOUT_MS,
            // Mechanical extraction on a latency-sensitive path.
            effort: "low",
            label: "parseNaturalLanguageSearch",
        }
    )
}

// ---------------------------------------------------------------------------
// Result relevance check
// ---------------------------------------------------------------------------

const RelevanceSchema = z.object({
    isRelevant: z.boolean(),
    feedback: z.string().describe("Why the results are or aren't relevant"),
})

/**
 * Judge whether search results actually serve the user's intent. Gates the
 * self-healing discovery flow.
 *
 * Fails LENIENT (isRelevant: true) — unchanged from the previous behaviour, and
 * deliberate: an unavailable judge must not trigger discovery writes.
 */
export async function validateSearchResults(
    query: string,
    results: any[]
): Promise<{ isRelevant: boolean; feedback: string }> {
    if (results.length === 0) {
        return { isRelevant: false, feedback: "" }
    }

    const resultsSummary = results.map(r => `${r.name}: ${r.description}`).join("\n")

    const parsed = await parseWithClaude(
        RelevanceSchema,
        `User query: "${query}"

Search results:
${resultsSummary}

Do the MAJORITY of these results help the user achieve their goal? Be lenient —
if a tool is technically capable of the task described, it counts as relevant.`,
        {
            timeoutMs: VALIDATE_TIMEOUT_MS,
            effort: "low",
            label: "validateSearchResults",
        }
    )

    return parsed ?? { isRelevant: true, feedback: "" }
}

// ---------------------------------------------------------------------------
// Self-healing discovery
// ---------------------------------------------------------------------------

const DiscoveredToolSchema = z.object({
    name: z.string(),
    category: z.enum(ALLOWED_CATEGORIES),
    description: z.string().describe("Max 150 characters"),
    platform: z.string().describe("The tool's URL"),
    region: z.string().describe("e.g. USA, EU, Global"),
    accessType: z.enum(["Free", "Freemium", "Paid"]),
    pricing: z.string().describe("Brief pricing summary"),
    tags: z.array(z.string()),
})

const DiscoveredToolsSchema = z.object({
    tools: z.array(DiscoveredToolSchema),
})

export type DiscoveredTool = z.infer<typeof DiscoveredToolSchema>

/**
 * Suggest real AI tools matching a query that the corpus is missing.
 *
 * NOTE: output of this feeds a DB write path. It is gated upstream by the
 * route's remaining time budget AND by a fuzzy-duplicate check
 * (find_similar_tool_name) before anything is inserted.
 */
export async function discoverNewTools(query: string): Promise<DiscoveredTool[]> {
    const parsed = await parseWithClaude(
        DiscoveredToolsSchema,
        `A user is looking for: "${query}"

Our database has no good matches. Suggest 3-5 REAL, currently-operating AI
software tools or platforms that would genuinely serve this request.

Requirements:
- Only real products that exist and a non-technical user could sign up for.
- Do NOT suggest research papers, datasets, or GitHub repos with no UI.
- Do NOT invent tools, URLs, or pricing. If you are unsure a tool is real,
  omit it — returning fewer tools is strictly better than returning a
  plausible-sounding fabrication, because these get written to our catalog.`,
        {
            timeoutMs: DISCOVER_TIMEOUT_MS,
            // Needs real world knowledge and accuracy — worth the spend, and
            // this path is already gated behind a time-budget check.
            effort: "medium",
            label: "discoverNewTools",
        }
    )

    return parsed?.tools ?? []
}
