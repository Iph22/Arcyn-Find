#!/usr/bin/env node

/**
 * Script to find and categorize AI Coding Agents (MCP servers, Figma integrations, coding agents)
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
 * Patterns that indicate a tool is an AI Coding Agent
 */
const codingAgentPatterns = {
  // MCP (Model Context Protocol) servers
  mcp: {
    keywords: ['mcp', 'model context protocol', 'mcp server', 'mcp-server'],
    platforms: [],
    exclude: [],
  },
  
  // Figma integrations for coding/design
  figma: {
    keywords: ['figma', 'figma integration', 'figma plugin', 'cursor-talk-to-figma'],
    platforms: ['figma.com', 'github.com'],
    exclude: ['figma design', 'figma editor', 'design tool only'],
  },
  
  // Coding agents
  codingAgent: {
    keywords: ['coding agent', 'code agent', 'agentic coding', 'autonomous coding', 'ai coding agent'],
    platforms: [],
    exclude: ['ide', 'code editor', 'development environment'],
  },
  
  // Task orchestrators for coding
  taskOrchestrator: {
    keywords: ['task orchestrator', 'coding assistant', 'mcp server', 'context persistence'],
    platforms: ['github.com'],
    exclude: [],
  },
};

/**
 * Determine if a tool is an AI Coding Agent
 */
function isCodingAgent(tool) {
  const nameLower = (tool.name || '').toLowerCase();
  const descLower = (tool.description || '').toLowerCase();
  const platformLower = (tool.platform || '').toLowerCase();
  const tagsLower = ((tool.tags || []).join(' ')).toLowerCase();
  const combinedText = `${nameLower} ${descLower} ${tagsLower} ${platformLower}`;
  
  // Check exclusion patterns first
  const exclusions = [
    'ide', 'code editor', 'development environment', 'visual studio code', 'vscode',
    'intellij', 'webstorm', 'pycharm', 'android studio', 'xcode',
    'design tool only', 'figma design tool', 'image editor'
  ];
  
  for (const exclude of exclusions) {
    if ((nameLower === exclude || nameLower.includes(exclude)) && 
        !combinedText.includes('mcp') && 
        !combinedText.includes('cursor-talk-to-figma') &&
        !combinedText.includes('agent')) {
      return { isAgent: false, reason: 'Excluded pattern' };
    }
  }
  
  let score = 0;
  let matchedPattern = null;
  
  // Check MCP patterns (very strong indicator)
  if (combinedText.includes('mcp') || combinedText.includes('model context protocol')) {
    // MCP servers are definitely coding agents
    if (nameLower.includes('mcp') || descLower.includes('mcp server') || platformLower.includes('github.com')) {
      score += 100;
      matchedPattern = 'MCP Server';
    }
  }
  
  // Check Figma integration patterns (for coding, not design)
  if (combinedText.includes('figma') && (
    combinedText.includes('cursor') ||
    combinedText.includes('integration') ||
    combinedText.includes('mcp') ||
    combinedText.includes('coding') ||
    platformLower.includes('github.com')
  )) {
    score += 80;
    if (!matchedPattern) matchedPattern = 'Figma Integration';
  }
  
  // Check coding agent keywords
  const agentKeywords = [
    'coding agent', 'code agent', 'agentic coding', 'autonomous coding',
    'ai coding agent', 'coding assistant', 'mcp server'
  ];
  
  for (const keyword of agentKeywords) {
    if (combinedText.includes(keyword)) {
      score += 50;
      if (!matchedPattern) matchedPattern = 'Coding Agent';
      break;
    }
  }
  
  // Check for task orchestrators and context persistence (common in MCP servers)
  if (combinedText.includes('task orchestrator') || combinedText.includes('context persistence') || combinedText.includes('mcp server')) {
    score += 40;
    if (!matchedPattern) matchedPattern = 'Task Orchestrator';
  }
  
  // Platform indicators (GitHub repos for MCP servers)
  if (platformLower.includes('github.com') && (
    nameLower.includes('mcp') ||
    descLower.includes('mcp') ||
    descLower.includes('model context protocol')
  )) {
    score += 60;
    if (!matchedPattern) matchedPattern = 'MCP GitHub Repo';
  }
  
  // Name-based indicators
  if (nameLower.includes('mcp-') || nameLower.includes('-mcp') || nameLower.includes('cursor-talk-to-figma')) {
    score += 70;
    if (!matchedPattern) matchedPattern = 'MCP Tool';
  }
  
  return {
    isAgent: score >= 50,
    score,
    reason: matchedPattern || (score > 0 ? 'Multiple indicators' : 'No match'),
  };
}

/**
 * Find and categorize AI Coding Agents
 */
async function categorizeCodingAgents(dryRun = false) {
  console.log('🔍 Finding AI Coding Agents...\n');
  console.log('='.repeat(70));
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  // Search for potential coding agents
  const searchTerms = [
    'mcp', 'model context protocol', 'coding agent', 'code agent',
    'cursor-talk-to-figma', 'figma integration', 'task orchestrator',
    'agentic coding', 'mcp server'
  ];
  
  const toolsToUpdate = [];
  const checkedIds = new Set();
  
  for (const term of searchTerms) {
    const { data: tools, error } = await supabase
      .from('ai_tools')
      .select('id, name, category, platform, description, tags')
      .or(`name.ilike.%${term}%,description.ilike.%${term}%,platform.ilike.%${term}%`)
      .limit(50);
    
    if (error) {
      console.error(`❌ Error searching for "${term}":`, error.message);
      continue;
    }
    
    if (tools && tools.length > 0) {
      tools.forEach(tool => {
        if (checkedIds.has(tool.id)) return;
        checkedIds.add(tool.id);
        
        const currentCat = (tool.category || '').toLowerCase();
        
        // Skip if already in AI Coding Agents category
        if (currentCat.includes('coding agent') || currentCat.includes('ai coding')) {
          return;
        }
        
        const result = isCodingAgent(tool);
        
        if (result.isAgent) {
          toolsToUpdate.push({
            ...tool,
            matchScore: result.score,
            matchReason: result.reason,
          });
        }
      });
    }
  }
  
  // Sort by match score
  toolsToUpdate.sort((a, b) => b.matchScore - a.matchScore);
  
  console.log(`\n📊 Found ${toolsToUpdate.length} AI Coding Agents:\n`);
  
  toolsToUpdate.forEach((tool, index) => {
    console.log(`${(index + 1).toString().padStart(3)}. ${tool.name}`);
    console.log(`    Current: ${tool.category}`);
    console.log(`    New: AI Coding Agents`);
    console.log(`    Score: ${tool.matchScore} (${tool.matchReason})`);
    console.log(`    Platform: ${tool.platform.substring(0, 70)}...`);
    console.log('');
  });
  
  if (dryRun || toolsToUpdate.length === 0) {
    if (dryRun) {
      console.log('🔍 This was a dry run. Run without --dry-run to apply changes.\n');
    }
    return { updated: 0, errors: 0 };
  }
  
  // Update categories
  console.log('🔄 Updating categories...\n');
  
  const batchSize = 50;
  let totalUpdated = 0;
  let totalErrors = 0;
  
  for (let i = 0; i < toolsToUpdate.length; i += batchSize) {
    const batch = toolsToUpdate.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(toolsToUpdate.length / batchSize);
    
    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} tools)...`);
    
    const updatePromises = batch.map(async (tool) => {
      try {
        // Also update tags to include relevant tags
        const existingTags = tool.tags || [];
        const newTags = [...new Set([...existingTags, 'coding-agent', 'mcp'])]
          .filter(tag => tag && tag.trim());
        
        const { error } = await supabase
          .from('ai_tools')
          .update({ 
            category: 'AI Coding Agents',
            tags: newTags.slice(0, 10), // Limit tags
          })
          .eq('id', tool.id);
        
        if (error) {
          console.error(`   ❌ Error updating ${tool.name}:`, error.message);
          return { success: false };
        }
        
        return { success: true };
      } catch (error) {
        console.error(`   ❌ Exception updating ${tool.name}:`, error.message);
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
    if (i + batchSize < toolsToUpdate.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('='.repeat(70));
  console.log('✅ CATEGORIZATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successfully updated: ${totalUpdated} tools`);
  console.log(`   ❌ Errors: ${totalErrors} tools`);
  console.log(`   📁 They are now in the "AI Coding Agents" category\n`);
  
  return { updated: totalUpdated, errors: totalErrors };
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  try {
    await categorizeCodingAgents(dryRun);
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

module.exports = { categorizeCodingAgents, isCodingAgent };

