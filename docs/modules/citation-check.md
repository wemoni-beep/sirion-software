# Published Articles — Citation Check

## Purpose

The citation check is Xtrusio's "proof, not promises" loop: for every URL the client publishes through Link Strategy (guest posts, PR releases, LinkedIn/Medium posts, YouTube videos), the system generates buyer-style verification questions, runs them through the four AI engines in **Scan Your Queries**, and then classifies whether each engine actually **cited the published URL** — headline statuses **bullseye**, **adjacent**, **brand**, **pending**, **missed**, **unscanned**. Everything lives in chunk `sirion/assets/index-Dz3blxfN.js` (constants, prompt, hook, UI) plus the scan machinery in `index-UYiwywP9.js` / `baselineScanner-B4UVyWOc.js`.

## The full loop, step by step

### 1. Register the published URL

A published item enters tracking whenever a live URL is confirmed anywhere in Link Strategy:

- Guest/PR pipeline: **Mark as Published** modal ("Published URL: https://domain.com/article-slug") or tracker TSV/CSV import → `m7v3.assignments[id].publishedUrl` + `m7v3.publishedRecords[id]`.
- Social Amplification: LinkedIn posts `markPosted({url, by})` (collection `m8_social`); Medium articles published to `medium.com` via the same m7v3 assignment path; Video Studio "Publish" stage stores the YouTube `url`.

The pipeline/services then build the tracked list handed to the hook `usePublishedCitations(items)` — each item is `{id, title, url, publishedAt, originalQid, addressedQids | originalQuestionText, kind?: "post"}`. `originalQid` is the article's primary tracked question (first of `addressedQids`, derived from the article's source topic / content gaps).

### 2. Generate verification queries (`buildOne` — button "Build citation queries")

Per item, up to **3** queries (`Wi = 3`) are generated with `gemini-2.5-flash` (`forceJson`, fallback Claude). System prompt (verbatim):

> "You are a query generator for AI citation verification.
> Given an article title (and optional URL for context only), generate up to {{N}} natural, user-style questions that test whether the article is cited by AI search engines.
>
> Each query must follow this formula: Question Word + Core Problem + Core Topic + Business Impact.
>
> Rules:
> 1. Convert the title into natural questions a real buyer would actually ask or type.
> 2. Preserve the core topic, the core problem, and the business impact.
> 3. Do NOT include the publisher name.
> 4. Do NOT include the article URL.
> 5. Do NOT include any brand name, unless the article is specifically about that brand.
> 6. Vary the angle across the set so each query tests a different framing:
>    (1) the closest paraphrase of the core question,
>    (2) a problem-led angle,
>    (3) a business-impact-led angle.
> 7. Return STRICT JSON only, no markdown, no prose: { "queries": ["...", "..."] }"

Validation: each query must be ≥ 25 chars and end with `?`; at least 2 valid queries required or the build errors ("query generation returned truncated output — try again"). Query ids are **`${articleId}__v1` … `__v3`**, tagged `source:"published-verify"`, `cluster:<articleId>`.

For **social posts** (`kind:"post"`) the flow differs (`Ma`/`Oa`): the post's own question text becomes a single query `${postId}__1` with `role:"generated"` — unless it equals the article's original question, in which case nothing is added ("Nothing to add — this post's question matches the original question, which is tracked automatically."). Micro-question ids matching `/^mq\d+$/` are rejected as real queries.

### 3. Save into the scan segment

Queries are upserted into the Firestore collection **`user_segments`**, one shared doc **named `"Published Articles — Citation Check"`** (`creator: "citation-loop"`); re-building an item first removes all existing queries whose id starts with `${itemId}__`. Success message tells the operator exactly what to do next:

> "Added N queries for "<title>" (M total in the segment). **Open Scan Your Queries → run "Published Articles — Citation Check" → come back and Refresh.**"

### 4. Scan (Scan Your Queries, module `scanq`)

The operator runs that segment like any other scan. The scan engine (`baselineScanner`) writes per-question docs into **`m2_scan_results`** (`{qid, query, persona, stage, scanId, analyses}` where `analyses[engine] = {cited_sources | citedSources | sources, mentioned, full_response, _error?}`) plus **`m2_scan_meta`** (scanId → completed_at) and related collections (`m2_scan_attempts`, `m2_scan_runs`, `m2_sections`, `m2_content_gaps`). The Scans list explicitly notes it includes "the "Published Articles — Citation Check" scans".

### 5. Load & match (hook refresh)

On load/Refresh the hook queries `m2_scan_results` by qid for (a) all generated ids `${id}__v1..3` and (b) each item's `originalQid`. For each qid only the **latest** result is kept (scan recency ordered by `m2_scan_meta.completed_at`). Rows are tagged `role:"generated"`; the original question's row is prepended with `role:"original"`. `scanCount` = distinct scanIds seen (+1 if an original row exists).

**URL matching** (`rn` + `citationUrl` helper): each engine's `cited_sources` entries are parsed to `{url, domain}`; grounding/redirect hosts are excluded (`/vertexaisearch|grounding-api-redirect|googleusercontent|\/url\?q=|bing\.com\/ck\//i`). If a cited source's domain equals the published URL's domain:
- confidence **`"url"`** when the normalized URLs match (normalization strips `www.`, trailing slashes, utm_/fbclid/gclid-style tracking params, and language path segments; hosts must be equal and one path may contain the other), or the cited path contains the target path;
- otherwise confidence **`"domain"`** (right site, different/unknown page).

**Brand citation** (`nn`): any cited source on `sirion.ai` / `sirion.com` (or subdomains) counts as "Sirion cited".

### 6. Status assignment (`Ia` — the code that assigns bullseye/adjacent)

Per engine (`openai` "ChatGPT", `gemini`, `claude`, `perplexity`), walking all result rows:

| Condition (first match wins) | Engine state |
|---|---|
| Published URL cited on the row with `role:"original"` (the article's own tracked question) | **`bullseye`** |
| Published URL cited on any *generated* verification query (and not on the original) | **`adjacent`** |
| No URL citation, but a sirion.ai/sirion.com source cited somewhere | **`brand`** |
| Engine ran, no citation, article younger than **90 days** (`Aa=90`) | **`pending`** |
| Engine ran, no citation, ≥ **2** scans (`Ca=2`) and older than 90 days | **`missed`** |
| Engine ran, no citation, < 2 scans | **`pending`** |
| Engine never returned a usable analysis | **`unscanned`** |

Headline status = the **best** per-engine state by rank `{bullseye:5, adjacent:4, brand:3, pending:2, missed:1, unscanned:0}`. Numeric score: bullseye = **1**, adjacent = **0.4** (`wa`), brand = **0.2** (`Sa`), else 0. The result object is `{headlineStatus, score, exactTargetCited, brandCited, ageDays, perEngine:{engine:{state, confidence, matchedQuery}}, matched:{query, engine, confidence, state}}`.

**Plain-English meaning:** *bullseye* = "an AI engine answered the exact question this article was written for and cited your URL as a source" (UI label **"URL cited — exact target"**, engine logo gets a green ring, tooltip "Cited for the ORIGINAL question on <engine>"). *adjacent* = "your URL got cited, but for one of the paraphrased verification questions rather than the exact target question" (label **"URL cited as source"**). Labels for the rest: brand "Sirion cited", pending "Too early", missed "Not cited yet", unscanned "Not scanned".

### 7. Display & roll-ups

- Status pill + 4 engine logos per row; expandable drawer "How this article performs in AI search" with sections **Original question** ("Target question — direct citation or Sirion boost"), generated queries ("· generated from this article", "New questions — proof your URL is indexed in AI"), per-engine chips "Your URL / Sirion on this question · cited/not cited" with response excerpts, and a **Re-scan in SYQ** button (writes sessionStorage **`xt_syq_preselect`** = `{qids:[qid], reportHint:"current-month"}` then navigates to `scanq`).
- Pipeline header funnel: Total → Published → Indexed → **URL cited** (count of items whose headline is bullseye *or* adjacent — set `Ya = {"bullseye","adjacent"}`), plus per-engine counts.
- **Monthly impact** (collection **`m2_impact_summary`**, docs `month_<key>`, version 1): per month a summary `{totalTracked, perQid:{qid:{citedCount, mentionedCount, engineTotal}}, qidQueries, cx}` where `cx` rows are `[qid, engine, url, domain, excerpt]` (chunked ≤150 KB). Used for "Sirion cited on N questions" banners, with/without-published-article comparisons, and up/down/flat trends; questions Sirion loses get a **"Plan win-back"** link into Content Strategy.

## Data model quick reference

| Thing | Location | Shape |
|---|---|---|
| Tracked item | built in-memory per view | `{id, title, url, publishedAt, originalQid, addressedQids?, originalQuestionText?, kind?}` |
| Verification query | `user_segments` doc "Published Articles — Citation Check" | `{id/qid: "<itemId>__v<n>" or "<postId>__1", query, persona:null, stage:null, source:"published-verify", cluster:<itemId>, role?}` |
| Scan answer | `m2_scan_results` | `{qid, query, scanId, analyses:{openai|gemini|claude|perplexity:{cited_sources[], mentioned, full_response, _error?}}}` |
| Computed status | in-memory only (never persisted) | see step 6 |
| Monthly impact cache | `m2_impact_summary/month_<key>` | `{monthKey, label, memberIds, totalTracked, perQid, qidQueries, cx-chunks}` |

Constants: brand domains `["sirion.ai","sirion.com"]`; engines `Qe = openai/gemini/claude/perplexity`; `Aa=90` (pending window days), `Ca=2` (scans before "missed"), `Wi=3` (queries per article), source tag `"published-verify"`, segment name `"Published Articles — Citation Check"`.

## Integrations

- **In:** published URLs from the Guest/PR pipeline (`m7v3` assignments/publishedRecords), Social Amplification posts (`m8_social`), Medium placements, Video Studio publish stage; original tracked questions from Content Strategy topics / M2 content gaps.
- **Out:** queries into the Scan Your Queries segment (`user_segments`); reads scan output (`m2_scan_results`/`m2_scan_meta`); writes monthly caches (`m2_impact_summary`); "Re-scan in SYQ" and "Plan win-back" navigation handoffs.

## For AI assistants

- The classifier is pure function `Ia(item, resultRows, {scanCount})` in `index-Dz3blxfN.js` (search "BULLSEYE"). `bullseye` strictly requires the citation on the row whose `role === "original"`; every generated-query citation is `adjacent` regardless of confidence.
- The loop is **manual-in-the-middle**: building queries and running the scan are two separate human actions; statuses recompute client-side on every Refresh — nothing about bullseye/adjacent is stored in Firestore.
- Query ids are the join key: `${itemId}__` prefix links segment questions and scan results back to the published item; deleting/rebuilding replaces the prefix group.
- `confidence` values are only `"url"` or `"domain"`; treat `"domain"` as weak evidence (same site, unverified page).
- If you need to add a new published-item source, produce the item shape from step 1 and reuse `usePublishedCitations` — don't reimplement matching.
