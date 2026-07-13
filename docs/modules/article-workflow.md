# Article Workflow — Statuses, Client Review, Versions, Spinoffs, Push to Link Strategy

**Purpose.** This documents the review/approval lifecycle of every article in Content Strategy (`m6v3`): the full status enum and who moves articles between statuses (Xtrusio team vs the client portal role), the client review portal, AI revision and edited-.docx upload paths, version history and locking, the spinoff generators (Medium, press release, LinkedIn, YouTube, video project), and the exact handoff object pushed to Link Strategy (M7). All code lives in `sirion/assets/index-BdFOWPPW.js` unless noted; store actions in `sirion/assets/useM6V3Store-DWIdWJng.js`.

---

## Status enum (`wn` map — exact keys, labels, colors)

| Status key | UI label | Color | Meaning / set by |
|---|---|---|---|
| `imported-pending` | Imported · OK as-is | #6b6b6b | Import modal: file had **no** feedback attached (`importVerdict:"approved-as-is"`) |
| `imported-rejected` | Rejected by client | #dc2626 | Import modal: feedback contained rejection phrases (`importVerdict:"rejected"`) |
| `draft` | Draft | #a855f7 | Manual "Move to Draft" on Medium/PR children; legacy default |
| `needs-revision` | Needs AI revision | #f59e0b | Import with feedback; topic-seeded stubs; discarded rewrite; freshly generated Medium/PR child; "Unpush" of a child |
| `revising` | Revising… | #3b82f6 | Transient while "Apply AI revision" runs (auto-recovered to `needs-revision` if the editor loads an article stuck in `revising`) |
| `ready-for-client` | Client reviewing | #a855f7 | Set when an AI rewrite is **accepted**; sample articles seed at this status |
| `in-review` | Client reviewing | #a855f7 | Team clicks **"Push to client portal"** (`og`); counted together with `ready-for-client` everywhere |
| `client-feedback` | Client requested changes | #ea580c | Reserved/legacy — appears in the status map and the client bucket "With Xtrusio team", but no setter exists in the current bundle |
| `client-edited` | Client edited | #0ea5e9 | Client uploads an edited .docx (`clientEditedAt` stamped), or team **unlocks** an approved article (`unlockArticle`) |
| `approved` | Approved | #16a34a | Client's **"Approve this article"** or team's **"Mark approved"** → `approveAndLock(id, "client"\|"admin")` (also sets `locked:true`, `approvedAt`, `approvedBy`) |
| `pushed-to-link-strategy` | In Link Strategy | #7c3aed | Team's **"Push to Link Strategy"** (anchor) or child-panel push (Medium/PR) |
| `published` | Published | #6b6b6b | Written back **by Link Strategy (M7)** when a placement URL is recorded; also settable on children |
| `rejected` | Rejected | #dc2626 | Team "✗ Reject" on Medium/PR children (`rejectedAt`); hidden from lists unless "Show rejected" |

Client-visible set (`px`): `ready-for-client`, `in-review`, `client-feedback`, `client-edited`, `approved`, `pushed-to-link-strategy`, `published` — clients never see drafts/needs-revision/imported/rejected articles. Source labels (`fx`): `imported` "Imported", `ai-generated` "AI-written", `manual` "Manual".

### Canonical happy path
```
(win-back seed | import)          Xtrusio team                     client portal            Xtrusio team
needs-revision ── Apply AI revision → revising → accept → ready-for-client
ready-for-client ── "Push to client portal" → in-review
in-review ── client edits .docx upload → client-edited ── client "Approve" → approved (locked)
approved ── "Push to Link Strategy" → pushed-to-link-strategy ── M7 records URL → published
```
Any approved article can be **unlocked** ("Unlock for revision", confirm dialog: the approved version is preserved in history) → `client-edited`, unlocked, until re-approved.

---

## Who does what (role views)

- **Xtrusio team** (admin/member): sees all five tabs (Perception Gaps, In Progress, Articles, Client Review, Approved) + Templates. Full editor: edit title/body, Apply AI revision, Fix with AI (auto + per-pillar), style rules management, import, delete, Push to client portal, Mark approved, Unlock, Push to Link Strategy, spinoff generation, sample seeding. The "Client Review" tab for the team is explicitly a *preview-as-client* view ("Sirion sees the same view in their portal").
- **Client portal** (`session.role === "client_portal"`, `isClientMode`): forced to **Client Review** and **Approved** tabs only. In the editor the client can: edit title/body inline, paste feedback + **Apply AI revision** (same AI chain), upload an edited .docx (sets `client-edited`), and click the big green **"Approve this article"** (`approveAndLock(id,"client")`, toast: "Approved. The Xtrusio team can now push it to Link Strategy."). Clients cannot: manage style rules (button disabled — "Style rules are managed by Xtrusio"), see health-score/fix panels, push anywhere, delete, change templates, or see the Medium/PR/LinkedIn/YouTube studio tabs.

**Client Review tab buckets** (`gA`):
- `pending` "Pending your review" — statuses `ready-for-client`, `in-review`, `client-edited` ("These articles need your Approve. Edit inline, run AI revision, or upload an edited .docx — then click Approve when satisfied.")
- `awaiting-team` "With Xtrusio team" — status `client-feedback` ("You requested changes — Xtrusio is revising.")
A progress banner counts approved+pushed vs total ("All N articles approved ✓ … Xtrusio team can now push them to Link Strategy"). Grouped by channel: Client Blog (faq, "published on sirion.com"), Third-Party (narrative, "external publisher blogs"), Medium.

**Approved tab** (`jA`): statuses `approved` + `pushed-to-link-strategy`; team hint: "Click Download .docx to grab the file for outreach, or click the row to open the editor and Push to Link Strategy."

---

## Apply AI revision (the core rewrite loop)

Editor panel "Client feedback": textarea (client placeholder: "What would you like changed? AI will rewrite the article using your comments + the active style rules…") → **Apply AI revision** (`Di`):
1. Article → `revising`; calls `Bx` (task `rewrite-with-feedback`, see prompts doc) with: active style rules, campaign/track, current body, feedback text, selected writing template, Sirion URL whitelist + KB entries, campaign `aiModel`.
2. Provider chain OpenAI(gpt-4o, if GPT selected) → Gemini 2.5 Flash(+google_search) → Perplexity sonar → Grok grok-4-latest → Claude claude-sonnet-5(+web_search); result carries `providerUsed` + `fallback` reason; a prose-only Gemini reply is salvaged into an article body.
3. Preview card "AI rewrote the article" with provider badge (`mA`: "Gemini 2.5" / "Claude", tooltip "Wrote by <provider> with web search", "(fallback)" suffix when a later provider rescued the call), summary, change log, citations/backlinks audit warnings.
4. **Accept this rewrite** (`It`): snapshots version `pre-revision-snapshot` (old body, trigger = the feedback) + `ai-rewrite` (new body, `provider`), then `updateArticle` → new title/body, `status:"ready-for-client"`, `lastChangeLog`, `lastSirionBacklinks` (re-extracted from body), `lastProviderUsed`, clears `importComments`. **Discard** → back to `needs-revision`.

Locked articles refuse revision/fixes ("Article is locked. Unlock it from the Workflow panel first.").

## Upload edited .docx (offline edit round-trip)

Export panel: **Copy as text**, **Download .docx** (styled export incl. Sources/Sirion Backlinks sections), **Upload edited version**:
- `.docx` only, ≤20 MB, parsed with mammoth `convertToHtml` → Markdown-ish text (≤200 KB), citations + Sirion backlinks re-extracted from trailing sections and HTML anchors (redirect URLs filtered); if the upload contains no URLs, the original citations/backlinks are **kept** ("no data loss").
- Snapshots `pre-upload-edited-snapshot` first, then replaces body/wordCount/citations/backlinks in place (article id unchanged). In client mode also sets `status:"client-edited"` + `clientEditedAt`.
- Warning copy: "If you edit offline: keep the *Sources* + *Sirion Backlinks* sections at the bottom of the file intact when you re-upload… they tell the publisher which backlinks must stay live."

## Version history

Stored per article in `m6v3.articleVersions[articleId]` (bodies offloaded to the bucket at `articles/{domainKey}/{articleId}/v_{id}.json`, hydrated on first open of the history panel). Version sources: `pre-revision-snapshot`, `ai-rewrite`, `pre-upload-edited-snapshot`, `pre-autofix-snapshot`, `auto-fix`, `pre-pillar-fix-<pillar>`, `pillar-fix-<pillar>`, `before-restore`, `approved-snapshot` (locked). `restoreArticleVersion(articleId, versionId)` snapshots the current state as `before-restore` ("Snapshot before restoring to version <last-6-chars>") then restores title/body/citations/backlinks. `approveAndLock` writes the `approved-snapshot` ("Article approved by client|admin"). `unlockArticle` → `{locked:false, status:"client-edited", unlockedAt}` with confirm text "The current approved version will be preserved in the version history…".

---

## Spinoffs (per-article studio tabs: Article · LinkedIn · YouTube · Medium · PR)

The channel tabs live in the article editor header. Studio angles come from the source topic's `wheelPlan` (per-channel angle strings); micro-questions from the topic's `microQuestions` drive social posts.

### Medium & PR child articles (`Rj` panel, config `Tu`)
```js
const Tu = {
  medium: { label:"Medium",  generateLabel:"Generate Medium article", generatingLabel:"Generating…",
            pushLabel:"Push to Link Strategy — Medium", pushedNote:"Pushed ✓ — on the Social board's Medium tab" },
  pr:     { label:"PR",      generateLabel:"Generate press release",  generatingLabel:"Generating…",
            pushLabel:"Push to PR Distribution",        pushedNote:"Pushed ✓ — tracked in PR Distribution" }
};
```
- Child lookup: an article with `parentArticleId === anchor.id` and matching `contentFormat` (PR also matches by shared `sourceTopicId`).
- **Generate** requires a non-empty KB ("Knowledge base is empty — build it in Templates → Knowledge Base before generating…"). Both use the shared runner `np`: **Gemini 2.5 Flash → Claude → OpenAI-if-too-short**, with word floors (PR 150 target/100 hard-min; Medium 350/250 — a too-short result throws "The AI returned a truncated article").
  - **PR** (`t0`): system = the `pr` template's systemPrompt; user (`e0`) = anchor article (first 3000 chars) + target query + KB block + **sentinel-token boilerplate block** requiring literal `[[PR_SPOKESPERSON_NAME]]`, `[[PR_SPOKESPERSON_TITLE]]`, `## About <Company>` + `[[PR_ABOUT]]`, `Media Contact:` + `[[PR_MEDIA_CONTACT]]`, and a literal `Read the full release: [FULL-RELEASE-URL]` line. After generation, `ip` substitutes the campaign's **PR settings** (`prSettings`: spokespersonName/Title, aboutParagraph, mediaContact — "Saved once per campaign — auto-fills every release"); missing fields raise "Fill PR settings below — placeholders were used." A "Copy for wire" affordance copies the release for the PR wires.
  - **Medium** (`a0`): system = the `medium` template's systemPrompt (supportive re-angle rules); user (`s0`) = anchor (3000 chars) + **anchor URL** (`article.publishStatus.url` if published, else the placeholder `[anchor URL — publish the main article first]`) + re-angle instruction (topic wheel angle) + target query + KB block (≤10 entries, 1-2 Sirion citations max). Title clipped to 120 chars.
- Child articles are created with `status:"needs-revision"`, `source:"ai-generated"`, `contentFormat:"medium"|"pr"`, `parentArticleId`, inherited `sourceTopicId`/`addressedQids`. The child panel has its own editor, Approve / Move to Draft / Reject / Delete buttons, Regenerate (confirm "Replace the current draft?"), and **Push** → `{status:"pushed-to-link-strategy", pushedToLinkStrategyAt}` (Unpush → `needs-revision`). Medium children land on the Link Strategy Social board's Medium tab; PR children in PR Distribution.

### LinkedIn posts & YouTube scripts (`aA` composer + `sA` generator; store in `useVideoProjects-g_NEwoQk.js`)
- One post/script **per micro-question** of the source topic ("This article isn't linked to a win-back plan with micro-questions yet, so there's nothing to amplify.").
- Generation `sA`: system = channel template systemPrompt (`default-linkedin-post` / `default-youtube-script`) or built-in fallback (`Uu.post`/`Uu.script`); user = target question + channel angle + draft answer (from the micro-question's `tentativeAnswer`) + parent article (2500 chars) + "write the FULL post/script … do not stop early". Providers: **Gemini raw → OpenAI raw**; minimum 60 words (post) / 150 (script). Char caps 3000/6000 with live counters and a LinkedIn-style preview.
- Posts persist in Firestore **`m8_social`** (doc per pipeline `_docId`, `{posts:{}}`, 800 ms debounce). **"Push to Social Amplification →"** stamps every drafted post `{pushedToM7:true, pushedAt}` — the Link Strategy Social board (`index-Dz3blxfN.js`, `bu`) lists exactly the posts with `pushedToM7`, grouped by channel, with publish-URL/indexed/cited tracking (`markPosted` sets `publishedUrl/publishedAt/status:"published"`).

### Video project (YouTube tab → Video Studio)
Opt-in per article: "Start video project" creates a `m7v3_video_projects` doc keyed by articleId with all stages idle. Stage machine `script → package → slides → avatar → publish` (a stage can only start when the previous is `done`; scripts can be AI-`generated` or pasted/`injected`). Slides JSON is validated against archetypes `cluster / converge / flow / contrast / meter` with a fixed icon vocabulary; formats wide (16:9) and tall (9:16); avatar stage needs a presenter from the presenter library (`presenter_config` doc). Editor copy: "Open it in the **Video Studio**: **Link Strategy → Social Amplification → YouTube**." Publish stage records `{url, publishedAt, indexedGoogle, citedAI}`.

---

## Push to Link Strategy — the exact M7 handoff

Anchor articles must be `approved` (Workflow panel shows the purple button only for `approved`/`pushed-to-link-strategy`). Handler `ag`:

```js
store.updateArticle(articleId, { status:"pushed-to-link-strategy", pushedToLinkStrategyAt: new Date().toISOString() });
const m7 = pipeline?.m7v3 || {};
updateModule("m7v3", {
  ...m7,
  assignments: {
    ...(m7.assignments || {}),
    [articleId]: {
      ...(m7.assignments?.[articleId] || {}),
      articleId,
      status: "parked",
      candidates: [],
      warning: null,
      updatedAt: new Date().toISOString()
    }
  },
  generationId: Date.now()
});
// toast: "Pushed to Link Strategy."
```

So the handoff object is **`pipeline.m7v3.assignments[articleId] = { articleId, status:"parked", candidates:[], warning:null, updatedAt }`** — M7 discovers the article itself by reading `pipeline.m6v3.articles` (fallback `m6v2`) filtered to `status ∈ {pushed-to-link-strategy, published}`. Re-push is allowed ("In Link Strategy — re-push"). Medium/PR children and social posts use their own pushes (status flag / `pushedToM7`), not `m7v3.assignments`.

**M7 side** (`index-Dz3blxfN.js`): enriches the assignment with `month`, `approachedDomains[]`, `publishedDomain`, `publishedUrl`, `urlStatus`, `status:"published"`, and on publish calls `Xt(pipeline, updateModule, articleId, {domain,url,publishedAt})` which writes back into **both** `m6v3` and `m6v2`: `articles[id] = {...art, status:"published", publishStatus:{state:"published", url, publishedAt, domain}, updatedAt}`. M7 can also flip an article's `contentFormat` and deep-links back with "Plan win-back" (`sessionStorage.xt_m6v3_jump_to_view`).

---

## For AI assistants

- The status enum is the `wn` object; **always** treat `ready-for-client` and `in-review` as one visual state ("Client reviewing") — list code folds them (`ae` reducer maps `ready-for-client`→`in-review`).
- `approved` implies `locked:true`; never mutate the body of a locked article — call `unlockArticle` first (this is enforced in the UI, not the store).
- `client-feedback` exists in the enum/buckets but has no setter in this bundle; don't rely on it being reachable.
- The M7 handoff is intentionally minimal (parked assignment shell). Everything M7 shows about the article (title, format, qid, body) is read live from `m6v3.articles`; only placement tracking lives in `m7v3.assignments`.
- `published` is written by M7's write-back, not by Content Strategy — except children, where the editor can show "Published ✓".
- Spinoff children are ordinary articles distinguished only by `parentArticleId` + `contentFormat`; top-level lists filter them out with `.filter(a => !a.parentArticleId)`.
- Version snapshots are the safety net for every destructive action (rewrite accept, upload, auto-fix, pillar fix, restore, approve). If you add a new mutation path, snapshot first with `addArticleVersion` using a descriptive `source`.
- Client-mode gates hang off `isClientMode` (= `session.role === "client_portal"`); any new team-only control must check it.
