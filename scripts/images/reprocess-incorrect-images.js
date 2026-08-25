#!/usr/bin/env node

/**
 * Re-process tools with incorrect/placeholder images
 * Fetches correct logos and replaces placeholder/R-Synth images
 */

require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

// Import functions from fetch-logos.js
const fetchLogoFunctions = require('./fetch-logos.js');

// Tools that definitely need re-fetching (well-known tools with placeholder images)
const priorityTools = [
  'Midjourney',
  'ChatGPT',
  'Claude',
  'Stable Diffusion',
  'DALL-E',
  'Runway',
  'Pika',
];

async function reprocessIncorrectImages(dryRun = false) {
  console.log('🔄 Re-processing tools with incorrect images...\n');
  console.log('='.repeat(70));
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  // Get tools with placeholder images
  const { data: tools, error } = await fetchLogoFunctions.supabase
    .from('ai_tools')
    .select('id, name, image, platform')
    .or(`image.eq./og-image.png,image.ilike.%r-synth%,image.ilike.%placeholder%`)
    .limit(500);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📊 Found ${tools?.length || 0} tools with placeholder images\n`);
  
  // Prioritize well-known tools
  const priorityList = tools?.filter(t => 
    priorityTools.some(p => t.name.toLowerCase().includes(p.toLowerCase()))
  ) || [];
  
  const otherTools = tools?.filter(t => 
    !priorityTools.some(p => t.name.toLowerCase().includes(p.toLowerCase()))
  ) || [];
  
  const allToolsToProcess = [...priorityList, ...otherTools];
  
  console.log(`🎯 Priority tools: ${priorityList.length}`);
  console.log(`📦 Other tools: ${otherTools.length}`);
  console.log(`\n🔄 Processing ${allToolsToProcess.length} tools...\n`);
  
  if (dryRun) {
    console.log('Preview of tools to process:\n');
    allToolsToProcess.slice(0, 20).forEach((tool, i) => {
      const isPriority = priorityList.includes(tool);
      console.log(`${(i + 1).toString().padStart(2)}. ${isPriority ? '⭐' : '  '} ${tool.name}`);
      console.log(`    Current: ${tool.image}`);
      console.log(`    Platform: ${tool.platform}`);
      console.log('');
    });
    if (allToolsToProcess.length > 20) {
      console.log(`   ... and ${allToolsToProcess.length - 20} more\n`);
    }
    return;
  }
  
  // Process tools (using the same logic from fetch-logos.js)
  let processed = 0;
  let fixed = 0;
  let failed = 0;
  
  for (const tool of allToolsToProcess) {
    processed++;
    console.log(`[${processed}/${allToolsToProcess.length}] Processing: ${tool.name}`);
    
    try {
      // Use the fetchLogoUrl function from fetch-logos.js
      const logoUrl = await fetchLogoFunctions.fetchLogoUrl(tool.platform, tool.name);
      
      if (!logoUrl) {
        console.log(`   ⚠️  No logo found - keeping placeholder`);
        continue;
      }
      
      // Check if the fetched URL is not a placeholder
      if (logoUrl.includes('r-synth') || logoUrl.includes('placeholder')) {
        console.log(`   ⚠️  Fetched URL is placeholder - skipping`);
        continue;
      }
      
      // Download and upload (reuse existing functions)
      const result = await fetchLogoFunctions.processTool(tool);
      
      if (result.success && !result.skipped) {
        fixed++;
        console.log(`   ✅ Fixed!`);
      } else {
        console.log(`   ⚠️  Could not fix`);
      }
    } catch (error) {
      failed++;
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ RE-PROCESSING COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Fixed: ${fixed} tools`);
  console.log(`   ❌ Failed: ${failed} tools`);
  console.log(`   ⚠️  Skipped: ${allToolsToProcess.length - fixed - failed} tools\n`);
}

// Export for use in other scripts
module.exports = { reprocessIncorrectImages };

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  reprocessIncorrectImages(dryRun)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

