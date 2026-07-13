# Link Strategy services — Social Amplification, PR Distribution, UGC & Community, Premium Outreach, YouTube Script Creation

## Purpose

The Link Strategy page ("Distribution Engine", chunk `sirion/assets/index-Dz3blxfN.js`) hosts five service tabs. Besides Third-Party Guest Posting (see `link-strategy.md`), four services distribute content through other channels; each is unlocked per client by the permission module ids **`links_social`**, **`links_pr`**, **`links_ugc`**, **`links_premium`** (nav ids with no routes of their own — pure entitlement flags; a locked service shows a marketing card: "🔒 Not on your plan yet — here's what it includes … Every service comes with a dedicated account manager."). The YouTube studios are gated by the sibling flags **`yt_script`** ("YouTube Script Creation") and **`yt_video`** ("Full Video Creation System").

---

## 1. Social Amplification (`links_social`, service id `social`) — $1,500 / month

**Pitch (marketing card):** "Strategist-built posts on LinkedIn, Medium and your own blog — the fastest channel for AI pickup." How: Strategy → Create (5–6 posts per cycle) → Distribute ("your team posts from their own LinkedIn & Medium") → Confirm ("mark each as published with its link; it enters the AI loop"). Excluded: "We don't post as you", "Guaranteed virality", "Buying followers or engagement". Marketing page also sells the bundle: "YouTube + LinkedIn + Medium working as one bundle".

**Live tool** (component `bu`): header "Copy each post, publish it on LinkedIn, then paste the live URL back here. Coverage rolls up to each win-back plan." Empty state: *"Nothing pushed yet. In Content Strategy, open an article, draft LinkedIn posts on the channel tabs, then click "Push to Social Amplification"."*

Channel tabs: **LinkedIn | YouTube | Medium**.

### LinkedIn tab

- Posts are authored in the Content Strategy article editor's **social studio** (chunk `index-BdFOWPPW.js`) — one post per supporting micro-question of the article — and arrive here when **"Push to Social Amplification →"** sets `pushedToM7: true, pushedAt` on every drafted post.
- Storage: Firestore collection **`m8_social`**, one doc per pipeline docId, holding a `posts` map. Post model (factory in `useVideoProjects-g_NEwoQk.js`):

| Field | Type | Meaning |
|---|---|---|
| `id` | `lpost_<ts>_<rand>` | post id |
| `articleId`, `qid`, `query` | string | parent article + the tracked question this post answers |
| `channel` | `linkedin` (default) / `youtube` / `medium` | target channel |
| `style`, `body`, `status` | string | draft content (`status:"stub"` initially) |
| `pushedToM7`, `pushedAt` | bool/ISO | pushed to this tool |
| `publishedUrl`, `publishedAt`, `publishedBy`, `linkedinUrn` | string | live-post confirmation (`markPosted`) |
| `indexedGoogle`, `citedAI` | `"yes"`/`"no"` | manual toggles |

- UI groups posts by parent article, shows the article's target question, and a **"Covered X / Y"** badge (published posts' distinct qids vs the topic's micro-question count). Actions per post: copy body (link auto-appended: body + blank line + article URL), paste live URL + "by" name → **Mark posted**, toggle Indexed/AI-cited. Summary stat cards: Total / Written / … / Indexed / AI-cited + a by-channel bar chart.
- Published posts feed the **citation-check** hook as `kind:"post"` items (the post's question becomes its verification query — see `citation-check.md`).

### Medium tab

Lists Content Strategy articles with `contentFormat:"medium"` (supportive re-angles that link back to the anchor article), grouped by the anchor's question. Copy body → publish on Medium → paste URL → stored via the **m7v3 assignment** path (`setPublished(articleId, "medium.com", url)`), which also flips the article to `published` in Content Strategy. Published Medium pieces also enter citation-check (`kind:"post"`).

### YouTube tab — Video Studio (`yt_video` gate)

If the user lacks the `yt_video` module: "The Video Studio isn't enabled for your account yet — ask your account manager about Full Video Creation." Otherwise this is the **Full Video Creation System**: per selected article a video project runs through **5 stages** — `script → package → slides → avatar → publish` (each with status `idle/running/done/error`). Stored in Firestore collection **`m7v3_video_projects`** (+ config docs `presenter_config`, `brand_config`).

- **Script stage**: LLM turns the published article into a raw voiceover script. System prompt (verbatim, abridged): *"You are a corporate video script writer. You turn ONE published article into a raw voiceover script for a short explainer video (roughly 60 to 90 seconds, 150 to 220 words)… The video must cover EVERY tracked question the user lists, in the order given… Open with one hook sentence naming the topic. Close with this exact CTA sentence: "To learn more, read the full article."… Output ONLY the script text."*
- **Package stage**: second prompt — *"You are a Video Script to HeyGen + Gemini Storyboard + YouTube Citation Package assistant."* — converts the script into exactly four outputs: **1. HeyGen Script** (clean spoken transcript), **2. Gemini Visual Prompt Table** (markdown table Qid | Speaker | Visual Slide Prompt; every prompt starts "Create Slide N of TOTAL. Create a 16:9 black-and-white clean corporate sketch slide…"; every tracked question must be covered by ≥1 row), **3. YouTube Upload Package**, **4. Citation-Readiness Checklist** (metadata that ties the video back to the article for AI citation).
- **Slides stage**: slides JSON → server rendering via worker `POST /api/video/render` (`{jobId, slidesPath, profiles, uploadPrefix}`; slides JSON uploaded to the storage bucket; error hint if `GH_RENDER_TOKEN` missing on the worker). Formats `wide` 16:9 / `tall` 9:16.
- **Avatar stage**: pick provider (**HeyGen** or **Google Veo**), script segmented into clips (words-per-second based; cost estimator returns clips · seconds · $min–max per provider).
- **Publish stage**: `{url, publishedAt, indexedGoogle, citedAI}` — the YouTube URL joins the citation loop.
- The Content Strategy article editor cross-links here: "Open it in the **Video Studio**: **Link Strategy → Social Amplification → YouTube**." Projects are opt-in per article ("nothing is produced until you start a project").

---

## 2. PR Distribution (`links_pr`, service id `pr`) — $5,000 / 5–6 releases

**Pitch:** "Newswire releases across a growing set of wires for authority signals and syndicated reach." Reality copy is deliberately honest: "Newswire pickup is largely **syndication** — your release republished as-is — not earned editorial… Best for announcements, not routine content." How: Draft (client approval mandatory) → Distribute (OpenPR, PR Newswire, Business Wire, EIN Presswire + growing list) → Track pickup → Measure ("AI-citation lift before vs after, feeding the loop").

**Live tool** (`wu`): literally the same pipeline component as guest posting but filtered to `formats:["pr"]` — title "PR Distribution", subtitle "PR pipeline — every release logged, indexed, and matched against your Perception Scans." PR articles are generated in Content Strategy from an anchor article using per-campaign **PR settings** (`prSettings`: `spokespersonName`, `spokespersonTitle`, `aboutParagraph` , `mediaContact`; the generator flags `missingSettings` → "Fill PR settings below — placeholders were used."). Same push → match → publish → citation loop as guest posting.

**Marketing page** (`Su`): "Standard PR Tiers — syndication-based distribution across 230–550 outlets per release": **Starter** $300/release (~230 outlets, 3 premium anchors, max DA 78, 3–5 days) · **Growth** $600 (~231 outlets, 4 anchors, DA 92) · **Pro** $1,200 (recommended; ~155 outlets, **14 cite-worthy anchors incl. Yahoo Finance / AP / Business Insider / MarketWatch / WSJ**, DA 94, "Engineered for AI citation, not raw outlet count") — every tier: "Every live URL logged into the Perception Scan loop". Plus a **Premium PR Service Bundle**: PR Newswire ($1,000) + Business Wire US ($1,000) + 4 Pro releases ($4,800) − $1,800 bundle discount = **$5,000/month** for 6 releases, 6 distinct queries covered, 7 verified anchors, "Loop integration: All URLs to RAG".

---

## 3. UGC & Community (`links_ugc`, service id `ugc`) — from $1,500 / month, status "Rolling out"

**Pitch:** "Account-built, slow-burn presence on strict, community-governed platforms. Reputation, not advertising." How: Build dedicated accounts → **Warm up (4–8 weeks)** ("builds karma/credibility. No promotion yet.") → Engage (relevant threads: r/CLM, r/legaltech, comparison pages) → **Log everything**. Excluded: instant results, fake/incentivized reviews, guaranteed counts, "Anything that risks the account under platform rules". Tiers: Level 1 "Analysis & Setup" $1,500 · Level 2 "Managed Engagement" $2,800 · Level 3 "Multi-platform" Custom.

**Live tool** (lazy chunk `index-CkvyzsQI.js`), tabs: **Roster | Activity log | Compliance | Coverage | Watchlist**. State is local-only: localStorage key **`xtrusio_ugc_team_v1`** (seeded with Sirion demo data on first run).

- **Roster**: accounts — `kind: "reddit_personal"` (`ownerName`, `handle` e.g. `u/priya_clm`, `assignedTo` subreddits, `redditKarma`, `accountAgeMonths`, `standing`, `disclosure:{required,verified}`, `policyAck`) and `kind: "vendor_profile"` (G2/Capterra: `responderName`, `rating`, `reviewCount`, `openQuestions`, `lastResponseAgeDays`). Editable "Assigned subreddits (comma-separated)" / "Assigned surfaces".
- **Activity log**: entries `{accountId, platform, type: post|comment|answer_question|review_response, summary, url, tag: helpful|promotional|vendor_reply|compliance, loggedBy, occurredAt}`.
- **Compliance** rules (constants `k`): promo ratio target **9:1** helpful:promotional, warm-up minimums **200 karma / 2 months**, vendor response SLA **3 days**, coordination detection window **10 minutes** (flags e.g. two accounts sharing "the same Sirion blog link in r/SaaS" minutes apart — "No coordinated patterns detected." when clean), active window 7 days, and policy sign-off tracking ("Some accounts haven't signed the policy.").
- **Coverage**: target surfaces `r/procurement, r/legaltech, r/sysadmin, r/SaaS, r/ITManagers, r/sales, G2 Discussions`.
- **Watchlist** (seeded intelligence): Reddit voices with `stance: advocate|critic|neutral` (e.g. u/LordEgotist "strongest pro-Sirion quote"; u/MillyRockingNrollin "source of the recurring 'needs more implementation partners' knock"); review sites with `claimed/status/action` (Gartner Peer Insights 4.9★ "Already winning"; **Capterra unclaimed — "CLAIM the page, then drive customer reviews. Highest priority."**); places/threads (r/legaltech ~23K, "Thread: Sirion vs Icertis vs Ironclad", …).

---

## 4. Premium Outreach (`links_premium`, service id `premium`) — Custom / engagement, status "Rolling out"

**Marketing card only** (`Tool: null` — no live tool exists yet). Pitch: "Earned, high-authority placements… Forbes, Wikipedia, HBR, TechCrunch." How: Target → Relate (editor/contributor relationships) → Pitch ("track every pitch: sent, read, responded, accepted, declined") → Wikipedia ("worked via a notability checklist and verifiable secondary sources only"). Includes: outreach pipeline by target outlet, editor-relationship CRM, full pitch-funnel tracking, "Wikipedia notability checklist + lead-time forecasting". Explicitly excluded: pay-for-placement, buying a Wikipedia entry, fast turnaround ("cycles run 3–6 months"), guaranteed acceptance. Pricing: monthly retainer + success fees.

---

## 5. YouTube Script Creation (`yt_script`)

`yt_script` is **not a page** — it's the permission flag that unlocks the **script studio** inside the Content Strategy article editor (chunk `index-BdFOWPPW.js`; admins always have it, plus `yt_video` for the full Video Studio). On an article's channel tabs the strategist drafts one **LinkedIn post** and/or **YouTube script** per supporting question, then pushes them to Social Amplification (see §1).

Built-in templates (surface `social`):

- **`default-linkedin-post`** — "LinkedIn Post (Sirion's voice)", 120–220 words. System prompt (verbatim, abridged): *"You write B2B LinkedIn posts for a contract-lifecycle-management (CLM) audience, in Sirion's practitioner voice… ONE LinkedIn feed post, 120-220 words, under 3000 characters. Plain text only… Open with a sharp, specific hook… Make ONE clear point… End with a soft call to read the full article (the link is appended automatically; do not invent a URL). At most 2 hashtags… No exclamation marks, ever. No marketing filler."*
- **`default-youtube-script`** — "YouTube Script (short-form)", articleType `social-script`, channel `youtube`, 350–700 words (~60–120 s). System prompt (verbatim):

> "You write short-form YouTube video scripts for a contract-lifecycle-management (CLM) audience, in Sirion's practitioner voice (Sirion is a full-stack CLM platform spanning pre-signature drafting, negotiation, signature, and post-signature obligation tracking under one data model).
>
> FORMAT — a SPOKEN script, 350-700 words (~60-120 seconds):
> - Start with a [HOOK] line (0-5 seconds) that names the target question's tension and earns the watch.
> - Then 2-3 beats that answer the question in spoken, conversational sentences a presenter can read aloud.
> - Add [B-ROLL] cues in brackets where a visual would land (e.g. "[B-ROLL: a contract repository scrolling]").
> - Optionally suggest one or two [ON-SCREEN TEXT] callouts for the key stat or phrase.
> - End with a [CTA] beat: what to do next, plus a nod to the full article (the link is appended automatically; do not invent a URL).
>
> VOICE:
> - Conversational and tight — write for the ear, not the page. Short sentences.
> - No exclamation marks, no fake urgency, no marketing filler. One concrete example beats three adjectives.
> - Sound like a knowledgeable host explaining it to a peer."

Both templates share a banned-word list (`game-changer, revolutionary, cutting-edge, best-in-class, unlock, leverage, synergy, seamless, robust, delve, in today's, it's worth noting, at the end of the day`) and citation rule "Do not invent URLs. The article link is appended at post time." Example opener shown in the UI: *"[HOOK] If your CLM still stops at signature, you're managing half a contract. Here's the other half."*

The separate **`yt_video`** flag unlocks the downstream Video Studio (see §1 YouTube tab) which turns the article (not the short script) into a HeyGen avatar + slides explainer video.

## For AI assistants

- Service tools all live in `index-Dz3blxfN.js` except UGC (`index-CkvyzsQI.js`, localStorage-only, key `xtrusio_ugc_team_v1`) and the video machinery (`useVideoProjects-g_NEwoQk.js`, Firestore `m7v3_video_projects`).
- Social posts: Firestore `m8_social` (one doc per pipeline, `posts` map, ids `lpost_*`); handoff flag `pushedToM7`. Medium placements reuse `m7v3` assignments with domain hardcoded `medium.com`. All published URLs (LinkedIn, Medium, YouTube, PR, guest) converge on the same citation-check loop (`citation-check.md`).
- PR tool = guest pipeline with `formats:["pr"]`; there is no separate PR data model beyond `prSettings` in `m6v3`.
- Premium Outreach has no code surface — only marketing copy; building its pitch-CRM would be net-new.
- `links_*`, `yt_script`, `yt_video` are entitlement ids checked via `canModule()`; adding a new service means adding to `vt` + the `Cu` tool map + a `links_<id>` module id in the shell's module list.
