/**
 * Direct Embedding Generator
 * 
 * Generates embeddings directly using Gemini + Supabase, 
 * bypassing the API layer to avoid HTTP timeouts.
 * 
 * Run: npx tsx scripts/generate-embeddings.ts
 */

import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as path from "path"

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing required env vars. Check .env.local has:")
    console.error("   GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const EMBEDDING_MODEL = "gemini-embedding-001"
const BATCH_SIZE = 50  // Process 50 tools per DB fetch
const CONCURRENCY = 3  // 3 parallel Gemini calls
const DELAY_BETWEEN_CALLS = 300 // ms between Gemini calls

async function generateEmbedding(text: string, retries = 3): Promise<number[] | null> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })
            const result = await model.embedContent(text)
            return result.embedding.values
        } catch (error: any) {
            const isRetryable = error?.status === 429 || error?.status === 503
            if (isRetryable && attempt < retries - 1) {
                const delay = 2000 * Math.pow(2, attempt)
                console.warn(`   ⏳ Rate limited (${error.status}), waiting ${delay / 1000}s...`)
                await new Promise(r => setTimeout(r, delay))
                continue
            }
            if (attempt === retries - 1) {
                console.error(`   ❌ Failed after ${retries} attempts:`, error?.message?.substring(0, 100))
            }
            return null
        }
    }
    return null
}

function buildToolText(tool: any): string {
    const parts = [
        tool.name,
        tool.description || "",
        tool.category ? `Category: ${tool.category}` : "",
        tool.tags?.length ? `Tags: ${tool.tags.join(", ")}` : ""
    ].filter(Boolean)
    return parts.join(". ").substring(0, 2000)
}

async function main() {
    console.log("🚀 Semantic Embedding Generator")
    console.log("================================\n")

    // Check how many need embeddings
    const { count: total } = await supabase
        .from("ai_tools")
        .select("id", { count: "exact", head: true })

    const { count: remaining } = await supabase
        .from("ai_tools")
        .select("id", { count: "exact", head: true })
        .is("embedding", null)

    console.log(`📊 Total tools: ${total}`)
    console.log(`📊 Need embeddings: ${remaining}`)
    console.log(`📊 Already done: ${(total || 0) - (remaining || 0)}\n`)

    if (!remaining || remaining === 0) {
        console.log("✅ All tools already have embeddings!")
        return
    }

    let processed = 0
    let succeeded = 0
    let failed = 0
    const startTime = Date.now()

    while (true) {
        // Fetch next batch of tools without embeddings
        const { data: tools, error } = await supabase
            .from("ai_tools")
            .select("id, name, description, category, tags")
            .is("embedding", null)
            .limit(BATCH_SIZE)

        if (error) {
            console.error("❌ Supabase fetch error:", error.message)
            break
        }

        if (!tools || tools.length === 0) {
            break
        }

        console.log(`\n📦 Batch: ${Math.floor(processed / BATCH_SIZE) + 1} (${tools.length} tools)`)

        // Process tools with limited concurrency
        for (let i = 0; i < tools.length; i += CONCURRENCY) {
            const chunk = tools.slice(i, i + CONCURRENCY)

            const results = await Promise.all(
                chunk.map(async (tool) => {
                    const text = buildToolText(tool)
                    const embedding = await generateEmbedding(text)
                    return { tool, embedding }
                })
            )

            // Save each embedding to DB
            for (const { tool, embedding } of results) {
                if (embedding) {
                    const vectorStr = `[${embedding.join(",")}]`
                    const { error: updateError } = await supabase
                        .from("ai_tools")
                        .update({ embedding: vectorStr })
                        .eq("id", tool.id)

                    if (updateError) {
                        console.error(`   ❌ DB update failed for ${tool.name}:`, updateError.message)
                        failed++
                    } else {
                        succeeded++
                    }
                } else {
                    failed++
                }
                processed++
            }

            // Small delay between chunks
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_CALLS))
        }

        // Progress report
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
        const rate = (succeeded / (parseInt(elapsed) || 1)).toFixed(1)
        const eta = remaining ? Math.round((remaining - succeeded) / parseFloat(rate || "1")) : 0
        console.log(`   ✅ ${succeeded} saved, ❌ ${failed} failed | ${rate}/s | ETA: ${Math.floor(eta / 60)}m ${eta % 60}s`)
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n================================`)
    console.log(`✅ Done in ${totalTime}s`)
    console.log(`   Succeeded: ${succeeded}`)
    console.log(`   Failed: ${failed}`)
    console.log(`   Total processed: ${processed}`)
}

main().catch(console.error)
