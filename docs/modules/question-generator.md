# Question Generator (nav id `m1`)

**Bundle:** `sirion/assets/QuestionGenerator-B9YkCISz.js` (~200 KB) plus the shared chunk `sirion/assets/yinMatrix-CX7lXYkw.js` (IndexedDB layer, CLM-maturity bucket taxonomy, bucket-detection prompt).
**Route:** `/questions` · Nav label: "Question Generator" · badge `1`.
**Tabs (role-gated via `ry = { m1: ["questions","matrix","research"] }`):** `Questions`, `Decision Matrix` (locked for non-admins), `Persona Research` (locked for non-admins).

## Purpose

m1 builds and maintains the **buyer-question bank** for the Xtrusio AI-perception pipeline: the realistic questions that CLM (Contract Lifecycle Management) buyers would type into AI assistants (ChatGPT, Perplexity, Gemini, Claude) about Sirion and its market. Every question is tagged with a **persona**, **journey stage**, **topic cluster**, and **CLM lifecycle stage**. The bank is seeded with static questions, expanded by Claude with web search, personalized from researched real decision makers (LinkedIn-based "Persona Research"), enriched with intent/fit metadata, and then exported downstream: to the Perception Monitor (m2) for scanning ("Export to M2"), to Scan Your Queries via saved segments (`m1.scanBatch`), and to Content Strategy (m6v3) which reads `pipeline.m1.questions` for topic generation.

## How it works

1. **Seed data.** On load the module merges three hard-coded sets into the bank:
   - `Et` — 50 static questions (11 awareness, 11 discovery, 15 consideration, 8 decision, 5 validation) using the `{company}` placeholder (replaced with the client name, default `Sirion`), `source:"static"`.
   - `Vo` — 10 "benchmark" questions (`bm-1`…`bm-10`, `source:"benchmark"`, badge `BM`), e.g. `"Sirion vs Icertis — which is better"`.
   - `qo` — hand-curated "perception target" sets keyed `fix` / `void` / `reinforce` (9 + 7 + 4 questions) each carrying `score` and `problem` (e.g. `"3/3 AIs say post-sig"`, `"0/3 AIs mention Sirion"`). Badges: `FIX` (red), `VOID` (orange), `REINF` (teal); fields `ptBucket`, `ptScore`, `ptProblem`, `source:"perception-target"`.
2. **AI generation.** "Generate" calls `callClaude` (claude-sonnet-5 + `web_search` tool via the `xtrusio-ai.thedevimapro.workers.dev` proxy) with the market-research prompt (`Ko`, below) and per-persona prompts built by `er()` from the persona-lens table `Zo`. Each persona run asks for exactly 12 questions; company research adds `companyIntel` (keyFindings, competitors, recentNews, marketPosition).
3. **Classification helpers.** `yi()` marks a question `micro` if it names the company, any competitor in `Xo = ["icertis","ironclad","agiloft","docusign","conga","juro","contractpodai","spotdraft","coupa","concord"]`, or a recency pattern; else `macro`. `ln()` maps free-text job titles to persona ids. Dedup uses `ue()` (djb2 hash of normalized query → base36, stored as `dedupHash`).
4. **Enrichment.** "Map intent & fit" batches questions (15 at a time) through `callClaudeFast` (claude-haiku-4-5-20251001) to add: `personaFit` (1–10), `bestPersona`, `intentType` (`generic|category|vendor|decision`), `volumeTier` (`high|medium|niche`), and `criterion` (one of the `cn` persona-criteria ids, e.g. `gc.playbook_enforcement`).
5. **Cluster recalibration.** At most every 30 days (`ti = 720*60*60*1000`) a Claude web-search call rescores the nine topic clusters' market weight (0–100) and trend; results persist to `localStorage["xt_cluster_cal"]` and `m1.clusterCalibration`.
6. **Persona Research tab.** Imports real decision makers (LinkedIn paste, bulk CSV/JSON, or "find similar" suggestions), cleans them (`hi` prompt), deep-profiles them (`fi` prompt → psycheProfile, painPoints, clmReadiness), then generates 5 pain-point questions per person (`sr` prompt, `source:"persona-research"`, `classification:"micro"`, jurisdiction-aware).
7. **Decision Matrix tab.** Two sub-views: **Yin Matrix** (per-company "multi-persona account attack grid" — uses the CLM-maturity buckets and pain library in `yinMatrix-CX7lXYkw.js`, run by Claude + optionally Grok in parallel, merged with `enginesAgree` confidence boost) and **Evaluation Scorecard** ("per-persona Sirion evaluation" — 1–10 grades per criterion in `cn`, auto-gradeable from m2 scan `positioning` scores, persisted to `localStorage["xt_decision_scores"]` and `m1.decisionScores`).
8. **Export.** "Export to M2" sends the whole bank to Perception Monitor; selecting questions and saving a segment writes `user_segments` + `m1.segments` / `m1.pendingSegment` / `m1.scanBatch` (`scanType:"selective"`) consumed by Scan Your Queries; Copy Table / Excel (`xlsx` chunk) / manual "paste a prompt into any AI" import round-trips also exist.

## Taxonomies (exact)

### Personas `G` (8, with buying-committee influence %)

| id | label | short | influence | desc |
|---|---|---|---|---|
| `cpo` | Chief Procurement Officer | CPO | 58 | "Primary CLM buyer -- procurement drives 55-60% of the decision" |
| `gc` | General Counsel | GC | 32 | "Senior legal authority -- legal group holds 30-35% of CLM decision" |
| `vplo` | VP Legal Operations | VP LO | 28 | "CLM evaluator and champion within the legal team" |
| `pd` | Procurement Director | PD | 22 | "Operational procurement lead, project manager for CLM rollout" |
| `cfo` | Chief Financial Officer | CFO | 10 | "Finance influencer -- part of the ~10% finance/IT/sales group" |
| `cio` | Chief Information Officer | CIO | 8 | "IT influencer -- evaluates integration and security compliance" |
| `cto` | VP IT / CTO | CTO | 6 | "Technical gatekeeper -- can block but rarely initiates" |
| `cm` | Contract Manager | CM | 5 | "End-user champion -- tests product during POC, influences adoption" |

Each persona also has `role`, `clmAngle`, `source` (all cite "Ron, Sirion meeting 2026-02-17" / "DJ demo request"), and `avatar` (pravatar URL). A richer persona-lens table `Zo` holds per-persona `lens`, `kpis`, `priorities`, `language` (vocabulary), `wouldAsk`, `wouldNotAsk` — injected verbatim into the per-persona generation prompt.

### Journey stages `Ie` (5)

`{id:"awareness",label:"Awareness",color:"#a78bfa"}`, `{id:"discovery",label:"Discovery",color:"#67e8f9"}`, `{id:"consideration",label:"Consideration",color:"#fbbf24"}`, `{id:"decision",label:"Decision",color:"#4ade80"}`, `{id:"validation",label:"Validation",color:"#fb923c"}`.

### Topic clusters `gt` (9, default weights; recalibratable)

| name | weight | trend |
|---|---|---|
| Contract AI / Automation | 95 | rising |
| Post-Signature / Obligations | 88 | rising |
| CLM Platform Selection | 85 | rising |
| Agentic CLM | 82 | rising |
| Implementation & ROI | 78 | rising |
| Procurement CLM | 74 | rising |
| Enterprise Scale | 65 | stable |
| Analyst Rankings | 62 | stable |
| Financial Services CLM | 58 | stable |

Each has `color`, `desc`, and `why` (evidence sentence, e.g. "9.2% of annual contract value lost post-signature per World Commerce & Contracting").

### CLM lifecycle tags `Lt` (3) and cluster→lifecycle default `Te`

`pre-signature` ("Authoring, negotiation, redlining, approvals", #3b82f6), `post-signature` ("Obligations, compliance, renewals, SLAs", #10b981), `full-stack` ("End-to-end platform, analytics, integrations", #a78bfa).
`Te` defaults: Contract AI / Automation → pre-signature; Post-Signature / Obligations → post-signature; Agentic CLM → pre-signature; all others → full-stack.

### Intent types

Two coexisting schemes:
- Enrichment (`intentType` on question records): `generic` (no vendor/category), `category` (CLM topic, no vendor), `vendor` (names a vendor), `decision` (comparison/ROI/evaluation).
- Paste-import format (`ai` prompt / `co` parser, also used in segments): `intentType` one of `REINF, EDUC, COMP, NAVIG, TRANS`; `stage` one of `PRE-SIGN, POST-SIGN, RENEWAL`.

### Persona evaluation criteria `cn` (Decision Matrix scorecard, weight 1–10)

- `gc`: playbook_enforcement 9, third_party_paper 8, regulatory_compliance 9, clause_risk_scoring 7, ma_due_diligence 7, litigation_prevention 8, external_counsel_control 6
- `cpo`: supplier_obligation_tracking 9, spend_visibility 8, rogue_spend_control 7, auto_renewal_mgmt 8, vendor_compliance 7, supplier_risk 6
- `cio`: erp_crm_integration 9, data_security 9, api_capabilities 8, sso_access 7, ai_governance 7, change_management 6
- `vplo`: workflow_automation 9, cycle_time_reduction 9, self_service_contracts 8, headcount_efficiency 8, legal_metrics_dashboard 7, tech_stack_consolidation 7
- `cto`: ai_model_quality 9, security_architecture 9, api_first_architecture 8, enterprise_scalability 8, ai_training_data 7, build_vs_buy 7
- `cm`: renewal_alerts 9, approval_workflow_speed 9, template_management 8, amendment_tracking 8, contract_repository 8, counterparty_collab 7
- `pd`: vendor_negotiation_support 8, auto_renewal_traps 8, supplier_contract_compliance 8, procurement_templates 7, category_spend_analysis 7, vendor_onboarding 6
- `cfo`: financial_exposure 9, revenue_recognition 9, contract_leakage 9, roi_measurement 8, board_reporting 7, financial_controls 7

## Data model

### Question record (bank entry)

```
{ id, query, persona, stage, cluster, lifecycle,           // taxonomy tags
  source: "static"|"benchmark"|"perception-target"|"ai"|"persona-research"|"kb"|"pipeline",
  classification: "macro"|"micro",
  company, companyUrl, generatedAt, searchContext, confidence,
  dedupHash,                                               // djb2(normalized query) base36
  // perception-target extras: ptBucket ("fix"|"void"|"reinforce"), ptScore, ptProblem
  // persona-research extras: jurisdiction, painPointRef, targetPersona, personaId
  // enrichment extras: personaFit (1-10), bestPersona, intentType, volumeTier, criterion, enrichedAt }
```

### Persona (research) record

`{ id, personaType (gc|cpo|…), name, title, company, companyUrl, location, linkedinUrl, headline, about, experience[], education[], certifications[], skills_top[], cleanedProfile, researchSummary, psycheProfile{decisionStyle, riskTolerance, innovationAffinity, buyingTriggers[], communicationPreference, motivations[], concerns[]}, painPoints[{pain,severity,relevance}], priorities[], clmReadiness (1-10), webFindings[], researchedAt, m4AnalysisId, m4Stage, m4ReadinessScore, m4AnalyzedAt }` — the last four fields are written back by the Buying Stage Guide (m4).

### Segment (`user_segments` doc)

`{ id: "seg_<ts>", name, creatorName, creatorEmail, questionIds[], questions[{id,query,persona,stage,topic,intentType,source,searchVolume,personaFit}], questionCount, createdAt }` — doc id `<creator>_<name>_<ts>`.

## Storage keys

| Where | Key | Contents |
|---|---|---|
| pipeline (`m1`) | `questions`, `generatedAt`, `generationId`, `companyIntel`, `clusterCalibration {weights, ts}`, `decisionScores`, `segments`, `pendingSegment`, `scanBatch {questions, createdAt, name, scanType:"selective"}` | synced pipeline snapshot (localStorage `xt_pipeline_snapshot` + Firebase merge; see index-BZaWgRns) |
| localStorage | `xt_cluster_cal` | `{weights:{clusterName:{weight,trend,evidence}}, ts}` |
| localStorage | `xt_decision_scores` | `{ "<persona>.<criterion>": 1-10 }` |
| localStorage | `xt_m1_questions_v2_<dedupHash>` | per-question docs (Perception Monitor's force-sync pushes these to cloud collection `m1_questions_v2`) |
| Cloud collections (worker DB `d`/`D`) | `m1_questions_v2`, `m1_personas`, `m1_macros`, `user_segments` | keyed by `dedupHash` / persona id |
| IndexedDB `xtrusio-m1` (v2, in yinMatrix chunk) | stores `questions` (keyPath `id`; indexes company/persona/stage/classification/generatedAt), `companyIntel` (keyPath `companyKey`), `macroBank` (keyPath `dedupHash`; tracks `timesGenerated`, `seenForCompanies`, first/lastSeenAt), `personas` (keyPath `id`) | local knowledge base |
| pipeline (`m4`, read by m1's Yin Matrix) | `companyBuckets`, `analyses` | company CLM-maturity buckets |

## Embedded LLM prompts (verbatim; long ones abridged)

### `Ko` — market-research question generation (system, claude-sonnet-5 + web_search)

> You are a Senior CLM Market Intelligence Analyst specializing in buyer-intent question research for enterprise Contract Lifecycle Management (CLM) platforms.
>
> Today's date: `${date}`.
>
> YOUR MISSION:
> Generate highly specific, research-backed buyer-intent questions that real decision makers would type into AI assistants (ChatGPT, Perplexity, Gemini, Claude) when evaluating CLM solutions.
>
> RESEARCH PROCESS:
> 1. SEARCH the web for the target company: recent news, funding, product launches, partnerships, customer wins, analyst mentions
> 2. SEARCH for competitive landscape: head-to-head comparisons, analyst rankings, market positioning
> 3. SEARCH for current CLM industry trends: new AI capabilities, regulatory changes, market shifts
> 4. Generate questions incorporating REAL findings
>
> QUESTION TYPES:
> - MACRO (industry-wide, ~40%): Apply broadly across CLM industry, no specific vendor mentioned
> - MICRO (company-specific, ~60%): Reference the specific company, competitors, recent events, unique differentiators
>
> JOURNEY STAGES:
> - awareness: Buyer realizes they have a contract management problem
> - discovery: Buyer actively researching CLM solutions and vendors
> - consideration: Buyer comparing specific vendors, doing deep evaluation
> - decision: Buyer making final choice, looking for validation
> - validation: Buyer post-purchase, confirming ROI and adoption
>
> CLM LIFECYCLE STAGES (CRITICAL — tag every question):
> - "pre-signature": Authoring, templates, redlining, negotiation, clause intelligence, approvals, collaboration
> - "post-signature": Obligation tracking, compliance, SLA monitoring, renewals, amendments, performance management
> - "full-stack": End-to-end platform, analytics, vendor selection, integrations, implementation, repository
>
> OUTPUT FORMAT — Respond ONLY with valid JSON (no markdown wrapping):
> `{ "companyIntel": { "keyFindings": [...], "competitors": [...], "recentNews": [...], "marketPosition": "..." }, "questions": [ { "q", "p": "persona_id", "s": "stage_id", "c": "Topic Cluster Name", "l": "pre-signature|post-signature|full-stack", "classification": "macro or micro", "context", "confidence": 0.85 } ] }`
>
> RULES:
> - Generate 15-25 questions total
> - Cover at least 3 different personas from the provided list
> - Cover at least 3 different journey stages
> - Cover ALL 3 lifecycle stages (pre-signature, post-signature, full-stack) — aim for balanced coverage
> - Each question must be 10-30 words
> - MICRO questions MUST use the actual company name (not {company})
> - MACRO questions must NOT mention any specific company
> - Every question must be something a real person would type into AI search
> - Avoid generic questions — incorporate real web research findings
> - DO NOT duplicate existing questions provided below

### `er()` — per-persona generation prompt (built dynamically)

> You generate buyer-intent questions that a `${persona.title}` would type into AI assistants (ChatGPT, Perplexity, Claude, Gemini) when evaluating CLM software.
>
> PERSONA LENS — `${TITLE}`: `${lens}` / KPIs they are measured on: … / Their priorities: … / Their vocabulary: … / They WOULD ask about: … / They would NEVER ask about: …
>
> *(optional)* REAL DECISION MAKER PROFILE — make questions hyper-specific to this person: Name/Decision style/Risk tolerance/Buying triggers/Pain points/Priorities/Profile
>
> TOPIC CLUSTERS TO COVER: … / QUESTION TYPES: MACRO (~40%) … MICRO (~60%): Reference `${company}` or specific competitors / JOURNEY STAGES: awareness, discovery, consideration, decision, validation / CLM LIFECYCLE: pre-signature, post-signature, full-stack
>
> RULES: Generate exactly 12 questions … 10-30 words each, natural phrasing (as typed into a search bar) … Cover at least 3 different journey stages and all 3 lifecycle stages / DO NOT DUPLICATE THESE QUESTIONS: (up to 30 listed) / OUTPUT — valid JSON only …

### `hi` — LinkedIn paste cleaner (system, haiku)

> You are a data extraction specialist. Your ONLY job is to take raw copy-pasted LinkedIn profile text (which contains tons of noise, navigation elements, ads, "People also viewed", etc.) and extract ONLY the meaningful profile data into a clean, structured JSON. … RULES: Strip ALL navigation text … Limit experience to last 5 roles max … Total output must be under 2000 characters — Be FAST — this is a preprocessing step

### `fi` — decision-maker profiler (system, sonnet + web_search)

> You are a Senior Sales Psychologist and Decision Maker Profiler specializing in Enterprise CLM … YOUR MISSION: Research this decision maker deeply. Understand their psyche, decision-making DNA, pain points, and buying triggers … OUTPUT JSON: psycheProfile { decisionStyle: "analytical|consensus|visionary|pragmatic", riskTolerance: "low|medium|high", innovationAffinity: "conservative|moderate|progressive", buyingTriggers, communicationPreference: "data-driven|narrative|peer-validated", motivations, concerns }, painPoints [{pain, severity, relevance}], priorities, clmReadiness (1-10), researchSummary, personalizedQuestionAngles, webFindings … painPoints: Must be role-specific (CPO cares about procurement, GC about legal risk, etc.)

### `Jo` — "find similar buyers" (system)

> You are a Senior B2B Market Intelligence Analyst specializing in CLM … find 8-10 similar CLM-relevant people at comparable companies … SIMILARITY CRITERIA: Same or adjacent industry / Revenue within 0.5x–2x / Same geographic market / Similar contract complexity … PERSONA COVERAGE: Mix buyer roles — GC, CPO, CIO, VP Legal Ops, CFO, CTO, Contract Manager, Procurement Director … LINKEDIN URL RULES … confidence 0.85+ = real profile URL; 0.6 = best-guess search … OUTPUT JSON `{sourceContext, suggestions:[{name,title,company,companyUrl,linkedinUrl,linkedinSearchUrl,location,companySize,companyRevenue,industry,personaType,clmSignals,confidence,reason}]}`

### `sr` — pain-points → questions (system, haiku)

> You are a Senior CLM Market Intelligence Analyst. Convert decision maker pain points into buyer-intent questions. RULES: Generate exactly 5 high-quality questions (1 per pain point, pick the top 5) … Include jurisdiction-aware angles … CRITICAL: The "c" field MUST be one of these EXACT cluster names: "Contract AI / Automation", "CLM Platform Selection", "Post-Signature / Obligations", "Procurement CLM", "Enterprise Scale", "Financial Services CLM", "Implementation & ROI", "Analyst Rankings", "Agentic CLM" — CRITICAL: The "l" field MUST be one of: "pre-signature", "post-signature", "full-stack" … OUTPUT JSON `{questions:[{q, p:"persona_type_id (gc, cpo, cio, vplo, cto, cm, pd, cfo)", s:"awareness|consideration|discovery", c, l, painRef, jurisdiction, confidence}]}`

### `lr` — CSV header mapping (system, haiku)

> You are a data mapping specialist. Given CSV column headers, map them to our target schema. TARGET FIELDS: name, title, company, linkedin_url, company_url, location, email, phone, notes, SKIP … OUTPUT `{mapping:{source_column_name:target_field}, confidence, unmapped:[…]}`

### Enrichment classifier (inline system `r`, haiku, 15-question batches)

> You classify CLM buyer-intent questions. Return a JSON array. Each element has: idx (integer), personaFit (1-10), bestPersona (gc|cpo|cio|vplo|cto|cm|pd|cfo), intentType (generic|category|vendor|decision), volumeTier (high|medium|niche), criterion (string or null).
> intentType: generic=no vendor/category; category=CLM topic, no specific vendor; vendor=names a vendor; decision=comparison/ROI/evaluation
> volumeTier: high=broad awareness (thousands/month); medium=category evaluation; niche=specific evaluation (dozens/month)
> criterion must be one of: `${all cn ids as persona.criterion}` …

### Cluster recalibration (inline system, sonnet + web_search)

> You are a B2B SaaS market analyst specializing in Contract Lifecycle Management (CLM). You will receive a list of CLM topic clusters. For each cluster, use current web data to assess its MARKET IMPORTANCE (0-100) and TREND (rising/stable/declining). Base your scores on: Search volume … Analyst report mentions (Gartner, Forrester, IDC) … Industry news … Community discussions (Reddit, LinkedIn, G2) … Vendor marketing emphasis. Return ONLY a valid JSON array … The highest-demand cluster should be 90-98, the lowest 45-65. Be precise — don't cluster them all around 70-80.

### `ai` — external-AI paste template (shown to user to run in any AI)

> Generate search questions for a B2B SaaS company. Return a JSON array only … Each question: `{ "query", "persona", "stage": one of PRE-SIGN, POST-SIGN, RENEWAL, "topic", "intentType": one of REINF, EDUC, COMP, NAVIG, TRANS, "searchVolume": int, "personaFit": 1-10 }` … Generate [N] questions about [TOPIC/THEME]. Focus on [PERSONA] buyers at [STAGE] stage.

### Yin Matrix bucket detection — see `yinMatrix-CX7lXYkw.js` export `B` (`Q`)

> "You are an elite sales intelligence analyst specializing in enterprise software. Your job is to do a COMPREHENSIVE technology audit of a company — not just CLM tools, but their ENTIRE digital infrastructure — then classify their CLM maturity." Three phases: deep research (parent company, ERP, procurement, HR, CLM tools, digital-transformation initiatives, partnerships, certifications, deals, news — with suggested search queries), classification into the 8 buckets below with confidence scoring (3+ signals = 0.8–1.0, 2 = 0.5–0.7, 1 = 0.2–0.4), and pitch intelligence (`entryPoint`, `quickWin`, `narrative`). JSON schema includes `bucketId`, `techAudit{erp,procurement,hr,clm,other,certifications,itPartners}`, `companyContext{parentCompany,parentTechArm,industry,size,digitalMaturity,keyContracts}`, `signals[{source,detail,url}]`, `pitchAngle`, `detectedTools`, `isHybrid`, `secondaryBucketId`. Run with Claude, and Grok in parallel if a Grok key exists (`Oo`/`Y` merges results: agreement bumps confidence +0.15, tech audits are unioned, `engines`, `enginesAgree`, `claudeBucket`, `grokBucket` recorded). Signal sources visualised in the UI: Job Postings, G2/Capterra Reviews, Tech Stack Detection, Employee Profiles, News & Press Releases, Vendor Case Studies, Career Page Analysis.

## CLM maturity buckets (shared taxonomy in `yinMatrix-CX7lXYkw.js`, array `f`)

| id | name | severity | sirionFit |
|---|---|---|---|
| `stone_age` | Stone Age (No dedicated tool) | 10 | high |
| `basic_digital` | Basic Digital (Storage with structure) | 9 | high |
| `esign_only` | Point Solution -- E-Signature Only | 8 | high |
| `procurement_side` | Point Solution -- Procurement Side | 7 | high |
| `legal_side` | Point Solution -- Legal Side | 7 | high |
| `midmarket_clm` | Mid-Market CLM (Partial lifecycle) | 5 | medium |
| `enterprise_clm` | Enterprise CLM -- Competitor | 3 | medium |
| `ai_native` | Modern AI-Native CLM (Where Sirion sits) | 1 | low |

Each bucket has `description`, keyword `signals[]`, `attackAngle` (e.g. stone_age: "Foundation play -- they need everything…"), and `toolExamples[]`. A **pain library** `_` maps each bucket to pains `{id, category, painText, businessImpact, sirionSolution}` across 7 pain categories `P`: `compliance_risk`, `cost_leakage`, `cycle_time`, `visibility_gap`, `integration_friction`, `renewal_risk`, `scalability`. A **persona-relevance matrix** `S` weights each pain category per persona 0–1 (e.g. `gc.compliance_risk: 1`, `cfo.cost_leakage: 1`, `cio.integration_friction: 1`, `vplo.cycle_time: 1`, `cm.renewal_risk: .9`). The Yin Matrix grid (`$`) ranks categories by summed persona weights; the "connecting thread" (`T`) is the category maximizing `totalWeight * (0.6 + 0.4 * coverage)`.

## Evaluation Scorecard auto-grading

`AutoGrade` reads m2 scan results, averages each question's `positioning` (across AI engines), maps questions to criteria (by enrichment `criterion`, else persona average), clamps 1–10 into `decisionScores["persona.criterion"]`, then displays a weighted percentage per persona: `round(Σ(score×weight) / Σ(10×weight) × 100)`.

## Integrations

- **In:** `pipeline.intel` (company name/url/industry autofill); m2 scan results (Auto-Grade); m4 `companyBuckets`/`analyses` (Yin Matrix); Grok key (optional 2nd engine).
- **Out:** `m1.questions` → Perception Monitor "Export to M2" (M1→M2 bridge: "The monitor will test each question across ChatGPT, Gemini, and Claude"); `m1.scanBatch` + `user_segments` → Scan Your Queries (`scanq`); `pipeline.m1.questions` → Content Strategy m6v3 (topic generator input) and Authority Ring m3 (question index `sn()` mapping qid → query/persona/stage for citation attribution); `m1_personas` ← m4 writes back `m4AnalysisId/m4Stage/m4ReadinessScore`.
- The **"Priority 35" / "All 154"** scopes seen in Reports (`index-ncWXFWao.js`, constants `baseline35` / `baseline154` in `constants-BELxrI9x.js`) are baseline *scan* question sets on the m2/reports side; m1 is the generator/curator of the bank those scans draw from (the perception-target `fix/void/reinforce` sets encode findings from those baseline scans, "N/3 AIs" style).

## For AI assistants

- All identifiers above are from the minified bundle; the variable names (`G`, `Ie`, `gt`, `Lt`, `Te`, `Et`, `Vo`, `qo`, `cn`, `Zo`, `er`, `Ko`, `fi`, `Jo`, `sr`, `hi`, `lr`, `ai`, `yi`, `ln`, `ue`) will change on rebuild — search by string literals (persona labels, cluster names, prompt openings) instead.
- Persona/stage/cluster/lifecycle ids are contract-critical: they are stored in question records, cloud docs, segments, and read by m2/m3/m6v3. Do not rename without a migration.
- LLM calls go through `claudeApi-DNyhT86p.js` → worker `https://xtrusio-ai.thedevimapro.workers.dev/api/ai/chat` with `sessionStorage.xt_token`; models: `claude-sonnet-5` (with `web_search_20250305` for research calls), `claude-haiku-4-5-20251001` (fast classification), optional Grok/Gemini.
- Dedup is by normalized-query hash; merging is `mergeMetadata`-aware — seeds re-merge on every load without duplicating.
- The 30-day recalibration lock and the 15-question enrichment batch size are hard-coded.
- The Yin Matrix taxonomy lives in the shared `yinMatrix` chunk and is consumed by both m1 (Decision Matrix tab) and m4 (bucket assignment on analysis); changing bucket ids breaks `m4.companyBuckets` lookups.
