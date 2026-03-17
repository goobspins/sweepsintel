# SweepsIntel 2.0 — Codex Handoff Guide

> This document tells the PM and Codex how to use the 2.0 spec.
> Last updated: 2026-03-15

---

## For the PM

You are translating this spec into Codex tasks. Here's what you need to know.

### Documents to read (in order)

1. **SWEEPSINTEL-VISION.md** — Read this first. It's the soul of the product. It describes what the app should feel like, not what it should do. Give this to Codex before any implementation task. It should inform every UI decision.

2. **SWEEPSINTEL-2.0-SPEC.md** — The full product spec. Business model, priorities (P0-P7), database schema, API surface, caching strategy, migration phases, and a decision log explaining why every decision was made.

3. **CODEX-README.md** (root) — The 1.0 spec index. The 1.0 docs (00-08 series) still define the existing codebase foundation. 2.0 builds on top of 1.0, it doesn't replace it.

### What's locked vs flexible

**Locked (do not change without Dylan's approval):**
- Business model (affiliate-first, premium secondary)
- Priority order (P0 through P7)
- Three entry modes (Daily/Adjust/Spins) with color-coded buttons
- Per-reset-period claim guard (not per calendar day)
- Momentum bar tracks SC value (not USD, not EV)
- KPI cards are user-configurable (3-4 from pool of 10)
- Discovery section: spotlight + compact cards layout
- All casinos shown regardless of affiliate relationship
- Content generation uses templated assembly from confirmed KB entries only
- No push notifications in 2.0
- No referral program
- No own Discord community
- Dark theme is default
- Free tier is the full product, premium is analytics layer
- Tech stack: Astro 4.0 + React 18 + Neon Postgres + raw SQL (no ORM)

**Flexible (Codex can make judgment calls):**
- Component implementation details
- Exact CSS values (the color palette in P4 is a starting point)
- Animation timing and transitions
- Mobile breakpoint specifics
- Sorting algorithm details for casino lists
- Spotlight rotation frequency (per-load vs daily)
- Exact number of compact cards shown (3-6 range)
- Settings page layout for KPI card selection

### Task ordering

Follow the Migration / Implementation Phases in the spec. They're already in dependency order:

1. **Phase 1: Schema + KB Sync** — Must come first. Everything depends on the new tables.
2. **Phase 2: Discovery Engine + Profiles (P0)** — Revenue-critical. Build this early.
3. **Phase 3: Onboarding Funnel (P1)** — Depends on casino profiles existing.
4. **Phase 4: Dashboard + Tracker + Dark Theme (P2, P3, P4)** — The daily experience. This is where the vision doc matters most.
5. **Phase 5: Ledger + My Casinos (P5)** — Depends on new entry types from Phase 1.
6. **Phase 6: Household (P6)** — Independent, can be parallelized with Phase 5.
7. **Phase 7: Premium (P7)** — Last. Depends on everything else working.
8. **Phase 8: Polish** — Mobile, performance, edge cases.

### What to tell Codex about Phase 4

Phase 4 is where most UI decisions happen. Before Codex starts Phase 4:
- Give it SWEEPSINTEL-VISION.md as context
- Give it the screenshots of Dylan's personal site (the Daily/Adjust/Spins row screenshots)
- Point it at the existing codebase for the personal site at `cowork/casino` if available
- Emphasize: dense without being cluttered, every pixel earning its rent, tool that's been used so much the edges are smooth

### Sections Codex should read per phase

**Phase 1:** Spec sections: Database Changes Summary, New Scheduled Task: KB-to-Product Sync, Caching & Data Fetching Strategy (database-side subsection)
**Phase 2:** Spec sections: P0: Casino Discovery Engine + Profiles, P-Future: Content Generation Rails
**Phase 3:** Spec sections: P1: Onboarding Funnel
**Phase 4:** Spec sections: P2: Daily Tracker, P3: Dashboard + Momentum, P4: Dark Theme + UI Overhaul. Also: SWEEPSINTEL-VISION.md (full document), Caching & Data Fetching Strategy (full section)
**Phase 5:** Spec sections: P5: Ledger + My Casinos
**Phase 6:** Spec sections: P6: Household Support
**Phase 7:** Spec sections: P7: Premium Features, Free vs Premium Summary

---

## For Codex

### Context

SweepsIntel is a daily-use tool for sweepstakes casino players. Users claim daily bonuses at 20-40 casinos every morning, log purchases/deals throughout the day, and track redemptions over time. The app is opened 100-200+ times per day by active users. Speed and density matter more than aesthetics.

The business makes money through casino affiliate signups and ongoing commission. The daily tracker is a retention engine — every day a user opens the app and claims dailies, they're generating activity that earns commission. The casino discovery section drives new affiliate signups. Everything else supports these two revenue streams.

### What not to do

- Don't add loading spinners for cached data. Use stale-while-revalidate.
- Don't make the UI "clean" by adding whitespace. Make it dense and functional.
- Don't default to light theme. Dark is default.
- Don't gate core features behind premium. Only analytical tools are premium.
- Don't use an ORM. Raw SQL with Neon serverless Postgres.
- Don't build push notifications. They're deferred.
- Don't generate freeform AI text for casino descriptions. Use templated assembly from confirmed KB entries.
- Don't hide casinos that lack affiliate links. Show all casinos.
- Don't restrict daily claims per calendar day. Restrict per reset period (which can be 6h, 8h, or 24h).

### The existing codebase

The 1.0 codebase is live and working. You're building on top of it, not rewriting from scratch. The 1.0 spec files (docs/00-08 series) define what already exists. Read CODEX-README.md in the project root for the 1.0 file map.

### Key files to know

```
docs/SWEEPSINTEL-VISION.md      — UI/UX soul of the product (read first for any UI work)
docs/SWEEPSINTEL-2.0-SPEC.md    — Full 2.0 product spec
docs/CODEX-2.0-HANDOFF.md       — This file
CODEX-README.md                  — 1.0 spec index (existing codebase docs)
content-pipeline/knowledge-base/CASINO-INTEL.md — The KB that powers discovery
```

### Decision log

The spec contains a Decision Log section with 20+ resolved decisions and their reasoning. If you're unsure about a design choice, check the decision log first. If your question isn't answered there, ask — don't guess.
