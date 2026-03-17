# Project State

## Scope -- SweepsIntel platform (Astro + React + Neon Postgres)

## Current Objective -- Implement Intelligence Layer v2 per design doc + founder tension resolutions. Codebase audit complete, gap analysis in progress.

## Active Approach -- Claude audits current intel implementation, identifies gaps vs design doc, builds phased implementation plan. Codex implements via prompts.

## Key Decisions Made
- All 9 system-wide tensions resolved by Dylan (2026-03-18) -- see _decisions.md
- Key calls: quality over volume (no bootstrap phase), default anonymous, opaque trust, sticky health downgrades, diversity in discovery gated by affiliate links, curated feed default, build delegation infra now
- Data architecture: full pipeline (event sourcing, telemetry, tiered storage, API versioning, data export)
- Dashboard decomposed into 5 sub-components -- done
- No shared API abstraction layer -- Codex promptability over DRY

## Open Questions
- Implementation sequencing: which v2 systems to build first?
- Schema migrations needed for new fields (signal priority, aging curves, event log, behavioral telemetry)
- Trust formula reweighting (current: portfolio 35%, design says 20%) -- needs migration plan
- When to add tests? Test spec exists but no framework chosen yet.

## Constraints & Boundaries
- No Tailwind -- scoped `<style>` blocks with CSS variables
- No ORM -- raw SQL via query<T>() and transaction()
- Auth is OTP-based via Resend email
- Claude = PM only, Codex = implementation

## Working Artifacts
- `docs/active/INTELLIGENCE-LAYER-DESIGN-v2.md`: [x] Updated with tension resolutions -- implementation source of truth
- `docs/active/SWEEPSINTEL-3.0-SPEC-RECONCILED.md`: [x] Authoritative 3.0 reference (current state)
- `docs/active/schema-reference.md`: [x] Canonical DB reference (will need updates for v2 schema)
- `docs/active/test-spec.md`: [x] Reviewed -- no tests implemented yet
