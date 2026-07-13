# Reports (nav id `reports`), Executive Summary (nav id `exec`), RichScanReport & report artifacts

**Bundles:**
- `/home/user/sirion-software/sirion/assets/Reports-D922Z8IJ.js` — Reports shell (tabs, scan picker)
- `/home/user/sirion-software/sirion/assets/index-9yLPUex7.js` — Report V6 (Report tab, baseline scans)
- `/home/user/sirion-software/sirion/assets/RichScanReport-De3pSLhF.js` — Report tab for non-baseline scans; also exported for Scan Your Queries
- `/home/user/sirion-software/sirion/assets/index-D24J_F0w.js` + `loadHistory-CPnDOulM.js` — Trajectory tab
- `/home/user/sirion-software/sirion/assets/index-ncWXFWao.js` — Intelligence tab (Priority 35 / All 154 scoping)
- `/home/user/sirion-software/sirion/assets/ExecutiveSummary-Dh7rW8wC.js` (152 KB) — Executive Summary nav module
- `/home/user/sirion-software/sirion/assets/reports-CDHYzssx.js` — `syq_reports` store + publish/unpublish API
- `/home/user/sirion-software/sirion/assets/loadCombined-BGLlSB-M.js`, `snapshotClient-BBUEgP_Y.js`, `scanCatalog-BNhunwfC.js`, `compute-GsiJKaNN.js`, `classifyUrl-BZobdwWM.js`, `citationUrl-BT04I8cM.js` — data loading / classification helpers

## Purpose

These modules are the **client-facing reporting layer** of the Xtrusio AI-perception platform for Sirion. Perception Monitor (M2) and Scan Your Queries produce raw scan data; a scan only appears here once it has been **published**. Reports renders the monthly board report (Report V6 / RichScanReport), the contract KPI Trajectory, and the auto-generated Scan Intelligence briefing. Executive Summary renders a month-over-month trend dashboard (KPIs, share of voice, citations, narrative shifts) across all published report periods.

## The publish flow (how scans become reports)

Implemented in `reports-CDHYzssx.js` around Firestore collection **`syq_reports`**:

1. In **Scan Your Queries** a user creates a *report* (`rep_${Date.now()}_${rand}`) with `{name, company, llms[], qidsByLlm{}, questionMeta{}, scanIds[]}` — errors: "Report name is required.", "Pick at least one LLM for the report."
2. Scan runs add coverage: `qidsByLlm[qid][llm] = scanId`, `questionMeta[qid] = {query, persona, stage}`, scanIds/llms unioned.
3. **Publish** sets `pushedToReports: true, pushedAt` on the `syq_reports` doc **and** stamps every member scan: `m2_scan_meta/{scanId}.published = true`, `.published_by_report_id`, `.published_at`. **Unpublish** reverses both.
4. Report consumers load scan docs via `loadCombined` with `requirePublished: true` — a scan id passes if it is one of the two hard-coded April baselines (`baseline_20260423_1718`, `baseline_20260423_2229`) or its `m2_scan_meta.published === true`. Merge modes: `legacy-order` (baseline scans, keep first) vs `latest-wins` (per-qid newest analysis wins).
5. Empty states everywhere: **"No published scans found. Run a scan in Scan Your Queries and publish it to Reports."** / Executive Summary: "No published reports yet. Publish a scan from the Scan Your Queries tab to populate this view."

The **April scan** is a synthetic always-present report: Reports' catalog group `__group_april_scan` and Executive Summary's `{id:"__report_april", name:"April scan", scanIds:[baseline_20260423_1718, baseline_20260423_2229], publishedAt:"2026-04-23T17:18:00.000Z"}`. Other groups come from `syq_reports` (`__group_syq_{id}`).

## Reports shell (`Reports-D922Z8IJ.js`)

- Header: "Reports — Sirion · perception · trajectory". Hash routing `#/reports/{tab}` with tabs `report` ("Report"), `trajectory` ("Trajectory"), `intelligence` ("Intelligence").
- Scan picker ("Pick a report…" / "Pick a report to view"): lists groups + "Other scans (newest first)" from `m2_scan_meta` (error state: "No scans found in m2_scan_meta."); shows "Scans in report:" and "${n} scans combined". Scope badges per scan: `baseline35`, `baseline154`, `All`.
- Question segments from Firestore **`m2_segments_v6`**; filters `{text, persona, stage, clmStage}`; per-LLM show/hide toggles; scope state defaults to `baseline154`.
- Rendering: **Report tab** → if the selection is a non-baseline scan, shows the picker plus **RichScanReport**; if it is the baseline selection, renders **Report V6** (`index-9yLPUex7.js`). **Trajectory** → `index-D24J_F0w.js`. **Intelligence** → `index-ncWXFWao.js` (receives `scope`, `scopeLabel`, `activeLlms`).

### Report tab — Report V6 (`index-9yLPUex7.js`)

"Report V6 · dynamic scan source · modular sections", numbered sections (1a, 1b, 2b, 2c, …, 5b):

- **Buying-Center Mix** — visibility weighted by buyer bucket: Procurement ("most important audience"), Legal ("second priority"), Other ("secondary stakeholders"). Persona→bucket mapping lives in `loadCombined` (procurement/cpo/supply chain/sourcing → Procurement; legal/general counsel/contract manager/contract analyst → Legal). "This is the number to share with the board · raw visibility (unweighted) is n%."
- **Persona × Stage Coverage** — mention-rate matrix, "cell = mention rate · subscript = mentions / total", grouped by buying-center bucket.
- **AI Visibility Leaderboard** — "Who owns the AI conversation: total citations across all platforms"; per-vendor per-LLM counts, Share of voice, Unique queries, Median rank.
- **Citation Domain Authority** — "Where AI goes to learn: the domains it cites"; per-domain per-LLM cite counts, `✓ Owned` vs `3rd-party` badge; "Source: `analyses[model].cited_sources[]` aggregated"; "3rd-party domains in this list = priority targets for content placement."
- **§ 5b. Lifecycle Triangle · narrative perception** — radar of Pre-Sig / Post-Sig / Full-Stack shares; bold polygon = "All LLMs (aggregate)", faint per-model polygons; denominator = frameable mentions.
- **Loss Patterns** — "Queries where Sirion loses cleanly (absent or rank #4+) while a competitor sits in the top 3 with neutral or positive sentiment"; counts of absent / ranked 4+ / competitor at #1; top 15 by severity; "This list is the immediate content priority."
- **Query Summary** — per-query × per-LLM grid ("✓ = mentioned, ✗ = absent, rank shown"; "Sentiment: P = Positive, N = Negative, A = Neutral/Absent"); STRONG/WEAK/LOST filter; row click opens the raw response.
- **Reconciliation Pyramid** (same component family as Report V2) and **Export HTML** → `${scan}_ReportV6_${yyyymmdd}.html` ("reflects the active filters").

### Report tab — RichScanReport (`RichScanReport-De3pSLhF.js`)

Single-scan report used for any published non-baseline scan (also embedded by Scan Your Queries; supports `SYQ scan` and `combined` sources). Distinctive behaviour:

- Loads `m2_scan_results` / `m2_scan_attempts` by `scan_id` (with `queryByFieldAll` fallback "fell back to full scan").
- **Auto-heal**: detects missing `(question × platform)` cells; banner states `REPORT DATA MISSING`, `⚠ INCOMPLETE — n questions × m platforms · k cells to re-scan` (button "Re-scan missing (n)" → worker re-scan, live "Worker i/n", then "Re-scan complete / Reloading report…"), `✓ COMPLETE`.
- KPI strip identical to Report V2: Visibility / Citation, Share of Voice, Sentiment, Competitive Positioning (`#medianRank`, top-3 %), Lifecycle / Narrative — each with the full formula popover (visibility `mentioned ÷ total_analyses × 100`; SoV `exact_name_in_vendors_ranked / total_vendor_name_occurrences * 100` "Formula (symmetric, locked)"; sentiment over mentioned only; rank buckets 1/2/3/4+/unranked with median + top-3 rate; lifecycle precedence rules). Reconciliation Pyramid — "click to hide how every KPI was calculated".
- Sections: Buying-Center Mix (with plain-language visibility phrases "almost every answer … about half the answers … rarely/never"), Persona × Stage Coverage, AI Visibility Leaderboard, Citation Domain Authority, Lifecycle Triangle, Loss Patterns, Query Summary.
- Query drill-down modal: per-LLM tabs, `TRUNCATED` flag, "Vendors named (n)", "Citations (n)", "Raw response (Stage 1)" ("Raw response not stored for this analysis." for old vintages), "JSON extract" ("Reconstructed from the analyzer's rollup (analyses.…) — same shape Sonnet emitted"), Copy JSON.
- Question filter bar: search, pick-list with segments, LLM toggles, status filter.

### Trajectory tab (`index-D24J_F0w.js` + `loadHistory-CPnDOulM.js`)

"Trajectory v2 · contract scoreboard · predictability curves — The 6 KPIs from the signed contract (section 11.2) plus the Pre-Sig companion target (May 2026), tracked over time, with a projected decay trajectory toward each engagement-end target."

Engagement window `2026-04-06 → 2027-04-06`; quarters are "Engagement-relative — Q1: Apr 6 – Jul 5; Q2: Jul 6 – Oct 5; Q3: Oct 6 – Jan 5, 2027; Q4: Jan 6 – Apr 5, 2027. Matches Appendix A literal numbering." Company config in `loadHistory`: company Sirion; owned domains sirion.com/.ai/sirionlabs.com; top-3 competitors **Ironclad, Icertis, Agiloft**; platforms in scope `claude, gemini, openai, perplexity`.

KPI targets (`kpi_targets` for the 154Q scope / `kpi_targets_35q`):

| KPI key | Direction | 154Q target (Apr 2027) | 35Q target | Measures |
|---|---|---|---|---|
| `narrative_full_stack` | `increasing_qoq` | 65 % | 41 % | % of frameable mentions casting Sirion as full-stack CLM |
| `narrative_pre_sig` | `increasing_qoq` | 20 % | 38 % | companion metric, "Proposed May 2026 — NOT a contract KPI. Baseline 15.9% → 20% target" |
| `narrative_post_sig` | `decreasing_qoq` | 12 % | 12 % | "Decrease — but NOT to zero" |
| `ai_visibility_raw` / `ai_visibility_weighted` | `stable_or_increasing` | 80 % | 61 % | mention rate; weighted = "Procurement 55%, Legal 35%, Other 10% (Ron's framework)" — weighted is the headline |
| `share_of_voice_all_vendors` | `increasing` | 28 % | 17 % | Sirion mentions ÷ all vendor mentions (names normalized, e.g. "Docusign CLM" merges) |
| `share_of_voice_top3` | `increasing` | 60 % | 40 % | Sirion ÷ (Sirion + Ironclad + Icertis + Agiloft) |

April-2026 baseline fallback (`_april_baseline_fallback`, date 2026-04-23) when the baseline scans can't be loaded: 154Q `{fullStack:51.8, preSig:14.8, postSig:19.6, visibilityRaw:67.4, visibilityWeighted:67.4, sovAll:19, sovTop3:43.7}`; 35Q `{fullStack:32.8, preSig:28.4, postSig:19.4, visibilityRaw:51.4, visibilityWeighted:51.4, sovAll:11.2, sovTop3:29.4}`.

UI: "Trend — every published month" ComposedChart per KPI with dashed **Aim-point** target line, **Actual scan** points, "Ramp-up" ReferenceArea; scope toggle `baseline154`/`baseline35`; LLM toggles; **Trajectory snapshot** table ("All KPIs side by side — every published scan, delta against contract direction, year-end target, and remaining gap"; ✓ = moving in contract direction, ⚠ = against). "How to read this dashboard" cards: "Monthly observation, quarterly tracking", "The first 3 months will look flat" (~90-day AI indexing lag), "Targets are aim-points, not guarantees". Table row metric ids: `fullStack / preSig / postSig / visibilityRaw / visibilityWeighted / sovAll / sovTop3`.

### Intelligence tab (`index-ncWXFWao.js`) — the Priority 35 / All 154 scoping system

Header: "Scan Intelligence — What changed since the last scan, why it changed, and what to do about it — generated automatically each scan. Pick a scope; the priority 35-question set leads."

**Scoping:** two question scopes, `baseline35` → labels "Priority set (35 questions)" / pill "Priority 35" / "Priority 35 questions", and `baseline154` → "All questions (154)" / "All 154" / "All 154 questions". The scope selects which qids (from `m2_questions` and the scan history) feed every computation; findings/recommendation ids are namespaced by scope (e.g. `visibility:master:${scope}`, `sov:gainers:${scope}`, `act:${scope}:n`).

**Slide deck** (page/slide modes, "Collapse / expand", "Live numbers" panel with scan + LLM toggles):

1. **Metrics at a glance / "What's happening this month"** — health-metric table with columns Metric / Now / **Count** / Δ% / Δ# / **Read**. The Read column flags *denominator effects*: enum `no-baseline | flat | real-gain | real-loss | denominator-illusion | denominator-drag` with generated copy such as "reads +Xpp, but the underlying count actually fell … a denominator effect, not real growth". Row metrics: Visibility (`mentioned of total answers` — "the one number that never lies", fixed denominator questions × LLMs), Full-Stack, Pre-Sig (pure), Pre-Sig (coverage), Share of Voice (`#rank / uniqueVendors`, podium), Drop-outs, Threats (competitors gaining). "▸ Click a row → the proof … ↗ Click a question → what the AI actually said."
2. **Lifecycle breakdown** — "Pure label · one bucket per answer" vs "Coverage · mentioned at all"; explains absorption ("an answer covering multiple stages is labelled full-stack instead, so pure buckets shrink as the platform story lands"). Keys `full_pure/pre_pure/post_pure/pre_cov (preTouch)/post_cov (postTouch)`.
3. **Competitor watch** — "The 5 competitors moving most since baseline"; table Competitor / Last mo / This mo / Δ base / Top source; click → "How X is winning · the sites feeding the answers they appear in" (citation domains + questions). Vendor keyword list includes sirion, icertis, ironclad, agiloft, docusign, conga, linksquares, juro, malbek, evisort, contractpodai, pandadoc, summize, coupa, jaggaer, cobblestone, concord, gatekeeper, legartis, spellbook, onit, aavenir, nucleus, workday.
4. **Where we lost ground** — citation diff vs baseline: kept / lost / won back; excludes "Gemini grounding-redirect links (the same page re-issued under a new URL each scan, not a true loss)"; "Who filled the space · new competitor citations"; "Case by case · lost pages + who replaced us + which engines we're lost on"; red engine ring = lost on that engine.
5. **Channels you can act on** — citation-channel mix enum: `owned, competitor-owned, pr-wire, review-analyst, linkedin, medium, reddit, youtube, wikipedia, earned-editorial, unresolved, unknown`. Two ranking modes: "SOV-recovery mode this month — visibility is falling, so channels are ranked for speed + low effort. That's why PR is promoted as the instant lever." vs "Steady-growth mode — channels ranked by the best buyback of free + fast + proven momentum." Channel profiles carry cost/speed labels (PR-WIRE "~6–8 wks · ~$1k/release"; LinkedIn "cited ~11 days after publishing"). Outreach targets are crawl-verified publishers only ("Most high-reach domains AI cites here are CLM competitors … pitching them is wasted effort"); deeper lists deferred to the Link Strategy module.
6. **Drop-outs & recoveries** — per-question binary events: `vanished` ("named last scan · gone this scan"), `slipping` ("lost half or more of mentions"), `recovered` ("was gone · back now"); "far more actionable than a headline %".
7. **Action plan** — rule-derived actions with priority (P1 "highest leverage now" / "this quarter" / "optional / if budget"), channel, expected-by date "anchored on the ~60-90 day AI indexing lag", mapped to a "12-piece budget (6 guest + 6 blog)"; "→ Content Strategy" links carry target qids.
8. **Board FAQ — answers ready** — canned Q&A ("Our AI visibility dropped — how bad is it, really?", "Are competitors eating our lunch?", "Is the Pre-Sign decline a real problem, or a measurement quirk?", "What can we actually control here…", "If we invest now, when will the numbers actually move?", "How do we know any of this is real…").
9. **AI brief — for the CMO** — Claude drafts a briefing via `claudeApi` (worker `/api/ai/chat`); system prompt: "senior marketing-analytics consultant writing a briefing for a CMO who must present AI-perception results to their CEO … Use ONLY the findings and recommendations provided. Never invent numbers…".

Findings engine ids (severity enum `critical | warning | positive | info`): `visibility:master`, `visibility:{presig|postsig}-illusion`, `dropout:vanished|slipping|recovered`, `classification:absorption`, `classification:fullstack-up`, `sov:standing`, `sov:movement` (patterns: **double squeeze**, **displacement**, **dilution**), `sov:gainers`, `citation:channel-mix`, `citation:pr-wire`, `citation:owned-standing`, `citation:targets`, `competitor-pr`, plus recommendations `rec:{scope}:n` (types content / measurement "dual-labeling" / competitive head-to-head / PR-wire cadence / targets / ongoing).

## Executive Summary (nav id `exec`, `ExecutiveSummary-Dh7rW8wC.js`)

Month-over-month dashboard across **published reports** (each report = one period): loads `syq_reports` where `pushedToReports === true`, prepends the synthetic `__report_april`, loads docs per report via `loadCombined` (`legacy-order` for April/baselines, `latest-wins` otherwise). Header "Executive Summary — n reports published"; scope pills `154 baseline / 35 baseline / All` (`maxQ` 154/35/null); period picker (select all / individual scans / reset).

Panels (top → bottom):

- **KPI cards** with sparkline trends: `visibility` ("How often you're surfaced"), `preSig` ("Authoring · negotiate · sign"), `postSig` ("Renewals · obligations"), `fullStack` ("End-to-end CLM framing"); sub-modes `Narrative` / `Citations`.
- **How clients see you, stage by stage** — stacked area of stage framing share per month ("Share of mentions framed by each CLM stage. Where the story is moving.").
- **Share of voice: Sirion vs top competitors** — "% of all vendor mentions claimed by each brand, month over month."
- **Citation Share** — "Sirion's slice of every source AI cites": `ownedCites/totalCites` per period, delta in pts.
- **Citation Rank** — "Where Sirion sits among all cited sources": domain leaderboard with rank movement (↑/↓), favicons via `https://www.google.com/s2/favicons?…`; "Deep Dive" modal "Citation Rank · all domains".
- **Citation Categories** — fixed category enum: `owned` (Owned — "Sirion-controlled domains"), `competition` (Competitor — "Known CLM competitor domains"), `institution` (Analyst — "Industry analysts (Gartner, Forrester, IDC)"), `earned` (Earned Media — "Reviews + non-wire news coverage"), `prwire` (PR Wire — "BusinessWire, PR Newswire press releases"), `social` (Social — "LinkedIn, X, YouTube, Reddit, Medium, etc."), `other` (Other — "Sources not yet mapped to a category").
- **Top Citation Domains** — table: Rank / Domain (+subdomain count) / Cited ("Total times this domain was cited") / **Mentioned** ("% of those citations where Sirion was mentioned in the AI answer") / Category / "Change in share, Apr → May" / Trend; search + category filter.
- **Top Citation Pages** — "The most-referenced individual pages in AI answers · n unique URLs"; **Gemini redirect resolution**: `vertexaisearch.cloud.google.com` grounding URLs are resolved to real pages through the worker `POST /api/util/resolve-redirect` with progress toast "Resolving Gemini URLs… i/n", cached in localStorage `xt_vertex_resolve_cache_v1` (cross-tab event `vertex-cache-update`). Page detail drawer: Prompts / Platforms / Personas / Stages that surface the page, citation count timeline (`seen {first} → {last}`), sentiment of citing answers, "Open as page".
- **Narrative Shifts** — "Queries whose dominant CLM stage flipped period-over-period" (needs 2 published periods).
- **Narrative by Platform** — "Each AI's stage-framing bias" (which stage each LLM favors).
- **AI Visibility Leaderboard** — "Who owns the AI conversation in this period": vendor % SoV, citations per platform, total, "Median position in answer".
- **Visibility by Query** — per-question status enum: `strong` ("Strong — Every active LLM mentioned Sirion"), `partial` ("Partial — Some LLMs mentioned Sirion, others didn't"), `lost` ("Lost — No LLM mentioned Sirion"), `no-data` ("No analyses available for this query"); won/lost counters vs prior period ("n won, m lost since {month}"), "Avg Sirion rank in mentioning answers", Shift badge ("Was X in {month}").
- **Narrative by Query** — stage label per question (enum with descriptions: `full_stack`, `pre_signature`, `post_signature`, `unclassified` "wording didn't point to a specific lifecycle stage", `not_mentioned`), SHIFTED badge, stage-vote detail ("Stage vote — {label}: g of f", Consistent/shifted), verdict modal with raw response + citations ("No raw response stored for this verdict (older scan vintage).").
- **Reports in this trend** — footer table: Report / Month / Visibility / Pre-Sig / Post-Sig / Full-Stack / Mentions.

URL classification helpers: `classifyUrl-BZobdwWM.js` maps domains → owned classes (`owned-content` for /blog|/library|/resources, `owned-comparison`, `owned-press`, `owned-corporate`, `owned-direct`) and external classes (`external-analyst` gartner/forrester/idc, `external-review` g2/peerspot/trustradius/capterra…, `external-news` forbes/reuters/businesswire/prnewswire…, `external-competitor` — ~20 CLM competitor domains, `external-other`, `unknown`). `citationUrl-BT04I8cM.js` normalizes URLs (strips tracking params fbclid/gclid/msclkid/igshid etc.; emits `redirect://{host}` placeholders for unresolved redirects).

## Static HTML report artifacts (repo root `/home/user/sirion-software/sirion/`)

- **`gartner_perception_report.html`** (31 KB) — "Sirion — Gartner AI Perception Intelligence Report" / H1 "Gartner Review Crawlability Report": a one-page technical audit of whether Gartner review content about Sirion is crawlable/citable by AI engines.
- **`sirion-xtrusio-audit.html`** (129 KB) — "Xtrusio AEO/GEO Audit | Sirion | AI Visibility Report", thesis headline "AI sees Sirion as post-signature."; sections: Platform Scorecard, AI Visibility Leaderboard, AI Positioning Audit, AI Perception Analysis, The Gemini Gap, AI Topic Authority Map, Methodology, closing "Sirion Is Visible. Now Let's Fix the Perception." — the original static audit deliverable the in-app report views were modeled on.
- **`sirion_pipeline_v2.html`** (42 KB) — "Sirion — Perception Shift Pipeline v2", H1 "Gap → Article → Shift → Verify": a process explainer for how content gaps become articles and verified perception shifts.
- **`Sirion_Perception_ReAudit_Feb_vs_Apr_2026_2.html`** (99 KB) — "Sirion — Perception Re-Audit: Feb vs Apr 2026" ("Feb 22 → Apr 8, 2026: Has Sirion's Post-Signature Bias Shifted?"): before/after re-audit concluding "The Numbers: Negligible Shift in 45 Days" / "The Diagnosis Was Correct. The Treatment Hasn't Started.", with per-model verdicts (ChatGPT "Especially Strong Post-Signature"; Gemini "Balanced Opener, Post-Sig Sources"; Claude "Balanced Full-Lifecycle Framing"; Perplexity "Mostly Balanced, Post-Sig Creep"; Grok "Most Balanced — AI-Native First").

These are standalone, hand-built HTML documents (no app dependency) kept as deliverable snapshots alongside the SPA.

## The `/perception/` sub-site (duplicate deployment)

`/home/user/sirion-software/sirion/perception/` is a **complete second Vite build of the same Xtrusio SPA**, deployed under base path `/sirion/perception/` (title "Xtrusio · Shape How AI Sees Your Brand"). It is an **older build snapshot**: same nav registry (Company Intel, Reports, Executive Summary, Question Generator, Perception Monitor, Scan Your Queries, Authority Ring, …), same module code with different chunk hashes (`PerceptionMonitor-BLdPxZQK.js`, `ExecutiveSummary-DhuNXx0v.js`, `Reports-JXXOQx3k.js`, `RichScanReport-yQTNSlk4.js`, etc.) and a smaller asset set (~52 chunks vs ~100+ in the main build — it predates several newer bundles). It contains its own copies of the four static HTML artifacts and `_headers`. Both `index.html` files carry aggressive no-cache meta tags because "every Vite build emits new chunk hashes … GitHub Pages doesn't honour `_headers` files". Treat it purely as a **duplicate/legacy deployment** of the same app — changes belong in the main build; this folder should be regenerated from the same source or removed.

## Storage keys & integrations summary

| Store | Used by | Purpose |
|---|---|---|
| Firestore `syq_reports` | reports-CDHYzssx / Exec Summary / Scan Your Queries | Report definitions + `pushedToReports` publish flag |
| Firestore `m2_scan_meta` (`published`, `published_by_report_id`, `published_at`) | loadCombined `requirePublished` | Publish gate for all report views |
| Firestore `m2_scan_results` / `m2_scan_attempts` / `m2_questions` / `m2_segments_v6` | all report tabs | Scan data, question text, segments |
| localStorage `xt_vertex_resolve_cache_v1` | Exec Summary | Resolved Gemini grounding URLs |
| localStorage `xt_token` | worker calls | Bearer auth for `https://xtrusio-ai.thedevimapro.workers.dev` (`/api/ai/chat` for AI brief; `/api/util/resolve-redirect`; `/api/scan/*` for RichScanReport re-scan) |
| Hash routes | Reports shell | `#/reports/report`, `#/reports/trajectory`, `#/reports/intelligence` |

Integrations in: Perception Monitor / Scan Your Queries scans (via publish), Claude worker (brief drafting, URL resolution, re-scan). Integrations out: Content Strategy (target qids from Action plan), Link Strategy (outreach lists), self-contained HTML exports.

## For AI assistants

- **Minified bundles** — inspect with python string extraction, never dump whole files. All identifiers above (`pushedToReports`, `baseline35`, `denominator-illusion`, `narrative_full_stack`, `xt_vertex_resolve_cache_v1`) are exact literals from the build.
- The scope pair **Priority 35 / All 154** maps to scope ids `baseline35` / `baseline154` (constants module); the 35Q set is pinned to scan `baseline_20260423_1718`. Any new question set must be threaded through constants, the Reports shell, the Trajectory targets (`kpi_targets` vs `kpi_targets_35q`) and Intelligence scope namespacing.
- **Never** show a percentage without its raw count in these views — the denominator-effect detection (Read column, "the one number that never lies") is a deliberate product principle; changes that drop counts regress the board-facing story.
- The publish gate is the only thing separating internal scans from client-visible reports: `m2_scan_meta.published === true` OR membership in the hard-coded April baseline pair. Deleting `syq_reports` docs silently empties Executive Summary (except the April fallback).
- Contract numbers (KPI targets, Apr-2027 end targets, 55/35/10 persona weights, quarter boundaries) come from the signed contract ("section 11.2", "Appendix A", "Ron's framework") — do not change without a contract change.
- The `/perception/` folder is a stale duplicate build; if asked to "fix the perception site", confirm whether the main build (`/sirion/assets/`) or the legacy sub-site is meant, and prefer regenerating both from source.
