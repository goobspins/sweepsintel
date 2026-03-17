# SweepsIntel — Codex Build Instructions

**Read this file first.** It tells you what to read for each task.

---

## Doc structure

```
docs/
├── active/                    ← Current authoritative references
│   ├── SWEEPSINTEL-3.0-SPEC-RECONCILED.md   ← What's actually built (with file paths)
│   ├── INTELLIGENCE-LAYER-DESIGN-v2.md      ← Intel system deep design
│   ├── schema-reference.md                   ← Canonical DB schema reference
│   └── test-spec.md                          ← Comprehensive test specification
├── codex-prompts/             ← Prompts written for Codex tasks
│   ├── CODEX-CLEANUP-PASS.md
│   ├── CODEX-OVERNIGHT-POLISH.md
│   ├── CODEX-DASHBOARD-REWRITE.md
│   ├── CODEX-3.0-UI-FIXES.md
│   ├── CODEX-3.0-PROMPT.md
│   └── OVERNIGHT-CHAT-PROMPTS.md
└── archive/                   ← Historical specs (do NOT use for new work)
    ├── v1/                    ← Original numbered specs (00-08), UI spec, monitoring spec
    ├── v2/                    ← 2.0 spec and handoff
    ├── v3-draft/              ← Pre-reconciled 3.0 spec
    └── legacy/                ← Day-1 plans, early Codex prompts, old schema
```

## What to read

**ALWAYS read first**: `docs/active/SWEEPSINTEL-3.0-SPEC-RECONCILED.md` — This is the authoritative reference for what's built, with exact file paths and implementation status for every feature.

**For schema questions**: `docs/active/schema-reference.md` — Every table, column, index, relationship, and query pattern.

**For detailed feature specs**: The original numbered specs are in `docs/archive/v1/` (00-OVERVIEW through 08-CONSTRAINTS). These are still the most granular feature breakdowns but may not reflect the current implementation. Cross-reference against the reconciled spec.

**For intel system work**: `docs/active/INTELLIGENCE-LAYER-DESIGN-v2.md` — Deep design for the intelligence layer's future.

---

## Per-task reading guide

**Task: Set up project scaffold + deploy config**
→ Read: `00-OVERVIEW.md`, `07-FILE-STRUCTURE.md`, `08-CONSTRAINTS.md`

**Task: Build database schema**
→ Read: `01-SCHEMA.md` (run the SQL), `02-CORE-MECHANICS.md` (understand the business logic the schema supports)

**Task: Build casino directory + profiles**
→ Read: `00-OVERVIEW.md`, `01-SCHEMA.md`, `03-FEATURES-PUBLIC.md`, `07-FILE-STRUCTURE.md`, `08-CONSTRAINTS.md`, `UI-SPEC-v1.md`

**Task: Build daily tracker**
→ Read: `00-OVERVIEW.md`, `01-SCHEMA.md`, `02-CORE-MECHANICS.md`, `04-FEATURES-PRIVATE.md`, `07-FILE-STRUCTURE.md`, `08-CONSTRAINTS.md` (esp. DB efficiency tracker section), `UI-SPEC-v1.md`

**Task: Build redemption tracker + ledger**
→ Read: `00-OVERVIEW.md`, `01-SCHEMA.md`, `02-CORE-MECHANICS.md`, `04-FEATURES-PRIVATE.md`, `07-FILE-STRUCTURE.md`, `08-CONSTRAINTS.md`, `UI-SPEC-v1.md`

**Task: Build auth system**
→ Read: `00-OVERVIEW.md`, `01-SCHEMA.md`, `04-FEATURES-PRIVATE.md` (Feature 8), `07-FILE-STRUCTURE.md`

**Task: Build admin panel**
→ Read: `00-OVERVIEW.md`, `01-SCHEMA.md`, `05-FEATURES-ADMIN.md`, `07-FILE-STRUCTURE.md`, `08-CONSTRAINTS.md`, `UI-SPEC-v1.md`

**Task: Build discord intel feed + ingest API**
→ Read: `01-SCHEMA.md`, `05-FEATURES-ADMIN.md`, `04-FEATURES-PRIVATE.md` (Feature 9 for notification scoping), `07-FILE-STRUCTURE.md`, `MONITORING-SPEC-v1.md`

**Task: Build state availability + pullout alerts**
→ Read: `01-SCHEMA.md`, `03-FEATURES-PUBLIC.md`, `05-FEATURES-ADMIN.md` (provider cascade), `04-FEATURES-PRIVATE.md` (notification scoping), `07-FILE-STRUCTURE.md`

**Task: Build retention features (PWA, push, bookmarks)**
→ Read: `01-SCHEMA.md`, `06-FEATURES-RETENTION.md`, `07-FILE-STRUCTURE.md`

**Task: Build homepage + Getting Started**
→ Read: `03-FEATURES-PUBLIC.md`, `08-CONSTRAINTS.md` (homepage caching), `UI-SPEC-v1.md`

---

## Files NOT to read

The `docs/archive/` directory contains superseded drafts. **Do not use archive docs for new work** — always use `docs/active/` first and cross-reference archive only if the active docs are ambiguous on a specific detail.

---

## Key rules (repeated for emphasis)

1. **The reconciled 3.0 spec is the source of truth** for what's built. If archive specs contradict it, the reconciled spec wins.
2. **Schema reference in `docs/active/schema-reference.md`** documents every table, column, and query pattern.
3. **DB efficiency rules in `docs/archive/v1/08-CONSTRAINTS.md` are still prescriptive.** Follow the query plans exactly — do not query per-item in loops.
4. **No Tailwind.** Scoped `<style>` blocks with CSS variables. Each component owns its styles.
5. **No ORM.** Raw SQL via `query<T>()` and `transaction()` from `src/lib/db.ts`.
6. **All files under 600 lines.** If a component grows past this, it should be decomposed (see dashboard pattern).
