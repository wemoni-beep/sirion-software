# LLM API clients & persistence layer

**Bundle files:** `claudeApi-DNyhT86p.js` (the real multi-provider client), `openai-BjkciBql.js` (research orchestration — see note), `snapshotClient-BBUEgP_Y.js`, `database` wrapper inside `index-BZaWgRns.js`, `loadCombined-BGLlSB-M.js`, `loadHistory-CPnDOulM.js`, `firebaseCleanup-Bc5hZ9Bk.js`, `database-CvsINhCx.js`.

## Purpose

All LLM traffic and all durable data in Xtrusio flow through two backends: a **Cloudflare Worker** at `https://xtrusio-ai.thedevimapro.workers.dev` (LLM proxy, scrape/map, server-side scan engine, `/api/me` roles) and **Firestore** project **`sirion-persona-stage`** accessed via raw REST (`firestore.googleapis.com/v1/...?key=AIzaSyCbZIwkEHKy8r3HSxmLNFau6lnD-VeG_Q8`) with local caching. No vendor API key ever ships to the browser — auth is a Firebase ID token kept in `sessionStorage["xt_token"]`.

## claudeApi-DNyhT86p.js — the LLM proxy client

Despite the filename, this is the client for **all five providers**. Core: `proxyChat(provider, body, {timeoutMs,signal})` → `POST ${WORKER}/api/ai/chat` with `{provider, body}` (Gemini uses `{provider:"gemini", model, body:payload}`), header `Authorization: Bearer <xt_token>`; on 401 it force-refreshes the Firebase token once and retries; friendly error mapping (401 "Your access link has expired…", 403 revoked, 429 rate limit, 502 provider failed, 504 upstream timeout). Every call is metered via AI-cost telemetry hooks from the main chunk (`{provider, model, promptBytes}` on start, `durationMs/responseBytes/status` on finish — feeds the AiCostsPanel). Response body may be `{raw: <providerJson>}`.

Named helpers (all default `timeoutMs 120000` unless noted):

| Export | Provider/body | Default model | Notes |
|---|---|---|---|
| `callClaudeFast(system,user,maxTokens=1500)` | anthropic | `claude-sonnet-5` (`thinking:{type:"disabled"}`) | 60 s, JSON-parsed |
| `callClaudeHaiku` | anthropic | `claude-haiku-4-5-20251001` | 60 s, JSON-parsed |
| `callClaude(system,user,timeout=120s,max=4096)` | anthropic | `claude-sonnet-5` + `tools:[{type:"web_search_20250305",name:"web_search"}]` | web-search research |
| `callClaudeChat(system,messages,max=2048)` | anthropic | `claude-sonnet-5` | returns raw text |
| `callOpenAI(system,user,{model:"gpt-4o",maxTokens:4096,temperature:0,forceJson,raw})` | openai | `gpt-4o` | `response_format:{type:"json_object"}` when forceJson |
| `callGemini(system,user,{model:"gemini-2.5-flash",tools,forceJson:true,raw})` | gemini | `gemini-2.5-flash` | sets `responseMimeType:"application/json"` unless grounded; robust `parseGeminiJson` repair (fence stripping, brace balancing, truncation repair) |
| `callGrok(system,user,{model:"grok-4-latest",maxSearchResults:10})` | grok | `grok-4-latest` + `search_parameters:{mode:"auto"}` | |
| `callPerplexity(system,user,{model:"sonar"})` | perplexity | `sonar` | |
| `callFirecrawl(url,opts)` | — | `POST ${WORKER}/api/scrape` (`formats:["markdown"]`, `onlyMainContent`, firecrawl timeout 30 s) | 404 → "route not deployed yet" |
| `callFirecrawlMap(url,opts)` | — | `POST ${WORKER}/api/firecrawl-map` (`limit 1000`, `search`, `includeSubdomains`, `ignoreSitemap`) | returns `{urls,total}` |

Token/session helpers: `hasAccessToken`, `getAccessClient` (`sessionStorage xt_client`), `clearAccessToken`, `getAnthropicHeaders` (Bearer xt_token — reused by both scan engines), `getAnthropicKey`/`getGrokKey` return the token as a "key present" signal only.

### openai-BjkciBql.js — research orchestrator (not a raw client)

Despite its name this 364 KB chunk is the market-intelligence layer (plus d3/recharts Sankey code). Relevant pieces: provider **chains** with automatic failover and JSON-repair (`researchCall`): `RESEARCH_PREMIUM:["perplexity-pro","gemini-pro-grounded","perplexity"]`, `RESEARCH_FAST:["perplexity","gemini-flash-grounded"]`, `RESEARCH_VERIFIED:["gemini-pro-grounded","perplexity-pro","gemini-flash-grounded"]`, `RESEARCH_CURRENT_EVENTS`, `SYNTHESIS_PREMIUM:["gemini-pro","claude-fast","openai"]`, `SYNTHESIS:["gemini-flash","openai"]` — provider ids map to claudeApi calls (`perplexity-pro`→sonar-pro, `gemini-pro`→gemini-2.5-pro, `gemini-*-grounded` adds `tools:[{google_search:{}}]`, `claude-research`→callClaude, `claude-fast`→callClaudeFast). Transient-error retry (3×, exp backoff) on 5xx/429/timeout. Research log ring (200 entries) persisted at `localStorage["xt_research_log_v1"]`; news archive collection `intel_v2_news_archive`. It also re-loads the two April baseline scans and augments them with grok/perplexity analyses from any other scan (its own copy of the augment logic). CLM market-share research prompts (source-diversity rules, pure-play vendor list) live here.

## snapshotClient-BBUEgP_Y.js — server scan API + snapshot reads

- `i()` `isServerEngine`: **true unless** `localStorage["xt_scan_engine"]==="client"`.
- `s` startScan → `POST /api/scan/start` `{plan:{scanId?, questions:[{id,query,persona,stage}], models, company, mode:"economy", reps:1, scanName, teamName, segmentDocId, segmentId, segmentName, reportId}}`; `g` status `GET /api/scan/:id/status`; `c` cancel, `p` pause, `r` resume, `a` retry (all POST); `b` pollUntilSettled (2.5 s interval, 30 min timeout, terminal phases `complete/abandoned/cancelled/error`).
- **Snapshot reads** (`l`): if `localStorage["xt_use_snapshots"]==="on"`, try `m2_scan_snapshot/{scanId}` (doc with `qidSnapshots[]`, `scanDate/builtAt`); on miss, remember the miss and fire-and-forget `POST /api/scan/:id/snapshot` to build one, then fall back to `queryByFieldAll("m2_scan_results","scanId",scanId)`. This is the single read path every report/loader uses for per-scan docs.

## Firestore access layer (in `index-BZaWgRns.js`)

- Config: `{apiKey:"AIzaSyCbZIwkEHKy8r3HSxmLNFau6lnD-VeG_Q8", projectId:"sirion-persona-stage", authDomain:"sirion-persona-stage.firebaseapp.com", storageBucket:"sirion-persona-stage.firebasestorage.app"}`. Firebase Auth (email + Google) keeps the ID token synced into `sessionStorage["xt_token"]`.
- Documents are read/written via the Firestore REST v1 endpoints (`…/documents/<collection>/<id>?key=…`, `:runQuery` for indexed queries such as the activity log). Value encoding caps strings at 200 000 chars and JSON-stringifies arrays >500 items / objects deeper than 3 levels; decode reverses it.
- The `db` wrapper (imported everywhere as `d`) exposes `getById, getAll, getAllPaginated, getAllUncapped, queryByFieldAll, queryByFieldIn, saveWithId, update, delete, getLastError`.
- **localStorage write-through cache**, prefix `xt_<collection>_<id>`: disabled for the big scan collections (`m2_scan_attempts, m2_scan_results, m2_scan_meta, m2_scan_runs, m2_sections, m2_content_gaps, m2_impact_summary`; `m2_scan_results`/`m2_scans` additionally size-capped at 500 KB); LRU eviction of oldest 25 % on quota, protecting `xt_pipeline_snapshot` and `xt_data_version`.
- **IndexedDB read cache** `xtrusio-read-cache` (store `entries`): TTL 1 h for `syq_reports, m2_scan_meta, m2_scan_snapshot`; 7 days for `m1_personas, m1_macros`; 24 h default; kill-switch `localStorage["xt_read_cache"]="off"`.
- **429 circuit breaker**: any Firestore 429 pauses all requests for 300 s.
- Role/module gating: `GET ${WORKER}/api/me`; session at `localStorage["xt_auth_session"]` (30-day expiry); module ids include `scanq`; role presets (`super_admin/admin` get everything incl. `scanq`, `client` gets `intel3, reports, exec, m6v3, links, m3`, `client_portal` gets m2 tabs `reportv6/trajectoryv2` only).

### Collections used by the scan subsystem

| Collection | Producer | Content |
|---|---|---|
| `m2_scan_attempts` | baselineScanner / worker | one doc per qid×model×rep: raw answer, citations, Stage-2 extract (id `${scanId}_${qid}_${model}_rep${n}`) |
| `m2_scan_runs` | baselineScanner / worker | run status + stats + log tail (id = scanId) |
| `m2_scan_meta` | analyzer | scan summary, scores, five metrics, verifiability, `published` flag, segment links |
| `m2_scan_results` | analyzer | per-question merged analyses (id `${scanId}__${qid}`) |
| `m2_scan_snapshot` | worker | prebuilt `qidSnapshots` for fast report loads |
| `m2_sections` | analyzer | report section (`baseline_report_<scanId>`) for the Reports module |
| `m2_content_gaps` | analyzer | scored gap docs with audit trails |
| `user_segments` | SYQ / Excel / citation-loop | query segments (incl. "Published Articles — Citation Check") |
| `syq_reports` | SYQ Trackers | tracker containers with `qidsByLlm` coverage |
| `syq_published_reports` | SYQ Reports tab | pushed/internal report snapshots |
| `activity_log`, `intel_v2_news_archive`, `m1_*`, `m3_authority_ring`, `pipelines`, `analyses` | other modules | adjacent |

### firebaseCleanup-Bc5hZ9Bk.js

`nukeAll()` deletes every doc in `pipelines, m1_questions_v2, m1_personas, m1_macros, m1_company_intel, m2_scan_meta, m2_scans, m2_scan_results, m2_config, m2_sections, m2_content_gaps, m3_authority_ring, analyses` **and** clears localStorage keys with prefixes `xt_pipelines_, xt_pipeline_snapshot, xt_m1_, xt_m2_, xt_m3_, xt_analyses_, xt_DATA_VERSION`. Returns `{fbDeleted, lsDeleted}`. (`database-CvsINhCx.js` is unrelated — it is just the lucide "database" icon.)

## Combined loading & history

### loadCombined-BGLlSB-M.js (`m` / `loadCombinedBaseline`)

`m(scanIds = [baseline_20260423_1718, baseline_20260423_2229], {noAugment, mergeMode, requirePublished})`:
1. Optionally filters requested ids to `published===true` metas (baseline ids always allowed).
2. Loads each scan's docs through the snapshot-aware loader, merges duplicates per qid — default "legacy-order" (first doc wins, later docs only fill missing LLM keys) or `"latest-wins"` via `scanMergeRules.m`.
3. **Augmentation:** whatever LLMs are missing from the merged docs (vs the 5-LLM list) are back-filled from every *other* `baseline_*` scan's docs, newest `completed_at` last so newer analyses overwrite older per qid×LLM.
4. Returns `{docs, baselineScanIds, baselineLlms, completedAt}`.

### loadHistory-CPnDOulM.js — KPI trajectory

- Engagement config (`a` export): company `Sirion`, owned domains `[sirion.com, sirion.ai, sirionlabs.com]`, competitors `[Ironclad, Icertis, Agiloft]`, platforms in scope `[claude, gemini, openai, perplexity]`, engagement window `2026-04-06 → 2027-04-06` (quarter boundaries note "Matches Appendix A literal numbering").
- **KPI end-targets** — 154-question set: full-stack narrative 65 %, pre-sig 20 %, post-sig 12 % (decreasing), AI visibility raw/weighted 80 %, SoV all-vendors 28 %, SoV top-3 60 %. 35-question set: 41 / 38 / 12 / 61 / 61 / 17 / 40.
- `l` loadHistoricalScans: takes the `scanCatalog` groups, keeps one (latest) group per calendar month, loads up to 3 (latest 2 + oldest) via `loadCombined` (baseline groups load with augmentation), returns `{docsByScanId, scansSorted}`.
- `c` computeScanKpis: scope-filters docs (`baseline35`/`baseline154` = qid `Q1..Q35/154`), then narrative summary (`narrativeClassifier.r`), visibility & SoV from `loadCombined.Se`, weighted visibility from the persona-weighted rollup, SoV-top3 from exact-name counts of `[company, ...competitors]` only.
- Glide-path math: months-to-target ramps `6 + max(0, |Δ|−10)·0.2` capped at 12; value approaches target exponentially with 4 % residual at the ramp end (`v(t0,target,months)`); builders `d` (quarterly points), `e` (monthly points), `s` on-track status (`+x pp ahead / behind`, direction-aware). Hard-coded **April baseline fallback** (`A`): 154-q `{fullStack 51.8, preSig 14.8, postSig 19.6, visibilityRaw 67.4, sovAll 19, sovTop3 43.7}`, 35-q `{32.8, 28.4, 19.4, 51.4, 11.2, 29.4}`, injected when no scan exists for the baseline month.

## For AI assistants

- To add an LLM provider end-to-end you must touch: worker `/api/ai/chat` provider switch, `claudeApi` helper, both engines' model tables (`scanEngine.J`, `baselineScanner.H` + stage-1 builder/parser), `constants.LLM_IDS`/names/colors, the two UI LLM-picker arrays in `index-UYiwywP9.js`, and `loadCombined`'s logo map.
- Model IDs currently in the bundle: `claude-sonnet-4-5-20250929` (Stage 1 + Stage 2 extract), `claude-sonnet-5`, `claude-haiku-4-5-20251001`, `gemini-3-flash-preview`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro`, `gpt-5-search-api`, `gpt-4o-search-preview`, `gpt-4o`, `grok-4-latest`, `grok-3-mini-fast`, `sonar`, `sonar-pro`.
- Auth is a single Firebase ID token; a 401 anywhere means "refresh token once, then tell the user their access link expired". There are no per-provider keys in the client — `getAnthropicKey()` style functions just proxy `xt_token` presence.
- Reads of scan results should go through `snapshotClient.l` (snapshot-aware) rather than `queryByFieldAll` directly, or snapshots will silently diverge.
- Do not add localStorage caching for `m2_scan_*` collections — the wrapper deliberately excludes them (documents are too large; quota-eviction thrash was the reason for the IndexedDB read cache).
- Worker endpoints referenced by the client: `/api/ai/chat`, `/api/scrape`, `/api/firecrawl-map`, `/api/util/resolve-redirect`, `/api/me`, `/api/scan/start`, `/api/scan/:id/{status,cancel,pause,resume,retry,snapshot}`.
