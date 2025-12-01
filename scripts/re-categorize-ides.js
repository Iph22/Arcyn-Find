#!/usr/bin/env node

/**
 * Script to re-categorize potential IDE tools to the IDEs category
 */

require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ ERROR: Missing required environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

/**
 * Identify potential IDE tools with more precise detection
 */
function isIDETool(tool) {
  const nameLower = (tool.name || '').toLowerCase();
  const descLower = (tool.description || '').toLowerCase();
  const platformLower = (tool.platform || '').toLowerCase();
  const catLower = (tool.category || '').toLowerCase();
  const tagsLower = ((tool.tags || []).join(' ')).toLowerCase();
  
  // Exclude false positives - these are definitely NOT IDEs
  const falsePositives = [
    'ai detector', 'ai detection', 'detector', 'detection',
    'video generation', 'video editor', 'video creation',
    'image editor', 'image generation', 'photo editor',
    'voice', 'audio', 'speech', 'tts', 'stt',
    'chatbot', 'chat bot', 'conversation',
    'marketing', 'advertising', 'social media',
    'education', 'learning', 'tutorial',
    'design', 'ui', 'ux', 'graphic',
    'music', 'song', 'beat',
  ];
  
  // Check if it's a false positive
  const combinedText = `${nameLower} ${descLower} ${catLower}`;
  if (falsePositives.some(fp => combinedText.includes(fp))) {
    // But allow if it's clearly an IDE-related tool
    if (!combinedText.includes('ide') && !combinedText.includes('development environment') && 
        !combinedText.includes('code editor') && !platformLower.includes('marketplace.visualstudio.com')) {
      return null;
    }
  }
  
  // Strong indicators - must be precise
  const strongIndicators = [
    // Known IDE names (exact matches)
    /vscode|visual studio code|visual studio 20/i.test(nameLower),
    /intellij|idea$/i.test(nameLower),
    /webstorm/i.test(nameLower),
    /pycharm/i.test(nameLower),
    /android studio/i.test(nameLower),
    /^xcode$/i.test(nameLower),
    /eclipse ide/i.test(nameLower),
    /sublime text/i.test(nameLower),
    /atom editor|atom$/i.test(nameLower),
    /vim|neovim/i.test(nameLower),
    /emacs/i.test(nameLower),
    /jetbrains/i.test(nameLower),
    
    // IDE-specific platforms
    platformLower.includes('marketplace.visualstudio.com'),
    platformLower.includes('plugins.jetbrains.com'),
    platformLower.includes('code.visualstudio.com'),
    
    // IDE keywords in description (must be specific)
    /integrated development environment/i.test(descLower),
    /ide plugin|ide extension/i.test(descLower),
    /code editor.*development|development.*code editor/i.test(descLower),
    /programming environment.*editor|editor.*programming environment/i.test(descLower),
    /developer workspace/i.test(descLower),
    
    // Name contains IDE + editor/development
    /ide.*editor|editor.*ide/i.test(nameLower),
    /development environment$/i.test(nameLower),
    /programming environment$/i.test(nameLower),
  ];
  
  // Check strong indicators
  if (strongIndicators.some(pattern => {
    if (typeof pattern === 'string') {
      return pattern;
    }
    if (pattern instanceof RegExp) {
      return pattern.test(nameLower) || pattern.test(descLower) || pattern.test(platformLower);
    }
    return false;
  })) {
    return { confidence: 'high', reason: 'strong IDE indicator match' };
  }
  
  // Medium indicators - GitHub repos that are clearly IDEs
  if (platformLower.includes('github.com')) {
    const githubIdeIndicators = [
      /code-editor|code editor/i.test(nameLower) && (descLower.includes('development') || descLower.includes('programming')),
      /ide/i.test(nameLower) && (descLower.includes('editor') || descLower.includes('development')),
      descLower.includes('vs code') || descLower.includes('visual studio'),
      descLower.includes('code editor') && descLower.includes('programming'),
    ];
    
    if (githubIdeIndicators.some(ind => ind)) {
      return { confidence: 'medium', reason: 'GitHub IDE repository' };
    }
  }
  
  return null;
}

/**
 * Fetch all tools and identify IDE candidates
 */
async function identifyIDETools() {
  console.log('🔍 Identifying IDE tools in database...\n');
  
  let allTools = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;
  
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
  
  // Identify IDE tools
  const ideCandidates = [];
  
  allTools.forEach(tool => {
    const result = isIDETool(tool);
    if (result) {
      ideCandidates.push({
        ...tool,
        confidence: result.confidence,
        reason: result.reason
      });
    }
  });
  
  // Filter out tools already in IDE category
  const needsReCategorization = ideCandidates.filter(tool => {
    const catLower = (tool.category || '').toLowerCase();
    return catLower !== 'ide' && catLower !== 'ides';
  });
  
  return { allTools, ideCandidates, needsReCategorization };
}

/**
 * Update categories in batches
 */
async function updateCategories(toolsToUpdate, dryRun = false) {
  console.log(`\n📝 ${dryRun ? 'DRY RUN: ' : ''}Updating ${toolsToUpdate.length} tools to IDEs category...\n`);
  
  if (dryRun) {
    console.log('🔍 Preview of changes:\n');
    toolsToUpdate.slice(0, 20).forEach((tool, index) => {
      console.log(`${(index + 1).toString().padStart(3)}. ${tool.name}`);
      console.log(`    Current: ${tool.category}`);
      console.log(`    New: IDE`);
      console.log(`    Confidence: ${tool.confidence}`);
      console.log('');
    });
    if (toolsToUpdate.length > 20) {
      console.log(`   ... and ${toolsToUpdate.length - 20} more\n`);
    }
    return { updated: 0, skipped: 0, errors: 0 };
  }
  
  const batchSize = 50;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  for (let i = 0; i < toolsToUpdate.length; i += batchSize) {
    const batch = toolsToUpdate.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(toolsToUpdate.length / batchSize);
    
    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} tools)...`);
    
    // Update each tool
    const updatePromises = batch.map(async (tool) => {
      try {
        const { error } = await supabase
          .from('ai_tools')
          .update({ category: 'IDE' })
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
  
  return { updated: totalUpdated, skipped: totalSkipped, errors: totalErrors };
}

/**
 * Generate detailed list
 */
async function generateIDEToolsList(ideCandidates, needsReCategorization) {
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportData = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalIDECandidates: ideCandidates.length,
      needsReCategorization: needsReCategorization.length,
      alreadyInIDECategory: ideCandidates.length - needsReCategorization.length
    },
    highConfidence: needsReCategorization.filter(t => t.confidence === 'high').map(t => ({
      id: t.id,
      name: t.name,
      currentCategory: t.category,
      platform: t.platform,
      reason: t.reason
    })),
    mediumConfidence: needsReCategorization.filter(t => t.confidence === 'medium').map(t => ({
      id: t.id,
      name: t.name,
      currentCategory: t.category,
      platform: t.platform,
      reason: t.reason
    })),
    allCandidates: needsReCategorization.map(t => ({
      id: t.id,
      name: t.name,
      currentCategory: t.category,
      platform: t.platform,
      description: t.description?.substring(0, 200),
      confidence: t.confidence,
      reason: t.reason
    }))
  };
  
  // Save JSON report
  const jsonPath = path.join(reportsDir, `ide-tools-list-${Date.now()}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2), 'utf8');
  
  // Save CSV report
  const csvLines = [
    'ID,Name,Current Category,Platform,Confidence,Reason,Description'
  ];
  
  needsReCategorization.forEach(tool => {
    const line = [
      tool.id,
      `"${(tool.name || '').replace(/"/g, '""')}"`,
      `"${(tool.category || '').replace(/"/g, '""')}"`,
      `"${(tool.platform || '').replace(/"/g, '""')}"`,
      tool.confidence,
      `"${(tool.reason || '').replace(/"/g, '""')}"`,
      `"${((tool.description || '').substring(0, 200) || '').replace(/"/g, '""')}"`
    ].join(',');
    csvLines.push(line);
  });
  
  const csvPath = path.join(reportsDir, `ide-tools-list-${Date.now()}.csv`);
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  
  console.log(`📄 Reports saved:`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   CSV: ${csvPath}\n`);
  
  return reportData;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const skipList = args.includes('--skip-list');
  
  console.log('🚀 IDE Re-categorization Script\n');
  console.log('='.repeat(70));
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  try {
    // Step 1: Identify IDE tools
    const { ideCandidates, needsReCategorization } = await identifyIDETools();
    
    console.log('='.repeat(70));
    console.log('📊 IDENTIFICATION RESULTS');
    console.log('='.repeat(70));
    console.log(`\n   Total IDE candidates found: ${ideCandidates.length}`);
    console.log(`   Need re-categorization: ${needsReCategorization.length}`);
    console.log(`   Already in IDE category: ${ideCandidates.length - needsReCategorization.length}\n`);
    
    // Breakdown by confidence
    const highConfidence = needsReCategorization.filter(t => t.confidence === 'high');
    const mediumConfidence = needsReCategorization.filter(t => t.confidence === 'medium');
    
    console.log(`   Confidence breakdown:`);
    console.log(`   - High confidence: ${highConfidence.length}`);
    console.log(`   - Medium confidence: ${mediumConfidence.length}\n`);
    
    if (needsReCategorization.length === 0) {
      console.log('✅ No tools need re-categorization!\n');
      return;
    }
    
    // Step 2: Generate detailed list
    if (!skipList) {
      console.log('='.repeat(70));
      console.log('📋 GENERATING DETAILED LIST');
      console.log('='.repeat(70));
      await generateIDEToolsList(ideCandidates, needsReCategorization);
    }
    
    // Step 3: Update categories
    console.log('='.repeat(70));
    console.log('🔄 RE-CATEGORIZING TOOLS');
    console.log('='.repeat(70));
    
    // Start with high confidence tools
    console.log(`\n🎯 Starting with high confidence tools (${highConfidence.length})...\n`);
    const highResult = await updateCategories(highConfidence, dryRun);
    
    if (!dryRun && highResult.updated > 0) {
      console.log(`✅ Successfully updated ${highResult.updated} high-confidence IDE tools\n`);
    }
    
    // Then medium confidence (if not dry run and user wants)
    if (!dryRun && mediumConfidence.length > 0) {
      console.log(`\n📝 Processing medium confidence tools (${mediumConfidence.length})...\n`);
      const mediumResult = await updateCategories(mediumConfidence, false);
      
      if (mediumResult.updated > 0) {
        console.log(`✅ Successfully updated ${mediumResult.updated} medium-confidence IDE tools\n`);
      }
    }
    
    // Summary
    console.log('='.repeat(70));
    console.log('✅ RE-CATEGORIZATION COMPLETE');
    console.log('='.repeat(70));
    
    if (dryRun) {
      console.log('\n🔍 This was a dry run. Run without --dry-run to apply changes.\n');
    } else {
      const totalUpdated = (highResult?.updated || 0) + (mediumConfidence.length > 0 ? updateCategories : 0);
      console.log(`\n📊 Summary:`);
      console.log(`   ✅ Updated: ${totalUpdated} tools`);
      console.log(`   📁 They are now in the "IDE" category\n`);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
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

module.exports = { identifyIDETools, updateCategories, isIDETool };

