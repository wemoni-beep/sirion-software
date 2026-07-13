# Scan Engine internals

**Bundle files:** `baselineScanner-B4UVyWOc.js` (the current two-stage engine), `scanEngine-BVO7e_Tl.js` (legacy single-stage engine + scoring/calibration), `scanMergeRules-CM6pCoAv.js`, `scanCatalog-BNhunwfC.js`, `scanStats-x9j0rlX6.js`, `compute-GsiJKaNN.js`, `helpers-BcI-JKAY.js`, `constants-BELxrI9x.js`, `citationUrl-BT04I8cM.js`, `classifyUrl-BZobdwWM.js`, `narrativeClassifier-UrOyvc-P.js`, `loadCombined-BGLlSB-M.js`.

## Purpose

This layer runs buyer-intent queries against five LLMs, extracts structured perception data (mentions, rank, sentiment, vendors, cited sources, lifecycle framing), classifies citations/narratives, computes scores (visibility, share of voice, narrative score, verifiability), and persists everything to Firestore `m2_*` collections. Two engines exist: the **baselineScanner** (current, two-stage: real answer → Claude extract, per-attempt persistence, resume-safe) and the older **scanEngine** (single fan-out + one batched Claude-Haiku analysis, used by Perception Monitor). A server-side twin of the baselineScanner runs on the Cloudflare worker (see `llm-api-and-storage.md`).

## Which LLMs are scanned

`constants-BELxrI9x.js`: `LLM_IDS = ["claude","gemini","openai","grok","perplexity"]`; display names `{claude:"Claude", gemini:"Gemini", openai:"ChatGPT", grok:"Grok", perplexity:"Perplexity"}`; chart colors `{claude:"#10b981", gemini:"#f59e0b", openai:"#3b82f6", grok:"#fb923c", perplexity:"#f472b6"}` (the SYQ UI uses a second palette `claude #a855f7 / gemini #3b82f6 / openai #10b981 / grok #f97316 / perplexity #ec4899`). Company constant `"Sirion"`; owned domains `["sirion.com","sirion.ai","sirionlabs.com"]`; baseline scan ids `baseline_20260423_1718`, `baseline_20260423_2229`; scopes `all / baseline154 / baseline35`; stage buckets `full_stack / pre_signature / post_signature / unclassified`; strong/weak/lost badge config.

### baselineScanner Stage-1 models (`H`) — all with forced web search

| LLM | Model | Request shape | Citations parsed from |
|---|---|---|---|
| claude | `claude-sonnet-4-5-20250929` | anthropic body + `tools:[{type:"web_search_20250305",name:"web_search",max_uses:10}]`, max_tokens 4000 | `web_search_tool_result.search_results[]` + text-block `citations[]` (with `cited_text`, `start/end_char_index` → excerpt/anchor_text) |
| gemini | `gemini-3-flash-preview` | `systemInstruction` + `tools:[{google_search:{}}]`, maxOutputTokens 4000 | `groundingMetadata.groundingChunks/groundingSupports` (anchor text + `position_in_answer:[start,end]`); `vertexaisearch.cloud.google.com` redirect URLs resolved server-side via `POST /api/util/resolve-redirect` |
| openai | `gpt-5-search-api` (auto-fallback to `gpt-4o-search-preview` on 404/model error) | chat body + `web_search_options:{search_context_size:"high"}`, max_tokens 2000, client-side TPM limiter (default 450 000 tokens/min, override `localStorage["xt_openai_tpm"]`) | `message.annotations[]` `url_citation` entries (start/end index → anchor_text) |
| grok | `grok-3-mini-fast` | `input:[{role:"user",…}]` + `tools:[{type:"web_search"}]` | top-level `citations[]` |
| perplexity | `sonar-pro` | chat body, max_tokens 2000 | top-level `citations[]` |

Stage-1 system prompt (`me(name)`): *"You are <Claude/Gemini/ChatGPT/Grok/Perplexity>, a helpful AI assistant. The current date is <today>. For questions about current market leaders… you MUST use the web_search tool before answering… Cite sources inline… Write in natural prose — no audit templates…"*

Timeouts (`lt`): claude 150 s, gemini/openai/perplexity 120 s, grok 90 s; Stage-2 60 s. Per-model send gaps (`Pt`, overridable via `localStorage["xt_gap_<model>_ms"]`): claude 5 s, gemini 10 s, openai 15 s, grok 5 s, perplexity 5 s; after 3 consecutive 429s the gap is boosted 4× for 300 s ("adaptive throttle"). 429 responses honor `Retry-After` (clamped 5–90 s); openai retries up to 10×, grok/perplexity up to 6×.

### Stage 2 — extraction

Every completed Stage-1 answer is sent to Anthropic **`claude-sonnet-4-5-20250929`** (`ze`, max_tokens 2000) with the extraction prompt (`Ge`): returns strict JSON
`{sirion_mentioned:"YES"|"NO", sirion_position:int|null, sentiment, lifecycle_stage:"pre-signature"|"post-signature"|"full-stack"|"not_applicable", vendors_ranked:[{name,rank,sentiment,framing}], sources:[{url,type,description}], content_gaps, notes}`
with hard rules: only vendors/sources explicitly named; prefer null over guess; mention = literal company name only; sequential ranks when unranked lists; sentiment only on evaluative language; plus a consistency self-check (mentioned⇔vendors_ranked entry, ranks unique 1..N). Parse fallback = first `{…}` slice; failures are stored as `extract_status:"parse_fail"`.

## How a scan runs (`runScan` / `Xe`)

1. Validate `{scanId, questions, models, reps>=1, company, mode:"economy"|…}`. Optional `reusePlan` (from `_n`: latest complete attempt per `qid|model|attempt` across all history) clones prior attempt docs into the new scan (`reused:true, source_scan_id`) instead of re-calling APIs; `reuseOnly:true` drops questions with incomplete coverage.
2. Write run doc to `m2_scan_runs/{scanId}` (`status:"running"`, stats skeleton, `started_at`).
3. **Resume preload:** load `m2_scan_attempts` for this scan; build `completedKeys` set of `qid|model|attempt` already complete (parse_fail/error excluded) — those are **skipped** (`stats.skipped++`, log "already complete, skipping"). This is the engine-level dedupe.
4. One sequential stream **per model**, all models in parallel. For each question × rep: save a `pending` attempt doc, throttle, Stage 1, Stage 2, then save the full attempt doc `m2_scan_attempts/{scanId}_{qid}_{model}_rep{n}` with `{scan_id,qid,query,persona,stage,model,attempt,status:"complete"|"error",method:"api",search_mode:"api_enforced",response_text,finish_reason,citations(≤30),citation_count,unique_domains,stage1_model,stage1_model_used,extract,extract_status,extract_reason,extract_raw(≤8000),stage2_model,durations,company,mode,created_at,completed_at}` (3 save retries). A manual-paste path (`On`) stores `method:"manual_paste"`.
5. Finish: update `m2_scan_runs` with `status:"complete"|"aborted"`, per-model stats `{done,ok,err,parseFail,skipped,total}`, `log_tail` (last 500 of a 1500-entry ring), `reuseManifest`, `analyzed:false`.

### Analysis (`analyzeScan` / `gn`) — no new API calls

1. Load attempts, keep `status==="complete"`, group by qid (`Mt`), per model pool all reps (`Tt`):
   - **vendors_mentioned**: union of `extract.vendors_ranked` across reps (best position, first framing, non-neutral sentiment wins).
   - **cited_sources**: union keyed by URL of Stage-1 `citations` (url/domain/title/excerpt/anchor_text/position_in_answer) merged with Stage-2 `extract.sources` (adds `type`, `context`).
   - **mentioned** = majority vote of `sirion_mentioned==="YES"` across reps; **rank** = median `sirion_position`.
   - **truthfulness_score**: share of non-target vendors whose name appears in the pooled citation text (title+excerpt+context) → `supported_vendors` / `unsupported_vendors` (= `hallucinated_vendors`); 1 if no vendors, 0 if vendors but no citations.
   - **consistency_score** (only when reps≥2): `0.7·vendorOverlap(Jaccard between reps) + 0.2·mentionAgreement + 0.1·positionStability(1−σ/5)` with breakdown stored.
   - `sirion_content_cited` = any pooled source whose domain/url/title/excerpt/context contains the company name.
   - `narrative` = lexicon classifier (below) on the full response.
   - **Gap detection** (`Et`, `schemaVersion:2`) writes scored gap objects per model with `auditTrail:{stage2Prompt, stage2RawResponse, formulaUsed, rationale}` and templated recommendations. Severity formulas (config `re`, floor 20; labels critical≥80 / high≥60 / medium≥40 / low): `absence: 60 + 20·freq + 15 topCompBump(top comp ≤3) − 10 nicheIntentPenalty`; `outrank (Δrank≥2): 25·rankDelta + 10·freq + 20 if comp rank 1`; `lifecycle_mismatch: 70 + 15 postSigOnlyBump + 10 repeatedBump` (fires when extract says post-signature but query intent regexes say pre-sig/full-stack); `citation_orphan: 55 + 20 noSirionSourceBump + 15 competitorCitedBump` (mentioned, citations exist, none back Sirion); `sentiment_drag: 50 + 20 negativeFramingBump` (negative sentiment or any of 15 negative phrases: "niche","narrow","limited","lacks","doesn't offer","weak","trailing","post-sign only"… ).
2. Build save payload (`Nt`): scores via scanEngine `Me` + five-metrics summary (`He`): `visibility` (% mention), `narrative` (dominant label + full/pre/post %, narrativeScore), `shareOfVoice` (% of vendor mentions), `sentiment` (pos/neu/neg %), `competitivePosition` (median Sirion rank + win-rate vs best competitor). Verifiability (`Ke`): avgCitationsPerQuery, uniqueDomains, truthfulnessRate, hallucinationRate (=100−truthfulness), consistencyRate, unsupportedClaims. Narrative summary via `narrativeClassifier.r`.
3. Persist: `m2_scan_meta/{scanId}` (status complete, tier Quick/Baseline/Stress = N 1/3/5, llms, company, `segmentId/sectionId = "baseline_report_<scanId>"`, `userSegmentDocId/Id/Name`, queryIds, scores, verifiability, narrativeSummary, `published:false` implicitly for SYQ flow); one `m2_scan_results/{scanId}__{qid}` per question (`{qid,query,persona,stage,analyses:{model:…},scanId}`); `m2_content_gaps/{gapId}`; report section `m2_sections/{baseline_report_<scanId>}`; run-meta patch (`analyzed:true`); optional segment link (`user_segments` doc gets `latestScanId/latestSectionId/latestFiveMetrics/scanHistory(≤20)`).

## scanEngine-BVO7e_Tl.js (legacy engine, still used for scoring)

- Single-stage fan-out per query (concurrency 3 queries), models `J`: economy `{claude:"claude-haiku-4-5-20251001", gemini:"gemini-2.5-flash-lite", openai:"gpt-4o", perplexity:"sonar", grok:"grok-4-latest"}`, premium `{claude:"claude-sonnet-5"+web_search tool, gemini:"gemini-2.5-flash"+google_search, openai:"gpt-4o-search-preview"+web_search_options(medium), perplexity:"sonar-pro", grok:"grok-4-latest"+search_parameters}`; max_tokens 2400/4096; min-gap throttle `{claude 1500, gemini 3500, openai 3000, perplexity 1500, grok 1500} ms`; retries N=4 with exp backoff and Retry-After.
- Query system prompt `F` opens with **"CRITICAL — FRESH SESSION REQUIREMENT"** (no memory/personalization, fresh web search per query, answer as a first-time user) then formatting rules for decision-maker answers.
- **Batched analysis** (`je`): all model answers for one query go to Anthropic `claude-haiku-4-5-20251001` (max_tokens 8192) with analyst prompt `$e` returning per-LLM JSON: `{mentioned, rank, sentiment, framing, strengths, gaps, vendors_mentioned:[{name,position,sentiment,strength,features}], cited_sources:[{domain,type:analyst|review|vendor|news|community|academic|other,context}], content_gaps, threats, recommendation, accuracy, completeness, positioning (1-10), response_snippet, citation_presence, sirion_content_cited, confidence}` — up to 12 inferred sources ("according to Gartner"-style inference allowed). Answers are truncated to 6 000 chars (economy) / 12 000 (premium) plus up to 3 ±400-char windows around later company mentions; `parse_coverage`, `truncated`, `first_mention_pos`, `total_mentions`, `_low_confidence` are stamped. Native web-search citations are merged into `cited_sources` as `{domain, type:"other", context:"Cited by <llm>", url}`.
- Difficulty (`fe`): specificity/competition/contentGap/volume (1-10) + composite.
- **Scores** (`Me`, calibration `G`): `overall = 0.35·mention% + 0.40·position + 0.25·sentiment`, position = avg `100−(rank−1)·20`, sentiment map positive 100 / neutral 50 / negative 20 / absent 0; also accuracy/completeness/positioning ×10 and a shareOfVoice. **Narrative score** (`Le`/`Ae`): keyword-classifies each analysis into `post-sig-only(0) / full-stack(100) / pre-sig(80) / positive(60) / neutral(30) / negative(0) / absent(0)` using phrase lists (`Oe`, e.g. full-stack: "end-to-end","full-stack","complete lifecycle","unified platform"…; post-sig-only: "obligation","renewal manage","sla monitor"…), weighted average = narrativeScore. Calibration persisted at `localStorage["xt_m2_calibration"]` (or inside `xt_pipeline_snapshot`.m2.calibration).
- Export (`Fe`): `{source:"xtrusio-perception-monitor", queries[], personaBreakdown, stageBreakdown, allContentGaps (severity absent>outranked>weak), allRecommendations}`.
- Legacy local server mode: `?serverScan=true` / `localStorage xt_use_server_scan`, URL `localStorage xt_server_url` default `http://localhost:3100`, `POST /api/scan/run`.

## scanMergeRules-CM6pCoAv.js

One export `m(docsForSameQid[]) → mergedDoc`. Sorts candidate `m2_scan_results` docs by the timestamp embedded in `scanId` (`/^scan_(\d+)_/`, newest first) and builds `{qid, query, scanId, analyses}` where each LLM key is taken from the **newest scan that has a non-error analysis** for it (`_error` entries never win). Used by `loadCombined` when `mergeMode:"latest-wins"`; the default "legacy-order" merge instead keeps the first doc per qid and only fills missing LLM keys.

## scanCatalog-BNhunwfC.js

`loadScanCatalog({includeUnpublished=false})` builds the scan picker used by report/trajectory views from `m2_scan_meta` + `syq_reports`:
- Always includes the **"April scan"** group `{id:"__group_april_scan", memberIds:[baseline_20260423_1718, baseline_20260423_2229]}`.
- Adds one group per tracker with `pushedToReports===true` as `{id:"__group_syq_<repId>", label:name, isSyq:true, syqDoc, memberIds:scanIds}` (skipping trackers whose scanIds fully cover the baseline members), sorted newest first.
- Remaining individual scans are listed only if `published===true` (or baseline/visible ids, or `includeUnpublished`). Labels formatted `"name · Apr 23 · 05:29 PM"`.

## Citation URL normalization (`citationUrl-BT04I8cM.js`)

- `c(url, fallbackDomain)` — canonicalize for grouping: if the URL matches the **redirect regex** `/vertexaisearch\.cloud\.google\.com|grounding-api-redirect|googleusercontent\.com|\/url\?q=|bing\.com\/ck\//i` return `redirect://<fallbackDomain>`; else strict-normalize: lowercase host without `www.`, strip trailing slashes, drop a leading 2-letter locale path segment (whitelist `en, de, fr… en-us, pt-br, zh-tw`), drop tracking params (strict prefix regex `/^(utm_|mc_|_hs|hsa_|mkt_tok|vero_)/i` plus set `fbclid,gclid,gbraid,wbraid,dclid,msclkid,yclid,twclid,ttclid,igshid,scid,spm,trk,ref,referrer,source,si,hsctatracking,_branch_match_id`); returns `host+path?keptQuery` (no scheme). Non-strict mode strips only `utm_/mc_`, `fbclid`, `gclid`.
- `s(a,b)` — sameUrl: normalize both; hosts must match; both bare hosts ⇒ true; otherwise one path must contain the other. This is the matcher that decides "the LLM cited *our* article" in the citation-check loop.

## Citation classification (`classifyUrl-BZobdwWM.js`)

Full config tables as shipped:

- **Owned domains** `w = ["sirion.ai","sirionlabs.com"]` (note: `constants.js` owned list additionally includes `sirion.com`).
- **Competitor domain map** `l`:
  `icertis.com→icertis, ironcladapp.com→ironclad, ironclad.com→ironclad, docusign.com→docusign, conga.com→conga, agiloft.com→agiloft, evisort.com→evisort, contractworks.com→contractworks, linksquares.com→linksquares, juro.com→juro, summize.com→summize, malbek.com→malbek, lexion.ai→lexion, spellbook.legal→spellbook, legartis.ai→legartis, contractpodai.com→contractpodai, pramata.com→pramata, concord.app→concord`.
- **Authority weights** `g` (default unknown weight **0.3**):

| Domain | weight | tier |
|---|---|---|
| gartner.com | 1.0 | analyst |
| forrester.com | 1.0 | analyst |
| idc.com | 0.95 | analyst |
| g2.com | 0.85 | review |
| softwarereviews.com | 0.75 | review |
| peerspot.com | 0.70 | review |
| trustradius.com | 0.70 | review |
| capterra.com | 0.65 | review |
| forbes.com | 0.80 | news |
| reuters.com | 0.80 | news |
| businesswire.com | 0.65 | news |
| prnewswire.com | 0.60 | news |
| finance.yahoo.com | 0.65 | news |
| sirion.ai | 0.70 | owned |
| sirionlabs.com | 0.70 | owned |

- `c(url)` (default export used as `classifyUrl`) returns `{url, domain, zone:"owned"|"external", zone_subtype, subject_company, authority_weight, authority_tier}`. Owned subtypes by path: `/blog/|/library/|/resources/`→`owned-content`, `/comparison/|/vs/`→`owned-comparison`, `/press|/news|/announcements`→`owned-press`, `/`or`/about`→`owned-corporate`, else `owned-direct`. External subtypes: analyst list `[gartner, forrester, idc]`→`external-analyst`; review list `[g2, softwarereviews, peerspot, trustradius, capterra]`→`external-review`; news list `[finance.yahoo, businesswire, prnewswire, forbes, reuters]`→`external-news`; competitor map→`external-competitor`; else `external-other`. `subject_company` = `sirion`, competitor slug, or `unknown`. Suffix matching (`endsWith("."+domain)`) throughout.

## Narrative classifier (`narrativeClassifier-UrOyvc-P.js`)

Lexicon-based framing of *how the company is described*:
- Extract the paragraph(s) around each company mention (`k`): split on blank lines, drop table-only (≥3 `|`) / link-farm (>60% markdown links) / <80-char paragraphs; droppedReason ∈ `no_text / target_not_found / table_only / no_prose_paragraph`.
- Word-boundary match hit lists: `PRE` (36 terms: authoring, redline(s/ing), playbook, template, clause library, negotiate…, intake, approval workflow, e-sign(ature), counterparty…), `POST` (46 terms: obligation*, renewal*, repository, milestones, sla(s), vendor/supplier performance, amendments, audit trail, compliance monitoring, revenue/value leakage, post-signature, asksirion, termination…), `FULL` (`end-to-end`, `end to end`, `full lifecycle`, `across the lifecycle`).
- Label: FULL hit **or** (PRE and POST) → `full_stack`; PRE only → `pre_signature`; POST only → `post_signature`; else `unclassified`. Result `{mentioned, paragraph, label, preHits, postHits, fullHits, droppedReason}`; `not_applicable` when name absent, `no_paragraph` when mention exists but no usable prose.
- Roll-up `r(docs, llms=["claude","gemini","openai"], company, {useExtractorStage})`: counts per model + buckets; when `useExtractorStage:true` and the Stage-2 `lifecycle_stage` field exists it is used instead of the lexicon (`source:"extractor"` vs `"lexicon"`). Percentages: `visibility = mentioned/totalAnalyses`, `frameable = frameable/mentioned`, and bucket % of frameable.

## Stats & scores

- **`scanStats-x9j0rlX6.js`** (Perception-Monitor-style rollups over `{results,llms}`): `c` vendor table `{name, m (mentions), t3 (position≤3), pos (positive)}`; `a` vendor→feature frequency; `b` competitive summary (top-8 Sirion features, top-3 competitors with top-5 features, up to 5 losing queries where a competitor is top-3 and Sirion absent/ranked>3, top-3 content-gap actions); `d` master stats: `visibility {overall%, perLlm%, visible, total}` (question is visible if any LLM mentions), `ranking {avg, rank1, rank2to3, rank4plus, unranked, perLlm}`, `sentiment` totals + `sentPerLlm`, `competitors` (freq, avgRank, perLlm; Sirion excluded by substring), `sirion {freq, avgRank}` from vendors_mentioned, and `benchmark` hit-rate over qids starting `bm-`; `e` lifecycle radar (Pre-Signature / Post-Signature / Full Lifecycle axes, vendor mention counts scaled to 0-10).
- **`compute-GsiJKaNN.js`** (Rich report sections): `c` share-of-voice matrix — canonical vendor names via `loadCombined.j` (strips suffix regex `/\s+(CLM|Labs?|Inc\.?|Corp\.?|LLC|Ltd\.?|Co\.?|Software|Platform|Solutions?|Technologies?)$/i`), per-LLM counts, medianRank, `shareOfVoice = vendorMentions/allVendorMentions·100`, `sirionShare`; `a` persona×stage coverage cells; `b` citations table — domain via `helpers.a` (parses stringified JSON sources, strips `www.`), `owned` via `helpers.i` (constants owned list), totals + `ownedTotal`; `e` coverage/richness QA (expected vs present analyses, error counts, withRank/withSentiment/withVendors/withSources %); `d` opportunity list — for each analysis where Sirion is absent or rank≥4 and some competitor is top-3 non-negative: `score = (absent?100:(rank−3)·20) + (4−compRank)·30 + (compSentiment==="positive"?20:0)`, sorted desc.
- **`helpers-BcI-JKAY.js`**: `d` dominant narrative label per question across LLMs; `c`/`b` strong (all LLMs mention) / weak / lost classification + tally with pcts; `e` cell badge (`#rank P/N/A`, ✓/✗); `a` cited-source→domain; `i` isOwnedDomain; `p` tolerant JSON parse; `f` timestamp label.
- **`loadCombined-BGLlSB-M.js`** additionally provides: persona grouping (Procurement/Legal/Other keyword buckets with weights `{Procurement:.55, Legal:.35, Other:.10}`) → weighted visibility (`a`/`b` used by loadHistory); reconciliation metrics `Se` (visibility, sentiment split, positioning r1/r2/r3/r4+/unranked with median+mean rank, shareOfVoice with top-10 vendors, lifecycle buckets — every block carries a `reconciles` boolean); LLM logo SVGs (`je`/`ke`); a full HTML "Report V2" export ("Generated from m2_scan_meta + m2_scan_results (Firebase)"); and the combined-baseline loader `m` described in `llm-api-and-storage.md`.
- **`yinMatrix-CX7lXYkw.js`** is *not* scan scoring: it is the sales-intelligence "Yin Matrix" — an IndexedDB question/persona store (`xtrusio-m1` DB: questions, companyIntel, macroBank, personas), 8 CLM-maturity buckets (`stone_age, basic_digital, esign_only, procurement_side, legal_side, midmarket_clm, enterprise_clm, ai_native`), per-persona pain-category weight grid (gc/cpo/cio/vplo/cto/cm/pd/cfo × compliance_risk/cost_leakage/cycle_time/visibility_gap/integration_friction/renewal_risk/scalability), pain-point library with `sirionSolution` copy, and a dual-engine (Claude + Grok) company tech-audit prompt whose results are merged (`enginesAgree`, union of techAudit arrays).

## For AI assistants

- The **authoritative analysis object** shape (one per qid×LLM in `m2_scan_results.analyses`) is produced by `baselineScanner.Tt`: `{mentioned, rank, sentiment, framing, strengths, gaps, vendors_mentioned, cited_sources, content_gaps, threats, recommendation, citation_presence, sirion_content_cited, response_snippet, full_response, answer_length, lifecycle_stage, supported_vendors, unsupported_vendors, truthfulness_score, consistency_score, consistency_breakdown, hallucinated_vendors, attempts_pooled, extract_status, narrative}`. Legacy scanEngine analyses share most keys but add `accuracy/completeness/positioning/confidence/parse_coverage`. Consumers must always skip `_error` entries.
- Citation matching to owned URLs happens in three distinct places with three matchers — keep them consistent: `classifyUrl` (zone/authority, suffix match on domain), `citationUrl.s` (exact-page match for the citation-check loop), `helpers.i`/`constants.c` (owned-domain flag in tables). Only `classifyUrl` lacks `sirion.com`.
- Ranks: Stage-2 `sirion_position` → median across reps → `rank`; vendors carry `position` (baseline pipeline) or `rank` (legacy names) — `compute`/`scanStats` read `position ?? rank`.
- Anything that changes attempt-doc field names must update both the client (`baselineScanner`) and the worker twin, plus `buildStructuredQuestionJson` in the SYQ UI and the Resume logic (`RichScanReport.Bt`) which keys off `status`/`extract_status`.
- Scoring weights live in one calibration object (`scanEngine.G`) persisted to `localStorage xt_m2_calibration`; the five-metric summary, narrative weights and gap formulas are hard-coded where documented above.
