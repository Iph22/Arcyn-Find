#!/usr/bin/env node

/**
 * Generate detailed report on newly discovered tools and category status
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
 * Check newly discovered tools (those from GitHub discovery)
 */
async function checkNewlyDiscoveredTools() {
  console.log('🔍 Checking newly discovered tools...\n');
  
  // Tools from discovery script typically have IDs starting with 'discovery-'
  // or are GitHub repositories
  const { data: allTools } = await supabase
    .from('ai_tools')
    .select('id, name, platform, category, image, popularity, created_at')
    .order('created_at', { ascending: false })
    .limit(500); // Get most recent 500 tools
  
  // Filter for GitHub repos (newly discovered)
  const githubTools = allTools.filter(tool => 
    tool.platform && (
      tool.platform.includes('github.com') ||
      tool.id.startsWith('discovery-') ||
      tool.platform.includes('github.io')
    )
  );
  
  // Get tools added in last 24 hours
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  
  const recentTools = allTools.filter(tool => {
    if (!tool.created_at) return false;
    const createdDate = new Date(tool.created_at);
    return createdDate > oneDayAgo;
  });
  
  console.log(`📊 Discovery Summary:`);
  console.log(`   Total tools checked: ${allTools.length}`);
  console.log(`   GitHub repositories: ${githubTools.length}`);
  console.log(`   Added in last 24 hours: ${recentTools.length}\n`);
  
  return {
    allTools,
    githubTools,
    recentTools
  };
}

/**
 * Check category distribution
 */
async function checkCategoryDistribution() {
  console.log('📁 Checking category distribution...\n');
  
  const { data: tools, error } = await supabase
    .from('ai_tools')
    .select('category, name, platform, image, id');
  
  if (error) {
    console.error('❌ Error fetching tools:', error);
    return null;
  }
  
  const categoryMap = {};
  const ideTools = [];
  
  tools.forEach(tool => {
    const category = tool.category || 'Unknown';
    if (!categoryMap[category]) {
      categoryMap[category] = {
        total: 0,
        withImages: 0,
        withoutImages: 0,
        tools: []
      };
    }
    
    categoryMap[category].total++;
    categoryMap[category].tools.push({
      id: tool.id,
      name: tool.name,
      platform: tool.platform,
      hasImage: !!tool.image && tool.image.trim() !== ''
    });
    
    if (tool.image && tool.image.trim() !== '') {
      categoryMap[category].withImages++;
    } else {
      categoryMap[category].withoutImages++;
    }
    
    // Check for IDEs
    const catLower = category.toLowerCase();
    const nameLower = (tool.name || '').toLowerCase();
    const platformLower = (tool.platform || '').toLowerCase();
    
    if (catLower.includes('ide') || 
        catLower === 'ides' ||
        nameLower.includes('ide') && (
          nameLower.includes('editor') ||
          nameLower.includes('development environment') ||
          platformLower.includes('github.com')
        )) {
      ideTools.push({
        id: tool.id,
        name: tool.name,
        category: tool.category,
        platform: tool.platform,
        hasImage: !!tool.image && tool.image.trim() !== ''
      });
    }
  });
  
  return { categoryMap, ideTools, totalTools: tools.length };
}

/**
 * Generate detailed report
 */
async function generateDetailedReport() {
  console.log('📊 Generating Detailed Discovery Report...\n');
  console.log('=' .repeat(70));
  
  try {
    // Check newly discovered tools
    const discoveryData = await checkNewlyDiscoveredTools();
    
    // Check category distribution
    const categoryData = await checkCategoryDistribution();
    
    if (!categoryData) {
      console.error('❌ Failed to fetch category data');
      return;
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📁 CATEGORY BREAKDOWN');
    console.log('='.repeat(70));
    
    // Sort categories by total count
    const sortedCategories = Object.entries(categoryData.categoryMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 20); // Top 20 categories
    
    sortedCategories.forEach(([category, data]) => {
      const imagePct = ((data.withImages / data.total) * 100).toFixed(1);
      console.log(`\n${category}:`);
      console.log(`   Total: ${data.total} tools`);
      console.log(`   ✅ With images: ${data.withImages} (${imagePct}%)`);
      console.log(`   ❌ Without images: ${data.withoutImages}`);
      
      // Show sample tools
      const sampleTools = data.tools.slice(0, 3);
      if (sampleTools.length > 0) {
        console.log(`   📋 Sample tools:`);
        sampleTools.forEach(tool => {
          const status = tool.hasImage ? '✅' : '❌';
          console.log(`      ${status} ${tool.name}`);
        });
      }
    });
    
    // IDEs Category Analysis
    console.log('\n' + '='.repeat(70));
    console.log('💻 IDEs CATEGORY ANALYSIS');
    console.log('='.repeat(70));
    
    const ideCategoryTools = categoryData.categoryMap['IDE'] || categoryData.categoryMap['IDEs'] || { total: 0, tools: [] };
    
    console.log(`\n📊 IDEs Category Status:`);
    console.log(`   Tools in IDE/IDEs category: ${ideCategoryTools.total || 0}`);
    console.log(`   Potential IDE tools found: ${categoryData.ideTools.length}`);
    
    if (categoryData.ideTools.length > 0) {
      console.log(`\n🔍 Potential IDE Tools (${categoryData.ideTools.length}):`);
      categoryData.ideTools.slice(0, 20).forEach((tool, index) => {
        const status = tool.hasImage ? '✅' : '❌';
        console.log(`   ${(index + 1).toString().padStart(2)}. ${status} ${tool.name}`);
        console.log(`      Category: ${tool.category}`);
        console.log(`      Platform: ${tool.platform}`);
      });
      
      if (categoryData.ideTools.length > 20) {
        console.log(`   ... and ${categoryData.ideTools.length - 20} more`);
      }
    }
    
    // Discovery summary
    console.log('\n' + '='.repeat(70));
    console.log('🆕 NEWLY DISCOVERED TOOLS');
    console.log('='.repeat(70));
    
    if (discoveryData.githubTools.length > 0) {
      console.log(`\n📦 GitHub Tools (${discoveryData.githubTools.length}):`);
      discoveryData.githubTools.slice(0, 20).forEach((tool, index) => {
        const hasImage = tool.image && tool.image.trim() !== '';
        const status = hasImage ? '✅' : '❌';
        console.log(`   ${(index + 1).toString().padStart(2)}. ${status} ${tool.name}`);
        console.log(`      Category: ${tool.category || 'Unknown'}`);
        console.log(`      Platform: ${tool.platform}`);
      });
      
      if (discoveryData.githubTools.length > 20) {
        console.log(`   ... and ${discoveryData.githubTools.length - 20} more`);
      }
    }
    
    if (discoveryData.recentTools.length > 0) {
      console.log(`\n🕒 Recently Added Tools (Last 24h - ${discoveryData.recentTools.length}):`);
      discoveryData.recentTools.slice(0, 10).forEach((tool, index) => {
        const hasImage = tool.image && tool.image.trim() !== '';
        const status = hasImage ? '✅' : '❌';
        console.log(`   ${(index + 1).toString().padStart(2)}. ${status} ${tool.name}`);
        console.log(`      Category: ${tool.category || 'Unknown'}`);
      });
    }
    
    // Overall statistics
    console.log('\n' + '='.repeat(70));
    console.log('📈 OVERALL STATISTICS');
    console.log('='.repeat(70));
    
    const totalWithImages = Object.values(categoryData.categoryMap).reduce(
      (sum, cat) => sum + cat.withImages, 0
    );
    const totalWithoutImages = Object.values(categoryData.categoryMap).reduce(
      (sum, cat) => sum + cat.withoutImages, 0
    );
    const imagePercentage = ((totalWithImages / categoryData.totalTools) * 100).toFixed(1);
    
    console.log(`\n   Total tools in database: ${categoryData.totalTools}`);
    console.log(`   ✅ Tools with images: ${totalWithImages} (${imagePercentage}%)`);
    console.log(`   ❌ Tools without images: ${totalWithoutImages}`);
    console.log(`   📁 Total categories: ${Object.keys(categoryData.categoryMap).length}`);
    
    // Save report to file
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportData = {
      generatedAt: new Date().toISOString(),
      statistics: {
        totalTools: categoryData.totalTools,
        totalWithImages,
        totalWithoutImages,
        imagePercentage: parseFloat(imagePercentage),
        totalCategories: Object.keys(categoryData.categoryMap).length,
        githubTools: discoveryData.githubTools.length,
        recentTools: discoveryData.recentTools.length,
      },
      categories: Object.fromEntries(
        Object.entries(categoryData.categoryMap).map(([cat, data]) => [
          cat,
          {
            total: data.total,
            withImages: data.withImages,
            withoutImages: data.withoutImages,
            percentage: ((data.withImages / data.total) * 100).toFixed(1)
          }
        ])
      ),
      ideTools: categoryData.ideTools.slice(0, 50).map(t => ({
        name: t.name,
        category: t.category,
        platform: t.platform,
        hasImage: t.hasImage
      })),
      newlyDiscovered: {
        githubTools: discoveryData.githubTools.slice(0, 100).map(t => ({
          name: t.name,
          category: t.category,
          platform: t.platform,
          hasImage: !!t.image && t.image.trim() !== ''
        })),
        recentTools: discoveryData.recentTools.slice(0, 50).map(t => ({
          name: t.name,
          category: t.category,
          platform: t.platform,
          hasImage: !!t.image && t.image.trim() !== ''
        }))
      }
    };
    
    const reportPath = path.join(reportsDir, `discovery-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    console.log('\n✅ Report generation complete!\n');
    
    return reportData;
    
  } catch (error) {
    console.error('❌ Error generating report:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateDetailedReport()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { generateDetailedReport, checkCategoryDistribution, checkNewlyDiscoveredTools };

