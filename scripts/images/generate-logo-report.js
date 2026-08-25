#!/usr/bin/env node

/**
 * Generate detailed report of logo fetching results
 * Creates CSV and JSON reports with statistics
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

async function generateReport() {
  console.log('📊 Generating detailed logo report...\n');

  try {
    // Fetch all tools
    let allTools = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    console.log('📥 Loading all tools from database...');
    while (hasMore) {
      const { data: tools, error } = await supabase
        .from('ai_tools')
        .select('id, name, platform, image, popularity, category')
        .order('popularity', { ascending: false })
        .range(offset, offset + batchSize - 1);
      
      if (error) {
        throw error;
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

    console.log(`✅ Loaded ${allTools.length} tools\n`);

    // Categorize tools
    const categorized = {
      withStorageImages: [],
      withExternalImages: [],
      withDefaultImages: [],
      withoutImages: [],
      invalidImages: [],
    };

    allTools.forEach(tool => {
      if (!tool.image || tool.image.trim() === '') {
        categorized.withoutImages.push(tool);
      } else if (tool.image.includes('supabase.co/storage')) {
        categorized.withStorageImages.push(tool);
      } else if (tool.image.includes('/og-image.png') || tool.image.includes('/assets/default.png')) {
        categorized.withDefaultImages.push(tool);
      } else if (tool.image.startsWith('http')) {
        categorized.withExternalImages.push(tool);
      } else {
        categorized.invalidImages.push(tool);
      }
    });

    // Generate statistics
    const stats = {
      total: allTools.length,
      withStorageImages: categorized.withStorageImages.length,
      withExternalImages: categorized.withExternalImages.length,
      withDefaultImages: categorized.withDefaultImages.length,
      withoutImages: categorized.withoutImages.length,
      invalidImages: categorized.invalidImages.length,
      percentageComplete: ((categorized.withStorageImages.length / allTools.length) * 100).toFixed(1),
      percentageWithAnyImage: (((categorized.withStorageImages.length + categorized.withExternalImages.length) / allTools.length) * 100).toFixed(1),
    };

    // Generate CSV report
    const csvLines = [
      'Tool ID,Name,Platform,Image URL,Image Status,Category,Popularity',
    ];

    allTools.forEach(tool => {
      let status = 'Without Image';
      if (tool.image) {
        if (tool.image.includes('supabase.co/storage')) {
          status = 'Storage';
        } else if (tool.image.includes('/og-image.png') || tool.image.includes('/assets/default.png')) {
          status = 'Default';
        } else if (tool.image.startsWith('http')) {
          status = 'External';
        } else {
          status = 'Invalid';
        }
      }

      const line = [
        tool.id,
        `"${(tool.name || '').replace(/"/g, '""')}"`,
        `"${(tool.platform || '').replace(/"/g, '""')}"`,
        `"${(tool.image || '').replace(/"/g, '""')}"`,
        status,
        `"${(tool.category || '').replace(/"/g, '""')}"`,
        tool.popularity || 0,
      ].join(',');
      csvLines.push(line);
    });

    // Generate JSON report
    const jsonReport = {
      generatedAt: new Date().toISOString(),
      statistics: stats,
      byCategory: {},
      toolsWithoutImages: categorized.withoutImages.map(t => ({
        id: t.id,
        name: t.name,
        platform: t.platform,
      })),
      toolsWithDefaultImages: categorized.withDefaultImages.map(t => ({
        id: t.id,
        name: t.name,
        platform: t.platform,
      })),
      toolsWithStorageImages: categorized.withStorageImages.slice(0, 100).map(t => ({
        id: t.id,
        name: t.name,
        image: t.image,
      })),
    };

    // Group by category
    allTools.forEach(tool => {
      const category = tool.category || 'Unknown';
      if (!jsonReport.byCategory[category]) {
        jsonReport.byCategory[category] = {
          total: 0,
          withStorageImages: 0,
          withDefaultImages: 0,
          withoutImages: 0,
        };
      }
      jsonReport.byCategory[category].total++;
      
      if (!tool.image || tool.image.trim() === '') {
        jsonReport.byCategory[category].withoutImages++;
      } else if (tool.image.includes('supabase.co/storage')) {
        jsonReport.byCategory[category].withStorageImages++;
      } else if (tool.image.includes('/og-image.png') || tool.image.includes('/assets/default.png')) {
        jsonReport.byCategory[category].withDefaultImages++;
      }
    });

    // Create reports directory
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Write CSV file
    const csvPath = path.join(reportsDir, `logo-report-${Date.now()}.csv`);
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');

    // Write JSON file
    const jsonPath = path.join(reportsDir, `logo-report-${Date.now()}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf8');

    // Print summary
    console.log('='.repeat(60));
    console.log('📊 LOGO FETCHING REPORT');
    console.log('='.repeat(60));
    console.log(`   Total tools: ${stats.total}`);
    console.log(`   ✅ Storage images: ${stats.withStorageImages} (${stats.percentageComplete}%)`);
    console.log(`   🌐 External images: ${stats.withExternalImages}`);
    console.log(`   ⚠️  Default images: ${stats.withDefaultImages}`);
    console.log(`   ❌ Without images: ${stats.withoutImages}`);
    console.log(`   🚫 Invalid images: ${stats.invalidImages}`);
    console.log('');
    console.log(`   📈 Overall completion: ${stats.percentageWithAnyImage}% with any image`);
    console.log('='.repeat(60));

    // Print category breakdown
    console.log('\n📁 By Category:\n');
    Object.entries(jsonReport.byCategory)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .forEach(([category, data]) => {
        const pct = ((data.withStorageImages / data.total) * 100).toFixed(1);
        console.log(`   ${category}:`);
        console.log(`      Total: ${data.total} | Storage: ${data.withStorageImages} (${pct}%) | Default: ${data.withDefaultImages} | Missing: ${data.withoutImages}`);
      });

    console.log(`\n📄 Reports saved to:`);
    console.log(`   CSV: ${csvPath}`);
    console.log(`   JSON: ${jsonPath}\n`);

    return jsonReport;
  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  generateReport()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { generateReport };

