# Codex Prompt: Dashboard Rewrite — Fix Discovery Duplication + Decompose DashboardTracker

## Context

`src/components/dashboard/DashboardTracker.tsx` is ~1600 lines and handles all dashboard UI: momentum strip, casino list with claim/adjust/purchase actions, discovery sidebar, and under-the-fold Zone 3. A discovery duplication bug exists, and the component needs decomposition into focused sub-components for maintainability.

**Stack**: Astro 4.0 + React 18 islands (`client:load`). No Tailwind — we use scoped `<style>` blocks with CSS variables. No external state library — all state is local `useState`/`useMemo`.

---

## Phase 1: Fix the Discovery Duplication Bug

### Problem

The dashboard has two places that render discovery casinos:

1. **Sidebar** (lines ~915–1010): Renders whenever `spotlightCasino` exists. Contains spotlight casino card + `compactDiscovery` grid (casinos.slice(1)). Has a collapse chevron toggle.
2. **Zone 3 under-the-fold** (lines ~1037–1063): ALWAYS renders `fullDiscovery` (ALL discovery casinos) in a `full-discovery-grid`.

When the sidebar is "collapsed" (`discoveryCollapsed = true`), `useSidebarDiscovery` becomes `false`, and the sidebar gets class `discovery-sidebar-full` instead of `discovery-sidebar-docked`. But **the sidebar JSX never hides** — all its content remains visible. Zone 3 also keeps showing its grid. Result: two visible copies of discovery content.

### Fix

Implement a **clean handoff** between sidebar and Zone 3:

1. **When sidebar is docked** (`useSidebarDiscovery === true`):
   - Sidebar renders normally: spotlight + compact discovery grid + collapse chevron
   - Zone 3 renders earnings prompt + latest signal ONLY — **do NOT render `full-discovery-grid`**

2. **When sidebar is collapsed** (`discoveryCollapsed === true`):
   - Sidebar column renders ONLY the expand chevron (a slim vertical strip, ~32px wide, with the `▸` toggle). All other sidebar content (spotlight, discovery grid, explore link) is hidden.
   - Zone 3 renders earnings prompt + latest signal + the full discovery grid (this is now the sole place discovery appears)

3. **When sidebar shouldn't exist** (fewer than 6 tracked casinos):
   - No sidebar column at all (current behavior when `!spotlightCasino`)
   - Zone 3 renders earnings prompt + latest signal + full discovery grid

### Specific code changes

In the JSX return:

**Sidebar section** (~line 915–1010):
```tsx
// Change the outer conditional: sidebar column only renders when useSidebarDiscovery OR discoveryCollapsed (need the chevron)
{spotlightCasino && casinoRows.length >= 6 ? (
  <div className="dashboard-column dashboard-column-secondary">
    <aside className={`surface-card discovery-sidebar ${discoveryCollapsed ? 'discovery-sidebar-collapsed' : 'discovery-sidebar-docked'}`}>
      <div className="discovery-header">
        <div className="discovery-header-row">
          {!discoveryCollapsed ? (
            <div>
              <div className="eyebrow">Casinos you're missing</div>
              <p className="muted section-copy">
                {discovery.homeState ? `Personalized for ${discovery.homeState}` : 'Recommended for you'}
              </p>
            </div>
          ) : null}
          <button type="button" className="discovery-collapse" onClick={() => setDiscoveryCollapsed(c => !c)} aria-label={discoveryCollapsed ? 'Expand discovery' : 'Collapse discovery'}>
            {discoveryCollapsed ? '▸' : '◂'}
          </button>
        </div>
      </div>

      {/* Only render content when NOT collapsed */}
      {!discoveryCollapsed ? (
        <>
          {/* spotlight card ... (existing JSX) */}
          {/* compact discovery grid ... (existing JSX) */}
          <a href="/casinos" className="explore-link">Explore All Casinos {'->'}</a>
        </>
      ) : null}
    </aside>
  </div>
) : null}
```

**Zone 3 full-discovery-grid** (~line 1037–1063):
```tsx
{/* Only show the full discovery grid when discovery is NOT in the sidebar */}
{fullDiscovery.length > 0 && !useSidebarDiscovery ? (
  <div className="full-discovery-grid">
    {fullDiscovery.map((casino) => (
      // ... existing card JSX ...
    ))}
  </div>
) : null}
```

**CSS changes**:
```css
/* Collapsed sidebar: slim strip with just the chevron */
.discovery-sidebar-collapsed {
  padding: 0.5rem;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-width: 32px;
  width: 32px;
}

/* When sidebar is collapsed, secondary column shrinks */
/* Update .dashboard-main-sidebar to use auto for the secondary column when collapsed */
```

For the grid template, update `useSidebarDiscovery` usage:
- Line 319: Keep `const useSidebarDiscovery = casinoRows.length >= 6 && !discoveryCollapsed;`
- Line 712: The grid class logic stays the same — when collapsed, `useSidebarDiscovery` is false, so it uses `dashboard-main-stacked`. BUT we still want a thin column for the chevron.

**Better approach for the collapsed column**: Instead of a two-column grid when collapsed, render the chevron as a floating/absolute button on the right edge of the casino list section. This avoids grid column complexity.

```tsx
// Inside the casino list section (dashboard-column-primary), at the bottom or as an overlay:
{discoveryCollapsed && casinoRows.length >= 6 ? (
  <button
    type="button"
    className="discovery-expand-tab"
    onClick={() => setDiscoveryCollapsed(false)}
    aria-label="Expand discovery"
  >
    ◂ Discovery
  </button>
) : null}
```

```css
.discovery-expand-tab {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  background: var(--bg-secondary);
  border: 1px solid var(--color-border);
  border-right: none;
  border-radius: 8px 0 0 8px;
  padding: 0.75rem 0.4rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  z-index: 10;
}
```

This way:
- When collapsed: single-column layout (`.dashboard-main-stacked`), no sidebar column at all, but a small vertical tab on the right edge says "◂ Discovery"
- When expanded: two-column layout (`.dashboard-main-sidebar`) with full sidebar
- Zone 3 grid only renders when `!useSidebarDiscovery`

This completely eliminates the duplication.

---

## Phase 2: Decompose DashboardTracker into Sub-Components

Break the 1600-line component into focused pieces. The parent `DashboardTracker` becomes an **orchestrator** (~200-300 lines) that holds shared state and passes props/callbacks to children.

### New component files to create

All in `src/components/dashboard/`:

#### 1. `MomentumStrip.tsx` (~120 lines)
Extract the momentum card (lines ~591–710 of current file).

**Props**:
```typescript
interface MomentumStripProps {
  summary: DashboardSummary;
  momentumPeriod: 'daily' | 'weekly';
  onPeriodChange: (period: 'daily' | 'weekly') => void;
  goalEditing: boolean;
  goalDraft: string;
  goalSaving: boolean;
  onGoalDraftChange: (value: string) => void;
  onGoalEditStart: () => void;
  onGoalEditCancel: () => void;
  onGoalCommit: () => void;
}
```

Includes its own `<style>` block with momentum-specific CSS (`.momentum-card`, `.momentum-strip`, `.progress-row`, `.goal-input`, etc.).

#### 2. `CasinoRow.tsx` (~200 lines)
Extract the per-casino row rendering (the `.map()` body at lines ~820–910).

**Props**:
```typescript
interface CasinoRowProps {
  casino: CasinoRowModel;
  mode: ActionMode;
  meta: { label: string; saveLabel: string; accent: string };
  amount: string;
  note: string;
  inputError: string;
  purchaseOpen: boolean;
  purchaseDraft: PurchaseDraft;
  actionPending: boolean;
  purchasePending: boolean;
  compactMode: boolean;
  statusDisplay: { label: string; color: string; countdown?: string };
  timezone: string;
  nowTs: number;
  onModeChange: (casinoId: number, mode: ActionMode) => void;
  onAmountChange: (casinoId: number, value: string) => void;
  onNoteChange: (casinoId: number, value: string) => void;
  onSave: (casino: CasinoRowModel) => void;
  onPurchaseToggle: (casinoId: number) => void;
  onPurchaseDraftChange: (casinoId: number, patch: Partial<PurchaseDraft>) => void;
  onPurchaseSave: (casino: CasinoRowModel) => void;
}
```

Includes its own `<style>` block with casino-row CSS (`.casino-row`, `.entry-row`, `.mode-tabs`, `.purchase-grid`, etc.).

#### 3. `DiscoverySidebar.tsx` (~180 lines)
Extract the sidebar (lines ~915–1010).

**Props**:
```typescript
interface DiscoverySidebarProps {
  discovery: DashboardDiscovery;
  spotlightCasino: DashboardDiscoveryCasino;
  compactDiscovery: DashboardDiscoveryCasino[];
  collapsed: boolean;
  onToggleCollapse: () => void;
}
```

Includes its own `<style>` block with discovery-specific CSS (`.discovery-sidebar`, `.spotlight-*`, `.discovery-grid`, `.discovery-card`, etc.).

#### 4. `UnderfoldSection.tsx` (~120 lines)
Extract Zone 3 (lines ~1013–1065).

**Props**:
```typescript
interface UnderfoldSectionProps {
  discovery: DashboardDiscovery;
  fullDiscovery: DashboardDiscoveryCasino[];
  casinoCount: number;
  showDiscoveryGrid: boolean;  // !useSidebarDiscovery
}
```

Includes its own `<style>` block with underfold CSS (`.underfold-*`, `.full-discovery-grid`, `.earnings-prompt`, `.latest-signal-card`).

#### 5. `CasinoSearch.tsx` (~120 lines)
Extract the search bar + dropdown (lines ~734–811).

**Props**:
```typescript
interface CasinoSearchProps {
  trackedCasinoIds: Set<number>;
  onAddCasino: (casinoId: number, name: string) => void;
  onCreateCasino: (name: string) => void;
  pendingKey: string | null;
}
```

Includes search debounce logic, results state, near-match UI. Self-contained with its own `<style>` block.

### Shared types file: `src/components/dashboard/types.ts`

Move all the type definitions to a shared file:
- `DashboardSummary`
- `DashboardDiscoveryCasino`
- `DashboardDiscovery`
- `DashboardSearchResult`
- `ActionMode`
- `CasinoStatus`
- `CasinoRowModel`
- `PurchaseDraft`
- `ToastState`

### Shared utilities: `src/components/dashboard/utils.ts`

Move all the helper functions that are currently defined at the bottom of DashboardTracker.tsx:
- `buildCasinoRowModel()`
- `statusRank()`
- `nextResetSortValue()`
- `getCasinoStatusDisplay()`
- `getTierBadgeStyle()`
- `getDiscoveryHealthLabel()`
- `getDiscoveryHealthStyle()`
- `getDiscoveryCardAccentStyle()`
- `buildDiscoveryPitch()`
- `buildSpotlightFacts()`
- `buildCompactPitch()`
- `getDiscoveryLead()`
- `hasDiscoveryAffiliateLink()`
- `normalizeCasinoName()`
- `MODE_META`
- `MOMENTUM_GRADIENTS`
- `DEFAULT_PURCHASE_DRAFT`

### Resulting DashboardTracker.tsx (~250-300 lines)

The parent orchestrator:
- Holds all shared state (`casinos`, `summary`, `discovery`, `toast`, `pendingKey`, etc.)
- Defines handler functions (`handleSave`, `handlePurchaseSave`, `handleAddCasino`, `refreshTracker`, etc.)
- Composes sub-components with props
- Contains only the shell layout CSS (`.dashboard-shell`, `.dashboard-main`, `.dashboard-column`, `.toast`, `@media` breakpoints)

```tsx
return (
  <div className="dashboard-shell">
    {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}

    <MomentumStrip
      summary={summary}
      momentumPeriod={momentumPeriod}
      onPeriodChange={setMomentumPeriod}
      goalEditing={goalEditing}
      goalDraft={goalDraft}
      goalSaving={goalSaving}
      onGoalDraftChange={setGoalDraft}
      onGoalEditStart={() => { setGoalDraft(summary.dailyGoalUsd.toFixed(2)); setGoalEditing(true); }}
      onGoalEditCancel={() => { setGoalDraft(summary.dailyGoalUsd.toFixed(2)); setGoalEditing(false); }}
      onGoalCommit={handleGoalCommit}
    />

    <div className={`dashboard-main ${useSidebarDiscovery ? 'dashboard-main-sidebar' : 'dashboard-main-stacked'} ${layoutSwap ? 'dashboard-main-swapped' : ''}`}>
      <div className="dashboard-column dashboard-column-primary">
        <section className="surface-card dashboard-section">
          <div className="section-header">...</div>
          <CasinoSearch
            trackedCasinoIds={trackedCasinoIds}
            onAddCasino={handleAddCasino}
            onCreateCasino={handleCreateCasino}
            pendingKey={pendingKey}
          />
          <div className={`casino-list ${compactMode ? 'casino-list-compact' : ''}`}>
            {casinoRows.map((casino) => (
              <CasinoRow key={casino.casinoId} casino={casino} ... />
            ))}
          </div>
        </section>
      </div>

      {useSidebarDiscovery ? (
        <div className="dashboard-column dashboard-column-secondary">
          <DiscoverySidebar
            discovery={discovery}
            spotlightCasino={spotlightCasino}
            compactDiscovery={compactDiscovery}
            collapsed={false}
            onToggleCollapse={() => setDiscoveryCollapsed(true)}
          />
        </div>
      ) : null}
    </div>

    {discoveryCollapsed && casinoRows.length >= 6 ? (
      <button className="discovery-expand-tab" onClick={() => setDiscoveryCollapsed(false)}>
        ◂ Discovery
      </button>
    ) : null}

    <UnderfoldSection
      discovery={discovery}
      fullDiscovery={fullDiscovery}
      casinoCount={casinoRows.length}
      showDiscoveryGrid={!useSidebarDiscovery}
    />

    <style>{`
      .dashboard-shell { ... }
      .dashboard-main { ... }
      .dashboard-column { ... }
      .toast { ... }
      @media (max-width: 1024px) { ... }
      @media (max-width: 640px) { ... }
      .discovery-expand-tab { ... }
    `}</style>
  </div>
);
```

---

## Implementation Order

Do this in exactly this order to minimize risk:

1. **Create `src/components/dashboard/types.ts`** — Move all type definitions from DashboardTracker. Update DashboardTracker to import them. Verify no build errors.

2. **Create `src/components/dashboard/utils.ts`** — Move all helper functions and constants. Update DashboardTracker to import them. Verify no build errors.

3. **Create `MomentumStrip.tsx`** — Extract momentum section. Replace in DashboardTracker with `<MomentumStrip />`. Verify no build errors.

4. **Create `CasinoSearch.tsx`** — Extract search bar + dropdown. Replace in DashboardTracker. Verify no build errors.

5. **Create `CasinoRow.tsx`** — Extract the casino row `.map()` body. Replace in DashboardTracker. Verify no build errors.

6. **Create `DiscoverySidebar.tsx`** — Extract sidebar. Replace in DashboardTracker. Verify no build errors.

7. **Create `UnderfoldSection.tsx`** — Extract Zone 3. Replace in DashboardTracker. Verify no build errors.

8. **Fix the discovery duplication bug** — Now that the code is modular, apply the fix:
   - Sidebar only renders when `useSidebarDiscovery` (not just when spotlightCasino exists)
   - `UnderfoldSection` receives `showDiscoveryGrid={!useSidebarDiscovery}` and conditionally renders the grid
   - Add the `discovery-expand-tab` button in the parent when sidebar is collapsed
   - Remove `discovery-sidebar-full` class entirely (sidebar is either docked or not rendered)

9. **Clean up DashboardTracker.tsx** — Should be ~250-300 lines. Remove all CSS that moved to sub-components. Keep only layout-level CSS.

10. **Run `npx astro check` and verify build** — Zero type errors.

---

## Key Constraints

1. **Every sub-component gets its own `<style>` block** — Same pattern as every other component in the codebase. No shared CSS files.

2. **No new dependencies** — Pure React + existing imports (luxon, existing lib functions).

3. **CSS variables are global** — All components can reference `var(--accent-green)`, `var(--bg-primary)`, `var(--text-muted)`, etc. These are defined in the layout.

4. **`export const prerender = false`** — This doesn't apply here (these are client components), but don't accidentally change the Astro page that mounts this.

5. **Scoped `<style>` blocks use plain class names** — Not CSS modules. Class names must remain unique enough to avoid collisions (current names like `.momentum-card`, `.casino-row`, `.discovery-sidebar` are already well-namespaced).

6. **The `discovery-sidebar-full` class is being REMOVED** — After the fix, the sidebar is either docked (`discovery-sidebar-docked`) or not rendered at all. No more "full width sidebar" state.

7. **Session storage for `si-discovery-collapsed`** — Keep this behavior. When user collapses discovery, it stays collapsed for the session.

8. **Layout swap** — The `layoutSwap` state and "Swap sides" button must continue working. It swaps the order of primary/secondary columns.

9. **Compact mode** — The `compactMode` state and toggle must continue working inside the casino list.

10. **Do NOT touch**: `src/pages/dashboard.astro`, `src/pages/api/tracker/*`, `src/lib/tracker.ts`, `src/lib/reset.ts`, `HealthDot.tsx`. These are stable and unrelated.

---

## Testing Checklist

After implementation, verify:

- [ ] Dashboard loads without console errors
- [ ] Momentum strip expands/collapses, daily/weekly toggle works, goal editing works
- [ ] Casino list shows all tracked casinos sorted correctly
- [ ] Daily claim, adjust, and free spins modes all work
- [ ] Purchase flow works
- [ ] Search bar finds and adds casinos
- [ ] Discovery sidebar shows when 6+ casinos tracked
- [ ] Collapse chevron hides sidebar, shows "◂ Discovery" tab on right edge
- [ ] Zone 3 full discovery grid ONLY appears when sidebar is collapsed or not applicable
- [ ] Discovery casinos are NEVER shown in two places simultaneously
- [ ] "Swap sides" layout toggle works
- [ ] Compact mode toggle works
- [ ] Responsive: single column on mobile (≤1024px)
- [ ] `npx astro check` passes with zero errors
- [ ] `npx astro build` succeeds
