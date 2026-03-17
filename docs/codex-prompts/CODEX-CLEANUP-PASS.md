# Codex Prompt: Codebase Cleanup — Approved Phases

## Context

This follows the codebase audit you performed. Your cleanup plan was reviewed and filtered. Below are the approved phases in execution order. Some phases were modified, some were cut. Follow this exactly.

**Important**: The dashboard has already been decomposed into sub-components (MomentumStrip, CasinoRow, CasinoSearch, DiscoverySidebar, UnderfoldSection, types.ts, utils.ts). MyCasinosBoard has already had its formatting utilities extracted to `src/lib/format.ts`. Do NOT re-do work that's already done. Check imports before touching any file.

**Stack**: Astro 4.0 (hybrid mode) + React 18 + Neon Postgres + raw SQL. No Tailwind. Scoped `<style>` blocks with CSS variables. No external state library.

---

## Phase 0: Safety Rails

1. Add a `check:full` script to `package.json`:
```json
"check:full": "astro check && astro build"
```

2. Create a cleanup branch: `git checkout -b cleanup/deep-clean`

3. Keep each phase in its own commit with a descriptive message. Do NOT mix phases in a single commit.

4. Do NOT commit any files in `docs/` — those are managed separately.

**Run `npm run check:full` after this phase.**

---

## Phase 1: Kill Dead Legacy Files

Before doing anything else, determine if these files are actually dead:

1. Search the entire `src/` directory for imports of:
   - `DailyTracker` (the component, not the dashboard's DashboardTracker)
   - `CasinoRow` from `src/components/tracker/` (not `src/components/dashboard/CasinoRow.tsx` — that one is active)
   - `ResetCountdown`

2. Check if any `.astro` page imports or renders these components.

3. If a component has ZERO imports from any `.astro` page or other active component, **delete it**.

4. If a component IS still imported somewhere, document where and leave it alone.

Likely candidates for deletion:
- `src/components/tracker/DailyTracker.tsx`
- `src/components/tracker/CasinoRow.tsx`
- `src/components/tracker/ResetCountdown.tsx`

If the entire `src/components/tracker/` directory becomes empty, delete it.

**Commit message**: `chore: remove dead legacy tracker components`

**Run `npm run check:full` after this phase.**

---

## Phase 2: Finish Formatting Consolidation

The following are ALREADY in `src/lib/format.ts` — do NOT re-add:
- `formatAgo`
- `formatRelativeExpiry`
- `emailToDisplayName`
- `formatCurrency`
- `formatSc`
- `formatDateTime`
- `formatEntryType`
- `getTierBadgeStyle`
- `riskRank`

Check if these still exist as local functions in any component. If so, delete the local copy and import from `src/lib/format.ts`.

Now consolidate the REMAINING duplicated formatters. Search for these patterns across all `.tsx` files:

- `formatSignedNumber` or signed number formatting
- `formatNumber` or generic number formatting
- `relativeTime` (if different from `formatAgo`)
- Any `Intl.NumberFormat` usage that duplicates what's in format.ts
- Any `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` patterns that should use shared formatters

Target files to check:
- `src/components/reports/ReportsPanel.tsx`
- `src/components/ledger/LedgerTable.tsx`
- `src/components/redemptions/RedemptionList.tsx`
- `src/components/redemptions/RedemptionForm.tsx`
- `src/components/ledger/InTransitBanner.tsx`
- `src/components/ledger/LedgerSummary.tsx`

For each duplicated function found:
1. Add it to `src/lib/format.ts` if it doesn't exist there yet
2. Replace the local definition with an import
3. Verify the behavior is identical before replacing

**Commit message**: `chore: consolidate remaining formatting utilities into shared format.ts`

**Run `npm run check:full` after this phase.**

---

## Phase 3: API Route Standardization

Normalize all API handlers to follow a consistent pattern. Do NOT create a new shared abstraction file — just make each route follow the same inline pattern:

**Standard pattern every route should follow:**
```typescript
export const prerender = false;

import { requireAuth, isHttpError } from '../../lib/auth';
// or requireAdmin for admin routes

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }: { request: Request }) {
  try {
    const user = await requireAuth(request);
    // ... route logic ...
    return json({ /* response */ });
  } catch (error) {
    if (isHttpError(error)) return json({ error: error.message }, error.status);
    console.error('[route-name]', error);
    return json({ error: 'Internal server error' }, 500);
  }
}
```

**What to normalize:**
1. Every route has `export const prerender = false` at the top
2. Every route has a local `json()` helper (keep it local, not shared)
3. Every route wraps its logic in try/catch
4. Every catch block checks `isHttpError` first, then logs with a route-name prefix and returns 500
5. Every route that requires auth calls `requireAuth(request)` or `requireAdmin(request)`
6. Error responses always have shape `{ error: string }`

**Priority targets** (normalize these first):
- `src/pages/api/settings.ts`
- `src/pages/api/admin/import-casinos.ts`
- `src/pages/api/tracker/claim.ts`
- `src/pages/api/tracker/purchase.ts`
- `src/pages/api/notifications/preferences.ts`
- `src/pages/api/auth/*.ts`

Then sweep ALL remaining routes in `src/pages/api/` and normalize any that don't follow the pattern.

**Do NOT change any route's actual business logic.** Only normalize the structure. If a route already follows the pattern, leave it alone.

**Commit message**: `chore: standardize API route structure across all endpoints`

**Run `npm run check:full` after this phase.**

---

## Phase 4: Split SettingsPanel

`src/components/settings/SettingsPanel.tsx` — Split into focused sub-components.

Create these files in `src/components/settings/`:

1. **`ProfileSettingsSection.tsx`** — Display name, email, home state
2. **`GoalSettingsSection.tsx`** — Daily/weekly goal inputs
3. **`DashboardPreferencesSection.tsx`** — Momentum style, layout swap, compact mode
4. **`NotificationPreferencesSection.tsx`** — Push/email notification toggles
5. **`TrackingPreferencesSection.tsx`** — Default SC-to-USD ratio, timezone

If there's a "danger zone" (logout, delete account, reset), extract that too:
6. **`DangerZoneSection.tsx`**

The parent `SettingsPanel.tsx` becomes an orchestrator that:
- Holds shared state (user settings, toast, saving states)
- Passes props/callbacks to each section
- Contains only the shell layout CSS

**Each sub-component gets its own `<style>` block.** Same pattern as the dashboard decomposition.

If SettingsPanel has any shared types, create `src/components/settings/types.ts`.

**Commit message**: `refactor: decompose SettingsPanel into focused sub-components`

**Run `npm run check:full` after this phase.**

---

## Phase 5: Split ReportsPanel

`src/components/reports/ReportsPanel.tsx` — Split into focused sub-components.

Create these files in `src/components/reports/`:

1. **`ReportsKpiGrid.tsx`** — Top-level KPI summary cards
2. **`EarningsOverview.tsx`** — Earnings breakdown
3. **`CasinoPerformanceTable.tsx`** — Per-casino performance rows
4. **`RecentActivityList.tsx`** — Recent activity feed

The parent `ReportsPanel.tsx` becomes an orchestrator.

Same rules as Phase 4: each sub-component gets its own `<style>` block. Parent holds shared state and passes props.

**Commit message**: `refactor: decompose ReportsPanel into focused sub-components`

**Run `npm run check:full` after this phase.**

---

## Phase 6: Intel Business Logic Extraction

Extract business logic from Intel UI components into hooks/helpers.

1. **Create `src/components/intel/useIntelFilters.ts`**:
   - Move filter state management (casino checkboxes, type dropdown, time dropdown) out of IntelFeed.tsx
   - Export a hook that returns: `{ filters, setFilters, filteredItems, trackedCasinos }`
   - IntelFeed.tsx imports and uses this hook instead of managing filter state inline

2. **Create `src/components/intel/useSignalVoting.ts`**:
   - Move vote fetch logic out of IntelFeed or VoteButtons
   - Export a hook: `{ vote, pendingVoteId, userVotes }`

3. **Create `src/lib/casino-import.ts`**:
   - Move import normalization/field mapping logic out of `src/pages/api/admin/import-casinos.ts`
   - Export functions for: `normalizeImportRow()`, `validateImportRow()`, `mapImportFields()`
   - The API route calls these functions instead of having the logic inline

**Commit message**: `refactor: extract intel hooks and casino import logic`

**Run `npm run check:full` after this phase.**

---

## Phase 7: Casino Profile Frontmatter Extraction

`src/pages/casinos/[slug].astro` has heavy query logic in frontmatter. Extract into a loader.

1. **Create `src/lib/casino-profile.ts`**:
   - `getCasinoBySlug(slug: string)` — main casino data query
   - `getCasinoEditorialData(casinoId: number)` — editorial/content data
   - `getCasinoHealthSummary(casinoId: number)` — health status query
   - `getCasinoRecentIntel(casinoId: number)` — recent intel signals (if this query exists in frontmatter)
   - `getCasinoReportsSummary(casinoId: number)` — reports/stats data (if queried in frontmatter)

2. Update `[slug].astro` frontmatter to import and call these functions instead of having inline SQL.

3. Each function returns a typed result. Define the return types in the same file or in a `types.ts` alongside it.

**Do NOT change what data the page receives or how it renders.** Only move the queries out of frontmatter into importable functions.

**Commit message**: `refactor: extract casino profile queries into src/lib/casino-profile.ts`

**Run `npm run check:full` after this phase.**

---

## Phase 8: Type Tightening

Remove `any` types across the codebase.

1. **Intel components**: If `src/components/intel/types.ts` doesn't exist yet, create it with proper interfaces for `SignalItem`, `SignalAttribution`, `TrackedCasino`. Update IntelFeed, SignalCard, SignalSubmitForm, VoteButtons to use these types instead of `any`.

2. **Redemption components**: Define proper types for redemption data in the components that use them:
   - `RedemptionForm.tsx`
   - `RedemptionList.tsx`

3. **Admin components**: Type the admin component props:
   - `HealthOverrides.tsx`
   - `SignalCreator.tsx`
   - `SignalTracker.tsx`

4. **Settings**: Type the settings API response shapes.

5. **Search the entire `src/` directory for `: any`** — fix every instance you find. Use `unknown` with type guards if the actual type is genuinely uncertain.

**Commit message**: `chore: replace all 'any' types with proper interfaces`

**Run `npm run check:full` after this phase.**

---

## Constraints

1. **DO NOT modify**: `src/components/dashboard/*` (recently decomposed — leave alone), `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/reset.ts`, `vercel.json`, `astro.config.*`, `src/db/*.sql`

2. **DO NOT install new dependencies**

3. **DO NOT create shared CSS files** — every component uses scoped `<style>` blocks

4. **DO NOT change any user-visible behavior** — this is a refactoring pass, not a feature pass

5. **DO NOT touch `src/components/my-casinos/MyCasinosBoard.tsx`** — it's already clean at 335 lines, don't over-split it

6. **Every sub-component gets its own `<style>` block** — same pattern as the dashboard decomposition

7. **If you're unsure whether something is dead code, leave it.** Only delete what you can prove has zero import paths from any `.astro` page.

8. **Commit after EVERY phase**, not at the end. If something breaks, we can revert one phase without losing the others.

---

## Validation After All Phases

- [ ] `npx astro check` — zero errors
- [ ] `npx astro build` — succeeds
- [ ] No `any` types remain in `src/components/` or `src/lib/` (search with `grep -r ": any" src/`)
- [ ] No duplicate formatting functions exist outside `src/lib/format.ts`
- [ ] All API routes follow the standardized pattern
- [ ] SettingsPanel.tsx is < 150 lines (orchestrator only)
- [ ] ReportsPanel.tsx is < 150 lines (orchestrator only)
- [ ] `[slug].astro` frontmatter contains only function calls, no inline SQL
- [ ] Legacy tracker components are deleted (if confirmed dead) or documented (if still used)
- [ ] Every phase has its own git commit
