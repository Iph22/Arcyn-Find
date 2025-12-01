#!/usr/bin/env node

/**
 * Check for specific IDE tools and their current categories
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

const ideToolNames = [
  'cursor',
  'windsurf',
  'vscode',
  'visual studio code',
  'jupyter',
  'antigravity',
  'intellij',
  'webstorm',
  'pycharm',
  'android studio',
  'xcode',
  'eclipse',
  'sublime',
  'atom',
  'vim',
  'emacs',
  'neovim',
  'codeium',
  'tabnine',
  'cursor editor',
  'windsurf ide',
  'cursor ai',
];

async function findIDETools() {
  console.log('🔍 Searching for IDE tools in database...\n');
  console.log('='.repeat(70));
  
  const foundTools = [];
  const notFound = [];
  
  // Search for each IDE tool
  for (const ideName of ideToolNames) {
    const { data: tools, error } = await supabase
      .from('ai_tools')
      .select('id, name, category, platform, description')
      .or(`name.ilike.%${ideName}%,description.ilike.%${ideName}%,platform.ilike.%${ideName}%`)
      .limit(10);
    
    if (error) {
      console.error(`❌ Error searching for ${ideName}:`, error.message);
      continue;
    }
    
    if (tools && tools.length > 0) {
      console.log(`\n✅ Found ${tools.length} tool(s) matching "${ideName}":\n`);
      tools.forEach(tool => {
        console.log(`   📦 ${tool.name}`);
        console.log(`      Category: ${tool.category}`);
        console.log(`      Platform: ${tool.platform}`);
        console.log(`      Description: ${tool.description?.substring(0, 100)}...`);
        console.log('');
        foundTools.push({
          searchTerm: ideName,
          ...tool
        });
      });
    } else {
      notFound.push(ideName);
    }
  }
  
  // Also search more broadly for IDE-related terms
  console.log('\n' + '='.repeat(70));
  console.log('🔍 Broad search for IDE-related tools...\n');
  
  const { data: allTools, error: allError } = await supabase
    .from('ai_tools')
    .select('id, name, category, platform, description')
    .or(`name.ilike.%cursor%,name.ilike.%windsurf%,name.ilike.%jupyter%,name.ilike.%antigravity%,name.ilike.%code editor%,name.ilike.%development environment%`)
    .limit(50);
  
  if (!allError && allTools && allTools.length > 0) {
    console.log(`✅ Found ${allTools.length} IDE-related tools:\n`);
    allTools.forEach(tool => {
      console.log(`   📦 ${tool.name}`);
      console.log(`      Category: ${tool.category}`);
      console.log(`      Platform: ${tool.platform}`);
      console.log('');
    });
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n   ✅ Tools found: ${foundTools.length}`);
  console.log(`   ❌ Tools not found: ${notFound.length}`);
  
  if (notFound.length > 0) {
    console.log(`\n   ⚠️  Not found in database:`);
    notFound.forEach(name => {
      console.log(`      - ${name}`);
    });
  }
  
  // Group by category
  const byCategory = {};
  foundTools.forEach(tool => {
    const cat = tool.category || 'Unknown';
    if (!byCategory[cat]) {
      byCategory[cat] = [];
    }
    byCategory[cat].push(tool);
  });
  
  console.log(`\n   📁 Found tools by category:\n`);
  Object.entries(byCategory).forEach(([category, tools]) => {
    console.log(`      ${category}: ${tools.length} tool(s)`);
    tools.forEach(tool => {
      console.log(`         - ${tool.name}`);
    });
  });
  
  return { foundTools, notFound, byCategory };
}

if (require.main === module) {
  findIDETools()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { findIDETools };

