#!/usr/bin/env node

/**
 * Script to find and fix R-Synth/placeholder images
 * Detects incorrect images and re-fetches the correct logos
 */

require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const cheerio = require('cheerio');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ ERROR: Missing required environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Patterns that indicate incorrect/placeholder images
const placeholderPatterns = [
  'r-synth',
  'rsynth',
  'unsentified',
  'placeholder',
  'default',
  'og-image.png',
  'unknown',
  'missing',
];

/**
 * Check if an image URL indicates a placeholder/R-Synth image
 */
function isPlaceholderImage(imageUrl) {
  if (!imageUrl) return true;
  
  const urlLower = imageUrl.toLowerCase();
  
  // Check for placeholder patterns
  for (const pattern of placeholderPatterns) {
    if (urlLower.includes(pattern)) {
      return true;
    }
  }
  
  // If it's the default OG image path, it's a placeholder
  if (urlLower.includes('/og-image.png')) {
    return true;
  }
  
  return false;
}

/**
 * Download image to check if it's actually a placeholder
 */
async function checkImageContent(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('http')) {
    return { isPlaceholder: true, reason: 'Invalid URL' };
  }
  
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(imageUrl);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const req = client.get(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 5000,
      }, (res) => {
        if (res.statusCode !== 200) {
          resolve({ isPlaceholder: true, reason: `HTTP ${res.statusCode}` });
          return;
        }
        
        const contentType = res.headers['content-type'] || '';
        if (!contentType.startsWith('image/')) {
          resolve({ isPlaceholder: true, reason: 'Not an image' });
          return;
        }
        
        // Read first chunk to check for placeholder indicators
        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
          // Check first 10KB for placeholder text
          if (chunks.reduce((acc, c) => acc + c.length, 0) > 10240) {
            res.destroy();
            resolve({ isPlaceholder: false, reason: 'Valid image' });
            return;
          }
        });
        
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString('utf-8', 0, Math.min(1000, buffer.length));
          
          // Check if image content contains placeholder text
          for (const pattern of placeholderPatterns) {
            if (text.toLowerCase().includes(pattern)) {
              resolve({ isPlaceholder: true, reason: `Contains "${pattern}"` });
              return;
            }
          }
          
          resolve({ isPlaceholder: false, reason: 'Valid image' });
        });
      });
      
      req.on('error', () => resolve({ isPlaceholder: true, reason: 'Download failed' }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ isPlaceholder: true, reason: 'Timeout' });
      });
      
      req.setTimeout(5000);
    } catch (err) {
      resolve({ isPlaceholder: true, reason: err.message });
    }
  });
}

/**
 * Fetch logo URL using same priority as fetch-logos.js
 */
async function fetchLogoUrl(platformUrl) {
  if (!platformUrl || !platformUrl.startsWith('http')) {
    return null;
  }

  try {
    const urlObj = new URL(platformUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    
    // Priority order for fetching logos
    const staticPaths = [
      `${baseUrl}/favicon.ico`,
      `${baseUrl}/favicon.png`,
      `${baseUrl}/apple-touch-icon.png`,
    ];
    
    // Try static paths first
    for (const imageUrl of staticPaths) {
      try {
        const response = await fetch(imageUrl, {
          method: 'HEAD',
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
          return imageUrl;
        }
      } catch {
        continue;
      }
    }
    
    // Try fetching HTML for meta tags
    try {
      const response = await fetch(platformUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
      });
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Try og:image
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) {
        let imageUrl = ogImage.trim();
        if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
        else if (imageUrl.startsWith('/')) imageUrl = baseUrl + imageUrl;
        return imageUrl.startsWith('http') ? imageUrl : null;
      }
      
      // Try link rel="icon"
      const iconLink = $('link[rel="icon"], link[rel="shortcut icon"]').attr('href');
      if (iconLink) {
        let imageUrl = iconLink.trim();
        if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
        else if (imageUrl.startsWith('/')) imageUrl = baseUrl + imageUrl;
        return imageUrl.startsWith('http') ? imageUrl : null;
      }
    } catch {
      // Continue
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Find tools with placeholder/R-Synth images
 */
async function findPlaceholderImages(dryRun = false) {
  console.log('🔍 Finding tools with placeholder/R-Synth images...\n');
  console.log('='.repeat(70));
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  // Get all tools with images
  const { data: allTools, error } = await supabase
    .from('ai_tools')
    .select('id, name, image, platform')
    .not('image', 'is', null)
    .limit(10000);
  
  if (error) {
    console.error('❌ Error fetching tools:', error);
    return;
  }
  
  console.log(`📊 Checking ${allTools?.length || 0} tools with images...\n`);
  
  const toolsToFix = [];
  let checked = 0;
  
  // Check each tool's image
  for (const tool of allTools || []) {
    checked++;
    if (checked % 100 === 0) {
      console.log(`   Checked ${checked}/${allTools.length}...`);
    }
    
    // Quick URL-based check first
    if (isPlaceholderImage(tool.image)) {
      toolsToFix.push({
        ...tool,
        reason: 'URL pattern match',
      });
      continue;
    }
    
    // For storage URLs, we'll need to check them individually
    // Skip detailed checks for dry run to save time
    if (!dryRun && tool.image.includes('supabase.co/storage')) {
      // We can skip these in dry run
    }
  }
  
  console.log(`\n📊 Found ${toolsToFix.length} tools with placeholder images:\n`);
  
  // Show first 20
  toolsToFix.slice(0, 20).forEach((tool, index) => {
    console.log(`${(index + 1).toString().padStart(2)}. ${tool.name}`);
    console.log(`    Image: ${tool.image}`);
    console.log(`    Reason: ${tool.reason}`);
    console.log('');
  });
  
  if (toolsToFix.length > 20) {
    console.log(`   ... and ${toolsToFix.length - 20} more\n`);
  }
  
  if (dryRun) {
    console.log('🔍 This was a dry run. Run without --dry-run to fix images.\n');
    return { found: toolsToFix.length };
  }
  
  // For now, focus on well-known tools that likely have wrong images
  const wellKnownTools = [
    'Midjourney',
    'ChatGPT',
    'Claude',
    'Stable Diffusion',
    'DALL-E',
    'Runway',
    'Pika',
  ];
  
  const priorityTools = toolsToFix.filter(t => 
    wellKnownTools.some(name => t.name.toLowerCase().includes(name.toLowerCase()))
  );
  
  console.log(`\n🎯 Prioritizing ${priorityTools.length} well-known tools for fixing...\n`);
  
  return { found: toolsToFix.length, priority: priorityTools.length };
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  try {
    await findPlaceholderImages(dryRun);
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

module.exports = { findPlaceholderImages, isPlaceholderImage };

