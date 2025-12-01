#!/usr/bin/env node

/**
 * Script to fetch AI tools from OpenTools.ai API and add them to the database
 * This script fetches all tools, maps them to our format, and adds new ones
 */

const fs = require('fs');
const path = require('path');
const { getToolImage } = require('./fetch-tool-images');

const OPENTOOLS_API = 'https://opentools.ai/api/tools';
const AI_DATA_PATH = path.join(__dirname, '../lib/ai-data.ts');

// Category mapping from OpenTools categories to our categories
const categoryMapping = {
  'Music Video Generator': 'Video Generation',
  'Deep Fake Nude Generator': 'Computer Vision',
  'Nude Generator': 'Computer Vision',
  'Summarization': 'Learning & Education',
  'Document Interaction': 'Learning & Education',
  'Data Analytics': 'ML Infrastructure',
  'Image Generation': 'Computer Vision',
  'Video Generation': 'Video Generation',
  'Audio/NLP': 'Audio/NLP',
  'Code Generation': 'Code Generation',
  'IDE': 'IDE',
  'IDEs': 'IDE',
  'Development Environment': 'IDE',
  'Generative AI': 'Generative AI',
  'Search/QA': 'Search/QA',
  'Computer Vision': 'Computer Vision',
  'NLP Platform': 'NLP Platform',
  'ML Infrastructure': 'ML Infrastructure',
  'Autonomous AI': 'Autonomous AI',
  'Multimodal Platform': 'Multimodal Platform',
  'Audio/Video Processing': 'Audio/Video Processing',
  'Learning & Education': 'Learning & Education',
};

// Map access type from pricing plans
function determineAccessType(pricingPlans) {
  if (!pricingPlans || pricingPlans.length === 0) return 'Free';
  
  const hasFree = pricingPlans.some(p => p.price === 0 || p.title?.toLowerCase().includes('free'));
  const hasPaid = pricingPlans.some(p => p.price > 0);
  
  if (hasFree && hasPaid) return 'Freemium';
  if (hasPaid) return 'Paid';
  return 'Free';
}

// Format pricing string
function formatPricing(pricingPlans) {
  if (!pricingPlans || pricingPlans.length === 0) return 'Free';
  
  const prices = pricingPlans
    .filter(p => p.price !== undefined && p.price !== null)
    .map(p => {
      const freq = p.cost_frequency === 'monthly' ? '/month' : 
                   p.cost_frequency === 'annual' ? '/year' : '';
      return p.price === 0 ? 'Free' : `$${p.price}${freq}`;
    })
    .filter((v, i, a) => a.indexOf(v) === i); // unique
  
  if (prices.length === 0) return 'Contact for pricing';
  if (prices.length === 1) return prices[0];
  return prices.join(', ');
}

// Determine region (default to Global)
function determineRegion(tool) {
  // Try to extract from tags or description
  const text = `${tool.tags?.join(' ') || ''} ${tool.description || ''}`.toLowerCase();
  if (text.includes('usa') || text.includes('united states')) return 'USA';
  if (text.includes('uk') || text.includes('united kingdom')) return 'UK';
  if (text.includes('eu') || text.includes('europe')) return 'EU';
  if (text.includes('canada')) return 'Canada';
  if (text.includes('china')) return 'China';
  if (text.includes('israel')) return 'Israel';
  if (text.includes('uae') || text.includes('united arab emirates')) return 'UAE';
  return 'Global';
}

// Fetch all tools from OpenTools API
async function fetchAllTools(maxTools = null) {
  const allTools = [];
  let offset = 0;
  const limit = 100; // Fetch 100 at a time for efficiency
  let hasMore = true;
  
  console.log('Fetching tools from OpenTools.ai...');
  if (maxTools) {
    console.log(`Limiting to ${maxTools} tools for testing\n`);
  }
  
  while (hasMore) {
    try {
      const url = `${OPENTOOLS_API}?offset=${offset}&limit=${limit}`;
      const pageNum = Math.floor(offset / limit) + 1;
      console.log(`Fetching page ${pageNum} (offset: ${offset})...`);
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Error fetching: ${response.status} ${response.statusText}`);
        break;
      }
      
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        allTools.push(...data.data);
        console.log(`  ✓ Fetched ${data.data.length} tools (total: ${allTools.length})`);
        
        // Check if we've reached the limit
        if (maxTools && allTools.length >= maxTools) {
          allTools.splice(maxTools);
          console.log(`  Reached limit of ${maxTools} tools`);
          break;
        }
        
        hasMore = data.hasNextPage && data.data.length === limit;
        offset += limit;
        
        // Rate limiting - wait 50ms between requests
        await new Promise(resolve => setTimeout(resolve, 50));
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`Error fetching tools: ${error.message}`);
      hasMore = false;
    }
  }
  
  console.log(`\nTotal tools fetched: ${allTools.length}`);
  return allTools;
}

// Convert OpenTools tool to our AIEntry format
async function convertToAIEntry(tool, index) {
  const category = categoryMapping[tool.category] || 'Generative AI';
  const accessType = determineAccessType(tool.pricing_plans);
  const pricing = formatPricing(tool.pricing_plans);
  const region = determineRegion(tool);
  
  // Extract tags
  const tags = tool.tags || [];
  if (tool.category_slug) {
    tags.push(tool.category_slug.replace(/-/g, '-'));
  }
  
  // Use summary if available, otherwise description
  const description = tool.summary || tool.description || tool.headline || 'AI tool';
  
  // Calculate popularity (0-100) based on favorite count and rating
  let popularity = 50; // default
  if (tool.favouriteCount) {
    popularity = Math.min(100, Math.max(50, Math.floor(Math.log10(tool.favouriteCount + 1) * 15)));
  }
  if (tool.average_rating) {
    popularity = Math.min(100, popularity + (tool.average_rating - 3) * 10);
  }
  
  // Extract image URL - try multiple possible fields from OpenTools first
  let imageUrl = null;
  if (tool.image) {
    imageUrl = tool.image;
  } else if (tool.logo) {
    imageUrl = tool.logo;
  } else if (tool.thumbnail) {
    imageUrl = tool.thumbnail;
  } else if (tool.screenshot) {
    imageUrl = tool.screenshot;
  } else if (tool.og_image) {
    imageUrl = tool.og_image;
  }
  
  // If no image from OpenTools, try fetching from platform URL
  if (!imageUrl && tool.tool_url) {
    try {
      const platformImage = await getToolImage(tool.tool_url, tool.tool_name || 'Unknown Tool');
      if (platformImage) {
        imageUrl = platformImage;
      }
    } catch (err) {
      // Silently fail - we'll just use null
      console.error(`  ⚠️  Error fetching image for ${tool.tool_name}: ${err.message}`);
    }
  }
  
  return {
    id: `ot-${tool.id}`,
    name: tool.tool_name?.trim() || 'Unknown Tool',
    category,
    description: description.substring(0, 200), // Limit description length
    platform: tool.tool_url || `https://opentools.ai/tools/${tool.slug}`,
    region,
    accessType,
    pricing,
    tags: [...new Set(tags)].slice(0, 10), // Unique tags, max 10
    popularity: Math.round(popularity),
    lastUpdated: new Date().toISOString().split('T')[0],
    isTrending: tool.featured_default || false,
    image: imageUrl || null,
  };
}

// Read existing AI entries
function readExistingEntries() {
  const content = fs.readFileSync(AI_DATA_PATH, 'utf-8');
  const entries = [];
  
  // Extract all tool names using regex
  const nameRegex = /name:\s*"([^"]+)"/g;
  let match;
  while ((match = nameRegex.exec(content)) !== null) {
    entries.push(match[1].toLowerCase().trim());
  }
  
  return new Set(entries);
}

// Check if tool already exists (fuzzy match)
function toolExists(toolName, existingNames) {
  const normalized = toolName.toLowerCase().trim();
  
  // Exact match
  if (existingNames.has(normalized)) return true;
  
  // Fuzzy match - check if name is very similar
  for (const existing of existingNames) {
    const similarity = calculateSimilarity(normalized, existing);
    if (similarity > 0.9) return true; // 90% similarity threshold
  }
  
  return false;
}

// Simple similarity calculation (Levenshtein distance based)
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Generate TypeScript entry string
function generateEntryString(entry, index) {
  return `  {
    id: "${entry.id}",
    name: "${entry.name.replace(/"/g, '\\"')}",
    category: "${entry.category}",
    description: "${entry.description.replace(/"/g, '\\"').replace(/\n/g, ' ')}",
    platform: "${entry.platform}",
    region: "${entry.region}",
    accessType: "${entry.accessType}",
    pricing: "${entry.pricing}",
    tags: [${entry.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ')}],
    popularity: ${entry.popularity},
    lastUpdated: "${entry.lastUpdated}",
${entry.isTrending ? '    isTrending: true,' : ''}
  },`;
}

// Main function
async function main() {
  console.log('Starting AI tools import from OpenTools.ai...\n');
  
  // Check for limit argument
  const maxTools = process.argv[2] ? parseInt(process.argv[2]) : null;
  if (maxTools) {
    console.log(`⚠️  Running in test mode: limiting to ${maxTools} tools\n`);
  }
  
  // Read existing entries
  console.log('Reading existing entries...');
  const existingNames = readExistingEntries();
  console.log(`Found ${existingNames.size} existing tools\n`);
  
  // Fetch all tools
  const openTools = await fetchAllTools(maxTools);
  
  // Convert and filter
  console.log('\nConverting and filtering tools...');
  const newEntries = [];
  let skipped = 0;
  let processed = 0;
  
  for (const tool of openTools) {
    if (!tool.tool_name || tool.archived || !tool.published) {
      skipped++;
      continue;
    }
    
    // Skip NSFW tools
    if (tool.nsfw) {
      skipped++;
      continue;
    }
    
    // Check if already exists
    if (toolExists(tool.tool_name, existingNames)) {
      skipped++;
      continue;
    }
    
    try {
      processed++;
      if (processed % 10 === 0) {
        console.log(`  Processing tool ${processed}/${openTools.length}...`);
      }
      
      const entry = await convertToAIEntry(tool, newEntries.length);
      newEntries.push(entry);
      existingNames.add(entry.name.toLowerCase().trim());
      
      // Small delay to avoid overwhelming servers when fetching images
      if (!tool.image && !tool.logo && tool.tool_url) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Error converting tool ${tool.tool_name}: ${error.message}`);
      skipped++;
    }
  }
  
  console.log(`\nNew tools to add: ${newEntries.length}`);
  console.log(`Skipped (duplicates/archived/NSFW): ${skipped}`);
  
  if (newEntries.length === 0) {
    console.log('\nNo new tools to add!');
    return;
  }
  
  // Read current file
  const fileContent = fs.readFileSync(AI_DATA_PATH, 'utf-8');
  
  // Find the closing bracket of the array
  const lastBracketIndex = fileContent.lastIndexOf(']');
  if (lastBracketIndex === -1) {
    console.error('Could not find end of array in ai-data.ts');
    return;
  }
  
  // Generate new entries
  const newEntriesString = '\n  // Tools from OpenTools.ai\n' + 
    newEntries.map((entry, i) => generateEntryString(entry, i)).join('\n');
  
  // Insert before closing bracket
  const newContent = fileContent.slice(0, lastBracketIndex) + 
    newEntriesString + '\n' + 
    fileContent.slice(lastBracketIndex);
  
  // Write back
  fs.writeFileSync(AI_DATA_PATH, newContent, 'utf-8');
  
  console.log(`\n✅ Successfully added ${newEntries.length} new tools to ${AI_DATA_PATH}`);
  console.log('\nNext steps:');
  console.log('1. Review the added tools');
  console.log('2. Run: npm run build');
  console.log('3. Test the application');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fetchAllTools, convertToAIEntry };

