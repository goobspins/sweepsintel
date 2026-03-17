# Product Context

## What SweepsIntel Is

A tracking and intelligence platform for sweepstakes casino players. Users add casinos to their portfolio, log daily bonus claims, track purchases and redemptions, monitor their P&L, and share intel (promo codes, warnings, tips) with the community.

The differentiator is the intelligence layer -- not just tracking your own activity, but surfacing what the community knows. Which casinos are healthy? Where are the active promos? Who's having redemption problems? The product is only as valuable as the intelligence it surfaces.

## Who Uses It

Three archetypes drive design decisions:

**The Grinder** -- Tracks 30+ casinos, claims every daily bonus, optimizes every dollar. Cares about speed, accuracy, and competitive edge. Will game any system for advantage. This user needs the dashboard to load fast and show exactly what's actionable today.

**The Casual** -- Tracks 5-8 casinos, checks in once a day, doesn't want complexity. Needs the system to surface what matters without requiring engagement. If the UI feels like work, this user leaves.

**The Contributor** -- Active in Discord communities, knows the space, wants recognition. Motivated by status and being useful. Will submit intel to build their reputation. This user is the supply side of the intelligence system.

## Architecture at a Glance

Astro 4.0 in hybrid mode -- static marketing pages, server-rendered app pages, React islands for interactive components. Neon serverless Postgres for the database, accessed through raw SQL (no ORM). Deployed on Vercel. Auth is OTP-based via Resend email magic links.

CSS uses scoped `<style>` blocks with CSS variables defined in BaseLayout.astro. No Tailwind. No shared CSS files. Each component owns its styles.

## Key Systems

**Dashboard** -- Decomposed into 5 sub-components (MomentumStrip, CasinoRow, CasinoSearch, DiscoverySidebar, UnderfoldSection). Parent orchestrator holds shared state, passes props down. Discovery sidebar and Zone 3 grid do a clean handoff -- never both visible simultaneously.

**Intelligence Layer** -- Signals (user-submitted tips) with community voting ("Worked/Didn't work"), trust scoring (0.00-1.00, invisible to users), contributor tiers (Newcomer -> Scout -> Insider -> Operator), and per-casino health scores computed every 30 minutes.

**My Casinos** -- Portfolio management at ~335 lines. One cohesive list-detail view. Not over-split.

**Discovery** -- Recommends untracked casinos based on state eligibility, sorted by estimated daily value. Currently simple; deep design doc exists for making it much smarter.

## Current State (as of March 2026)

3.0 is live with the intelligence layer functional but shallow. The 8-phase codebase cleanup is complete. The overnight polish pass (Intel Feed UI, Casino Profile enhancements) is live. The reconciled 3.0 spec is the authoritative reference for what's actually shipped vs what was planned.

Open questions: what to build next (4.0 features vs intel feed overhaul vs casino profile enhancements), which parts of the intelligence deep design to implement first, and when to add tests.

## Files That Matter

- `docs/active/SWEEPSINTEL-3.0-SPEC-RECONCILED.md` -- What's actually built, with file paths
- `docs/active/INTELLIGENCE-LAYER-DESIGN-v2.md` -- Deep design for the intelligence system's future
- `docs/active/schema-reference.md` -- Canonical database schema reference
- `docs/active/test-spec.md` -- Comprehensive test specification (no tests implemented yet)
- `CODEX.md` -- Instructions Codex reads on every task
- `_state.md` -- Current project state (managed by realign system)
- `_decisions.md` -- Decision journal with reasoning
