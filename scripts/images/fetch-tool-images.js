#!/usr/bin/env node

/**
 * Fetch tool images from their official websites
 * Tries multiple methods: favicon API, OG images, common logo paths
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

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
 * Fetch favicon using Google's favicon API
 */
function getFaviconUrl(domain) {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

/**
 * Try common logo paths
 */
function getCommonLogoPaths(baseUrl) {
  try {
    const url = new URL(baseUrl);
    const base = `${url.protocol}//${url.host}`;
    return [
      `${base}/logo.png`,
      `${base}/logo.svg`,
      `${base}/logo.jpg`,
      `${base}/favicon.ico`,
      `${base}/apple-touch-icon.png`,
      `${base}/images/logo.png`,
      `${base}/assets/logo.png`,
      `${base}/static/logo.png`,
      `${base}/img/logo.png`,
      `${base}/_next/static/media/logo`,
    ];
  } catch {
    return [];
  }
}

/**
 * Fetch HTML and extract Open Graph image
 */
async function fetchOGImage(url) {
  return new Promise((resolve) => {
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
        timeout: 5000,
      };

      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
          // Only read first 100KB to find meta tags
          if (data.length > 100000) {
            res.destroy();
            parseOGImage(data, url, resolve);
          }
        });

        res.on('end', () => {
          parseOGImage(data, url, resolve);
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });

      req.setTimeout(5000);
      req.end();
    } catch (err) {
      resolve(null);
    }
  });
}

/**
 * Parse HTML for Open Graph image
 */
function parseOGImage(html, baseUrl, resolve) {
  if (!html) {
    resolve(null);
    return;
  }

  try {
    const baseUrlObj = new URL(baseUrl);
    const base = `${baseUrlObj.protocol}//${baseUrlObj.host}`;

    // Try og:image
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                         html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
      let imageUrl = ogImageMatch[1].trim();
      // Convert relative URLs to absolute
      if (imageUrl.startsWith('//')) {
        resolve('https:' + imageUrl);
        return;
      } else if (imageUrl.startsWith('/')) {
        resolve(base + imageUrl);
        return;
      } else if (imageUrl.startsWith('http')) {
        resolve(imageUrl);
        return;
      }
    }

    // Try twitter:image
    const twitterImageMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                                   html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i);
    if (twitterImageMatch && twitterImageMatch[1]) {
      let imageUrl = twitterImageMatch[1].trim();
      if (imageUrl.startsWith('//')) {
        resolve('https:' + imageUrl);
        return;
      } else if (imageUrl.startsWith('/')) {
        resolve(base + imageUrl);
        return;
      } else if (imageUrl.startsWith('http')) {
        resolve(imageUrl);
        return;
      }
    }

    // Try link rel="icon" or "apple-touch-icon"
    const iconMatch = html.match(/<link\s+rel=["'](?:icon|apple-touch-icon)["']\s+href=["']([^"']+)["']/i) ||
                     html.match(/<link\s+href=["']([^"']+)["']\s+rel=["'](?:icon|apple-touch-icon)["']/i);
    if (iconMatch && iconMatch[1]) {
      let imageUrl = iconMatch[1].trim();
      if (imageUrl.startsWith('//')) {
        resolve('https:' + imageUrl);
        return;
      } else if (imageUrl.startsWith('/')) {
        resolve(base + imageUrl);
        return;
      } else if (imageUrl.startsWith('http')) {
        resolve(imageUrl);
        return;
      }
    }
  } catch (err) {
    // Continue to resolve null
  }

  resolve(null);
}

/**
 * Check if image URL is accessible
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
        }
      }, (res) => {
        const contentType = res.headers['content-type'] || '';
        const isValid = res.statusCode === 200 && (
          contentType.startsWith('image/') || 
          contentType.includes('svg') ||
          url.includes('favicon')
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
 * Main function to get image URL for a tool
 * Returns the best available image URL
 */
async function getToolImage(platformUrl, toolName) {
  if (!platformUrl || !platformUrl.startsWith('http')) {
    return null;
  }

  const domain = getDomain(platformUrl);
  if (!domain) return null;

  // Method 1: Try Open Graph image (best quality)
  try {
    const ogImage = await fetchOGImage(platformUrl);
    if (ogImage) {
      const isValid = await checkImageUrl(ogImage);
      if (isValid) {
        return ogImage;
      }
    }
  } catch (err) {
    // Continue to next method
  }

  // Method 2: Try common logo paths
  const logoPaths = getCommonLogoPaths(platformUrl);
  for (const logoPath of logoPaths) {
    const isValid = await checkImageUrl(logoPath);
    if (isValid) {
      return logoPath;
    }
  }

  // Method 3: Use Google's favicon API (always works, but lower quality)
  const faviconUrl = getFaviconUrl(domain);
  return faviconUrl;
}

module.exports = { getToolImage, getFaviconUrl, getDomain };

// Test if run directly
if (require.main === module) {
  (async () => {
    const testUrls = [
      { url: 'https://gemini.google.com', name: 'Gemini' },
      { url: 'https://openai.com', name: 'OpenAI' },
      { url: 'https://claude.ai', name: 'Claude' },
      { url: 'https://www.anthropic.com', name: 'Anthropic' },
    ];

    console.log('Testing image fetching...\n');
    for (const test of testUrls) {
      console.log(`Testing: ${test.name} (${test.url})`);
      try {
        const image = await getToolImage(test.url, test.name);
        console.log(`  Result: ${image}\n`);
      } catch (err) {
        console.log(`  Error: ${err.message}\n`);
      }
    }
  })();
}

