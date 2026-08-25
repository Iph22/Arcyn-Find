#!/usr/bin/env node

/**
 * Fix images for well-known tools that should have proper logos
 */

require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

// Import functions from fetch-logos.js
const fetchLogoModule = require('../images/fetch-logos.js');

// Well-known tools that must have proper images
const wellKnownTools = [
  { name: 'Midjourney', platform: 'https://midjourney.com' },
  { name: 'ChatGPT', platform: 'https://chat.openai.com' },
  { name: 'Claude', platform: 'https://claude.ai' },
  { name: 'Stable Diffusion', platform: 'https://stability.ai' },
  { name: 'DALL-E', platform: 'https://openai.com' },
  { name: 'Runway', platform: 'https://runwayml.com' },
  { name: 'Pika', platform: 'https://pika.art' },
  { name: 'Windsurf', platform: 'https://code.windsurf.ai' },
  { name: 'Visual Studio Code', platform: 'https://code.visualstudio.com' },
  { name: 'Jupyter', platform: 'https://jupyter.org' },
];

async function fixWellKnownTools(dryRun = false) {
  console.log('🎯 Fixing images for well-known tools...\n');
  console.log('='.repeat(70));
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  const toolsToFix = [];
  
  // Find each well-known tool
  for (const knownTool of wellKnownTools) {
    const { data: tools, error } = await supabase
      .from('ai_tools')
      .select('id, name, image, platform')
      .ilike('name', `%${knownTool.name}%`)
      .limit(5);
    
    if (error) {
      console.error(`❌ Error finding ${knownTool.name}:`, error.message);
      continue;
    }
    
    if (tools && tools.length > 0) {
      // Find exact match or closest match
      const exactMatch = tools.find(t => 
        t.name.toLowerCase() === knownTool.name.toLowerCase() ||
        (t.platform && t.platform.includes(new URL(knownTool.platform).hostname))
      );
      
      const tool = exactMatch || tools[0];
      
      // Check if it needs fixing
      const isPlaceholder = !tool.image || 
        tool.image === '/og-image.png' ||
        tool.image.includes('og-image') ||
        (tool.image.includes('supabase.co/storage') && (
          tool.image.toLowerCase().includes('r-synth') ||
          tool.image.toLowerCase().includes('placeholder')
        ));
      
      if (isPlaceholder) {
        toolsToFix.push({
          ...tool,
          targetPlatform: knownTool.platform,
        });
        console.log(`✅ Found: ${tool.name} (needs fixing)`);
        console.log(`   Current: ${tool.image || 'NO IMAGE'}`);
        console.log(`   Platform: ${tool.platform || knownTool.platform}\n`);
      } else {
        console.log(`✅ ${tool.name} already has valid image\n`);
      }
    } else {
      console.log(`⚠️  ${knownTool.name} not found in database\n`);
    }
  }
  
  if (toolsToFix.length === 0) {
    console.log('✅ All well-known tools already have valid images!\n');
    return { fixed: 0, errors: 0 };
  }
  
  console.log(`\n📊 Found ${toolsToFix.length} well-known tools to fix:\n`);
  
  if (dryRun) {
    toolsToFix.forEach((tool, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${tool.name}`);
      console.log(`    Will fetch from: ${tool.targetPlatform}`);
      console.log('');
    });
    console.log('🔍 This was a dry run. Run without --dry-run to fix images.\n');
    return { found: toolsToFix.length };
  }
  
  // Fix each tool
  console.log('🔄 Fixing images...\n');
  
  let fixed = 0;
  let failed = 0;
  
  for (const tool of toolsToFix) {
    console.log(`Processing: ${tool.name}`);
    
    try {
      // Use the platform from tool, or fallback to target platform
      const platformUrl = tool.platform || tool.targetPlatform;
      
      // Use fetchLogoUrl from fetch-logos.js
      const logoUrl = await fetchLogoModule.fetchLogoUrl(platformUrl, tool.name);
      
      if (!logoUrl) {
        console.log(`   ⚠️  No logo found - will keep placeholder (will show text fallback in UI)`);
        failed++;
        continue;
      }
      
      // Skip if it's a placeholder URL
      if (logoUrl.toLowerCase().includes('r-synth') || 
          logoUrl.toLowerCase().includes('placeholder')) {
        console.log(`   ⚠️  Fetched URL is placeholder - skipping`);
        failed++;
        continue;
      }
      
      // Process using fetch-logos.js logic
      const result = await fetchLogoModule.processTool({
        ...tool,
        platform: platformUrl,
      });
      
      if (result.success && !result.skipped) {
        fixed++;
        console.log(`   ✅ Fixed!`);
      } else {
        console.log(`   ⚠️  Could not fix`);
        failed++;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      failed++;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ FIXING COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Fixed: ${fixed} tools`);
  console.log(`   ❌ Failed: ${failed} tools`);
  console.log(`\n💡 Note: Tools that couldn't be fixed will show text fallbacks in the UI.\n`);
  
  return { fixed, errors: failed };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  fixWellKnownTools(dryRun)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { fixWellKnownTools };

