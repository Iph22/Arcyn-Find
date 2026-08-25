require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getCategories() {
    let all = [];
    let page = 0;

    while (true) {
        const { data } = await supabase
            .from('ai_tools')
            .select('category, name')
            .range(page * 1000, (page + 1) * 1000 - 1);

        if (!data || data.length === 0) break;
        all.push(...data);
        page++;
    }

    const cats = {};
    all.forEach(t => {
        cats[t.category] = (cats[t.category] || 0) + 1;
    });

    console.log('\n📊 CATEGORY BREAKDOWN (Total: ' + all.length + ' tools)\n');
    console.log('='.repeat(50));

    Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([k, v]) => {
            const pct = ((v / all.length) * 100).toFixed(1);
            console.log(`${v.toString().padStart(5)} (${pct.padStart(5)}%) - ${k}`);
        });

    // Check for popular tools
    console.log('\n\n🔍 CHECKING FOR POPULAR TOOLS...\n');
    console.log('='.repeat(50));

    const popularTools = [
        'ChatGPT', 'Claude', 'Gemini', 'GPT-4', 'Midjourney', 'DALL-E', 'Stable Diffusion',
        'Notion AI', 'Grammarly', 'Jasper', 'Copy.ai', 'Writesonic',
        'Canva AI', 'Adobe Firefly', 'Leonardo AI', 'Runway ML',
        'GitHub Copilot', 'Cursor', 'Replit', 'Tabnine',
        'Otter.ai', 'Descript', 'Synthesia', 'Murf AI',
        'Tome', 'Beautiful.ai', 'Gamma', 'SlidesAI',
        'Perplexity', 'You.com', 'Phind', 'Kagi',
        'Pika', 'Sora', 'Kling', 'Luma AI',
        'ElevenLabs', 'Murf', 'Play.ht', 'Resemble AI',
        'Zapier AI', 'Make', 'Bardeen', 'Browse AI',
        'Bing Chat', 'Microsoft Copilot', 'Google Bard',
        'Character.AI', 'Pi', 'Poe', 'HuggingChat',
        'Suno', 'Udio', 'AIVA', 'Soundraw',
        'Pictory', 'InVideo', 'Lumen5', 'Steve.AI'
    ];

    const toolNames = all.map(t => t.name.toLowerCase());

    const found = [];
    const missing = [];

    popularTools.forEach(tool => {
        const exists = toolNames.some(name =>
            name.includes(tool.toLowerCase()) ||
            tool.toLowerCase().includes(name)
        );
        if (exists) {
            found.push(tool);
        } else {
            missing.push(tool);
        }
    });

    console.log(`\n✅ Found (${found.length}/${popularTools.length}):`);
    found.forEach(t => console.log(`   ✓ ${t}`));

    console.log(`\n❌ Missing (${missing.length}/${popularTools.length}):`);
    missing.forEach(t => console.log(`   ✗ ${t}`));

    console.log('\n\n📈 RECOMMENDATIONS:');
    console.log('='.repeat(50));
    console.log('1. Add more consumer-focused AI tool directories');
    console.log('2. Reduce research paper sources (ArXiv, Papers with Code)');
    console.log('3. Add Product Hunt AI tools');
    console.log('4. Add specific tool lists from major categories');
}

getCategories();
