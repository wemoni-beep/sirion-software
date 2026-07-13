# Buying Stage Guide (nav id `m4`) & CLM Advisor (nav id `m5`)

**Bundles:** `sirion/assets/BuyingStageGuide-BOi88y5N.js` (~107 KB) and `sirion/assets/CLMAdvisor-CvNNusQf.js` (~53 KB). m4 also imports the shared `yinMatrix-CX7lXYkw.js` chunk (CLM-maturity buckets + persona helpers).
**Routes:** `/buying-stage` (label "Buying Stage Guide", badge `4`) and `/advisor` (label "CLM Advisor", badge `5`).

---

## Part 1 — Buying Stage Guide (m4)

### Purpose

m4 is a **sales-intelligence analyzer for a single decision maker**. Paste a LinkedIn profile (or pick a persona researched in m1), and a three-step Claude pipeline (analyze → verify → outreach) produces: the prospect's **buying stage** (awareness / consideration / discovery), a **readiness score** (0–10), a **CLM maturity bucket** for their company (shared 8-bucket taxonomy), signal-scored dimensions, risk factors, a personalized outreach hook, and a full personalized outreach report (stage diagnosis, "$X.XM waste" financial case, Sirion lifecycle mapping, CTA). Results are saved to the `analyses` cloud collection and rolled up into `pipeline.m4` for other modules (m1's Yin Matrix reads `m4.companyBuckets`; m5 reads `m4.latestStage`).

### Buying-stage taxonomy `U` (exact)

| id | label | tagline | description |
|---|---|---|---|
| `awareness` | Awareness (#F59E0B ◉) | "You Seriously Need CLM" | "Manual processes, no central repository" |
| `consideration` | Consideration (#3B82F6 ◎) | "You Know the Pain — Now Find the Cure" | "Actively researching CLM vendors" |
| `discovery` | Discovery (#10B981 ◈) | "You're Close — Choose Wisely" | "Replacing/integrating CLM solution" |

(Note: m4's 3-stage model is distinct from m1's 5-stage journey model; m4's stages match the first/middle/late buckets that m1 also uses for pain-point questions.)

### Pipeline (all via `claudeApi` worker proxy)

1. **Clean** — LinkedIn paste → `callClaudeFast` (haiku) with the same "data extraction specialist" prompt as m1 (strip nav noise, ≤2000 chars, last 5 roles, top 5 skills).
2. **Analyze** — `callClaude` (claude-sonnet-5 + web_search) with system prompt `Ri` (abridged):

   > You are a Senior Sales Intelligence Analyst specializing in Enterprise SaaS and CLM (Contract Lifecycle Management) for Sirion.
   > CRITICAL: Today's date is `${date}`. All information MUST reflect CURRENT status as of today.
   > You will receive: 1. A CLEANED LINKEDIN PROFILE (structured JSON)… 2. A COMPANY WEBSITE URL — fetch this URL… 3. Then do additional web searches for deeper intelligence.
   > STEP-BY-STEP PROCESS: 1. USE the cleaned LinkedIn JSON (name/title/company, About, work history — check if previous companies used CLM tools, skills & certifications — "IACCM, legal ops = huge CLM signal", recent activity, education). 2. FETCH the company website… 3. SEARCH the web for: Tech Stack & Legacy Indicators (SharePoint, DocuSign, SAP Ariba, Coupa, competitor CLMs like Icertis, Ironclad, Agiloft); hiring patterns (Legal Ops, Contract Admin, Procurement Transformation roles); M&A activity, regulatory news, growth signals; competitor CLM usage; industry-specific challenges. 4. CROSS-REFERENCE work history (prior CLM exposure, consulting background, tenure: "New = mandate to change; Long tenure = established relationships", certifications IACCM/PMP/Six Sigma). 5. ANALYZE LinkedIn activity… For EVERY M&A deal or major event, do a SEPARATE search to confirm CURRENT status.
   > JSON output: `decision_maker{name,title,company,location,tenure_current_role,previous_roles[{…,clm_relevance}],certifications,linkedin_activity_signals,profile_summary_insights}`, `company_profile{industry,estimated_revenue,employee_count,headquarters,global_presence,recent_news,website_insights}`, `analysis{tech_stack, hiring_patterns, digital_footprint, competitor_usage, decision_maker_signals}` — each `{findings (≤2 sentences), signals[≤4-5 tags of 3-7 words], score (0-10)}`, `stage_scores{awareness,consideration,discovery}`, `primary_stage`, `confidence ("high"…)`, `readiness_score` (e.g. 7.2), `outreach_hook` (≤3 sentences), `recommended_actions` (4-5, verb-first, ≤15 words), `risk_factors` (3-4, ≤15 words), `summary`, `personalization_notes`.
   > STRICT FORMATTING RULES — signals are "short TAGS, not sentences" (examples: "No CLM Platform Detected", "SAP Ariba Ecosystem", "Active M&A Integration", "Posted About Supply Chain")…

   After analysis, m4 rule-matches the returned tech/competitor/digital signals against the shared bucket taxonomy (`rt` = yinMatrix signal matcher `W`) and writes the company's **CLM maturity bucket**.
3. **Verify** (optional, gold "Verify for Latest Developments" button) — prompt `Ci`: "You are a quick fact-checker… Do ONLY 2-3 targeted web searches max: 1. '[Company] acquisition merger latest 2025 2026'… 2. '[Person] [Company] current role'… DO NOT search every claim. Only catch what would cause EMBARRASSMENT (deal closed vs pending, person left, etc)." Returns `{overall_accuracy, total_claims_checked, corrections_needed, corrections[{severity, original_claim, corrected_claim, field_path, evidence}], verified_claims, updated_summary, updated_outreach_hook, updated_risk_factors, freshness_notes}`.
4. **Outreach report** — prompt `Ti`: "You are a Senior Sales Strategist for Sirion, the leading AI-native CLM platform… Use CORRECTED/VERIFIED data only. ANALYSIS DATA: {ANALYSIS_DATA} VERIFICATION CORRECTIONS: {VERIFICATION_DATA}… Generate a detailed, PERSONALIZED outreach report…" JSON sections:
   - `stage_section` — headline (≤8 words), stage_name, diagnosis speaking TO the prospect, `current_state_bullets` (Current Reality / Industry Position / Risk Exposure);
   - `why_section` — "You're Losing $X.XM Every Year" style headline, `total_estimated_waste`, `waste_metrics` with canonical example rows: Revenue Leakage 9.2% "$9.2M" (World Commerce & Contracting 2024), Cycle Time Waste 3.4 wks (Aberdeen), Compliance Risk $4.5M (Deloitte Regulatory Cost Index), Resource Drain 42 hrs/wk (McKinsey), Missed Renewals 24% (Gartner Procurement Research 2024);
   - `how_section` — "Sirion: Your Partner at Every Stage" with five `lifecycle_stages` (Vendor Selection 🔍, Authoring ✍️, Approval ✅, Obligations 📋, Renewals 🔄) each `{current_pain ≤15w, sirion_solution ≤15w, key_features[2], outcome ("60% faster"), score 0-100}`;
   - `closing` — personalized CTA.

### UI structure

Stepper wizard (paste LinkedIn / optional company URL → progress steps → report). Report page: stage banner with tagline, readiness dial (score/10, ring SVG), CLM Maturity chip (bucket name colored by severity, "Unconfirmed" if confidence <0.5, Sirion Fit label, attack angle box), stage_scores bar, dimension table (DIMENSION / SCORE / RATIONALE / SOURCES), decision-maker signals, 🎯 OUTREACH HOOK card, recommended actions, risk factors, verification card (corrections list, freshness notes), outreach report renderer (charts: radar, bars, area "Sirion Impact"), standalone HTML export (self-contained report download), and an **Account Intelligence** view (analyses grouped by company, "Hottest First" sort, per-company bucket + pains from the shared pain library) plus **Analysis History** (last 30, from cloud).

Input alternatives: "Select Persona from M1 Research" dropdown (uses m1 `m1_personas`; after analysis it writes back `{m4AnalysisId, m4Stage, m4ReadinessScore, m4AnalyzedAt}` to the persona via the yinMatrix `updatePersona`), "-- or paste LinkedIn below --".

### Data model & storage

- Cloud collection **`analyses`** (save/getAll/update/delete): `{analysis_data, verification_data, outreach_data, cleaned_profile, company_url, company_name, person_name, person_title, primary_stage, readiness_score, clm_maturity{bucketId,bucketName,confidence,matchedSignals}, verified, created_at}`.
- pipeline **`m4`**: `analyses[] {person, company, title, stage, readiness, bucketId, analyzedAt}` (rollup), `latestStage`, `latestReadiness`, `companyBuckets{ [company]: {bucketId, bucketName, detectedSignals, confidence, analysisId, severity, sirionFit, detectedAt} }`, `analyzedAt`, `generationId`.
- No module-specific localStorage keys.

### Integrations

**In:** m1 personas (selector + cleaned profiles), shared yinMatrix bucket taxonomy/pain library. **Out:** `m4.companyBuckets` → m1 Decision Matrix "Yin Matrix" (account attack grid, bucket override picker); `m4.latestStage`/`latestReadiness` → m5 CLM Advisor prefill trigger and Executive Summary rollups; persona write-back → m1 Persona Research cards.

---

## Part 2 — CLM Advisor (m5)

### Purpose

m5 is a **vendor-selection wizard** ("Find Your Perfect CLM Platform"): a fully client-side, no-LLM scoring engine that ranks **15 CLM vendors** against a buyer profile (persona, industry, company size, pain points, maturity, priority ordering). It doubles as a sales asset showing where Sirion wins (post-signature/analytics) and is honest about competitor strengths. Output: ranked vendor list with score breakdowns, radar chart across six capability dimensions, vendor detail cards (strengths/concerns/bestFor/analyst standing), an exportable HTML report with methodology, and a `m5.recommendations` write into the pipeline.

### Vendor database `x` (15 vendors; scores 0–100 per dimension)

Tiers: **Leader** — sirion, icertis, ironclad, agiloft; **Strong Performer** — linksquares, docusign (DocuSign CLM), conga, contractpodai, evisort (Evisort/Workday); **Notable** — juro, spotdraft, cobblestone, pandadoc, onit, malbek.

Each: `{id, name, tier, color, tagline, scores{preSig, negotiation, execution, postSig, analytics, repository}, pricing{min,max $K/yr}, impl{min,max weeks}, scale{min,max contracts/yr}, strengths[], concerns[], bestFor[], analyst}`.

Sirion row (exact): `scores{preSig:72, negotiation:80, execution:72, postSig:96, analytics:94, repository:85}, pricing{80–150}, impl{16–24 wks}, scale{500–50,000}`, tagline "AI-Native Contract Intelligence Platform", strengths include "Highest-rated post-signature capabilities (Gartner 4.22/5)", concerns include "Pre-signature workflow less mature than specialist competitors", analyst "Forrester Leader · Gartner Customers Choice". For contrast: Ironclad `preSig:95/postSig:55`, Icertis `pricing 120–250`, Juro `postSig:38, impl 4–8 wks`, PandaDoc `postSig:35, scale ≤500`.

### Buyer-profile taxonomies (exact ids)

- **Personas `se` (8, different set from m1):** `cpo` (Chief Procurement Officer), `gc` (General Counsel), `clo` (Chief Legal Officer), `legalOps` (VP Legal Operations), `procurement` (Director of Procurement), `cfo`, `coo`, `salesOps` (Sales/Revenue Operations). Each has `typicalPains` and a default 8-item `priorities` ordering (e.g. cpo: postSig, analytics, compliance, negotiation, repository, preSig, execution, cost).
- **Industries `J` (12, with compliance weight `w`):** pharma 1.2 (FDA/HIPAA/BAA/GxP), financial 1.15 (SOX/FINRA/GDPR/Basel III), healthcare 1.18, technology 1.0, manufacturing 1.05, energy 1.1, government 1.25 (FedRAMP/FISMA/ITAR), retail 1.0, telecom 1.08, professional 1.0, education 1.05, realestate 1.02.
- **Company sizes `ae` (5):** startup (1–50, 10–100 contracts/yr, vol 50), smb (50–500, vol 300), mid (500–2,000, vol 1000), ent (2,000–10,000, vol 5000), large (10,000+, vol 15000).
- **Pain points `he` (10, each `implies` two dimensions):** nda_volume "Drowning in routine contracts" →preSig,execution; slow_cycles →preSig,negotiation; version_chaos →repository,preSig; renewal_miss →postSig,analytics; obligation_blind →postSig,analytics; audit_gaps →postSig,compliance; no_analytics →analytics,repository; manual_extraction →analytics,postSig; integration_gaps →execution,repository; adoption_low →preSig,execution.
- **Priority dimensions `K` (8, orderable):** postSig "Post-Signature Intelligence", preSig "Pre-Signature Speed", analytics, negotiation "Negotiation Power (AI redlining, playbooks, risk)", execution "Execution & Adoption", compliance "Compliance & Governance", repository "Repository & Search", cost "Cost Sensitivity".
- **Maturity levels `Y` (0–4):** 0 Chaos "Contracts scattered everywhere. No visibility.", 1 Reactive, 2 Controlled, 3 Optimized, 4 Intelligent "Predictive. Autonomous. Strategic asset."

### Scoring algorithm `ni` (exact mechanics)

1. **Weighted base:** priority rank k gets weight `max(0.2, 3 − k*0.4)` (rank 1 = 3.0x … rank 8 = 0.2x); each selected pain adds its two implied dimensions at weight 0.2. Base = weighted mean of vendor dimension scores ×100.
2. **Context modifiers `s` (clamped ±25):** size fit (e.g. startup: −15 if `scale.min>300`, +10 if `scale.min≤50`, −10 if `pricing.min>80`; large: −20 if `scale.max<10000`, +5 if `scale.max≥50000`); high-compliance industries (`w≥1.15`) add `round((mean(postSig, compliance|analytics) − 75)/5)`; technology industry favors preSig/execution; government gives fixed boosts (docusign +6, agiloft +8, cobblestone +5, −8 if small-scale); low maturity (≤1) rewards fast implementation (`impl.min≤6` +6) and punishes slow (≥16 −5, ≥20 −4); high maturity (≥3) rewards mean(postSig, analytics, repository); execution in top-3 priorities rewards fast impl; cost in top-3 rewards `pricing.max≤60` +8 and punishes `pricing.min≥120` −4.
3. **Final:** `score = clamp(round(base × (1 + adj/100)), 15, 97)`; sorted desc. Results store `{id, score, base, adj}`.

The exported report's methodology section states it verbatim: "Step 1 — Weighted Base Score: Priority #1 gets 3.0x weight, #8 gets 0.2x. Pain points add alignment bonuses. Step 2 — Context Modifiers: Size fit, industry compliance burden, maturity, speed, and cost adjustments…"

### UI structure

3-step wizard: (0) profile — persona cards, industry list with compliance tags, size selector, maturity slider; (1) needs — pain-point multi-select, drag-order priorities (grip handles), live "top vendors" preview; (2) results — ranked list with tier badge and `$min–max` pricing, radar chart over the six scored dimensions (`le` labels: Pre-Signature, Negotiation, Execution, Post-Signature, Analytics, Repository), per-vendor detail (strengths / "Watch Out For" concerns / bestFor chips / analyst line / stats grid incl. Tier), "RECOMMENDED NEXT STEPS", HTML report download, and a "Need Help…" CTA card. The "See My Results — 15 Ve[ndors]" button persists recommendations.

### Storage & integrations

- pipeline **`m5`**: `{recommendations:[{vendorId, score} ×5], generatedAt}` — written when the user proceeds to results. No localStorage, no cloud collections, **no LLM calls** (purely deterministic).
- **In:** `pipeline.m4.latestStage` — when a m4 analysis exists and no persona is chosen yet, a state flag triggers prefill/suggestion behavior.
- **Out:** `m5.recommendations` available to Executive Summary / reports.

---

## For AI assistants

- m4 and m5 share the *word* "persona" with m1 but **not the id space**: m1/yinMatrix use `gc,cpo,cio,vplo,cto,cm,pd,cfo`; m5 uses `cpo,gc,clo,legalOps,procurement,cfo,coo,salesOps`. m4 has no persona taxonomy of its own — it consumes m1 personas and emits stages.
- m4's 3-stage model (`awareness|consideration|discovery`) is authoritative for `m4.latestStage`; do not confuse with m1's 5-stage journey (`awareness…validation`) or the CLM lifecycle tags (`pre/post-signature, full-stack`).
- The CLM maturity buckets (`stone_age`…`ai_native`), pain library, and persona-relevance weights live in `yinMatrix-CX7lXYkw.js` and are shared by m1 and m4 — see `docs/modules/question-generator.md` for the full table.
- m4's three prompts (`Ri` analyze, `Ci` verify, `Ti` outreach) enforce strict tag-style formatting; UI rendering assumes those shapes (signals as chips, waste_metrics as stat cards, five lifecycle_stages). Changing the JSON contract breaks the report renderer and the HTML export.
- m5's vendor scores/prices/timelines are hand-curated marketing data embedded in the bundle (sources cited inline: Forrester, Gartner, G2, MGI 360); updating them means editing the `x` map — there is no backing API.
- The score clamp (15–97) is deliberate so no vendor ever shows 0 or 100; `adj` is capped ±25 before applying.
