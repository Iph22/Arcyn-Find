#!/usr/bin/env tsx
/**
 * Script to fix access types based on pricing information
 * Updates tools that are incorrectly marked as "Paid" when they should be "Freemium" or "Free"
 */

// Load environment variables from .env.local or .env FIRST
import { config } from 'dotenv'
import { resolve } from 'path'

// Try to load .env.local first, then .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

// Create Supabase client directly to avoid import-time validation
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

interface ToolRow {
  id: string
  name: string
  access_type: string
  pricing: string | null
}

/**
 * Determine correct access type from pricing string
 */
function determineCorrectAccessType(pricing: string | null, currentAccessType: string): 'Free' | 'Freemium' | 'Paid' {
  if (!pricing) {
    // If no pricing info, default to Free (unless explicitly marked as Paid)
    return currentAccessType === 'Paid' ? 'Paid' : 'Free'
  }

  const pricingLower = pricing.toLowerCase()
  
  // Check for freemium indicators
  const freemiumIndicators = [
    'free tier',
    'free plan',
    'free version',
    'freemium',
    'free +',
    'free and',
    'free with',
    'free trial',
    'free forever',
    'free tier +',
    'free tier and',
    'free plan +',
    'free plan and',
    'free version +',
    'free version and',
    'starts free',
    'free to start',
    'free option',
    'free available',
    'free tier available',
    'free plan available',
    'free version available',
  ]
  
  // Check for paid-only indicators
  const paidOnlyIndicators = [
    'paid only',
    'subscription only',
    'premium only',
    'pro only',
    'no free',
    'no free tier',
    'no free plan',
    'no free version',
    'requires payment',
    'payment required',
    'paid subscription',
    'paid plan',
    'paid version',
  ]
  
  // Check for free indicators
  const freeIndicators = [
    'free',
    'open source',
    'open-source',
    'gratis',
    'no cost',
    'no charge',
    'completely free',
    '100% free',
    'totally free',
    'entirely free',
    'fully free',
  ]

  // Check if it's freemium (has both free and paid)
  const hasFree = freeIndicators.some(indicator => pricingLower.includes(indicator))
  const hasPaid = pricingLower.includes('$') || 
                  pricingLower.includes('paid') || 
                  pricingLower.includes('premium') || 
                  pricingLower.includes('pro') || 
                  pricingLower.includes('subscription') ||
                  pricingLower.includes('month') ||
                  pricingLower.includes('year') ||
                  pricingLower.includes('per') ||
                  /^\$/.test(pricing.trim()) ||
                  /\d+\s*(month|year|day|hour)/i.test(pricing)
  
  // Check for explicit freemium indicators
  const isExplicitFreemium = freemiumIndicators.some(indicator => pricingLower.includes(indicator))
  
  // Check for explicit paid-only indicators
  const isExplicitPaidOnly = paidOnlyIndicators.some(indicator => pricingLower.includes(indicator))

  if (isExplicitPaidOnly) {
    return 'Paid'
  }

  if (isExplicitFreemium || (hasFree && hasPaid)) {
    return 'Freemium'
  }

  if (hasPaid && !hasFree) {
    return 'Paid'
  }

  if (hasFree && !hasPaid) {
    return 'Free'
  }

  // Default: keep current if we can't determine
  return currentAccessType as 'Free' | 'Freemium' | 'Paid'
}

async function fixAccessTypes() {
  try {
    console.log('🔍 Fetching tools from database...')

    // Fetch all tools with pricing
    const { data: tools, error: fetchError } = await supabase
      .from('ai_tools')
      .select('id, name, access_type, pricing')
      .not('pricing', 'is', null)

    if (fetchError) {
      console.error('❌ Error fetching tools:', fetchError)
      return
    }

    if (!tools || tools.length === 0) {
      console.log('ℹ️  No tools with pricing found')
      return
    }

    console.log(`📊 Found ${tools.length} tools with pricing information`)

    let updated = 0
    let unchanged = 0
    const updates: Array<{ id: string; name: string; old: string; new: string }> = []

    for (const tool of tools as ToolRow[]) {
      const correctAccessType = determineCorrectAccessType(tool.pricing, tool.access_type)
      
      if (correctAccessType !== tool.access_type) {
        updates.push({
          id: tool.id,
          name: tool.name,
          old: tool.access_type,
          new: correctAccessType,
        })
      } else {
        unchanged++
      }
    }

    console.log(`\n📝 Found ${updates.length} tools that need updating:`)
    updates.forEach(update => {
      console.log(`  - ${update.name}: ${update.old} → ${update.new}`)
    })

    if (updates.length === 0) {
      console.log('\n✅ All access types are correct!')
      return
    }

    // Update tools in batches
    console.log(`\n🔄 Updating ${updates.length} tools...`)
    const batchSize = 50
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('ai_tools')
          .update({ access_type: update.new })
          .eq('id', update.id)

        if (updateError) {
          console.error(`❌ Error updating ${update.name}:`, updateError)
        } else {
          updated++
        }
      }
    }

    console.log(`\n✅ Successfully updated ${updated} tools`)
    console.log(`ℹ️  ${unchanged} tools were already correct`)
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fixAccessTypes()

