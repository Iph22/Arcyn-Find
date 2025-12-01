#!/usr/bin/env node

/**
 * Comprehensive script to recategorize all AI tools to their appropriate categories
 * Uses intelligent detection based on names, descriptions, platforms, and tags
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

/**
 * Category definitions with detection patterns
 */
const categoryPatterns = {
  'IDEs': {
    keywords: ['ide', 'integrated development environment', 'code editor', 'development environment', 
               'vscode', 'visual studio code', 'intellij', 'webstorm', 'pycharm', 'android studio',
               'xcode', 'eclipse', 'sublime', 'atom editor', 'vim', 'emacs', 'jetbrains',
               'programming environment', 'developer workspace'],
    platforms: ['marketplace.visualstudio.com', 'plugins.jetbrains.com', 'code.visualstudio.com'],
    exclude: ['ai detector', 'video editor', 'image editor', 'audio editor']
  },
  'Code Assistants': {
    keywords: ['code assistant', 'code generation', 'copilot', 'pair programming', 
               'code completion', 'autocomplete', 'code review', 'debugging', 'refactor',
               'code generator', 'ai code', 'coding assistant', 'programming assistant'],
    exclude: ['ide', 'development environment', 'code editor']
  },
  'Content Generation': {
    keywords: ['text generation', 'ai writing', 'content writer', 'blog generator', 'article generator',
               'copywriting', 'content creation', 'text ai', 'writing assistant', 'ai writer'],
    exclude: []
  },
  'Image Generation': {
    keywords: ['image generation', 'image generator', 'ai art', 'text to image', 'dalle', 'midjourney',
               'stable diffusion', 'image creation', 'ai art generator', 'picture generator'],
    exclude: ['image editor', 'photo editor', 'image editing']
  },
  'Computer Vision': {
    keywords: ['image recognition', 'object detection', 'face recognition', 'computer vision',
               'image analysis', 'image classification', 'visual ai', 'cv', 'opencv',
               'image processing', 'image editing', 'photo editing'],
    exclude: ['image generation', 'text to image']
  },
  'Chatbots': {
    keywords: ['chatbot', 'chat bot', 'conversational ai', 'ai chat', 'llm', 'language model',
               'gpt', 'claude', 'gemini', 'bard', 'chat assistant', 'dialogue system'],
    exclude: []
  },
  'Voice & Speech': {
    keywords: ['text to speech', 'tts', 'speech to text', 'stt', 'voice synthesis', 'voice cloning',
               'voice recognition', 'speech recognition', 'audio transcription', 'voice assistant',
               'speech ai', 'voice ai', 'audio generation'],
    exclude: []
  },
  'Video & Audio': {
    keywords: ['video generation', 'video creation', 'video editor', 'video editing', 'video ai',
               'ai video', 'video synthesis', 'video effects', 'video production'],
    exclude: ['video editor' + ' only editing without ai']
  },
  'Data & Analytics': {
    keywords: ['data analytics', 'data analysis', 'business intelligence', 'data visualization',
               'analytics platform', 'data insights', 'data processing'],
    exclude: []
  },
  'AI Detection': {
    keywords: ['ai detection', 'ai detector', 'ai checker', 'plagiarism detection', 'plagiarism checker',
               'deepfake detection', 'content authenticity', 'ai content detection'],
    exclude: []
  },
  'Productivity': {
    keywords: ['productivity', 'automation', 'workflow', 'task automation', 'business automation',
               'autonomous ai', 'ai agent', 'workflow automation'],
    exclude: []
  },
  'Marketing': {
    keywords: ['marketing', 'marketing automation', 'seo', 'advertising', 'social media marketing',
               'email marketing', 'marketing tool', 'ad campaign'],
    exclude: []
  },
  'Design': {
    keywords: ['design tool', 'ui design', 'ux design', 'graphic design', 'design assistance',
               'design generator', 'ui/ux', 'design ai'],
    exclude: []
  },
  'Research & Education': {
    keywords: ['education', 'learning', 'research', 'educational', 'tutoring', 'study tool',
               'academic', 'e-learning', 'course', 'learning platform'],
    exclude: []
  },
  'Multimodal AI': {
    keywords: ['multimodal', 'multi-modal', 'text and image', 'text and video', 'unified platform',
               'cross-modal', 'multimedia ai'],
    exclude: []
  }
};

/**
 * Determine the best category for a tool with improved logic
 */
function determineCategory(tool) {
  const nameLower = (tool.name || '').toLowerCase();
  const descLower = (tool.description || '').toLowerCase();
  const platformLower = (tool.platform || '').toLowerCase();
  const tagsLower = ((tool.tags || []).join(' ')).toLowerCase();
  const currentCat = (tool.category || '').toLowerCase().trim();
  
  const combinedText = `${nameLower} ${descLower} ${tagsLower} ${platformLower}`;
  
  // First, check if current category is appropriate (don't change if it's clearly correct)
  // Map current categories to standard format
  const standardCategoryMapping = {
    'generative ai': 'Content Generation', // Will check if it's actually a chatbot
    'text generation': 'Content Generation',
    'ai writing': 'Content Generation',
    'code generation': 'Code Assistants',
    'code assistants': 'Code Assistants',
    'image generation': 'Image Generation',
    'computer vision': 'Computer Vision',
    'chatbots': 'Chatbots',
    'chat bots': 'Chatbots',
    'audio/nlp': 'Voice & Speech',
    'nlp platform': 'Voice & Speech',
    'video generation': 'Video & Audio',
    'video': 'Video & Audio',
    'data analytics': 'Data & Analytics',
    'data analysis': 'Data & Analytics',
    'ml infrastructure': 'Data & Analytics',
    'ai detection': 'AI Detection',
    'ai detection tool': 'AI Detection',
    'autonomous ai': 'Productivity',
    'productivity': 'Productivity',
    'marketing': 'Marketing',
    'marketing automation': 'Marketing',
    'design': 'Design',
    'design assistance': 'Design',
    'research': 'Research & Education',
    'learning & education': 'Research & Education',
    'education': 'Research & Education',
    'search/qa': 'Research & Education',
    'multimodal platform': 'Multimodal AI',
    'multimodal': 'Multimodal AI',
    'ide': 'IDEs',
    'ides': 'IDEs',
    'development environment': 'IDEs'
  };
  
  // Get standardized current category
  const standardCurrentCat = standardCategoryMapping[currentCat] || currentCat;
  
  // Score each category
  const scores = {};
  
  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    let score = 0;
    
    // Strong exclusion check first - if excluded, skip this category
    if (patterns.exclude && patterns.exclude.length > 0) {
      const isExcluded = patterns.exclude.some(exclude => {
        const excludeLower = exclude.toLowerCase();
        return nameLower.includes(excludeLower) || descLower.includes(excludeLower);
      });
      if (isExcluded) {
        scores[category] = -100; // Strong negative score
        continue;
      }
    }
    
    // Check keywords (case-insensitive word boundaries)
    for (const keyword of patterns.keywords) {
      const keywordLower = keyword.toLowerCase();
      // Use word boundaries for better matching
      const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(combinedText)) {
        // Name matches are stronger than description matches
        if (nameLower.includes(keywordLower)) {
          score += 30;
        } else if (descLower.includes(keywordLower)) {
          score += 10;
        }
      }
    }
    
    // Check platforms (very strong indicator)
    if (patterns.platforms) {
      for (const platform of patterns.platforms) {
        if (platformLower.includes(platform)) {
          score += 100; // Platform matches are very strong indicators
        }
      }
    }
    
    // Boost if current standardized category matches
    if (standardCurrentCat.toLowerCase() === category.toLowerCase()) {
      score += 50; // Strong boost to keep current category if it's correct
    }
    
    scores[category] = score;
  }
  
  // Special handling: Protect current categories that are clearly correct
  // AI Detection tools should almost always stay in AI Detection
  if (currentCat.includes('detection') || currentCat.includes('detector') || 
      nameLower.includes('detector') || nameLower.includes('detection') ||
      descLower.includes('ai detection') || descLower.includes('detect ai') ||
      descLower.includes('plagiarism detection')) {
    scores['AI Detection'] = Math.max(scores['AI Detection'] || 0, 500); // Very high priority - almost never change
    // Strongly penalize IDEs and other unrelated categories
    scores['IDEs'] = -500;
    scores['Code Assistants'] = -200;
    scores['Content Generation'] = -200;
  }
  
  // Protect IDEs - should only be IDEs if very clear
  if (currentCat.includes('ide') || currentCat.includes('development environment')) {
    // Only change if there's VERY strong evidence it's wrong
    if (!nameLower.includes('ide') && !descLower.includes('ide') && 
        !platformLower.includes('visualstudio.com') && !platformLower.includes('jetbrains.com')) {
      // Might be miscategorized, allow change if strong evidence
    } else {
      scores['IDEs'] = Math.max(scores['IDEs'] || 0, 300); // Keep if clearly an IDE
    }
  }
  
  // Protect Video Generation tools - should NOT be IDEs
  if (currentCat.includes('video') || nameLower.includes('video') || 
      descLower.includes('video generation') || descLower.includes('video creation') ||
      descLower.includes('video editor') || descLower.includes('video editing')) {
    scores['Video & Audio'] = Math.max(scores['Video & Audio'] || 0, 500);
    scores['IDEs'] = -500; // Strongly prevent video tools from being IDEs
  }
  
  // Protect audio/video processing tools
  if (currentCat.includes('audio/video') || currentCat.includes('audio/video processing')) {
    if (descLower.includes('audio') || descLower.includes('video') || 
        descLower.includes('transcription') || descLower.includes('podcast')) {
      scores['Voice & Speech'] = Math.max(scores['Voice & Speech'] || 0, 400);
      scores['Video & Audio'] = Math.max(scores['Video & Audio'] || 0, 400);
      scores['IDEs'] = -500; // Not IDEs
    }
  }
  
  // Protect Computer Vision tools
  if (currentCat.includes('computer vision') || currentCat.includes('vision')) {
    if (nameLower.includes('vision') || descLower.includes('computer vision') ||
        descLower.includes('image recognition') || descLower.includes('object detection')) {
      scores['Computer Vision'] = Math.max(scores['Computer Vision'] || 0, 300);
    }
  }
  
  // Generative AI often means Chatbots, but check if it's actually content generation
  if (currentCat === 'generative ai') {
    // If it's clearly a chatbot (GPT, Claude, etc.)
    if (nameLower.includes('chat') || nameLower.includes('gpt') || nameLower.includes('claude') ||
        nameLower.includes('gemini') || nameLower.includes('bard') || descLower.includes('chatbot') ||
        descLower.includes('conversational ai') || descLower.includes('language model')) {
      scores['Chatbots'] = Math.max(scores['Chatbots'] || 0, 150);
    }
    // If it's clearly content generation
    else if (nameLower.includes('writer') || nameLower.includes('content') || 
             descLower.includes('writing') || descLower.includes('content generation')) {
      scores['Content Generation'] = Math.max(scores['Content Generation'] || 0, 150);
    }
  }
  
  // Get highest scoring category
  let bestCategory = null;
  let bestScore = -1;
  
  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore && score > 0) {
      bestScore = score;
      bestCategory = category;
    }
  }
  
  // Only change category if we have a significantly better match (at least 30 points better)
  // and the best score is substantial (at least 50)
  if (bestCategory && bestScore >= 50) {
    const currentScore = scores[standardCurrentCat] || 0;
    // Only change if new score is significantly better (30+ points) OR current category scored negatively
    if (bestScore >= currentScore + 30 || currentScore < 0) {
      return bestCategory;
    }
  }
  
  // Keep current standardized category if no better match found
  return standardCurrentCat || 'Content Generation';
}

/**
 * Check if a tool needs re-categorization
 */
function needsRecategorization(tool, newCategory) {
  const currentCat = (tool.category || '').trim();
  const normalized = newCategory.trim();
  
  // Don't change if already correct
  if (currentCat.toLowerCase() === normalized.toLowerCase()) {
    return false;
  }
  
  // Allow some flexibility for similar categories
  const categoryAliases = {
    'generative ai': ['chatbots', 'content generation'],
    'code generation': ['code assistants'],
    'ai detection tool': ['ai detection'],
    'learning & education': ['research & education'],
    'multimodal platform': ['multimodal ai']
  };
  
  for (const [alias, equivalents] of Object.entries(categoryAliases)) {
    if (currentCat.toLowerCase() === alias) {
      if (equivalents.includes(normalized.toLowerCase())) {
        return false; // Close enough
      }
    }
  }
  
  return true;
}

/**
 * Process all tools and recategorize
 */
async function recategorizeAllTools(dryRun = false) {
  console.log('🚀 Starting Comprehensive Re-categorization...\n');
  console.log('='.repeat(70));
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  // Fetch all tools
  let allTools = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;
  
  console.log('📥 Loading all tools from database...\n');
  
  while (hasMore) {
    const { data: tools, error } = await supabase
      .from('ai_tools')
      .select('id, name, category, platform, description, tags')
      .range(offset, offset + batchSize - 1);
    
    if (error) {
      console.error('❌ Error fetching tools:', error);
      break;
    }
    
    if (!tools || tools.length === 0) {
      hasMore = false;
      break;
    }
    
    allTools.push(...tools);
    console.log(`   Loaded ${allTools.length} tools...`);
    
    if (tools.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
    }
  }
  
  console.log(`\n✅ Loaded ${allTools.length} total tools\n`);
  console.log('='.repeat(70));
  console.log('🔍 Analyzing and recategorizing...\n');
  
  // Analyze each tool
  const changes = [];
  const categoryChanges = {};
  
  for (const tool of allTools) {
    const newCategory = determineCategory(tool);
    
    if (needsRecategorization(tool, newCategory)) {
      changes.push({
        id: tool.id,
        name: tool.name,
        oldCategory: tool.category,
        newCategory: newCategory,
        confidence: 'medium' // Can be enhanced with confidence scoring
      });
      
      // Track category changes
      const key = `${tool.category} → ${newCategory}`;
      categoryChanges[key] = (categoryChanges[key] || 0) + 1;
    }
  }
  
  console.log(`📊 Analysis complete:\n`);
  console.log(`   Total tools analyzed: ${allTools.length}`);
  console.log(`   Tools needing re-categorization: ${changes.length}`);
  console.log(`   Tools staying in current category: ${allTools.length - changes.length}\n`);
  
  // Show category change summary
  if (Object.keys(categoryChanges).length > 0) {
    console.log('📈 Category Changes Summary:\n');
    const sortedChanges = Object.entries(categoryChanges)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    sortedChanges.forEach(([change, count]) => {
      console.log(`   ${change.padEnd(50)} ${count} tools`);
    });
    console.log('');
  }
  
  if (changes.length === 0) {
    console.log('✅ All tools are already in appropriate categories!\n');
    return { updated: 0, errors: 0 };
  }
  
  // Show sample changes
  if (dryRun) {
    console.log('='.repeat(70));
    console.log('🔍 Preview of Changes (first 20):\n');
    changes.slice(0, 20).forEach((change, index) => {
      console.log(`${(index + 1).toString().padStart(3)}. ${change.name}`);
      console.log(`    ${change.oldCategory} → ${change.newCategory}`);
      console.log('');
    });
    if (changes.length > 20) {
      console.log(`   ... and ${changes.length - 20} more changes\n`);
    }
    return { updated: 0, errors: 0 };
  }
  
  // Apply changes
  console.log('='.repeat(70));
  console.log('🔄 Applying category changes...\n');
  
  const updateBatchSize = 50;
  let totalUpdated = 0;
  let totalErrors = 0;
  
  for (let i = 0; i < changes.length; i += updateBatchSize) {
    const batch = changes.slice(i, i + updateBatchSize);
    const batchNum = Math.floor(i / updateBatchSize) + 1;
    const totalBatches = Math.ceil(changes.length / updateBatchSize);
    
    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} tools)...`);
    
    const updatePromises = batch.map(async (change) => {
      try {
        const { error } = await supabase
          .from('ai_tools')
          .update({ category: change.newCategory })
          .eq('id', change.id);
        
        if (error) {
          console.error(`   ❌ Error updating ${change.name}:`, error.message);
          return { success: false };
        }
        
        return { success: true };
      } catch (error) {
        console.error(`   ❌ Exception updating ${change.name}:`, error.message);
        return { success: false };
      }
    });
    
    const results = await Promise.all(updatePromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    totalUpdated += successful;
    totalErrors += failed;
    
    console.log(`   ✅ Updated: ${successful}, ❌ Errors: ${failed}\n`);
    
    // Small delay between batches
    if (i + updateBatchSize < changes.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('='.repeat(70));
  console.log('✅ RE-CATEGORIZATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successfully updated: ${totalUpdated} tools`);
  console.log(`   ❌ Errors: ${totalErrors} tools`);
  console.log(`   📁 Total tools: ${allTools.length}\n`);
  
  return { updated: totalUpdated, errors: totalErrors };
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  try {
    await recategorizeAllTools(dryRun);
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

module.exports = { recategorizeAllTools, determineCategory };

