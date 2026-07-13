# Grounding Upgrade — Premium Articles with Latest Data

**Status: applied locally, NOT pushed.** Review before deploying (this repo is the live GitHub Pages site).

## Why articles were coming out generic

The live Content Strategy (m6v3) writes articles in-app through a provider chain. The default/"GPT-5.2" selection mapped to **`gpt-4o` — a model with no web search** — while the writing prompt says "ACTIVELY USE WEB SEARCH… Do not rely on prior training only." A model without search silently ignores that instruction and writes from stale training memory: recycled, consensus, generic content. The search-capable writers (Gemini 2.5 Flash + Google Search, Claude + web search) only ran as fallbacks.

## Change 1 — Code patch (applied in this commit)

`sirion/assets/index-BdFOWPPW.js`: the OpenAI default model constant `Xs` changed
`"gpt-4o"` → `"gpt-5-search-api"` (the same search-enabled model the scan engine uses for ChatGPT scans).

- Scope: every m6v3 OpenAI writing call that resolves via `Io()` (i.e. "GPT-5.2"/"gpt-5"/"openai"/"chatgpt" selections and the no-selection default). An explicit "gpt-4o" selection still maps to gpt-4o.
- Safety: if the worker/OpenAI ever rejects the model or a parameter, the existing try/catch chain falls back to **Gemini 2.5 Flash with google_search** — still a grounded writer. No failure mode produces an ungrounded article.
- Not patched (cosmetic, needs source rebuild): the model picker still *labels* the option "GPT-5.2 · best for long-form prose".
- `sirion/perception/` is the legacy duplicate build without m6v3 — intentionally untouched.

**Operational note until deployed:** pick **Gemini 2.5 Flash** in the campaign model picker — it is already search-grounded today with zero changes.

## Change 2 — Grounding rules pack (NO code: paste into the app)

House Style Rules are data (scope: client/campaign/track, status active) and are appended to every writing/rewrite prompt under "HOUSE STYLE RULES (must follow — these are non-negotiable)". Add each line below as a rule with **scope: client** so it applies to every article:

1. `FRESHNESS MANDATE: Before writing, run web searches on the article's core topic and gather at least 5 facts published within the last 12 months. Every statistic must state its source BY NAME and its year in prose (e.g., "Gartner's 2026 CLM Magic Quadrant notes…"). Never present an undated statistic.`
2. `NO STALE DATA: Do not use any statistic you cannot trace to a current, verifiable source found via web search in this session. If you remember a stat from training but cannot re-verify it now, leave it out. An article with fewer, verified numbers beats one padded with unverifiable numbers.`
3. `ANTI-RECYCLING TEST: After drafting, compare your key points against what the top-ranking pages on this topic already say. If a section could appear unchanged on a competitor's blog or a generic listicle, rewrite it with a sharper angle, newer evidence, or a contrarian-but-defensible position. The article must add something to the ecosystem that AI engines cannot already get from 40 other pages.`
4. `ORIGINAL FRAMEWORK REQUIRED: Every article must contribute one named, original analytical framework, model, checklist, or decision lens (with a memorable name) that does not exist elsewhere. This is the article's citable asset.`
5. `AI-EXTRACTABLE STRUCTURE: Include at least one crisp, self-contained definition (2-3 sentences an AI engine could quote verbatim), and phrase H2/H3 headings as the questions buyers actually ask, followed immediately by a direct answer in the first sentence.`
6. `SELF-VERIFICATION GATE: Before returning the article, verify: (a) every stat has a named source and year; (b) at least 5 facts are from the last 12 months; (c) the named original framework is present; (d) no section fails the anti-recycling test; (e) 2-3 Sirion whitelist backlinks are embedded inline. If any check fails, fix it before returning — do not return a draft that fails the gate.`

These rules respect the existing publisher policy (no external links in the body; analysts referenced by name only) and the strict Sirion URL whitelist.

## Change 3 — Optional Research Booster (zero-code, uses the existing feedback loop)

The rewrite task already accepts free-text "client feedback". That makes optional deep research a paste-in, not a build. When an approved-in-principle article feels thin:

1. Paste the article topic into any web-enabled model (ChatGPT with browsing, Gemini, Perplexity) with this prompt:

```
You are a research assistant for a senior B2B editorial team. Topic: <TITLE + THESIS>.
Using live web search only, return a RESEARCH PACK:
- 8-12 facts/statistics published in the last 12 months, each as: FACT — SOURCE NAME — PUBLICATION/REPORT TITLE — DATE (no URLs needed).
- 3 recent developments (regulation, funding, product moves, analyst notes) that change how this topic should be framed in 2026.
- 2 contrarian or under-reported angles the mainstream coverage misses.
- 1 concrete, current real-world example or case with named parties.
Exclude anything you cannot verify with a live search result from the past 12 months. Do not include generic evergreen claims.
```

2. Paste the returned pack into the article's feedback box prefixed with: `RESEARCH PACK — weave these verified facts into the article where relevant, citing each source by name and year in prose; do not add external links.` Then click **Apply AI revision**.

The article is never *dependent* on this step — it is a booster, exactly as specified.

## Next build (designed, not yet implemented): learning loop

Raw material already stored: version snapshots per article, `client-edited` status, feedback emails (`importComments`). Missing piece: an "extract lessons" pass that diffs AI draft vs client-edited final, proposes rules in the same format as Change 2, and (after human approve/reject) saves them as house style rules — which the prompt builder already injects automatically. No fine-tuning, no new prompt plumbing: the rules system IS the memory.
