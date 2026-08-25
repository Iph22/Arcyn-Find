#!/usr/bin/env node

/**
 * Quick script to check AI Coding Agents in database
 */

require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ ERROR: Missing required environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkCodingAgents() {
  const { data, error } = await supabase
    .from('ai_tools')
    .select('name, category, platform')
    .ilike('category', 'AI Coding Agents')
    .order('name')
    .limit(50);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`\n📊 Found ${data?.length || 0} AI Coding Agents:\n`);
  data?.forEach((tool, index) => {
    console.log(`${(index + 1).toString().padStart(2)}. ${tool.name}`);
    console.log(`    Platform: ${tool.platform.substring(0, 70)}...`);
    console.log('');
  });
}

checkCodingAgents()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

