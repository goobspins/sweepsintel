# SweepsIntel — Codex Build Instructions

**Read this file first.** It tells you what to read for each task.

---

## Spec file map (all in `docs/`)

| File | Lines | Contents | Read when |
|---|---|---|---|
| `00-OVERVIEW.md` | ~80 | Mission, platform context, tech stack, architecture layers | **ALWAYS** |
| `01-SCHEMA.md` | ~585 | Complete Neon PostgreSQL schema (all CREATE TABLEs, indexes, enums) | **ALWAYS** |
| `02-CORE-MECHANICS.md` | ~50 | Redemption state machine, affiliate two-state logic | **ALWAYS** (short, critical business logic) |
| `03-FEATURES-PUBLIC.md` | ~140 | Features 1-4, 10-11: Deploy config, Casino directory, State availability, Ban reports, Homepage, Getting Started | Building any public page |
| `04-FEATURES-PRIVATE.md` | ~190 | Features 5-9: Daily tracker, Redemption tracker, Ledger, Auth, Notifications | Building any auth-required user page |
| `05-FEATURES-ADMIN.md` | ~210 | Features 12-14: Volatility reports (post-MVP), Admin panel, Discord intel feed + ingest API | Building admin panel or discord endpoints |
| `06-FEATURES-RETENTION.md` | ~80 | Feature 15: PWA manifest, push notifications, bookmark prompts, affiliate redirect return-path | Building retention/engagement features |
| `07-FILE-STRUCTURE.md` | ~180 | Complete `src/` directory tree, file responsibilities, redemption time aggregation spec | **ALWAYS** (defines where every file goes) |
| `08-CONSTRAINTS.md` | ~275 | Hard constraints, transaction boundaries, DB efficiency (query plans, indexes, caching), responsive design, future data model, open questions | **ALWAYS** |
| `UI-SPEC-v1.md` | ~965 | Visual layouts, component states, empty states, responsive breakpoints for every page | Building any user-facing component |
| `MONITORING-SPEC-v1.md` | ~325 | Discord monitoring pipeline, confidence scoring, trust tiers | Building discord ingest endpoints or admin intel queue |

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

The `docs/archive/` directory contains superseded drafts (v1, v2 prompts, old schema SQL, early planning docs). **Ignore everything in `docs/archive/`.** The numbered spec files (00-08) are authoritative.

---

## Key rules (repeated for emphasis)

1. **Schema is in `01-SCHEMA.md`, not in a separate SQL file.** Run the CREATE statements from that document.
2. **DB efficiency rules in `08-CONSTRAINTS.md` are prescriptive.** Follow the query plans exactly — do not query per-item in loops.
3. **`UI-SPEC-v1.md` defines how every page looks.** Don't guess layouts.
4. **All files under 600 lines.** If you need to reference something, it's findable by file name.
5. **The monolith `CODEX-PROMPT-v3.md` still exists in `docs/` as the canonical single-file backup.** If anything in the split files seems ambiguous, cross-reference it. The split files were extracted from the monolith with no content changes.
