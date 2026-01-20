/**
 * Re-categorize AI Tools
 * 
 * This script:
 * 1. Breaks down "Generative AI" into proper subcategories
 * 2. Creates "Research & Open Source" category for papers/repos
 * 3. Adds priority scoring (consumer tools = higher priority)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Category mapping based on keywords in name, description, tags, and platform
const CATEGORY_RULES = [
    // Research & Open Source (GitHub repos, ArXiv, Papers)
    {
        category: 'Research & Open Source',
        priority: 30, // Lower priority - research tools
        keywords: {
            platform: ['github.com', 'arxiv.org', 'paperswithcode.com', 'huggingface.co/spaces'],
            name: [],
            description: ['research paper', 'arxiv', 'open source implementation', 'pytorch implementation', 'tensorflow implementation'],
            tags: ['research-paper', 'open-source', 'arxiv', 'papers-with-code']
        }
    },

    // Writing & Content
    {
        category: 'Writing & Content',
        priority: 85,
        keywords: {
            platform: [],
            name: ['write', 'copy', 'content', 'blog', 'article', 'text', 'essay', 'grammar', 'paraphras'],
            description: ['writing', 'copywriting', 'blog post', 'content creation', 'article', 'essay', 'grammar', 'paraphrase', 'rewrite', 'seo content'],
            tags: ['writing', 'copywriting', 'content', 'blog', 'seo', 'grammar', 'paraphrasing']
        }
    },

    // Image Generation
    {
        category: 'Image Generation',
        priority: 85,
        keywords: {
            platform: [],
            name: ['image', 'art', 'photo', 'picture', 'visual', 'draw', 'paint', 'design', 'logo', 'icon'],
            description: ['image generat', 'art generat', 'text-to-image', 'text to image', 'ai art', 'create image', 'generate image', 'photo edit', 'background remov', 'logo'],
            tags: ['image-generation', 'text-to-image', 'ai-art', 'image-editing', 'background-removal', 'logo']
        }
    },

    // Video Generation
    {
        category: 'Video Generation',
        priority: 85,
        keywords: {
            platform: [],
            name: ['video', 'film', 'movie', 'clip', 'animation', 'animate'],
            description: ['video generat', 'text-to-video', 'text to video', 'video edit', 'video creat', 'animation', 'animate', 'short clip', 'video content'],
            tags: ['video-generation', 'text-to-video', 'video-editing', 'animation']
        }
    },

    // Audio & Music
    {
        category: 'Audio & Music',
        priority: 85,
        keywords: {
            platform: [],
            name: ['audio', 'music', 'sound', 'song', 'voice', 'speech', 'podcast', 'tts'],
            description: ['audio', 'music generat', 'text-to-speech', 'voice', 'speech', 'podcast', 'sound', 'song', 'voiceover', 'text to speech'],
            tags: ['audio', 'music', 'text-to-speech', 'voice', 'speech', 'podcast', 'tts']
        }
    },

    // Code & Development
    {
        category: 'Code & Development',
        priority: 85,
        keywords: {
            platform: [],
            name: ['code', 'coding', 'program', 'develop', 'debug', 'compiler'],
            description: ['code generat', 'code complet', 'programming', 'developer', 'coding assistant', 'write code', 'debug', 'software development'],
            tags: ['code-generation', 'coding', 'programming', 'developer-tools', 'code-completion']
        }
    },

    // Chatbots & Assistants (keep existing, add priority)
    {
        category: 'ChatBots',
        priority: 90,
        keywords: {
            platform: [],
            name: ['chat', 'gpt', 'assistant', 'bot', 'conversation'],
            description: ['chatbot', 'conversational', 'chat assistant', 'ai assistant', 'virtual assistant', 'chat with'],
            tags: ['chatbot', 'assistant', 'conversational-ai', 'chat']
        }
    },

    // Productivity & Automation
    {
        category: 'Productivity',
        priority: 85,
        keywords: {
            platform: [],
            name: ['automat', 'workflow', 'task', 'schedule', 'calendar', 'meeting', 'note', 'document'],
            description: ['automat', 'workflow', 'productivity', 'task management', 'scheduling', 'meeting', 'note-taking', 'document'],
            tags: ['automation', 'productivity', 'workflow', 'task-management', 'scheduling']
        }
    },

    // Marketing & Sales
    {
        category: 'Marketing & Sales',
        priority: 80,
        keywords: {
            platform: [],
            name: ['market', 'sale', 'crm', 'lead', 'campaign', 'ad ', 'ads', 'social media'],
            description: ['marketing', 'sales', 'crm', 'lead generat', 'campaign', 'advertis', 'social media market'],
            tags: ['marketing', 'sales', 'crm', 'advertising', 'social-media']
        }
    },

    // Data & Analytics (keep existing)
    {
        category: 'Data & Analytics',
        priority: 75,
        keywords: {
            platform: [],
            name: ['data', 'analy', 'insight', 'dashboard', 'report', 'metric'],
            description: ['data analysis', 'analytics', 'business intelligence', 'insights', 'dashboard', 'reporting'],
            tags: ['data-analysis', 'analytics', 'business-intelligence', 'reporting']
        }
    },

    // Learning & Education (keep existing)
    {
        category: 'Learning & Education',
        priority: 85,
        keywords: {
            platform: [],
            name: ['learn', 'study', 'tutor', 'education', 'course', 'quiz', 'flashcard'],
            description: ['learning', 'education', 'study', 'tutor', 'course', 'quiz', 'flashcard', 'homework'],
            tags: ['learning', 'education', 'study', 'tutor', 'e-learning']
        }
    },

    // Translation & Language
    {
        category: 'Translation & Language',
        priority: 80,
        keywords: {
            platform: [],
            name: ['translat', 'language', 'locali'],
            description: ['translat', 'language', 'locali', 'multilingual'],
            tags: ['translation', 'language', 'localization', 'multilingual']
        }
    },

    // Customer Service
    {
        category: 'Customer Service',
        priority: 80,
        keywords: {
            platform: [],
            name: ['support', 'helpdesk', 'customer', 'ticket'],
            description: ['customer service', 'support', 'helpdesk', 'ticket', 'customer support'],
            tags: ['customer-service', 'support', 'helpdesk']
        }
    },

    // Healthcare & Medical
    {
        category: 'Healthcare',
        priority: 75,
        keywords: {
            platform: [],
            name: ['health', 'medical', 'diagnos', 'patient', 'clinic', 'doctor'],
            description: ['healthcare', 'medical', 'diagnosis', 'patient', 'clinical', 'health'],
            tags: ['healthcare', 'medical', 'health', 'clinical']
        }
    },

    // Finance & Fintech
    {
        category: 'Finance',
        priority: 75,
        keywords: {
            platform: [],
            name: ['financ', 'invest', 'trading', 'stock', 'crypto', 'bank'],
            description: ['financial', 'investment', 'trading', 'stock', 'cryptocurrency', 'banking', 'fintech'],
            tags: ['finance', 'fintech', 'trading', 'investment', 'crypto']
        }
    },

    // Gaming & Entertainment
    {
        category: 'Gaming & Entertainment',
        priority: 80,
        keywords: {
            platform: [],
            name: ['game', 'gaming', 'entertainment', 'character', 'roleplay'],
            description: ['gaming', 'game development', 'entertainment', 'character', 'roleplay', 'npc'],
            tags: ['gaming', 'game-development', 'entertainment', 'character']
        }
    },

    // Computer Vision (keep existing)
    {
        category: 'Computer Vision',
        priority: 70,
        keywords: {
            platform: [],
            name: ['vision', 'detection', 'recognition', 'segment', 'ocr'],
            description: ['computer vision', 'object detection', 'image recognition', 'segmentation', 'ocr', 'optical character'],
            tags: ['computer-vision', 'object-detection', 'image-recognition', 'ocr']
        }
    },

    // NLP & Text Analysis
    {
        category: 'NLP & Text Analysis',
        priority: 70,
        keywords: {
            platform: [],
            name: ['nlp', 'sentiment', 'entity', 'summariz', 'extract'],
            description: ['natural language', 'nlp', 'sentiment analysis', 'entity extraction', 'text analysis', 'summarization'],
            tags: ['nlp', 'natural-language', 'sentiment', 'text-analysis']
        }
    },

    // 3D & Spatial
    {
        category: '3D & Spatial',
        priority: 75,
        keywords: {
            platform: [],
            name: ['3d', 'model', 'spatial', 'mesh', 'render'],
            description: ['3d model', '3d generation', 'spatial', 'mesh', 'rendering', 'three-dimensional'],
            tags: ['3d', '3d-generation', 'spatial', 'rendering']
        }
    },

    // Agents & Automation
    {
        category: 'AI Agents',
        priority: 85,
        keywords: {
            platform: [],
            name: ['agent', 'autonomous', 'autogpt', 'auto-gpt'],
            description: ['ai agent', 'autonomous', 'agent framework', 'multi-agent', 'agent-based'],
            tags: ['agent', 'autonomous', 'ai-agents', 'automation']
        }
    },
];

// Priority boosts based on indicators of consumer-readiness
const PRIORITY_BOOSTS = {
    hasWebsite: 5,        // Has a proper website (not just GitHub)
    hasPrice: 5,          // Has pricing info
    isFreemium: 10,       // Freemium model = consumer-friendly
    isTrending: 10,       // Trending tools get boost
    highPopularity: 10,   // Popular tools
    hasImage: 5           // Has a logo/image
};

/**
 * Determine the best category for a tool
 */
function categorizeToolAdvanced(tool) {
    const name = (tool.name || '').toLowerCase();
    const description = (tool.description || '').toLowerCase();
    const platform = (tool.platform || '').toLowerCase();
    const tags = (tool.tags || []).map(t => t.toLowerCase());

    let bestCategory = null;
    let bestScore = 0;

    for (const rule of CATEGORY_RULES) {
        let score = 0;

        // Check platform keywords
        for (const kw of rule.keywords.platform) {
            if (platform.includes(kw)) score += 10;
        }

        // Check name keywords
        for (const kw of rule.keywords.name) {
            if (name.includes(kw)) score += 5;
        }

        // Check description keywords
        for (const kw of rule.keywords.description) {
            if (description.includes(kw)) score += 3;
        }

        // Check tags
        for (const kw of rule.keywords.tags) {
            if (tags.includes(kw)) score += 4;
        }

        if (score > bestScore) {
            bestScore = score;
            bestCategory = rule.category;
        }
    }

    // If no strong match and tool is from GitHub, categorize as Research
    if (!bestCategory || bestScore < 5) {
        if (platform.includes('github.com') || platform.includes('arxiv.org')) {
            bestCategory = 'Research & Open Source';
        } else {
            // Keep as Generative AI but with lower priority
            bestCategory = 'Generative AI';
        }
    }

    return bestCategory;
}

/**
 * Calculate priority score for a tool
 */
function calculatePriority(tool, newCategory) {
    // Start with base priority from category
    const categoryRule = CATEGORY_RULES.find(r => r.category === newCategory);
    let priority = categoryRule ? categoryRule.priority : 50;

    const platform = (tool.platform || '').toLowerCase();
    const pricing = (tool.pricing || '').toLowerCase();
    const accessType = (tool.access_type || '').toLowerCase();

    // Boost for having a proper website (not GitHub)
    if (!platform.includes('github.com') && !platform.includes('arxiv.org')) {
        if (platform.includes('https://') || platform.includes('http://')) {
            priority += PRIORITY_BOOSTS.hasWebsite;
        }
    }

    // Boost for pricing info
    if (pricing && pricing !== 'unknown' && pricing.length > 2) {
        priority += PRIORITY_BOOSTS.hasPrice;
    }

    // Boost for freemium
    if (accessType === 'freemium' || accessType === 'free') {
        priority += PRIORITY_BOOSTS.isFreemium;
    }

    // Boost for trending
    if (tool.is_trending) {
        priority += PRIORITY_BOOSTS.isTrending;
    }

    // Boost for high popularity
    if (tool.popularity && tool.popularity > 75) {
        priority += PRIORITY_BOOSTS.highPopularity;
    }

    // Boost for having an image
    if (tool.image && tool.image.trim() !== '') {
        priority += PRIORITY_BOOSTS.hasImage;
    }

    // Clamp to 0-100
    return Math.min(100, Math.max(0, priority));
}

/**
 * Main re-categorization function
 */
async function recategorizeAllTools() {
    console.log('🔄 Starting comprehensive re-categorization...\n');
    console.log('='.repeat(60));

    // Fetch all tools
    let allTools = [];
    let page = 0;
    const pageSize = 1000;

    console.log('📥 Fetching all tools from database...');

    while (true) {
        const { data, error } = await supabase
            .from('ai_tools')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching tools:', error);
            break;
        }

        if (!data || data.length === 0) break;
        allTools.push(...data);
        page++;
    }

    console.log(`   Found ${allTools.length} tools total\n`);

    // Track stats
    const categoryStats = {};
    const changes = [];
    let processed = 0;

    console.log('🏷️  Re-categorizing tools...\n');

    for (const tool of allTools) {
        const oldCategory = tool.category;
        const newCategory = categorizeToolAdvanced(tool);
        const priority = calculatePriority(tool, newCategory);

        // Track stats
        if (!categoryStats[newCategory]) {
            categoryStats[newCategory] = { count: 0, fromGenerativeAI: 0 };
        }
        categoryStats[newCategory].count++;

        if (oldCategory === 'Generative AI' && newCategory !== 'Generative AI') {
            categoryStats[newCategory].fromGenerativeAI++;
        }

        // Only update if category changed OR priority needs updating
        if (oldCategory !== newCategory || tool.priority !== priority) {
            changes.push({
                id: tool.id,
                name: tool.name,
                oldCategory,
                newCategory,
                priority
            });
        }

        processed++;
        if (processed % 500 === 0) {
            console.log(`   Processed ${processed}/${allTools.length} tools...`);
        }
    }

    console.log(`\n📊 Category Distribution After Re-categorization:\n`);
    console.log('='.repeat(60));

    // Sort by count
    const sortedStats = Object.entries(categoryStats)
        .sort((a, b) => b[1].count - a[1].count);

    for (const [category, stats] of sortedStats) {
        const pct = ((stats.count / allTools.length) * 100).toFixed(1);
        const migrated = stats.fromGenerativeAI > 0 ? ` (+${stats.fromGenerativeAI} from Generative AI)` : '';
        console.log(`${stats.count.toString().padStart(5)} (${pct.padStart(5)}%) - ${category}${migrated}`);
    }

    console.log(`\n\n🔄 Changes to apply: ${changes.length}\n`);

    if (changes.length === 0) {
        console.log('✅ No changes needed!');
        return;
    }

    // Apply changes in batches
    console.log('💾 Applying changes to database...\n');

    const batchSize = 50;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < changes.length; i += batchSize) {
        const batch = changes.slice(i, i + batchSize);

        for (const change of batch) {
            // Store priority in popularity field (since priority column may not exist)
            const { error } = await supabase
                .from('ai_tools')
                .update({
                    category: change.newCategory,
                    popularity: change.priority  // Use popularity for priority scoring
                })
                .eq('id', change.id);

            if (error) {
                failed++;
            } else {
                updated++;
            }
        }

        console.log(`   Updated ${Math.min(i + batchSize, changes.length)}/${changes.length}...`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n✅ Re-categorization complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Failed: ${failed}`);

    // Show sample changes
    console.log(`\n📋 Sample Changes (first 20):\n`);
    for (const change of changes.slice(0, 20)) {
        console.log(`   ${change.name}`);
        console.log(`      ${change.oldCategory} → ${change.newCategory} (priority: ${change.priority})`);
    }
}

// Run
recategorizeAllTools().catch(console.error);
