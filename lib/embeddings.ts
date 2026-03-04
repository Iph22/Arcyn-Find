/**
 * Embedding Service - Generates semantic embeddings for AI tool search
 * 
 * Uses Gemini's text-embedding-004 model to create 768-dimensional vectors
 * that capture the semantic meaning of text.
 */

import { GoogleGenerativeAI } from "@google/generative-ai"
import { getSupabaseAdmin } from "./supabase"
import { logger } from "./logger"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

// Gemini's embedding model (gemini-embedding-001 replaced text-embedding-004 which was shut down Jan 2026)
const EMBEDDING_MODEL = "gemini-embedding-001"

// Cache embeddings in memory to reduce API calls
const embeddingCache = new Map<string, number[]>()
const CACHE_MAX_SIZE = 1000

/**
 * Generate an embedding vector for the given text
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
    if (!process.env.GEMINI_API_KEY) {
        logger.warn("[Embeddings] GEMINI_API_KEY is not set")
        return null
    }

    if (!text || text.trim().length === 0) {
        return null
    }

    // Check cache first
    const cacheKey = text.toLowerCase().trim().substring(0, 200)
    if (embeddingCache.has(cacheKey)) {
        return embeddingCache.get(cacheKey)!
    }

    const MAX_RETRIES = 3
    const BASE_DELAY = 1500

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })
            const result = await model.embedContent({
                content: { parts: [{ text }] },
                outputDimensionality: 768
            })
            const embedding = result.embedding.values

            // Cache the result
            if (embeddingCache.size >= CACHE_MAX_SIZE) {
                const firstKey = embeddingCache.keys().next().value
                if (firstKey) embeddingCache.delete(firstKey)
            }
            embeddingCache.set(cacheKey, embedding)

            return embedding
        } catch (error: any) {
            const isRetryable = error?.status === 429 || error?.status === 503
            if (isRetryable && attempt < MAX_RETRIES - 1) {
                const delay = BASE_DELAY * Math.pow(2, attempt)
                console.warn(`[Embeddings] Rate limited (${error.status}), retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`)
                await new Promise(resolve => setTimeout(resolve, delay))
                continue
            }
            console.error(`[Embeddings] Error generating embedding (attempt ${attempt + 1}):`, error?.message || error)
            return null
        }
    }
    return null
}

/**
 * Generate embedding for search query with retry logic
 */
export async function generateQueryEmbedding(query: string): Promise<number[] | null> {
    // Clean and prepare the query
    const cleanQuery = query
        .toLowerCase()
        .replace(/[^\w\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    if (cleanQuery.length < 3) {
        return null
    }

    // Add context to improve search quality
    const enhancedQuery = `AI tool for: ${cleanQuery}`

    return await generateEmbedding(enhancedQuery)
}

/**
 * Generate embedding for a tool (name + description combined)
 */
export async function generateToolEmbedding(
    name: string,
    description: string,
    category?: string,
    tags?: string[]
): Promise<number[] | null> {
    // Combine tool information for rich embedding
    const parts = [
        name,
        description || "",
        category ? `Category: ${category}` : "",
        tags && tags.length > 0 ? `Tags: ${tags.join(", ")}` : ""
    ].filter(Boolean)

    const text = parts.join(". ").substring(0, 2000) // Limit text length

    return await generateEmbedding(text)
}

/**
 * Batch generate embeddings for multiple tools
 * Includes rate limiting to avoid quota issues
 */
export async function batchGenerateEmbeddings(
    tools: Array<{
        id: string
        name: string
        description?: string | null
        category?: string
        tags?: string[] | null
    }>,
    onProgress?: (completed: number, total: number) => void
): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>()
    const batchSize = 3 // Process 3 at a time (conservative to avoid rate limits)
    const delayMs = 500 // Delay between batches to avoid rate limits
    let nullCount = 0

    for (let i = 0; i < tools.length; i += batchSize) {
        const batch = tools.slice(i, i + batchSize)

        await Promise.all(
            batch.map(async (tool) => {
                const embedding = await generateToolEmbedding(
                    tool.name,
                    tool.description || "",
                    tool.category,
                    tool.tags || []
                )
                if (embedding) {
                    results.set(tool.id, embedding)
                } else {
                    nullCount++
                }
            })
        )

        if (onProgress) {
            onProgress(Math.min(i + batchSize, tools.length), tools.length)
        }

        // If we're getting too many nulls, slow down significantly
        if (nullCount > 5) {
            console.warn(`[Embeddings] Many failures (${nullCount}), slowing down...`)
            await new Promise(resolve => setTimeout(resolve, 3000))
            nullCount = 0 // Reset counter
        }

        // Rate limit delay
        if (i + batchSize < tools.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }

    console.log(`[Embeddings] Batch complete: ${results.size} succeeded, ${nullCount} failed out of ${tools.length}`)
    return results
}

/**
 * Perform semantic search using embeddings
 */
export async function semanticSearch(
    query: string,
    limit: number = 20,
    threshold: number = 0.5
): Promise<Array<{
    id: string
    name: string
    category: string
    description: string
    platform: string
    region?: string
    access_type?: string
    pricing?: string
    tags?: string[]
    popularity?: number
    last_updated?: string
    is_trending?: boolean
    image?: string
    similarity: number
}>> {
    const queryEmbedding = await generateQueryEmbedding(query)

    if (!queryEmbedding) {
        logger.warn("[Embeddings] Could not generate query embedding")
        return []
    }

    const supabase = getSupabaseAdmin()

    try {
        // Use the semantic search function we created
        const { data, error } = await supabase.rpc('search_tools_semantic', {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: limit
        })

        if (error) {
            logger.error("[Embeddings] Semantic search error:", error)
            return []
        }

        return data || []
    } catch (error) {
        logger.error("[Embeddings] Semantic search failed:", error)
        return []
    }
}

/**
 * Hybrid search - combines semantic + keyword search
 */
export async function hybridSearch(
    query: string,
    limit: number = 30,
    threshold: number = 0.4
): Promise<Array<{
    id: string
    name: string
    category: string
    description: string
    platform: string
    region?: string
    access_type?: string
    pricing?: string
    tags?: string[]
    popularity?: number
    last_updated?: string
    is_trending?: boolean
    image?: string
    similarity: number
    keyword_match?: boolean
    fts_score?: number
    combined_score?: number
}>> {
    const supabase = getSupabaseAdmin()

    // 1. Try to fetch embedding from permanent cache to save tokens
    let queryEmbedding: number[] | null = null;
    const cleanQuery = query.toLowerCase().trim();

    try {
        const { data: cached } = await supabase
            .from('search_cache')
            .select('semantic_embedding')
            .eq('query_text', cleanQuery)
            .single()

        if (cached && cached.semantic_embedding) {
            queryEmbedding = cached.semantic_embedding;
            logger.info("[Embeddings] Using heavily cached query embedding for tokens!")
            // Update last_used asynchronously 
            supabase.from('search_cache').update({
                last_used_at: new Date().toISOString(),
            }).eq('query_text', cleanQuery).then();
        }
    } catch (e) {
        // Cache miss or table doesn't exist yet
    }

    // 2. Generate embedding and cache it
    if (!queryEmbedding) {
        queryEmbedding = await generateQueryEmbedding(query)
        if (queryEmbedding) {
            try {
                // Try caching it async
                supabase.from('search_cache').upsert({
                    query_text: cleanQuery,
                    semantic_embedding: queryEmbedding
                }, { onConflict: 'query_text' }).then()
            } catch (err) { }
        } else {
            logger.info("[Embeddings] No embedding available, using FTS-only advanced search fallback")
        }
    }

    try {
        const { data, error } = await supabase.rpc('search_tools_advanced', {
            search_query: query,
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: limit
        })

        if (error) {
            if (error.message?.includes('does not exist')) {
                logger.warn("[Embeddings] Advanced hybrid search function not found. Did you run the migration?")
                return []
            }
            logger.error("[Embeddings] Hybrid search error:", error)
            return []
        }

        return data || []
    } catch (error) {
        logger.error("[Embeddings] Hybrid search failed:", error)
        return []
    }
}

/**
 * Update a single tool's embedding in the database
 */
export async function updateToolEmbedding(toolId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin()

    // Fetch the tool
    const { data: tool, error: fetchError } = await supabase
        .from('ai_tools')
        .select('id, name, description, category, tags')
        .eq('id', toolId)
        .single()

    if (fetchError || !tool) {
        logger.error("[Embeddings] Tool not found:", toolId)
        return false
    }

    // Generate embedding
    const embedding = await generateToolEmbedding(
        tool.name,
        tool.description,
        tool.category,
        tool.tags
    )

    if (!embedding) {
        logger.error("[Embeddings] Could not generate embedding for:", toolId)
        return false
    }

    // Update the tool with the embedding
    const { error: updateError } = await supabase
        .from('ai_tools')
        .update({ embedding })
        .eq('id', toolId)

    if (updateError) {
        logger.error("[Embeddings] Error updating embedding:", updateError)
        return false
    }

    logger.info(`[Embeddings] Updated embedding for: ${tool.name}`)
    return true
}

/**
 * Check if semantic search is available (migration has been run)
 * Cached for 5 minutes to avoid checking on every request.
 */
let semanticAvailableCache: { value: boolean, timestamp: number } | null = null
const SEMANTIC_CHECK_TTL = 1000 * 60 * 5 // 5 minutes

export async function isSemanticSearchAvailable(): Promise<boolean> {
    // Return cached result if fresh
    if (semanticAvailableCache && (Date.now() - semanticAvailableCache.timestamp < SEMANTIC_CHECK_TTL)) {
        return semanticAvailableCache.value
    }

    const supabase = getSupabaseAdmin()

    try {
        // Check if the embedding column exists
        const { data, error } = await supabase
            .from('ai_tools')
            .select('embedding')
            .limit(1)

        if (error) {
            semanticAvailableCache = { value: false, timestamp: Date.now() }
            return false
        }

        semanticAvailableCache = { value: true, timestamp: Date.now() }
        return true
    } catch {
        semanticAvailableCache = { value: false, timestamp: Date.now() }
        return false
    }
}

