# Scan Your Queries (nav id `scanq`)

**Bundle files:** `sirion/assets/index-UYiwywP9.js` (the module UI), with engine code in `RichScanReport-De3pSLhF.js`, `baselineScanner-B4UVyWOc.js`, `snapshotClient-BBUEgP_Y.js`, `reports-CDHYzssx.js`, `scanEngine-BVO7e_Tl.js`.

## Purpose

"Scan Your Queries" (SYQ) is the operator-facing scan console of the Xtrusio AI-perception platform. It lets an admin pick buyer-intent queries (organized into uploaded "segments"), fire them at up to five LLMs (Claude, Gemini, ChatGPT, Grok, Perplexity), watch the two-stage answer+extract pipeline live, accumulate results into long-running "Trackers" with automatic query×LLM dedupe, snapshot trackers into internal "Reports", and push chosen reports to the client-visible `/reports/report` page. Header copy: **"Scan Your Queries"** / *"Run small batches over time; each scan grows with auto-dedupe — already-scanned queries skip."* Registered in the main nav as `{id:"scanq", n:"2b", label:"Scan Your Queries", path:"/scan-queries"}`; visible to `super_admin`/`admin` roles only (module allowlist in `index-BZaWgRns.js`).

## UI structure

Top-level component (`Xr` in the bundle) renders header + tab bar (`hr` array) + one of four tabs:

| Tab id | Tab label | Component | What it shows |
|---|---|---|---|
| `queries` | **Queries** | `In` (list) → `Fe` (run view) | Every query across every `user_segments` doc; pick + configure + run a scan |
| `reports` | **Trackers** | `Jn` (list), `dr` (detail), `yr`/`gr` (add queries) | Long-running scan containers (`syq_reports` docs). "One scan per period. Add queries to it over time; already-scanned queries are skipped automatically." |
| `published` | **Reports** | `xr` | Internal snapshot reports (`syq_published_reports`), with Push / Unpush / Delete to control `/reports/report` |
| `scans` | **Scans** | `Qn` (list), `Gn` (detail) | "Every scan you've run, newest first — including the \"Published Articles — Citation Check\" scans." Also orphan recovery UI |

While a scan is in phase `scanning`/`analyzing` a sticky red banner shows **"SCAN IN PROGRESS — Do NOT navigate away…"**, tab switches require a `window.confirm`, and a `beforeunload` handler is installed (client engine only; the server engine says it is *"safe to close this tab or navigate away; the scan keeps going and the report builds itself"*).

### Queries tab (`In`)

- Loads all segments (`user_segments` collection, listed via `baselineScanner` export `$n`, created via `wn`/saveSegment) plus trackers (`syq_reports` via `reports-CDHYzssx.js`).
- **Cross-segment dedupe:** rows are keyed by normalized query text (`trim().toLowerCase().replace(/\s+/g," ")`). A query in multiple segments shows a `shared` badge: *"The scan engine uses a single qid so it only runs once."* Counters show `totalRawCount` vs `dupeCount`.
- Filters: segment chips, persona select, stage select, free-text search; sortable columns (ID, Query, Segment, Persona, Stage); "Select filtered"/"Deselect filtered".
- Buttons: **Manage segments**, **Upload Excel** (via `excelImport-DXzVN75I.js`, sheet parsed with `xlsx`).
- Sticky footer bar: LLM picker (5 LLMs, `Kn`/`pr` arrays with colors `claude #a855f7, gemini #3b82f6, openai #10b981, grok #f97316, perplexity #ec4899`; display names Claude, Gemini, **ChatGPT**, Grok, Perplexity), segment assignment (`auto` / existing / `new` / `none` → cross-segment), and target Tracker (`none` = standalone, existing tracker id, or `new` which creates one via `createReport`). Auto-generated scan name, e.g. `"<segment> · May 12"` or `"Cross-segment · 23 Q · May 12"`.
- **Pre-select hand-off:** `sessionStorage["xt_syq_preselect"]` (`{qids, reportHint}`) is written by the Link Strategy module; SYQ reads and clears it, pre-ticks those qids and shows *"Pre-selected from Link Strategy — run the scan to update <month>'s data."* `reportHint:"current-month"` auto-targets the tracker most recently pushed this month (`findCurrentMonthPushedReport`).
- Start → builds plan `{scanName, questions:[{id,query,persona,stage,lifecycle,source,cluster}], models, segmentDocId, segmentId, segmentName, reportId}` and mounts the run view.

### Run view (`Fe`)

- Scan id: reuses `plan.scanId` (resume) or mints `` `scan_${Date.now()}_${rand6}` `` (`RichScanReport` export `$t`; the `scan_<ms>_` prefix is what `scanMergeRules` sorts by).
- **Engine selection** (`snapshotClient` export `i`): server engine is the default; set `localStorage["xt_scan_engine"]="client"` to force the in-browser engine.
  - **Server engine:** `POST https://xtrusio-ai.thedevimapro.workers.dev/api/scan/start` with the plan (`{plan:{scanId,questions,models,company,mode:"economy",reps:1,scanName,teamName,segmentDocId,segmentId,segmentName,reportId}}`), then polls `GET /api/scan/:id/status` every 2.5 s (phases `running/paused/analyzing/complete/cancelled/abandoned/error`; `counts.settled/planned`; `perModel` stats). Controls map to `POST /api/scan/:id/cancel|pause|resume|retry`; a snapshot can be requested via `POST /api/scan/:id/snapshot`. Analytics events `scan_started` / `scan_completed` are logged.
  - **Client engine:** calls `RichScanReport` export `At` → `baselineScanner.runScan (Xe)` with `reps:1, mode:"economy"`; on finish (or abort) runs `ensureAnalyzed`: it calls the analyzer (`RichScanReport.ke` → `baselineScanner.analyzeScan (gn)`), retrying once after 4 s; if zero attempts completed it writes an `m2_scan_meta` doc with `status:"abandoned"`, `abandoned_reason:"no_attempts_completed"`, `published:false` so nothing is silently lost.
- Live UI: progress bar `done / planned attempts` (planned = questions × models), per-question cards with one row per model showing status chips `queued / running… / ok / error / parse-fail` and expandable raw Stage-1 response; helper text: *"Each LLM runs Stage 1 (with web search · 15-60s) then Stage 2 (JSON extract · 3-8s)."* Attempt rows are polled from `m2_scan_attempts` (`queryByFieldAll("m2_scan_attempts","scan_id",scanId)`) every 1.2–2.5 s.
- **Attach to tracker:** if the plan has `reportId`, after analysis the completed qids are written into the tracker via `reports.r` (`recordCoverage`): `qidsByLlm[qid][llm] = scanId` (first scan to cover a pair wins), `questionMeta[qid] = {query,persona,stage}`, union of `llms` and `scanIds`. If that write fails, a warning box offers Retry (*"Scan saved — but couldn't be added to the report… Your answers are safe (they're in History)."*).

### Trackers tab

- List (`Jn`): every `syq_reports` doc, PUBLISHED badge when `pushedToReports===true`. New-scan modal: *"A scan is a long-running container. Add queries to it over time; already-scanned (query × LLM) pairs are skipped automatically."* Creating calls `reports.c` → doc `{id:"rep_<ms>_<rand6>", name, company, llms, qidsByLlm:{}, questionMeta:{}, scanIds:[], createdAt, updatedAt}`. A tracker named exactly `"April scan"` short-circuits to `#/reports/report`.
- Detail (`dr`): loads the tracker, then all attempts for each member `scanId`; per qid×LLM keeps the **latest** attempt by `completed_at`; lazy-loads the analyzed doc `m2_scan_results/{scanId}__{qid}` when a row expands. Buttons **Make report** (→ `syq_published_reports` snapshot, see below) and **Add queries**.
- Add queries (`gr`): pick segment → tick extra LLMs (existing tracker LLMs are locked "in report") → query table with per-row coverage chip computed from `qidsByLlm`: `fully covered` (green, row disabled), `partial n/m` (orange), `new` (blue). Copy: *"Already-scanned queries are automatically skipped. You only pay for new ones."* CTA: **"Scan & add · N new Q × M LLM"** — only `toScan` (not fully covered) rows are sent. This is the auto-dedupe promised in the header.

### Reports tab (`xr`, collection `syq_published_reports`)

- "Make report" on a tracker snapshots `{id:"rep_<ms>_<rand6>", name, scanId:<tracker id>, qids:Object.keys(qidsByLlm), llms, company, status:"internal", engineScanIds:[...tracker.scanIds], pushedAt:null}`.
- **Push** (`nr`): sets each `m2_scan_meta/{engineScanId}` to `{published:true, published_by_report_id, published_at}` and the report doc to `status:"pushed"`. Confirm text: *"Push \"name\" to /reports/report? Clients will see it in the dropdown."* **Unpush** (`tt`) reverses both. The client Reports page and `scanCatalog` only surface published scans.
- The tracker list has its own publish path too (`reports.p` / `reports.u`): sets `pushedToReports:true` + `pushedAt` on the `syq_reports` doc and `published:true` on every member `m2_scan_meta`, optionally emailing the client with a link to `#/reports/report`.

### Scans tab (`Qn` / `Gn`)

- Lists everything in `m2_scan_meta` via `RichScanReport.Rt`: id, name, date (falls back to parsing `baseline_YYYYMMDD_HHMM` or `scan_<ms>_` out of the id), status, llms, totals, `segmentName` (`userSegmentName`). Filter by text/status; multi-select → **"Build report from N scans"** (with "total questions (before dedupe)" count).
- **Orphan recovery** (`RichScanReport.Ft`/`It`): finds `m2_scan_attempts` groups whose scan has no completed `m2_scan_meta` and whose last attempt is >30 min old. Orphans **with data** → "Recover N with data" (re-runs the analyzer over saved attempts — no new API calls — via `Pt`, then patches `completed_at`). **Pending-only** orphans → "Show N in History" (writes an abandoned `m2_scan_meta` via `Mt`, `abandoned_reason:"pending_only_recovery"`). Detail view supports **Resume** (rebuilds a plan of missing/failed qid×model cells via `Bt`) and per-cell retry (`Ot` = rescan one question×model then re-analyze; on the server engine `POST /api/scan/:id/retry`).
- Per-question JSON download: `buildStructuredQuestionJson` (`schemaVersion "1.0"`) merges `m2_scan_attempts` (all reps, stage1+stage2 detail) with `m2_scan_results` analyses into `{scan, question, perLlm:{model:{attempts,analysis}}}` and saves as `<scanId>__<qid>__<slug>__<date>.json`.

## The "Published Articles — Citation Check" segment

Defined **outside** this module, in the Link Strategy / published-content bundle `index-Dz3blxfN.js` (constant `qi = "Published Articles — Citation Check"`, source tag `_i = "published-verify"`, creator `"citation-loop"`):

- For each published article/post, up to **3** verification queries (`Wi=3`) are generated with Gemini `gemini-2.5-flash` (fallback `callGemini`→OpenAI path `$a`), prompt rules: paraphrase the article's core question, never include publisher/URL/brand, return `{"queries":[...]}`. Queries must be ≥25 chars and end with `?`.
- They are upserted into **one** `user_segments` doc named `"Published Articles — Citation Check"` with qids `` `${articleId}__v${n}` `` (existing qids for the same article are replaced). The user is told: *"Open Scan Your Queries → run \"Published Articles — Citation Check\" → come back and Refresh."* (this is also where `xt_syq_preselect` comes from).
- After scans run, the loop reads `m2_scan_results` by qid across engines `openai, gemini, claude, perplexity` and grades each article per engine: `bullseye` ("URL cited — exact target", the article URL itself cited on the *original* question — URL match via `citationUrl.s` sameUrl or path containment, redirect wrappers like `vertexaisearch`/`grounding-api-redirect` excluded), `adjacent` ("URL cited as source", weight 0.4), `brand` ("Sirion cited", any of `sirion.ai`/`sirion.com`, weight 0.2), `pending` (<90 days old or <2 scans), `missed`, `unscanned`. Headline status = best state across engines; score `bullseye=1, adjacent=0.4, brand=0.2`.

## Data model / storage keys used by this module

| Store | Key/collection | Written by | Contents |
|---|---|---|---|
| Firestore | `user_segments` | Excel upload / citation-loop | `{id:"seg_<ms>", name, creatorName, creatorEmail, questionIds, questions:[{id,query,persona,stage,lifecycle,source,cluster,intentType}], questionCount, scanHistory, latestScanId/latestFiveMetrics…}` |
| Firestore | `syq_reports` (Trackers) | reports-CDHYzssx.js | `{id:"rep_…", name, company, llms, qidsByLlm:{qid:{llm:scanId}}, questionMeta, scanIds, pushedToReports, pushedAt}` |
| Firestore | `syq_published_reports` (Reports tab) | index-UYiwywP9.js | `{id:"rep_…", name, scanId, qids, llms, company, status:"internal"\|"pushed", engineScanIds, pushedAt}` |
| Firestore | `m2_scan_attempts`, `m2_scan_runs`, `m2_scan_meta`, `m2_scan_results`, `m2_sections`, `m2_content_gaps` | baselineScanner / worker | see `scan-engine.md` |
| sessionStorage | `xt_syq_preselect` | Link Strategy | `{qids:[…], reportHint}` — consumed once |
| localStorage | `xt_scan_engine` | manual | `"client"` forces in-browser scan engine (default = server/worker) |
| URL/localStorage | `?serverScan=true|false`, `xt_use_server_scan`, `xt_server_url` (default `http://localhost:3100`) | scanEngine.js legacy path | legacy local scan-server toggle (old Perception Monitor engine, not the worker) |

## Integrations

- **In:** Link Strategy (`xt_syq_preselect`, citation-check segment), Excel upload, Question Generator segments.
- **Out:** worker `https://xtrusio-ai.thedevimapro.workers.dev` (`/api/scan/*`, `/api/ai/chat`), Firestore project `sirion-persona-stage`, Reports page (`#/reports/report` reads published scans / trackers), Trajectory & Executive views (via `scanCatalog`/`loadHistory`), analytics events `scan_started`, `scan_completed`, `report_unpublished`.

## For AI assistants

- The UI never calls LLM vendors directly; everything goes through the Cloudflare worker with `Authorization: Bearer <sessionStorage.xt_token>` (Firebase ID token).
- "Scan" is overloaded: a **Tracker** (`syq_reports`) is the user-facing "scan container"; an **engine scan** is one `scan_<ms>_<rand>` run producing `m2_scan_*` docs; a **Report** (`syq_published_reports`) is a named snapshot of a tracker. Publishing flips `published:true` on member `m2_scan_meta` docs — that flag is what client-facing views filter on.
- Dedupe happens at three layers: (1) Queries tab merges duplicate query *text* across segments into one row/qid; (2) Add-queries-to-tracker skips qid×LLM pairs already present in `qidsByLlm`; (3) the engine itself skips attempt keys (`qid|model|attempt`) already `complete` in `m2_scan_attempts` (resume-safe).
- One scan = `reps:1`, `mode:"economy"` always in this module (the N=3/N=5 tiers exist only in the baselineScanner API used elsewhere).
- If you change tracker coverage semantics, update both `reports-CDHYzssx.js#recordCoverage` and the coverage chips in `gr` (Add queries) — they must agree on "covered".
- The "Published Articles — Citation Check" segment name is a **string contract** between `index-Dz3blxfN.js` (writer/reader) and this module (runner). Renaming it breaks the citation loop lookup `queryByFieldIn("user_segments","name",[…])`.
