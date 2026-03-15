# SweepsIntel — v4 Codex Prompt

_Working draft. Dylan + PM iterate before sending._

---

## What we're building and why it matters

SweepsIntel is a sweepstakes casino intelligence platform for the US market. It serves two groups: new players researching which casinos to join, and experienced operators running multiple accounts who want tools to track their activity and access community-sourced intel.

New players are the affiliate conversion pipeline. When someone lands on a casino profile, trusts it, and clicks through to join — that's a CPA event worth $20–40. The daily tracker is the retention engine that brings them back and exposes them to more casinos they haven't joined yet.

Experienced operators are harder to convert initially but become the platform's credibility. Their community reports — ban incidents, state pullouts, reset time corrections, volatility reports — are what make the intel accurate over time.

The revenue model for launch is affiliate CPA only. Everything in the MVP is free. Premium tier hooks are in the schema from day one but not activated.

---

## Platform context — important

**SweepsIntel is an AI-managed, Collective-operated business.** Dylan is the owner and editorial authority, but he cannot operate this alone — that's the point. The platform needs to be operable by an AI agent with minimal human touch per action. Dylan functions as a fast approver, not a full-time editor.

This shapes the admin UI requirements significantly. The admin panel is not a bonus — it is in scope and essential. Without it, Dylan cannot efficiently review a 5-second approval queue, moderate community reports, or respond to intel flagged from the Discord monitoring pipeline. The admin UI is the interface between the AI-managed operations layer and Dylan.

**Spec structure — read `CODEX-README.md` in the project root first.** It tells you which files to read for each task. The spec has been split into focused modules (00-08) to keep each file under 600 lines. Always read `00-OVERVIEW.md` + `01-SCHEMA.md` + `08-CONSTRAINTS.md` as baseline, then read the relevant feature file for your current task.

**Companion documents (always in this `docs/` directory):**
- `MONITORING-SPEC-v1.md` — Discord monitoring pipeline architecture. Read for context on `confidence`/`confidence_reason` fields and the admin queue.
- `UI-SPEC-v1.md` — Visual layouts, component states, empty states, interaction patterns for every page. Read when building any user-facing component.

---

## Reference material — important

There is an existing personal sweepstakes tracking app (Dylan's). It handles daily tracking, redemptions, offer management, session logging, and a full ledger. **Do not scaffold off it.** It exists as a reference and case study. Treat it like a wireframe: understand the intent and data flows, then implement cleanly from scratch.

The reason: prior attempts to scaffold off it resulted in inheriting architectural decisions that aren't right for a multi-user public platform. Start fresh.

Key reference files (read these, don't reuse the architecture):
- `Casino/web/lib/v2/casinoReset.ts` — Luxon reset time logic (replicate in `src/lib/reset.ts`)
- `Casino/web/lib/v2/redemptions.ts` — median/p80 functions, `buildRedemptionCasinoViews`
- `Casino/web/lib/offer-math.ts` — offer margin math
- `Casino/web/prisma/schema.prisma` — domain model reference (field names, enums)
- `Casino/web/lib/v2/ledger.ts` — `deriveSessionMetrics` for future session tracking

---

## Tech stack

- **Astro 4** with hybrid output mode — mostly static pages with server-rendered API routes and a few interactive islands
- **React 18** for interactive components (daily tracker, redemption tracker, ledger UI, admin panel)
- **Neon PostgreSQL** for all persistence
- **Vercel** for deployment — auto-deploy on push to main
- **TypeScript** throughout
- **Luxon** for all timezone and DST calculations. No alternatives.
- **Resend** for transactional email (OTP, state pullout alerts)

There is already an initialized scaffold at the project root. Wire `@astrojs/vercel` into `astro.config.ts` first — that unblocks deployment from day one.

There are 11 casino MDX files already drafted in `src/content/casinos/` (including `myprize.mdx` — the Getting Started casino) and a typed Astro content collection defined in `src/content/config.ts`. Extend the frontmatter schema as described below.

---

## Architecture — four layers

**Public layer** (no auth, search-indexed, the marketing surface):
Casino profiles, state availability map, ban reports feed, reset time community database, state pullout alerts, volatility community reports. This is what new players find first and what earns SEO authority.

**Private MVP layer** (email OTP auth required, personal tools):
Daily tracker, redemption tracking, ledger, in-app notifications. Tightly coupled and must be built as one system. A claim creates a ledger entry automatically. A redemption creates a pending entry that only moves to the ledger on confirmed receipt.

**Admin layer** (admin auth required, Collective operations):
Casino CRUD, ban report moderation queue, community suggestion approval/rejection, admin flags from intel sources, state pullout alert management, email blast controls, AI-proposed action review. This layer is what makes AI-managed operations possible.

**Future premium layer** (data model must leave room for this, don't build it now):
Offer calculator, wash session tracking, advanced P/L reporting, stuck redemption personal alerts, advanced cross-wash calculator.

---

