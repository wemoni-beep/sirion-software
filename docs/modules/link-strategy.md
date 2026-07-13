# Link Strategy (Module 7, nav id `links`) — "Distribution Engine"

## Purpose

Link Strategy is where approved content leaves the building. Articles written and approved in **Content Strategy (m6v3)** are "pushed" here, matched by AI against a vetted catalog of guest-posting domains, placed, and tracked — and every live URL that comes back is fed into the **citation-check loop** so Perception Scans can prove whether AI engines (ChatGPT, Gemini, Claude, Perplexity) now cite it. The page presents itself as "Module 7 · Link Strategy — **Distribution Engine**: One content engine across every channel — every link logged and traced back to your AI visibility."

Code: main chunk `sirion/assets/index-Dz3blxfN.js` (lazy-loaded for module id `links`, hash route `/links`). Legacy v2 lives at hidden route `/links-v2` → chunk `index-ByIqH5Ss.js`. Nav registry and routing: `index-BZaWgRns.js` (app shell).

## Page structure

The Link Strategy page shows:

1. **"We close the loop" banner** — 5 steps: `1 Strategy & content → 2 Distribute → 3 Log every URL → 4 Index to RAG → ★ AI cites you` ("Perception Scans surface your matching URLs — efforts paying off"). Badge: "Proof, not promises".
2. **Service tabs** (array `vt`, ids below). Each service is either a **live Tool** or a locked **Marketing card** ("🔒 Not on your plan yet — here's what it includes") depending on entitlement.
3. The active service's Tool or Marketing view.

### The five services (`vt` array)

| id | Name | Status/badge | Price | Tool component |
|---|---|---|---|---|
| `guest` | Third-Party Guest Posting | `active` / "Live tool" | $5,000 / 5 links | Article pipeline + Domain list (this doc) |
| `pr` | PR Distribution | `active` / "Available" | $5,000 / 5–6 releases | Same pipeline filtered to `formats:["pr"]` |
| `social` | Social Amplification | `active` / "Available" | $1,500 / month | Social posts tool (LinkedIn / YouTube / Medium tabs) |
| `ugc` | UGC & Community | `soon` / "Rolling out" | From $1,500 / month | Lazy chunk `index-CkvyzsQI.js` |
| `premium` | Premium Outreach | `soon` / "Rolling out" | Custom | **Marketing card only** (`Tool: null`) |

See `link-strategy-services.md` for the four non-guest services in detail.

### Entitlements

`guest` is always entitled (`yo=["guest"]`). Every other service is unlocked when the signed-in user's role/custom module list grants nav module id **`links_<serviceId>`** — i.e. the sidebar/permission ids `links_social`, `links_pr`, `links_ugc`, `links_premium` exist purely to gate these service tabs (they are in the permission module list `ay` in the shell but have **no route of their own**). Similarly `yt_script` and `yt_video` are permission flags for the YouTube studios (see services doc). Default role access: `super_admin`/`admin` get everything; `client` gets `["intel3","reports","exec","m6v3","links","m3"]`; `client_portal` gets `["m2","m6v2","m6v3","links"]`.

## Guest Posting tool ("M7v3") — the core placement/assignment system

Sub-tabs (`rc`): **Article pipeline** | **Domain list**.

### How articles arrive (handoff from Content Strategy)

- In Content Strategy an article moves through statuses (map `wn` in `index-BdFOWPPW.js`): `imported-pending`, `imported-rejected`, `draft`, `needs-revision`, `revising`, `ready-for-client` / `in-review` ("Client reviewing"), `client-feedback`, `client-edited`, `approved`, **`pushed-to-link-strategy`** ("In Link Strategy", purple), `published`, `rejected`.
- Clicking **Push to Link Strategy** on an approved article sets `status:"pushed-to-link-strategy"`, `pushedToLinkStrategyAt:<ISO>` on the article **and seeds an M7 assignment**:

```js
m7v3.assignments[articleId] = { articleId, status: "parked", candidates: [], warning: null, updatedAt }
```

So **`parked`** = pushed to Link Strategy but not yet matched to any domain. "Unpush" returns the article to `needs-revision` and is available until it's published.
- The pipeline lists every article (from `m6v3.articles`, falling back to `m6v2.articles`) whose status is `pushed-to-link-strategy` or `published`, filtered by content format: guest tool shows `narrative` ("Third-party") + `faq` ("Client blog"); the PR tool instance shows `pr`.

### Assignment lifecycle (status enum)

`parked` → `matched` (AI candidates generated) → `published` (live URL confirmed). There is no other status value; `warning` holds match errors.

### AI matching — two LLM steps

**Step 1 — Article profile extraction** (`extractArticleProfile`, result cached in `m7v3.articleProfiles[articleId]`). System prompt (verbatim):

> "You are an AEO/GEO content analyst. Extract a structured profile from a B2B article about Contract Lifecycle Management (CLM), AI contracting, SaaS, legal tech, or procurement. Return STRICT JSON, no Markdown fences, with exactly these keys: primaryAudience: one of ["General Counsel","CPO","CIO","Legal Ops","Procurement Director","CFO","Mixed"] · lifecycleStage: one of ["Pre-signature","Post-signature","Full Lifecycle","Governance","Mixed"] · coreThemes: array of 3-5 short theme strings · tone: one of ["Executive/strategic","Technical/practitioner","Educational/explainer","Thought leadership"] · embeddedBacklinks: array of { url, anchorText } for any sirion.ai/sirion.com links found · industryVertical: one of ["General enterprise","Legal","Procurement","Finance","Regulated"] OR a "Specific vertical: <name>" string"

User message = title + body truncated to 8,000 chars. Provider fallback chain: `gemini-2.5-flash` → Perplexity `sonar` → Grok → Claude.

**Step 2 — 5-dimension placement scoring** (`matchArticleToDomains`). Candidates = catalog rows with `state === "active"` minus **used domains** (any domain already in `m7v3.publishedRecords` or set as `publishedDomain` on another assignment — saturation control). Gemini is called with the `google_search` tool enabled (model `gemini-2.5-flash`, fallback Perplexity/Grok/Claude). System prompt (verbatim, key parts):

> "You are an AEO/GEO article-domain placement selector for CLM / AI-contracting / legal-tech / procurement / B2B SaaS. Score EACH candidate on five dimensions (total 50):
> audienceScore 0-15 — article's target reader vs domain's actual readership
> editorialScore 0-10 — would it pass an editor's desk without looking forced
> llmScore 0-10 — will publishing here raise the odds LLMs cite Sirion (topic clustering); favor LLM=HIGH
> linkContextScore 0-10 — do embedded Sirion links read editorial vs sponsored
> costScore 0-5 — price tied to fit (cheap+strong=5; >$700 or weak fit=1)
> ANTI-SWAP (hard): Procurement/CPO/CFO articles must NOT go on legal directories or lawyer-news; General Counsel/Legal-Ops articles must NOT go on pure marketing/SEO or fintech. If a candidate violates anti-swap, force total to <10 (Mismatch).
> AUTO-REJECT (score 0 / exclude): wrong geography (outside USA/Europe/India unless article targets it), off-industry (gambling/adult/crypto-trading/sports/food/etc.), dead site, obvious link farm for an authority article.
> Do NOT re-derive clmFit/authority/LLM — those are given. Judge THIS article × THIS domain. Return STRICT JSON, no fences. rationale ≤ 22 words, angleHook ≤ 18 words."

Total-score labels: `>=40 "Perfect Match"`, `>=30 "Strong Match"`, `>=20 "Acceptable Match"`, `>=10 "Weak Match"`, else `"Mismatch"`. The **top 3** scored domains are stored as `assignment.candidates` (with `allScored` discarded), assignment becomes `status:"matched"`, `matchedAt`, `providerUsed`. If nothing scored: `warning:"no eligible domains (all used or archived)"`.

### Tracking & publishing

Table columns per article row: Month · Article · Approached (domains) · Confirmed domain · Live URL · Status (Published/Pending) · Indexed (Google) · AI-cited. Ways to update:

- **Paste tracker text (TSV)** per row — parser `Qo` reads tab-separated columns: col2 = approached domain (deduped list), col3 = published domain, col4 = published URL, col5 = URL status.
- **Upload CSV/XLSX** (matched by article *title*, columns month/approached/confirmed/url/status/indexed/cited) and **Download CSV**.
- **Mark as Published** modal (per candidate "Publish" action or per row): enter the live URL → `setPublished(articleId, domain, url)` which (a) sets assignment `status:"published", publishedDomain, publishedUrl, publishedAt` and (b) writes `m7v3.publishedRecords[articleId] = {domain, url, publishedAt, updatedAt}`, and (c) writes back into Content Strategy: article `status:"published"`, `publishStatus:{state:"published", url, publishedAt, domain}` (in both `m6v3` and `m6v2` if present).
- Toggle pills flip `indexedGoogle` / `citedAI` between `"yes"`/`"no"` (manual bookkeeping; the automated citation columns come from the citation-check hook — see `citation-check.md`).

Every published row (status Published + URL) is handed to the **citation-check hook** (`usePublishedCitations`) as `{id, title, url, publishedAt, originalQid, addressedQids}` — full loop documented in `docs/modules/citation-check.md`. The pipeline header shows the **Published-URL funnel** (Total → Published → Indexed → URL cited) and per-engine "articles whose published URL each engine cited", plus a monthly-impact banner ("**Sirion cited on** N …", "Refresh impact") and per-question rows with a "**Plan win-back**" link that jumps back to Content Strategy (`onNavigate("m6v3")`).

### Domain list tab (guest-posting catalog)

- Bundled catalog: `source: "AEO_GEO_53_Sites_Final_4Tab.xlsx"`, `importedAt: "2026-05-19"`, `schemaVersion: "v3-canonical"`, **53 domains** (31 Active / 22 Archived; tiers: 5× Tier 1, 15× Tier 2, 28× Tier 2.5, 5× Tier 3). Example row: `techbullion.com`, Tier 1, DR 80, `$30`, "Fintech/AI pub, cheapest on list, high DR."
- Catalog row fields (v3-canonical): `domain, url, country, status ("Active"|"Archived"), tier, dr, da, traffic, referringDomains, trafficTrend, topicalFit, llmFriendliness, authoritySignal, articleFit, riskControl, bestUse, recommendedAngle, scoreReason, riskReason, priceUsd`. (The matcher's prompt additionally reads optional `bucket, clmFit, authority, trustRisk, llmCitationValue, bestArticleAngle, state` fields when present — these come from uploaded/enriched catalogs; note the matcher's eligibility filter checks `row.state === "active"`.)
- Views: **active / archived** lists, table or card layout; filters for DA, DR, niche, traffic, country, backlinks, validity, price and free-text search.
- Actions: **Add blog** (domain, url, initial tags), per-domain **notes** and **tags**, **Archive / Restore** (kept in `catalogOverrides.archiveState` per domain `{state:"archived"|"restored", at}` plus legacy `archivedDomains`/`restoredDomains` arrays), **bulk upload** (.xlsx/.xls/.csv/.tsv or paste — merges by domain; "Existing domains not in your input stay untouched. Tags/Notes overwrite in-app values where the cell is non-blank."), CSV export.
- Uploaded catalogs migrate out of the pipeline doc into Firestore collection **`m7v3_catalog`** keyed by pipeline docId: `{catalog:[rows], catalogUploadedAt, updated_at}`; the pipeline doc then keeps `catalog: []` + `catalogInCollection: true`.

## Data model — the `m7v3` pipeline slice

Stored inside the client's pipeline document (Firestore collection **`pipelines`**, mirrored in localStorage; merged on save by `PersistenceManager` with dedicated m7v3 merge rules). Default shape:

```js
m7v3: {
  articleProfiles: {},   // articleId → extracted profile (see below)
  assignments: {},       // articleId → assignment (see below)
  catalogEnrichment: {},  // domain → enrichment blob (written via upsertEnrichments)
  publishedRecords: {},  // articleId → {domain, url, publishedAt, updatedAt}
  catalogOverrides: { addedBlogs: [], notes: {}, tags: {}, archiveState: {}, archivedDomains: [], restoredDomains: [] },
  generationId: null      // bumped Date.now() on every write
}
```

| Assignment field | Type | Meaning |
|---|---|---|
| `articleId` | string | Content Strategy article id |
| `status` | `"parked"` \| `"matched"` \| `"published"` | lifecycle (seeded `parked` on push) |
| `candidates` | array (≤3) | `{domain,url,bucket,dr,priceUsd,trustRisk,llmCitationValue,audienceScore,editorialScore,llmScore,linkContextScore,costScore,totalScore,label,rationale,angleHook}` |
| `warning` | string\|null | matcher warning/error |
| `matchedAt`, `providerUsed` | string | when/which LLM produced candidates |
| `month` | string | plan month label (manual/CSV) |
| `approachedDomains` | string[] | outreach log |
| `publishedDomain`, `publishedUrl`, `publishedAt` | string | confirmed placement |
| `urlStatus` | string | free-text status from tracker |
| `indexedGoogle`, `citedAI` | `"yes"`/`"no"` | manual toggles |

| articleProfile field | Type | Meaning |
|---|---|---|
| `primaryAudience` | enum GC/CPO/CIO/Legal Ops/Procurement Director/CFO/Mixed | target reader |
| `lifecycleStage` | enum Pre-signature/Post-signature/Full Lifecycle/Governance/Mixed | CLM stage |
| `coreThemes` | string[3-5] | themes |
| `tone` | enum (4 values above) | voice |
| `embeddedBacklinks` | `{url,anchorText}[]` | Sirion links found in body |
| `industryVertical` | enum or "Specific vertical: X" | vertical |
| `extractedAt`, `editedByUser` | ISO / bool | provenance |

## Legacy: M7 v2 ("LSv2", hidden route `/links-v2`, chunk `index-ByIqH5Ss.js`)

Older version using the `m7v2` pipeline slice: `{assignments, monthPlans, samples, samplesSeeded, catalogEnrichment, catalogOverrides}`. Features: paste-import of guest-posting domains via LLM ("Extract a list of guest-posting domains from the user's pasted text…"), a catalog **enrichment** run that uses web search per domain ("For each candidate domain, USE WEB SEARCH to read the site… When in doubt → OKAY, not NOT"), "Catalog by AI Citation Strength" histogram, month plans, demo articles ("Remove this demo article from LSv2… reset article status back to 'approved'"). Superseded by M7v3 but still routable.

## Storage & endpoints summary

| Where | What |
|---|---|
| Firestore `pipelines/{docId}` → `m7v3` | assignments, profiles, publishedRecords, overrides (localStorage-mirrored) |
| Firestore `m7v3_catalog/{pipelineDocId}` | uploaded domain catalog rows |
| Firestore `user_segments` | "Published Articles — Citation Check" query segment (see citation-check doc) |
| Firestore `m2_scan_results`, `m2_scan_meta`, `m2_impact_summary` | scan answers consumed by the citation hook |
| Worker `https://xtrusio-ai.thedevimapro.workers.dev` `POST /api/ai/chat` | all LLM calls (`{provider, body}`, Bearer token from sessionStorage `xt_token`; providers gemini/perplexity/grok/claude) |

## Integrations

- **In:** Content Strategy (m6v3/m6v2) articles with status `pushed-to-link-strategy`; the push also seeds the `parked` assignment. Content gaps (`m2.contentStrategyPayload.contentGaps`) and scanned-query visibility supply each article's tracked question(s).
- **Out:** publishing writes `status:"published"` + `publishStatus` back onto the Content Strategy article; published URLs enter the citation-check loop and its queries are written into the Scan Your Queries segment; "Plan win-back" navigates to `m6v3`.

## For AI assistants

- Module id `links` → chunk `index-Dz3blxfN.js`; default export `ep` renders eyebrow "Module 7 · Link Strategy", services array `vt` (`guest|pr|social|ugc|premium`), tool map `Cu`. Entitlement = `links_<id>` module permission; `guest` always on.
- Guest/PR tool = component `ts` (props `formats`, defaults `["narrative","faq"]`; PR passes `["pr"]`). Sub-tabs: Article pipeline / Domain list.
- Assignment statuses are only `parked` / `matched` / `published`; seeded `parked` by the push handler in `index-BdFOWPPW.js` (Content Strategy article editor).
- Matching = 2 prompts (profile extract + 5-dimension selector, both quoted above), scores out of 50, top-3 candidates persisted; already-used domains excluded.
- All persistent M7 state lives in `pipeline.m7v3` (Firestore `pipelines`) — there is no dedicated assignments collection; only the catalog can live in `m7v3_catalog`.
- Don't confuse the manual `indexedGoogle`/`citedAI` "yes/no" toggles with the automated bullseye/adjacent citation statuses (those are computed, never stored on the assignment).
