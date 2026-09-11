/**
 * Hand-authored stage sequences for common goal families.
 *
 * WHY THIS EXISTS: stack building needs a model call to split an arbitrary goal
 * into stages, and the Gemini generation quota is exhausted (confirmed: HTTP 429
 * on a one-word prompt). Until a funded Claude key is in place, every
 * /api/stack call returns "temporarily unavailable" — a whole feature dark
 * because of a billing state.
 *
 * HOW THIS IS DIFFERENT FROM GUESSING. lib/stack.ts deliberately refuses to
 * invent stages for an arbitrary goal, and that still holds. These templates are
 * not a general-purpose substitute for reasoning; they are a small set of
 * sequences a human wrote for goals we can recognise with confidence. The
 * distinction that makes them honest:
 *
 *   - they only fire on a CONFIDENT match to a known goal family
 *   - a goal that matches nothing yields NO stack, exactly as before
 *   - the result is tagged `source: "template"` so the UI can say this is a
 *     known pattern rather than analysis of the user's specific goal
 *
 * This also earns its place after Claude is funded: for these common goals it is
 * a free, instant fast path that spends no quota and adds no latency, so the
 * model call is reserved for goals nobody has pre-written.
 *
 * THE RULE FOR A searchQuery, learned the hard way: it MUST produce an
 * AND-match against fts_vector. search_tools_advanced scores relevance with
 * ts_rank against the AND tsquery, so a query where not every word co-occurs in
 * any row scores zero relevance for every candidate, and the pick is then
 * decided by the popularity-driven breadth tier. That is how the stage
 * "schedule social media posts" ended up returning TweetAssist, a Chrome
 * extension for composing tweets, in four different templates.
 *
 * KNOWN LIMIT, do not keep rewording: the social-scheduling stages return a
 * tweeting browser extension rather than a scheduler, and that is NOT fixable
 * by wording. SocialBee (popularity 100), Publer, Hootsuite and Sprout Social
 * are all present in the catalog, and six different phrasings were measured
 * through the real pipeline — "schedule social media posts" -> TweetAssist,
 * "social media scheduler" -> TwoSlash (a browser ChatGPT extension),
 * "social media content calendar" -> CurioAI. None reach the actual
 * schedulers. This is the retrieval-ranking problem measured at precision@1
 * 62% in scripts/eval/recommendation-eval.mjs, and it needs fixing there.
 *
 * Counter-intuitively this means SHORTER, more ordinary phrasing beats longer
 * "more distinctive" phrasing: an attempt to fix that stage with "social media
 * publishing calendar for multiple accounts" AND-matched nothing and changed
 * nothing. scripts/eval/stack-stages.mts asserts this automatically — it fails
 * any stage whose query has no AND-match, so this class of bug cannot be
 * introduced silently again.
 */

import type { PlannedStep } from "./stack"

export interface StackTemplate {
    id: string
    /** Multi-word phrases. A substring hit is treated as a confident match on
     *  its own, because a phrase this specific is unlikely to appear by chance. */
    phrases: string[]
    /** Individual words. Weaker signal, so two or more must hit. */
    tokens: string[]
    steps: PlannedStep[]
}

/** Token hits needed when no phrase matched. One shared word is a coincidence
 *  ("video" appears in a great many unrelated goals); two is a pattern. */
const MIN_TOKEN_HITS = 2

export const STACK_TEMPLATES: StackTemplate[] = [
    {
        id: "podcast",
        phrases: ["podcast"],
        tokens: ["podcast", "episode", "audio", "interview"],
        steps: [
            { role: "Recording", purpose: "Record and clean up the audio.", searchQuery: "record and edit audio" },
            { role: "Transcription", purpose: "Turn each episode into text for show notes and search.", searchQuery: "transcribe audio to text" },
            { role: "Clips", purpose: "Cut short clips to promote the episode.", searchQuery: "turn long video into short clips" },
            { role: "Artwork", purpose: "Cover art and episode graphics.", searchQuery: "design graphics and cover art" },
            { role: "Promotion", purpose: "Schedule the promo posts.", searchQuery: "schedule social media posts" },
        ],
    },
    {
        id: "youtube-channel",
        phrases: ["youtube channel", "youtube videos", "video channel", "start a channel"],
        tokens: ["youtube", "channel", "vlog", "subscriber"],
        steps: [
            { role: "Scripting", purpose: "Write the video scripts.", searchQuery: "ai writing assistant for scripts" },
            { role: "Editing", purpose: "Cut the footage together.", searchQuery: "video editor trim and cut footage" },
            { role: "Voiceover", purpose: "Narrate without recording yourself.", searchQuery: "text to speech voiceover" },
            { role: "Thumbnails", purpose: "Thumbnails that earn the click.", searchQuery: "design thumbnails and graphics" },
            { role: "Clips", purpose: "Reformat into shorts.", searchQuery: "turn long video into short clips" },
        ],
    },
    {
        id: "newsletter",
        phrases: ["newsletter", "email list", "mailing list", "substack"],
        tokens: ["newsletter", "subscriber", "email", "issue"],
        steps: [
            { role: "Drafting", purpose: "Write each issue.", searchQuery: "ai writing assistant for articles" },
            { role: "Illustration", purpose: "Header and inline images.", searchQuery: "ai image generation" },
            { role: "Sending", purpose: "Deliver to subscribers and handle sign-ups.", searchQuery: "email marketing campaigns and subscriber lists" },
            { role: "Growth", purpose: "Promote issues to find readers.", searchQuery: "schedule social media posts" },
        ],
    },
    {
        id: "website",
        phrases: ["build a website", "landing page", "web site", "personal site", "portfolio site"],
        tokens: ["website", "landing", "portfolio", "webpage"],
        steps: [
            { role: "Building", purpose: "Assemble the pages without writing code.", searchQuery: "no-code website builder" },
            { role: "Copywriting", purpose: "Write the page copy.", searchQuery: "ai copywriting for marketing" },
            { role: "Imagery", purpose: "Visuals and illustrations for the pages.", searchQuery: "ai image generation" },
            { role: "SEO", purpose: "Get the pages found in search.", searchQuery: "keyword research search volume and rank tracking" },
        ],
    },
    {
        id: "online-store",
        phrases: ["online store", "ecommerce", "e-commerce", "sell products online", "shopify"],
        tokens: ["store", "ecommerce", "shopify", "dropshipping", "merchandise"],
        steps: [
            { role: "Storefront", purpose: "Stand up the shop itself.", searchQuery: "no-code website builder" },
            { role: "Product photos", purpose: "Studio-quality shots of the products.", searchQuery: "product photography and image editing" },
            { role: "Descriptions", purpose: "Write listings that sell.", searchQuery: "ai copywriting for marketing" },
            { role: "Support", purpose: "Answer buyer questions automatically.", searchQuery: "customer support chatbot" },
            { role: "Ads", purpose: "Run and iterate the ad creative.", searchQuery: "ai advertising creative" },
        ],
    },
    {
        id: "online-course",
        phrases: ["online course", "teach a course", "sell a course", "e-learning"],
        tokens: ["course", "curriculum", "lesson", "students", "teaching"],
        steps: [
            { role: "Outline", purpose: "Structure the curriculum.", searchQuery: "ai writing assistant for articles" },
            { role: "Slides", purpose: "Build the lesson decks.", searchQuery: "ai presentation slide generation" },
            { role: "Recording", purpose: "Record the lessons.", searchQuery: "screen recording and video editing" },
            { role: "Narration", purpose: "Voice the lessons consistently.", searchQuery: "text to speech voiceover" },
            { role: "Quizzes", purpose: "Check that learners retained it.", searchQuery: "quiz and flashcard generation" },
        ],
    },
    {
        id: "blog-seo",
        phrases: ["blog posts", "start a blog", "content marketing", "seo content"],
        tokens: ["blog", "article", "seo", "keywords", "ranking"],
        steps: [
            { role: "Keywords", purpose: "Decide what to write about.", searchQuery: "keyword research search volume and rank tracking" },
            { role: "Drafting", purpose: "Write the posts.", searchQuery: "ai writing assistant for articles" },
            { role: "Imagery", purpose: "Featured images per post.", searchQuery: "ai image generation" },
            { role: "Distribution", purpose: "Push each post to social.", searchQuery: "schedule social media posts" },
        ],
    },
    {
        id: "social-presence",
        phrases: ["social media presence", "grow my instagram", "grow on tiktok", "post consistently"],
        tokens: ["instagram", "tiktok", "linkedin", "twitter", "followers"],
        steps: [
            { role: "Ideas", purpose: "Decide what to post.", searchQuery: "ai social media content ideas" },
            { role: "Visuals", purpose: "Produce the images and video.", searchQuery: "ai image generation" },
            { role: "Captions", purpose: "Write captions and hooks.", searchQuery: "ai copywriting for marketing" },
            { role: "Scheduling", purpose: "Post on a consistent cadence.", searchQuery: "schedule social media posts" },
        ],
    },
    {
        id: "saas-mvp",
        phrases: ["build an app", "build a saas", "launch a startup", "build my mvp", "side project"],
        tokens: ["mvp", "saas", "startup", "prototype", "webapp"],
        steps: [
            { role: "Coding", purpose: "Write the application itself.", searchQuery: "ai coding assistant autocomplete" },
            { role: "UI design", purpose: "Design the interface.", searchQuery: "ui design and prototyping" },
            { role: "Landing page", purpose: "Somewhere to send early users.", searchQuery: "no-code website builder" },
            { role: "Review", purpose: "Catch bugs before users do.", searchQuery: "automated code review and bug detection" },
            { role: "Support", purpose: "Answer the first users.", searchQuery: "customer support chatbot" },
        ],
    },
    {
        id: "customer-support",
        phrases: ["customer support", "answer support tickets", "help desk", "support inbox"],
        tokens: ["support", "helpdesk", "tickets", "inbox", "complaints"],
        steps: [
            { role: "Knowledge base", purpose: "Train an assistant on your own docs.", searchQuery: "chatbot trained on your documents" },
            { role: "Live chat", purpose: "Handle the common questions on site.", searchQuery: "customer support chatbot" },
            { role: "Triage", purpose: "Route what the bot cannot answer.", searchQuery: "automate tasks between apps" },
            { role: "Transcripts", purpose: "Summarise calls and chats.", searchQuery: "transcribe audio to text" },
        ],
    },
    {
        id: "hiring",
        phrases: ["hire", "hiring", "recruit", "screen candidates", "job applicants"],
        tokens: ["hiring", "recruiting", "candidates", "applicants", "resumes"],
        steps: [
            { role: "Job posts", purpose: "Write the role description.", searchQuery: "ai copywriting for marketing" },
            { role: "Screening", purpose: "Sift the applications.", searchQuery: "recruiting candidate screening" },
            { role: "Interviews", purpose: "Structure and record interviews.", searchQuery: "interview practice and questions" },
            { role: "Notes", purpose: "Turn interviews into comparable notes.", searchQuery: "transcribe audio to text" },
        ],
    },
    {
        id: "research",
        phrases: ["literature review", "research papers", "review the literature", "academic research"],
        tokens: ["research", "papers", "citations", "thesis", "dissertation"],
        steps: [
            { role: "Discovery", purpose: "Find the relevant papers.", searchQuery: "academic paper search and discovery" },
            { role: "Summarising", purpose: "Digest each paper quickly.", searchQuery: "summarize documents and pdfs" },
            { role: "Notes", purpose: "Query your own collection.", searchQuery: "chatbot trained on your documents" },
            { role: "Citations", purpose: "Keep references straight.", searchQuery: "citation and reference management" },
        ],
    },
]

export interface TemplateMatch {
    template: StackTemplate
    /** 10 for a phrase hit, otherwise the number of token hits. Exposed so the
     *  caller can log why a template was chosen. */
    score: number
    matchedOn: string
}

/**
 * Find the best template for a goal, or null when nothing matches confidently.
 *
 * Returning null is the important behaviour: it is what preserves the rule that
 * we never invent a stack for a goal we do not understand.
 */
export function matchTemplate(goal: string): TemplateMatch | null {
    const normalized = ` ${goal.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `
    if (normalized.trim().length === 0) return null

    // Token matching is whole-word, which means plurals would otherwise miss:
    // the goal "subscribers and issues" failed to match the newsletter tokens
    // "subscriber" and "issue" because " subscriber " is not a substring of
    // " subscribers ". Rather than pad every token list with plural forms,
    // index the goal's words under both their own form and an s-stripped form,
    // and look up template tokens the same way.
    const singular = (word: string) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word)
    const goalTokens = new Set<string>()
    for (const word of normalized.trim().split(" ")) {
        if (!word) continue
        goalTokens.add(word)
        goalTokens.add(singular(word))
    }
    const hasToken = (token: string) => goalTokens.has(token) || goalTokens.has(singular(token))

    let best: TemplateMatch | null = null

    for (const template of STACK_TEMPLATES) {
        const phrase = template.phrases.find(p => normalized.includes(` ${p} `) || normalized.includes(p))
        if (phrase) {
            // Phrase hits are decisive; first one wins, and templates are
            // ordered so the more specific families come first.
            if (!best || best.score < 10) best = { template, score: 10, matchedOn: phrase }
            continue
        }

        const hits = template.tokens.filter(hasToken)
        if (hits.length >= MIN_TOKEN_HITS && (!best || hits.length > best.score)) {
            best = { template, score: hits.length, matchedOn: hits.join("+") }
        }
    }

    return best
}
