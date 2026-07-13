# Authority Ring (nav id `m3`)

**Bundle:** `sirion/assets/AuthorityRingNew-rh16Xj1F.js` (~212 KB).
**Route:** `/authority` (legacy alias `/authority-new` → `m3`) · Nav label: "Authority Ring" · badge `3`.
**Tabs:** `Action by Cluster`, `Fixing Panel`, `Cumulative`, and (feature-flagged) `Compare Reports`.

## Purpose

m3 turns raw AI-scan citations into an **outreach/authority work queue**. It walks every URL that ChatGPT/Gemini/Claude cited in Perception Monitor scans (plus Market Pulse news/market-data archives and manual seeds), aggregates them into a **domain database**, classifies each domain into a publication-target taxonomy (rule table → static 1,500-domain map → Gemini AI classification), scores each domain's **impact**, **effort**, and **priority tier**, detects **narrative gaps** vs competitors, and prescribes concrete fixes ("recipes") for shifting Sirion's AI narrative away from "post-signature-only" toward "full-stack / pre-signature". A Fixing Panel tracks tasks and a Compare Reports view measures whether the needles actually moved between two scans.

## Client config (hard-coded `Vo` → `z`)

```
{ key:"sirion", company:"Sirion", product:"Sirion CLM", url:"https://sirion.ai", domain:"sirion.ai",
  industry:"Contract Lifecycle Management", industryShort:"CLM", productCategory:"CLM software",
  buyerContext:"buyer questions about contract lifecycle management software",
  competitors:["Icertis","Conga","DocuSign CLM","Ironclad","Agiloft","ContractPodAi"],
  aliases:["Sirion","SirionLabs","Sirion CLM"],
  lifecycleStages:[pre-signature ✍ #3b82f6, post-signature ✅ #10b981, full-stack #a78bfa] }
```

## How it works

1. **Build (streaming) — `qn` / `refreshDomainDatabaseStreaming`.** Sources walked into a per-URL database (`nt()` record shape):
   - `m2_scan` — every cited source in `m2_scan_results` (IndexedDB/cloud, paginated) and `pipeline.m2.scanResults.results`. URL normalization `ot()` strips `www.`, utm/click params (`utm_*`, `mc_*`, `fbclid`, `gclid`, …), and drops AI-redirector hosts (`vertexaisearch.cloud.google.com`, `perplexity.ai/search`, `chat.openai.com`, `claude.ai`, `t.co`, `bit.ly`, …). Each citation event records `scanId`, `scanType` (baseline/syq/m2_manual), `narrativeStage` (via `narrativeClassifier` — `full_stack|pre_signature|post_signature|unclassified`), `qid`, `ai` (chatgpt|gemini|claude), `scannedAt`, `queryText`, snippet. Question metadata (persona/stage) is joined from `pipeline.m1.questions` (`sn()`).
   - `market_pulse_news` — `intel_v2_news_archive` (Company Intel).
   - `market_pulse_marketdata` — `intel_v2_marketdata_archive`.
   - `manual_seed` — optional `DOMAIN_CATALOG` hydration (`pn()`, fields `da`, `aiCitationWeight`, `difficulty`, `approach`, `zeliotStatus/zeliotPresence` → `clientStatus` verified_zero/present/strong).
   Incremental rebuilds use per-scan signature caching (IndexedDB partial cache) with progress callbacks.
2. **Aggregate to domains — `Et()`.** URLs group by hostname; counters merge (`citedByAis` per engine, `narrativeBreakdown` per lifecycle stage, `competitorsCited`/`competitorPresent` from co-cited vendors and news subjects, `personasInfluenced`, `stagesInfluenced`, max `da`, max `aiWeight`, worst `difficulty`, strongest `clientStatus`).
3. **Categorize — `Ye()`/`Fn()`.** Precedence: manual override → client/competitor match → curated seed lists `Bn` (news_media: hbr.org, techcrunch.com, forbes.com, ft.com, wsj.com, bloomberg.com, reuters.com…; industry_publication: infoq.com, thenewstack.io, techtarget.com, zdnet.com…) → static map `Ne` (~1,511 domain→category entries baked into the bundle) → TLD rules (`.edu`→academic, `.gov`→government) → `unknown`. Unknowns can be AI-classified per-domain or in bulk.
4. **Score and tier** (see formulas below), compute **gap type**, attach default **crack tip** per category.
5. **Act.** Action by Cluster filters by lens (`we`: All / Lifecycle Stage; Buying Stage, Persona, Topic Cluster, Custom Segment are stubbed `phaseBPlus`), shows two work streams — "🔧 Rewrite Existing Citations" (reduce post-sig framing) and "📡 Publish New Authority" (add full-stack signal) — each row expandable to a **recipe** and "Add to Fixing Panel". Cumulative shows the full domain table (IMPACT / EFFORT / TIER / CATEGORY) with tier chips, gap filter, AI classify buttons, and a category-mix bar vs the **target narrative mix**. Compare Reports diffs two published scans/baselines: gained/lost/dropped domains, narrative shift, **headline needles**, per-fix verdicts, CSV export.
6. **Persist.** `updateModule("m3", {...})` into the pipeline; a cloud snapshot is uploaded as **`m3/authority_domains.json`** (`{domainDatabase, builtAt, stats, updatedAt}`) with retrying download/hydrate on load.

## Category taxonomy (`at`, 12 categories)

| id | label | pitchable | defaultEffort | defaultCrackTip |
|---|---|---|---|---|
| `news_media` | News Media | yes | hard | "Editor pitch with data-led angle. Need a fresh hook (announcement, named customer, %-figure). 8-16 weeks." |
| `industry_publication` | Industry Publication | yes | medium | "Guest article. Pitch tech writer with 1500-word abstract. 2-4 weeks." |
| `engineering_community` | Engineering Community | yes | easy | "DIY — self-publish. HN: ship a technical post with real architecture. Dev.to: tutorial format. Free." |
| `analyst` | Analyst | yes | hard | "Analyst briefing (paid retainer for full coverage). 8-16 weeks. Brief Gartner/Forrester on the category." |
| `review_platform` | Review Platform | yes | easy | "DIY — drive existing customers to leave reviews. Reach out to top 5 happy customers. 2-4 weeks." |
| `partner_vendor` | Partner / Vendor | yes | medium | "Co-content with partner marketing. Needs partner agreement + joint customer story. 4-8 weeks." |
| `academic` | Academic | yes | hard | "Co-research with professor. Data sharing agreement. 3-6 months." |
| `government` | Government | yes | hard | "Policy briefing. Very slow. Only worth it for regulatory-driven sectors." |
| `wikipedia` | Wikipedia | yes | medium | "Edit with citations from existing news_media coverage. No promotion. 1-2 weeks." |
| `competitor_vendor` | Competitor | **no** | – | "Cannot pitch — competitor site. Track for content gaps only." |
| `client_own` | Own Asset | **no** | – | "Own asset — update your own content here." |
| `unknown` | Unknown | **no** | – | "Classify first via AI button or manual dropdown." |

### Channel buckets (`Ve`/`et`/`ci`) — the "ring" grouping

`own` (client_own — "In your control — fix immediately."), `reviews_ugc` (review_platform, engineering_community, wikipedia — "Partial control — drive reviews or seed similar content."), `earned` (news_media, industry_publication, analyst, partner_vendor, academic, government — "Pitchable — Xtrusio's outreach scope."), `competitor` (competitor_vendor — "Can't edit — watch influence, counter on a third venue."), `triage` (unknown).

## Scoring & weights (exact)

### Impact score `Wn` (0–100, equal quarters)

```
events25  = min(100, totalEventCount * 5)
comp25    = min(100, Σ competitorsCited * 10)
da25      = clamp(da, 0, 100)
aiw25     = clamp(aiWeight, 0, 100)
impactScore = round(events25*.25 + comp25*.25 + da25*.25 + aiw25*.25)
```

### Legacy/gap score `On` (0–100)

`min(100, round(totalEventCount*5 + Σcompetitors*10 + (clientStatus=="zero" ? 30 : 0) + (da??0)*.5 + (aiWeight??0)*.3))`

### Effort adjustment `Ln`

Category default effort, except: `engineering_community` with DA>80 → medium; `industry_publication` with DA>90 → hard.

### Priority tier `Nn`

```
not pitchable            → "not_pitchable"
effort easy              → "quick_win"
(hard && impact>=70) or (medium && impact>=70) → "strategic"
medium && impact>=40     → "long_tail"
else                     → "pass_for_now"
```

### Gap types `Pn`

- `critical` — client zero presence + competitor(s) cited ("`${company}` has zero presence; competitor X cited here.")
- `wrong_narrative` — client present + competitors also cited ("defend the narrative")
- `strong_partnership` — client strong, no competitors ("own it")
- `uncontested` — zero on both sides ("Greenfield")
- `neutral` — otherwise

### Target narrative mix `ue` (Cumulative view)

`full_stack: 65%`, `pre_signature: 20%`, `post_signature: 12%`, `unclassified: 3%`.

### Compare-report "needles" `Wr` / delta targets `Lr`

Needles: `post_signature` goal **reduce**, `full_stack` goal **increase**, `pre_signature` goal **increase**. Task delta targets: `post_sig_reduce`, `full_stack_amplify`, `pre_sig_amplify`. Verdicts: `on_target` / `backsliding` / `flat` (headline), `working` / `backsliding` / `no_change` / `not_measurable` (per fix). CSV export columns: Section, Item, Stage, Intended, Before, After, Delta, Verdict, Status.

### Note on the per-LLM DA/PA weights table

The weights table `claude:{DA:.18,PA:.12,Topical:.22,Freshness:.15,Structure:.15,Traffic:.08,Observed:.1}` is **not** in this bundle — it lives in **Content Strategy** (`sirion/assets/ContentStrategy-DPvoh8Wv.js`, blog-scoring constants next to `Se="blog_db"`):

```
Le  = {DA:.22, PA:.15, Topical:.18, Freshness:.14, Structure:.12, Traffic:.09, Observed:.1}   // default
Ee  = { all: Le,
        openai:{DA:.2,  PA:.13, Topical:.22, Freshness:.18, Structure:.1,  Traffic:.07, Observed:.1},
        gemini:{DA:.25, PA:.18, Topical:.15, Freshness:.1,  Structure:.1,  Traffic:.12, Observed:.1},
        claude:{DA:.18, PA:.12, Topical:.22, Freshness:.15, Structure:.15, Traffic:.08, Observed:.1} }
```

Those weight publication/blog records (`da_moz`, `pa_moz`, `dr_ahrefs`, `ur_ahrefs`, `as_semrush`, `domain_age_years`, `topical_authority_clm`, keywords, ranking_keywords_count, …) per LLM for citation-likelihood scoring. Authority Ring's own domain records carry simpler `da` (Moz-style 0–100) and `aiWeight` (0–100 "aiCitationWeight") consumed at 25% each in `Wn`.

## Per-category action recipes (`de` + recipe library `bi`)

Per-category quick actions: client_own "Edit page", competitor_vendor "Plan counter-piece", news_media "Pitch author", industry_publication "Pitch tech editor", engineering_community "Engage in thread", analyst "Analyst briefing", review_platform "Drive customer reviews", partner_vendor "Co-content with partner", wikipedia "Cite-and-edit", academic "Co-research outreach", government "Policy briefing", unknown "Triage".

Full recipes are selected by `(channel bucket, direction)` where direction is `reduce` (post-sig) or `increase` (full-stack/pre-sig):

- own+reduce `li` "Reframe page" — steps: open page / replace post-signature framing in cited text / republish and request re-index. "AI quotes this page verbatim as authoritative; the wording here directly sets Sirion's narrative." Expected: "Post-Sig share of brand citations falls on the next scan; Full-Stack rises."
- own+increase `di` "Strengthen page" — add explicit full-stack/pre-sig framing + proof points.
- reviews_ugc+increase `mi` "Drive reviews" (5–10 happy full-stack customers) / reviews_ugc+reduce `ui` "Refresh reviews" (dilute stale post-sig reviews).
- earned+increase `Fe` "Pitch venue", specialized per category: news_media `pi` "Pitch author", industry_publication `gi` "Place guest article" (1,500-word abstract), analyst `fi` "Analyst briefing", partner_vendor `hi` "Co-content with partner". earned+reduce `vi` "Pitch a correction".
- competitor `yi` "Plan counter-piece" — "You can't edit a competitor's page… publish a Sirion-authored full-stack piece on a neutral/earned venue."

## Fixing Panel task model

`{ taskId, createdAt, updatedAt, status:"open"→(fixed|rejected|cannot_touch closes with closed_at/closed_by/outcome/proof_url), domain, delta_target (post_sig_reduce|full_stack_amplify|pre_sig_amplify|unclassified_triage), channel_bucket (own|reviews_ugc|earned|competitor|triage), category, recommended_action, action_detail, recipe {move, steps[], contentToChange, rationale, expectedOutcome}, urls[≤12], notes[], resolvedAtGenerationId }` — stored in `pipeline.m3.fixingTasks` (hook `xt()`); resolution is checked against `pipeline.m2.generationId` so a "fixed" task reopens if a newer scan generation contradicts it.

## AI domain classification (Gemini)

`oi()` calls `callGemini` with `model:"gemini-2.5-flash"`, `tools:[{google_search:{}}]`, 40 s timeout, 2 retries on transient errors (`timeout|rate limit|429|503|network|fetch failed|ECONN`).

System prompt `Zr` (verbatim):

> You are a B2B marketing analyst evaluating publication targets for a company called `${company}` (`${product}`), a `${industry}` vendor.
>
> You categorize unknown websites into a fixed taxonomy so the outreach team knows whether to pitch the site, how hard it'll be, and what the first concrete move is. You ONLY respond with valid JSON matching the schema — no markdown, no prose, no leading or trailing text.

User prompt `ei` (abridged; schema verbatim):

> TASK: Given the domain "`${domain}`", identify what this website is and how useful it is as a publication target for our outreach team.
> Visit the website. Read the homepage and 1-2 representative pages… Use Google Search if the site is unreachable…
> Schema — emit the fields IN THIS ORDER (category and confidence first so they are never lost if the reply is cut short):
> `category` one of: "news_media" (mainstream business + tech news: HBR, Forbes, TechCrunch, FT, Bloomberg), "industry_publication" (B2B vertical pubs: InfoQ, TelematicsWire, IoTWorldToday), "engineering_community" (DIY publish: Medium, Dev.to, HN, Reddit, Stack), "analyst" (Gartner, Forrester, IDC, GigaOm), "review_platform" (G2, Capterra, TrustRadius, PeerSpot), "partner_vendor" (SAP, AWS, Microsoft, KPMG — non-competitor enterprise vendors), "wikipedia", "academic", "government", "competitor_vendor" (direct competitor to `${company}` — list of competitors: `${competitors}`), "client_own" (`${company}`'s own properties — `${domain}`), "unknown"
> `confidence` 0.0..1.0 · `effortLevel` "easy" | "medium" | "hard" (easy = DIY publishing surface … medium = editor pitch + accept cycle, 2-8 weeks … hard = editorial gatekeepers / paid retainers / long lead time) · `crackTip` one SHORT line · `reasoning` one SHORT line
> … Set confidence < 0.5 if the domain is genuinely ambiguous; the UI will flag low-confidence results for human review.

Results are validated (`ti`), stamped `categorySource:"ai"` with `aiClassification {category, effortLevel, crackTip, confidence, reasoning, evidence[≤3 urls], provider, classifiedAt}`; manual dropdown overrides set `categorySource:"manual"`. A separate Gemini prompt in Link Strategy (`index-ByIqH5Ss.js`) does deeper publication vetting (niche, audienceFit, aiCitationStrength HIGH/MED/LOW, estTimeToIndex).

## Data model (domain record `In`)

`{ domain, category, categoryOverride, effectiveCategory, categorySource ("rule"|"ai"|"manual"), pitchable, impactScore, effortLevel, priorityTier, crackTip, classifiedAt, urls[], urlCount, urlsByOrigin{m2_scan,market_pulse_news,market_pulse_marketdata,manual_seed:{urlCount,eventCount}}, totalEventCount, narrativeBreakdown{full_stack,pre_signature,post_signature,unclassified}, scanBreakdown{scanId:count}, citedByAis{chatgpt,gemini,claude}, competitorsCited{name:count}, competitorPresent{name:bool}, clientStatus ("unknown"|"zero"|"present"|"strong"), clientPresenceUrls[], da, aiWeight, difficulty, approach, gapType, gapReason, personasInfluenced[], stagesInfluenced[], score, outreachStatus ("untouched"|"queued"|"pitched"|"placed"|"dismissed"), outreachAssignedTo, outreachTargetDate, outreachNotes, firstSeen, lastSeen, aiClassification? }`

## Storage keys

| Where | Key | Contents |
|---|---|---|
| pipeline (`m3`) | `urlDatabase`, `domainDatabase`, `urlDatabaseBuiltAt`, `urlDatabaseStats`, `fixingTasks` | working state |
| Cloud file | `m3/authority_domains.json` | `{domainDatabase, builtAt, stats, updatedAt}` snapshot (uploadJson/downloadJson, 3 retries) |
| IndexedDB (module-local) | per-scan partial-build cache (store `pe`, keyed by `scanId` with signature) | incremental rebuild |
| Read-only inputs | `m2_scan_meta`, `m2_scan_results`, `intel_v2_news_archive`, `intel_v2_marketdata_archive`, `pipeline.m1.questions`, `pipeline.m2.generationId` | sources |

## Integrations

- **In:** Perception Monitor scans (citations + narrative classification), Company Intel Market Pulse archives, Question Generator question metadata (persona/stage per qid), scan catalog (`scanCatalog-BNhunwfC.js` — the "April scan" group `__group_april_scan` over the baseline scan ids in `constants-BELxrI9x.js`, plus published SYQ groups) for the Compare Reports picker.
- **Out:** Fixing tasks in `m3.fixingTasks` (read by Compare Reports to verify fixes); "Push to Link Strategy" button is currently a stub — dialog says "Push to Link Strategy is coming next. URLs from `${domain}` will land in Link Strategy → Tentative Publishers with full provenance." Client role sees m3 (it is in the client module allowlist `Zw=["intel3","reports","exec","m6v3","links","m3"]`).

## For AI assistants

- The "ring" is the channel-bucket grouping (own → reviews/UGC → earned → competitor → triage), not a literal ring chart of DA tiers.
- Impact/effort/tier formulas and the 65/20/12/3 target mix are hard-coded (`Wn`, `Ln`, `Nn`, `ue`); the per-LLM DA/PA/Topical/Freshness/Structure/Traffic/Observed weights the user may ask about are in **ContentStrategy-DPvoh8Wv.js**, not here.
- Category ids are shared contracts: the static `Ne` map (~1.5k domains), seed lists `Bn`, colors `Ue`, recipes `de`/`bi`, and the Gemini prompt all use the same 12 ids. Changing them requires touching all five plus stored `domainDatabase` snapshots.
- Everything is client-side: rebuilds walk IndexedDB/cloud scan results in the browser with concurrency 6 and stream progress into the pipeline; there is no server-side aggregation.
- URL canonicalization (`ot`) silently drops AI-redirector/shortener hosts and tracking params — if a citation seems missing, check that list first (`Xo`, `Ko`, `To` sets near the config object).
