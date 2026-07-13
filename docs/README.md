# Xtrusio Platform Documentation

Token-efficient documentation of the Xtrusio AI-perception platform (the built app in `sirion/`). Written so that AI assistants and new team members can work on the platform **without re-reading the minified bundle**.

**Start here:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the full system map, the content → placement → citation loop, deployment, roles, and the module doc index.

**How to use in a new AI chat:** tell the assistant to read `docs/ARCHITECTURE.md` first, then only the specific `docs/modules/*.md` files relevant to the task. The prompts library (`docs/prompts/content-strategy-prompts.md`) contains every LLM prompt verbatim with its code location and template variables.

Generated July 2026 by deep word-by-word analysis of the production bundle (`sirion/assets/*.js`). If the app is redeployed with behavioral changes, the affected module doc should be updated in the same commit.
