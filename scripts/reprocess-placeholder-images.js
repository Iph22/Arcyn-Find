#!/usr/bin/env node

/**
 * Re-process tools with placeholder images (like /og-image.png)
 * Uses the same fetch-logos.js logic to get correct images
 */

require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

// We need to run fetch-logos.js for tools with placeholder images
// This script filters for tools with /og-image.png and re-runs fetch-logos on them

const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ ERROR: Missing required environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function reprocessPlaceholderImages(dryRun = false) {
  console.log('🔄 Finding tools with placeholder images to re-process...\n');
  console.log('='.repeat(70));
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  // Get tools with placeholder images
  const { data: tools, error } = await supabase
    .from('ai_tools')
    .select('id, name, image, platform')
    .or(`image.eq./og-image.png,image.ilike.%r-synth%`)
    .limit(500);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📊 Found ${tools?.length || 0} tools with placeholder images\n`);
  
  if (dryRun) {
    console.log('Preview of tools that would be re-processed:\n');
    tools?.slice(0, 20).forEach((tool, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${tool.name}`);
      console.log(`    Current: ${tool.image}`);
      console.log(`    Platform: ${tool.platform}`);
      console.log('');
    });
    if (tools && tools.length > 20) {
      console.log(`   ... and ${tools.length - 20} more\n`);
    }
    return;
  }
  
  console.log('ℹ️  To re-process these tools, run: npm run fetch:logos\n');
  console.log('   The fetch-logos script will automatically skip tools with existing');
  console.log('   storage images, so you can safely re-run it.\n');
  console.log('   OR run the reprocess-failed-tools.js script which focuses on');
  console.log('   tools with placeholder/default images.\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  reprocessPlaceholderImages(dryRun)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { reprocessPlaceholderImages };

