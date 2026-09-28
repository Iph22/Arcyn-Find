# Tool Image Fetching

This directory contains scripts to fetch AI tool images directly from their creator websites.

## Files

### `fetch-logos.js` ⭐ **NEW - Recommended**
**Fully automated pipeline** that fetches logo images for all AI tools, uploads them to Supabase Storage, and updates the database. This is the recommended script for bulk logo fetching.

Features:
- Downloads actual image files (not just URLs)
- Uploads to Supabase Storage bucket
- Updates database with storage URLs
- Rate limiting (10 concurrent requests)
- Retry logic (3 attempts per tool)
- Comprehensive logging and error tracking

### `fetch-tool-images.js`
Utility module that fetches images from tool websites using multiple methods:
1. **Open Graph images** - Extracts `og:image` meta tags (best quality)
2. **Common logo paths** - Tries common paths like `/logo.png`, `/logo.svg`, etc.
3. **Google Favicon API** - Falls back to Google's favicon service (always works)

### `fetch-ai-tools.js` (Updated)
Main script for fetching tools from OpenTools.ai. Now automatically fetches images from platform URLs when OpenTools doesn't provide them.

### `update-tool-images.js`
Script to update existing tools in Supabase database that have null images. Updates database with image URLs (does not upload to storage).

## Usage

### 1. **Fetch and Upload Logos to Storage** ⭐ **Recommended**

```bash
npm run fetch:logos
```

This is the **main script** for bulk logo processing. It will:
- Load all tools from the database
- Fetch logos using priority order (favicon.ico, favicon.png, apple-touch-icon, link rel="icon", og:image)
- Download images to memory
- Upload to Supabase Storage bucket (`tools/`)
- Update database `image` field with storage URL
- Set default image if no logo found
- Process with rate limiting (10 concurrent)
- Retry failed requests (3 attempts)

**Prerequisites:**
1. Create storage bucket in Supabase Dashboard:
   - Name: `tools`
   - Public: Yes
   - Allowed MIME types: image/jpeg, image/png, image/gif, image/webp, image/svg+xml, image/x-icon
   - Max file size: 5MB

2. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

**The script will:**
- Automatically create the bucket if it doesn't exist
- Process all 6,000+ tools with concurrent requests
- Provide detailed progress logging
- Generate summary statistics

### 2. Fetch New Tools with Images

```bash
node scripts/fetch-ai-tools.js [limit]
```

This will:
- Fetch tools from OpenTools.ai
- For tools without images, fetch from their platform URLs
- Add new tools to the database

**Example:**
```bash
node scripts/fetch-ai-tools.js 10  # Test with 10 tools first
```

### 3. Update Existing Tools with Missing Images (URLs only)

```bash
node scripts/update-tool-images.js
```

This will:
- Find all tools in Supabase with null/empty images
- Fetch images from their platform URLs
- Update the database with URLs (does not upload to storage)

**Note:** Requires environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 4. Test Image Fetching

```bash
node scripts/fetch-tool-images.js
```

Tests the image fetching with sample URLs (Gemini, OpenAI, Claude, etc.)

## How It Works

### Logo Fetching Priority (fetch-logos.js)

The `fetch-logos.js` script uses this priority order:

1. **`/favicon.ico`** - Standard favicon location
2. **`/favicon.png`** - PNG version of favicon
3. **`apple-touch-icon`** - Apple touch icon
4. **`<link rel="icon">`** - Icon link tags from HTML
5. **`<meta property="og:image">`** - Open Graph image (best quality)

For each tool:
- Fetches platform URL HTML
- Parses meta tags and link tags
- Downloads the first valid image found
- Converts to appropriate format
- Uploads to Supabase Storage at `tools/{tool_id}.{ext}`
- Updates database `image` field

### Image Fetching Priority (other scripts)

1. **OpenTools.ai images** (if available)
   - Uses `tool.image`, `tool.logo`, `tool.thumbnail`, etc.

2. **Open Graph images** (if OpenTools has no image)
   - Fetches HTML from platform URL
   - Extracts `<meta property="og:image">` tag
   - Best quality, official images

3. **Common logo paths** (if OG image not found)
   - Tries: `/logo.png`, `/logo.svg`, `/favicon.ico`, etc.
   - Checks if image exists before using

4. **Google Favicon API** (fallback)
   - Uses: `https://www.google.com/s2/favicons?domain=example.com&sz=128`
   - Always works, but lower quality

### Example Results

- **Gemini**: `https://gemini.google.com` → OG image or favicon
- **OpenAI**: `https://openai.com` → Official logo
- **Claude**: `https://claude.ai` → Official logo

## Rate Limiting

The scripts include rate limiting to avoid overwhelming servers:
- **`fetch-logos.js`**: 10 concurrent requests with 300ms delay between each
- `fetch-ai-tools.js`: 200ms delay between image fetches
- `update-tool-images.js`: 300ms delay

## Error Handling

- Network errors are caught and logged
- Tools without valid platform URLs are skipped
- Failed image fetches don't stop the process
- Falls back gracefully to next method

## Benefits

✅ **Better Quality**: Official logos from creator websites  
✅ **Higher Coverage**: Multiple fallback methods  
✅ **Automatic**: Runs during tool import  
✅ **Reliable**: Google Favicon API as final fallback  

## Notes

- Some websites may block automated requests
- Image fetching adds time to the import process
- Favicon API images are lower quality but always available
- OG images are preferred but not always present

