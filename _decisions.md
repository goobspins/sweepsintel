# Decision Journal

### Dashboard decomposition strategy — 2026-03-17
**Decided:** Split DashboardTracker into 5 sub-components (MomentumStrip, CasinoRow, CasinoSearch, DiscoverySidebar, UnderfoldSection) + shared types.ts and utils.ts
**Over:** Keeping the monolith, or splitting into fewer/more pieces
**Because:** 1600 lines with 6 independent UI zones sharing state through a single component. Codex warned "any large patch touching it should be approached carefully." Each zone changes for different reasons — momentum is independent of discovery, casino rows are independent of search. The decomposition follows those boundaries.
**Breaks if:** Sub-components need to share state that can't be passed through props cleanly (would need context or state management library)

### Discovery duplication fix — 2026-03-17
**Decided:** Sidebar owns discovery when docked, Zone 3 owns it when collapsed. Never both visible simultaneously. Collapsed state shows a fixed "◂ Discovery" tab on right edge.
**Over:** Showing both simultaneously, or hiding Zone 3 grid entirely
**Because:** Users saw two copies of discovery content when sidebar collapsed. The root cause was sidebar never truly hiding (just changing CSS class) while Zone 3 always rendered. Clean handoff eliminates the duplication. The expand tab gives users a way back without taking up layout space.
**Breaks if:** Discovery content needs to be visible in both locations for different purposes (e.g., sidebar shows personalized, Zone 3 shows trending)

### Codex cleanup scope — 2026-03-17
**Decided:** 8 approved phases: dead code removal → formatting consolidation → API standardization → Settings split → Reports split → Intel hooks → casino profile frontmatter → type tightening
**Over:** Codex's full 12-phase plan (deferred: query optimization, logging, placeholder audit, UI consistency sweep)
**Because:** Deferred phases were either premature optimization (query perf without user load data), low-value (logging prefixes), or already covered by the overnight polish prompt (UI consistency). Kept phases that reduce future-work friction: dead code, shared utilities, component splits, type safety.
**Breaks if:** User base grows enough to need query optimization, or logging becomes a debugging bottleneck
