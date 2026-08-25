import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('=== Testing trending tools queries ===\n')

// Test 1: Basic ai_tools query
console.log('1. Querying ai_tools...')
const { data: tools, error: toolsError } = await supabase
  .from('ai_tools')
  .select('id, name, is_trending, popularity')
  .or('is_trending.eq.true,popularity.gte.60')
  .limit(3)

if (toolsError) {
  console.error('   FAILED:', toolsError.message)
} else {
  console.log(`   OK - found ${tools.length} tools`)
}

// Test 2: tool_reviews with helpful_count
console.log('\n2. Querying tool_reviews (rating, helpful_count)...')
const { data: reviews, error: reviewsError } = await supabase
  .from('tool_reviews')
  .select('rating, helpful_count')
  .limit(1)

if (reviewsError) {
  console.error('   FAILED:', reviewsError.message, '| code:', reviewsError.code, '| details:', reviewsError.details)
} else {
  console.log(`   OK - found ${reviews.length} reviews`)
}

// Test 3: tool_reviews without helpful_count
console.log('\n3. Querying tool_reviews (rating only)...')
const { data: reviews2, error: reviews2Error } = await supabase
  .from('tool_reviews')
  .select('rating')
  .limit(1)

if (reviews2Error) {
  console.error('   FAILED:', reviews2Error.message)
} else {
  console.log(`   OK - found ${reviews2.length} reviews`)
}

// Test 4: user_favorites
console.log('\n4. Querying user_favorites count...')
const { count, error: favError } = await supabase
  .from('user_favorites')
  .select('*', { count: 'exact', head: true })

if (favError) {
  console.error('   FAILED:', favError.message)
} else {
  console.log(`   OK - count: ${count}`)
}

console.log('\n=== Done ===')
