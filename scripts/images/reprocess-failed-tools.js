#!/usr/bin/env node

/**
 * Re-process tools that failed or have default/empty images
 * Filters tools that need processing and runs logo fetching on them
 */

require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONCURRENT_REQUESTS = 10;
const DEFAULT_IMAGE_PATH = '/og-image.png';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ ERROR: Missing required environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const stats = {
  total: 0,
  processed: 0,
  uploaded: 0,
  failed: 0,
  skipped: 0,
};

async function getToolsToReprocess() {
  console.log('🔍 Finding tools that need reprocessing...\n');
  
  // Fetch tools that need processing:
  // 1. No image
  // 2. Default image
  // 3. Empty string image
  
  let allTools = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: tools, error } = await supabase
      .from('ai_tools')
      .select('id, name, platform, image')
      .or('image.is.null,image.eq.,image.eq.' + DEFAULT_IMAGE_PATH)
      .order('popularity', { ascending: false })
      .range(offset, offset + batchSize - 1);
    
    if (error) {
      console.error(`Error fetching tools: ${error.message}`);
      break;
    }
    
    if (!tools || tools.length === 0) {
      hasMore = false;
      break;
    }
    
    allTools.push(...tools);
    
    if (tools.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
    }
  }
  
  // Filter out tools that already have storage images
  const toolsToProcess = allTools.filter(tool => {
    if (!tool.image || tool.image === '') return true;
    if (tool.image === DEFAULT_IMAGE_PATH) return true;
    if (tool.image.includes('/og-image.png') || tool.image.includes('/assets/default.png')) return true;
    // Skip tools that already have storage URLs (unless they're placeholders)
    if (tool.image.includes('supabase.co/storage')) {
      // Check if it's a placeholder/R-Synth image in storage
      const urlLower = tool.image.toLowerCase();
      if (urlLower.includes('r-synth') || urlLower.includes('rsynth') || 
          urlLower.includes('unsentified') || urlLower.includes('placeholder')) {
        return true; // Re-process placeholder images in storage
      }
      return false; // Skip valid storage images
    }
    // Process tools with external URLs that might have failed
    return true;
  });
  
  return toolsToProcess;
}

async function main() {
  console.log('🔄 Starting reprocessing of failed/default tools...\n');

  try {
    const tools = await getToolsToReprocess();
    
    if (tools.length === 0) {
      console.log('✅ No tools need reprocessing!');
      return;
    }

    stats.total = tools.length;
    console.log(`📦 Found ${tools.length} tools to reprocess\n`);
    console.log('💡 Tip: The fetch-logos.js script will process all tools.');
    console.log('   Tools without storage images will be prioritized.\n');
    console.log('   Running fetch-logos.js now...\n');
    
    // Simply run the main fetch-logos script
    // It will process all tools, but tools with default/empty images will be updated
    try {
      execSync('node scripts/fetch-logos.js', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('\n✅ Reprocessing initiated!\n');
    } catch (execError) {
      console.error('❌ Error running fetch-logos.js:', execError.message);
      throw execError;
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { getToolsToReprocess };

