/**
 * Import curated popular AI tools into database
 * These are consumer-facing tools people actually use
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Import the curated tools list
const CURATED_TOOLS = [
    // === WRITING & CONTENT ===
    { name: 'Rytr', category: 'Writing & Content', description: 'AI writing assistant that helps create high-quality content in seconds. Generate blog posts, emails, ads, and more.', platform: 'https://rytr.me', access_type: 'Freemium', pricing: 'Free tier, Premium $9/mo', tags: ['writing', 'content', 'copywriting'], popularity: 82 },
    { name: 'Wordtune', category: 'Writing & Content', description: 'AI-powered writing companion that rewrites, rephrases, and enhances your writing in real-time.', platform: 'https://wordtune.com', access_type: 'Freemium', pricing: 'Free tier, Premium $9.99/mo', tags: ['writing', 'rewriting', 'paraphrasing'], popularity: 80 },
    { name: 'QuillBot', category: 'Writing & Content', description: 'AI paraphrasing tool that rewrites and enhances sentences, paragraphs, or articles.', platform: 'https://quillbot.com', access_type: 'Freemium', pricing: 'Free tier, Premium $9.95/mo', tags: ['paraphrasing', 'writing', 'grammar'], popularity: 85 },
    { name: 'Sudowrite', category: 'Writing & Content', description: 'AI writing partner for fiction authors. Helps with brainstorming, writing, and editing stories.', platform: 'https://sudowrite.com', access_type: 'Paid', pricing: 'From $10/mo', tags: ['fiction', 'creative-writing', 'storytelling'], popularity: 75 },
    { name: 'Anyword', category: 'Writing & Content', description: 'AI copywriting platform that generates and optimizes marketing copy with predictive performance scores.', platform: 'https://anyword.com', access_type: 'Freemium', pricing: 'Free tier, Starter $39/mo', tags: ['marketing', 'copywriting', 'ads'], popularity: 78 },
    { name: 'Frase', category: 'Writing & Content', description: 'AI content optimization tool for SEO. Research, write, and optimize content in one place.', platform: 'https://frase.io', access_type: 'Paid', pricing: 'From $14.99/mo', tags: ['seo', 'content', 'research'], popularity: 76 },
    { name: 'Surfer SEO', category: 'Writing & Content', description: 'AI-powered SEO tool that helps optimize content for search engines with real-time suggestions.', platform: 'https://surferseo.com', access_type: 'Paid', pricing: 'From $69/mo', tags: ['seo', 'content-optimization', 'keywords'], popularity: 82 },

    // === IMAGE GENERATION ===
    { name: 'NightCafe', category: 'Image Generation', description: 'AI art generator using multiple algorithms including Stable Diffusion, DALL-E 2, and more.', platform: 'https://nightcafe.studio', access_type: 'Freemium', pricing: 'Free credits, paid plans available', tags: ['art', 'image-generation', 'creative'], popularity: 80 },
    { name: 'Artbreeder', category: 'Image Generation', description: 'AI tool for creating and remixing images using gene-based creativity and collaboration.', platform: 'https://artbreeder.com', access_type: 'Freemium', pricing: 'Free tier, Starter $8.99/mo', tags: ['art', 'portraits', 'landscapes'], popularity: 78 },
    { name: 'Playground AI', category: 'Image Generation', description: 'Free AI image generator and editor with advanced features for creating stunning visuals.', platform: 'https://playground.ai', access_type: 'Freemium', pricing: 'Free tier, Pro $15/mo', tags: ['image-generation', 'editing', 'creative'], popularity: 82 },
    { name: 'Lexica', category: 'Image Generation', description: 'Stable Diffusion image search engine and generator. Find and create AI-generated images.', platform: 'https://lexica.art', access_type: 'Freemium', pricing: 'Free tier, Pro $10/mo', tags: ['stable-diffusion', 'search', 'generation'], popularity: 79 },
    { name: 'DreamStudio', category: 'Image Generation', description: 'Official Stable Diffusion interface by Stability AI. Create images with the latest models.', platform: 'https://dreamstudio.ai', access_type: 'Paid', pricing: 'Credit-based, from $10', tags: ['stable-diffusion', 'official', 'image'], popularity: 83 },
    { name: 'Craiyon', category: 'Image Generation', description: 'Formerly DALL-E Mini. Free AI image generator that creates images from text descriptions.', platform: 'https://craiyon.com', access_type: 'Free', pricing: 'Free with ads, Premium $5/mo', tags: ['free', 'image-generation', 'dall-e-mini'], popularity: 75 },
    { name: 'Ideogram', category: 'Image Generation', description: 'AI image generator that excels at text rendering in images. Create logos and designs with readable text.', platform: 'https://ideogram.ai', access_type: 'Freemium', pricing: 'Free tier, Plus $7/mo', tags: ['text-in-images', 'logos', 'design'], popularity: 85, is_trending: true },
    { name: 'Krea AI', category: 'Image Generation', description: 'AI-powered creative tool for generating and enhancing images in real-time.', platform: 'https://krea.ai', access_type: 'Freemium', pricing: 'Free tier, Pro $24/mo', tags: ['real-time', 'creative', 'design'], popularity: 80 },

    // === VIDEO & AUDIO ===
    { name: 'Kapwing', category: 'Video & Audio', description: 'AI-powered video editor with auto-subtitles, translations, and smart editing features.', platform: 'https://kapwing.com', access_type: 'Freemium', pricing: 'Free tier, Pro $16/mo', tags: ['video-editing', 'subtitles', 'online'], popularity: 84 },
    { name: 'Fliki', category: 'Video & Audio', description: 'AI video generator that turns text into videos with lifelike voiceovers.', platform: 'https://fliki.ai', access_type: 'Freemium', pricing: 'Free tier, Standard $21/mo', tags: ['text-to-video', 'voiceover', 'content'], popularity: 79 },
    { name: 'Opus Clip', category: 'Video & Audio', description: 'AI tool that repurposes long videos into viral short clips for TikTok, Reels, and Shorts.', platform: 'https://opus.pro', access_type: 'Freemium', pricing: 'Free tier, Pro $15/mo', tags: ['video-clips', 'repurposing', 'social-media'], popularity: 86, is_trending: true },
    { name: 'D-ID', category: 'Video & Audio', description: 'AI tool for creating talking avatar videos from photos. Turn images into speaking characters.', platform: 'https://d-id.com', access_type: 'Freemium', pricing: 'Free trial, Lite $4.70/mo', tags: ['avatar', 'talking-photo', 'video'], popularity: 81 },
    { name: 'Veed.io', category: 'Video & Audio', description: 'Online video editor with AI features like auto-subtitles, translations, and eye contact correction.', platform: 'https://veed.io', access_type: 'Freemium', pricing: 'Free tier, Basic $12/mo', tags: ['video-editing', 'subtitles', 'online'], popularity: 83 },
    { name: 'Captions', category: 'Video & Audio', description: 'AI-powered video editing app that adds captions, eye contact correction, and visual effects.', platform: 'https://captions.ai', access_type: 'Freemium', pricing: 'Free tier, Pro $10/mo', tags: ['captions', 'social-media', 'mobile'], popularity: 80 },

    // === VOICE & SPEECH ===
    { name: 'Podcastle', category: 'Voice & Speech', description: 'AI podcast creation platform with recording, editing, and voice enhancement tools.', platform: 'https://podcastle.ai', access_type: 'Freemium', pricing: 'Free tier, Storyteller $11.99/mo', tags: ['podcast', 'recording', 'editing'], popularity: 77 },
    { name: 'Adobe Podcast', category: 'Voice & Speech', description: 'AI-powered audio recording and editing tool with speech enhancement features.', platform: 'https://podcast.adobe.com', access_type: 'Free', pricing: 'Free (beta)', tags: ['podcast', 'speech-enhancement', 'adobe'], popularity: 79 },
    { name: 'Krisp', category: 'Voice & Speech', description: 'AI noise cancellation app that removes background noise from calls and recordings.', platform: 'https://krisp.ai', access_type: 'Freemium', pricing: 'Free tier, Pro $8/mo', tags: ['noise-cancellation', 'audio', 'calls'], popularity: 82 },
    { name: 'Speechify', category: 'Voice & Speech', description: 'AI text-to-speech app that reads text aloud with natural-sounding voices.', platform: 'https://speechify.com', access_type: 'Freemium', pricing: 'Free tier, Premium $139/yr', tags: ['text-to-speech', 'reading', 'accessibility'], popularity: 83 },
    { name: 'Voicemod', category: 'Voice & Speech', description: 'AI voice changer and soundboard for gaming, streaming, and calls.', platform: 'https://voicemod.net', access_type: 'Freemium', pricing: 'Free tier, Pro $25/yr', tags: ['voice-changer', 'gaming', 'streaming'], popularity: 81 },

    // === PRODUCTIVITY ===
    { name: 'Mem', category: 'Productivity', description: 'AI-powered note-taking app that organizes itself. Smart search and related notes.', platform: 'https://mem.ai', access_type: 'Freemium', pricing: 'Free tier, Mem X $8/mo', tags: ['notes', 'knowledge-management', 'search'], popularity: 76 },
    { name: 'Taskade', category: 'Productivity', description: 'AI-powered productivity tool for task management, notes, and team collaboration.', platform: 'https://taskade.com', access_type: 'Freemium', pricing: 'Free tier, Pro $5/mo', tags: ['tasks', 'collaboration', 'notes'], popularity: 77 },
    { name: 'Reclaim AI', category: 'Productivity', description: 'AI calendar assistant that automatically schedules tasks, habits, and meetings.', platform: 'https://reclaim.ai', access_type: 'Freemium', pricing: 'Free tier, Starter $8/mo', tags: ['calendar', 'scheduling', 'time-management'], popularity: 79 },
    { name: 'Motion', category: 'Productivity', description: 'AI calendar and project manager that automatically schedules and prioritizes your work.', platform: 'https://usemotion.com', access_type: 'Paid', pricing: 'Individual $19/mo', tags: ['calendar', 'project-management', 'scheduling'], popularity: 81 },
    { name: 'Tldv', category: 'Productivity', description: 'AI meeting recorder for Google Meet and Zoom. Transcribes, summarizes, and highlights key moments.', platform: 'https://tldv.io', access_type: 'Freemium', pricing: 'Free tier, Pro $20/mo', tags: ['meetings', 'transcription', 'notes'], popularity: 78 },
    { name: 'Fireflies.ai', category: 'Productivity', description: 'AI meeting assistant that records, transcribes, and analyzes meetings automatically.', platform: 'https://fireflies.ai', access_type: 'Freemium', pricing: 'Free tier, Pro $10/mo', tags: ['meetings', 'transcription', 'analysis'], popularity: 82 },
    { name: 'DeepL', category: 'Productivity', description: 'AI-powered translator known for natural, high-quality translations in 30+ languages.', platform: 'https://deepl.com', access_type: 'Freemium', pricing: 'Free tier, Pro $8.74/mo', tags: ['translation', 'language', 'accuracy'], popularity: 90 },

    // === CHATBOTS ===
    { name: 'Replika', category: 'ChatBots', description: 'AI companion chatbot designed for emotional support and conversation. Your personal AI friend.', platform: 'https://replika.com', access_type: 'Freemium', pricing: 'Free tier, Pro $7.99/mo', tags: ['companion', 'emotional-ai', 'chat'], popularity: 84 },
    { name: 'Chai', category: 'ChatBots', description: 'Platform for chatting with AI characters. Create and share AI personalities.', platform: 'https://chai.ml', access_type: 'Freemium', pricing: 'Free tier, Premium available', tags: ['chat', 'characters', 'entertainment'], popularity: 78 },
    { name: 'Tidio', category: 'ChatBots', description: 'AI chatbot and live chat for customer service. Easy to set up and customize.', platform: 'https://tidio.com', access_type: 'Freemium', pricing: 'Free tier, from $29/mo', tags: ['chatbot', 'live-chat', 'support'], popularity: 79 },

    // === CODE GENERATION ===
    { name: 'Codeium', category: 'Code Generation', description: 'Free AI code completion and chat assistant. Supports 70+ languages and multiple IDEs.', platform: 'https://codeium.com', access_type: 'Free', pricing: 'Free for individuals', tags: ['code-completion', 'free', 'multi-language'], popularity: 85 },
    { name: 'Amazon Q', category: 'Code Generation', description: 'AI assistant from AWS for building, deploying, and troubleshooting on AWS.', platform: 'https://aws.amazon.com/q', access_type: 'Freemium', pricing: 'Free tier, Pro $20/mo', tags: ['aws', 'cloud', 'development'], popularity: 80 },
    { name: 'Sourcegraph Cody', category: 'Code Generation', description: 'AI coding assistant that uses your codebase context to answer questions and write code.', platform: 'https://sourcegraph.com/cody', access_type: 'Freemium', pricing: 'Free tier, Pro $9/mo', tags: ['code-assistant', 'context-aware', 'search'], popularity: 78 },
    { name: 'Blackbox AI', category: 'Code Generation', description: 'AI code assistant with autocomplete, code chat, and code search capabilities.', platform: 'https://blackbox.ai', access_type: 'Freemium', pricing: 'Free tier, Pro $8/mo', tags: ['code', 'autocomplete', 'chat'], popularity: 76 },
    { name: 'Pieces', category: 'Code Generation', description: 'AI-powered code snippet manager with smart search, sharing, and context awareness.', platform: 'https://pieces.app', access_type: 'Free', pricing: 'Free', tags: ['snippets', 'productivity', 'search'], popularity: 77 },

    // === MARKETING ===
    { name: 'AdCreative.ai', category: 'Marketing', description: 'AI tool for generating high-converting ad creatives for social and display ads.', platform: 'https://adcreative.ai', access_type: 'Paid', pricing: 'From $29/mo', tags: ['ads', 'creative', 'design'], popularity: 80 },
    { name: 'Predis.ai', category: 'Marketing', description: 'AI social media content generator. Creates posts, carousels, and videos from text.', platform: 'https://predis.ai', access_type: 'Freemium', pricing: 'Free tier, Starter $29/mo', tags: ['social-media', 'content', 'posts'], popularity: 77 },
    { name: 'Looka', category: 'Marketing', description: 'AI logo maker and brand designer. Create professional logos in minutes.', platform: 'https://looka.com', access_type: 'Paid', pricing: 'From $20 one-time', tags: ['logo', 'branding', 'design'], popularity: 79 },
    { name: 'Brandmark', category: 'Marketing', description: 'AI-powered logo design tool that creates unique brand identities.', platform: 'https://brandmark.io', access_type: 'Paid', pricing: 'From $25 one-time', tags: ['logo', 'branding', 'ai-design'], popularity: 75 },

    // === DATA & ANALYTICS ===
    { name: 'Elicit', category: 'Data & Analytics', description: 'AI research assistant that helps find, summarize, and extract information from papers.', platform: 'https://elicit.org', access_type: 'Freemium', pricing: 'Free tier, Plus $10/mo', tags: ['research', 'papers', 'science'], popularity: 83 },
    { name: 'Consensus', category: 'Data & Analytics', description: 'AI search engine for scientific research. Get evidence-based answers from papers.', platform: 'https://consensus.app', access_type: 'Freemium', pricing: 'Free tier, Premium $6.99/mo', tags: ['research', 'science', 'search'], popularity: 80 },
    { name: 'SciSpace', category: 'Data & Analytics', description: 'AI tool for reading, understanding, and writing research papers.', platform: 'https://typeset.io', access_type: 'Freemium', pricing: 'Free tier, Premium $12/mo', tags: ['research', 'papers', 'writing'], popularity: 78 },

    // === DESIGN & CREATIVE ===
    { name: 'Remove.bg', category: 'Image Generation', description: 'AI tool that removes backgrounds from images automatically in seconds.', platform: 'https://remove.bg', access_type: 'Freemium', pricing: 'Free tier, credits from $0.20', tags: ['background-removal', 'image-editing', 'automation'], popularity: 88 },
    { name: 'Cleanup.pictures', category: 'Image Generation', description: 'AI tool that removes unwanted objects, people, or defects from photos.', platform: 'https://cleanup.pictures', access_type: 'Freemium', pricing: 'Free tier, Pro $5/mo', tags: ['photo-editing', 'object-removal', 'cleanup'], popularity: 82 },
    { name: 'Photoroom', category: 'Image Generation', description: 'AI photo editing app for removing backgrounds and creating product photos.', platform: 'https://photoroom.com', access_type: 'Freemium', pricing: 'Free tier, Pro $9.99/mo', tags: ['background-removal', 'product-photos', 'mobile'], popularity: 84 },
    { name: 'Clipdrop', category: 'Image Generation', description: 'AI-powered image editing suite by Stability AI. Remove backgrounds, upscale, and more.', platform: 'https://clipdrop.co', access_type: 'Freemium', pricing: 'Free tier, Pro $9/mo', tags: ['editing', 'upscaling', 'background-removal'], popularity: 83 },

    // === PRESENTATIONS ===
    { name: 'Pitch', category: 'Productivity', description: 'Collaborative presentation software with AI-powered design features.', platform: 'https://pitch.com', access_type: 'Freemium', pricing: 'Free tier, Pro $8/mo', tags: ['presentations', 'collaboration', 'design'], popularity: 78 },
    { name: 'Decktopus', category: 'Productivity', description: 'AI presentation maker that creates professional slides in minutes.', platform: 'https://decktopus.com', access_type: 'Freemium', pricing: 'Free tier, Pro $9.99/mo', tags: ['presentations', 'templates', 'quick'], popularity: 75 },

    // === EDUCATION ===
    { name: 'Quizlet', category: 'Learning & Education', description: 'AI-powered learning platform with flashcards, study modes, and learning games.', platform: 'https://quizlet.com', access_type: 'Freemium', pricing: 'Free tier, Plus $35.99/yr', tags: ['flashcards', 'study', 'learning'], popularity: 88 },
    { name: 'Duolingo Max', category: 'Learning & Education', description: 'AI-powered language learning features with GPT-4 integration for conversations.', platform: 'https://duolingo.com', access_type: 'Paid', pricing: '$29.99/mo', tags: ['language-learning', 'ai-tutor', 'conversation'], popularity: 90, is_trending: true },
    { name: 'Khanmigo', category: 'Learning & Education', description: 'AI tutor from Khan Academy powered by GPT-4. Personalized learning assistance.', platform: 'https://khanacademy.org', access_type: 'Paid', pricing: '$4/mo for students', tags: ['tutor', 'education', 'personalized'], popularity: 82 },
    { name: 'Socratic', category: 'Learning & Education', description: 'Google AI learning app that helps solve homework problems with step-by-step explanations.', platform: 'https://socratic.org', access_type: 'Free', pricing: 'Free', tags: ['homework', 'explanations', 'google'], popularity: 83 },
    { name: 'Photomath', category: 'Learning & Education', description: 'AI math app that solves problems by scanning them and shows step-by-step solutions.', platform: 'https://photomath.com', access_type: 'Freemium', pricing: 'Free tier, Plus $9.99/mo', tags: ['math', 'homework', 'solutions'], popularity: 87 },
    { name: 'Brainly', category: 'Learning & Education', description: 'AI learning platform where students can ask questions and get AI-powered answers.', platform: 'https://brainly.com', access_type: 'Freemium', pricing: 'Free tier, Plus $24/yr', tags: ['homework', 'questions', 'community'], popularity: 84 },

    // === MUSIC ===
    { name: 'Beatoven.ai', category: 'Video & Audio', description: 'AI music composer that creates royalty-free background music for videos.', platform: 'https://beatoven.ai', access_type: 'Freemium', pricing: 'Free tier, Pro $20/mo', tags: ['background-music', 'royalty-free', 'video'], popularity: 76 },
    { name: 'Boomy', category: 'Video & Audio', description: 'AI tool for creating original songs in seconds. No music experience needed.', platform: 'https://boomy.com', access_type: 'Freemium', pricing: 'Free tier, Creator $9.99/mo', tags: ['music-creation', 'easy', 'streaming'], popularity: 78 },
];

function generateId(name) {
    return `curated-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
}

async function importCuratedTools() {
    console.log('📋 Importing curated popular AI tools...\n');

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const tool of CURATED_TOOLS) {
        const entry = {
            id: generateId(tool.name),
            name: tool.name,
            category: tool.category,
            description: tool.description,
            platform: tool.platform,
            region: 'Global',
            access_type: tool.access_type,
            pricing: tool.pricing,
            tags: tool.tags,
            popularity: tool.popularity,
            last_updated: new Date().toISOString().split('T')[0],
            is_trending: tool.is_trending || false,
            image: null // Will be fetched later by image script
        };

        // Check if exists
        const { data: existing } = await supabase
            .from('ai_tools')
            .select('id')
            .eq('name', tool.name)
            .maybeSingle();

        if (existing) {
            // Update
            const { error } = await supabase
                .from('ai_tools')
                .update(entry)
                .eq('id', existing.id);

            if (error) {
                console.log(`❌ Failed to update ${tool.name}:`, error.message);
                failed++;
            } else {
                updated++;
            }
        } else {
            // Insert
            const { error } = await supabase
                .from('ai_tools')
                .insert(entry);

            if (error) {
                console.log(`❌ Failed to insert ${tool.name}:`, error.message);
                failed++;
            } else {
                inserted++;
            }
        }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${CURATED_TOOLS.length}`);
}

importCuratedTools();
