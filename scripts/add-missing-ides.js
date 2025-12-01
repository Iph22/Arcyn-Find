#!/usr/bin/env node

/**
 * Add missing IDE tools to the database
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
 * Missing IDE tools to add
 */
const missingIDEs = [
  {
    name: 'Windsurf',
    category: 'IDEs',
    description: 'AI-powered IDE that brings AI assistance directly into your coding workflow. Windsurf provides intelligent code completion, context-aware suggestions, and AI-driven development assistance.',
    platform: 'https://code.windsurf.ai',
    region: 'Global',
    accessType: 'Freemium',
    pricing: 'Free, Paid plans available',
    tags: ['ide', 'code-editor', 'ai-coding', 'development-environment'],
    popularity: 75,
    isTrending: true,
  },
  {
    name: 'Visual Studio Code',
    category: 'IDEs',
    description: 'Free, open-source code editor with extensive extension marketplace. VS Code is one of the most popular code editors, supporting multiple programming languages and frameworks.',
    platform: 'https://code.visualstudio.com',
    region: 'Global',
    accessType: 'Free',
    pricing: 'Free',
    tags: ['ide', 'code-editor', 'microsoft', 'open-source'],
    popularity: 95,
    isTrending: true,
  },
  {
    name: 'Jupyter',
    category: 'IDEs',
    description: 'Open-source web application for creating and sharing computational documents. Jupyter notebooks combine live code, equations, visualizations, and narrative text.',
    platform: 'https://jupyter.org',
    region: 'Global',
    accessType: 'Free',
    pricing: 'Free',
    tags: ['ide', 'notebook', 'data-science', 'python', 'open-source'],
    popularity: 85,
    isTrending: false,
  },
  {
    name: 'JupyterLab',
    category: 'IDEs',
    description: 'Next-generation web-based user interface for Project Jupyter. JupyterLab is a flexible and extensible IDE for data science, machine learning, and scientific computing.',
    platform: 'https://jupyter.org',
    region: 'Global',
    accessType: 'Free',
    pricing: 'Free',
    tags: ['ide', 'notebook', 'data-science', 'jupyter'],
    popularity: 80,
    isTrending: false,
  },
  {
    name: 'IntelliJ IDEA',
    category: 'IDEs',
    description: 'Powerful IDE for Java development with intelligent coding assistance, advanced debugging, and comprehensive refactoring tools. Also supports Kotlin, Scala, and other JVM languages.',
    platform: 'https://www.jetbrains.com/idea',
    region: 'Global',
    accessType: 'Freemium',
    pricing: 'Free Community Edition, Paid Ultimate Edition',
    tags: ['ide', 'java', 'jetbrains', 'development-environment'],
    popularity: 90,
    isTrending: false,
  },
  {
    name: 'WebStorm',
    category: 'IDEs',
    description: 'Professional IDE for modern JavaScript development. WebStorm provides intelligent code completion, on-the-fly error detection, and powerful navigation and refactoring capabilities.',
    platform: 'https://www.jetbrains.com/webstorm',
    region: 'Global',
    accessType: 'Paid',
    pricing: 'Paid',
    tags: ['ide', 'javascript', 'web-development', 'jetbrains'],
    popularity: 85,
    isTrending: false,
  },
  {
    name: 'PyCharm',
    category: 'IDEs',
    description: 'Professional Python IDE with intelligent code assistance, debugging, testing, and profiling. PyCharm helps developers write better Python code faster.',
    platform: 'https://www.jetbrains.com/pycharm',
    region: 'Global',
    accessType: 'Freemium',
    pricing: 'Free Community Edition, Paid Professional Edition',
    tags: ['ide', 'python', 'jetbrains', 'development-environment'],
    popularity: 88,
    isTrending: false,
  },
];

/**
 * Generate ID for a tool
 */
function generateId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

/**
 * Check if tool already exists
 */
async function toolExists(name, platform) {
  const { data } = await supabase
    .from('ai_tools')
    .select('id, name')
    .or(`name.ilike.${name},platform.ilike.${platform}`)
    .limit(1);
  
  return data && data.length > 0;
}

/**
 * Add missing IDE tools
 */
async function addMissingIDEs(dryRun = false) {
  console.log('🚀 Adding Missing IDE Tools...\n');
  console.log('='.repeat(70));
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  const toolsToAdd = [];
  
  // Check which tools are missing
  for (const ide of missingIDEs) {
    const exists = await toolExists(ide.name, ide.platform);
    if (!exists) {
      toolsToAdd.push(ide);
      console.log(`✅ Will add: ${ide.name}`);
    } else {
      console.log(`⚠️  Already exists: ${ide.name}`);
    }
  }
  
  console.log(`\n📊 Summary: ${toolsToAdd.length} new IDE tools to add\n`);
  
  if (toolsToAdd.length === 0) {
    console.log('✅ All IDE tools already exist in database!\n');
    return { added: 0, errors: 0 };
  }
  
  if (dryRun) {
    console.log('🔍 Preview of tools to add:\n');
    toolsToAdd.forEach((tool, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${tool.name}`);
      console.log(`    Platform: ${tool.platform}`);
      console.log(`    Category: ${tool.category}`);
      console.log(`    Description: ${tool.description.substring(0, 80)}...`);
      console.log('');
    });
    return { added: 0, errors: 0 };
  }
  
  // Add tools to database
  console.log('🔄 Adding tools to database...\n');
  
  const toolsForDb = toolsToAdd.map(ide => ({
    id: `ide-${generateId(ide.name)}`,
    name: ide.name,
    category: ide.category,
    description: ide.description,
    platform: ide.platform,
    region: ide.region,
    access_type: ide.accessType,
    pricing: ide.pricing,
    tags: ide.tags,
    popularity: ide.popularity,
    last_updated: new Date().toISOString().split('T')[0],
    is_trending: ide.isTrending,
    image: null, // Will be fetched later
  }));
  
  const { data, error } = await supabase
    .from('ai_tools')
    .insert(toolsForDb)
    .select();
  
  if (error) {
    console.error('❌ Error adding tools:', error.message);
    return { added: 0, errors: toolsToAdd.length };
  }
  
  console.log(`✅ Successfully added ${data?.length || 0} IDE tools!\n`);
  
  // List added tools
  if (data && data.length > 0) {
    console.log('📋 Added tools:');
    data.forEach((tool, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${tool.name}`);
    });
    console.log('');
  }
  
  return { added: data?.length || 0, errors: error ? toolsToAdd.length : 0 };
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  try {
    await addMissingIDEs(dryRun);
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

module.exports = { addMissingIDEs };

