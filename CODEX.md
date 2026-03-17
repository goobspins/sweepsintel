# SweepsIntel -- Codex Build Instructions

**Read this file first.** It tells you what to read and how we work.

---

## What to read

**Every task**: Start with `docs/active/SWEEPSINTEL-3.0-SPEC-RECONCILED.md`. This is the authoritative reference -- it maps every feature to file paths, implementation status, and actual behavior. Find the section relevant to your task and work from there.

**For schema/database work**: `docs/active/schema-reference.md` -- Every table, column, index, relationship, and query pattern.

**For intelligence layer work**: `docs/active/INTELLIGENCE-LAYER-DESIGN-v2.md` -- Deep design for the intel system's future.

**For tests**: `docs/active/test-spec.md` -- Comprehensive test specification (not yet implemented).

That's it. These four files in `docs/active/` are your references. Everything else in the repo is either source code or historical.

---

## Doc structure

```
docs/
|-- active/          <- READ THESE. Current authoritative references.
|-- codex-prompts/   <- Historical prompts written for past Codex tasks.
|-- archive/         <- Old specs. Do NOT read unless a prompt explicitly tells you to.
```

**Do not read `docs/archive/`** unless a specific prompt directs you to a specific file there. The archive contains superseded specs that may contradict what's actually built. If you find yourself wanting context that isn't in the active docs, flag it -- don't go spelunking through archive.

---

## Hard rules

1. **The reconciled 3.0 spec is the source of truth.** If anything else contradicts it, the reconciled spec wins.
2. **No Tailwind.** Scoped `<style>` blocks with CSS variables from `BaseLayout.astro`. Each component owns its styles.
3. **No ORM.** Raw SQL via `query<T>()` for reads and `transaction()` for multi-statement writes, both from `src/lib/db.ts`.
4. **No new dependencies** unless the prompt explicitly approves them.
5. **All files under 600 lines.** If a component grows past this, decompose it (see dashboard pattern: parent orchestrator + sub-components with props/callbacks).
6. **DB efficiency:** Never query per-item in loops. Use batch queries, JOINs, or CTEs. The schema reference documents the expected query patterns.
7. **One commit per logical unit.** Descriptive messages. Run `npm run check:full` (astro check + astro build) after each phase before proceeding.
8. **Auth:** OTP-based via Resend email. Use `requireAuth(request)` / `requireAdmin(request)` from `src/lib/auth.ts`.

---

## Stack

```
Astro 4.0 (hybrid mode, output: 'hybrid') + React 18 (islands via client:load)
Neon serverless Postgres + raw SQL (no ORM)
Vercel deployment
Scoped <style> blocks with CSS variables (no Tailwind, no shared CSS files)
No external state library
```
