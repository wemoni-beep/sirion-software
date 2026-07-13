# App Shell & Infrastructure

**Bundle files:** `index-BZaWgRns.js` (~556 KB app shell), `claudeApi-DNyhT86p.js` (AI proxy client), `snapshotClient-BBUEgP_Y.js` (server-scan client), plus repo-level `index.html`, `sirion/index.html`, `sirion/_headers`, `CNAME`. This is the infrastructure document of record: nav registry, auth/roles, Firebase, caching, the complete backend endpoint inventory, and deployment layout.

## Purpose

`index-BZaWgRns.js` is the Vite entry chunk of the Xtrusio SPA ("Xtrusio · Shape How AI Sees Your Brand"). It owns routing (hash-based), the sidebar/nav registry, authentication and the role model, the Firestore REST persistence layer with its two-tier cache, presence tracking, the activity log, theming, email templates, admin APIs, and lazy-loading of every feature module.

## Deployment layout

- **Hosting:** GitHub Pages, custom domain `app.xtrusio.com` (repo-root `CNAME`).
- **Repo root `index.html`:** a static "Coming soon" page (`<meta name="robots" content="noindex">`) — the domain root is intentionally blank.
- **The real app lives at `/sirion/`** (`https://app.xtrusio.com/sirion/`). `sirion/index.html` loads `/sirion/assets/index-BZaWgRns.js` + `index-VsTWgu7P.css` and force-disables HTML caching via `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">` — its inline comment explains that GitHub Pages ignores `_headers` files and a stale index.html would reference rotated chunk hashes ("Failed to fetch dynamically imported module").
- **`sirion/_headers`** (Netlify/Cloudflare syntax, inert on GH Pages but kept): HTML `no-cache`, `/assets/*` `public, max-age=31536000, immutable` (content-hashed filenames).
- Also in `sirion/`: static report HTML files (`gartner_perception_report.html`, `sirion-xtrusio-audit.html`, `sirion_pipeline_v2.html`, …), LLM logos (`claude-color.svg`, `gemini-color.svg`, `grok.svg`, `openai.svg`, `perplexity-color.svg`), and `perception/`.
- **Backend:** a single Cloudflare Worker, base URL `https://xtrusio-ai.thedevimapro.workers.dev` (minified aliases `aA`/`Wr`/`hs`/`i1`/`Zr`; overridable per-browser via localStorage `xt_server_url`). Firestore is called directly from the browser via REST (no worker in between).

## Navigation registry

Two registries exist. `Yi` is the id→label list (with `group` for sub-services); **`Ua` is the real sidebar** with icons, paths, sections and role flags.

### `Yi` (verbatim)

```js
{id:"intel3",label:"Company Intel"}, {id:"reports",label:"Reports"}, {id:"exec",label:"Executive Summary"},
{id:"m1",label:"Question Generator"}, {id:"m2",label:"Perception Monitor"}, {id:"scanq",label:"Scan Your Queries"},
{id:"m3",label:"Authority Ring"}, {id:"m4",label:"Buying Stage Guide"}, {id:"m5",label:"CLM Advisor"},
{id:"m6v3",label:"Content Strategy"}, {id:"links",label:"Link Strategy"}, {id:"activity",label:"Activity"},
{id:"settings",label:"Settings"},
{id:"links_social",label:"Social Amplification",group:"Link Strategy services"},
{id:"links_pr",label:"PR Distribution",group:"Link Strategy services"},
{id:"links_ugc",label:"UGC & Community",group:"Link Strategy services"},
{id:"links_premium",label:"Premium Outreach",group:"Link Strategy services"},
{id:"yt_script",label:"YouTube Script Creation",group:"YouTube"},
{id:"yt_video",label:"Full Video Creation System",group:"YouTube"}
```

### `Ua` — sidebar (id / badge glyph / label / path / section / flags)

| id | glyph | label | path | section | flags |
|---|---|---|---|---|---|
| intel3 | R | Company Intel | `/intel` | Navigate | — |
| reports | 📊 | Reports | `/reports` | Navigate | — |
| exec | 📈 | Executive Summary | `/exec-summary` | Navigate | — |
| m1 | 1 | Question Generator | `/questions` | Navigate | — |
| m2 | 2 | Perception Monitor | `/perception` | Navigate | — |
| scanq | 2b | Scan Your Queries | `/scan-queries` | Navigate | — |
| m3 | 3 | Authority Ring | `/authority` | Navigate | — |
| m4 | 4 | Buying Stage Guide | `/buying-stage` | Navigate | — |
| m5 | 5 | CLM Advisor | `/advisor` | Navigate | — |
| m6v3 | 6 | Content Strategy | `/content` | Navigate | — |
| links | L | Link Strategy | `/links` | Navigate | — |
| activity | A | Activity | `/activity` | system | — |
| aicosts | $ | AI Costs | `/ai-costs` | system | `adminOnly` |
| mail | ✉ | Email Center | `/email` | system | `adminOnly` |
| settings | S | Settings | `/settings` | system | — |
| users | U | User Management | `/users` | system | `superOnly` |
| invites | I | Invites | `/invites` | system | `superOnly` |
| profile | P | Profile | `/profile` | system | — |

Sections render as sidebar groups "Navigate" and "System". Routing is hash-based: `Hl` maps path→id, alias map `$l = {"/":"intel3","/intel-v2":"intel3","/intel-v3":"intel3","/content-v2":"m6v3","/content-v3":"m6v3","/links-v2":"links-v2","/authority-new":"m3"}`; default module is `intel3`; the second hash segment selects a tab.

## Auth & roles

### Login flow

Auth uses a Firebase-Auth-style client `zt` (email/password, Google, custom token, email link; `getIdToken`, `sendPasswordReset`, `signOut`). After Firebase sign-in, `G0()`:

1. `GET {worker}/api/me` (Bearer idToken) → `{email, uid, role, name, modules}`.
2. No `role` ⇒ sign out, log `LOGIN_DENIED`, error *"Your account isn't provisioned for access yet. Ask an admin to add you."*
3. Builds session `{email, uid, role, name, modules, loginAt}` → localStorage **`xt_auth_session`** (expires after **720 h / 30 days**), logs `LOGIN_SUCCESS`, starts presence, fires GA `login`.

Logout clears `xt_auth_session` and sessionStorage `xt_token`, `xt_client`, `xt_modules_opened_this_session`, `xt_session_id`, logs `LOGOUT`.

The AI proxy uses a **separate token**: sessionStorage **`xt_token`** (+ `xt_client`), refreshed on 401 via `jd()`/`O` and cleared with the "access link expired" message.

### Role model (`yd`)

```js
Zw = ["intel3","reports","exec","m6v3","links","m3"]                      // client module set
ay = [all module ids incl. activity, settings]                            // full set
yd = {
  super_admin:   {modules: ay, tabs: ry},
  admin:         {modules: ay, tabs: ry},
  client:        {modules: Zw, tabs: {}},
  client_portal: {modules: ["m2","m6v2","m6v3","links"], tabs: {m2:["reportv6","trajectoryv2"]}}
}
```

Gate `eE(role, moduleId)`: `profile` always allowed; `super_admin` sees everything; `users`/`invites` → super_admin only; `aicosts`/`mail` → admin or super_admin; otherwise allowed if the id is in the per-user `session.modules` override, else in `yd[role].modules`. Tab gate `tE` uses `yd[role].tabs` (e.g. `client_portal` gets only the `reportv6`/`trajectoryv2` tabs of Perception Monitor). Landing module `nE(role)`: `client_portal → "m2"`, everyone else → `"intel3"`.

**"Xtrusio team" vs "Sirion portal":** there is no literal portal string — the split is entirely role-based. `admin`/`super_admin` = Xtrusio team (all modules + system tools); `client`/`client_portal` = the customer (Sirion) with the reduced read-mostly module sets above. Feature modules add their own guards on top (e.g. Company Intel V3 hides the Domino lens from non-admins). Sidebar footer badge renders "Super Admin" / "Admin" / "Client" `· v1.0`.

### Invites & password reset

- Google invite: `POST /api/invite/accept` `{token}` (Bearer idToken).
- Password invite: `POST /api/invite/accept-password` `{token, email, password}` (password ≥ 8 chars).
- Reset: `POST /api/mail/auth-action` `{type:"reset", email}`; falls back to Firebase `sendPasswordReset` if mail isn't configured.

### PresenceWatcher

Component `o1` (`PresenceWatcher`). Heartbeats every **15 s** (skipped while `document.hidden`; flush on `beforeunload` with `endedAt`) writing `ct.update("live_sessions", sessionId, doc)`:

```
{ email, role, name, sessionId, currentModule, currentTab, currentArticleId,
  lastAction, lastActionAt, lastSeen (ISO), lastSeen_ms, startedAt, userAgent (≤200), clientDomain }
```

`sessionId` = sessionStorage `xt_session_id` (`s_<ts36>_<rand>`). Reader `gd()` runQueries `live_sessions` where `lastSeen_ms > now − 90 000`, DESC, limit 50 (Activity view polls it every 5 s).

## Firebase / persistence

**Config `ze` = `{apiKey:"AIzaSyCbZIwkEHKy8r3HSxmLNFau6lnD-VeG_Q8", projectId:"sirion-persona-stage"}`** — the app talks to **Firestore via plain REST** (`https://firestore.googleapis.com/v1/projects/sirion-persona-stage/databases/(default)/documents`, key in query string), no Firebase SDK for data. If no project id: console warning *"Data will only persist in localStorage… Set VITE_FIREBASE_PROJECT_ID in .env…"*.

Helper `ct`: `save` (POST, auto-id), `saveWithId`/`update` (PATCH with `updateMask`), `getAll` (pageSize 50), `getById`, `delete`, `queryByFieldAll` (runQuery paginated), `test()` (1-doc read of `analyses`). Value codec `Ha`/`Qt`: strings capped at 200 000 chars, arrays >500 items stringified, nesting depth 3, `_id` from doc name. A **429 circuit breaker** short-circuits reads to cache for 5 minutes after a rate-limit.

### Caching tiers

1. **IndexedDB** read cache: DB **`xtrusio-read-cache`**, store `entries` (keyPath `key`, index `collection`). Read-through with TTLs: `syq_reports`/`m2_scan_meta`/`m2_scan_snapshot` 1 h; `m1_personas`/`m1_macros` 7 d; default 24 h. Disabled by localStorage `xt_read_cache = "off"`. `pipelines` and a no-cache set are never cached; `m2_scan_results`/`m2_scans` skip caching when >500 KB.
2. **localStorage doc mirror**: key `xt_<collection>_<id>` (e.g. `xt_pipelines_<id>`), quota-evicting.
3. **Data-version reset**: constant `ld="2026-04-16-v6"`; when localStorage `xt_data_version` differs, clears `xt_pipeline_snapshot` + `m2_scanHistory` and deletes IndexedDB DBs `xtrusio-m1`, `xtrusio-read-cache`, `xtrusio-m3`.

### Firestore collection inventory (whole bundle)

| Area | Collections |
|---|---|
| Shell | `pipelines` (main pipeline store), `activity_log`, `live_sessions`, `m2_notifications`, `m2_impact_summary`, `m2_config` (health probe), `analyses` (probe + Buying Stage) |
| M1 Question Generator | `m1_questions_v2`, `m1_personas`, `m1_macros`, `m1_company_intel`, `user_segments` |
| M2 Perception Monitor / scans | `m2_scan_meta`, `m2_scan_results`, `m2_scans`, `m2_scan_attempts`, `m2_scan_snapshot`, `m2_scan_runs`, `m2_config`, `m2_sections`, `m2_content_gaps`, `m2_report_views`, `m2_segments_v3/_v4/_v5`, `m2_questions`, `m2_tags`, per-run scan collections (`baseline_20260423_1718`, `baseline_20260423_2229`, `<scanId>`…) |
| M3 | `m3_authority_ring` |
| Company Intel engine | `intel_v2_cache`, `intel_v2_config` (doc `news_subscriptions`), `intel_v2_news_archive`, `intel_v2_marketdata_archive`, `intel_v2_snapshots`, `intel_v2_opportunities`, `intel_v2_opportunities_seen`, `intel_v2_opportunities_history`, `intel_v2_actions`, `intel_v2_domino_{industries,companies,signals,matrix_snapshots,correlations,predictions}` |
| Content Strategy / KB | `kb_stores`, `kb_entries` |

(`firebaseCleanup.nukeAll` wipes: `pipelines`, `m1_questions_v2`, `m1_personas`, `m1_macros`, `m1_company_intel`, `m2_scan_meta`, `m2_scans`, `m2_scan_results`, `m2_config`, `m2_sections`, `m2_content_gaps`, `m3_authority_ring`, `analyses`.)

## Backend worker endpoint inventory (`https://xtrusio-ai.thedevimapro.workers.dev`)

Auth legend: **idToken** = `Authorization: Bearer <Firebase idToken>` (helper `St`); **xt_token** = Bearer `sessionStorage["xt_token"]` (AI access link; auto-refresh + retry on 401).

| Endpoint | Method | Auth | Used by / payload |
|---|---|---|---|
| `/api/me` | GET | idToken | Session bootstrap → `{email, uid, role, name, modules}` |
| `/api/auth/login` | POST | none | Health check only (dummy `{email:"__healthcheck__",password:"__none__"}`) |
| `/api/invite/accept` | POST | idToken | `{token}` |
| `/api/invite/accept-password` | POST | none | `{token, email, password}` |
| `/api/mail/auth-action` | POST | none | `{type:"reset", email}` |
| `/api/ai/chat` | POST | xt_token | **The AI proxy.** `{provider:"anthropic"\|"openai"\|"grok"\|"perplexity", body:{model, max_tokens, messages, …}}`; Gemini shape `{provider:"gemini", model, body:{contents, generationConfig, tools?}}`. Callers: claudeApi (all modules), scanEngine, baselineScanner, PerceptionMonitor, intel engine |
| `/api/scrape` | POST | xt_token | Firecrawl scrape `{url, formats:["markdown"], onlyMainContent, timeout, waitFor}` (claudeApi `callFirecrawl`) |
| `/api/firecrawl-map` | POST | xt_token | Firecrawl site map → `{links[]}` (`callFirecrawlMap`) |
| `/api/gnews` | POST | xt_token | GNews proxy `{query, lang, country, max, from, sortby}` (needs `GNEWS_API_KEY` worker secret) |
| `/api/rss` | GET/POST | xt_token | **Deprecated** Google News RSS proxy (replaced by gnews 2026-05-09) |
| `/api/scan/start` | POST | xt_token/idToken | Server-side scan: `{plan:{scanId, questions[{id,query,persona,stage}], models, company, mode:"economy", reps, scanName, teamName, segmentDocId, segmentId, segmentName, reportId}}` |
| `/api/scan/{id}/status` | GET | ″ | Poll: `{phase, counts:{settled, planned}}` (terminal: complete/abandoned/cancelled/error) |
| `/api/scan/{id}/cancel` | POST | ″ | |
| `/api/scan/{id}/pause` / `/resume` / `/retry` | POST | ″ | |
| `/api/scan/{id}/snapshot` | POST | ″ | Build scan snapshot |
| `/api/scan/run` | POST | ″ | Legacy scanEngine server run |
| `/api/util/resolve-redirect` | POST | xt_token | Resolve `vertexaisearch.cloud.google.com` grounding redirect URLs (baselineScanner, ExecutiveSummary) |
| `/api/keys/list` | GET | xt_token | `{providers}` per-user BYO keys |
| `/api/keys/save` | POST | xt_token | `{provider, apiKey}` |
| `/api/keys/test` | POST | xt_token | Ping each provider with tiny model calls |
| `/api/keys/clear` | POST | xt_token | `{provider}` or `{}` = all (falls back to default Xtrusio keys) |
| `/api/storage/upload` | POST | Bearer | `{path, data}` JSON blob storage (KV) |
| `/api/storage/download` | GET | Bearer | `?path=` (404→null) |
| `/api/storage/list` | GET | Bearer | `?prefix=` → `{names}` |
| `/api/storage/delete` | DELETE | Bearer | `?path=` |
| `/api/admin/users` | GET/POST/PATCH/DELETE | idToken | User Management (super_admin); DELETE via `?uid=` |
| `/api/admin/invites` | GET/POST | idToken | Invites (super_admin) |
| `/api/admin/mail/config` | GET/PUT | idToken | SMTP config (super_admin) |
| `/api/admin/mail/send` | POST | idToken | `{to\|toRole, subject, html, text, templateId}` |
| `/api/admin/mail/test` | POST | idToken | `{to:[…]}` |
| `/api/admin/mail/logs` | GET | idToken | `?limit=` |
| `/api/admin/costs/summary` | GET | idToken | `?range=today\|month\|all` |
| `/api/admin/costs/logs` | GET | idToken | `?limit=` (+filters) |
| `/api/video/render`, `/api/video/avatar`, `/api/video/presenter-photo` | POST | Bearer | Video generation (YouTube module chunk `index-Dz3blxfN.js`) |

### AI proxy client (`claudeApi-DNyhT86p.js`) — exported surface

`proxyChat(provider, body, opts)` plus wrappers: `callClaude` (claude-sonnet-5 + `web_search_20250305` tool), `callClaudeFast` (claude-sonnet-5, thinking disabled), `callClaudeHaiku` (`claude-haiku-4-5-20251001`), `callClaudeChat` (multi-turn), `callOpenAI` (`gpt-4o`, optional `response_format:{type:"json_object"}`), `callGemini` (`gemini-2.5-flash` default, google_search tools, robust JSON salvage `parseGeminiJson`), `callGrok` (`grok-4-latest` + `search_parameters:{mode:"auto"}`), `callPerplexity` (`sonar`/`sonar-pro`), `callFirecrawl`, `callFirecrawlMap`, `hasAccessToken`, `getAccessClient`, `clearAccessToken`. Friendly error mapping: 401 *"Your access link has expired. Contact your account manager."* (clears tokens), 403 *"Access revoked…"*, 429/504/502 retry messaging.

## Theme

`rd={dark:{…}, light:{…}}` token objects (`bg, bgAlt, bgCard, sidebar, border, text, textSec, textDim, textGhost, brand (#7c3aed light / #a78bfa dark), client (#0891b2 / #67e8f9), green, red, yellow, orange, heat*, tooltipBg, inputBg, btnBg, …`). React context `Cy` + hook `Dy`; root component holds an `isDark` boolean state. **Default is light and the choice is not persisted** (no theme localStorage key). Fonts: Inter (body) / JetBrains Mono (mono) via CSS variables.

## Storage key inventory (whole bundle)

**localStorage:** `xt_auth_session` (session, 30 d), `xt_pipeline_snapshot`, `xt_pipelines_*` / `xt_<collection>_<id>` (doc mirror), `xt_data_version`, `xt_read_cache`, `xt_server_url`, `xt_scan_engine`, `xt_use_server_scan`, `xt_use_snapshots`, `xt_openai_tpm`, `xt_gap_<model>_ms` (scan throttle overrides), `m2_scanHistory`, `xt_m2_calibration`, `xt_cluster_cal`, `xt_decision_scores` (Question Generator), `m6v3_articles_view`, `m6v3_approved_view`, `m6v3_clientreview_view` (Content Strategy view prefs), `fb_cache_*` (PerceptionMonitor), `xt_intelv2_cache_*`, `xt_intelv2_snapshot_*`, `xt_domino_*`, `xt_research_log_v1` (Company Intel), `xt_fs_anon_token`(+`_expires`).

**sessionStorage:** `xt_token`, `xt_client`, `xt_session_id`, `xt_modules_opened_this_session`, `xt_m6v3_jump_to_view`, `xt_fs_anon_token`, `xt_fs_anon_token_expires`.

**IndexedDB:** `xtrusio-read-cache` (store `entries`); legacy DBs `xtrusio-m1`, `xtrusio-m3` (deleted on data-version bump).

## Activity & email (shell-owned services)

- Activity log writer `Bn` → Firestore `activity_log` (shape and action list documented in `admin-and-utilities.md`).
- Email template catalog `sA` (reportPublished / invite / accessUpdated / welcome / custom / verify / reset) with `{{token}}` rendering `Zu` and server send `Sd(templateId,{to|toRole,tokens})` → `/api/admin/mail/send`; sample data references company "Sirion" and `https://app.xtrusio.com/sirion/#/reports/report`.
- Google Analytics events fired from the shell: `login`, `sign_up` (`invite`/`invite-password`), `email_sent`.

## For AI assistants

- **Roles are the product boundary.** `admin`/`super_admin` = Xtrusio team; `client` = Sirion stakeholders (6 read-mostly modules); `client_portal` = narrow report-viewer (m2 report tabs + content/links). All gating goes through `eE`/`tE` + the `adminOnly`/`superOnly` nav flags, with optional per-user `session.modules` overrides from `/api/me` — extend those, don't add ad-hoc checks.
- **Two credential systems:** Firebase idToken for identity/admin endpoints, `xt_token` "access link" for AI/scan/keys/storage endpoints. A 401 on the AI side means the access link expired (session-scoped), not the login.
- **Firestore is called unauthenticated-by-rules from the browser** (API key only, REST). Treat collection names as public API: they are hardcoded in many chunks and mirrored into localStorage under `xt_<collection>_<id>`.
- To invalidate cached data fleet-wide, bump `ld` (`xt_data_version` constant, currently `"2026-04-16-v6"`) or version the cache key/collection suffix — don't rely on users clearing storage.
- Adding a module = add to `Yi` + `Ua` (path, section, flags), the role sets `Zw`/`ay`, alias map `$l` if the path changes, and a lazy `import()` branch; module ids are also used by presence (`currentModule`), activity log, and per-user module overrides.
- The worker base URL appears under several minified aliases; the single source of truth for overriding it at runtime is localStorage `xt_server_url`.
- GH Pages serves the SPA: keep the root "Coming soon" page, `CNAME`, and the meta no-cache tags in `sirion/index.html` intact when redeploying — `_headers` is decorative on GitHub Pages.
