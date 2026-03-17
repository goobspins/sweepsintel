# Project State

## Scope — SweepsIntel platform (Astro + React + Neon Postgres)

## Current Objective — Directory restructured, PM files written. Next: decide what to build (4.0 features? Intel feed overhaul? Casino profiles?)

## Active Approach — Claude acts as PM writing specs and Codex prompts; Dylan relays to OpenAI Codex for implementation. Claude audits code but does not write it.

## Key Decisions Made
- Contributor tiers: Newcomer → Scout → Insider → Operator (admin-only) — rejected generic names like "Trusted Contributor"
- Trust score invisible to users, 0.00–1.00, portfolio-aware — rejected visible scoring (gameable)
- Signal voting is "Worked/Didn't work" not true/false — rejected binary because mixed ratios are healthy (conditional deals)
- Dashboard decomposed into 5 sub-components + types.ts + utils.ts — rejected keeping 1600-line monolith
- Discovery sidebar/Zone 3 handoff: sidebar owns discovery when docked, Zone 3 owns it when collapsed — rejected showing both simultaneously
- MyCasinosBoard stays as-is at ~335 lines — rejected over-splitting into 5 files (one cohesive list-detail view)
- No shared API abstraction layer — rejected creating api.ts helper (adds a layer Codex must learn, not worth it)

## Open Questions
- What's next after cleanup? 4.0 features? Intel Feed UI overhaul? Casino profile enhancements?
- Intelligence deep design doc produced overnight — which parts to spec for implementation?
- When to add tests? Test spec exists but no framework chosen yet.

## Constraints & Boundaries
- No Tailwind — scoped `<style>` blocks with CSS variables
- No ORM — raw SQL via query<T>() and transaction()
- Auth is OTP-based via Resend email
- Resend domain still needs verification for production OTP
- Claude = PM only, Codex = implementation

## Working Artifacts
- `docs/active/SWEEPSINTEL-3.0-SPEC-RECONCILED.md`: ✅ Authoritative 3.0 reference
- `docs/active/INTELLIGENCE-LAYER-DESIGN-v2.md`: ✅ Reviewed — 9 founder decisions pending
- `docs/active/schema-reference.md`: ✅ Reviewed — canonical DB reference
- `docs/active/test-spec.md`: ✅ Reviewed — no tests implemented yet
- `pm/`: ✅ Fresh PM files written (WORKING-MODEL, PRODUCT-CONTEXT, CODEX-PROMPT-GUIDE, SKILLS-REFERENCE)
- `CODEX.md`: ✅ Updated to reference new doc paths
