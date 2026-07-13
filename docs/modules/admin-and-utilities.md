# Admin & Utility Modules

**Bundle files:** `StrategyAdvisor-BfWn4fB1.js`, `MailCenter-Bk9wJXGW.js`, `AiCostsPanel-B9sKDGiA.js`, `campaigns-gnROApsc.js`, `excelImport-DXzVN75I.js`, `download-DBL_vREL.js`, `firebaseCleanup-Bc5hZ9Bk.js`, plus the Activity and Settings views that live inside the app shell (`index-BZaWgRns.js` — see `app-shell-and-infrastructure.md` for shell internals).

## Purpose

This group covers the operational surface of Xtrusio: an AI chat advisor over pipeline data (Strategy Advisor), transactional/manual email (Email Center), LLM spend tracking (AI Costs), the campaign seed config, Excel question import, the audit/presence view (Activity), the Settings module, and destructive cleanup tooling.

Shared plumbing (all from `index-BZaWgRns.js`): worker base `https://xtrusio-ai.thedevimapro.workers.dev`; authed request helper `St(method, path, body)` (Bearer Firebase idToken); Firestore REST layer `ct` (`getAll`, `getAllPaginated`, `getById`, `save`, `saveWithId`, `update`, `delete`); AI proxy client `claudeApi-DNyhT86p.js` (`POST /api/ai/chat`, Bearer `sessionStorage["xt_token"]`).

---

## Strategy Advisor (`StrategyAdvisor-BfWn4fB1.js`)

A slide-in chat panel (component `T({open, onClose})`, full-width under 900 px) where marketing/growth leaders interrogate their pipeline data. Title **"Strategy Advisor"**, subtitle *"Ask questions about your AI visibility data, competitive positioning, and growth strategy."*, badge **"Powered by Claude"**. Buttons: "Clear", "×". Suggested questions (shown when empty):

- "What are our biggest visibility gaps?"
- "How do we compare to Icertis?"
- "Which authority domains should we prioritize?"
- "Summarize our AI perception scorecard"

Input placeholder *"Ask about your pipeline data..."*; footer *"Enter to send · Shift+Enter for new line"*. Assistant replies rendered by a mini markdown parser (bullets → `<ul>`).

**Model call:** `callClaudeChat(systemPrompt, [...history, {role:"user",content:text}])` → `claude-sonnet-5`, `thinking:{type:"disabled"}`, max 2048 tokens, via the worker proxy.

**System prompt (verbatim, built from the live pipeline object):**

```
You are the Xtrusio Strategy Advisor for ${company||"the company"} (${industry||"B2B SaaS"}).
You help marketing and growth leaders interpret AI visibility data and recommend actions to improve organic discovery in AI search engines (ChatGPT, Claude, Gemini).

Current Pipeline Data:
- Company: … | Industry: … | URL: …
- M1 Discovery Questions: N questions across N persona types
- Key personas: …
- M2 AI Visibility Score: N/100 | Mention Rate: N% | Share of Voice: N%
- M2 Sentiment: N% | Accuracy: N% | Completeness: N%
- Top competitors: …
- M3 Authority Ring: N gap domains (zero presence), N strong, N present, N total analyzed
- M3 Top gap domains: …
- M4 Buying Stage: Latest stage analyzed: … | N analyses completed
- M5 Recommendations: N active recommendations

Guidelines:
- Keep responses concise (2-4 paragraphs max unless asked for detail)
- Use bullet points for actionable recommendations
- Reference specific data points and numbers from the pipeline
- If data is missing (N/A or 0), note that the module hasn't been run yet and suggest doing so
- Focus on strategic implications, not technical details
- Be direct and opinionated — the user wants clear advice, not hedging
```

Injected sub-templates: competitors `"${name} (${mentions} mentions, ${positive} positive)"` (top 6 of `m2.competitorSummary`); gap domains `"${domain} (DA ${da}, ${priority} priority)"` (top 5 `m3.prioritizedDomains` with `sirionStatus==="verified_zero"`, DA desc); personas `"${name} - ${title} at ${company}"` (top 6 `m1.personaProfiles`).

**Data model read (pipeline):** `meta{company,industry,url}`, `m1{questions[],personas[],personaProfiles[]}`, `m2{scores{overall,mention,shareOfVoice,sentiment,accuracy,completeness}, competitorSummary[]}`, `m3{gapCount,strongCount,presentCount,totalDomains,prioritizedDomains[]}`, `m4{latestStage,analyses[]}`, `m5{recommendations[]}`. **No own storage; no role gating** (gated by whoever mounts it). Chat history is in-memory only.

---

## Mail Center (`MailCenter-Bk9wJXGW.js`, nav id `mail`, path `/email`, adminOnly)

Header eyebrow **"EMAIL CENTER"**, heading **"Send email to clients"**, description (verbatim): *"System emails — invites, access changes, published reports, password resets — send automatically. Everything else is written and sent by hand from here; content emails are never automatic."*

Tabs: **Compose**, **Templates**, **History**, and **Settings** (super_admin only, `_()?.role==="super_admin"`).

- **Compose** — template select, "Recipient(s)" input with a datalist auto-filled from `listUsers()` emails (split on `/[,;\s]+/`), editable Subject, one field per template placeholder, custom-template body ("What changed (HTML list)"), live preview iframe (`srcDoc`). Send → success toast `` `Sent to ${emails} — it's in History now.` ``. Fires analytics `email_sent {template_id}`.
- **Templates** — template list with rendered subject + sandboxed HTML preview using each template's `sample` tokens.
- **History** — table: To / Subject / Template / Status / By (status green/red, `— ${error}` suffix).
- **Settings** (super_admin) — SMTP config: Host; Port (*"465 or 587 — security is set from it (now: TLS|STARTTLS)"*, ≥465 ⇒ TLS else STARTTLS); SMTP username (`noreply@xtrusio.org`); App password (*"Saved — blank keeps it." / "From Stalwart → app passwords."*); From address; From name ("Xtrusio"). Plus **"Send a test email"** (*"Checks everything end to end — the test arrives from the address above."*).

**Templates** (catalog `sA` in the shell; `{id,label,subject,placeholders,sample,html,text}`; `{{token}}` substitution, HTML-escaped except `*Html` keys):

| id | subject | placeholders |
|---|---|---|
| `reportPublished` | `Your {{companyName}} perception report is ready` | recipientName, companyName, reportName, reportLink |
| `invite` | `You're invited to Xtrusio` | recipientName, role, inviteLink |
| `accessUpdated` | `Your Xtrusio access was updated` | recipientName, changesHtml |
| `welcome` | `Your Xtrusio account is ready` | recipientName, changesHtml, loginLink |
| `custom` | `A note from Xtrusio` | recipientName, bodyHtml |
| `verify` (auth-only, hidden from compose) | `Verify your email for Xtrusio` | actionLink, recipientEmail |
| `reset` (auth-only, hidden from compose) | `Reset your Xtrusio password` | actionLink, recipientEmail |

**Backend endpoints (mail API `dA`):** `GET /api/admin/mail/config` → `{host, port, security, username, senderEmail, senderName, hasPassword}`; `PUT /api/admin/mail/config` (same fields + `appPassword`); `POST /api/admin/mail/test` `{to:[…]}`; `POST /api/admin/mail/send` `{to|toRole, subject, html, text, templateId}`; `GET /api/admin/mail/logs?limit=N` → `{logs:[{id, to[], subject, templateId, status, error, sentBy, ts}]}`. Other modules pre-fill Compose via in-memory draft + `CustomEvent("xtrusio:mail-compose")` + `location.hash="/email"`; server-templated sends go through shell helper `Sd(templateId, {to|toRole, tokens})`.

**No LLM prompts. Role gating:** module adminOnly; Settings tab super_admin.

---

## AI Costs Panel (`AiCostsPanel-B9sKDGiA.js`, nav id `aicosts`, path `/ai-costs`, adminOnly)

Heading **"AI Costs"**, subtitle *"Real token usage × published model rates. Admin only."* Range selector: `today` "Today" / `month` "This Month" (default) / `all` "All Time" + Refresh. Denied state: *"AI Costs is admin-only."* (guard `role==="admin"||role==="super_admin"`).

Summary card "Total spend (<range>)" with unpriced-call warning (*"N call(s) used an unpriced model — tokens captured, $…"*). Breakdown tables **By Model / By Provider / By User / By Key Source** (columns Cost / Calls / In tok / Out tok, sorted by `microUSD` desc; empty: "No spend in this range."). **Recent Calls** ("latest N, all ranges"): When / User / Ctx / Model / Key (`keySource==="user"` → "own key", else "company") / In / Out / Cost ("needs rate" when `needsRate`).

**Endpoints (costs API `E4`):** `GET /api/admin/costs/summary?range=<today|month|all>` → `{totalMicroUSD, unpricedCalls, byModel, byProvider, byUser, byKeySource}` (each map value `{microUSD, calls, inputTokens, outputTokens}`); `GET /api/admin/costs/logs?limit=200` → rows `{_id, ts, who, tag|context, model, keySource, inputTokens, outputTokens, needsRate, costMicroUSD}`. Amounts are micro-USD (÷1e6; sub-cent shown to 4 decimals). No storage of its own; no prompts.

---

## Campaigns seed (`campaigns-gnROApsc.js`)

Not a UI module — a static seed/config export `{campaigns:[…]}` consumed by Company Intelligence V3 and Content Strategy. Single campaign:

```
id: "sirion_perception_shift_2026", clientId: "sirion", name: "Sirion — Perception Shift",
subtitle: "Reposition from post-signature CLM specialist to full-stack platform",
status: "active", createdAt: "2026-04-29", company: "Sirion",
sourceScans: ["baseline_20260423_1718"], showTracks: false, segmentIds: [],
monthlyPlacementBudget: { high:{min:1, daThreshold:60, label:"DA 60+"},
                          mid:{min:5, daRange:[40,59], label:"DA 40–59"} }
```

Tracks (`{id,name,direction,writeArticles,targetKpis,color}`): `fullstack` "Full-Stack" (increase, writes articles, kpi `narrative_full_stack`, #10b981), `presig` "Pre-Signature" (increase, writes articles, #3b82f6), `postsig` "Post-Signature" (**decrease**, no articles, kpi `narrative_post_sig`, #f59e0b). Inline `_*_note` fields document semantics: `showTracks:false` hides per-track tabs and shows the campaign description; `segmentIds:[]` = consume ALL M1/M2 gaps. The description states the 90-day repositioning strategy (lift Full-Stack + Pre-Signature narratives in AI search while passively shrinking Post-Signature framing through displacement). No Firestore collection, no API calls.

---

## Activity module (in shell, nav id `activity`, path `/activity`)

Live presence + audit history. Header: *"Live presence + history of every named user action. Auto-refreshes."*

- **Writer** `Bn({action, module, target, meta})` → `ct.save("activity_log", doc)`. Doc shape: `{email (lowercased), role, name, action (UPPERCASE), module, target (≤200 chars), meta, ts (ISO), ts_ms, sessionId, clientDomain, userAgent (≤200)}`. Throttling helper `m4` suppresses duplicate events per interval.
- **Known actions** (humanizer map `YT`): `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_DENIED`, `LOGOUT`, `PASSWORD_RESET_REQUESTED`, `MODULE_OPENED`, `DOMAIN_CHANGED`, `ARTICLE_CREATED`, `ARTICLE_EDITED`, `ARTICLE_DELETED`, `FIX_WITH_AI`, `KB_CRAWL_STARTED`, `KB_CRAWL_COMPLETED`, `SCAN_RUN`, `QUESTIONS_GENERATED`, `TOPICS_GENERATED`.
- **Reader** `iy({limit ≤1000})` — Firestore `runQuery` on `activity_log`; UI polls history (limit 500) every 30 s and presence (`gd()`, `live_sessions` where `lastSeen_ms > now−90s`, limit 50) every 5 s, with user/action/date-range filters (default "7d"), relative timestamps and Today/Yesterday grouping. A green toast announces users who just came online.
- **Privacy rule:** non-super_admin viewers have `super_admin`-role rows filtered out of the view.

Presence itself is written by the shell's `PresenceWatcher` (see infra doc).

---

## Settings module (in shell, nav id `settings`, path `/settings`; deeper panes code-split)

- **Provider API keys** (worker-stored, per user): registry `vy` — `anthropic` "Anthropic (Claude)" (`sk-ant-...`), `openai` (`sk-proj-.../sk-...`), `gemini` "Google Gemini" (`AIza...`), `grok` "xAI Grok" (`xai-...`), `perplexity` (`pplx-...`). Endpoints (Bearer `xt_token`): `GET /api/keys/list` → `{providers}`, `POST /api/keys/save` `{provider, apiKey}`, `POST /api/keys/test` (per-provider ping using models `claude-haiku-4-5-20251001` / `gpt-4o` / `gemini-2.5-flash` / `grok-4-latest` / `sonar`), `POST /api/keys/clear` `{provider}` or `{}` (all — *"Clear ALL your saved provider keys? Future calls will use the default Xtrusio keys."*). Status labels: "✓ working", `key_ok_model_issue`, "✗ key invalid", "✗ no key configured", "⚠ timed out", error.
- **Health checks** (`VT`): Database (Firebase) via a 1-doc read of `m2_config`; AI service reachability via `POST /api/auth/login` with dummy creds `{email:"__healthcheck__",password:"__none__"}`; AI access-token presence (`sessionStorage["xt_token"]`).
- **Scan/engine toggles** (code-split panes; keys live in localStorage): `xt_server_url` (worker override), `xt_scan_engine` (`"client"` disables server scan), `xt_use_server_scan`, `xt_use_snapshots` (`"on"`), `xt_read_cache` (`"off"` disables IndexedDB read cache), `xt_openai_tpm` (client-side OpenAI TPM limiter override).
- **Danger Zone** — requires typing `DELETE`, then lazily imports `firebaseCleanup-Bc5hZ9Bk.js` and runs `nukeAll`.

## Excel import (`excelImport-DXzVN75I.js`)

Imports buyer-intent questions into the M2 question bank using the **`xlsx`** library (`read`, `utils.sheet_to_json` from `xlsx-DhngPAv0.js`). Reads the first sheet, scans the first 10 rows for a header containing "query"/"question"/"question text", then maps columns by alias (num, query [required], persona/role, stage, lifecycle, cluster/topic/theme, intent, measures/metric, review status, tags/labels; tags split on `/[,;|]/`). Errors: *"Could not locate header row. Expected a column named 'Query' or 'Question'."*, *"No Query column found in Excel."*

Produces normalized question docs `{id:"Q001"…, query, persona, stage, lifecycle, cluster, intent, measures, reviewStatus, tags[], source:"excel"|"manual", sourceRow, sourceFile, volumeTier:"high"|"medium"|"niche"|null, archived:false, addedAt, addedBy}` saved to Firestore **`m2_questions`**; a tag registry is upserted in **`m2_tags`** (`{id (slug), name, createdAt, updatedAt}`).

**Dedup:** Dice-coefficient bigram similarity; ≥0.9 auto-skip (exact/fuzzy), 0.8–0.9 borderline pairs go to **`callClaudeHaiku`** (`claude-haiku-4-5-20251001`, max 2000) with system prompt (verbatim): *"You compare pairs of buyer-intent questions and decide if they are SEMANTICALLY EQUIVALENT (same meaning / answer) or DIFFERENT (distinct topic or angle). Rules: Equivalent = would elicit the same answer from a vendor. Minor wording differences count as equivalent. Different = different angle, different stage, different detail, different audience intent. Output ONLY valid JSON matching the schema. No preamble."* User prompt supplies `{results:[{sourceRow, newQuestion, existingQuestion, similarityScore}]}` and requests `{"decisions":[{"sourceRow", "verdict":"duplicate"|"different", "reasoning"}]}`. AI failure falls back to keeping the rows.

## download-DBL_vREL.js and firebaseCleanup-Bc5hZ9Bk.js

- `download-DBL_vREL.js` — one-line Lucide "download" icon component. Presentational only.
- `firebaseCleanup-Bc5hZ9Bk.js` — exports **`nukeAll`**: deletes every doc in Firestore collections `pipelines`, `m1_questions_v2`, `m1_personas`, `m1_macros`, `m1_company_intel`, `m2_scan_meta`, `m2_scans`, `m2_scan_results`, `m2_config`, `m2_sections`, `m2_content_gaps`, `m3_authority_ring`, `analyses`, and removes localStorage keys starting with `xt_pipelines_`, `xt_pipeline_snapshot`, `xt_m1_`, `xt_m2_`, `xt_m3_`, `xt_analyses_`, `xt_DATA_VERSION`. Returns `{fbDeleted, lsDeleted}`. Caller (Settings Danger Zone) is responsible for gating.

## For AI assistants

- Role gates in this group: `aicosts` and `mail` require `admin`/`super_admin` (enforced both in nav registry flags and inside the components); Mail Settings/SMTP requires `super_admin`; Activity hides super_admin rows from non-super_admins; StrategyAdvisor/excelImport/campaigns/firebaseCleanup have **no internal gate** — do not expose them to client roles without adding one.
- Admin endpoints authenticate with the Firebase **idToken** (`St` helper); AI/keys endpoints authenticate with the session **`xt_token`**. Don't mix the two.
- Email is deliberately manual-first: only invite/access/report/password emails are automated; anything else must be composed by a human in Mail Center. Keep `verify`/`reset` templates out of the compose picker (`L = new Set(["verify","reset"])`).
- Cost figures are integer micro-USD end-to-end; render with ÷1e6 and keep the "needs rate"/unpriced-model paths intact when adding models.
- `campaigns-gnROApsc.js` is checked-in seed data, not user data — changing the campaign id `sirion_perception_shift_2026` breaks Company-Intel→Content candidate routing.
- `nukeAll` is irreversible and cross-module; if you add a Firestore collection that stores pipeline-derived data, decide explicitly whether it belongs in the nuke list.
