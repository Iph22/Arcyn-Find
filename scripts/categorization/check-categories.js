#!/usr/bin/env node

/**
 * Check category status, especially IDEs
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

async function checkAllCategories() {
  console.log('🔍 Checking all categories in database...\n');
  
  // Fetch all tools with pagination
  let allTools = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: tools, error } = await supabase
      .from('ai_tools')
      .select('id, name, category, platform, tags, description, image')
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
  
  // Count by category
  const categoryCounts = {};
  const idePotential = [];
  
  allTools.forEach(tool => {
    const category = tool.category || 'Unknown';
    if (!categoryCounts[category]) {
      categoryCounts[category] = {
        total: 0,
        withImages: 0,
        withoutImages: 0,
        tools: []
      };
    }
    
    categoryCounts[category].total++;
    if (tool.image && tool.image.trim() !== '') {
      categoryCounts[category].withImages++;
    } else {
      categoryCounts[category].withoutImages++;
    }
    categoryCounts[category].tools.push(tool);
    
    // Check for potential IDE tools
    const nameLower = (tool.name || '').toLowerCase();
    const descLower = (tool.description || '').toLowerCase();
    const platformLower = (tool.platform || '').toLowerCase();
    const catLower = (tool.category || '').toLowerCase();
    const tagsLower = ((tool.tags || []).join(' ')).toLowerCase();
    
    const isIDE = 
      catLower === 'ide' || catLower === 'ides' ||
      catLower.includes('development environment') ||
      nameLower.includes('ide') && (nameLower.includes('editor') || nameLower.includes('development')) ||
      (nameLower.includes('vscode') || nameLower.includes('visual studio') || nameLower.includes('intellij')) ||
      (platformLower.includes('github.com') && (descLower.includes('editor') || descLower.includes('ide') || nameLower.includes('editor'))) ||
      tagsLower.includes('ide') || tagsLower.includes('editor') ||
      (nameLower.includes('code editor') || nameLower.includes('development environment'));
    
    if (isIDE) {
      idePotential.push({
        id: tool.id,
        name: tool.name,
        category: tool.category,
        platform: tool.platform,
        description: tool.description,
        hasImage: !!tool.image && tool.image.trim() !== ''
      });
    }
  });
  
  return { allTools, categoryCounts, idePotential };
}

async function main() {
  console.log('='.repeat(70));
  console.log('📊 COMPREHENSIVE CATEGORY STATUS REPORT');
  console.log('='.repeat(70));
  console.log('');
  
  const { allTools, categoryCounts, idePotential } = await checkAllCategories();
  
  // Display all categories
  console.log('📁 ALL CATEGORIES:');
  console.log('='.repeat(70));
  
  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1].total - a[1].total);
  
  sortedCategories.forEach(([category, data]) => {
    const imagePct = ((data.withImages / data.total) * 100).toFixed(1);
    console.log(`\n${category}:`);
    console.log(`   Total: ${data.total} tools`);
    console.log(`   ✅ With images: ${data.withImages} (${imagePct}%)`);
    console.log(`   ❌ Without images: ${data.withoutImages}`);
  });
  
  // IDEs Analysis
  console.log('\n' + '='.repeat(70));
  console.log('💻 IDEs CATEGORY DETAILED ANALYSIS');
  console.log('='.repeat(70));
  
  const ideCategory = categoryCounts['IDE'] || categoryCounts['IDEs'] || { total: 0, tools: [] };
  
  console.log(`\n📊 Current Status:`);
  console.log(`   Tools in "IDE" category: ${categoryCounts['IDE']?.total || 0}`);
  console.log(`   Tools in "IDEs" category: ${categoryCounts['IDEs']?.total || 0}`);
  console.log(`   Potential IDE tools found: ${idePotential.length}`);
  
  if (idePotential.length > 0) {
    console.log(`\n🔍 Potential IDE Tools (${idePotential.length}):\n`);
    idePotential.forEach((tool, index) => {
      const status = tool.hasImage ? '✅' : '❌';
      console.log(`   ${(index + 1).toString().padStart(3)}. ${status} ${tool.name}`);
      console.log(`       Current Category: ${tool.category}`);
      console.log(`       Platform: ${tool.platform}`);
      if (tool.description) {
        const desc = tool.description.substring(0, 100);
        console.log(`       Description: ${desc}${tool.description.length > 100 ? '...' : ''}`);
      }
      console.log('');
    });
  } else {
    console.log('\n   ⚠️  No IDE tools found. This might mean:');
    console.log('      1. Tools are not properly categorized as IDEs');
    console.log('      2. IDE tools are under different categories (e.g., Code Generation)');
    console.log('      3. Need to search GitHub repositories for IDE tools\n');
  }
  
  // Check Code Generation category for potential IDEs
  console.log('\n' + '='.repeat(70));
  console.log('🔧 CODE GENERATION CATEGORY (Potential IDEs)');
  console.log('='.repeat(70));
  
  const codeGenCategory = categoryCounts['Code Generation'] || categoryCounts['Code Assistants'] || { tools: [] };
  
  if (codeGenCategory.tools && codeGenCategory.tools.length > 0) {
    console.log(`\n📦 Found ${codeGenCategory.tools.length} tools in Code Generation/Code Assistants`);
    console.log(`\n   Sample tools that might be IDEs:\n`);
    
    const potentialIDEsFromCode = codeGenCategory.tools.filter(tool => {
      const nameLower = (tool.name || '').toLowerCase();
      const platformLower = (tool.platform || '').toLowerCase();
      return nameLower.includes('editor') || 
             nameLower.includes('ide') ||
             nameLower.includes('vscode') ||
             nameLower.includes('studio') ||
             platformLower.includes('github.com');
    }).slice(0, 10);
    
    potentialIDEsFromCode.forEach((tool, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${tool.name}`);
      console.log(`       Platform: ${tool.platform}`);
      console.log('');
    });
  }
  
  // Overall statistics
  console.log('\n' + '='.repeat(70));
  console.log('📈 OVERALL STATISTICS');
  console.log('='.repeat(70));
  
  const totalWithImages = Object.values(categoryCounts).reduce((sum, cat) => sum + cat.withImages, 0);
  const totalWithoutImages = Object.values(categoryCounts).reduce((sum, cat) => sum + cat.withoutImages, 0);
  const imagePercentage = ((totalWithImages / allTools.length) * 100).toFixed(1);
  
  console.log(`\n   Total tools in database: ${allTools.length}`);
  console.log(`   ✅ Tools with images: ${totalWithImages} (${imagePercentage}%)`);
  console.log(`   ❌ Tools without images: ${totalWithoutImages}`);
  console.log(`   📁 Total unique categories: ${Object.keys(categoryCounts).length}`);
  console.log(`   💻 Potential IDE tools: ${idePotential.length}`);
  
  // Category recommendations
  console.log('\n' + '='.repeat(70));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(70));
  
  console.log('\n   1. IDEs Category:');
  if (idePotential.length > 0) {
    console.log(`      - Found ${idePotential.length} potential IDE tools that should be categorized`);
    console.log('      - Consider updating their categories to "IDE" or "IDEs"');
  } else {
    console.log('      - No IDE tools detected. Consider:');
    console.log('        • Adding IDE tools manually');
    console.log('        • Searching GitHub for IDE repositories');
    console.log('        • Reviewing Code Generation category for IDE candidates');
  }
  
  console.log('\n   2. Image Completion:');
  const incompleteCategories = Object.entries(categoryCounts)
    .filter(([_, data]) => data.withoutImages > 0 && data.withImages / data.total < 0.5)
    .sort((a, b) => (b[1].withoutImages / b[1].total) - (a[1].withoutImages / a[1].total))
    .slice(0, 5);
  
  if (incompleteCategories.length > 0) {
    console.log('      Categories needing more images:');
    incompleteCategories.forEach(([category, data]) => {
      const missingPct = ((data.withoutImages / data.total) * 100).toFixed(1);
      console.log(`        • ${category}: ${data.withoutImages} missing (${missingPct}%)`);
    });
  }
  
  console.log('\n✅ Category check complete!\n');
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { checkAllCategories };

