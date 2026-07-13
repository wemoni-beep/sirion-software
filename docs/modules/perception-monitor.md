# Perception Monitor (nav id `m2`)

**Bundle:** `/home/user/sirion-software/sirion/assets/PerceptionMonitor-D4DgnIi_.js` (724 KB, largest chunk in the app)
**Route label:** "Perception Monitor" — module "2" in the Xtrusio pipeline (`/perception` path in the module registry)
**Shared deps:** `loadCombined-BGLlSB-M.js`, `snapshotClient-BBUEgP_Y.js`, `constants-BELxrI9x.js`, `narrativeClassifier-UrOyvc-P.js`, `classifyUrl-BZobdwWM.js`, `helpers-BcI-JKAY.js`, `compute-GsiJKaNN.js`, `scanEngine-BVO7e_Tl.js`, `baselineScanner-B4UVyWOc.js`, `claudeApi-DNyhT86p.js`, `scanStats-x9j0rlX6.js`, `excelImport-DXzVN75I.js`

## Purpose

Perception Monitor is the scan-and-score engine of the Xtrusio AI-perception platform built for Sirion (a CLM vendor). It runs buyer-intent CLM questions against five consumer LLMs (Claude, Gemini, ChatGPT, Grok, Perplexity), extracts structured data from every answer (was Sirion mentioned, at what rank, with what sentiment, framed as which contract-lifecycle stage, citing which sources), scores the results into a fixed metric system, and renders a family of report views (Executive Summary, Report V2–V6, Trajectory). Its output — Firestore docs under `m2_scan_*` collections — is the data source for the top-level **Reports** and **Executive Summary** nav modules and feeds Content Strategy (M6) and Authority Ring (M3).

## Sub-tab structure

Internal tab ids (also used in the role/permission map `m2: ["scan","summary","report","reportv2","reportv3","reportv4","reportv5","reportv6","trajectoryv2","trajectory","settings"]`):

| Tab id | Label | Content |
|---|---|---|
| `scan` | Scan & Results | Question bank, Baseline API scan runner, manual paste scan, per-query results, saved views |
| `summary` | Executive Summary | Current-scan exec dashboard (M2-internal, distinct from the top-level `exec` nav module) |
| (reports) | Reports / Perception Reports | Report-section cards per question segment; eligibility gate: full report requires **20+ queries** and **2+ LLM platforms**; PDF download via hidden iframe |
| `reportv2` | Report V2 | Board-ready single-scan view with reconciliation pyramid (built in `loadCombined`) |
| `reportv3` | Report V3 | Combined 35Q/154Q baseline view with Source URL Cloud + Control Architecture |
| `reportv4` | Report V4 | Iteration of V3 (segment filters, Export HTML, reconciliation) |
| `reportv5` | Report V5 | Iteration of V4 (adds locked question-set picker `hard_35q` / `hard_154q`) |
| `reportv6` | Report V6 | Stub only: "Report V6 lives in the top-level Reports section … The M2-internal copy was a legacy duplicate that lost its data pipeline as ReportV6 evolved." Links to `#/reports/report` |
| `trajectoryv2` | Trajectory v2 | Contract scoreboard (also duplicated as the Trajectory tab of top-level Reports) |
| `trajectory` | Trajectory (old) | "Trajectory · 12-month perception roadmap" — Sprint 1–3 panel skeleton, Cause & Effect table ("variance vs base target on every KPI plus … top 5 dominant signals (URL state changes)") |
| `settings` | Settings | Scoring calibration, LLM connections, question-bank bridge, Firebase sync, data management |

## How it works — scan pipeline

### Two-stage scan model

- **Stage 1** — a search-grounded LLM answers the buyer question verbatim. Per-LLM prompt preambles enforce `FRESH SESSION` (no memory/personalization) and `MANDATORY WEB SEARCH` (Grok: "WEB / X SEARCH"; Perplexity: no "Spaces" context). The prompt header is `# CLM Perception Audit — ${tier} Scan (${date})`.
- **Stage 2** — a Haiku extractor parses each Stage-1 answer into structured JSON (`mentioned`, `rank`, `sentiment`, `lifecycle_stage`, `vendors_mentioned`, `cited_sources`, `sirion_content_cited`, `unsupported_vendors`, accuracy 1–10, `framing`, `attempts_pooled`). UI copy is explicit that Stage-1 exports are "verbatim … Zero Stage-2 processing".

### Baseline API Scan (primary path)

Runs through the Cloudflare worker `https://xtrusio-ai.thedevimapro.workers.dev` (client `snapshotClient-BBUEgP_Y.js`, engine name `xt_scan_engine`, auth `Bearer` token from localStorage `xt_token`):

- Endpoints: `POST /api/scan/start`, `GET /api/scan/{id}/status`, `/cancel`, `/snapshot`, `/pause`, `/resume`, `/retry`. Terminal phases: `complete | abandoned | cancelled | error | timeout`. Snapshot use is gated by localStorage `xt_use_snapshots === "on"`.
- Scan plan = `questions × models × N reps`. Rep presets: **Quick (N=1)**, **Baseline (N=3)**, **Stress (N=5)**. Tiers: `economy` / `premium`. Scan ids: `scan_${Date.now()}_${rand}` or `baseline_YYYYMMDD_HHMM`.
- Close-safe: every `(question × model × attempt)` is written to Firestore `m2_scan_attempts` immediately ("Reopen to resume from the exact failure point", "Safe to close tab — every attempt is saved"). Statuses per attempt: `pending | complete | error | parse_fail`; recovery paths `pending_only_recovery`, `Resume · …`, `Abandoned · …`.
- **Reuse dialog** before a run offers three modes: *Reuse + scan missing* (clone reusable attempts from prior scans, fresh API for the rest), *Reuse-only · instant* (clone only, drops uncovered questions, zero API calls), *Force fresh* (re-call every model). Live cost estimate is shown ("Running cost so far (per-attempt average × completed attempts)").
- **Analyze & Build Report** turns raw attempts into "scored scanData, segmentation, and exec summary" and writes: `m2_scan_meta/{scanId}` (1 doc), `m2_scan_results/{scanId}__{qid}` (one per question), `m2_sections/baseline_report_{scanId}` (1 doc). Success toast: `✓ Report saved — m2_scan_meta/${id} (1/1) · m2_scan_results (n/expected) · m2_sections/${sectionId} (1/1)` and "Reports tab entry … click 'Open in Reports →'".
- Retry: "Re-runs missing / errored / parse-failed attempts, then auto re-analyzes the report" (same scanId, completed attempts with valid extracts skipped). Single-question **Rescan** creates a new scanId.

### Manual paste scan (fallback path)

For each LLM there is a copy-prompt button that opens the chat product (`https://claude.ai/new`, `https://gemini.google.com/app`, `https://chatgpt.com/`, `https://grok.com/`, `https://www.perplexity.ai/`). The user pastes the full response back. Expected block format:

```
=== Q01 ===
QUERY: ...
FULL_RESPONSE_START ... FULL_RESPONSE_END
SIRION_MENTIONED: TRUE|...   SIRION_POSITION: n|NOT_LISTED
SENTIMENT / LIFECYCLE_STAGE / LIFECYCLE_RATIONALE / CONTENT_GAPS / NOTES
=== END Q01 ===
```
plus scan-level footers `TOTAL_QUERIES, MENTION_RATE, PRE_SIGNATURE_MENTIONS, POST_SIGNATURE_MENTIONS, FULL_STACK_MENTIONS, NOT_MENTIONED_COUNT, TOP_COMPETITORS, OVERALL_SENTIMENT`.

Parser fallbacks, in order: structured `=== Q01 ===` blocks → heading-based blocks → text-content matching ("Matched n/m questions by text content") → **Claude API normalization** via the worker (`POST {worker}/api/ai/chat`, provider `anthropic`, model **`claude-sonnet-5`**, system prompt "You are a data normalizer…"), 60 s timeout, 2 retries. A second AI pass ("data extraction specialist") repairs blocks with missing core fields. Sanity check: `SIRION_MENTIONED was YES but "<name>" not found in response text — auto-corrected to NO`. Method flags stored: `manual_paste`, `MANUAL_PASTE`, `INDIVIDUAL` (per-question no-bias mode), `regex`, `API normalized`. Scan is `COMPLETE` only when "all required platforms passed", otherwise `INCOMPLETE — waiting for: …`.

### Question bank

- Firestore `m2_questions` (+ config doc `m2_config/question_bank`). Import from Excel (`.xlsx`; required column `Query`, optional `Persona, Stage, Lifecycle, Cluster, Intent, Measures, Tags`) with duplicate detection: auto-skip ≥90 % match, Claude reviews 80–90 % "borderline" pairs. Import from M1 Question Generator ("m1-push" batches; "Pull from Question Generator (M1)").
- Selections can be tagged, saved as **scan groups**, or saved as **Segments** in the shared `user_segments` collection (name + creator; also used by M1).
- Soft-delete = archive (historical scan data intact); "Delete ALL questions" wipes only `m2_questions` after typing `DELETE`.
- localStorage cache of scanned qids: `xt_qbank_scanned_qids_v1`.

## Metric system (exact tiles, formulas, tooltips)

Header scorecard (per analysed scan):

| Metric | Formula (verbatim from tooltips) |
|---|---|
| **Overall** | `mention × 0.35 + position × 0.40 + sentiment × 0.25` — "Master perception score (0-100)". Weights tunable in Settings → Overall Score Weights (`wMention`, `wPosition`, `wSentiment`, sum must equal 1.00) |
| **Mention %** | `mentionedCount ÷ totalAnalyses × 100` — "% of (q × LLM) analyses" naming the target |
| **Position** | per ranked analysis `points = max(0, 100 − (rank−1) × rankStep)`; "Rank 1 = 100, rank 2 ≈ 85, rank 3 ≈ 70" (`rankStep` tunable) |
| **Sentiment** | per analysis: positive = 100, neutral = 50, negative = 20, absent = 0; averaged |
| **Accuracy** | "Stage 2 Haiku 1-10 × 10" — factual correctness of each answer about Sirion |
| **Share of Voice** | `sirionMentions ÷ totalVendorMentions × 100` |
| **Avg citations / Q** | mean cited sources per answer, "pooled across models × N" |
| **Unique domains** | distinct hostnames cited across every response |
| **Truthfulness %** | `verifiedVendors ÷ vendorsChecked` — competitor name must appear in a cited source's *title + excerpt + context* (URL/domain don't count); excludes Sirion and names < 3 chars; "Low rate = LLMs are fabricating vendor names" |
| **Consistency %** | `70% vendor overlap + 20% mention agreement + 10% rank stability` across N≥2 repeats; shows `—` for Quick scans |

**5-Metric payload** (recomputable in bulk from Settings — "Recompute the 5-metric payload … for every saved scan? Re-reads stored per-query results — no new LLM calls"): `visibility` (mention rate), `narrative` (`fullStackPct`/`postSigPct` etc.), `shareOfVoice`, `sentiment` (`positive/neutral/negative`), `competitivePosition` (`medianRank`, `winRatePct` — "beats top competitor in n% of queries"). Keys `visibility, shareOfVoice, sentimentPositive, winRate, fullStack`.

**Narrative classifier** (`narrativeClassifier-UrOyvc-P.js` + `fiveMetrics.narrative (scanEngine.classifyNarrative)`): deterministic keyword lexicon, "paragraph-pooled around every Sirion mention · PRE / POST / END-TO-END lexicon". PRE keywords: authoring/draft/redline/playbook/template/negotiate/intake/approval-routing/e-sign…; POST keywords: obligation/renewal/repository/milestone/SLA/supplier performance/expiration…. Precedence: END-TO-END hit → `full_stack`; PRE **and** POST → `full_stack`; PRE only → `pre_signature`; POST only → `post_signature`; none → `unclassified`. Denominator = **frameable mentions** = mentioned − `no_paragraph` (Sirion named only in a table cell / citation parenthetical is dropped from framing but still counts for visibility). A legacy keyword-match fallback exists for old scans.

**Narrative Health Score** (Settings → Narrative Health Weights): per-class weights `nw_fullStack` (Full-Stack), `nw_preSig` (Pre-Sig Capable), `nw_positive` (Positive General), `nw_neutral` (Neutral/Generic), `nw_postSigOnly` (Post-Sig Specialist), `nw_negative` (Negative), `nw_absent` (Not Mentioned), on a 0-100 scale. Trend copy: "Narrative health improved by n points … Full-stack framing is growing." / "Post-sig framing increased — publish more pre-sig and full-stack content."

**Per-query status enums** (`constants-BELxrI9x.js`): `strong` = `STRONG ✓`, `weak` = `WEAK ⚠`, `lost` = `LOST ✗`. Per-response traffic light: green "Response is good — no optimization needed", yellow "Response is biased — some adjustment needed", red "Sirion absent or negative — solid adjustment needed". Query-vs-competitor states: `winning / competitive / partial / losing / removed / other`.

**Vendor list** for extraction/SoV (competitor bank): Icertis, Ironclad, Agiloft, DocuSign, Conga, Juro, ContractPodAI, Evisort, LinkSquares, SAP Ariba, HyperStart, Malbek, Concord, ContractWorks, Onit, Determine, Coupa, CobbleStone, Precisely, Gatekeeper, SpotDraft, Lexion, Pramata, Jaggaer, Zycus, IntelAgree, Summize, Leah.

## Views in detail

### Scan & Results
Question bank table (filter by text/id, persona, stage; scanned/unscanned coverage bar), Baseline API Scan panel (scan plan, progress, cost, live event log, manual-paste fallback per failing model), Baseline API history table (Scan ID / Started / Duration / Plan / Status / Scores / Actions: Load, Analyze, Rename, Retry failed, Report →, Raw .md, View log, Delete). Per-question result rows expand to raw LLM responses; buttons: `⬇ Stage 1 (.md)` (verbatim, "no Haiku, no paraphrasing"), Rescan. Saved views (`m2_report_views`) store persona/stage/lifecycle filters.

### Executive Summary (M2-internal, `summary`)
Segment picker + view picker (latest / aggregated / per scan). Cards: **Are We Visible?** (mention % + per-LLM bars), **Where Do We Rank?** (avg rank, buckets #1 / #2-3 / #4+ / not mentioned), **Sentiment Perception**, **How Do We Compare?** (top vendors by mention frequency + share of voice), **Lifecycle Visibility** (mention rate per lifecycle question category + "Narrative bias: AI frames X as … focused"), **Citation Visibility** ("Citations = AI links to X as a source. Higher citation = stronger authority in AI training data"), **Narrative Ownership** (theme × owner × weight × strategy: `General/Attack/Defend/Compete/Ignore`), **Trend Signal** (needs matching scan scope), **Priority Actions**, **Competitive Losses**. Buttons: Download Report (HTML), Export All Data (Excel — sheets Company/Responses/Vendors/Sources/Content Gaps, file `${company}-AI-Perception-Full-Export-${date}.xlsx`).

The downloadable HTML audit ("AI Perception Audit Report" hero, DM Sans, light/dark themes) has numbered sections: 1 stat cards, 2 AI Perception (sentiment + narrative-theme ownership), 3 Platform Scorecard (per-LLM visibility %, avg rank, positive %, cited/queries), 4 AI Visibility Leaderboard (vendor × LLM citation matrix + distribution bars), 5 Query Summary (✓/✗ + rank per LLM, Strong/Weak/Lost badges), 6 Source Intelligence (top cited domains, source types), 7 Segment Breakdown (persona/stage/lifecycle), 7A Lifecycle Bias (incl. "Post-Signature Bias Detected" callout), 7B Citation Visibility, 8 Key Takeaways & Actions (+ "Bottom Line"), Content Gaps (classifier output), Raw Data Appendix. Footer: "Generated by Xtrusio AI Perception Engine" (links `https://gaurav.imapro.in/tools/xtrusio`). File name `AI-Perception-Report-{Company}-{date}.html`. Visibility verdict thresholds: ≥70 % strong, ≥40 % moderate, else "Critical visibility gap".

### Report V2 (`reportv2`)
"Report V2 is a simplified, board-ready view of a single scan. Everything reconciles to one denominator (total analyses)." Rendered by shared code in `loadCombined-BGLlSB-M.js` (also used by RichScanReport / Report V6). Components: **Reconciliation pyramid** ("Each branch's sum equals its parent — no orphan metrics"): Total analyses → Mentioned → Frameable → lifecycle buckets / Dropped-no-prose; Sentiment denom; Positioning denom. **Provenance — reused vs fresh** bar (● Reused / ● Fresh API + source scans). Five KPI containers with exact formula popovers:

- Visibility / Citation: `mentioned ÷ total_analyses × 100` (mention flag from the structured extractor, "regardless of whether it was cited as a source"); breakdowns By model / By persona (with weights) / By stage.
- Share of Voice: `sirion_exact_name_in_vendors_ranked ÷ total_vendor_name_occurrences × 100` — "Formula (symmetric, locked)", exact-name match, "Top 10 vendors — same denominator".
- Sentiment: extractor label per mentioned analysis; denominator = mentioned, not total.
- Competitive Positioning: rank buckets 1 / 2 / 3 / 4+ / unranked, median rank, `top-3 rate = (r1+r2+r3) ÷ mentioned × 100`, mean rank, ranked n.
- Lifecycle / Narrative: full/pre/post/unclassified % of frameable.

Export: self-contained `${scan}_ReportV2_${yyyymmdd}.html` — "all formulas + reconciliation checks visible by default. Safe to email…". Footer: "Report V2 · All numbers reconcile to n total analyses · Generated from m2_scan_meta + m2_scan_results (Firebase)".

### Report V3 (`reportv3`) — citation-centric
Constants: `po = "baseline_20260423_1718"` (the 35Q baseline scan), `yi = "baseline_20260423_2229"`; models `["claude","gemini","openai"]`; locked question sets `Ir = [{id:"hard_35q", name:"35Q Baseline", scanId: baseline_20260423_1718}, {id:"hard_154q", name:"154Q Baseline", scanId:null}]`; combined-data cache localStorage `xt_reportv3_combined_v1` (TTL `10080*60*1e3` = 7 days). Direct Firestore REST `runQuery` on `m2_scan_results` where `scanId EQUAL …`.

Panels: **§ 1. Objective — what we're paid to move** ("Shift the AI perception of Sirion across CFO / CIO / GC / Procurement buyer queries" + KPI cards), **§ 2. Current State** (five KPI strip), **§ 4. Source URL Cloud** — "Where the LLMs are pulling their evidence from. Bubbles sized by citation count. Owned (Sirion-controlled) on the left, external on the right", with lists *Top owned by citations*, *Top authority* (Gartner/G2 etc.), *Competitor watch*; note: "Deterministic classification only (zone, authority weight, competitor domain). LLM-driven subject_company and sentiment_sirion fields default to 'unknown' / 'neutral' until an opt-in classify pass runs (Sprint 3). State badges (NEW / DROPPED / STRENGTHENED) ship with the diff engine in Sprint 3." **§ 5. Control Architecture** — citation share weighted by authority: tiers **Owned / External authority / External long-tail / Competitor-owned**; `each citation contributes citationCount × authority_weight`; "Authority weights live in `data/authority_tiers.json` (Gartner = 1.0, G2 = 0.85, owned baseline = 0.7, unknown = 0.3, etc)". Interpretation copy per dominant tier (e.g. "Third-party authority (Gartner / G2 / analysts) drives the narrative…"). Export HTML per active segment.

### Report V4 / V5 (`reportv4`, `reportv5`)
Same skeleton as V3/V6 (segment/scope filters, Persona ↓ / Stage → matrices, vendor leaderboard with per-LLM stacked distribution, QID tables, Export HTML titled "Report V4"/"Report V5"). V5 adds the locked `hard_35q`/`hard_154q` scope logic and 5-LLM support.

### Trends / comparison views (inside Scan Report)
Sections rendered in the CEO-level "Scan Report": SECTION 1 ARE WE VISIBLE?, 2 WHERE DO WE RANK?, 3 WHAT IS OUR PERCEPTION?, 4 VS COMPETITORS, 5 TREND ANALYSIS (per-LLM visibility % across scans), 6 BENCHMARK TRACKER (ground-truth benchmark questions, HIT RATE). TRENDS tab: "Comparable scans only. n excluded (less than 20 queries or single-LLM)", AI VISIBILITY OVER TIME, Complete Database Outlook, Section-wise Lifecycle Analysis, SCAN COMPARISON (score deltas, NARRATIVE SHIFT with Narrative Health, COMPETITOR SHIFT, QUERY-LEVEL CHANGES improved/declined/new), SCAN HISTORY, TRAJECTORY PREDICTION ("At current rate, you'll reach n% visibility in m months"), ANOMALIES & ALERTS, RECOMMENDED SCAN FREQUENCY (volatile → every 3 days; stable → bi-weekly; default weekly; minimum 3 data points).

### Content gaps
Classifier gaps (`schemaVersion === 2`) with fields: `type`, `severityScore`, `severityLabel` (`critical/high/medium/low`), `query`, `model`, `auditTrail.rationale`, plus evidence fields `sirionRank, topCompetitor, rankDelta, lifecycleStage, queryIntent (preSig/postSig/fullStk), matchedKeyword, sirionSourceCited, competitorDomainsCited, negativePhrasesFound`. Each row expands to Formula / Evidence / "Citations inspected" / verbatim Stage-2 prompt & response. **Master Content Gap Backlog** (`m2_content_gaps`) consolidates across sessions (Gap Topic / Freq / Severity / Value / Priority / Content Type blog|website|both / Pushed). **PUSH TO CONTENT STRATEGY** ships the scan to M6 ("payload = full raw data … + classifier gaps + summary stats; M6's blog-matcher will score candidate pages against each gap"); **Push to Authority Ring** sends to M3 (also auto: "Scan results automatically flow to the Authority Ring for domain prioritization").

### Settings (`settings`)
SCORING CALIBRATION (Overall Score Weights `wMention/wPosition/wSentiment` + `rankStep`; Narrative Health Weights; "Saved locally per browser"), LLM CONNECTIONS (Test All; keys managed in Global Settings), QUESTION BANK M2 BRIDGE (import from M1: numbered lists, markdown tables, CSV, JSON; Default Bank / Custom / Reset), AUTHORITY RING SYNC (auto), SYNC ALL DATA TO FIREBASE ("Force-push ALL localStorage data" — pushes `xt_pipeline_snapshot → pipelines/main`, `xt_m1_questions_v2_* → m1_questions_v2`, `xt_m2_scan_meta_*`, `xt_m2_scans_*`, `xt_m2_scan_results_*`, `xt_m2_sections_*`), DATA MANAGEMENT (delete a single scan cascade: `m2_scan_meta, m2_scans, m2_scan_runs, m2_scan_attempts, m2_scan_results, m2_sections, m2_content_gaps` + prune `user_segments` history; wipe a single collection; Reset All Scan Data — preserves segments + question bank + M1; also clears `fb_cache_*`).

## Data model / storage

Firestore collections (all module-2):

| Collection | Doc key pattern | Content |
|---|---|---|
| `m2_questions` | qid | Question bank (query, persona, stage, lifecycle, cluster, intent, tags, archived) |
| `m2_scan_meta` | scanId | Scan metadata: `scan_name`, `company`, `tier`, `models`, `reps`, `question_count`, `run status`, `completed_at`, and the **publish flags** `published`, `published_by_report_id`, `published_at` (set by the Scan Your Queries publish flow) |
| `m2_scans` | scanId | Legacy full-scan docs (split into individual results when > doc-size limit) |
| `m2_scan_runs` | scanId | Baseline runner metadata |
| `m2_scan_attempts` | per attempt | Raw Stage-1/Stage-2 rows keyed `qid|model` (+ `attempt` rep) — resume-safe, kept on scan delete |
| `m2_scan_results` | `{scanId}__{qid}` | Analysed per-question doc; `analyses[model]` holds the Stage-2 extract incl. `cited_sources[]`, `vendors_mentioned[]`, `narrative.label` |
| `m2_sections` | `baseline_report_{scanId}` / `sec_*` | Report-section cards shown in Reports tabs |
| `m2_content_gaps` | `gap-*` | Classifier gap backlog |
| `m2_report_views` | `view_*` | Saved filter views |
| `m2_config` | `question_bank` | Saved question bank blob |
| `user_segments` | segment id | Shared question segments (M1+M2) |

localStorage: `xt_token` (worker auth), `xt_use_snapshots`, `xt_qbank_scanned_qids_v1`, `xt_reportv3_combined_v1` (7-day cache), `xt_pipeline_snapshot`, plus `xt_m1_questions_v2_*`, `xt_m2_scan_meta_*`, `xt_m2_scans_*`, `xt_m2_scan_results_*`, `xt_m2_sections_*` mirrors used by "Force sync all".

Constants (`constants-BELxrI9x.js`): LLM ids `claude, gemini, openai, grok, perplexity` (display: Claude, Gemini, **ChatGPT**, Grok, Perplexity; brand colors `#10b981/#f59e0b/#3b82f6/#fb923c/#f472b6`); baseline scan ids `baseline_20260423_1718` + `baseline_20260423_2229`; company `Sirion`; owned domains `sirion.com, sirion.ai, sirionlabs.com`; CLM stages `pre_signature / post_signature / full_stack (+ unclassified)`; scopes `all` ("All questions in scan"), `baseline154` ("154 baseline questions"), `baseline35` ("35 baseline questions").

## Integrations

- **In:** M1 Question Generator (question pushes, segments), Global Settings (API keys), worker API (scan execution + Claude normalization/repair).
- **Out:** top-level Reports/Executive Summary (via `m2_scan_meta`/`m2_scan_results`/`m2_sections` + publish flags), M6 Content Strategy (gap payloads), M3 Authority Ring (auto-sync), exports (.md raw/Stage-1, JSON, Excel, self-contained HTML reports, PDF print).

## For AI assistants

- This is a **minified production bundle**, not source. To inspect, extract string literals with python regex slicing (never `cat` the 724 KB file). Everything documented above was recovered from string literals; identifiers like `wMention`, `hard_35q`, `m2_scan_results` are exact.
- The metric formulas are duplicated in three places (`loadCombined` Report V2 builder, `RichScanReport`, Report V6) — if a formula changes it must change in all three; the "Formula (symmetric, locked)" SoV wording signals it is contractual and should not be altered.
- `scanId` prefix `baseline_` triggers special handling everywhere (legacy-order merge, no augmentation); the two April 2026 baseline scans (`baseline_20260423_1718` = 35Q, `baseline_20260423_2229`) are hard-coded reference points.
- Deleting/renaming Firestore collections here breaks the top-level Reports, Executive Summary, Trajectory, Content Strategy and Authority Ring modules — they all read `m2_*` collections directly.
- Report V6 inside M2 is intentionally a dead stub; the live one is the Reports nav module (see `docs/modules/reports-and-executive-summary.md`).
