#!/usr/bin/env tsx
/**
 * Script to check what categories actually exist in the database
 * and find tools that might belong to Marketing, Design, or Chatbots
 */

import { createClient } from '@supabase/supabase-js'

// Use environment variables or fallback to hardcoded values for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please set environment variables.')
  console.log('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkCategories() {

  console.log('🔍 Checking categories in database...\n')

  // Get all unique categories
  const { data: categories, error: catError } = await supabase
    .from('ai_tools')
    .select('category')
    .limit(10000)

  if (catError) {
    console.error('Error fetching categories:', catError)
    return
  }

  // Count occurrences of each category
  const categoryCounts: Record<string, number> = {}
  categories?.forEach((tool) => {
    const cat = tool.category
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
  })

  console.log('📊 Categories found in database:')
  console.log('=' .repeat(60))
  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30) // Show top 30

  sortedCategories.forEach(([category, count]) => {
    console.log(`${category.padEnd(40)} ${count} tools`)
  })

  console.log('\n' + '='.repeat(60))
  console.log(`Total unique categories: ${Object.keys(categoryCounts).length}`)
  console.log(`Total tools checked: ${categories?.length || 0}\n`)

  // Check for Marketing-related tools
  console.log('📧 Checking for Marketing tools...')
  const { data: marketingTools } = await supabase
    .from('ai_tools')
    .select('name, category, tags, description')
    .or('category.ilike.*Marketing*,tags.cs.{marketing},description.ilike.*marketing*')
    .limit(20)

  console.log(`Found ${marketingTools?.length || 0} potential Marketing tools:`)
  marketingTools?.slice(0, 10).forEach((tool) => {
    console.log(`  - ${tool.name} (${tool.category})`)
  })

  // Check for Design-related tools
  console.log('\n🎨 Checking for Design tools...')
  const { data: designTools } = await supabase
    .from('ai_tools')
    .select('name, category, tags, description')
    .or('category.ilike.*Design*,tags.cs.{design},description.ilike.*design*')
    .limit(20)

  console.log(`Found ${designTools?.length || 0} potential Design tools:`)
  designTools?.slice(0, 10).forEach((tool) => {
    console.log(`  - ${tool.name} (${tool.category})`)
  })

  // Check for Chatbot-related tools
  console.log('\n💬 Checking for Chatbot tools...')
  const { data: chatbotTools } = await supabase
    .from('ai_tools')
    .select('name, category, tags, description')
    .or('category.ilike.*Chat*,category.ilike.*Generative AI*,tags.cs.{chatbot,chat},description.ilike.*chatbot*')
    .limit(20)

  console.log(`Found ${chatbotTools?.length || 0} potential Chatbot tools:`)
  chatbotTools?.slice(0, 10).forEach((tool) => {
    console.log(`  - ${tool.name} (${tool.category})`)
  })

  // Check category distribution for Generative AI
  console.log('\n🤖 Checking Generative AI category...')
  const { data: genAITools } = await supabase
    .from('ai_tools')
    .select('name, category')
    .ilike('category', '%Generative AI%')
    .limit(10)

  console.log(`Found ${genAITools?.length || 0} Generative AI tools:`)
  genAITools?.forEach((tool) => {
    console.log(`  - ${tool.name}`)
  })
}

checkCategories()
  .then(() => {
    console.log('\n✅ Category check complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

