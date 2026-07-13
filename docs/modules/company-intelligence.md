# Company Intelligence (nav id `intel3`)

**Bundle files:** `CompanyIntelligenceV3-gcKBt1ju.js` (current, ~108 KB), `CompanyIntelligenceV2-K6Qic6J6.js` (legacy, ~106 KB), `CompanyIntelligence-BNCdP1vs.js` (legacy V1, ~38 KB), plus the shared **intel engine chunk `openai-BjkciBql.js`** (~364 KB — despite the name it is the whole Company-Intel research/data layer, not an OpenAI client) and the AI proxy client `claudeApi-DNyhT86p.js`.

## Purpose

Company Intelligence is the competitive-intelligence dashboard of the Xtrusio platform for the client **Sirion** (a CLM vendor). It answers "where does Sirion stand in AI perception, what are competitors doing, what's happening in the CLM market, where are the white-space opportunities, and what should the CMO do this week". It **does not run its own perception scans** — it consumes scan output produced by Perception Monitor (`m2_*` Firestore collections) and enriches it with live market research done through grounded LLM calls (Gemini with Google Search, Perplexity Sonar / Sonar Pro) and the GNews API, all proxied through the Cloudflare worker.

It is the **default landing module** of the whole app (hash routes `/`, `/intel`, `/intel-v2`, `/intel-v3` all resolve to `intel3`).

## Version history

| Version | File | Status | Notes |
|---|---|---|---|
| V1 | `CompanyIntelligence-BNCdP1vs.js` | legacy | 4 tabs, manual "copy prompt → paste Gemini answer → Parse & Save" workflow, saves into the shared pipeline doc |
| V2 | `CompanyIntelligenceV2-K6Qic6J6.js` | legacy | Introduced the 6-lens layout and the automated intel engine; Domino lens visible to everyone; still shows legacy `google_news_rss` source badges |
| V3 | `CompanyIntelligenceV3-gcKBt1ju.js` | **current** | Same 6 lenses; adds role-gating of the Domino lens (`admin`/`super_admin` only), "Send to Content" integration with Content Strategy (m6v3), and the campaign candidate pipeline. Header badge still literally reads `V2 · STRATEGIC` |

V2 and V3 both import the same shared engine chunk, so the prompts/data layer below applies to both; V3 is what ships behind the nav.

## How it works (V3)

### Header & scan brief

Top bar: title **"Company Intel"**, badge **"V2 · STRATEGIC"**, subtitle "Sirion", a stage filter, a time-range select and a **Refresh** button. Below it "THE BRIEF" card summarizes the latest scan: *"**Sirion** is at **N/100** in AI perception (avg across stages). Strongest in X (score); weakest in Y (score). Based on N questions across N LLMs."* Empty state: *"Run a scan in **Perception Monitor** to populate your brief…"*.

### Scan data source

Loader (engine fn `Kv`, imported as `Me`) merges three sources and returns one doc list:
1. Firestore collection **`baseline_20260423_1718`** (per-question scan docs)
2. Firestore collection **`baseline_20260423_2229`**
3. Every other scan run listed in **`m2_scan_meta`** — each run id is itself a Firestore collection of per-question docs

Docs are merged per `qid`, newest completed analysis per LLM wins. Each doc: `{qid, query, persona, stage, analyses: {claude|gemini|openai|grok|perplexity: {mentioned, rank, sentiment, framing, response_snippet, supported_vendors[], unsupported_vendors[], hallucinated_vendors[], _error}}}`.

Constants: company `I="Sirion"`; stages `G=["awareness","discovery","consideration","validation","decision"]`; LLM order `he=["claude","gemini","openai","grok","perplexity"]` with labels `{gemini:"Gemini", openai:"ChatGPT", claude:"Claude", grok:"Grok", perplexity:"Perplexity"}`; competitor-name canonicalizer `Q()` (maps "docusign"→"DocuSign", "docusign clm"→"DocuSign CLM", "sap ariba"→"SAP Ariba").

### The six lenses (tab registry `_e`)

```js
{id:"position",      label:"Position",     blurb:"Where we stand: AI visibility, share of voice, narrative, funnel by stage."},
{id:"competitors",   label:"Competitors",  blurb:"Per-competitor profiles, head-to-head, narrative ownership."},
{id:"pulse",         label:"Market Pulse", blurb:"Auto-fed news (daily Gemini cron), market data, analyst movements."},
{id:"opportunities", label:"Opportunities",blurb:"White-space themes, gap queries, persona blind spots."},
{id:"actions",       label:"Actions",      blurb:"Prioritized plays this week, with rationale and owner."},
{id:"domino",        label:"Domino",       blurb:"Predictive correlation engine — industry × company × signal force graph for cascade prediction."}
```

**Domino is filtered out unless `role === "admin" || role === "super_admin"`** (both in the tab bar and at render time). V2 shows it to everyone.

- **Position** — stage funnel cards (score = % of analyses where Sirion was mentioned, colored green ≥60 / yellow ≥40 / red), a Recharts **Sankey** titled *"How AI conversations flow"* (buyer-journey stage → LLM → "✓ Mentioned"/"✗ Missed"), computed insight chips (e.g. *"Late-funnel deficit: … AI knows of you but isn't recommending — sentiment / case-study problem."*), and per-stage drill-down tables of questions × LLMs with missed-by-LLM filters.
- **Competitors** — competitor landscape derived from `supported/unsupported/hallucinated_vendors` counts across scan docs (mention rate, proof rate), head-to-head vs Sirion per stage, narrative ownership, and DEFEND / OPPORTUNITY / HALLUCINATED insight chips.
- **Market Pulse** — see below (news + market scorecard + trend topics).
- **Opportunities** — AI-synthesized white-space plays (see prompt), rendered as cards / table / priority quadrant ("↙ FILL-INS" / "↘ THANKLESS"), each with gap-type badge (`theme_gap`→"THEME GAP", `question_gap`, `persona_gap`, `content_gap`), effort estimate (low "<4h", medium "1-3 days", high "1+ week"), and verification badge: **"✓ verified vs sirion.ai"**, **"↻ already on sirion.ai (reframed)"** or *"not verified"*.
- **Actions** — the weekly play list, tiers `critical` / `watch` / `opportunity`, each with score breakdown, "Copy for Slack" button, and Send-to-Content.
- **Domino** — predictive engine over industries × companies × 8 signal types (see below).

### Cache-first, never auto-spend policy

Every AI-derived panel goes through hook `U(cacheKey, ttl, computeFn, deps, forceEpoch)` → engine `c_` (`cachedCompute`). On mount it is **cacheOnly**: Firestore doc `intel_v2_cache/{key}` first, then localStorage `xt_intelv2_cache_{key}`; if neither is fresh the panel shows the **"NOTHING CACHED"** empty state:

> *"No saved «data» for this lens yet. Logging in doesn't auto-run AI calls anymore — those cost tokens. Click **Refresh** in the top bar to fetch the latest, or come back later if a teammate already pulled it."* + **Fetch now** button.

Only an explicit Refresh (bumping `forceEpoch`) triggers fresh AI calls; results are written back to both cache layers with `{computed_at, ttl_ms, data}`.

TTLs (`u_`, imported as `J`): `MARKET_DATA_30D` = 720 h (30 days), `TRENDS_14D` = 336 h (14 days), `OPPORTUNITIES` = 336 h (14 days — UI copy says "Cached for 7 days"), `ACTIONS` = 10 080 min (7 days). Cache keys used by V3: `news_feed_90d_v3`, `market_pulse_scorecard`, `market_pulse_trends`, `opportunities_v1`, `actions_v1`.

If any panel errors with a message matching `/AI access expired/i`, a full-screen gate explains the `xt_token` session token died (*"…happens when a browser tab closes, or after 30 days"*) with a **"Sign out and reload"** button that clears `xt_auth_session` + sessionStorage `xt_token`/`xt_client`.

A daily dated snapshot of the dashboard state is written by engine fn `f_` to localStorage `xt_intelv2_snapshot_{YYYY-MM-DD}` (max 90 kept) and Firestore **`intel_v2_snapshots`**.

## The shared intel engine (`openai-BjkciBql.js`)

### Multi-provider research call

`ie(systemPrompt, userPrompt, {providers, timeoutMs, maxTokens, label})` tries providers in order until one returns parseable JSON. Provider ladders (`fe`):

```js
RESEARCH_PREMIUM:        ["perplexity-pro","gemini-pro-grounded","perplexity"]
RESEARCH_FAST:           ["perplexity","gemini-flash-grounded"]
RESEARCH_VERIFIED:       ["gemini-pro-grounded","perplexity-pro","gemini-flash-grounded"]
RESEARCH_CURRENT_EVENTS: ["perplexity-pro","gemini-pro-grounded","perplexity"]
SYNTHESIS_PREMIUM:       ["gemini-pro","claude-fast","openai"]
SYNTHESIS:               ["gemini-flash","openai"]
```

Provider → model map (`pu`): `perplexity-pro`→`sonar-pro`, `perplexity`→`sonar`, `gemini-pro`→`gemini-2.5-pro`, `gemini-pro-grounded`→`gemini-2.5-pro` + `tools:[{google_search:{}}]`, `gemini-flash-grounded`→default flash + google_search, `gemini-flash`→default (`gemini-2.5-flash`), `claude-research`→`callClaude` (claude-sonnet-5 + `web_search_20250305` tool), `claude-fast`→`callClaudeFast` (claude-sonnet-5), `openai`→`callOpenAI` (`gpt-4o`). All go through `claudeApi-DNyhT86p.js` → `POST {worker}/api/ai/chat` (Bearer `sessionStorage["xt_token"]`).

Per provider: up to 3 retries on transient errors (5xx/429/timeout, exp backoff), plus a Gemini "malformed JSON" repair pass (re-call raw, then bracket-balancing JSON salvage `hu`). Every attempt is logged to an in-memory research log persisted at localStorage **`xt_research_log_v1`** (last 200 events: start/attempt/success/failure with provider, ms, retries).

### Market Pulse — news feed (cache key `news_feed_90d_v3`)

Watch-list config lives in Firestore doc **`intel_v2_config/news_subscriptions`**: `{competitors (max 8), industry_terms (max 4), custom_topics (max 10), updated_at, updated_by}`. Defaults (auto-seeded on first load): competitors `["Icertis","Ironclad","Agiloft","DocuSign CLM","Conga"]`, industry_terms `["contract lifecycle management","agentic CLM"]`. The UI's "Edit subscriptions" panel writes back via `Zv` (suggested custom topics chip list `e_`: "Agentic CLM", "AI in legal tech", "M&A activity", "Funding rounds", "Product launches", "Gartner Magic Quadrant", "Forrester Wave", "Pricing changes", "Customer wins", "Executive moves").

News pull (`t_`, imported as `Ve`) fans out **three parallel sources** (loading copy: *"GNews (Google News, priority 1) · Gemini grounded (Google index, AI summary) · Perplexity Sonar Pro (Bing index). Deduping cross-source matches."*):

1. **GNews** — `POST {worker}/api/gnews` per watch-list query (each query is `"<term>" AND (CLM OR "contract management" OR "contract lifecycle" OR legaltech OR "legal tech" OR SaaS)`), body `{query, lang:"en", country:"us", max:10, from, sortby:"publishedAt"}`. Distinct error copy for 401 (`gnews_key_invalid` → *"Check the GNEWS_API_KEY worker secret"*), 403 (*"GNews quota exhausted. Upgrade to Essential ($9/mo)…"*), 429, 404 (*"Run `wrangler deploy` from the worker folder"*).
2. **Gemini grounded** (`gemini-pro-grounded` → flash fallback) with the news prompt below.
3. **Perplexity** (`perplexity-pro` → `perplexity`) with the same prompt.

An older 4th source, **`/api/rss`** (direct Google News RSS via the worker), is **deprecated**: status object hardcodes `{rss:{status:"skipped", deprecated:true, note:"Replaced by gnews 2026-05-09. Old direct-RSS proxy hit Cloudflare Worker IP block."}}`. V2 still renders `google_news_rss` source badges; V3 shows a warning *"Google News unavailable … The /api/rss endpoint on the AI proxy may need redeploy."* when GNews fails.

**News system prompt (verbatim):**

> You are a CLM industry analyst tracking competitor moves and market signals for Sirion's marketing leadership. You produce structured, source-attributed news intelligence — never speculation, always with verifiable URLs. STRICT TOPIC FILTER: only Contract Lifecycle Management (CLM), legaltech, contract automation, e-signature, procurement-contract, or directly-CLM-adjacent enterprise SaaS news. Reject sports, politics, celebrity, weather, regional crime, election results — even if they share a competitor name (e.g., "Ironclad" the baseball pitcher, "Conga" the dance, "Agiloft" homophones).

**News user prompt (`Wi`, abridged — full text ~2.5 KB):** *"Find news from the last ${windowDays} days that could materially affect Sirion's competitive position in the CLM… market. Topics / entities to track: <watch list>. SOURCE COVERAGE — be COMPREHENSIVE, not curated: … you MUST search BEYOND mainstream tech publications. Specifically check: Press release wires — PR Newswire, BusinessWire, GlobeNewswire, Cision, EIN Presswire… Trade publications — Artificial Lawyer, Legaltech News, Above the Law, Law Sites Blog, ACC Docket, Procurement Mag, Spend Matters, Supply Management. Vendor-direct sources — competitor blog posts, product update pages… Analyst direct — Gartner.com, Forrester.com, IDC.com… LinkedIn posts from CLM vendor C-suite executives… Reddit r/legaltech, r/procurement… CRITICAL — TOPIC SCOPE: Only return news that is materially about [CLM vendor moves / CLM-adjacent enterprise software / analyst reports on CLM / trend pieces with named vendors]. REJECT outright: sports, baseball, cricket, football — even if a competitor name appears…"* Items must return `{title, source_url, source_name, published_date, summary, category:"Threat"|"Opportunity"|"Neutral", affects, impact_score}`.

Pipeline after fetch: normalize + relevance filter (drops non-CLM noise; count kept in `dropped_irrelevant`), window filter, cross-source dedupe (matching titles/URLs merge into one item with `sources[]` corroboration), archive every item to Firestore **`intel_v2_news_archive`** (doc id = djb2 hash of `source_url`, tracks `first_seen_at`/`last_seen_at`, 365-day horizon `Di`). UI: filter chips by competitor/topic/source, category badges THREAT / OPPORTUNITY / NEUTRAL, impact score coloring, source badges (Google/Gemini/Perplexity/Claude).

A **weekly CMO digest** synthesizer also exists (system prompt verbatim): *"You are a CMO's weekly market intelligence analyst for Sirion (a CLM software vendor). You read raw news items and produce a tight, decision-grade digest: what changed, who's threatening, where the openings are, and what to do this week. You never repeat what's in the items verbatim; you synthesize patterns ACROSS items."* (fed the top 60 items, summaries truncated to 200 chars).

### Market Pulse — scorecard (cache key `market_pulse_scorecard`, TTL 30 d)

Loading copy: *"Three parallel calls: vendor share + analyst rankings (Gemini grounded), capital flow + launches (Perplexity Pro). Up to 90s."* Uses `RESEARCH_*` ladders with three prompt sets:

1. **Vendor market share** — system (verbatim): *"You are a CLM market researcher serving a CMO. You return vendor revenue share with diverse, verifiable source URLs — every row sourced independently, never a single anchor citation. If you cannot source a vendor independently, omit it."* User prompt (abridged — ~2.8 KB): demands `category_context {tam_usd, year, cagr_pct, cagr_period, source_url, source_name}` and `vendor_market_share [{name, share_pct, year, yoy_change_pct, confidence:"high"|"medium"|"low", source_url, source_name}]`; **"CRITICAL — SOURCE DIVERSITY IS MANDATORY: Each vendor row MUST cite a DIFFERENT source URL"**; pure-play CLM vendors to research: *Icertis, Ironclad, Agiloft, Conga, DocuSign CLM, Malbek, Evisort, ContractPodAI, LinkSquares, Juro, Summize, SirionLabs*; conglomerates must name the CLM line ("SAP Ariba CLM", never bare parent); a confidence rubric per row; "Return AT LEAST 5 vendors (target 6-10). Quality > quantity."
2. **Analyst rankings** — system (verbatim): *"You are a CLM market researcher. You return analyst rankings (Gartner Magic Quadrant, Forrester Wave, IDC MarketScape) ONLY with verifiable source URLs from the actual analyst firms or named press coverage. You do NOT attribute one analyst firm's content to another. You do NOT cite generic "buyers guide" PDFs as if they were Gartner MQ or Forrester Wave reports."*
3. **Capital flow / current events** — system (verbatim): *"You are a CLM industry researcher tracking current events — funding rounds, M&A, product launches, executive moves. You return real, recent, sourced events. Each event must cite a specific article, press release, or Crunchbase profile — NOT a generic category report."*

Scorecard response fields consumed by the UI: `vendor_market_share[]`, `capital_flow[]`, `analyst_rankings`, `category_context`, `_provider`. A sanity snapshot combining scorecard + AI share-of-voice + stage scores + news category counts is saved via the daily snapshot fn. Window global `window.__MARKET_PULSE_BUILD__ = "MARKET_PULSE_V2_BUILD_2026_05_04_16_30_UTC_POST_DOMAIN_SWAP"` marks the build.

### Market Pulse — trend topics (cache key `market_pulse_trends`, TTL 14 d)

System prompt (verbatim): *"You are a market analyst who assesses qualitative shifts in public discussion of B2B software topics. Make best-effort calls based on coverage volume, news cadence, search-trend signals, and analyst commentary. "Unknown" is the LAST resort, not a default — if the topic gets any meaningful coverage at all, you can call rising/flat/declining with appropriate confidence."* Returns `{topics:[…]}` with directional calls + evidence; refuses to cache if no useful data (`NO_USEFUL_DATA` error with diagnostics).

### Opportunities lens (cache key `opportunities_v1`, providers RESEARCH_PREMIUM, maxTokens 16384, timeout 240 s)

System prompt (verbatim, the module's signature prompt):

> You are a content strategist for Sirion's marketing team. You analyze AI-perception scan data and competitor data to surface UNCLAIMED POSITIONING ANGLES — places Sirion could plant a flag with a clear content play. You are specific, action-oriented, and never recommend a play whose first step you cannot describe.
>
> CRITICAL VERIFICATION REQUIREMENT — before recommending any opportunity, you MUST verify it against Sirion's existing content using web search. Specifically:
>
> 1. For each candidate play, run a web search like: `site:sirion.ai "<key topic phrase from the play>"` or use your grounded-search tool to look up sirion.ai for that topic.
> 2. If the asset already exists on sirion.ai (a published guide, comparison, case study, etc. that covers the same angle), you have two options: a) DROP the opportunity — don't recommend something Sirion already has. b) REFRAME it as an extension/upgrade of the existing asset, with the existing URL noted.
> 3. Never invent claims about what Sirion has or doesn't have. If you can't verify, say so honestly in verification_evidence.
>
> This verification step is non-negotiable. A CMO will lose trust in this tool if it suggests building something Sirion already published.

Input: the position matrix, competitor landscape, narrative ownership and news items. Output `{opportunities:[…]}` with fields including `title, description, gap_type, opportunity_score, score_breakdown, opportunity_rationale, recommended_play, primary_persona, effort, already_exists_on_sirion, existing_sirion_asset_url, verification_search_url, verification_evidence`. Post-filter: any item flagged `already_exists_on_sirion` is dropped unless its title starts with `update|extend|expand|refresh|upgrade|deepen`. Seen/served history archived to Firestore **`intel_v2_opportunities_seen`** (hash-keyed dedupe) and **`intel_v2_opportunities_history`** (per-session capture); collections `intel_v2_opportunities` / `intel_v2_actions` also exist in the chunk.

### Actions lens (cache key `actions_v1`, TTL 7 d)

System prompt (verbatim): *"You are Sirion's CMO chief-of-staff. You translate analytical findings into a prioritized weekly action list — what to personally do, in order of leverage. You write imperative, specific actions a marketing exec can do or delegate this week. You never invent data — every action ties back to a specific input below."* Inputs: position insights + competitor insights + news + opportunities. Loading copy: *"Synthesizing this week's plays from all 4 lenses… Combining Position + Competitors + Pulse + Opportunities."* Output `{actions:[{title, rationale, tier:"critical"|"watch"|"opportunity", action_score, score_breakdown, …}]}`.

### Domino lens (admin/super_admin only)

A predictive correlation engine: **industries × companies × 8 signal types**, force-graph + heatmap, cascade predictions. Signal taxonomy (verbatim ids/labels):

`m_a` "M&A", `regulatory_change` "Regulatory", `ai_adoption` "AI Adoption", `exec_move` "Exec Move" (*"New CFO / GC / CIO / Chief Procurement Officer"*), `cost_pressure` "Cost Pressure", `vendor_consolidation` "Vendor Consolidation", `rfp_signal` "RFP Signal" (*"Public RFP for CLM or contract automation"*), `clm_hire` "CLM Hire".

Its own persistence layer `qr`/`Gr` writes each doc to **both** localStorage (prefix `xt_domino_<collection>_<id>` with a `_keys` index per collection) and Firestore, with sync counters. Collections (`Hr`):

| Alias | Firestore collection |
|---|---|
| industries | `intel_v2_domino_industries` |
| companies | `intel_v2_domino_companies` |
| signals | `intel_v2_domino_signals` |
| matrixSnapshots | `intel_v2_domino_matrix_snapshots` |
| correlations | `intel_v2_domino_correlations` |
| predictions | `intel_v2_domino_predictions` |

Domino prompts (all verbatim system prompts):
- **Industry profiles:** *"You are a B2B SaaS market researcher for a CLM (Contract Lifecycle Management) intelligence platform. You produce structured, source-attributed industry profiles. Every quantitative claim must carry a source URL + publication date. Omit fields you cannot verify rather than guess."* (RESEARCH_PREMIUM, 16384 tokens, 240 s). Profiles get `last_refreshed_at` + `_provider`; source URLs are liveness-checked with `HEAD`/`GET no-cors` fetches.
- **Profile fact-check:** *"You are a fact-checker. You will be given a CLM industry profile claim. Your job is to research independently and report whether each material claim holds up. Be conservative — say "unsure" rather than guess."*
- **Customer extraction** (run on Firecrawl-scraped competitor case-study pages, markdown capped at 18 000 chars): *"You are reading the markdown content of vendor "${vendor}"'s public customer / case-study page (homepage: ${url}). Extract every named customer mentioned in this page."* Returns per customer `{company_name, industry_id, industry_name, evidence_snippet (≤50 words quoted), vendor_relation_type:"case_study"|"logo_only"|"press_release"|"earnings_mention", case_study_url, confidence:"high"|"medium"|"low"}` with a confidence rubric and constraints (*"Only public, verifiable references… Skip generic "trusted by 500+ companies" claims… De-dupe…"*). Extracted customers are deduped across vendors into company records `{id, name, industry_id, current_clm_vendor, vendor_signal:"loyal", vendor_references[], source_urls[], …}`.
- **Customer fact-check:** *"You are a fact-checker. Given a claim that a named company is a CLM-software customer of a named vendor, you research independently and return your verdict…"*
- **Signal scan:** *"You are a signal-extraction engine for CLM market intelligence. You scan the last 7 days of public news and return only events that match one of 8 specific signal types affecting named companies in a given industry. Every event must carry a verifiable URL — no speculation, no fabrication."* User prompt asks per hit for `{industry_id, company_name, signal_type, headline (≤15 words), summary, source_url, source_name, source_date, disruption_score, clm_relevance}`.

A mock-data generator (`domino_mock`) exists for demo/dev; insights derive tiers `critical/watch/opportunity` from `domino_correlation` / `domino_signal` / `domino_industry_state` sources.

### Send to Content integration (V3 only)

Opportunity cards and Action cards have a **Send to Content** button (`de`). It builds a campaign topic candidate:

```js
{ campaignId: "sirion_perception_shift_2026",   // first campaign in campaigns-gnROApsc.js seed
  title, angleHook, rationale, addressesGapIds:[], persona, lifecycle:"pre-signature",
  contentFormat: placement ∈ {"client-blog","internal_only"} ? "faq" : "narrative",
  sourceLabel:"Company Intel", sourceModule:"intel3", sourceMeta:{…}, status:"candidate" }
```

and pushes it into the Content Strategy store via `useM6V3Store().addTopics([candidate])`. Success shows **"✓ Sent"** with an **"Open in Content"** link that sets `sessionStorage["xt_m6v3_jump_to_view"]="topics"` and navigates to `#/content-v3`. Failure: *"Failed to send — check console."*

## Legacy V2 (`CompanyIntelligenceV2-K6Qic6J6.js`)

Structurally the same 6-lens dashboard sharing the same engine chunk. Differences from V3: no role gate on Domino; no Send-to-Content/campaign candidates; news source badge map still includes `google_news_rss:"Google" (#4285f4)` from the pre-2026-05-09 RSS pipeline. Reached historically via `/intel-v2` (now aliased to `intel3`).

## Legacy V1 (`CompanyIntelligence-BNCdP1vs.js`)

Subtitle: *"Strategic AI positioning dashboard — live from Perception Monitor data."* Four tabs: `position` "AI Position" 🎯, `pulse` "Market Pulse" 📡, `alerts` "Alerts" ⚠️ (badge = count of critical alerts), `reference` "Market Data" 📊. Reads **`m2_scan_meta`** / **`m2_scan_results`** directly; charts: Perception Radar (*"Mention strength per lifecycle theme (normalized 0-10)"*), Per-Platform Visibility, Narrative Ownership (*"Which competitor AI mentions most per theme"*).

No automated AI calls — Market Pulse and Market Data use a **manual workflow**: *"Step 1: Copy this prompt and paste in Gemini (with web search)"* → *"Step 2: Paste Gemini's response here"* → **Parse & Save**. The Market Data prompt (verbatim, abridged): *"I need verified, current data points for a CLM market intelligence report (<Month Year>). For each item, provide the EXACT number and the SOURCE URL where you found it. Companies to cover: … Return as JSON with this structure: { "marketSize": {current, projected, cagr, source}, "revenueEstimates":[{vendor, revenue, year, source, public}], "analystRankings":[…], "productLaunches":[…], "funding":[…], "domainAuthority":[{domain, da, source}] } … Do not estimate — say "NOT PUBLIC" if unknown. Return ONLY the JSON, no other text."* Parsed results are stored in the shared pipeline via `usePipeline().updateModule("intel", {marketData|marketPulse, …At})` (persisted in the `pipelines` Firestore collection / `xt_pipeline_snapshot`). Renders CLM Market Size, Revenue Estimates, Analyst Rankings, Recent Product Launches, Funding & Acquisitions.

## Data model summary

| Object | Key fields | Lives in |
|---|---|---|
| Scan doc (input) | `qid, query, persona, stage, analyses{llm:{mentioned, rank, sentiment, framing, response_snippet, supported/unsupported/hallucinated_vendors, _error}}` | `baseline_*` + per-run collections indexed by `m2_scan_meta` |
| News item | `title, source_url, source_name, publisher_url, published_date, summary, image, query, source, category, affects, impact_score, sources[]` | `intel_v2_news_archive` (+ cache) |
| Scorecard | `category_context, vendor_market_share[], analyst_rankings, capital_flow[], _provider` | `intel_v2_cache/market_pulse_scorecard` |
| Opportunity | `title, description, gap_type, opportunity_score, score_breakdown, recommended_play, primary_persona, effort, already_exists_on_sirion, verification_*` | `intel_v2_cache/opportunities_v1` + seen/history collections |
| Action | `title, rationale, tier, action_score, score_breakdown` | `intel_v2_cache/actions_v1` |
| Domino entities | industries / companies / signals / matrix snapshots / correlations / predictions | `intel_v2_domino_*` + `xt_domino_*` localStorage mirror |
| Cached compute envelope | `{computed_at, ttl_ms, data}` (+ runtime `_cachedAt, _cacheSource:"firestore"|"local"|"fresh", _cacheAgeMs`) | `intel_v2_cache/{key}` + `xt_intelv2_cache_{key}` |

## Storage keys (this module)

**Firestore (project `sirion-persona-stage`, REST API):** `intel_v2_cache`, `intel_v2_config` (doc `news_subscriptions`), `intel_v2_news_archive`, `intel_v2_snapshots`, `intel_v2_opportunities`, `intel_v2_opportunities_seen`, `intel_v2_opportunities_history`, `intel_v2_actions`, `intel_v2_domino_{industries,companies,signals,matrix_snapshots,correlations,predictions}`, `intel_v2_marketdata_archive`; reads `m2_scan_meta`, `m2_scan_results` (V1), `baseline_20260423_1718`, `baseline_20260423_2229` and any per-run scan collection.

**localStorage:** `xt_intelv2_cache_*`, `xt_intelv2_snapshot_YYYY-MM-DD` (90 kept), `xt_domino_*` (+ `_keys` indexes), `xt_research_log_v1`.

**sessionStorage:** `xt_token`, `xt_client` (AI proxy auth), `xt_m6v3_jump_to_view` (cross-module navigation).

## Integrations

**In:** Perception Monitor scan output (Firestore `m2_*` + baseline collections); worker AI proxy `/api/ai/chat`; `/api/gnews`; Firecrawl scrape `/api/scrape` + `/api/firecrawl-map` (Domino customer extraction); (deprecated) `/api/rss`.
**Out:** Content Strategy (m6v3) topic candidates via `useM6V3Store.addTopics` and `#/content-v3` navigation; campaign seed from `campaigns-gnROApsc.js`; Slack via "Copy for Slack" clipboard text; daily snapshots for trend history.

## For AI assistants

- **V3 is the live module** (nav id `intel3`, path `/intel`, also the app's default route). V1/V2 files still ship but are unrouted legacy; don't extend them.
- The real logic is in **`openai-BjkciBql.js`** (shared chunk), not in the CompanyIntelligence files — prompts, provider ladders, caching, news pipeline, Domino engine all live there. The V2/V3 files are mostly presentation.
- **Never make this module auto-run AI calls on mount.** The cacheOnly-then-Refresh pattern is a deliberate cost-control decision, verbalized in the UI ("Logging in doesn't auto-run AI calls anymore — those cost tokens").
- All LLM traffic goes through `claudeApi-DNyhT86p.js proxyChat` → worker `/api/ai/chat` with Bearer `sessionStorage["xt_token"]`; there are no direct provider API calls from the browser.
- Cache keys are versioned by suffix (`news_feed_90d_v3`, `opportunities_v1`, `actions_v1`) — bump the suffix to invalidate everyone's cache instead of clearing collections.
- The Opportunities prompt's site:sirion.ai verification requirement and the news prompt's strict topic filter are load-bearing product behavior; verification badges in the UI depend on `verification_search_url` / `already_exists_on_sirion` / `verification_evidence` fields.
- Domino is intentionally hidden from `client`/`client_portal` roles in V3; keep the `role==="admin"||role==="super_admin"` guard in both the tab list and the render branch.
- The GNews path replaced `/api/rss` on 2026-05-09 (Cloudflare IP block); the rss status stub and the "may need redeploy" warning are historical breadcrumbs, not active code paths.
