#!/usr/bin/env node

/**
 * Script to fix IDE tool categories - move known IDEs to IDEs category
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
 * Known IDE tools that should be in IDEs category
 * These are actual IDE tools, not code assistants or extensions
 */
const knownIDEs = [
  // Popular AI-powered IDEs
  { name: 'Cursor', platform: 'cursor.sh', exact: true },
  { name: 'Windsurf', platform: 'windsurf', exact: false },
  { name: 'Antigravity', platform: 'antigravity', exact: true },
  
  // Code assistants that work as IDE extensions (these are borderline but user requested)
  { name: 'Codeium', platform: 'codeium.com', exact: true },
  { name: 'Tabnine', platform: 'tabnine.com', exact: true },
  
  // Jupyter (IDE/notebook)
  { name: 'Jupyter', platform: 'jupyter.org', exact: false },
  { name: 'JupyterLab', platform: 'jupyter.org', exact: false },
  { name: 'jupyter-ai', platform: 'jupyterlab/jupyter-ai', exact: true },
];

/**
 * IDE extensions/plugins (these might stay in Code Generation or move to IDEs)
 */
const ideExtensions = [
  { name: 'Code-GPT', platform: 'marketplace.visualstudio.com', exact: true },
  { name: 'Kilo Code', platform: 'kilocode.ai', exact: true },
];

/**
 * IDE patterns to search for
 */
const ideSearchPatterns = [
  // Direct matches
  { name: 'Cursor', exact: false },
  { name: 'Windsurf', exact: false },
  { name: 'Antigravity', exact: false },
  { name: 'Codeium', exact: false },
  { name: 'Tabnine', exact: false },
  { name: 'Jupyter', exact: false },
  { name: 'JupyterLab', exact: false },
  
  // VS Code related
  { name: 'Code-GPT', exact: false },
  { name: 'Kilo Code', exact: false },
  { platform: 'cursor.sh', exact: false },
  { platform: 'code.visualstudio.com', exact: false },
  { platform: 'marketplace.visualstudio.com', exact: false },
  { platform: 'plugins.jetbrains.com', exact: false },
];

/**
 * Find IDE tools and update their categories
 */
async function fixIDECategories(dryRun = false) {
  console.log('🔍 Finding and fixing IDE tool categories...\n');
  console.log('='.repeat(70));
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  const toolsToUpdate = [];
  
  // Search for each known IDE with precise matching
  for (const ide of knownIDEs) {
    let query = supabase
      .from('ai_tools')
      .select('id, name, category, platform, description');
    
    if (ide.exact) {
      // Exact name match
      query = query.ilike('name', ide.name);
    } else {
      // Fuzzy match
      query = query.or(`name.ilike.%${ide.name}%,platform.ilike.%${ide.platform}%`);
    }
    
    if (ide.platform) {
      query = query.ilike('platform', `%${ide.platform}%`);
    }
    
    const { data: tools, error } = await query.limit(10);
    
    if (error) {
      console.error(`❌ Error searching for ${ide.name}:`, error.message);
      continue;
    }
    
    if (tools && tools.length > 0) {
      tools.forEach(tool => {
        const currentCat = (tool.category || '').toLowerCase();
        const nameLower = (tool.name || '').toLowerCase();
        const platformLower = (tool.platform || '').toLowerCase();
        
        // Verify it's actually the IDE we're looking for
        let isMatch = false;
        if (ide.exact) {
          isMatch = nameLower === ide.name.toLowerCase() || platformLower.includes(ide.platform);
        } else {
          isMatch = nameLower.includes(ide.name.toLowerCase()) || platformLower.includes(ide.platform);
        }
        
        // Exclude false positives
        if (nameLower.includes('image recursor') || 
            nameLower.includes('gemini 3') || 
            nameLower.includes('atomwise') ||
            nameLower.includes('atomic calendar') ||
            nameLower.includes('research paper')) {
          isMatch = false;
        }
        
        // Only update if not already in IDEs category and it's a match
        if (isMatch && !currentCat.includes('ide') && !currentCat.includes('ides')) {
          toolsToUpdate.push({
            ...tool,
            searchTerm: ide.name || ide.platform,
          });
        }
      });
    }
  }
  
  // Search for IDE extensions
  for (const ext of ideExtensions) {
    const { data: tools, error } = await supabase
      .from('ai_tools')
      .select('id, name, category, platform, description')
      .or(`name.ilike.%${ext.name}%,platform.ilike.%${ext.platform}%`)
      .limit(10);
    
    if (error) continue;
    
    if (tools && tools.length > 0) {
      tools.forEach(tool => {
        const currentCat = (tool.category || '').toLowerCase();
        const nameLower = (tool.name || '').toLowerCase();
        const platformLower = (tool.platform || '').toLowerCase();
        
        // Verify it's the extension we want
        const isMatch = nameLower.includes(ext.name.toLowerCase()) || platformLower.includes(ext.platform);
        
        if (isMatch && !currentCat.includes('ide') && !currentCat.includes('ides')) {
          const exists = toolsToUpdate.some(t => t.id === tool.id);
          if (!exists) {
            toolsToUpdate.push({
              ...tool,
              searchTerm: ext.name,
            });
          }
        }
      });
    }
  }
  
  // Also search for patterns
  for (const pattern of ideSearchPatterns) {
    const conditions = [];
    
    if (pattern.name) {
      conditions.push(`name.ilike.%${pattern.name}%`);
      conditions.push(`description.ilike.%${pattern.name}%`);
    }
    if (pattern.platform) {
      conditions.push(`platform.ilike.%${pattern.platform}%`);
    }
    
    if (conditions.length > 0) {
      const { data: tools, error } = await supabase
        .from('ai_tools')
        .select('id, name, category, platform, description')
        .or(conditions.join(','))
        .limit(20);
      
      if (error) continue;
      
      if (tools && tools.length > 0) {
        tools.forEach(tool => {
          const nameLower = (tool.name || '').toLowerCase();
          const descLower = (tool.description || '').toLowerCase();
          const platformLower = (tool.platform || '').toLowerCase();
          const currentCat = (tool.category || '').toLowerCase();
          
          // Check if it's actually an IDE (not just mentioning the name)
          // Exclude false positives first
          const falsePositives = [
            'image recursor', 'image generation', 'video', 'audio', 'music',
            'atomwise', 'atomic calendar', 'atomiclife', 'gemini model',
            'research paper', 'drug discovery', 'calendar app'
          ];
          
          const isFalsePositive = falsePositives.some(fp => 
            nameLower.includes(fp) || descLower.includes(fp)
          );
          
          // Skip false positives
          if (!isFalsePositive) {
            const isIDE = 
              // Cursor IDE (must be the actual IDE, not just mentioning cursor)
              ((nameLower === 'cursor' || nameLower.includes('cursor ide')) && platformLower.includes('cursor.sh')) ||
              // Windsurf IDE
              ((nameLower === 'windsurf' || nameLower.includes('windsurf ide')) && !nameLower.includes('windsurf ai')) ||
              // Antigravity IDE (Google's IDE)
              (nameLower.includes('antigravity') && (descLower.includes('ide') || descLower.includes('development environment') || descLower.includes('ai-first ide'))) ||
              // VS Code extensions (must be extensions, not just mentioning VS Code)
              (platformLower.includes('marketplace.visualstudio.com') && (descLower.includes('extension') || descLower.includes('plugin'))) ||
              // JetBrains plugins
              (platformLower.includes('plugins.jetbrains.com')) ||
              // Jupyter IDE/notebook
              ((nameLower.includes('jupyter') && (descLower.includes('notebook') || descLower.includes('ide') || platformLower.includes('jupyter.org'))) && 
               !nameLower.includes('fastbook') && !nameLower.includes('homemade-machine-learning'));
            
            if (isIDE && !currentCat.includes('ide') && !currentCat.includes('ides')) {
              // Check if already in our list
              const exists = toolsToUpdate.some(t => t.id === tool.id);
              if (!exists) {
                toolsToUpdate.push({
                  ...tool,
                  searchTerm: pattern.name || pattern.platform,
                });
              }
            }
          }
        });
      }
    }
  }
  
  // Deduplicate
  const uniqueTools = [];
  const seen = new Set();
  toolsToUpdate.forEach(tool => {
    if (!seen.has(tool.id)) {
      seen.add(tool.id);
      uniqueTools.push(tool);
    }
  });
  
  console.log(`\n📊 Found ${uniqueTools.length} IDE tools that need re-categorization:\n`);
  
  uniqueTools.forEach((tool, index) => {
    console.log(`${(index + 1).toString().padStart(3)}. ${tool.name}`);
    console.log(`    Current: ${tool.category}`);
    console.log(`    New: IDEs`);
    console.log(`    Platform: ${tool.platform}`);
    console.log('');
  });
  
  if (dryRun || uniqueTools.length === 0) {
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
  
  for (let i = 0; i < uniqueTools.length; i += batchSize) {
    const batch = uniqueTools.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(uniqueTools.length / batchSize);
    
    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} tools)...`);
    
    const updatePromises = batch.map(async (tool) => {
      try {
        const { error } = await supabase
          .from('ai_tools')
          .update({ category: 'IDEs' })
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
    if (i + batchSize < uniqueTools.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('='.repeat(70));
  console.log('✅ RE-CATEGORIZATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successfully updated: ${totalUpdated} tools`);
  console.log(`   ❌ Errors: ${totalErrors} tools`);
  console.log(`   📁 They are now in the "IDEs" category\n`);
  
  return { updated: totalUpdated, errors: totalErrors };
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  try {
    await fixIDECategories(dryRun);
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

module.exports = { fixIDECategories };

