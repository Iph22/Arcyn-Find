/**
 * Enhanced AI Tool Recategorization Script v2
 * 
 * Includes:
 * - Manual override list for 200+ well-known tools
 * - Improved keyword patterns
 * - Better edge case handling
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================================
// MANUAL OVERRIDES - Known tools with correct categories
// ============================================================================

const MANUAL_OVERRIDES = {
    // Chatbots / LLM Interfaces
    'chatgpt': 'ChatBots',
    'claude': 'ChatBots',
    'gemini': 'ChatBots',
    'gpt-4': 'ChatBots',
    'gpt-3': 'ChatBots',
    'gpt4': 'ChatBots',
    'gpt3': 'ChatBots',
    'bard': 'ChatBots',
    'google bard': 'ChatBots',
    'bing chat': 'ChatBots',
    'microsoft copilot': 'ChatBots',
    'perplexity': 'ChatBots',
    'perplexity ai': 'ChatBots',
    'you.com': 'ChatBots',
    'phind': 'ChatBots',
    'kagi': 'ChatBots',
    'pi': 'ChatBots',
    'poe': 'ChatBots',
    'huggingchat': 'ChatBots',
    'character.ai': 'ChatBots',
    'character ai': 'ChatBots',
    'llama': 'ChatBots',
    'llama 2': 'ChatBots',
    'llama 3': 'ChatBots',
    'mistral': 'ChatBots',
    'mixtral': 'ChatBots',
    'anthropic': 'ChatBots',
    'openai': 'ChatBots',
    'cohere': 'ChatBots',
    'ai21': 'ChatBots',
    'replika': 'ChatBots',
    'chai': 'ChatBots',
    'janitor ai': 'ChatBots',
    'inflection ai': 'ChatBots',
    'deepseek': 'ChatBots',
    'qwen': 'ChatBots',

    // Code & Development / IDEs
    'cursor': 'Code & Development',
    'github copilot': 'Code & Development',
    'copilot': 'Code & Development',
    'codeium': 'Code & Development',
    'tabnine': 'Code & Development',
    'replit': 'Code & Development',
    'windsurf': 'Code & Development',
    'cody': 'Code & Development',
    'sourcegraph': 'Code & Development',
    'amazon codewhisperer': 'Code & Development',
    'codewhisperer': 'Code & Development',
    'aider': 'Code & Development',
    'blackbox ai': 'Code & Development',
    'phind code': 'Code & Development',
    'codestral': 'Code & Development',
    'starcoder': 'Code & Development',
    'code llama': 'Code & Development',
    'codegpt': 'Code & Development',
    'continue': 'Code & Development',
    'vs code': 'Code & Development',
    'visual studio code': 'Code & Development',
    'pycharm': 'Code & Development',
    'jetbrains': 'Code & Development',
    'intellij': 'Code & Development',
    'webstorm': 'Code & Development',
    'sublime text': 'Code & Development',
    'neovim': 'Code & Development',
    'zed': 'Code & Development',
    'gitlab': 'Code & Development',
    'amazon q': 'Code & Development',
    'supermaven': 'Code & Development',
    'codium': 'Code & Development',
    'coderabbit': 'Code & Development',
    'sourcery': 'Code & Development',
    'snyk': 'Code & Development',
    'sonarqube': 'Code & Development',
    'antigravity': 'Code & Development',

    // Image Generation
    'midjourney': 'Image Generation',
    'dall-e': 'Image Generation',
    'dalle': 'Image Generation',
    'dall-e 2': 'Image Generation',
    'dall-e 3': 'Image Generation',
    'stable diffusion': 'Image Generation',
    'sdxl': 'Image Generation',
    'adobe firefly': 'Image Generation',
    'firefly': 'Image Generation',
    'leonardo ai': 'Image Generation',
    'ideogram': 'Image Generation',
    'playground ai': 'Image Generation',
    'nightcafe': 'Image Generation',
    'artbreeder': 'Image Generation',
    'craiyon': 'Image Generation',
    'bing image creator': 'Image Generation',
    'canva ai': 'Image Generation',
    'canva': 'Image Generation',
    'photoshop ai': 'Image Generation',
    'adobe photoshop': 'Image Generation',
    'flux': 'Image Generation',
    'getimg': 'Image Generation',
    'dreamstudio': 'Image Generation',
    'lexica': 'Image Generation',
    'clipdrop': 'Image Generation',
    'remove.bg': 'Image Generation',
    'photoroom': 'Image Generation',
    'pixlr': 'Image Generation',
    'fotor': 'Image Generation',
    'deep dream': 'Image Generation',
    'starryai': 'Image Generation',
    'wombo dream': 'Image Generation',
    'jasper art': 'Image Generation',
    'neural.love': 'Image Generation',
    'hotpot ai': 'Image Generation',

    // Video Generation
    'sora': 'Video Generation',
    'runway': 'Video Generation',
    'runway ml': 'Video Generation',
    'pika': 'Video Generation',
    'pika labs': 'Video Generation',
    'kling': 'Video Generation',
    'kling ai': 'Video Generation',
    'luma ai': 'Video Generation',
    'luma dream machine': 'Video Generation',
    'synthesia': 'Video Generation',
    'heygen': 'Video Generation',
    'd-id': 'Video Generation',
    'colossyan': 'Video Generation',
    'pictory': 'Video Generation',
    'invideo': 'Video Generation',
    'lumen5': 'Video Generation',
    'steve.ai': 'Video Generation',
    'fliki': 'Video Generation',
    'vidnoz': 'Video Generation',
    'kapwing': 'Video Generation',
    'opus clip': 'Video Generation',
    'veed.io': 'Video Generation',
    'descript': 'Video Generation',
    'wondershare filmora': 'Video Generation',
    'animoto': 'Video Generation',
    'renderforest': 'Video Generation',

    // Audio & Music
    'elevenlabs': 'Audio & Music',
    'eleven labs': 'Audio & Music',
    'murf': 'Audio & Music',
    'murf ai': 'Audio & Music',
    'play.ht': 'Audio & Music',
    'speechify': 'Audio & Music',
    'suno': 'Audio & Music',
    'suno ai': 'Audio & Music',
    'udio': 'Audio & Music',
    'aiva': 'Audio & Music',
    'soundraw': 'Audio & Music',
    'boomy': 'Audio & Music',
    'amper': 'Audio & Music',
    'loudly': 'Audio & Music',
    'mubert': 'Audio & Music',
    'resemble ai': 'Audio & Music',
    'respeecher': 'Audio & Music',
    'voice.ai': 'Audio & Music',
    'voicemod': 'Audio & Music',
    'whisper': 'Audio & Music',
    'openai whisper': 'Audio & Music',
    'otter.ai': 'Audio & Music',
    'otter': 'Audio & Music',
    'fireflies': 'Audio & Music',
    'krisp': 'Audio & Music',
    'adobe podcast': 'Audio & Music',
    'podcast ai': 'Audio & Music',
    'riverside': 'Audio & Music',
    'descript': 'Audio & Music',
    'cleanvoice': 'Audio & Music',
    'podcastle': 'Audio & Music',

    // Writing & Content
    'jasper': 'Writing & Content',
    'jasper ai': 'Writing & Content',
    'copy.ai': 'Writing & Content',
    'copyai': 'Writing & Content',
    'writesonic': 'Writing & Content',
    'grammarly': 'Writing & Content',
    'quillbot': 'Writing & Content',
    'wordtune': 'Writing & Content',
    'rytr': 'Writing & Content',
    'notion ai': 'Writing & Content',
    'notion': 'Writing & Content',
    'writer': 'Writing & Content',
    'writer.com': 'Writing & Content',
    'sudowrite': 'Writing & Content',
    'hyperwrite': 'Writing & Content',
    'anyword': 'Writing & Content',
    'shortly ai': 'Writing & Content',
    'peppertype': 'Writing & Content',
    'contentbot': 'Writing & Content',
    'frase': 'Writing & Content',
    'surfer': 'Writing & Content',
    'surfer seo': 'Writing & Content',
    'clearscope': 'Writing & Content',
    'marketmuse': 'Writing & Content',
    'hemingway': 'Writing & Content',
    'gingerit': 'Writing & Content',
    'prowritingaid': 'Writing & Content',
    'textcortex': 'Writing & Content',
    'simplified': 'Writing & Content',
    'scalenut': 'Writing & Content',
    'longshot ai': 'Writing & Content',
    'ink editor': 'Writing & Content',
    'wordai': 'Writing & Content',
    'article forge': 'Writing & Content',
    'typeface': 'Writing & Content',
    'tome': 'Writing & Content',
    'beautiful.ai': 'Writing & Content',
    'gamma': 'Writing & Content',
    'slidesai': 'Writing & Content',

    // Productivity
    'zapier': 'Productivity',
    'zapier ai': 'Productivity',
    'make': 'Productivity',
    'make.com': 'Productivity',
    'bardeen': 'Productivity',
    'browse ai': 'Productivity',
    'reclaim': 'Productivity',
    'reclaim ai': 'Productivity',
    'motion': 'Productivity',
    'clockwise': 'Productivity',
    'magical': 'Productivity',
    'mem': 'Productivity',
    'mem.ai': 'Productivity',
    'taskade': 'Productivity',
    'monday.com': 'Productivity',
    'asana': 'Productivity',
    'clickup': 'Productivity',
    'trello': 'Productivity',
    'airtable': 'Productivity',
    'coda': 'Productivity',
    'roam research': 'Productivity',
    'obsidian': 'Productivity',
    'tana': 'Productivity',
    'reflect': 'Productivity',
    'raycast': 'Productivity',
    'alfred': 'Productivity',
    'todoist': 'Productivity',
    'things': 'Productivity',
    'ifttt': 'Productivity',

    // Data & Analytics
    'tableau': 'Data & Analytics',
    'power bi': 'Data & Analytics',
    'looker': 'Data & Analytics',
    'metabase': 'Data & Analytics',
    'sisense': 'Data & Analytics',
    'datarobot': 'Data & Analytics',
    'databricks': 'Data & Analytics',
    'snowflake': 'Data & Analytics',
    'mixpanel': 'Data & Analytics',
    'amplitude': 'Data & Analytics',
    'obviously ai': 'Data & Analytics',
    'julius': 'Data & Analytics',
    'julius ai': 'Data & Analytics',
    'akkio': 'Data & Analytics',
    'polymer': 'Data & Analytics',
    'mindsdb': 'Data & Analytics',
    'h2o': 'Data & Analytics',
    'h2o.ai': 'Data & Analytics',
    'rapidminer': 'Data & Analytics',
    'knime': 'Data & Analytics',
    'alteryx': 'Data & Analytics',

    // Marketing & Sales
    'hubspot': 'Marketing & Sales',
    'salesforce': 'Marketing & Sales',
    'mailchimp': 'Marketing & Sales',
    'hootsuite': 'Marketing & Sales',
    'semrush': 'Marketing & Sales',
    'ahrefs': 'Marketing & Sales',
    'moz': 'Marketing & Sales',
    'buffer': 'Marketing & Sales',
    'later': 'Marketing & Sales',
    'sprout social': 'Marketing & Sales',
    'lavender': 'Marketing & Sales',
    'apollo': 'Marketing & Sales',
    'apollo.io': 'Marketing & Sales',
    'outreach': 'Marketing & Sales',
    'gong': 'Marketing & Sales',
    'chorus': 'Marketing & Sales',
    'drift': 'Marketing & Sales',
    'intercom': 'Marketing & Sales',
    'saleswhale': 'Marketing & Sales',
    'conversica': 'Marketing & Sales',
    'exceed.ai': 'Marketing & Sales',
    'regie.ai': 'Marketing & Sales',
    'warmer.ai': 'Marketing & Sales',
    'smartwriter': 'Marketing & Sales',
    'instantly': 'Marketing & Sales',
    'lemlist': 'Marketing & Sales',
    'reply.io': 'Marketing & Sales',

    // AI Agents
    'autogpt': 'AI Agents',
    'auto-gpt': 'AI Agents',
    'babyagi': 'AI Agents',
    'agentgpt': 'AI Agents',
    'superagi': 'AI Agents',
    'langchain': 'AI Agents',
    'llamaindex': 'AI Agents',
    'crewai': 'AI Agents',
    'autogen': 'AI Agents',
    'devin': 'AI Agents',
    'cognition': 'AI Agents',
    'multi-on': 'AI Agents',
    'multion': 'AI Agents',
    'adept': 'AI Agents',
    'act-1': 'AI Agents',
    'rabbit r1': 'AI Agents',
    'humane pin': 'AI Agents',
    'open interpreter': 'AI Agents',
    'smol developer': 'AI Agents',
    'gpt-engineer': 'AI Agents',
    'mentat': 'AI Agents',
    'sweep': 'AI Agents',
    'factory ai': 'AI Agents',
    'cognition labs': 'AI Agents',

    // Customer Service
    'zendesk': 'Customer Service',
    'zendesk ai': 'Customer Service',
    'freshdesk': 'Customer Service',
    'helpscout': 'Customer Service',
    'tidio': 'Customer Service',
    'intercom': 'Customer Service',
    'ada': 'Customer Service',
    'ada support': 'Customer Service',
    'kustomer': 'Customer Service',
    'gladly': 'Customer Service',
    'forethought': 'Customer Service',
    'ultimate': 'Customer Service',
    'verloop': 'Customer Service',
    'haptik': 'Customer Service',
    'yellow.ai': 'Customer Service',

    // Learning & Education
    'duolingo': 'Learning & Education',
    'quizlet': 'Learning & Education',
    'coursera': 'Learning & Education',
    'khan academy': 'Learning & Education',
    'udemy': 'Learning & Education',
    'edx': 'Learning & Education',
    'brilliant': 'Learning & Education',
    'socratic': 'Learning & Education',
    'photomath': 'Learning & Education',
    'mathway': 'Learning & Education',
    'wolfram alpha': 'Learning & Education',
    'kahoot': 'Learning & Education',
    'quizizz': 'Learning & Education',
    'formative': 'Learning & Education',
    'gradescope': 'Learning & Education',
    'turnitin': 'Learning & Education',
    'cramly': 'Learning & Education',
    'elicit': 'Learning & Education',
    'consensus': 'Learning & Education',
    'scispace': 'Learning & Education',
    'scholarcy': 'Learning & Education',
    'explainpaper': 'Learning & Education',

    // Translation
    'deepl': 'Translation & Language',
    'google translate': 'Translation & Language',
    'reverso': 'Translation & Language',
    'linguee': 'Translation & Language',
    'papago': 'Translation & Language',
    'yandex translate': 'Translation & Language',
    'amazon translate': 'Translation & Language',
    'microsoft translator': 'Translation & Language',

    // Research & Open Source
    'hugging face': 'Research & Open Source',
    'huggingface': 'Research & Open Source',
    'arxiv': 'Research & Open Source',
    'papers with code': 'Research & Open Source',
    'semantic scholar': 'Research & Open Source',
    'connected papers': 'Research & Open Source',
    'research rabbit': 'Research & Open Source',
};

// ============================================================================
// CATEGORY PATTERNS (backup for non-override tools)
// ============================================================================

const CATEGORY_PATTERNS = {
    'ChatBots': {
        name: [/chat\s?gpt/i, /llm/i, /chat\s?bot/i, /assistant/i, /gemini/i],
        desc: [/conversational/i, /chat\s?interface/i, /talk\s?to/i, /ask\s?question/i]
    },
    'Code & Development': {
        name: [/code/i, /coding/i, /developer/i, /ide/i, /programming/i],
        desc: [/code\s?(complet|generat|assist)/i, /programming/i, /software\s?develop/i]
    },
    'Image Generation': {
        name: [/image/i, /art/i, /photo/i, /picture/i, /diffusion/i],
        desc: [/image\s?generat/i, /text[\s-]?to[\s-]?image/i, /create\s?(image|art)/i]
    },
    'Video Generation': {
        name: [/video/i, /film/i, /movie/i, /animation/i],
        desc: [/video\s?generat/i, /text[\s-]?to[\s-]?video/i, /avatar\s?video/i]
    },
    'Audio & Music': {
        name: [/audio/i, /voice/i, /music/i, /sound/i, /speech/i, /podcast/i],
        desc: [/text[\s-]?to[\s-]?speech/i, /voice\s?(clone|synth)/i, /music\s?generat/i]
    },
    'Writing & Content': {
        name: [/writ/i, /content/i, /copy/i, /blog/i, /article/i],
        desc: [/content\s?(creat|generat)/i, /copywriting/i, /writ(e|ing)/i]
    },
    'Productivity': {
        name: [/productiv/i, /automat/i, /workflow/i, /task/i],
        desc: [/automat(e|ion)/i, /workflow/i, /productiv/i]
    },
    'Data & Analytics': {
        name: [/data/i, /analy/i, /bi\b/i, /dashboard/i],
        desc: [/data\s?analy/i, /business\s?intellig/i, /predict/i]
    },
    'Marketing & Sales': {
        name: [/market/i, /sales/i, /seo/i, /email/i, /lead/i],
        desc: [/market(ing)?/i, /sales\s?(assist|intellig)/i, /seo/i]
    },
    'AI Agents': {
        name: [/agent/i, /autonom/i, /langchain/i, /crewai/i],
        desc: [/ai\s?agent/i, /autonom(ous|y)/i, /agent\s?framework/i]
    },
    'Learning & Education': {
        name: [/learn/i, /educat/i, /teach/i, /study/i, /tutor/i],
        desc: [/learn(ing)?/i, /educat(ion)?/i, /tutor/i]
    },
    'Customer Service': {
        name: [/support/i, /helpdesk/i, /customer/i, /service/i],
        desc: [/customer\s?(service|support)/i, /helpdesk/i, /support\s?ticket/i]
    },
};

// ============================================================================
// MAIN LOGIC
// ============================================================================

function categorize(tool) {
    const nameLower = (tool.name || '').toLowerCase().trim();
    const descLower = (tool.description || '').toLowerCase();

    // 1. Check manual overrides first (highest priority)
    if (MANUAL_OVERRIDES[nameLower]) {
        return {
            category: MANUAL_OVERRIDES[nameLower],
            method: 'override',
            changed: tool.category !== MANUAL_OVERRIDES[nameLower]
        };
    }

    // 2. Check for partial name matches in overrides
    for (const [key, category] of Object.entries(MANUAL_OVERRIDES)) {
        if (nameLower.includes(key) || key.includes(nameLower)) {
            return {
                category,
                method: 'partial-override',
                changed: tool.category !== category
            };
        }
    }

    // 3. Pattern matching
    let bestCategory = null;
    let bestScore = 0;

    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
        let score = 0;

        // Name patterns (high weight)
        for (const pattern of (patterns.name || [])) {
            if (pattern.test(tool.name)) {
                score += 50;
            }
        }

        // Description patterns
        for (const pattern of (patterns.desc || [])) {
            if (pattern.test(descLower)) {
                score += 25;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestCategory = category;
        }
    }

    if (bestCategory && bestScore >= 50) {
        return {
            category: bestCategory,
            method: 'pattern',
            changed: tool.category !== bestCategory
        };
    }

    // 4. Keep existing category if no match
    return {
        category: tool.category,
        method: 'unchanged',
        changed: false
    };
}

async function recategorize() {
    console.log('🔍 Enhanced Recategorization v2\n');
    console.log('📋 Manual overrides:', Object.keys(MANUAL_OVERRIDES).length, 'tools');

    // Fetch all tools
    let allTools = [];
    let offset = 0;
    const batchSize = 1000;

    console.log('\n📥 Fetching all tools...');

    while (true) {
        const { data, error } = await supabase
            .from('ai_tools')
            .select('id, name, description, category')
            .range(offset, offset + batchSize - 1);

        if (error || !data || data.length === 0) break;
        allTools = [...allTools, ...data];
        offset += batchSize;
        if (data.length < batchSize) break;
    }

    console.log(`   Found ${allTools.length} tools\n`);

    // Categorize
    const changes = [];
    const stats = { override: 0, 'partial-override': 0, pattern: 0, unchanged: 0 };
    const categoryCount = {};

    for (const tool of allTools) {
        const result = categorize(tool);
        stats[result.method]++;
        categoryCount[result.category] = (categoryCount[result.category] || 0) + 1;

        if (result.changed) {
            changes.push({
                id: tool.id,
                name: tool.name,
                oldCategory: tool.category,
                newCategory: result.category,
                method: result.method
            });
        }
    }

    // Show stats
    console.log('📊 Categorization Methods:');
    console.log(`   Override: ${stats.override}`);
    console.log(`   Partial Override: ${stats['partial-override']}`);
    console.log(`   Pattern Match: ${stats.pattern}`);
    console.log(`   Unchanged: ${stats.unchanged}`);

    console.log('\n📊 Category Distribution:');
    const sorted = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of sorted) {
        const pct = ((count / allTools.length) * 100).toFixed(1);
        console.log(`   ${count.toString().padStart(5)} (${pct.padStart(5)}%) - ${cat}`);
    }

    console.log(`\n🔄 Changes to apply: ${changes.length}\n`);

    // Sample changes
    if (changes.length > 0) {
        console.log('📋 Sample Changes (first 50):');
        for (const c of changes.slice(0, 50)) {
            console.log(`   ${c.name}`);
            console.log(`      ${c.oldCategory} → ${c.newCategory} (${c.method})`);
        }
    }

    // Apply changes
    if (changes.length > 0) {
        console.log('\n💾 Applying changes...\n');

        let updated = 0;
        let errors = 0;

        for (let i = 0; i < changes.length; i += 50) {
            const batch = changes.slice(i, i + 50);

            for (const change of batch) {
                const { error } = await supabase
                    .from('ai_tools')
                    .update({ category: change.newCategory })
                    .eq('id', change.id);

                if (error) errors++;
                else updated++;
            }

            if ((i + 50) % 500 === 0 || i + 50 >= changes.length) {
                console.log(`   Updated ${Math.min(i + 50, changes.length)}/${changes.length}...`);
            }
        }

        console.log(`\n✅ Complete! Updated: ${updated}, Errors: ${errors}`);
    } else {
        console.log('✅ No changes needed!');
    }
}

recategorize().catch(console.error);
