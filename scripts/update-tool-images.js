#!/usr/bin/env node

/**
 * Update tool images in Supabase database
 * Fetches images from tool creator websites for tools with null images
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { getToolImage } = require('./fetch-tool-images');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: Missing required environment variables!');
  console.error('Please set:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function updateToolImages() {
  console.log('🖼️  Starting tool image update...\n');

  try {
    // Fetch all tools with null or empty images
    const { data: tools, error: fetchError } = await supabase
      .from('ai_tools')
      .select('id, name, platform, image')
      .or('image.is.null,image.eq.');

    if (fetchError) {
      console.error('Error fetching tools:', fetchError);
      process.exit(1);
    }

    if (!tools || tools.length === 0) {
      console.log('✅ No tools with missing images found!');
      return;
    }

    console.log(`Found ${tools.length} tools with missing images\n`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      
      if (!tool.platform || !tool.platform.startsWith('http')) {
        skipped++;
        console.log(`⏭️  [${i + 1}/${tools.length}] Skipping ${tool.name} - no valid platform URL`);
        continue;
      }

      try {
        console.log(`\n[${i + 1}/${tools.length}] Fetching image for: ${tool.name}`);
        console.log(`   Platform: ${tool.platform}`);

        const imageUrl = await getToolImage(tool.platform, tool.name);

        if (imageUrl) {
          const { error: updateError } = await supabase
            .from('ai_tools')
            .update({ image: imageUrl })
            .eq('id', tool.id);

          if (updateError) {
            console.error(`   ❌ Error updating: ${updateError.message}`);
            failed++;
          } else {
            console.log(`   ✅ Updated with: ${imageUrl}`);
            updated++;
          }
        } else {
          console.log(`   ⚠️  No image found`);
          failed++;
        }

        // Rate limiting - wait 300ms between requests
        if (i < tools.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error(`   ❌ Error processing ${tool.name}: ${error.message}`);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📦 Total: ${tools.length}`);
    console.log('='.repeat(50) + '\n');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateToolImages()
    .then(() => {
      console.log('✅ Image update complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { updateToolImages };

