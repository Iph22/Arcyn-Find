/**
 * Script to generate embeddings for all AI tools
 * 
 * Run with: npx tsx scripts/generate-embeddings.ts
 * 
 * This script calls the admin API endpoint to generate embeddings
 * for tools that don't have them yet.
 */

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'arcyn-admin-embed-2026-secure-key'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

async function checkStatus() {
    const response = await fetch(`${BASE_URL}/api/admin/generate-embeddings`, {
        headers: {
            'x-admin-key': ADMIN_API_KEY
        }
    })

    if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`)
    }

    return await response.json()
}

async function generateBatch() {
    const response = await fetch(`${BASE_URL}/api/admin/generate-embeddings`, {
        method: 'POST',
        headers: {
            'x-admin-key': ADMIN_API_KEY
        }
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Generation failed: ${response.status} - ${error}`)
    }

    return await response.json()
}

async function main() {
    console.log('🔍 Checking embedding status...\n')

    try {
        const status = await checkStatus()
        console.log('📊 Current Status:')
        console.log(`   Total tools: ${status.total}`)
        console.log(`   With embeddings: ${status.withEmbeddings}`)
        console.log(`   Without embeddings: ${status.withoutEmbeddings}`)
        console.log(`   Progress: ${status.percentComplete}%\n`)

        if (status.status === 'complete') {
            console.log('✅ All tools already have embeddings!')
            return
        }

        if (!status.hasColumn) {
            console.log('❌ Embedding column not found. Run the migration first:')
            console.log('   supabase/migrations/add_semantic_search.sql')
            return
        }

        // Generate embeddings in batches
        let remaining = status.withoutEmbeddings
        let batch = 1

        while (remaining > 0) {
            console.log(`\n🚀 Generating batch ${batch}...`)

            try {
                const result = await generateBatch()
                console.log(`   ✓ Processed: ${result.processed}`)
                console.log(`   ✓ Updated: ${result.updated}`)
                console.log(`   ✓ Failed: ${result.failed}`)
                console.log(`   ⏳ Remaining: ${result.remaining}`)

                remaining = result.remaining
                batch++

                if (remaining > 0) {
                    // Small delay between batches
                    console.log('   Waiting 2 seconds before next batch...')
                    await new Promise(resolve => setTimeout(resolve, 2000))
                }
            } catch (error) {
                console.error(`   ❌ Batch ${batch} failed:`, error)
                // Wait longer on error
                console.log('   Waiting 10 seconds before retry...')
                await new Promise(resolve => setTimeout(resolve, 10000))
            }
        }

        console.log('\n✅ All embeddings generated successfully!')

        // Final status check
        const finalStatus = await checkStatus()
        console.log(`\n📊 Final Status:`)
        console.log(`   With embeddings: ${finalStatus.withEmbeddings}`)
        console.log(`   Progress: ${finalStatus.percentComplete}%`)

    } catch (error) {
        console.error('❌ Error:', error)
        process.exit(1)
    }
}

main()
