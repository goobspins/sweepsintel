# Codex Overnight Prompt: Intel Feed Overhaul + Casino Profiles + Codebase Cleanup

## Overview

This is a multi-phase overnight task. Complete each phase in order. Run `npx astro check` between each phase to catch regressions early.

**Stack**: Astro 4.0 (hybrid mode, `output: 'hybrid'`) + React 18 (islands via `client:load`) + Neon serverless Postgres + raw SQL. No Tailwind — scoped `<style>` blocks with CSS variables. No external state library.

**Global CSS variables** (defined in `src/layouts/BaseLayout.astro`):
```
--bg-primary: #111827          --text-primary: #f3f4f6
--bg-secondary: #1f2937        --text-secondary: #d1d5db
--text-muted: #9ca3af          --border: rgba(148,163,184,.18)
--accent-green: #10b981        --accent-red: #ef4444
--accent-yellow: #f59e0b       --accent-blue: #3b82f6
--color-border: var(--border)  --color-border-subtle: rgba(156,163,184,.24)
```

---

## Phase 1: Intel Feed UI Overhaul

The Intel Feed (`/intel`) is the public-facing heart of the intelligence layer. It currently works but has poor visual hierarchy, cramped layout, and clunky UX. This phase is a complete UI redesign of 4 files.

### 1A. `src/components/intel/IntelFeed.tsx` — Layout Redesign

**Current problems:**
- Filter bar and casino checkboxes are cramped
- Submit button floats disconnected from the flow
- Signal list has no visual breathing room
- No loading state when filters change
- Page title says "Intel Feed" twice (hero eyebrow + h1)

**Changes:**

1. **Redesign the hero section**: Remove the redundant "Intel Feed" eyebrow. The h1 should say "Intel" (shorter, punchier). Add a subtitle that's contextual: "Tracking signals for {selectedCasinos.length} of {trackedCasinos.length} casinos" or "No casinos selected — showing all signals".

2. **Redesign the filter bar**: Make it a sticky bar below the hero that stays visible on scroll. Layout:
   - Top row: Casino chips (scrollable horizontal row on mobile, wrapping on desktop). Each chip should be a compact pill with just the casino name, no checkbox widget visible — use background color to indicate selected (accent-blue tint) vs unselected (dark, muted). Click toggles.
   - Bottom row: Type dropdown + Time dropdown + "Submit Signal" button (green CTA), all in a single flex row. The submit button should be here, not in a separate disconnected row.

3. **Sticky filter bar CSS**:
```css
.filter-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(12px);
  background: rgba(17, 24, 39, 0.85);
  border-bottom: 1px solid var(--color-border);
}
```

4. **Signal list gap**: Increase gap from 0.85rem to 1rem. Add a subtle count label above the list: "Showing {filteredItems.length} signals".

5. **Empty state improvement**: Current empty state is a plain card. Make it more inviting:
   - Larger text, center-aligned
   - A subtle dashed border instead of solid
   - "Be the first to share intel" with the submit button inline

6. **Submit form positioning**: When `showSubmitForm` is true, render it as a modal overlay OR as an expanded section that slides in below the filter bar (above the signal list). Add a smooth transition. The form should close on successful submission (already does) and show a success toast.

### 1B. `src/components/intel/SignalCard.tsx` — Visual Hierarchy Redesign

**Current problems:**
- All information is at the same visual weight
- The left border accent color sets `color` on the whole card, making body text colored (green for free_sc, etc.) — this is wrong, body text should always be `--text-secondary`
- Expand button is always visible even for short content
- Casino name and signal type badge compete for attention
- Vote buttons and attribution line are mushed together

**Changes:**

1. **Fix the color inheritance bug**: The `.signal-card-free_sc { color: var(--accent-green); }` rule colors ALL text inside the card. Instead, only the left border should be colored. Use a CSS variable approach:
```css
.signal-card {
  --signal-accent: var(--text-secondary);
  border-left: 4px solid var(--signal-accent);
  color: var(--text-primary); /* always */
}
.signal-card-free_sc { --signal-accent: var(--accent-green); }
.signal-card-promo_code { --signal-accent: var(--accent-blue); }
/* etc */
```

2. **Visual hierarchy** (top to bottom of each card):
   - **Row 1**: Type badge (left) + relative time (right) — existing, keep as-is but use `--signal-accent` for badge
   - **Row 2**: Casino name (if present) — bold, `--text-primary`, 1.05rem. This is the anchor.
   - **Row 3**: Signal title — bold, `--text-primary`, 1.15rem. The most prominent element.
   - **Row 4**: Body text — `--text-secondary`, 0.95rem, max 3 lines with CSS line-clamp (no JS truncation). Show "Read more" only if content overflows.
   - **Row 5**: Attribution + expiry — muted row. "By {name}" with tier badge, separator dot, expiry if present
   - **Row 6**: Vote buttons — separated by a subtle top border from the rest

3. **CSS line-clamp instead of JS truncation**: Replace the `truncate()` function with:
```css
.signal-body {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.signal-body-expanded {
  display: block;
  -webkit-line-clamp: unset;
}
```
Toggle the class instead of using string truncation. Only show the expand button if `content.length > 180` (approximate threshold for 3 lines).

4. **Status pill for disputed/expired signals**: If `signal_status !== 'active'`, show a more prominent status indicator — e.g. a banner at the top of the card with a background tint (red for disputed, amber for expired).

### 1C. `src/components/intel/SignalSubmitForm.tsx` — Polish

**Current problems:**
- Signal type dropdown shows raw snake_case values (`free_sc`, `promo_code`)
- Form has no visual separation from signal list
- No character count on details textarea
- Labels are unstyled (just bold `<span>`)

**Changes:**

1. **Signal type dropdown**: Use the same `TYPE_LABELS` map from SignalCard. Import or duplicate:
```typescript
const TYPE_LABELS: Record<string, string> = {
  free_sc: 'Free SC', promo_code: 'Promo Code', flash_sale: 'Flash Sale',
  playthrough_deal: 'Playthrough Deal', platform_warning: 'Warning', general_tip: 'General Tip',
};
```
Use these as display labels in the `<option>` elements.

2. **Form styling upgrade**:
   - Wrap in a `surface-card` with a colored top border (accent-green, 3px)
   - Add a form title: "Share Intel" with a subtitle "Help the community by reporting what you've found"
   - Labels should use the `.metric-label` pattern (uppercase, small, muted, letter-spaced)
   - Add a max-length indicator on the details textarea (show character count, max 2000)

3. **Success feedback**: After submission, briefly flash the new signal card at the top of the list with a highlight animation (subtle green glow that fades over 2s).

### 1D. `src/components/intel/VoteButtons.tsx` — Micro-Interactions

**Current problems:**
- Buttons look identical to each other except background tint
- No visual feedback on hover/click
- No indication if user has already voted
- Count formatting for large numbers

**Changes:**

1. **Better button design**: Each button should have an icon-like prefix:
   - Worked: "✓ Worked for me · 12"
   - Didn't work: "✗ Didn't work · 3"
   - Use Unicode characters, not an icon library

2. **Hover states**: Slight scale + opacity change on hover:
```css
.vote-buttons button:hover:not(:disabled) {
  transform: scale(1.02);
  opacity: 0.85;
}
```

3. **Disabled state during pending**: Show a subtle pulse animation on the clicked button.

4. **Vote ratio indicator**: If total votes > 5, show a thin horizontal bar between the two buttons showing the ratio (green portion vs red portion). Very subtle, 3px tall.

---

## Phase 2: Casino Profile Page Enhancement

The casino profile page (`src/pages/casinos/[slug].astro`) is server-rendered Astro. It currently shows editorial content, game availability, ban reports, and redemption stats. We need to add the intelligence layer data.

### 2A. Add Recent Intel Signals Section

**Location**: Add a new section between the existing editorial content and the ban reports section.

**Implementation**:

1. In the frontmatter of `[slug].astro`, query recent intel signals for this casino:
```typescript
const recentSignals = await query<{
  id: number;
  title: string;
  item_type: string;
  created_at: string;
  expires_at: string | null;
  worked_count: number;
  didnt_work_count: number;
  signal_status: string;
}>(
  `SELECT id, title, item_type, created_at, expires_at,
          worked_count, didnt_work_count, signal_status
   FROM discord_intel_items
   WHERE casino_id = $1
     AND item_type IN ('free_sc','promo_code','flash_sale','playthrough_deal','platform_warning','general_tip')
     AND created_at > NOW() - INTERVAL '30 days'
   ORDER BY created_at DESC
   LIMIT 5`,
  [casino.id]
);
```

2. Render as a simple server-rendered section (no React island needed):
```html
{recentSignals.length > 0 && (
  <section class="profile-section">
    <h2>Recent Intel</h2>
    <div class="signal-preview-list">
      {recentSignals.map(signal => (
        <div class="signal-preview">
          <span class={`signal-type-badge type-${signal.item_type}`}>
            {TYPE_LABELS[signal.item_type]}
          </span>
          <strong>{signal.title}</strong>
          <span class="muted">{formatAgo(signal.created_at)}</span>
        </div>
      ))}
    </div>
    <a href="/intel" class="view-all-link">View all intel →</a>
  </section>
)}
```

Note: `formatAgo` needs to be available server-side. It's currently in `src/lib/format.ts` — verify it works in Astro frontmatter (it should, it's pure JS with no browser APIs).

### 2B. Add Health Status Display

If the casino has health data, show it prominently near the top of the profile.

1. Query health status in frontmatter:
```typescript
const healthRow = await query<{ status: string; reason: string | null }>(
  `SELECT status, reason FROM casino_health WHERE casino_id = $1 ORDER BY computed_at DESC LIMIT 1`,
  [casino.id]
);
const health = healthRow[0] ?? null;
```

2. Render a health banner below the casino name/tier:
```html
{health && health.status !== 'healthy' && (
  <div class={`health-banner health-${health.status}`}>
    <span class="health-dot"></span>
    <span>{health.status === 'critical' ? 'Critical Risk' : health.status === 'at_risk' ? 'At Risk' : 'Watch'}</span>
    {health.reason && <span class="muted"> — {health.reason}</span>}
  </div>
)}
```

---

## Phase 3: Dead Code Removal & Codebase Cleanup

### 3A. Remove Orphaned Discord Reaction System

The old confirm/dispute voting system has been replaced by the signal_votes system. Clean it up:

1. **DELETE** `src/pages/api/discord/react.ts` — This endpoint is orphaned. Nothing calls it. The Discord bot (if any) uses `/api/discord/ingest.ts` for ingestion, not reactions.

2. **UPDATE** `src/lib/tracker.ts` — The `TrackerAlertItem` interface includes `confirm_count` and `dispute_count` fields. Remove them from the interface. Search for any references in components and remove those too.

3. **DO NOT** modify the database schema SQL files — those are migration records and should stay as documentation. Just remove the TypeScript/code references.

4. Verify: Search the entire codebase for `confirm_count` and `dispute_count` references. Remove all TypeScript/TSX references that aren't in `.sql` files.

### 3B. Extract Duplicated Utility Functions

Several utility functions are duplicated across components:

1. **`getTierBadgeStyle()`** — Exists in BOTH:
   - `src/components/my-casinos/MyCasinosBoard.tsx` (lines 344-349)
   - `src/components/dashboard/utils.ts`

   **Fix**: Export it from `src/components/dashboard/utils.ts` (or better, move to `src/lib/format.ts` since it's used across features). Import in MyCasinosBoard instead of duplicating.

2. **`formatCurrency()` and `formatSc()`** — Exist in `MyCasinosBoard.tsx` (lines 351-357) but not in the shared `src/lib/format.ts`.

   **Fix**: Move to `src/lib/format.ts` and export. Import in MyCasinosBoard.

3. **`formatEntryType()`** — Exists only in `MyCasinosBoard.tsx` (lines 365-372).

   **Fix**: Move to `src/lib/format.ts`. It'll be useful elsewhere.

4. **`formatDateTime()`** — Exists in `MyCasinosBoard.tsx` (lines 359-363).

   **Fix**: Move to `src/lib/format.ts`.

5. **`riskRank()`** — Exists in `MyCasinosBoard.tsx` (lines 337-342).

   **Fix**: Move to `src/lib/format.ts` or `src/lib/health.ts` (it's health-domain logic).

After moving, update all imports and verify with `npx astro check`.

### 3C. Extract Shared `TYPE_LABELS` Constant

The signal type labels map exists in `SignalCard.tsx` and will be needed in `SignalSubmitForm.tsx` and `[slug].astro`:

```typescript
export const SIGNAL_TYPE_LABELS: Record<string, string> = {
  free_sc: 'Free SC',
  promo_code: 'Promo Code',
  flash_sale: 'Flash Sale',
  playthrough_deal: 'Playthrough Deal',
  platform_warning: 'Warning',
  general_tip: 'General Tip',
};
```

Move to `src/lib/intel-constants.ts` (or add to `src/lib/format.ts`). Import in SignalCard, SignalSubmitForm, and [slug].astro.

### 3D. Clean Up `any` Types in Intel Components

The Intel Feed components use `any` types extensively:

1. **`IntelFeed.tsx`**: `user: any`, `initialData.items: any[]` — Define proper interfaces.
2. **`SignalCard.tsx`**: `item: any` — Define a `SignalItem` interface.
3. **`MyCasinosBoard.tsx`**: `healthByCasino: Record<number, any>` — Type properly.

Create `src/components/intel/types.ts`:
```typescript
export interface SignalAttribution {
  display_name: string | null;
  contributor_tier: string | null;
}

export interface SignalCasino {
  id: number;
  name: string;
  slug: string;
}

export interface SignalItem {
  id: number;
  title: string;
  content: string;
  item_type: string;
  created_at: string;
  expires_at: string | null;
  worked_count: number;
  didnt_work_count: number;
  signal_status: string;
  casino: SignalCasino | null;
  attribution: SignalAttribution | null;
}

export interface TrackedCasino {
  casino_id: number;
  name: string;
  slug: string;
}
```

Update IntelFeed, SignalCard, SignalSubmitForm to use these types instead of `any`.

### 3E. Consolidate Trust Score Magic Numbers

In `src/lib/trust.ts`, extract hardcoded thresholds to named constants at the top of the file:

```typescript
// Trust computation thresholds
const ACCOUNT_AGE_MATURITY_DAYS = 90;
const CLAIM_COUNT_MATURITY = 100;
const ACCOUNT_AGE_WEIGHT = 0.6;
const CLAIM_ACTIVITY_WEIGHT = 0.4;
const COMMUNITY_STANDING_OFFSET = 10;
const COMMUNITY_STANDING_DIVISOR = 20;
const PORTFOLIO_DEPOSIT_RATIO_THRESHOLD = 0.5;
const PORTFOLIO_REDEMPTION_MATURITY = 3;
const PORTFOLIO_DIVERSITY_MATURITY = 5;
const NEGATIVE_PL_SUPPRESSION_FLOOR = 0.3;

// Component weights (must sum to 1.0)
const WEIGHT_ACCOUNT_ACTIVITY = 0.20;
const WEIGHT_SUBMISSION_HISTORY = 0.30;
const WEIGHT_COMMUNITY_STANDING = 0.15;
const WEIGHT_PORTFOLIO = 0.35;
```

Replace all inline magic numbers with these constants. This makes the scoring system tunable without hunting through calculation code.

### 3F. Add Missing Database Indexes

Create a new migration file `src/db/migrations/2026-03-17-add-indexes.sql`:

```sql
-- Performance indexes for hot query paths

-- getTrackerStatus: JOINs on user_casino_settings filtered by user_id + removed_at
CREATE INDEX IF NOT EXISTS idx_user_casino_settings_user_active
ON user_casino_settings(user_id) WHERE removed_at IS NULL;

-- Daily claims lookup: queried by user_id + casino_id + date range
CREATE INDEX IF NOT EXISTS idx_daily_bonus_claims_user_casino_date
ON daily_bonus_claims(user_id, casino_id, claimed_at DESC);

-- Ledger entries: queried by user_id + casino_id
CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_casino
ON ledger_entries(user_id, casino_id);

-- Intel items: queried by casino_id + created_at for profile page and feed
CREATE INDEX IF NOT EXISTS idx_intel_items_casino_created
ON discord_intel_items(casino_id, created_at DESC)
WHERE casino_id IS NOT NULL;

-- Signal votes: queried by item_id for vote aggregation
CREATE INDEX IF NOT EXISTS idx_signal_votes_item
ON signal_votes(item_id);
```

**IMPORTANT**: Do NOT run this migration automatically. Just create the file. We'll run it manually against the database.

### 3G. Unify Tracker Alert Queries

In `src/lib/tracker.ts`, the `getTrackerStatus()` function runs two nearly identical queries for alerts — one for tracked casinos and one fallback for global alerts. Consolidate into a single query:

```typescript
// Before: two separate queries
// After: single query with conditional
const alertRows = await query<TrackerAlertItem>(
  `SELECT id, item_type, casino_id, title, content, source, confidence,
          created_at, expires_at
   FROM discord_intel_items
   WHERE (casino_id = ANY($1::int[]) OR casino_id IS NULL)
     AND (expires_at IS NULL OR expires_at > NOW())
     AND item_type IN ('platform_warning', 'flash_sale', 'promo_code', 'free_sc')
   ORDER BY created_at DESC
   LIMIT 20`,
  [casinoIds.length > 0 ? casinoIds : []]
);
```

Verify the behavior is identical: when user has tracked casinos, they see alerts for those casinos + global alerts. When they have none, they see only global alerts.

---

## Phase 4: Global Consistency Pass

### 4A. Typography & Spacing

Audit every page component and ensure consistent patterns:

1. **Page title pattern**: Every page should follow:
   ```
   <div class="eyebrow">{Category}</div>
   <h1 class="section-title">{Page Name}</h1>
   <p class="muted">{Subtitle}</p>
   ```
   Check: Dashboard (done), Intel Feed, My Casinos, Settings, Admin pages

2. **`section-title` sizing**: Should be `font-size: 2rem; letter-spacing: -0.05em; margin: 0;` everywhere. Check for inconsistencies.

3. **Card padding**: All `surface-card` sections should use `padding: 1.2rem`. Check for inconsistencies (some use 1rem, some 1.1rem).

4. **Gap consistency**: Grid gaps should follow a scale: 0.45rem (tight), 0.75rem (normal), 1rem (comfortable), 1.25rem (spacious). Audit for random values.

### 4B. Loading States

Add loading skeletons or spinners where data is fetched client-side:

1. **IntelFeed**: Show a subtle "Loading signals..." state while initial data renders (it currently has no loading indicator during filter changes — the list just blinks)

2. **MyCasinosBoard**: The health detail loading already works (`loadingHealthId`). Verify it shows properly.

3. **CasinoSearch** (dashboard): Already has "Searching..." — good.

### 4C. Error States

Audit error handling in all components:

1. **IntelFeed handleVote**: Currently throws without catching at the component level. Wrap in try/catch and show a toast:
```typescript
async function handleVote(signalId: number, vote: 'worked' | 'didnt_work') {
  try {
    // existing fetch logic
  } catch (error) {
    // show error toast
  }
}
```
Add toast state to IntelFeed (it doesn't have one currently).

2. **SignalSubmitForm**: Already has error state — good.

3. **MyCasinosBoard**: Already has toast — good.

### 4D. Responsive Breakpoints

Ensure all pages work well at three breakpoints:
- Desktop: >1024px
- Tablet: 641-1024px
- Mobile: ≤640px

Key checks:
- Intel Feed casino chips should scroll horizontally on mobile (overflow-x: auto)
- Signal cards should be full-width on mobile
- My Casinos card grid should collapse to single column on mobile (already does at 640px)
- Admin pages should stack to single column on tablet

### 4E. Empty State Audit

Every list/grid should have a proper empty state:

1. **Intel Feed signal list**: Has empty state — update the design per Phase 1 instructions
2. **My Casinos card list**: Add empty state if missing: "You haven't added any casinos to your portfolio yet. Browse casinos to get started."
3. **Dashboard casino list**: Has empty state — verify it looks good
4. **Discovery grid**: If no discovery casinos, show "All available casinos in your state are already tracked!"

---

## Phase 5: Admin Page Polish (Lower Priority)

If time permits after Phases 1-4:

### 5A. `src/components/admin/HealthOverrides.tsx`
- Ensure consistent card styling with the rest of the app
- Verify responsive layout

### 5B. `src/components/admin/SignalCreator.tsx`
- Use SIGNAL_TYPE_LABELS (from 3C) instead of raw snake_case in dropdowns
- Consistent form styling with SignalSubmitForm

### 5C. `src/components/admin/SignalTracker.tsx`
- Consistent table/list styling
- Add empty state if no signals

---

## Implementation Order Summary

1. Phase 3A: Delete dead code (discord/react.ts, confirm/dispute refs) — quick win, reduces noise
2. Phase 3B-3C: Extract duplicated utilities and TYPE_LABELS — foundation for other changes
3. Phase 3D: Add intel types — needed before Phase 1
4. Phase 1A-1D: Intel Feed overhaul — biggest visual impact
5. Phase 2A-2B: Casino profile enhancements — add intel + health to profiles
6. Phase 3E: Trust score constants — maintainability improvement
7. Phase 3F: Create index migration file — just the file, not executed
8. Phase 3G: Consolidate tracker alert queries — minor optimization
9. Phase 4A-4E: Global consistency pass — polish everything
10. Phase 5 (if time): Admin page polish

---

## Key Constraints

1. **DO NOT modify**: `src/pages/dashboard.astro`, `src/components/dashboard/*` (just decomposed — leave alone), `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/reset.ts`, `vercel.json`, `astro.config.*`

2. **DO NOT install new dependencies** — use only what's in package.json

3. **Every component gets its own `<style>` block** — no shared CSS files, no CSS modules

4. **CSS variables are global** — defined in BaseLayout.astro, available everywhere

5. **API routes need `export const prerender = false`** — don't remove this from any route

6. **Database queries use `query<T>()`** — import from `src/lib/db.ts`

7. **Auth pattern**: `const user = await requireAuth(request)` — import from `src/lib/auth.ts`

8. **Run `npx astro check` after each phase** — zero errors required before moving to next phase

9. **Run `npx astro build` after all phases** — must succeed

10. **DO NOT create any `.md` or documentation files** — code changes only

---

## Testing Checklist

After all phases, verify:

- [ ] Intel Feed loads, filters work, signal cards display correctly
- [ ] Signal card text is readable (body text is `--text-secondary`, not signal accent color)
- [ ] Signal card line-clamp works, expand/collapse works
- [ ] Vote buttons work, show counts, have hover states
- [ ] Submit signal form opens/closes, shows proper labels, submits successfully
- [ ] Casino profile page shows recent intel signals section
- [ ] Casino profile page shows health banner for non-healthy casinos
- [ ] `discord/react.ts` is deleted
- [ ] No TypeScript references to `confirm_count` or `dispute_count` remain (except in `.sql` files)
- [ ] `getTierBadgeStyle`, `formatCurrency`, `formatSc`, `formatEntryType`, `formatDateTime` are in `src/lib/format.ts`
- [ ] `SIGNAL_TYPE_LABELS` is shared from a single source
- [ ] Intel component types use proper interfaces, not `any`
- [ ] Trust score magic numbers are named constants
- [ ] Index migration file exists at `src/db/migrations/2026-03-17-add-indexes.sql`
- [ ] All pages have consistent typography, spacing, empty states
- [ ] IntelFeed has toast notifications for vote errors
- [ ] Responsive layout works at 1024px, 768px, and 375px widths
- [ ] `npx astro check` passes with zero errors
- [ ] `npx astro build` succeeds
