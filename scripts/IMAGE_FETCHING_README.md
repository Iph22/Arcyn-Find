# Tool Image Fetching

This directory contains scripts to fetch AI tool images directly from their creator websites.

## Files

### `fetch-tool-images.js`
Utility module that fetches images from tool websites using multiple methods:
1. **Open Graph images** - Extracts `og:image` meta tags (best quality)
2. **Common logo paths** - Tries common paths like `/logo.png`, `/logo.svg`, etc.
3. **Google Favicon API** - Falls back to Google's favicon service (always works)

### `fetch-ai-tools.js` (Updated)
Main script for fetching tools from OpenTools.ai. Now automatically fetches images from platform URLs when OpenTools doesn't provide them.

### `update-tool-images.js`
Script to update existing tools in Supabase database that have null images.

## Usage

### 1. Fetch New Tools with Images

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

### 2. Update Existing Tools with Missing Images

```bash
node scripts/update-tool-images.js
```

This will:
- Find all tools in Supabase with null/empty images
- Fetch images from their platform URLs
- Update the database

**Note:** Requires environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. Test Image Fetching

```bash
node scripts/fetch-tool-images.js
```

Tests the image fetching with sample URLs (Gemini, OpenAI, Claude, etc.)

## How It Works

### Image Fetching Priority

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
- 200ms delay between image fetches in `fetch-ai-tools.js`
- 300ms delay in `update-tool-images.js`

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

