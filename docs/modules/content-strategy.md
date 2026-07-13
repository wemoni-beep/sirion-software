# Content Strategy (nav id `m6v3`) — Article Production Pipeline

**Purpose.** Content Strategy is Xtrusio's article production module for the Sirion campaign. It turns AI-perception gaps (queries where Sirion is absent/weak in ChatGPT/Gemini/Claude/Perplexity answers) into channel-aware "win-back plans", writes the articles in-app with a multi-provider LLM fallback chain, runs them through an editorial-health scorer and AI fix loop, sends them to a client review portal for approval, and finally pushes approved pieces to Link Strategy (M7) for placement — with spinoffs into Medium supportive pieces, press releases, LinkedIn posts, YouTube scripts, and full video projects.

Nav entry: `{id:"m6v3", n:"6", label:"Content Strategy", path:"/content"}` (hash routes `/content`, plus legacy aliases `/content-v2` and `/content-v3` → `m6v3`). Module title constant: `m6v3:"Content Strategy"`.

---

## Two generations in the bundle

| Generation | Chunk | Routed? | Workflow |
|---|---|---|---|
| **M6 v1 (legacy)** | `sirion/assets/ContentStrategy-DPvoh8Wv.js` (132 KB) | **No** — `React.lazy(()=>import("./ContentStrategy-DPvoh8Wv.js"))` exists in `index-BZaWgRns.js` but is never assigned to a route variable. Writes to `pipeline.m6`. | **Copy-paste**: builds giant prompts, copies them to the clipboard, the operator pastes them into an external LLM (ChatGPT etc.), then pastes the AI output back into the app, which parses it. Stages: Topics → Journalist Pack → Full Article → Humanize → Transfer to Link Strategy. |
| **m6v3 (current)** | `sirion/assets/index-BdFOWPPW.js` (~835 KB; component `cI`, lazy `TA` in the shell) + store `sirion/assets/useM6V3Store-DWIdWJng.js` | **Yes** — this is what the `m6v3` nav id renders. Writes to `pipeline.m6v3`. | **In-app generation**: all LLM calls go through the Xtrusio proxy worker (`https://xtrusio-ai.thedevimapro.workers.dev/api/ai/chat`) via `claudeApi-DNyhT86p.js`. No copy-paste anywhere in the current flow. |

An intermediate `m6v2` state slice also exists in the pipeline defaults (same shape minus templates/versions); Link Strategy reads `m6v3` articles with `m6v2` as fallback.

---

## How it works — the m6v3 pipeline, stage by stage

### Stage 0 — Inputs
- **Perception gaps** come from M2 (Perception Monitor): Firestore collections `m2_content_gaps` (queried by `firstSeenScan`/`lastSeenScan`/`scanId`) and `m2_scan_results` (per-qid LLM answers), plus `pipeline.m2.contentStrategyPayload.contentGaps`. Each gap has `qid`, `topic/query`, `severity`, `lifecycle`, `frequency`, `personas`, `stages`, `businessValue`; the module computes `contentPriority` (0–100) from severity×frequency (weight), narrative direction, persona reach, stage breadth, and business value.
- **Question bank** (M1) and **authority data** (M3) feed the *legacy* topic generators only.
- **Sirion Knowledge Base (KB)**: an in-module Firecrawl crawl of the client domain (`callFirecrawlMap` `/api/firecrawl-map` + `callFirecrawl` `/api/scrape`). Modes `curated` (default, ~50–200 pages: `/blog/*`, `/platform/`, `/customers/*`, `/solutions/`, `/use-cases/`, …), `permissive`, `full`; page cap default 400 (up to 3000). Entries `{url,title,h1,headings[≤12],excerpt[≤4000],description[≤280],tags[≤12],wordCount,crawledAt}`. Used for RAG-style URL whitelisting so the AI never invents a sirion.ai URL.
- **Sirion URL crawl** (`sirionUrlCrawl.urls`) — a flat URL whitelist, also used to validate/strip hallucinated Sirion links.

### Stage 1 — Perception Gaps tab → Win-back plans (topic generation)
Tab "Perception Gaps" (`sE`, phase 1C). Per gap the module computes a recommended **play** (`jc`):
- lifecycle `postsig` (direction "reduce") → **monitor only** ("Post-signature — don't amplify. Displace with full-stack content…")
- gap query mentions Sirion or a competitor → **branded**: `client-blog` piece, plus `pr` if urgent (`contentPriority ≥ 70` or severity critical/absent)
- otherwise → **third-party** editorial piece ("earn the citation … a branded post won't get cited").

Selecting gaps and clicking **"Create win-back plans (N)"** runs `ZA → generateWinbackPlans`:
1. `VA` fetches the gap's real AI answers from `m2_scan_results` (per LLM: mentioned?, `full_response` ≤1800 chars) and competitor URLs that won the citation.
2. Builds the **Win-Back / Revival Plan prompt** (`JA` system + `QA` user — verbatim in the prompts doc) requesting strict JSON with `rationale`, `microQuestions[]` (q/why/tentativeAnswer), `contentGaps[]`, `tentativeArticle`, `updateDecision` (update|create|redirect + targetUrl), `wheelPlan[]` (per-channel angles for LinkedIn/YouTube/Medium/PR/Third-party), and `pieces[]` (exactly one title+angleHook per recommended channel, with strict per-channel title-shape rules).
3. Providers: **Gemini 2.5 Flash** (`gemini-2.5-flash`, maxTokens 6000) → fallback **Claude** (`claude-sonnet-5` with web_search).
4. A **"Win-back plan preview"** modal (`tE`) lets the operator edit titles, untick pieces, then **"Approve & write N articles"** (`or`): each piece becomes (or updates) a **topic** (`status:"candidate"`, first piece carries the revival cluster: `isRevivalCluster`, `microQuestions`, `contentGaps`, `tentativeArticle`, `updateDecision`, `wheelPlan`, `takenByUrls`) and is immediately **seeded as an article stub** via `eE`: `status:"needs-revision"`, `source:"topic-seeded"`, body = a topic-brief placeholder ("(Topic brief — click Apply AI Revision below to generate the full article.)" plus format/angle/persona/lifecycle/qids/gaps), and `importComments` pre-filled with a full writing instruction (FAQ vs narrative variant, ~800 vs ~1500 words). PR pieces get `parentArticleId` pointing at the first FAQ/narrative piece.
5. The actual article text is then produced by clicking **Apply AI revision** in the editor (Stage 3) — the pre-filled `importComments` acts as the "feedback".

There is also a lighter task `suggest-topics-from-gaps` in the prompt registry ("Propose 5–8 article topics …") and a **closed-loop rollup** ("In Progress" tab, `bE`): per qid, topics+articles are aggregated into `open / in-progress / closed` (closed when `publishedCount >= plannedPieces`, default threshold 3).

### Stage 2 — Import path (alternative article source)
"Import existing articles" modal (`ix`): drag-drop `.docx/.txt/.md` (mammoth `extractRawText`), title inferred, `Sources`/`Sirion Backlinks` trailing sections parsed out (`Ih`) into `lastCitations`/`lastSirionBacklinks`. Optionally paste the client's feedback email; matching is filename-based (`rx`) first, then AI (`nx`, Claude Fast) which returns `{matches:[{idx,feedback,rejected}]}`. Import status per article: feedback → `needs-revision`, rejected phrases ("not aligned", "hard reject", …) → `imported-rejected`, else `imported-pending` (`importVerdict`: `needs-revision` | `rejected` | `approved-as-is`).

### Stage 3 — Article editor + AI revision (the writing engine)
Editor `dA`. Key panel: **Client feedback** textarea + **"Apply AI revision"** → `Bx` builds the `rewrite-with-feedback` prompt via `Bh` (see prompt assembly below) and calls the provider chain:

1. **OpenAI first** only if the campaign's `aiModel` is a GPT value (default per campaign is `"gpt-5.2"`, which maps to actual model `gpt-4o` via `Io()`; picker labels: GPT-5.2 / Gemini 2.5 Flash / Grok / Claude Sonnet 5).
2. **Gemini** `gemini-2.5-flash` with `{google_search:{}}` tool, maxTokens 32768.
3. **Perplexity** `sonar` (16000).
4. **Grok** `grok-4-latest` (16000, live-search mode auto).
5. **Claude** `claude-sonnet-5` with `web_search_20250305` tool (8000/16000).

First provider that returns a parsable body wins; `providerUsed` + `fallback` reason are stored and surfaced as the **provider badge** (`mA`): green "Gemini 2.5" or purple "Claude", tooltip literally "Wrote by Gemini 2.5 / Claude with web search"; if all four fail, a combined error lists each provider's failure. Every response is post-processed by `yt(...)`: strict JSON parse, external links stripped/verified, non-whitelisted sirion.ai URLs dropped (`droppedSirionUrls`), salvage path for prose-only Gemini output. Accepting the rewrite snapshots `pre-revision-snapshot` + `ai-rewrite` versions and sets the article to `ready-for-client`.

**Prompt assembly (`Bh`)** — every generation/revision call builds `system` as: role line (per task) + optional **writing style template** block (label, "inspired by", word count, `prompt.systemPrompt`, BANNED WORDS list, PREFERRED LANGUAGE list, TEMPLATE CITATION RULES) + `## HOUSE STYLE RULES` (active style rules filtered by scope client/campaign/track) + `## CAMPAIGN CONTEXT` + `## SIRION KNOWLEDGE BASE — VERIFIED PAGES` (top-25 keyword-scored KB entries with URL/Anchor/Tags/Quote, built by `Ax`) + `## SIRION URL WHITELIST — STRICT` (category-grouped markdown list from seed URLs + crawl, built by store export `w`) + `## TASK`. The `user` message is the task-specific block.

**Style rules**: extracted from sample content with a dedicated Claude Fast prompt (`Gy`, returns `{rules:[{rule,scope,category}]}`, 8–15 rules) or added manually; scope `client`/`campaign`/`track`; status `active`/`archived`. Applied to *every* AI call.

**Writing templates** (`Ua`, 12 shipped defaults; customizable in the Templates admin view, overrides stored in `templates`): surfaces `client-blog` / `pr` / `journalist-blog` / `medium` / `social`; writer styles The Strategist / The Pragmatist / The Reporter / The Analyst; article types thought-leadership, analysis, comparison, listicle, news, industry-problem, faq, pr, medium, social-post, social-script. Third-party templates share the `Pr` "ABSOLUTE RULES" block (never name the 21 listed competitors; exactly one "As per Sirion, …" paragraph with one whitelisted inline link; no Key-Takeaways boxes; banned marketing words; no exclamation marks; title is FINAL).

### Stage 4 — Article health score + Fix with AI
`kb` scores the body 0–100 across four pillars (weights per format `Qc`): **Perception Shift** (article: .40 / medium+pr: .15) — lifecycle lean ≥65% pre-sig/full-stack vocab per brand profile `Ri`, full-stack signal, 1–3 brand mentions; **Editorial Quality** (.25/.35) — banned words, competitor names, exclamation marks; **Citation Health** (.20/.30) — Sirion-only links, 2–3 whitelisted backlinks, no hallucinated URLs; **Reader Experience** (.15/.20) — word count 1200–1800, H2 cadence 200–350 words, paragraph length.

Two fixers:
- **Deterministic auto-fix** (`cb`, "Fix with AI" button): bare-URL→anchor, listicle heading bolding, banned-word swaps (`lb` substitution map), exclamation→period, redirect-URL strip (`vertexaisearch`, `google.com/url?`…), external-link strip (Sirion-only policy), then `Jc` embeds unplaced Sirion backlinks by finding anchor phrases in the body. Snapshots `pre-autofix-snapshot`/`auto-fix`; logs `FIX_WITH_AI`.
- **Per-pillar AI fix** (`Px` → tasks `fix-perception-shift`, `fix-editorial-quality`, `fix-citation-health`, `fix-reader-experience`): surgical rewrite prompts with hard constraints (preserve title exactly, ±5% word count, preserve headings/paragraph order); same 4/5-provider chain as revisions; snapshots `pre-pillar-fix-<pillar>` / `pillar-fix-<pillar>`.

### Stage 5 — Client review & approval
See `docs/modules/article-workflow.md` (statuses, portal, versions).

### Stage 6 — Push to Link Strategy (M7)
Approved anchor articles get **"Push to Link Strategy"**: article → `status:"pushed-to-link-strategy"` + `pushedToLinkStrategyAt`, and a parked assignment is written into `pipeline.m7v3.assignments[articleId]` (exact object in article-workflow.md). Medium/PR children have their own push (status only); LinkedIn/YouTube posts push to Social Amplification by flagging `pushedToM7:true` in the `m8_social` store. M7 later writes back `status:"published"` + `publishStatus:{state:"published",url,publishedAt,domain}` into `m6v3.articles` (and mirrors to `m6v2`).

---

## UI structure (m6v3, component `cI`)

- **Campaign picker** (config from `campaigns-gnROApsc.js`; single campaign `sirion_perception_shift_2026`, `showTracks:false`, tracks fullstack ↑ / presig ↑ / postsig ↓ `writeArticles:false`, `byline:""`, company "Sirion", monthly placement budget DA60+ ×1, DA40–59 ×5) → campaign description block → view tabs.
- **View tabs** (`ME`): `gaps` "Perception Gaps" (phase 1C, hidden from client) · `inprogress` "In Progress" (hidden from client) · `articles` "Articles" (phase 1B, hidden from client) · `review` "Client Review" · `approved` "Approved"; plus a dashed **Templates** admin tab (template editor + Knowledge Base crawler + URL whitelist). Client-portal sessions (`role === "client_portal"`) are forced to `review`/`approved` only.
- **Articles tab** (`mx`): filters Status / Channel (Blog=faq, PR, Third-party=narrative, Medium) / Stage (fullstack/presig/postsig); cards or table view (persisted in `localStorage.m6v3_articles_view`); "+ Sample articles" seeds two `ready-for-client` samples (`byline:"Sample · Xtrusio"`, `isSample:true`); "Show rejected" toggle; unmatched-article repair runs the `hx` Gemini prompt mapping titles → tracked qids.
- **Article editor** (`dA`): title/body inline editing (locked when approved), studio channel tabs **Article / LinkedIn / YouTube / Medium / PR** (YouTube gated by `yt_script`/`yt_video` permissions), style-template + AI-model picker, target-query panel (`tp`), health score panel (`ep`), client feedback + Apply AI revision, Export (Copy as text / Download .docx / Upload edited version), Workflow panel (Push to client portal / Mark approved / Unlock / Push to Link Strategy), version history, delete.

Legacy v1 UI (unrouted): header "Module 6 / Content Strategy / Topics → Journalist Pack → Full Article → Link Strategy", stat cards (Topics, Packs Ready, Articles Ready, Transferred, Avg Score), month/tag filters, tabs **topics / pack / articles / perception-gaps**, prompt modal ("Copy to Clipboard" → "Next: Paste AI Output →") and paste modal ("Parse & Save"), per-article Humanize + .docx download + Transfer.

---

## Data model

### Article (in `m6v3.articles[id]`)
| Field | Notes |
|---|---|
| `id` | `art_<ts>_<rand>` (`R`/`Tg` id maker) |
| `campaignId`, `trackId` | scoping |
| `title`, `body` | body is Markdown; offloaded to the storage bucket (`bodyInBucket:true` strips it from the Firestore pipeline doc) |
| `status` | see article-workflow.md status enum |
| `source` | `imported` \| `ai-generated` \| `manual` \| `topic-seeded` (labels: Imported / AI-written / Manual) |
| `contentFormat` | `faq` (Client Blog) \| `pr` \| `narrative` (Third-party) \| `medium`; normalizer `an()` defaults to `narrative` |
| `byline` | from campaign config |
| `wordCount`, `backlinkCount` | derived |
| `lastCitations[]` | `{title,url,isSirion:false}` external citations (largely deprecated — Sirion-only link policy) |
| `lastSirionBacklinks[]` | `{anchorText,url,embedded:true}` |
| `lastSources[]` | merged citations+backlinks for export |
| `lastChangeLog[]` | `{concern,original,rewrite}` from AI rewrites |
| `lastProviderUsed` | `openai`/`gemini`/`perplexity`/`grok`/`claude` |
| `sourceTopicId`, `parentArticleId` | topic lineage; Medium/PR children point at the anchor |
| `addressedQids[]`, `qidSource` | target queries; `qidSource`: `topic`/`manual`/`repair`/`unmatched` |
| `templateId` | writing template used |
| `revisions[]` (legacy), `clientComments[]` | embedded history (revisions now stripped by the persistence manager in favor of `articleVersions`) |
| `importComments`, `importNotes`, `importVerdict`, `importedAt`, `isSample` | import metadata; `importComments` doubles as the pending revision instruction |
| `locked`, `approvedAt`, `approvedBy`, `unlockedAt`, `clientEditedAt`, `rejectedAt` | approval lifecycle |
| `pushedToLinkStrategyAt`, `publishStatus` | M7 handoff/write-back (`publishStatus:{state:"published",url,publishedAt,domain}`) |
| `bodyInBucket`, `createdAt`, `updatedAt` | plumbing |

### Topic (in `m6v3.topics[id]`)
`id` (`topic_…`), `campaignId`, `title`, `status` (`candidate` → `in-article` when seeded; legacy: draft/pack-ready/article-ready/transferred), `proposedAt`, `contentFormat`, `channel` (`client-blog`/`pr`/`third-party`), `angleHook`, `rationale`, `addressesGapIds[]`, `qid`, `addressedQids[]`, `persona`, `lifecycle`, `plannedPieces`, `wordCountTarget` (faq 800 / narrative 1500 / pr 1500), `articleId`, and on the cluster head: `isRevivalCluster`, `microQuestions[{q,why,tentativeAnswer}]`, `contentGaps[]`, `tentativeArticle{title,sections[{heading,points[]}],draftIntro}`, `updateDecision{action,targetUrl,reason}`, `wheelPlan[{channel,angle}]`, `takenByUrls[]`.

### Style rule (`m6v3.styleRules[id]`)
`{id:"rule_…", rule, scope:"client"|"campaign"|"track", category:"tone"|"structure"|"vocabulary"|"formatting"|"argument"|"framing"|"other", status:"active"|"archived", source:"manual"|…, campaignId?, trackId?, addedAt}`.

### Writing template (`m6v3.templates[id]`, overrides shipped `Ua`)
`{id, source:"custom", surface, articleType, writerStyle, channel?, label, inspiredBy, wordCount:{min,max}, defaultForFormat, active, hoverPreview:{voiceDescription, exampleOpener, structureSummary[], avoids[]}, prompt:{systemPrompt, bannedWords[], preferredLanguage[], citationRules}, createdAt, updatedAt}`.

### Article version (`m6v3.articleVersions[articleId][]`)
`{id:"ver_…", source, title, body (offloaded, `bodyInBucket`), citations[], sirionBacklinks[], status, locked?, triggerComment, provider?, createdAt}`. Sources seen: `pre-revision-snapshot`, `ai-rewrite`, `before-restore`, `approved-snapshot`, `pre-upload-edited-snapshot`, `pre-autofix-snapshot`, `auto-fix`, `pre-pillar-fix-<pillar>`, `pillar-fix-<pillar>`.

### Other m6v3 slices
`dismissedGapIds{campaignId:[gapId]}`, `gapMarketDemand{gapId:{…,lastEstimatedAt}}`, `gapDescriptions{gapId:{description,placement,placementReason,manualPlacement,lastEnrichedAt}}`, `lastGapRefresh{campaignId:iso}`, `activeTemplate{campaignId:templateId}`, `aiModel{campaignId:"gpt-5.2"|"gemini-2.5-flash"|"grok"|"claude-sonnet-4"}`, `deletedArticleIds{id:iso}` / `deletedTopicIds{id:iso}` (tombstones for merge), `sirionUrlCrawl{urls[{url,title,lastSeenAt}],urlsInBucket,lastCrawledAt,crawlDomain}`, `sirionKB{entries[],lastCrawledAt,crawlDomain,mapStats}`, `prSettings{campaignId:{spokespersonName,spokespersonTitle,aboutParagraph,mediaContact}}`, `generationId` (Date.now() stamp on every write; used by the pipeline merge logic).

### Social post (`m8_social` store, `useVideoProjects-g_NEwoQk.js`)
`{id:"lpost_…", articleId, qid, query, channel:"linkedin"|"youtube", style, body, status:"stub"|"draft"|"published", pushedToM7:false, pushedAt, publishedUrl, publishedAt, publishedBy, linkedinUrn, indexedGoogle:"no", citedAI:"no", createdAt, updatedAt}`. Channel config: LinkedIn charCap 3000 / template `default-linkedin-post`; YouTube charCap 6000 / `default-youtube-script`.

### Video project (`m7v3_video_projects`, keyed by articleId)
`{articleId, campaignId, title, qids[], presenter:{presenterId}, stages:{script,package,slides,avatar,publish}, shorts{}, createdAt, updatedAt}` — stage order `script → package → slides → avatar → publish` (each `{status:idle|running|done|error, updatedAt, error, …stage payload}`; script has `source:"generated"|"injected"`; slides have archetypes `cluster|converge|flow|contrast|meter`, formats wide 16:9 / tall 9:16; publish has `{url, publishedAt, indexedGoogle, citedAI}`). Presenter/brand config live in the same collection under doc ids `presenter_config` / `brand_config`.

---

## The store — `useM6V3Store-DWIdWJng.js` (hook `me`, imported as `$g`/`u`)

State is the `m6v3` slice of the shared pipeline (`usePipeline().pipeline.m6v3`), normalized by `de()` to the shape above. Every mutation calls `updateModule("m6v3", {...next, generationId: Date.now()})`.

**Returned API** (exact names): `state`, `articles` (tombstone-filtered array), `addArticle`, `addArticles`, `updateArticle`, `deleteArticle`, `addRevision`, `articlesForTrack(campaignId,trackId)`, `articlesForCampaign`, `articleCountsByStatus`, `styleRules`, `addStyleRule`, `addStyleRules`, `updateStyleRule`, `archiveStyleRule`, `activateStyleRule`, `deleteStyleRule`, `dismissedGapIds`, `dismissGap`, `undismissGap`, `gapMarketDemand`, `setGapMarketDemand`, `gapDescriptions`, `setGapDescription`, `setGapManualPlacement`, `lastGapRefresh`, `stampGapRefresh`, `topics`, `addTopics`, `updateTopic`, `deleteTopic`, `topicsForCampaign`, `customTemplates`, `customTemplatesArray`, `saveTemplate`, `deleteTemplate`, `activeTemplate`, `aiModel`, `setActiveTemplate`, `setAiModel`, `prSettings`, `getPrSettings`, `updatePrSettings`, `articleVersions`, `addArticleVersion`, `versionsForArticle`, `restoreArticleVersion`, `approveAndLock(articleId, by="admin")`, `unlockArticle`, `sirionUrlCrawl`, `setSirionCrawl(urls, domain, {mode:"merge"|"replace"})`, `sirionKB`, `setSirionKB(entries, {mode,crawlDomain,mapStats})`, `appendSirionKBEntry`, `clearSirionKB`, `hydrateArticleBody(id)`, `backfillBacklinkCount(id)`, `hydrateArticleVersions(id)`, `hydrateCrawl()`, `bucketScope`.

**Persistence behaviors**
- **Body offloading**: article bodies save to the storage bucket (debounced 2000 ms after body edits) at `articles/{domainKey}/{articleId}.json` as `{body,lastCitations,lastSirionBacklinks,savedAt}`; then `bodyInBucket:true`. `hydrateArticleBody` lazily reloads on open. Versions save to `articles/{domainKey}/{articleId}/v_{versionId}.json`; crawl URL lists to `crawls/{domainKey}.json`. `domainKey` = host lowercased, `www.` stripped, non-alnum → `-`.
- **Bucket scope** = `pipeline._docId` || `sirionKB.crawlDomain`.
- **KB persistence**: Firestore `kb_stores` (one doc per domainKey: `{lastCrawledAt,crawlDomain,mapStats,entryCount,entries:[] (legacy),updatedAt}`) + `kb_entries` (doc id `` `${domainKey}__${url-slug}` ``, batched saves of 20). One-time migrations: legacy `kb_stores.entries` → `kb_entries`; in-pipeline articles/versions/crawl → bucket (console logs `[m6v3] Migrated …`).
- The **PersistenceManager** (in `index-BZaWgRns.js`) strips article bodies, version bodies, KB entries and crawl URL bodies out of the Firestore `pipelines` doc before save (keeping `bodyInBucket`/`urlsInBucket` markers), and merges m6v3 by dedicated merge fn `Id` on localStorage↔Firebase conflict.
- **Approve/lock**: `approveAndLock` snapshots an `approved-snapshot` version (`locked:true`, triggerComment "Article approved by ${by}") then sets `{status:"approved", locked:true, approvedAt, approvedBy}`. `unlockArticle` sets `{locked:false, status:"client-edited", unlockedAt}`. `restoreArticleVersion` snapshots `before-restore` first.
- **Activity log**: `ARTICLE_CREATED`, `ARTICLES_BULK_CREATED`, `ARTICLE_EDITED` (debounced 60 s per article), `ARTICLE_DELETED`, plus editor-level `FIX_WITH_AI` — all `module:"m6v3"`.

**Exports**: `S` (seed URLs `et`: sirion.ai homepage/platform/library/audit-trail guide), `e` (`_i` extract Sirion backlinks from Markdown), `f` (filter citations to whitelist), `g` (backlinks of article), `i` (`F` isSirionUrl — sirion.com/sirion.ai/sirionlabs.com), `l` (loadArticleBody), `n` (`R`/`Tg` id maker), `s` (strip non-whitelisted Sirion links from body), `u` (the hook), `w` (whitelist prompt block builder, groups seeds+custom by category as `### CATEGORY` + `- [title](url)`).

---

## Storage keys & endpoints (complete list)

| Kind | Key/path | Contents |
|---|---|---|
| Pipeline (Firestore) | collection `pipelines`, doc `_docId` | whole pipeline incl. `m6v3` slice (bodies stripped) |
| Storage bucket | `articles/{domainKey}/{articleId}.json` | article body payload |
| Storage bucket | `articles/{domainKey}/{articleId}/v_{versionId}.json` | version bodies |
| Storage bucket | `crawls/{domainKey}.json` | `{urls[],lastCrawledAt,crawlDomain,savedAt}` |
| Firestore | `kb_stores` / `kb_entries` | KB metadata / per-page entries |
| Firestore | `m8_social` (doc per pipeline `_docId`) | `{posts:{id:post}, updatedAt}` LinkedIn/YouTube posts (800 ms debounce) |
| Firestore | `m7v3_video_projects` (doc per articleId; + `presenter_config`, `brand_config`) | video projects |
| Firestore (read) | `m2_scan_results`, `m2_content_gaps`, `m2_scan_attempts`, `blog_db` (legacy venue index) | perception inputs |
| localStorage | `m6v3_articles_view`, `m6v3_clientreview_view`, `m6v3_approved_view` | `"table"`/`"cards"` |
| sessionStorage | `xt_m6v3_jump_to_view` | deep-link into a view (e.g. "Plan win-back" from Link Strategy) |
| sessionStorage | `xt_token`, `xt_client` | proxy access token/client id |
| AI proxy | `https://xtrusio-ai.thedevimapro.workers.dev` — `/api/ai/chat` (providers `anthropic`/`openai`/`gemini`/`grok`/`perplexity`), `/api/scrape`, `/api/firecrawl-map` | all LLM + Firecrawl traffic (Bearer `xt_token`) |

Models (from `claudeApi-DNyhT86p.js`): `callClaude` = `claude-sonnet-5` + `web_search_20250305`; `callClaudeFast` = `claude-sonnet-5` no tools; `callClaudeHaiku` = `claude-haiku-4-5-20251001`; `callOpenAI` default `gpt-4o`; `callGemini` default `gemini-2.5-flash`; `callGrok` default `grok-4-latest` (search auto); `callPerplexity` default `sonar`.

---

## Integrations

**In:** M1 question bank (legacy generators); M2 perception scans (gaps, per-LLM answers, visibility dots widget `Pt` showing per-engine cited/not-cited); M3 authority domains (legacy); campaign config chunk; Firecrawl (KB build); Xtrusio AI proxy (all providers).

**Out:** M7 Link Strategy (`m7v3.assignments` parked handoff; M7 reads `m6v3.articles` with statuses `pushed-to-link-strategy`/`published` and writes back `published` + `publishStatus`); Link Strategy → Social Amplification (`m8_social` posts with `pushedToM7:true`; the Social board in `index-Dz3blxfN.js` groups them by channel); Video Studio (`m7v3_video_projects`, produced under Link Strategy → Social Amplification → YouTube); client portal (same module, `role:"client_portal"`); activity log; AI cost metering (`_`/`M`/`j` request-cost hooks around every proxy call).

---

## For AI assistants

- **Which files**: UI + prompts for the live module are all inside `sirion/assets/index-BdFOWPPW.js` (component `cI`, exported default; lazy-loaded as `TA`). Store: `useM6V3Store-DWIdWJng.js`. Social+video stores & visibility widget: `useVideoProjects-g_NEwoQk.js`. LLM transport: `claudeApi-DNyhT86p.js`. Campaign config: `campaigns-gnROApsc.js`. `ContentStrategy-DPvoh8Wv.js` is the **legacy, unrouted** v1 (copy-paste workflow, writes `pipeline.m6`) — don't confuse the two.
- **Articles are generated in-app**, never via copy-paste, in m6v3. Chain: optional OpenAI (gpt-4o, only when campaign `aiModel` is a GPT value; default selection is `"gpt-5.2"` which maps to gpt-4o) → Gemini 2.5 Flash (+google_search) → Perplexity sonar → Grok grok-4-latest → Claude claude-sonnet-5 (+web_search). Medium/PR use a shorter chain (Gemini → Claude → OpenAI-if-short with word-count floors); social uses Gemini → OpenAI raw text; win-back plans use Gemini → Claude.
- **All prompts** are quoted verbatim in `docs/prompts/content-strategy-prompts.md` with code locations.
- **Never let the AI invent sirion.ai URLs** — the whole KB/whitelist mechanism exists for this; post-processing strips non-whitelisted Sirion links and reports `droppedSirionUrls`.
- The **topic → article** handoff is indirect: win-back approval seeds a `needs-revision` stub whose `importComments` contain the writing brief; generation happens on "Apply AI revision".
- **State writes** must go through the store hook so `generationId`, tombstones, bucket offloading and activity logging stay correct; raw `updateModule("m6v3", …)` writes are only done for the m7v3 handoff (which targets a different slice).
- Status semantics, transitions and the exact M7 handoff object are in `docs/modules/article-workflow.md`.
