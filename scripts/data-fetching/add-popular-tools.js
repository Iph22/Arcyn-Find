/**
 * Add missing popular AI tools
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const missingTools = [
    {
        id: 'kling-ai',
        name: 'Kling AI',
        category: 'Video & Audio',
        description: 'Kling is an AI video generation model developed by Kuaishou. It can generate up to 2-minute videos at 1080p resolution with realistic motion and physics.',
        platform: 'https://klingai.com',
        region: 'Global',
        access_type: 'Freemium',
        pricing: 'Free tier available, paid plans for higher quality',
        tags: ['video-generation', 'ai-video', 'text-to-video', 'kuaishou'],
        popularity: 85,
        is_trending: true,
        image: 'https://klingai.com/favicon.ico'
    },
    {
        id: 'play-ht',
        name: 'Play.ht',
        category: 'Voice & Speech',
        description: 'Play.ht is an AI voice generator and text-to-speech platform with ultra-realistic voices. Create voiceovers for videos, podcasts, and more.',
        platform: 'https://play.ht',
        region: 'Global',
        access_type: 'Freemium',
        pricing: 'Free tier, Pro from $31/mo',
        tags: ['text-to-speech', 'voice-synthesis', 'ai-voice', 'voiceover'],
        popularity: 82,
        is_trending: false,
        image: 'https://play.ht/favicon.ico'
    },
    {
        id: 'google-bard',
        name: 'Google Bard',
        category: 'ChatBots',
        description: 'Google Bard was Google\'s conversational AI service powered by LaMDA and later PaLM 2. Now rebranded as Gemini.',
        platform: 'https://bard.google.com',
        region: 'Global',
        access_type: 'Free',
        pricing: 'Free (now Gemini)',
        tags: ['chatbot', 'google', 'conversational-ai', 'lamda'],
        popularity: 90,
        is_trending: false,
        image: 'https://www.gstatic.com/lamda/images/favicon_v1_150160cddff7f294ce30.svg'
    },
    {
        id: 'soundraw',
        name: 'Soundraw',
        category: 'Video & Audio',
        description: 'Soundraw is an AI music generator that creates royalty-free music for your videos, games, and content. Customize mood, genre, and length.',
        platform: 'https://soundraw.io',
        region: 'Global',
        access_type: 'Freemium',
        pricing: 'Free trial, Creator from $16.99/mo',
        tags: ['music-generation', 'royalty-free', 'ai-music', 'soundtrack'],
        popularity: 78,
        is_trending: false,
        image: 'https://soundraw.io/favicon.ico'
    }
];

async function addMissingTools() {
    console.log('Adding missing popular tools...\n');

    for (const tool of missingTools) {
        const { error } = await supabase
            .from('ai_tools')
            .upsert(tool, { onConflict: 'id' });

        if (error) {
            console.log(`❌ Failed to add ${tool.name}:`, error.message);
        } else {
            console.log(`✅ Added ${tool.name}`);
        }
    }

    console.log('\n✅ Done!');
}

addMissingTools();
