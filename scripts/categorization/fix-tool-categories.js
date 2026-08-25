/**
 * Fix miscategorized IDE and Code tools
 * Moves popular IDE tools to correct categories
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Tools that should be in "Code & Development"
const codeDevTools = [
    { name: 'Cursor', newCategory: 'Code & Development' },
    { name: 'Windsurf', newCategory: 'Code & Development' },
    { name: 'Github Copilot', newCategory: 'Code & Development' },
    { name: 'GitHub Copilot', newCategory: 'Code & Development' },
    { name: 'TabNine', newCategory: 'Code & Development' },
    { name: 'Replit', newCategory: 'Code & Development' },
    { name: 'autodev-vscode', newCategory: 'Code & Development' },
    { name: 'Codeium', newCategory: 'Code & Development' },
    { name: 'Continue', newCategory: 'Code & Development' },
    { name: 'Sourcegraph', newCategory: 'Code & Development' },
    { name: 'Amazon CodeWhisperer', newCategory: 'Code & Development' },
    { name: 'CodeWhisperer', newCategory: 'Code & Development' },
    { name: 'Aider', newCategory: 'Code & Development' },
    { name: 'Cody', newCategory: 'Code & Development' },
    { name: 'Blackbox AI', newCategory: 'Code & Development' },
    { name: 'Devin', newCategory: 'AI Agents' },
];

// Tools that should be in "ChatBots" (LLM chat interfaces)
const chatbotTools = [
    { name: 'ChatGPT', newCategory: 'ChatBots' },
    { name: 'Claude', newCategory: 'ChatBots' },
    { name: 'Gemini', newCategory: 'ChatBots' },
    { name: 'Google Bard', newCategory: 'ChatBots' },
    { name: 'Bing Chat', newCategory: 'ChatBots' },
    { name: 'Microsoft Copilot', newCategory: 'ChatBots' },
    { name: 'Perplexity', newCategory: 'ChatBots' },
    { name: 'Pi', newCategory: 'ChatBots' },
    { name: 'Poe', newCategory: 'ChatBots' },
    { name: 'HuggingChat', newCategory: 'ChatBots' },
    { name: 'Character.AI', newCategory: 'ChatBots' },
    { name: 'You.com', newCategory: 'ChatBots' },
    { name: 'Phind', newCategory: 'ChatBots' },
];

// Tools that should be in "Image Generation"
const imageTools = [
    { name: 'Midjourney', newCategory: 'Image Generation' },
    { name: 'DALL-E', newCategory: 'Image Generation' },
    { name: 'Stable Diffusion', newCategory: 'Image Generation' },
    { name: 'Adobe Firefly', newCategory: 'Image Generation' },
    { name: 'Leonardo AI', newCategory: 'Image Generation' },
    { name: 'Canva AI', newCategory: 'Image Generation' },
    { name: 'Ideogram', newCategory: 'Image Generation' },
    { name: 'Flux', newCategory: 'Image Generation' },
];

// Tools that should be in "Audio & Music"
const audioTools = [
    { name: 'ElevenLabs', newCategory: 'Audio & Music' },
    { name: 'Murf', newCategory: 'Audio & Music' },
    { name: 'Murf AI', newCategory: 'Audio & Music' },
    { name: 'Play.ht', newCategory: 'Audio & Music' },
    { name: 'Suno', newCategory: 'Audio & Music' },
    { name: 'Udio', newCategory: 'Audio & Music' },
    { name: 'AIVA', newCategory: 'Audio & Music' },
    { name: 'Soundraw', newCategory: 'Audio & Music' },
    { name: 'Resemble AI', newCategory: 'Audio & Music' },
];

// Tools that should be in "Video Generation"
const videoTools = [
    { name: 'Sora', newCategory: 'Video Generation' },
    { name: 'Runway', newCategory: 'Video Generation' },
    { name: 'Runway ML', newCategory: 'Video Generation' },
    { name: 'Pika', newCategory: 'Video Generation' },
    { name: 'Kling', newCategory: 'Video Generation' },
    { name: 'Luma AI', newCategory: 'Video Generation' },
    { name: 'Synthesia', newCategory: 'Video Generation' },
    { name: 'Descript', newCategory: 'Video Generation' },
    { name: 'Pictory', newCategory: 'Video Generation' },
    { name: 'InVideo', newCategory: 'Video Generation' },
];

const allTools = [
    ...codeDevTools,
    ...chatbotTools,
    ...imageTools,
    ...audioTools,
    ...videoTools,
];

async function fixCategories() {
    console.log('🔧 Fixing miscategorized tools...\n');

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (const tool of allTools) {
        try {
            // Find the tool
            const { data: existing, error: findError } = await supabase
                .from('ai_tools')
                .select('id, name, category')
                .ilike('name', tool.name)
                .limit(1)
                .single();

            if (findError || !existing) {
                console.log(`  ⚠️  Not found: ${tool.name}`);
                notFound++;
                continue;
            }

            // Check if already correct
            if (existing.category === tool.newCategory) {
                console.log(`  ✅ Already correct: ${tool.name} (${existing.category})`);
                continue;
            }

            // Update the category
            const { error: updateError } = await supabase
                .from('ai_tools')
                .update({ category: tool.newCategory })
                .eq('id', existing.id);

            if (updateError) {
                console.log(`  ❌ Error updating ${tool.name}: ${updateError.message}`);
                errors++;
                continue;
            }

            console.log(`  ✅ Updated: ${tool.name} (${existing.category} → ${tool.newCategory})`);
            updated++;

        } catch (err) {
            console.log(`  ❌ Error processing ${tool.name}: ${err.message}`);
            errors++;
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Not found: ${notFound}`);
    console.log(`   Errors: ${errors}`);
}

fixCategories().catch(console.error);
