# Decision Journal

### Dashboard decomposition strategy -- 2026-03-17
**Decided:** Split DashboardTracker into 5 sub-components (MomentumStrip, CasinoRow, CasinoSearch, DiscoverySidebar, UnderfoldSection) + shared types.ts and utils.ts
**Over:** Keeping the monolith, or splitting into fewer/more pieces
**Because:** 1600 lines with 6 independent UI zones sharing state through a single component. Codex warned "any large patch touching it should be approached carefully." Each zone changes for different reasons -- momentum is independent of discovery, casino rows are independent of search. The decomposition follows those boundaries.
**Breaks if:** Sub-components need to share state that can't be passed through props cleanly (would need context or state management library)

### Discovery duplication fix -- 2026-03-17
**Decided:** Sidebar owns discovery when docked, Zone 3 owns it when collapsed. Never both visible simultaneously. Collapsed state shows a fixed "< Discovery" tab on right edge.
**Over:** Showing both simultaneously, or hiding Zone 3 grid entirely
**Because:** Users saw two copies of discovery content when sidebar collapsed. The root cause was sidebar never truly hiding (just changing CSS class) while Zone 3 always rendered. Clean handoff eliminates the duplication. The expand tab gives users a way back without taking up layout space.
**Breaks if:** Discovery content needs to be visible in both locations for different purposes (e.g., sidebar shows personalized, Zone 3 shows trending)

### Codex cleanup scope -- 2026-03-17
**Decided:** 8 approved phases: dead code removal -> formatting consolidation -> API standardization -> Settings split -> Reports split -> Intel hooks -> casino profile frontmatter -> type tightening
**Over:** Codex's full 12-phase plan (deferred: query optimization, logging, placeholder audit, UI consistency sweep)
**Because:** Deferred phases were either premature optimization (query perf without user load data), low-value (logging prefixes), or already covered by the overnight polish prompt (UI consistency). Kept phases that reduce future-work friction: dead code, shared utilities, component splits, type safety.
**Breaks if:** User base grows enough to need query optimization, or logging becomes a debugging bottleneck

### Intelligence Layer v2 -- Founder tension resolutions -- 2026-03-18
**Decided:** All 9 system-wide tensions resolved. Key calls:
1. Quality over volume -- no bootstrap phase, accept sparse early intel
2. Default anonymous -- sticky preference, aggregated data always anonymous
3. Opaque trust -- score visible, formula not published
4. Tiered health response -- fast downgrade (3 trusted reports -> amber), slow sticky recovery (14-60 day cool-downs, admin clear, or positive counter-signals required)
5. Discovery diversity gated by affiliate links -- only surface diversity picks where we have affiliate, recency-suppress stale recommendations
6. Tiers visible but subtle -- small muted indicator in feed, prominent on profiles
7. Curated feed default -- consolidated algorithmic view, raw toggle for power users
8. Build delegation infra now -- moderation permissions/audit trail in v2 architecture even though Dylan remains sole moderator
9. Full data pipeline -- event sourcing, behavioral telemetry, tiered storage, API versioning, data export all built for v2
**Over:** Various softer positions (bootstrap phase, transparent trust formula, auto-recovery for health, volunteer moderators now, deferred data architecture)
**Because:** Dylan's product vision is quality-first, privacy-conscious, architecturally sound from day one. Early adopters are power users who value quality. Going opaque->transparent is easier than reverse. Sticky health downgrades match industry reality (casino problems don't resolve quickly). Building infra now avoids retrofit under user pressure later.
**Breaks if:** Cold start is so sparse that early adopters leave before critical mass, or opaque trust generates enough backlash to damage community trust in the platform itself
