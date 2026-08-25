#!/usr/bin/env node

/**
 * Check what IDE tools are currently in the IDEs category
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

async function checkIDEs() {
  console.log('🔍 Checking IDE tools in database...\n');
  console.log('='.repeat(70));
  
  // Get all tools in IDEs category
  const { data: ideTools, error } = await supabase
    .from('ai_tools')
    .select('id, name, category, platform, description, image')
    .or('category.ilike.IDE,category.ilike.IDEs,category.ilike.Development Environment')
    .order('name');
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`\n📊 Tools in IDEs category: ${ideTools?.length || 0}\n`);
  
  if (ideTools && ideTools.length > 0) {
    ideTools.forEach((tool, index) => {
      const hasImage = tool.image && tool.image.trim() !== '';
      const status = hasImage ? '✅' : '❌';
      console.log(`${(index + 1).toString().padStart(3)}. ${status} ${tool.name}`);
      console.log(`     Category: ${tool.category}`);
      console.log(`     Platform: ${tool.platform}`);
      if (tool.description) {
        console.log(`     Description: ${tool.description.substring(0, 100)}...`);
      }
      console.log('');
    });
  }
  
  // Search for specific IDE names
  console.log('\n' + '='.repeat(70));
  console.log('🔍 Searching for specific IDE tools...\n');
  
  const ideNames = ['Cursor', 'Windsurf', 'VSCode', 'Visual Studio Code', 'Jupyter', 'Antigravity', 'Codeium', 'Tabnine'];
  
  for (const ideName of ideNames) {
    const { data: tools } = await supabase
      .from('ai_tools')
      .select('id, name, category, platform')
      .or(`name.ilike.%${ideName}%,platform.ilike.%${ideName}%`)
      .limit(5);
    
    if (tools && tools.length > 0) {
      console.log(`\n📦 "${ideName}" (${tools.length} found):`);
      tools.forEach(tool => {
        console.log(`   - ${tool.name} [${tool.category}] - ${tool.platform.substring(0, 60)}...`);
      });
    }
  }
}

checkIDEs()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

