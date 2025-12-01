#!/usr/bin/env node

/**
 * Check tool image status in database
 * Reports how many tools have images, missing images, default images, etc.
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

async function checkToolImages() {
  console.log('🔍 Checking tool images in database...\n');

  try {
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('ai_tools')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    console.log(`📊 Total tools in database: ${totalCount}\n`);

    // Get tools with images
    const { data: toolsWithImages, error: withImagesError } = await supabase
      .from('ai_tools')
      .select('id, name, image')
      .not('image', 'is', null);

    if (withImagesError) {
      throw withImagesError;
    }

    const imagesCount = toolsWithImages?.length || 0;
    
    // Count by image source type
    const storageImages = toolsWithImages?.filter(t => 
      t.image && t.image.includes('supabase.co/storage')
    ).length || 0;
    
    const defaultImages = toolsWithImages?.filter(t => 
      t.image && (t.image.includes('/og-image.png') || t.image.includes('/assets/default.png'))
    ).length || 0;
    
    const externalImages = imagesCount - storageImages - defaultImages;

    // Get tools without images
    const { data: toolsWithoutImages, error: withoutImagesError } = await supabase
      .from('ai_tools')
      .select('id, name, platform')
      .or('image.is.null,image.eq.');

    if (withoutImagesError) {
      throw withoutImagesError;
    }

    const missingCount = toolsWithoutImages?.length || 0;

    // Get tools with invalid/empty image URLs
    const { data: allTools, error: allError } = await supabase
      .from('ai_tools')
      .select('id, name, image, platform')
      .order('popularity', { ascending: false });

    if (allError) {
      throw allError;
    }

    const invalidImages = allTools?.filter(t => 
      t.image && 
      t.image.trim() !== '' && 
      !t.image.startsWith('http') && 
      !t.image.startsWith('/')
    ).length || 0;

    // Generate report
    console.log('='.repeat(60));
    console.log('📈 IMAGE STATUS REPORT');
    console.log('='.repeat(60));
    console.log(`   Total tools: ${totalCount}`);
    console.log(`   ✅ Tools with images: ${imagesCount} (${((imagesCount/totalCount)*100).toFixed(1)}%)`);
    console.log(`      - Storage images: ${storageImages}`);
    console.log(`      - External URLs: ${externalImages}`);
    console.log(`      - Default images: ${defaultImages}`);
    console.log(`   ❌ Tools without images: ${missingCount} (${((missingCount/totalCount)*100).toFixed(1)}%)`);
    console.log(`   ⚠️  Invalid image URLs: ${invalidImages}`);
    console.log('='.repeat(60));

    // Show sample of tools without images
    if (missingCount > 0 && toolsWithoutImages) {
      console.log(`\n📋 Sample of tools without images (showing first 20):\n`);
      toolsWithoutImages.slice(0, 20).forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.name} - ${tool.platform || 'N/A'}`);
      });
      if (missingCount > 20) {
        console.log(`   ... and ${missingCount - 20} more`);
      }
    }

    // Check storage URL format
    if (storageImages > 0 && toolsWithImages) {
      const storageUrls = toolsWithImages
        .filter(t => t.image && t.image.includes('supabase.co/storage'))
        .slice(0, 5);
      
      if (storageUrls.length > 0) {
        console.log(`\n📦 Sample storage URLs (showing first 5):\n`);
        storageUrls.forEach((tool, index) => {
          console.log(`   ${index + 1}. ${tool.name}`);
          console.log(`      ${tool.image}`);
        });
      }
    }

    return {
      total: totalCount,
      withImages: imagesCount,
      withoutImages: missingCount,
      storageImages,
      defaultImages,
      externalImages,
      invalidImages,
    };

  } catch (error) {
    console.error('❌ Error checking tool images:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  checkToolImages()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { checkToolImages };

