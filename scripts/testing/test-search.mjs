import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://otrtjqomyukafgnyylij.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90cnRqcW9teXVrYWZnbnl5bGlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQyMDI4OSwiZXhwIjoyMDcxOTk2Mjg5fQ.7HbYt7VN2n_suJ2koccrjc282306D2lDsWFuJq2KQYA'
)

async function testQuery(name, queryBuilder) {
  console.log(`\nTesting: ${name}`)
  const startTime = Date.now()
  try {
    const { data, error } = await queryBuilder.limit(5)
    const duration = Date.now() - startTime
    if (error) {
      console.error(`  [${duration}ms] FAILED:`, error.message)
    } else {
      console.log(`  [${duration}ms] OK: found ${data.length} results`)
    }
  } catch (err) {
    console.error(`  [${Date.now() - startTime}ms] CRASH:`, err.message)
  }
}

async function runTests() {
  // Test 1: Simple ILIKE
  await testQuery('Simple ILIKE on name', 
    supabase.from('ai_tools').select('id, name').ilike('name', '%chatgpt%')
  )

  // Test 2: OR condition with just name and description
  await testQuery('OR on name/description', 
    supabase.from('ai_tools').select('id, name').or('name.ilike.%chatgpt%,description.ilike.%chatgpt%')
  )

  // Test 3: OR condition with tags.cs
  await testQuery('OR with tags.cs', 
    supabase.from('ai_tools').select('id, name').or('name.ilike.%chatgpt%,description.ilike.%chatgpt%,tags.cs.{chatgpt}')
  )

  // Test 4: OR condition with platform ilike
  await testQuery('OR with platform.ilike', 
    supabase.from('ai_tools').select('id, name').or('name.ilike.%chatgpt%,description.ilike.%chatgpt%,platform.ilike.%chatgpt%')
  )

  // Test 5: The exact fallback query logic for "chatgpt" (searchWords length = 1)
  await testQuery('Fallback logic (single word)', 
    supabase.from('ai_tools').select('id, name')
      .or('name.ilike.%chatgpt%,description.ilike.%chatgpt%,platform.ilike.%chatgpt%,tags.cs.{chatgpt}')
  )

  // Test 6: The exact fallback query logic for "asdfasdfasdfasdf"
  await testQuery('Fallback logic (gibberish)', 
    supabase.from('ai_tools').select('id, name')
      .or('name.ilike.%asdfasdfasdfasdf%,description.ilike.%asdfasdfasdfasdf%,platform.ilike.%asdfasdfasdfasdf%,tags.cs.{asdfasdfasdfasdf}')
  )
}

runTests()
