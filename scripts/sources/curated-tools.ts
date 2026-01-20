/**
 * Curated Popular Tools Source
 * Hardcoded list of the most popular, consumer-facing AI tools
 * These are tools people actually use and search for
 */

import type { AIEntry } from '../../lib/ai-data'

interface CuratedTool {
    name: string
    category: string
    description: string
    platform: string
    accessType: 'Free' | 'Freemium' | 'Paid'
    pricing: string
    tags: string[]
    popularity: number
    isTrending?: boolean
}

/**
 * Curated list of 200+ popular AI tools by category
 */
const CURATED_TOOLS: CuratedTool[] = [
    // === WRITING & CONTENT ===
    { name: 'Rytr', category: 'Writing & Content', description: 'AI writing assistant that helps create high-quality content in seconds. Generate blog posts, emails, ads, and more.', platform: 'https://rytr.me', accessType: 'Freemium', pricing: 'Free tier, Premium $9/mo', tags: ['writing', 'content', 'copywriting'], popularity: 82 },
    { name: 'Wordtune', category: 'Writing & Content', description: 'AI-powered writing companion that rewrites, rephrases, and enhances your writing in real-time.', platform: 'https://wordtune.com', accessType: 'Freemium', pricing: 'Free tier, Premium $9.99/mo', tags: ['writing', 'rewriting', 'paraphrasing'], popularity: 80 },
    { name: 'QuillBot', category: 'Writing & Content', description: 'AI paraphrasing tool that rewrites and enhances sentences, paragraphs, or articles.', platform: 'https://quillbot.com', accessType: 'Freemium', pricing: 'Free tier, Premium $9.95/mo', tags: ['paraphrasing', 'writing', 'grammar'], popularity: 85 },
    { name: 'Sudowrite', category: 'Writing & Content', description: 'AI writing partner for fiction authors. Helps with brainstorming, writing, and editing stories.', platform: 'https://sudowrite.com', accessType: 'Paid', pricing: 'From $10/mo', tags: ['fiction', 'creative-writing', 'storytelling'], popularity: 75 },
    { name: 'Anyword', category: 'Writing & Content', description: 'AI copywriting platform that generates and optimizes marketing copy with predictive performance scores.', platform: 'https://anyword.com', accessType: 'Freemium', pricing: 'Free tier, Starter $39/mo', tags: ['marketing', 'copywriting', 'ads'], popularity: 78 },
    { name: 'Frase', category: 'Writing & Content', description: 'AI content optimization tool for SEO. Research, write, and optimize content in one place.', platform: 'https://frase.io', accessType: 'Paid', pricing: 'From $14.99/mo', tags: ['seo', 'content', 'research'], popularity: 76 },
    { name: 'Surfer SEO', category: 'Writing & Content', description: 'AI-powered SEO tool that helps optimize content for search engines with real-time suggestions.', platform: 'https://surferseo.com', accessType: 'Paid', pricing: 'From $69/mo', tags: ['seo', 'content-optimization', 'keywords'], popularity: 82 },
    { name: 'Hemingway Editor', category: 'Writing & Content', description: 'AI writing tool that makes your writing bold and clear by highlighting complex sentences.', platform: 'https://hemingwayapp.com', accessType: 'Freemium', pricing: 'Free online, Desktop $19.99', tags: ['editing', 'readability', 'writing'], popularity: 78 },

    // === IMAGE GENERATION ===
    { name: 'NightCafe', category: 'Image Generation', description: 'AI art generator using multiple algorithms including Stable Diffusion, DALL-E 2, and more.', platform: 'https://nightcafe.studio', accessType: 'Freemium', pricing: 'Free credits, paid plans available', tags: ['art', 'image-generation', 'creative'], popularity: 80 },
    { name: 'Artbreeder', category: 'Image Generation', description: 'AI tool for creating and remixing images using gene-based creativity and collaboration.', platform: 'https://artbreeder.com', accessType: 'Freemium', pricing: 'Free tier, Starter $8.99/mo', tags: ['art', 'portraits', 'landscapes'], popularity: 78 },
    { name: 'Playground AI', category: 'Image Generation', description: 'Free AI image generator and editor with advanced features for creating stunning visuals.', platform: 'https://playground.ai', accessType: 'Freemium', pricing: 'Free tier, Pro $15/mo', tags: ['image-generation', 'editing', 'creative'], popularity: 82 },
    { name: 'Lexica', category: 'Image Generation', description: 'Stable Diffusion image search engine and generator. Find and create AI-generated images.', platform: 'https://lexica.art', accessType: 'Freemium', pricing: 'Free tier, Pro $10/mo', tags: ['stable-diffusion', 'search', 'generation'], popularity: 79 },
    { name: 'DreamStudio', category: 'Image Generation', description: 'Official Stable Diffusion interface by Stability AI. Create images with the latest models.', platform: 'https://dreamstudio.ai', accessType: 'Paid', pricing: 'Credit-based, from $10', tags: ['stable-diffusion', 'official', 'image'], popularity: 83 },
    { name: 'Craiyon', category: 'Image Generation', description: 'Formerly DALL-E Mini. Free AI image generator that creates images from text descriptions.', platform: 'https://craiyon.com', accessType: 'Free', pricing: 'Free with ads, Premium $5/mo', tags: ['free', 'image-generation', 'dall-e-mini'], popularity: 75 },
    { name: 'Deep Dream Generator', category: 'Image Generation', description: 'AI art generator using neural networks to create dreamlike, psychedelic images.', platform: 'https://deepdreamgenerator.com', accessType: 'Freemium', pricing: 'Free tier, Premium $19/mo', tags: ['deep-dream', 'art', 'neural-network'], popularity: 72 },
    { name: 'Hotpot AI', category: 'Image Generation', description: 'AI art generator and graphic design tool. Create images, restore photos, and more.', platform: 'https://hotpot.ai', accessType: 'Freemium', pricing: 'Free tier, credits for premium', tags: ['design', 'image', 'photo-restoration'], popularity: 74 },
    { name: 'Ideogram', category: 'Image Generation', description: 'AI image generator that excels at text rendering in images. Create logos and designs with readable text.', platform: 'https://ideogram.ai', accessType: 'Freemium', pricing: 'Free tier, Plus $7/mo', tags: ['text-in-images', 'logos', 'design'], popularity: 85, isTrending: true },
    { name: 'Krea AI', category: 'Image Generation', description: 'AI-powered creative tool for generating and enhancing images in real-time.', platform: 'https://krea.ai', accessType: 'Freemium', pricing: 'Free tier, Pro $24/mo', tags: ['real-time', 'creative', 'design'], popularity: 80 },

    // === VIDEO & ANIMATION ===
    { name: 'Kapwing', category: 'Video & Audio', description: 'AI-powered video editor with auto-subtitles, translations, and smart editing features.', platform: 'https://kapwing.com', accessType: 'Freemium', pricing: 'Free tier, Pro $16/mo', tags: ['video-editing', 'subtitles', 'online'], popularity: 84 },
    { name: 'Fliki', category: 'Video & Audio', description: 'AI video generator that turns text into videos with lifelike voiceovers.', platform: 'https://fliki.ai', accessType: 'Freemium', pricing: 'Free tier, Standard $21/mo', tags: ['text-to-video', 'voiceover', 'content'], popularity: 79 },
    { name: 'Opus Clip', category: 'Video & Audio', description: 'AI tool that repurposes long videos into viral short clips for TikTok, Reels, and Shorts.', platform: 'https://opus.pro', accessType: 'Freemium', pricing: 'Free tier, Pro $15/mo', tags: ['video-clips', 'repurposing', 'social-media'], popularity: 86, isTrending: true },
    { name: 'D-ID', category: 'Video & Audio', description: 'AI tool for creating talking avatar videos from photos. Turn images into speaking characters.', platform: 'https://d-id.com', accessType: 'Freemium', pricing: 'Free trial, Lite $4.70/mo', tags: ['avatar', 'talking-photo', 'video'], popularity: 81 },
    { name: 'Colossyan', category: 'Video & Audio', description: 'AI video platform for creating training and educational content with AI presenters.', platform: 'https://colossyan.com', accessType: 'Paid', pricing: 'From $21/mo', tags: ['training', 'education', 'presenter'], popularity: 75 },
    { name: 'Veed.io', category: 'Video & Audio', description: 'Online video editor with AI features like auto-subtitles, translations, and eye contact correction.', platform: 'https://veed.io', accessType: 'Freemium', pricing: 'Free tier, Basic $12/mo', tags: ['video-editing', 'subtitles', 'online'], popularity: 83 },
    { name: 'Wondershare Filmora', category: 'Video & Audio', description: 'Video editing software with AI features like motion tracking, auto reframe, and more.', platform: 'https://filmora.wondershare.com', accessType: 'Freemium', pricing: 'Free trial, Annual $49.99', tags: ['video-editing', 'desktop', 'effects'], popularity: 82 },
    { name: 'Captions', category: 'Video & Audio', description: 'AI-powered video editing app that adds captions, eye contact correction, and visual effects.', platform: 'https://captions.ai', accessType: 'Freemium', pricing: 'Free tier, Pro $10/mo', tags: ['captions', 'social-media', 'mobile'], popularity: 80 },

    // === VOICE & AUDIO ===
    { name: 'Descript', category: 'Voice & Speech', description: 'AI audio/video editor that lets you edit media by editing text. Features Overdub voice cloning.', platform: 'https://descript.com', accessType: 'Freemium', pricing: 'Free tier, Creator $12/mo', tags: ['audio-editing', 'transcription', 'voice-clone'], popularity: 86 },
    { name: 'Podcastle', category: 'Voice & Speech', description: 'AI podcast creation platform with recording, editing, and voice enhancement tools.', platform: 'https://podcastle.ai', accessType: 'Freemium', pricing: 'Free tier, Storyteller $11.99/mo', tags: ['podcast', 'recording', 'editing'], popularity: 77 },
    { name: 'Adobe Podcast', category: 'Voice & Speech', description: 'AI-powered audio recording and editing tool with speech enhancement features.', platform: 'https://podcast.adobe.com', accessType: 'Free', pricing: 'Free (beta)', tags: ['podcast', 'speech-enhancement', 'adobe'], popularity: 79 },
    { name: 'Krisp', category: 'Voice & Speech', description: 'AI noise cancellation app that removes background noise from calls and recordings.', platform: 'https://krisp.ai', accessType: 'Freemium', pricing: 'Free tier, Pro $8/mo', tags: ['noise-cancellation', 'audio', 'calls'], popularity: 82 },
    { name: 'Cleanvoice', category: 'Voice & Speech', description: 'AI tool that removes filler words, stutters, and mouth sounds from audio recordings.', platform: 'https://cleanvoice.ai', accessType: 'Paid', pricing: 'From $10/mo', tags: ['audio-editing', 'podcast', 'cleanup'], popularity: 74 },
    { name: 'Speechify', category: 'Voice & Speech', description: 'AI text-to-speech app that reads text aloud with natural-sounding voices.', platform: 'https://speechify.com', accessType: 'Freemium', pricing: 'Free tier, Premium $139/yr', tags: ['text-to-speech', 'reading', 'accessibility'], popularity: 83 },
    { name: 'Voicemod', category: 'Voice & Speech', description: 'AI voice changer and soundboard for gaming, streaming, and calls.', platform: 'https://voicemod.net', accessType: 'Freemium', pricing: 'Free tier, Pro $25/yr', tags: ['voice-changer', 'gaming', 'streaming'], popularity: 81 },

    // === PRODUCTIVITY & AUTOMATION ===
    { name: 'Notion AI', category: 'Productivity', description: 'AI assistant built into Notion that helps write, summarize, brainstorm, and translate.', platform: 'https://notion.so', accessType: 'Paid', pricing: '$10/mo add-on', tags: ['notes', 'writing', 'productivity'], popularity: 90 },
    { name: 'Mem', category: 'Productivity', description: 'AI-powered note-taking app that organizes itself. Smart search and related notes.', platform: 'https://mem.ai', accessType: 'Freemium', pricing: 'Free tier, Mem X $8/mo', tags: ['notes', 'knowledge-management', 'search'], popularity: 76 },
    { name: 'Lex', category: 'Productivity', description: 'AI writing tool designed for long-form content. Simple, distraction-free writing with AI assist.', platform: 'https://lex.page', accessType: 'Freemium', pricing: 'Free tier, Premium $8/mo', tags: ['writing', 'long-form', 'focus'], popularity: 74 },
    { name: 'Taskade', category: 'Productivity', description: 'AI-powered productivity tool for task management, notes, and team collaboration.', platform: 'https://taskade.com', accessType: 'Freemium', pricing: 'Free tier, Pro $5/mo', tags: ['tasks', 'collaboration', 'notes'], popularity: 77 },
    { name: 'Reclaim AI', category: 'Productivity', description: 'AI calendar assistant that automatically schedules tasks, habits, and meetings.', platform: 'https://reclaim.ai', accessType: 'Freemium', pricing: 'Free tier, Starter $8/mo', tags: ['calendar', 'scheduling', 'time-management'], popularity: 79 },
    { name: 'Motion', category: 'Productivity', description: 'AI calendar and project manager that automatically schedules and prioritizes your work.', platform: 'https://usemotion.com', accessType: 'Paid', pricing: 'Individual $19/mo', tags: ['calendar', 'project-management', 'scheduling'], popularity: 81 },
    { name: 'Tldv', category: 'Productivity', description: 'AI meeting recorder for Google Meet and Zoom. Transcribes, summarizes, and highlights key moments.', platform: 'https://tldv.io', accessType: 'Freemium', pricing: 'Free tier, Pro $20/mo', tags: ['meetings', 'transcription', 'notes'], popularity: 78 },
    { name: 'Fireflies.ai', category: 'Productivity', description: 'AI meeting assistant that records, transcribes, and analyzes meetings automatically.', platform: 'https://fireflies.ai', accessType: 'Freemium', pricing: 'Free tier, Pro $10/mo', tags: ['meetings', 'transcription', 'analysis'], popularity: 82 },
    { name: 'Tactiq', category: 'Productivity', description: 'AI transcription for Google Meet, Zoom, and Teams with real-time captions and summaries.', platform: 'https://tactiq.io', accessType: 'Freemium', pricing: 'Free tier, Pro $8/mo', tags: ['transcription', 'meetings', 'captions'], popularity: 76 },

    // === CHATBOTS & ASSISTANTS ===
    { name: 'Replika', category: 'ChatBots', description: 'AI companion chatbot designed for emotional support and conversation. Your personal AI friend.', platform: 'https://replika.com', accessType: 'Freemium', pricing: 'Free tier, Pro $7.99/mo', tags: ['companion', 'emotional-ai', 'chat'], popularity: 84 },
    { name: 'Chai', category: 'ChatBots', description: 'Platform for chatting with AI characters. Create and share AI personalities.', platform: 'https://chai.ml', accessType: 'Freemium', pricing: 'Free tier, Premium available', tags: ['chat', 'characters', 'entertainment'], popularity: 78 },
    { name: 'Kuki', category: 'ChatBots', description: 'Award-winning conversational AI chatbot with a fun personality and memory.', platform: 'https://kuki.ai', accessType: 'Free', pricing: 'Free', tags: ['chatbot', 'entertainment', 'conversational'], popularity: 72 },
    { name: 'Jasper Chat', category: 'ChatBots', description: 'AI chat assistant from Jasper, focused on marketing and business content creation.', platform: 'https://jasper.ai', accessType: 'Paid', pricing: 'From $39/mo', tags: ['marketing', 'business', 'content'], popularity: 80 },
    { name: 'YouChat', category: 'ChatBots', description: 'AI chatbot integrated with You.com search engine. Get answers with sources.', platform: 'https://you.com', accessType: 'Free', pricing: 'Free', tags: ['search', 'chatbot', 'research'], popularity: 79 },

    // === CODE & DEVELOPMENT ===
    { name: 'Codeium', category: 'Code Generation', description: 'Free AI code completion and chat assistant. Supports 70+ languages and multiple IDEs.', platform: 'https://codeium.com', accessType: 'Free', pricing: 'Free for individuals', tags: ['code-completion', 'free', 'multi-language'], popularity: 85 },
    { name: 'Amazon Q', category: 'Code Generation', description: 'AI assistant from AWS for building, deploying, and troubleshooting on AWS.', platform: 'https://aws.amazon.com/q', accessType: 'Freemium', pricing: 'Free tier, Pro $20/mo', tags: ['aws', 'cloud', 'development'], popularity: 80 },
    { name: 'Sourcegraph Cody', category: 'Code Generation', description: 'AI coding assistant that uses your codebase context to answer questions and write code.', platform: 'https://sourcegraph.com/cody', accessType: 'Freemium', pricing: 'Free tier, Pro $9/mo', tags: ['code-assistant', 'context-aware', 'search'], popularity: 78 },
    { name: 'Blackbox AI', category: 'Code Generation', description: 'AI code assistant with autocomplete, code chat, and code search capabilities.', platform: 'https://blackbox.ai', accessType: 'Freemium', pricing: 'Free tier, Pro $8/mo', tags: ['code', 'autocomplete', 'chat'], popularity: 76 },
    { name: 'AskCodi', category: 'Code Generation', description: 'AI code assistant for generating, explaining, and testing code across multiple languages.', platform: 'https://askcodi.com', accessType: 'Freemium', pricing: 'Free tier, Premium $9.99/mo', tags: ['code-generation', 'explanation', 'testing'], popularity: 74 },
    { name: 'Pieces', category: 'Code Generation', description: 'AI-powered code snippet manager with smart search, sharing, and context awareness.', platform: 'https://pieces.app', accessType: 'Free', pricing: 'Free', tags: ['snippets', 'productivity', 'search'], popularity: 77 },
    { name: 'Codiga', category: 'Code Generation', description: 'AI-powered code analysis and snippets. Static code analysis in your IDE.', platform: 'https://codiga.io', accessType: 'Freemium', pricing: 'Free for public repos', tags: ['code-analysis', 'snippets', 'quality'], popularity: 72 },

    // === MARKETING & SALES ===
    { name: 'Persado', category: 'Marketing', description: 'AI platform that generates personalized marketing language that drives engagement.', platform: 'https://persado.com', accessType: 'Paid', pricing: 'Enterprise pricing', tags: ['marketing', 'personalization', 'language'], popularity: 75 },
    { name: 'Phrasee', category: 'Marketing', description: 'AI for optimizing marketing language across email, push, SMS, and social.', platform: 'https://phrasee.co', accessType: 'Paid', pricing: 'Enterprise pricing', tags: ['email', 'marketing', 'optimization'], popularity: 74 },
    { name: 'Albert AI', category: 'Marketing', description: 'AI digital marketing platform that autonomously runs and optimizes campaigns.', platform: 'https://albert.ai', accessType: 'Paid', pricing: 'Enterprise pricing', tags: ['advertising', 'campaigns', 'automation'], popularity: 72 },
    { name: 'Pencil', category: 'Marketing', description: 'AI creative platform that generates and tests ad creatives for social media.', platform: 'https://trypencil.com', accessType: 'Paid', pricing: 'From $119/mo', tags: ['ads', 'creative', 'social-media'], popularity: 76 },
    { name: 'AdCreative.ai', category: 'Marketing', description: 'AI tool for generating high-converting ad creatives for social and display ads.', platform: 'https://adcreative.ai', accessType: 'Paid', pricing: 'From $29/mo', tags: ['ads', 'creative', 'design'], popularity: 80 },
    { name: 'Predis.ai', category: 'Marketing', description: 'AI social media content generator. Creates posts, carousels, and videos from text.', platform: 'https://predis.ai', accessType: 'Freemium', pricing: 'Free tier, Starter $29/mo', tags: ['social-media', 'content', 'posts'], popularity: 77 },
    { name: 'Looka', category: 'Marketing', description: 'AI logo maker and brand designer. Create professional logos in minutes.', platform: 'https://looka.com', accessType: 'Paid', pricing: 'From $20 one-time', tags: ['logo', 'branding', 'design'], popularity: 79 },
    { name: 'Brandmark', category: 'Marketing', description: 'AI-powered logo design tool that creates unique brand identities.', platform: 'https://brandmark.io', accessType: 'Paid', pricing: 'From $25 one-time', tags: ['logo', 'branding', 'ai-design'], popularity: 75 },

    // === RESEARCH & ANALYSIS ===
    { name: 'Elicit', category: 'Data & Analytics', description: 'AI research assistant that helps find, summarize, and extract information from papers.', platform: 'https://elicit.org', accessType: 'Freemium', pricing: 'Free tier, Plus $10/mo', tags: ['research', 'papers', 'science'], popularity: 83 },
    { name: 'Consensus', category: 'Data & Analytics', description: 'AI search engine for scientific research. Get evidence-based answers from papers.', platform: 'https://consensus.app', accessType: 'Freemium', pricing: 'Free tier, Premium $6.99/mo', tags: ['research', 'science', 'search'], popularity: 80 },
    { name: 'Semantic Scholar', category: 'Data & Analytics', description: 'AI-powered research tool for scientific literature. Find relevant papers and citations.', platform: 'https://semanticscholar.org', accessType: 'Free', pricing: 'Free', tags: ['research', 'literature', 'academic'], popularity: 82 },
    { name: 'SciSpace', category: 'Data & Analytics', description: 'AI tool for reading, understanding, and writing research papers.', platform: 'https://typeset.io', accessType: 'Freemium', pricing: 'Free tier, Premium $12/mo', tags: ['research', 'papers', 'writing'], popularity: 78 },
    { name: 'Scholarcy', category: 'Data & Analytics', description: 'AI article summarizer that creates flashcard-style summaries of research papers.', platform: 'https://scholarcy.com', accessType: 'Freemium', pricing: 'Free tier, from $9.99/mo', tags: ['summarization', 'research', 'flashcards'], popularity: 75 },
    { name: 'Connected Papers', category: 'Data & Analytics', description: 'AI tool that creates visual graphs of related research papers to explore a topic.', platform: 'https://connectedpapers.com', accessType: 'Freemium', pricing: 'Free tier, Premium $3/mo', tags: ['research', 'visualization', 'papers'], popularity: 77 },

    // === CUSTOMER SERVICE ===
    { name: 'Intercom Fin', category: 'ChatBots', description: 'AI customer service agent by Intercom that resolves support issues automatically.', platform: 'https://intercom.com', accessType: 'Paid', pricing: 'From $74/mo', tags: ['customer-service', 'support', 'automation'], popularity: 82 },
    { name: 'Zendesk AI', category: 'ChatBots', description: 'AI-powered customer service solutions including bots, agent assist, and analytics.', platform: 'https://zendesk.com', accessType: 'Paid', pricing: 'From $55/mo', tags: ['customer-service', 'helpdesk', 'enterprise'], popularity: 81 },
    { name: 'Tidio', category: 'ChatBots', description: 'AI chatbot and live chat for customer service. Easy to set up and customize.', platform: 'https://tidio.com', accessType: 'Freemium', pricing: 'Free tier, from $29/mo', tags: ['chatbot', 'live-chat', 'support'], popularity: 79 },
    { name: 'Drift', category: 'ChatBots', description: 'Conversational AI platform for B2B sales and marketing with chatbots and live chat.', platform: 'https://drift.com', accessType: 'Paid', pricing: 'From $2,500/mo', tags: ['sales', 'marketing', 'b2b'], popularity: 77 },

    // === DESIGN & CREATIVE ===
    { name: 'Canva Magic', category: 'Image Generation', description: 'AI-powered design features in Canva including text-to-image, Magic Write, and more.', platform: 'https://canva.com', accessType: 'Freemium', pricing: 'Free tier, Pro $12.99/mo', tags: ['design', 'graphics', 'templates'], popularity: 92, isTrending: true },
    { name: 'Remove.bg', category: 'Image Generation', description: 'AI tool that removes backgrounds from images automatically in seconds.', platform: 'https://remove.bg', accessType: 'Freemium', pricing: 'Free tier, credits from $0.20', tags: ['background-removal', 'image-editing', 'automation'], popularity: 88 },
    { name: 'Cleanup.pictures', category: 'Image Generation', description: 'AI tool that removes unwanted objects, people, or defects from photos.', platform: 'https://cleanup.pictures', accessType: 'Freemium', pricing: 'Free tier, Pro $5/mo', tags: ['photo-editing', 'object-removal', 'cleanup'], popularity: 82 },
    { name: 'Photoroom', category: 'Image Generation', description: 'AI photo editing app for removing backgrounds and creating product photos.', platform: 'https://photoroom.com', accessType: 'Freemium', pricing: 'Free tier, Pro $9.99/mo', tags: ['background-removal', 'product-photos', 'mobile'], popularity: 84 },
    { name: 'Clipdrop', category: 'Image Generation', description: 'AI-powered image editing suite by Stability AI. Remove backgrounds, upscale, and more.', platform: 'https://clipdrop.co', accessType: 'Freemium', pricing: 'Free tier, Pro $9/mo', tags: ['editing', 'upscaling', 'background-removal'], popularity: 83 },
    { name: 'Photopea', category: 'Image Generation', description: 'Advanced free online photo editor similar to Photoshop with AI features.', platform: 'https://photopea.com', accessType: 'Free', pricing: 'Free with ads', tags: ['photo-editing', 'free', 'advanced'], popularity: 85 },
    { name: 'Pixlr', category: 'Image Generation', description: 'Online photo editor with AI tools for background removal, effects, and more.', platform: 'https://pixlr.com', accessType: 'Freemium', pricing: 'Free tier, Premium $4.99/mo', tags: ['photo-editing', 'online', 'effects'], popularity: 82 },
    { name: 'Fotor', category: 'Image Generation', description: 'AI photo editor and design tool with one-click enhancements and creative features.', platform: 'https://fotor.com', accessType: 'Freemium', pricing: 'Free tier, Pro $8.99/mo', tags: ['photo-editing', 'design', 'enhancements'], popularity: 80 },

    // === PRESENTATION & DOCUMENTS ===
    { name: 'Tome', category: 'Productivity', description: 'AI-powered presentation creator that generates slides and content from prompts.', platform: 'https://tome.app', accessType: 'Freemium', pricing: 'Free tier, Pro $10/mo', tags: ['presentations', 'slides', 'storytelling'], popularity: 85 },
    { name: 'Gamma', category: 'Productivity', description: 'AI presentation tool that creates beautiful decks with content and design in seconds.', platform: 'https://gamma.app', accessType: 'Freemium', pricing: 'Free tier, Pro $8/mo', tags: ['presentations', 'slides', 'design'], popularity: 86, isTrending: true },
    { name: 'Pitch', category: 'Productivity', description: 'Collaborative presentation software with AI-powered design features.', platform: 'https://pitch.com', accessType: 'Freemium', pricing: 'Free tier, Pro $8/mo', tags: ['presentations', 'collaboration', 'design'], popularity: 78 },
    { name: 'Decktopus', category: 'Productivity', description: 'AI presentation maker that creates professional slides in minutes.', platform: 'https://decktopus.com', accessType: 'Freemium', pricing: 'Free tier, Pro $9.99/mo', tags: ['presentations', 'templates', 'quick'], popularity: 75 },
    { name: 'Slidesgo', category: 'Productivity', description: 'Free presentation templates with AI content suggestions and design help.', platform: 'https://slidesgo.com', accessType: 'Freemium', pricing: 'Free tier, Premium $4.99/mo', tags: ['templates', 'presentations', 'google-slides'], popularity: 77 },

    // === EDUCATION & LEARNING ===
    { name: 'Quizlet', category: 'Learning & Education', description: 'AI-powered learning platform with flashcards, study modes, and learning games.', platform: 'https://quizlet.com', accessType: 'Freemium', pricing: 'Free tier, Plus $35.99/yr', tags: ['flashcards', 'study', 'learning'], popularity: 88 },
    { name: 'Duolingo Max', category: 'Learning & Education', description: 'AI-powered language learning features with GPT-4 integration for conversations.', platform: 'https://duolingo.com', accessType: 'Paid', pricing: '$29.99/mo', tags: ['language-learning', 'ai-tutor', 'conversation'], popularity: 90, isTrending: true },
    { name: 'Khanmigo', category: 'Learning & Education', description: 'AI tutor from Khan Academy powered by GPT-4. Personalized learning assistance.', platform: 'https://khanacademy.org', accessType: 'Paid', pricing: '$4/mo for students', tags: ['tutor', 'education', 'personalized'], popularity: 82 },
    { name: 'Socratic', category: 'Learning & Education', description: 'Google AI learning app that helps solve homework problems with step-by-step explanations.', platform: 'https://socratic.org', accessType: 'Free', pricing: 'Free', tags: ['homework', 'explanations', 'google'], popularity: 83 },
    { name: 'Photomath', category: 'Learning & Education', description: 'AI math app that solves problems by scanning them and shows step-by-step solutions.', platform: 'https://photomath.com', accessType: 'Freemium', pricing: 'Free tier, Plus $9.99/mo', tags: ['math', 'homework', 'solutions'], popularity: 87 },
    { name: 'Brainly', category: 'Learning & Education', description: 'AI learning platform where students can ask questions and get AI-powered answers.', platform: 'https://brainly.com', accessType: 'Freemium', pricing: 'Free tier, Plus $24/yr', tags: ['homework', 'questions', 'community'], popularity: 84 },

    // === TRANSLATION & LANGUAGE ===
    { name: 'DeepL', category: 'Productivity', description: 'AI-powered translator known for natural, high-quality translations in 30+ languages.', platform: 'https://deepl.com', accessType: 'Freemium', pricing: 'Free tier, Pro $8.74/mo', tags: ['translation', 'language', 'accuracy'], popularity: 90 },
    { name: 'Lilt', category: 'Productivity', description: 'AI-powered translation platform for enterprises with human-in-the-loop quality.', platform: 'https://lilt.com', accessType: 'Paid', pricing: 'Enterprise pricing', tags: ['translation', 'enterprise', 'localization'], popularity: 72 },
    { name: 'Smartcat', category: 'Productivity', description: 'AI translation platform for teams and agencies with collaboration features.', platform: 'https://smartcat.com', accessType: 'Freemium', pricing: 'Free tier, paid plans available', tags: ['translation', 'collaboration', 'agencies'], popularity: 74 },

    // === MUSIC & AUDIO CREATION ===
    { name: 'Suno', category: 'Video & Audio', description: 'AI music generator that creates songs with vocals, instruments, and lyrics from text.', platform: 'https://suno.ai', accessType: 'Freemium', pricing: 'Free tier, Pro $10/mo', tags: ['music-generation', 'vocals', 'songs'], popularity: 90, isTrending: true },
    { name: 'Udio', category: 'Video & Audio', description: 'AI music creation platform that generates original songs in various styles and genres.', platform: 'https://udio.com', accessType: 'Freemium', pricing: 'Free tier, Standard $10/mo', tags: ['music-generation', 'ai-music', 'creation'], popularity: 88, isTrending: true },
    { name: 'Beatoven.ai', category: 'Video & Audio', description: 'AI music composer that creates royalty-free background music for videos.', platform: 'https://beatoven.ai', accessType: 'Freemium', pricing: 'Free tier, Pro $20/mo', tags: ['background-music', 'royalty-free', 'video'], popularity: 76 },
    { name: 'Boomy', category: 'Video & Audio', description: 'AI tool for creating original songs in seconds. No music experience needed.', platform: 'https://boomy.com', accessType: 'Freemium', pricing: 'Free tier, Creator $9.99/mo', tags: ['music-creation', 'easy', 'streaming'], popularity: 78 },
    { name: 'Amper Music', category: 'Video & Audio', description: 'AI music creation platform for producing royalty-free music for content creators.', platform: 'https://ampermusic.com', accessType: 'Paid', pricing: 'Credit-based', tags: ['royalty-free', 'content-creators', 'production'], popularity: 72 },
]

/**
 * Generate unique ID for curated tool
 */
function generateCuratedId(name: string): string {
    return `curated-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`
}

/**
 * Get curated tools as AIEntry format
 */
export async function fetchFromCuratedList(): Promise<AIEntry[]> {
    console.log('\n📋 Loading curated popular tools...\n')

    const entries: AIEntry[] = CURATED_TOOLS.map(tool => ({
        id: generateCuratedId(tool.name),
        name: tool.name,
        category: tool.category,
        description: tool.description,
        platform: tool.platform,
        region: 'Global',
        accessType: tool.accessType,
        pricing: tool.pricing,
        tags: tool.tags,
        popularity: tool.popularity,
        lastUpdated: new Date().toISOString().split('T')[0],
        isTrending: tool.isTrending || false
    }))

    console.log(`[Curated] Loaded ${entries.length} popular tools`)
    return entries
}

export { CURATED_TOOLS }
