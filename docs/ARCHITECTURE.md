# Xtrusio Platform — Architecture Overview

**Read this first.** This is the master map of the Xtrusio AI-perception platform (client: Sirion, a CLM vendor). Each module has its own detailed doc in `docs/modules/` — read only the ones relevant to your task instead of the minified bundle in `sirion/assets/`.

## What the platform is

A GEO/AEO (Generative Engine Optimization) system. Goal: when buyers ask AI engines questions like "best CLM software 2026", Sirion — or URLs the team published — should appear in the answer and its citations. The platform runs the full loop:

```
m1 Question Generator ──► question bank (personas × stages × clusters)
        │
        ▼
Scan Your Queries (scanq) ──► asks 5 AI engines every question, extracts
        │                     mentions / rank / sentiment / citations
        ▼
m2 Perception Monitor + Reports + Exec Summary ──► metrics, KPI trajectory,
        │                                          content gaps
        ▼
m6v3 Content Strategy ──► gap → win-back plan → topics → articles written
        │                 IN-APP by LLM chain → health score → client review
        │                 → approved
        ▼
Link Strategy (M7v3) ──► matches approved articles against a 53-domain
        │                guest-posting catalog → placed → published URL recorded
        ▼
Citation Check loop ──► 3 verification queries generated per published URL
        │               → scanned in Scan Your Queries → per-engine grade:
        │               bullseye / adjacent / brand / pending / missed
        └──────────────► results feed back into m2 metrics and monthly
                         impact roll-ups (m2_impact_summary)
```

Support modules: **Company Intel (intel3)** — market/competitor enrichment feeding content candidates; **m3 Authority Ring** — domain database built from scan citations, ranks publication targets; **m4 Buying Stage Guide** — LinkedIn-based account analysis; **m5 CLM Advisor** — client-side vendor-selection wizard; **Link Strategy services** — Social Amplification (LinkedIn/Medium), PR Distribution, UGC & Community, Premium Outreach (stub), Video Studio / YouTube scripts.

## Deployment & infrastructure

- SPA (React/Vite, minified) on GitHub Pages, `CNAME app.xtrusio.com`. Root `index.html` is a "Coming soon" decoy; the real app is `/sirion/`. `sirion/perception/` is an older standalone duplicate build (subset) — ignore for changes.
- Backend: Cloudflare worker `https://xtrusio-ai.thedevimapro.workers.dev` — universal 5-provider AI proxy (`/api/ai/chat`), server-side scan runner (`/api/scan/*`), keys, storage, mail, costs, video. Full endpoint inventory: `modules/app-shell-and-infrastructure.md`.
- Data: Firestore project `sirion-persona-stage` via raw REST (~45 collections: `pipelines`, `m1_*`, `m2_*`, `m3`, `m7v3_*`, `m8_social`, `user_segments`, `syq_reports`, …) plus localStorage/sessionStorage/IndexedDB caches.
- Roles: `super_admin`, `admin` (Xtrusio team), `client`, `client_portal` (Sirion's review portal). Nav ids gate modules per role.
- No vendor API keys in the browser — all LLM calls go through the worker with a Firebase ID token / access-link token.

## The five scanned engines

claude (`claude-sonnet-4-5`), gemini (`gemini-3-flash-preview`), openai (`gpt-5-search-api`, fallback `gpt-4o-search-preview`), grok (`grok-3-mini-fast`), perplexity (`sonar-pro`). Two-stage per query: Stage 1 real answer with forced web search → Stage 2 Claude extracts strict JSON (mentioned, rank, sentiment, vendors_ranked, cited sources). Citations are normalized (`citationUrl`) and classified (`classifyUrl`: owned / 18 competitors / authority tiers, Gartner 1.0 … default 0.3).

## Article generation — IMPORTANT correction of a common assumption

The **live** Content Strategy (nav id `m6v3`, code in `index-BdFOWPPW.js`) writes articles **in-app** through the worker with a provider fallback chain: OpenAI `gpt-4o` (when a GPT model is selected — the UI's "GPT-5.2" maps to gpt-4o) → **Gemini 2.5 Flash with google_search** → Perplexity `sonar` → Grok → **Claude sonnet-5 with web_search**. There is **no copy-paste-to-ChatGPT step in the live flow.**

The copy-paste prompts (newsroom topic generator, Journalist Pack, "ARTICLE CREATION ENGINE", Humanizer) live in `ContentStrategy-DPvoh8Wv.js` — that is the **legacy M6 v1 chunk, lazy-defined but unrouted** (dead code). All prompts, legacy and live, are captured verbatim in `prompts/content-strategy-prompts.md`.

## The citation-check loop (how published URLs are tracked)

1. URLs enter tracking via "Mark as Published" / tracker CSV in M7v3 (`pipeline.m7v3.assignments` + `publishedRecords`), LinkedIn `markPosted` (`m8_social`), Medium assignments, Video Studio publish.
2. "Build citation queries" generates **3 buyer-style questions per article** (Gemini; no brand/URL in the question), qids `${articleId}__v1..3`, stored in the Firestore `user_segments` doc named **"Published Articles — Citation Check"**.
3. Operator runs that segment in Scan Your Queries (results → `m2_scan_results`).
4. On refresh, each article is graded **per engine**, client-side: `bullseye` (published URL cited on the *original* target question, score 1.0) → `adjacent` (URL cited on a generated verification query, 0.4) → `brand` (any sirion.ai/sirion.com citation, 0.2) → `pending` (<90 days or <2 scans) → `missed` → `unscanned`. Monthly roll-ups cached in `m2_impact_summary`.

Details: `modules/citation-check.md`.

## Known quirks / legacy surface

- `ContentStrategy-DPvoh8Wv.js` (M6 v1 prompts), `CompanyIntelligence` V1/V2, and the hidden `/links-v2` (m7v2 "LSv2") are legacy; the live modules are `m6v3`, `CompanyIntelligenceV3`, and M7v3.
- M7v3 placement matcher filters catalog rows on `row.state === "active"` while the bundled catalog carries `status: "Active"` — matching effectively depends on an uploaded/normalized catalog; otherwise it warns "no eligible domains".
- The repo contains only the **built** bundle (no source). Changes require either editing prompts/config via the app itself, patching the worker, or rebuilding from the (external) source project.

## Module doc index

| Doc | Covers (nav id) |
|---|---|
| `modules/question-generator.md` | m1 Question Generator, question bank, personas, Yin Matrix |
| `modules/scan-your-queries.md` | scanq UI, scan planning/dedupe/run workflow |
| `modules/scan-engine.md` | engine internals, citation extraction/classification, metrics |
| `modules/perception-monitor.md` | m2 dashboards, scores, formulas |
| `modules/reports-and-executive-summary.md` | Reports, Exec Summary, KPI trajectory, publish flow |
| `modules/content-strategy.md` | m6v3 pipeline: gaps → plans → topics → articles |
| `modules/article-workflow.md` | statuses, client portal, versions, spinoffs, M7 push |
| `prompts/content-strategy-prompts.md` | ~30 prompts verbatim (live + legacy) |
| `modules/link-strategy.md` | Link Strategy / M7v3 placement engine, catalog |
| `modules/citation-check.md` | published-URL citation tracking loop |
| `modules/link-strategy-services.md` | Social, PR, UGC, Premium, YouTube/Video Studio |
| `modules/authority-ring.md` | m3 domain database, publication targets |
| `modules/buying-stage-guide-and-clm-advisor.md` | m4, m5 |
| `modules/company-intelligence.md` | intel3 (V3 current, V1/V2 legacy) |
| `modules/admin-and-utilities.md` | Strategy Advisor, Mail Center, AI Costs, Activity, Settings |
| `modules/app-shell-and-infrastructure.md` | nav registry, roles, worker endpoints, Firestore collections, deployment |
