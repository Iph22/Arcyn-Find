/**
 * Classify a catalog entry by the content it produces.
 *
 * WHY THIS IS A FUNCTION AND NOT A COLUMN
 *
 * A column would have to be backfilled, and every tool ingested after the
 * backfill would arrive unrated. The ingest adds ~25 products a day from
 * GitHub topic searches with no human in the loop, so an unrated default of
 * "general" fails OPEN -- the one failure mode that matters here is a tool
 * nobody classified going straight into the sitemap.
 *
 * Applied at read time instead, every row is rated on every read, including
 * rows that did not exist when this was written. That is the whole point.
 *
 * A column may still be worth adding later for operator review and for
 * overriding this function's verdict in either direction. It would supplement
 * this, not replace it.
 *
 * THE THREE RATINGS
 *
 *   general     no restriction
 *   adult       sexual content. Kept out of the index and the sitemap.
 *   prohibited  tools whose stated purpose is producing sexual imagery of a
 *               person who did not take part -- "undress", "nudify", sexual
 *               deepfakes. Removed from the public site entirely.
 *
 * `prohibited` is separated from `adult` deliberately. It is a different
 * category of thing, not a more extreme point on the same scale: the subject
 * of the output has not consented to it. Legislation treats it separately too
 * (the US TAKE IT DOWN Act 2025, the UK Online Safety Act's intimate-image
 * offences, and NCII statutes in many US states), and so do app stores and
 * payment processors. Directory listings are not the same as hosting, but the
 * cheapest correct answer is not to carry them.
 *
 * THE FAILURE THIS GUARDS AGAINST MOST
 *
 * Not false negatives -- false POSITIVES. A tool that *detects* NSFW imagery
 * is a moderation tool, and is exactly the kind of thing a directory should
 * list. `Is This Image NSFW?` is in this catalog and is a classifier, not a
 * generator. Matching on "nsfw" alone would delist safety tooling while
 * leaving the actual generators untouched if they happened to be worded
 * differently. So generation intent has to be established, not assumed.
 */

/** Anything with a name, blurb and tags. Deliberately structural so callers
 *  holding raw search rows can apply the identical rating. */
export interface RatableTool {
  name: string
  rawDescription: string
  tags: string[]
}

export type ContentRating = 'general' | 'adult' | 'prohibited'

/**
 * Producing sexual imagery of a real person without their participation.
 *
 * These phrases describe the mechanism, not a vibe: taking existing clothing
 * off a picture of somebody, or grafting a face onto sexual material. Every
 * one of them is drawn from wording already present in this catalog -- the
 * tags on these rows literally read `clothing removal`, `undressing images`
 * and `deep-fake-nude-generator`.
 */
const PROHIBITED = [
  // Prefix-matched, not whole-word. These stems are compounded into product
  // names -- `Undressbaby AI` and `Nudifyer` are both in this catalog, and a
  // trailing \b misses every one of them. No innocent English word starts
  // "undress" or "nudif".
  /\bnudif/,
  /\bundress/,
  /\bdeep\s?nude/,
  /\bdeep[-\s]?fake[-\s]?nude/,
  /\bnude[-\s]?generator\b/,
  /\bnude\s+(?:image|photo|picture|art)\s+generator\b/,
  /\b(?:remove|removing|removal\s+of)\s+(?:the\s+)?cloth(?:es|ing)\b/,
  /\bcloth(?:es|ing)\s+removal\b/,
  /\bx-?ray\s+(?:clothes|clothing)\b/,
]

/** Sexual content generally. Legal to list; simply not something to put in a
 *  sitemap, because Google classifies domains, not pages. */
const ADULT = [
  /\bporn(?:o|ographic|ography)?\b/,
  /\bhentai\b/,
  /\bnsfw\b/,
  /\bnudes?\b/,
  /\berotic(?:a)?\b/,
  /\bsexting\b/,
  /\bsex\s?(?:chat|bot|ting)\b/,
  /\b18\s?\+/,
  /\bxxx\b/,
  /\bcam\s?girl\b/,
  /\bonlyfans\b/,
  /\bescorts?\b/,
  /\bai\s+(?:girl|boy)friend\b/,
  /\b(?:girl|boy)friend\s+(?:simulator|chatbot|ai)\b/,
  /\bwaifu\b/,
  /\badult\s+(?:content|entertainment|imagery|videos?|images?)\b/,
  /\bexplicit\s+(?:content|imagery|images?|material)\b/,
]

/**
 * Wording that means the tool ACTS ON this material rather than making it.
 *
 * Detection, moderation, filtering and compliance tooling is the legitimate
 * half of this vocabulary and has to survive. A match here only rescues a row
 * when there is no competing evidence of generation -- see `rateContent`.
 */
const DEFENSIVE = [
  /\bdetect(?:s|or|ing|ion)?\b/,
  /\bclassif(?:y|ier|ies|ication)\b/,
  /\bmoderat(?:e|es|ing|ion|or)\b/,
  /\bfilter(?:s|ing)?\b/,
  /\bblock(?:s|ing|er)?\b/,
  /\bflag(?:s|ging)?\b/,
  /\bscan(?:s|ning|ner)?\b/,
  /\bidentif(?:y|ies|ication)\b/,
  /\brecogni[sz](?:e|es|ing|tion)\b/,
  /\bsafe(?:ty|guard)\b/,
  /\bcompliance\b/,
  /\bguardrails?\b/,
  /\bparental\s+control\b/,
  /\bis\s+this\b/,
]

/** Wording that means the tool MAKES the material. Outweighs DEFENSIVE. */
const GENERATIVE = [
  /\bgenerat(?:e|es|or|ing|ion)\b/,
  /\bcreat(?:e|es|or|ing|ion)\b/,
  /\bmak(?:e|es|ing|er)\b/,
  /\bproduc(?:e|es|ing|tion)\b/,
  /\bdraw(?:s|ing)?\b/,
  /\brender(?:s|ing)?\b/,
  /\bsynthesi[sz](?:e|es|ing)\b/,
  /\bwrit(?:e|es|ing|er)\b/,
  /\brole\s?play(?:ing)?\b/,
  /\bchat\s+with\b/,
  /\bcompanion\b/,
]

const matches = (patterns: RegExp[], text: string) => patterns.some((p) => p.test(text))

/**
 * A tag that is a source-site category slug rather than a property of the tool.
 *
 * MEASURED, because getting this wrong delists working products. The scraper
 * appends the category slug of whatever directory or GitHub topic a tool came
 * from. On 2026-09-23, across 15,255 rows with tags:
 *
 *   last tag is kebab-case       7,101  (46.5%)
 *   most common ones             ai-agent (1,103), machine-learning (787),
 *                                ai-tools (718), artificial-intelligence (458)
 *
 * Those are topic slugs, not descriptions of a product. The same mechanism
 * stamps `nsfw-chatbot` onto Tiledesk (a customer-support chatbot),
 * `deep-fake-nude-generator` onto DeepFaceLab (open-source face-swap research)
 * and `nsfw-image-generator` onto Deep Dream Generator (a mainstream image
 * model). Rating on those tags deindexes all three and catches nothing real:
 * of 27 rows tagged `nsfw-chatbot`, only 10 had any adult signal in their own
 * name or description.
 *
 * Genuine descriptive tags in this corpus are natural language -- `NSFW chats`,
 * `AI Nudes`, `undressing images` -- so shape separates them cleanly. Position
 * does not: 26.9% of kebab tags are not last.
 */
const isCategorySlug = (tag: string) => /^[a-z0-9]+(-[a-z0-9]+)+$/.test(tag.trim())

/**
 * The text a rating is decided on: name, description, and the tags that say
 * something about the tool rather than about where it was scraped from.
 */
function ratableText(tool: RatableTool): string {
  const meaningfulTags = (tool.tags ?? []).filter((t) => !isCategorySlug(t))
  return [tool.name, tool.rawDescription, ...meaningfulTags].join(' \n ').toLowerCase()
}

export function rateContent(tool: RatableTool): ContentRating {
  const text = ratableText(tool)

  // Non-consensual imagery first: these phrases are specific enough that a
  // match is the answer regardless of anything else in the text. A tool that
  // detects nudified images would have to say so in words that do not include
  // "undress the photo", and none in this catalog do.
  if (matches(PROHIBITED, text)) {
    // One exception, and it has to be narrow: research and detection work on
    // this exact problem describes it using the same nouns. Require explicit
    // defensive framing AND no generative framing at all.
    if (matches(DEFENSIVE, text) && !matches(GENERATIVE, text)) return 'adult'
    return 'prohibited'
  }

  if (matches(ADULT, text)) {
    // `Is This Image NSFW?` lands here: defensive wording, nothing generative.
    if (matches(DEFENSIVE, text) && !matches(GENERATIVE, text)) return 'general'
    return 'adult'
  }

  return 'general'
}

/** Safe to show anywhere on the public site. */
export function isPubliclyListable(tool: RatableTool): boolean {
  return rateContent(tool) !== 'prohibited'
}

/** Safe to put in front of a search engine. */
export function isSearchEngineSafe(tool: RatableTool): boolean {
  return rateContent(tool) === 'general'
}
