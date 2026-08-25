/**
 * Comprehensive AI Tool Recategorization Script
 * 
 * Goes through ALL tools and assigns them to proper categories based on:
 * - Name matching
 * - Description analysis
 * - Platform/URL analysis
 * - Tag matching
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

const CATEGORIES = {
    'ChatBots': {
        priority: 95,
        namePatterns: [
            /chatgpt/i, /claude/i, /gemini/i, /bard/i, /copilot/i, /perplexity/i,
            /character\.ai/i, /pi\b/i, /poe\b/i, /huggingchat/i, /you\.com/i,
            /phind/i, /kagi/i, /chat\s?bot/i, /conversational/i, /assistant/i,
            /bing\s?chat/i, /llm\s?chat/i, /ai\s?chat/i
        ],
        descPatterns: [
            /chat\s?(bot|interface|assistant)/i, /conversational\s?ai/i,
            /talk\s?to\s?ai/i, /ai\s?conversation/i, /language\s?model\s?chat/i,
            /ask\s?questions/i, /chat\s?with/i
        ],
        excludePatterns: [/customer\s?service/i, /support\s?bot/i, /helpdesk/i]
    },

    'Image Generation': {
        priority: 90,
        namePatterns: [
            /midjourney/i, /dall-?e/i, /stable\s?diffusion/i, /firefly/i,
            /leonardo/i, /ideogram/i, /playground/i, /nightcafe/i, /artbreeder/i,
            /craiyon/i, /deep\s?dream/i, /imagen/i, /canva/i, /photoshop\s?ai/i,
            /flux/i, /getimg/i, /dreamstudio/i
        ],
        descPatterns: [
            /image\s?generat/i, /text[\s-]?to[\s-]?image/i, /ai[\s-]?art/i,
            /generate\s?(image|art|picture|photo)/i, /create\s?(image|art|picture)/i,
            /diffusion\s?model/i, /art\s?generat/i, /ai[\s-]?image/i
        ],
        excludePatterns: [/image\s?edit/i, /photo\s?edit/i, /enhance/i]
    },

    'Video Generation': {
        priority: 90,
        namePatterns: [
            /sora/i, /runway/i, /pika/i, /kling/i, /luma/i, /synthesia/i,
            /descript/i, /pictory/i, /invideo/i, /lumen5/i, /steve\.ai/i,
            /heygen/i, /d-id/i, /colossyan/i, /fliki/i, /vidnoz/i
        ],
        descPatterns: [
            /video\s?generat/i, /text[\s-]?to[\s-]?video/i, /ai[\s-]?video/i,
            /create\s?video/i, /generate\s?video/i, /video\s?creat/i,
            /avatar\s?video/i, /ai[\s-]?avatar/i
        ],
        excludePatterns: [/video\s?edit/i, /video\s?enhance/i]
    },

    'Audio & Music': {
        priority: 90,
        namePatterns: [
            /elevenlabs/i, /murf/i, /play\.ht/i, /suno/i, /udio/i, /aiva/i,
            /soundraw/i, /resemble/i, /descript/i, /whisper/i, /speechify/i,
            /voice\.ai/i, /voicemod/i, /mubert/i, /boomy/i, /amper/i, /loudly/i
        ],
        descPatterns: [
            /text[\s-]?to[\s-]?speech/i, /voice\s?(clone|synth|generat)/i,
            /ai[\s-]?(voice|music|audio)/i, /speech[\s-]?to[\s-]?text/i,
            /music\s?generat/i, /audio\s?generat/i, /voice\s?over/i,
            /sound\s?generat/i, /podcast/i, /transcrib/i
        ],
        excludePatterns: []
    },

    'Writing & Content': {
        priority: 85,
        namePatterns: [
            /jasper/i, /copy\.ai/i, /writesonic/i, /grammarly/i, /quillbot/i,
            /wordtune/i, /rytr/i, /notion\s?ai/i, /writer\.com/i, /sudowrite/i,
            /hyperwrite/i, /shortly/i, /anyword/i, /contentbot/i
        ],
        descPatterns: [
            /content\s?(creat|generat|writ)/i, /copywriting/i, /ai[\s-]?writ/i,
            /blog\s?(post|writ)/i, /article\s?(writ|generat)/i, /text\s?generat/i,
            /grammar/i, /paraphras/i, /rewrite/i, /summariz/i, /content\s?market/i
        ],
        excludePatterns: [/code/i, /programming/i]
    },

    'Code & Development': {
        priority: 95,
        namePatterns: [
            /cursor/i, /copilot/i, /codeium/i, /tabnine/i, /replit/i,
            /windsurf/i, /cody/i, /codegen/i, /devin/i, /blackbox/i,
            /sourcery/i, /kite/i, /codewhisperer/i, /codestral/i, /starcoder/i,
            /code\s?llama/i, /codegpt/i, /vs\s?code/i, /pycharm/i, /jetbrains/i,
            /github/i, /gitlab/i
        ],
        descPatterns: [
            /code\s?(complet|generat|assist|suggest)/i, /ai[\s-]?cod/i,
            /programming\s?(assist|help)/i, /developer\s?tool/i, /ide/i,
            /code\s?review/i, /debug/i, /software\s?develop/i, /coding\s?assist/i
        ],
        excludePatterns: []
    },

    'Productivity': {
        priority: 80,
        namePatterns: [
            /notion/i, /zapier/i, /make\.com/i, /bardeen/i, /otter/i,
            /fireflies/i, /reclaim/i, /motion/i, /clockwise/i, /magical/i,
            /mem\.ai/i, /taskade/i, /roam/i, /obsidian/i
        ],
        descPatterns: [
            /productiv/i, /automat(e|ion)/i, /workflow/i, /task\s?manage/i,
            /meeting\s?(notes|summar|transcript)/i, /schedule/i, /calendar/i,
            /note[\s-]?tak/i, /organiz/i
        ],
        excludePatterns: []
    },

    'Marketing & Sales': {
        priority: 80,
        namePatterns: [
            /hubspot/i, /salesforce/i, /mailchimp/i, /hootsuite/i, /semrush/i,
            /surfer/i, /frase/i, /clearscope/i, /marketmuse/i, /lavender/i,
            /apollo/i, /outreach/i, /gong/i, /drift/i
        ],
        descPatterns: [
            /market(ing)?/i, /sales\s?(assist|automat|intellig)/i, /seo/i,
            /email\s?(market|campaign|automat)/i, /lead\s?(generat|scor)/i,
            /advertis/i, /social\s?media\s?market/i, /content\s?market/i
        ],
        excludePatterns: []
    },

    'Data & Analytics': {
        priority: 80,
        namePatterns: [
            /tableau/i, /power\s?bi/i, /looker/i, /metabase/i, /sisense/i,
            /datarobot/i, /databricks/i, /snowflake/i, /mixpanel/i, /amplitude/i
        ],
        descPatterns: [
            /data\s?(analy|visual|process|science)/i, /business\s?intellig/i,
            /predict(ive)?\s?analy/i, /machine\s?learn/i, /dashb(oard)?/i,
            /report(ing)?/i, /insight/i, /metric/i
        ],
        excludePatterns: []
    },

    'Learning & Education': {
        priority: 75,
        namePatterns: [
            /duolingo/i, /quizlet/i, /coursera/i, /khan\s?academy/i, /udemy/i,
            /edx/i, /brilliant/i, /socratic/i, /photomath/i, /mathway/i
        ],
        descPatterns: [
            /learn(ing)?/i, /educat(ion|ional)?/i, /tutor/i, /study/i,
            /teach(ing)?/i, /course/i, /lesson/i, /quiz/i, /flashcard/i,
            /homework/i, /exam\s?prep/i
        ],
        excludePatterns: []
    },

    'Customer Service': {
        priority: 75,
        namePatterns: [
            /intercom/i, /zendesk/i, /freshdesk/i, /helpscout/i, /tidio/i,
            /drift/i, /ada/i, /kustomer/i, /gladly/i
        ],
        descPatterns: [
            /customer\s?(service|support)/i, /helpdesk/i, /support\s?ticket/i,
            /live\s?chat/i, /customer\s?care/i, /chatbot\s?(support|service)/i,
            /FAQ\s?bot/i
        ],
        excludePatterns: []
    },

    'AI Agents': {
        priority: 85,
        namePatterns: [
            /autogpt/i, /babyagi/i, /agentgpt/i, /superagi/i, /langchain/i,
            /crewai/i, /autogen/i, /devin/i, /agentic/i, /mcp/i
        ],
        descPatterns: [
            /ai\s?agent/i, /autonom(ous|y)/i, /agent\s?framework/i,
            /multi[\s-]?agent/i, /agent\s?orchestr/i, /self[\s-]?improv/i,
            /task\s?autonom/i
        ],
        excludePatterns: []
    },

    'Research & Open Source': {
        priority: 30, // Lower priority for research
        namePatterns: [
            /arxiv/i, /hugging\s?face/i, /github/i, /papers\s?with\s?code/i,
        ],
        descPatterns: [
            /research\s?paper/i, /open[\s-]?source/i, /academic/i,
            /scientific\s?paper/i, /preprint/i
        ],
        platformPatterns: [
            /github\.com/i, /arxiv\.org/i, /huggingface\.co/i,
            /papers[\s-]?with[\s-]?code/i
        ],
        excludePatterns: []
    },

    'Translation & Language': {
        priority: 75,
        namePatterns: [
            /deepl/i, /google\s?translate/i, /reverso/i, /linguee/i,
        ],
        descPatterns: [
            /translat(e|ion)/i, /language\s?(pair|model)/i, /multilingua/i,
            /locali[sz]/i
        ],
        excludePatterns: []
    },

    'Healthcare': {
        priority: 75,
        namePatterns: [
            /ada\s?health/i, /babylon/i, /k\s?health/i, /buoy/i
        ],
        descPatterns: [
            /health(care)?/i, /medical/i, /diagnos/i, /doctor/i, /patient/i,
            /clinical/i, /pharma/i, /drug\s?discover/i
        ],
        excludePatterns: []
    },

    'Finance': {
        priority: 75,
        namePatterns: [
            /bloomberg/i, /refinitiv/i, /kensho/i, /alphasense/i
        ],
        descPatterns: [
            /financ(e|ial)/i, /invest(ment|ing)?/i, /trading/i, /stock/i,
            /crypto/i, /banking/i, /fintech/i, /accounting/i
        ],
        excludePatterns: []
    },

    'Gaming & Entertainment': {
        priority: 70,
        namePatterns: [
            /character\.ai/i, /replika/i, /chai/i
        ],
        descPatterns: [
            /gam(e|ing)/i, /entertainment/i, /roleplay/i, /interactive\s?fiction/i,
            /virtual\s?companion/i
        ],
        excludePatterns: [/game\s?development/i]
    },

    '3D & Spatial': {
        priority: 75,
        namePatterns: [
            /nvidia\s?omniverse/i, /luma/i, /meshcapade/i, /kaedim/i
        ],
        descPatterns: [
            /3d\s?(model|generat|render)/i, /spatial/i, /ar\s?\/\s?vr/i,
            /virtual\s?reality/i, /augmented\s?reality/i, /metaverse/i
        ],
        excludePatterns: []
    },

    'Computer Vision': {
        priority: 75,
        namePatterns: [
            /clarifai/i, /roboflow/i, /v7/i, /labelbox/i
        ],
        descPatterns: [
            /computer\s?vision/i, /object\s?detect/i, /image\s?recogn/i,
            /ocr/i, /facial\s?recog/i, /image\s?classif/i
        ],
        excludePatterns: [/image\s?generat/i]
    },

    'NLP & Text Analysis': {
        priority: 70,
        namePatterns: [
            /spacy/i, /nltk/i, /hugging\s?face/i
        ],
        descPatterns: [
            /natural\s?language/i, /nlp/i, /sentiment\s?analy/i,
            /text\s?(classif|extract|analy)/i, /named\s?entity/i,
            /topic\s?model/i
        ],
        excludePatterns: [/text[\s-]?to[\s-]/i]
    }
};

// ============================================================================
// CATEGORIZATION LOGIC
// ============================================================================

function categorize(tool) {
    const name = (tool.name || '').toLowerCase();
    const description = (tool.description || '').toLowerCase();
    const platform = (tool.platform || '').toLowerCase();
    const tags = (tool.tags || []).map(t => t.toLowerCase());

    let bestCategory = null;
    let bestScore = 0;

    for (const [category, rules] of Object.entries(CATEGORIES)) {
        let score = 0;
        let isExcluded = false;

        // Check exclusions first
        for (const pattern of (rules.excludePatterns || [])) {
            if (pattern.test(name) || pattern.test(description)) {
                isExcluded = true;
                break;
            }
        }

        if (isExcluded) continue;

        // Name patterns (highest weight)
        for (const pattern of (rules.namePatterns || [])) {
            if (pattern.test(tool.name)) {
                score += 100;
                break; // Only count once per category
            }
        }

        // Description patterns
        for (const pattern of (rules.descPatterns || [])) {
            if (pattern.test(description)) {
                score += 30;
                break;
            }
        }

        // Platform/URL patterns (for research detection)
        for (const pattern of (rules.platformPatterns || [])) {
            if (pattern.test(platform)) {
                score += 80;
                break;
            }
        }

        // Tag matching
        const categoryWords = category.toLowerCase().split(/[\s&]+/);
        for (const tag of tags) {
            for (const word of categoryWords) {
                if (tag.includes(word) || word.includes(tag)) {
                    score += 15;
                }
            }
        }

        // Add base priority
        score += rules.priority || 50;

        if (score > bestScore) {
            bestScore = score;
            bestCategory = category;
        }
    }

    // Fallback: keep as Generative AI if no strong match
    if (!bestCategory || bestScore < 100) {
        return { category: tool.category, score: 0, changed: false };
    }

    return {
        category: bestCategory,
        score: bestScore,
        changed: bestCategory !== tool.category
    };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function recategorizeAll() {
    console.log('🔍 Starting comprehensive recategorization...\n');

    // Fetch all tools
    let allTools = [];
    let offset = 0;
    const batchSize = 1000;

    console.log('📥 Fetching all tools...');

    while (true) {
        const { data, error } = await supabase
            .from('ai_tools')
            .select('id, name, description, category, platform, tags')
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error('Error fetching tools:', error);
            break;
        }

        if (!data || data.length === 0) break;

        allTools = [...allTools, ...data];
        offset += batchSize;

        if (data.length < batchSize) break;
    }

    console.log(`   Found ${allTools.length} tools\n`);

    // Categorize all tools
    const changes = [];
    const categoryCount = {};

    for (const tool of allTools) {
        const result = categorize(tool);

        categoryCount[result.category] = (categoryCount[result.category] || 0) + 1;

        if (result.changed) {
            changes.push({
                id: tool.id,
                name: tool.name,
                oldCategory: tool.category,
                newCategory: result.category,
                score: result.score
            });
        }
    }

    // Show category distribution
    console.log('📊 Category Distribution After Recategorization:\n');
    const sorted = Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1]);

    for (const [cat, count] of sorted) {
        const pct = ((count / allTools.length) * 100).toFixed(1);
        console.log(`   ${count.toString().padStart(5)} (${pct.padStart(5)}%) - ${cat}`);
    }

    console.log(`\n🔄 Changes to apply: ${changes.length}\n`);

    // Show sample changes
    if (changes.length > 0) {
        console.log('📋 Sample Changes (first 30):');
        for (const change of changes.slice(0, 30)) {
            console.log(`   ${change.name}`);
            console.log(`      ${change.oldCategory} → ${change.newCategory} (score: ${change.score})`);
        }
        console.log('');
    }

    // Apply changes
    if (changes.length > 0) {
        console.log('💾 Applying changes...\n');

        let updated = 0;
        let errors = 0;

        for (let i = 0; i < changes.length; i += 50) {
            const batch = changes.slice(i, i + 50);

            for (const change of batch) {
                const { error } = await supabase
                    .from('ai_tools')
                    .update({ category: change.newCategory })
                    .eq('id', change.id);

                if (error) {
                    errors++;
                } else {
                    updated++;
                }
            }

            if ((i + 50) % 500 === 0 || i + 50 >= changes.length) {
                console.log(`   Updated ${Math.min(i + 50, changes.length)}/${changes.length}...`);
            }
        }

        console.log(`\n✅ Recategorization complete!`);
        console.log(`   Updated: ${updated}`);
        console.log(`   Errors: ${errors}`);
    } else {
        console.log('✅ No changes needed - all tools are properly categorized!');
    }
}

recategorizeAll().catch(console.error);
