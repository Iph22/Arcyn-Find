#!/usr/bin/env node

/**
 * Fully automated pipeline that fetches logo images for AI tools,
 * uploads them to Supabase Storage, and updates the database
 */

// Load environment variables from .env and .env.local
require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

// Configuration
const CONCURRENT_REQUESTS = 10;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 10000; // 10 seconds
const BUCKET_NAME = 'tools'; // Public bucket for tool logos
const DEFAULT_IMAGE_PATH = '/og-image.png'; // Fallback to OG image if no logo found

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ ERROR: Missing required environment variables!');
  console.error('Please set:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Custom fetch with better timeout and retry handling
async function customFetch(url, options = {}) {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  
  throw lastError;
}

// Create Supabase client with custom fetch
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: customFetch,
  },
});

// Statistics
const stats = {
  total: 0,
  processed: 0,
  uploaded: 0,
  failed: 0,
  skipped: 0,
  missingFavicon: [],
  failedUploads: [],
  failedUpdates: [],
};

/**
 * Get domain from URL
 */
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

/**
 * Get base URL from platform URL
 */
function getBaseUrl(platformUrl) {
  try {
    const url = new URL(platformUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Fetch HTML content from URL
 */
async function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: REQUEST_TIMEOUT,
      };

      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
          // Limit to first 500KB to avoid memory issues
          if (data.length > 500000) {
            res.destroy();
            resolve(data);
            return;
          }
        });

        res.on('end', () => resolve(data));
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.setTimeout(REQUEST_TIMEOUT);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Download image from URL to Buffer
 */
async function downloadImage(imageUrl) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(imageUrl);
      const client = urlObj.protocol === 'https:' ? https : http;

      const req = client.get(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*',
          'Referer': `${urlObj.protocol}//${urlObj.host}`,
        },
        timeout: REQUEST_TIMEOUT,
      }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const contentType = res.headers['content-type'] || '';
        if (!contentType.startsWith('image/') && !contentType.includes('svg') && !contentType.includes('icon')) {
          reject(new Error(`Invalid content type: ${contentType}`));
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
          // Limit to 5MB max
          if (chunks.reduce((acc, c) => acc + c.length, 0) > 5 * 1024 * 1024) {
            res.destroy();
            reject(new Error('Image too large (max 5MB)'));
            return;
          }
        });

        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({ buffer, contentType });
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Download timeout'));
      });

      req.setTimeout(REQUEST_TIMEOUT);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Check if URL is accessible and returns an image
 */
async function checkImageUrl(url) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) {
      resolve(false);
      return;
    }

    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;

      const req = client.request(url, {
        method: 'HEAD',
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }, (res) => {
        const contentType = res.headers['content-type'] || '';
        const isValid = res.statusCode === 200 && (
          contentType.startsWith('image/') ||
          contentType.includes('svg') ||
          url.includes('favicon') ||
          url.includes('icon')
        );
        resolve(isValid);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.setTimeout(3000);
      req.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Fetch logo image URL using priority order
 */
async function fetchLogoUrl(platformUrl, toolName, retries = MAX_RETRIES) {
  if (!platformUrl || !platformUrl.startsWith('http')) {
    return null;
  }

  const baseUrl = getBaseUrl(platformUrl);
  if (!baseUrl) return null;

  // Priority order:
  // 1. /favicon.ico
  // 2. /favicon.png
  // 3. apple-touch-icon
  // 4. <link rel="icon">
  // 5. <meta property="og:image">

  // Try static paths first
  const staticPaths = [
    `${baseUrl}/favicon.ico`,
    `${baseUrl}/favicon.png`,
    `${baseUrl}/apple-touch-icon.png`,
    `${baseUrl}/apple-touch-icon-precomposed.png`,
  ];

  for (const imageUrl of staticPaths) {
    try {
      // Skip R-Synth/placeholder images
      const urlLower = imageUrl.toLowerCase();
      if (urlLower.includes('r-synth') || urlLower.includes('rsynth') || 
          urlLower.includes('unsentified') || urlLower.includes('placeholder')) {
        continue;
      }
      
      const isValid = await checkImageUrl(imageUrl);
      if (isValid) {
        return imageUrl;
      }
    } catch (err) {
      // Continue to next path
    }
  }

  // Try fetching HTML and parsing meta tags
  try {
    const html = await fetchHTML(platformUrl);
    if (!html) return null;

    const $ = cheerio.load(html);
    const base = baseUrl;
    const discoveredPaths = [];

    // Try <link rel="icon">
    $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        let imageUrl = href.trim();
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          imageUrl = base + imageUrl;
        } else if (!imageUrl.startsWith('http')) {
          imageUrl = base + '/' + imageUrl;
        }
        
        // Validate URL format
        if (imageUrl.startsWith('http')) {
          discoveredPaths.push(imageUrl);
        }
      }
    });

    // Try <meta property="og:image">
    const ogImage = $('meta[property="og:image"]').attr('content') ||
                    $('meta[name="twitter:image"]').attr('content');
    
    if (ogImage) {
      let imageUrl = ogImage.trim();
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        imageUrl = base + imageUrl;
      } else if (!imageUrl.startsWith('http')) {
        imageUrl = base + '/' + imageUrl;
      }
      
      if (imageUrl.startsWith('http')) {
        discoveredPaths.push(imageUrl);
      }
    }

    // Check all discovered paths
    for (const imageUrl of discoveredPaths) {
      try {
        // Skip R-Synth/placeholder images
        const urlLower = imageUrl.toLowerCase();
        if (urlLower.includes('r-synth') || urlLower.includes('rsynth') || 
            urlLower.includes('unsentified') || urlLower.includes('placeholder')) {
          continue;
        }
        
        const isValid = await checkImageUrl(imageUrl);
        if (isValid) {
          return imageUrl;
        }
      } catch (err) {
        // Continue
      }
    }
  } catch (err) {
    // If HTML fetch fails, return null
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchLogoUrl(platformUrl, toolName, retries - 1);
    }
  }

  return null;
}

/**
 * Ensure storage bucket exists
 */
async function ensureBucketExists() {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.warn(`⚠️  Could not list buckets: ${listError.message}`);
      console.warn(`   This might be a network issue. Continuing anyway...`);
      // Return true to continue - upload will fail if bucket doesn't exist
      return true;
    }

    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
    
    if (!bucketExists) {
      console.log(`📦 Creating bucket '${BUCKET_NAME}'...`);
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'],
        fileSizeLimit: 5242880, // 5MB
      });

      if (createError) {
        // Don't fail if bucket already exists (race condition)
        if (createError.message.includes('already exists') || createError.message.includes('duplicate')) {
          console.log(`✅ Bucket '${BUCKET_NAME}' already exists`);
          return true;
        }
        console.warn(`⚠️  Could not create bucket: ${createError.message}`);
        console.warn(`   Bucket may already exist or you may need to create it manually.`);
        // Return true to continue - upload will fail if bucket doesn't exist
        return true;
      }
      console.log(`✅ Bucket '${BUCKET_NAME}' created`);
    } else {
      console.log(`✅ Bucket '${BUCKET_NAME}' already exists`);
    }

    return true;
  } catch (error) {
    console.warn(`⚠️  Error ensuring bucket exists: ${error.message}`);
    console.warn(`   Continuing anyway - upload will fail if bucket doesn't exist.`);
    // Return true to continue
    return true;
  }
}

/**
 * Upload image buffer to Supabase Storage
 */
async function uploadToStorage(toolId, buffer, contentType) {
  try {
    // Normalize content type - map problematic MIME types to supported ones
    let normalizedContentType = contentType || 'image/png';
    if (contentType.includes('vnd.microsoft.icon') || contentType.includes('x-icon')) {
      normalizedContentType = 'image/x-icon';
    }
    
    // Determine file extension from content type
    let fileExtension = 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      fileExtension = 'jpg';
      normalizedContentType = 'image/jpeg';
    } else if (contentType.includes('gif')) {
      fileExtension = 'gif';
      normalizedContentType = 'image/gif';
    } else if (contentType.includes('svg')) {
      fileExtension = 'svg';
      normalizedContentType = 'image/svg+xml';
    } else if (contentType.includes('icon') || contentType.includes('x-icon') || contentType.includes('vnd.microsoft.icon')) {
      fileExtension = 'ico';
      normalizedContentType = 'image/x-icon';
    } else if (contentType.includes('webp')) {
      fileExtension = 'webp';
      normalizedContentType = 'image/webp';
    }

    const fileName = `${toolId}.${fileExtension}`;
    const filePath = `tools/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        cacheControl: '31536000', // 1 year
        upsert: true,
        contentType: normalizedContentType,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

/**
 * Update tool's image field in database
 */
async function updateToolImage(toolId, imageUrl) {
  try {
    const { error } = await supabase
      .from('ai_tools')
      .update({ image: imageUrl })
      .eq('id', toolId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    throw new Error(`Database update failed: ${error.message}`);
  }
}

/**
 * Process a single tool with retry logic
 */
async function processTool(tool, retries = MAX_RETRIES) {
  const { id, name, platform } = tool;

  try {
    // Fetch logo URL
    const logoUrl = await fetchLogoUrl(platform, name);
    
    if (!logoUrl) {
      stats.missingFavicon.push({ id, name, platform });
      // Set default image
      await updateToolImage(id, DEFAULT_IMAGE_PATH);
      stats.skipped++;
      console.log(`   ⚠️  No favicon found - using default`);
      return { success: true, skipped: true };
    }

    // Download image
    const { buffer, contentType } = await downloadImage(logoUrl);

    // Upload to storage
    const storageUrl = await uploadToStorage(id, buffer, contentType);

    // Update database
    await updateToolImage(id, storageUrl);

    stats.uploaded++;
    console.log(`   ✅ Uploaded to: ${storageUrl}`);
    return { success: true, url: storageUrl };

  } catch (error) {
    if (retries > 0) {
      console.log(`   🔄 Retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return processTool(tool, retries - 1);
    }

    stats.failed++;
    
    // Determine failure type for logging
    if (error.message.includes('Upload failed')) {
      stats.failedUploads.push({ id, name, error: error.message });
    } else if (error.message.includes('Database update failed')) {
      stats.failedUpdates.push({ id, name, error: error.message });
    } else {
      stats.missingFavicon.push({ id, name, platform });
    }

    console.log(`   ❌ Failed: ${error.message}`);
    
    // Try to set default image on failure
    try {
      await updateToolImage(id, DEFAULT_IMAGE_PATH);
    } catch (updateError) {
      // Ignore update errors for defaults
    }

    return { success: false, error: error.message };
  }
}

/**
 * Rate-limited concurrent processing
 */
async function processToolsWithRateLimit(tools) {
  const queue = [...tools];
  const inProgress = new Set();
  const results = [];

  async function processNext() {
    if (queue.length === 0) return;

    const tool = queue.shift();
    const taskId = `${tool.id}-${Date.now()}`;
    inProgress.add(taskId);

    try {
      // Skip tools that already have valid storage images
      // But process tools with placeholder images
      if (tool.image && tool.image.includes('supabase.co/storage')) {
        // Check if it's a placeholder/R-Synth image
        const urlLower = tool.image.toLowerCase();
        if (urlLower.includes('r-synth') || urlLower.includes('rsynth') || 
            urlLower.includes('unsentified') || urlLower.includes('placeholder')) {
          // Re-process placeholder images in storage
          stats.processed++;
          console.log(`\n[${stats.processed}/${stats.total}] Re-processing (placeholder): ${tool.name}`);
          console.log(`   Platform: ${tool.platform || 'N/A'}`);
          const result = await processTool(tool);
          results.push({ tool, result });
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          // Skip valid storage images
          stats.skipped++;
        }
      } else if (tool.image && (tool.image.includes('/og-image.png') || tool.image === '/og-image.png')) {
        // Process tools with placeholder images
        stats.processed++;
        console.log(`\n[${stats.processed}/${stats.total}] Re-processing (placeholder): ${tool.name}`);
        console.log(`   Platform: ${tool.platform || 'N/A'}`);
        const result = await processTool(tool);
        results.push({ tool, result });
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        stats.processed++;
        console.log(`\n[${stats.processed}/${stats.total}] Processing: ${tool.name}`);
        console.log(`   Platform: ${tool.platform || 'N/A'}`);

        const result = await processTool(tool);
        results.push({ tool, result });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error(`Error processing ${tool.name}:`, error.message);
      stats.failed++;
    } finally {
      inProgress.delete(taskId);
      
      // Process next item
      if (queue.length > 0) {
        await processNext();
      }
    }
  }

  // Start concurrent workers
  const workers = Array(Math.min(CONCURRENT_REQUESTS, queue.length))
    .fill(null)
    .map(() => processNext());

  await Promise.all(workers);

  return results;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting logo fetching pipeline...\n');
  console.log(`⚙️  Configuration:`);
  console.log(`   - Concurrent requests: ${CONCURRENT_REQUESTS}`);
  console.log(`   - Max retries: ${MAX_RETRIES}`);
  console.log(`   - Timeout: ${REQUEST_TIMEOUT}ms`);
  console.log(`   - Bucket: ${BUCKET_NAME}\n`);

  try {
    // Ensure bucket exists (non-critical - continue even if check fails)
    const bucketReady = await ensureBucketExists();
    if (!bucketReady) {
      console.warn('⚠️  Could not verify bucket exists. Continuing anyway...');
      console.warn('   Make sure the "tools" bucket exists in Supabase Storage.');
      console.warn('   The script will attempt to upload and create it if needed.\n');
    }

    // Test connection first
    console.log('🔌 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('ai_tools')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('\n❌ Cannot connect to Supabase!');
      console.error(`   Error: ${testError.message}`);
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify NEXT_PUBLIC_SUPABASE_URL is correct');
      console.error('   3. Verify SUPABASE_SERVICE_ROLE_KEY is correct');
      console.error('   4. Check if Supabase service is accessible');
      process.exit(1);
    }
    console.log('✅ Connection successful!\n');

    // Load all tools from database (fetch all without limit)
    console.log('📥 Loading tools from database...');
    
    // Supabase has a default limit, so we need to fetch in batches
    let allTools = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (hasMore) {
      try {
        const { data: tools, error: fetchError } = await supabase
          .from('ai_tools')
          .select('id, name, platform, image')
          .order('popularity', { ascending: false })
          .range(offset, offset + batchSize - 1);
        
        if (fetchError) {
          if (retryCount < maxRetries) {
            retryCount++;
            console.warn(`⚠️  Error fetching tools at offset ${offset}, retrying (${retryCount}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            continue;
          }
          console.error(`❌ Error fetching tools at offset ${offset}: ${fetchError.message}`);
          console.error('   Stopping batch loading. Using tools loaded so far...');
          break;
        }
        
        retryCount = 0; // Reset retry count on success
        
        if (!tools || tools.length === 0) {
          hasMore = false;
          break;
        }
        
        allTools.push(...tools);
        console.log(`   Loaded ${allTools.length} tools so far...`);
        
        if (tools.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      } catch (error) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.warn(`⚠️  Network error, retrying (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          continue;
        }
        console.error(`❌ Fatal error loading tools: ${error.message}`);
        break;
      }
    }
    
    const tools = allTools;

    if (!tools || tools.length === 0) {
      console.log('✅ No tools found in database');
      return;
    }

    stats.total = tools.length;
    console.log(`✅ Found ${tools.length} tools\n`);

    // Process tools with rate limiting
    console.log('🔄 Processing tools...\n');
    await processToolsWithRateLimit(tools);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Total tools: ${stats.total}`);
    console.log(`   ✅ Uploaded: ${stats.uploaded}`);
    console.log(`   ⏭️  Skipped (no favicon): ${stats.skipped}`);
    console.log(`   ❌ Failed: ${stats.failed}`);
    console.log('='.repeat(60));

    // Log missing favicons
    if (stats.missingFavicon.length > 0) {
      console.log(`\n⚠️  Missing Favicons (${stats.missingFavicon.length}):`);
      stats.missingFavicon.slice(0, 10).forEach(({ name, platform }) => {
        console.log(`   - ${name} (${platform || 'N/A'})`);
      });
      if (stats.missingFavicon.length > 10) {
        console.log(`   ... and ${stats.missingFavicon.length - 10} more`);
      }
    }

    // Log failed uploads
    if (stats.failedUploads.length > 0) {
      console.log(`\n❌ Failed Uploads (${stats.failedUploads.length}):`);
      stats.failedUploads.slice(0, 10).forEach(({ name, error }) => {
        console.log(`   - ${name}: ${error}`);
      });
      if (stats.failedUploads.length > 10) {
        console.log(`   ... and ${stats.failedUploads.length - 10} more`);
      }
    }

    // Log failed updates
    if (stats.failedUpdates.length > 0) {
      console.log(`\n❌ Failed Database Updates (${stats.failedUpdates.length}):`);
      stats.failedUpdates.slice(0, 10).forEach(({ name, error }) => {
        console.log(`   - ${name}: ${error}`);
      });
      if (stats.failedUpdates.length > 10) {
        console.log(`   ... and ${stats.failedUpdates.length - 10} more`);
      }
    }

    console.log('\n✅ Logo fetching complete!\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { fetchLogoUrl, processTool };

