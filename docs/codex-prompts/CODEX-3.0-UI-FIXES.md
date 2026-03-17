# SweepsIntel 3.0 — UI Fix Pass

> These are the issues found in the first deploy. Fix all of them. The spec at `docs/SWEEPSINTEL-3.0-SPEC.md` remains authoritative.
> `npm run build` must pass when you're done.

---

## Bug 1: Dashboard — Casino list height is wrong (CRITICAL)

**File:** `src/components/dashboard/DashboardTracker.tsx`

**Problem:** The casino dashboard (left column) is matching the height of the discovery sidebar (right column) instead of the other way around. When only 2-3 casinos are tracked, the casino list has a huge amount of empty space because the discovery sidebar has many cards. The spec says: "Both pinned to the same height — determined by whichever column is taller. The page scrolls, not either column individually."

**What's happening in the CSS:**
```css
.dashboard-main { display: grid; align-items: stretch; }
.dashboard-column { display: grid; align-self: stretch; }
```

`align-items: stretch` on the grid makes both columns the height of the tallest one, which is correct for the outer container. But the inner content of the shorter column stretches to fill, creating visual dead space.

**Fix:** The grid layout is correct for making both columns occupy the same row height. The problem is the inner content of the casino list column stretching visually. Change `.dashboard-column` to use `align-content: start` instead of the implicit `stretch`, so the casino list content sits at the top of its column space naturally:

```css
.dashboard-column { min-width: 0; display: grid; align-content: start; }
```

The discovery sidebar already has `align-content: start` set on `.discovery-sidebar`. The casino section should match.

Also: the `dashboard-section` (casino list wrapper) should NOT stretch to fill. It should have `align-self: start` if it's inside the column grid.

**Test:** Track 2 casinos. The casino list should take up only the space it needs. The discovery sidebar can be taller — that's fine, it determines the row height and the page scrolls. The casino list should not have a huge empty card area.

---

## Bug 2: My Casinos — Needs card grid layout, not vertical list

**File:** `src/components/my-casinos/MyCasinosBoard.tsx`

**Problem:** Currently a full-width vertical list (one card per row). Dylan wants a card grid — multiple cards per row, scannable at a glance, similar to the discovery cards at the bottom of the dashboard (screenshot 3 from Dylan). The current collapsed cards show too much horizontal space wasted on a full-width row.

**Fix:** Redesign the collapsed card layout as a grid of smaller, denser cards:

1. Change `.card-list` from `display: grid; gap: .9rem` (single column) to a responsive multi-column grid:
```css
.card-list { display: grid; gap: .9rem; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
```

2. Redesign the collapsed card to be more compact and vertical rather than horizontal:
   - Health dot in the top-left corner of the card
   - Casino name + tier badge on the same line, prominently
   - Below that: a 2x2 mini grid of metrics: SC Balance | Net P/L | Last Activity | Alert count
   - The entire card is clickable to expand (which now opens a modal or full-width expanded section below the grid, NOT inline accordion which would break the grid)

3. Change the expanded view behavior: when a card is clicked, the expanded detail panel should appear as a full-width section BELOW the grid (spanning all columns), not inline inside the card. This prevents the grid from jumping around. Use the pattern where the expanded panel inserts after the grid row containing the clicked card.

4. Responsive breakpoints:
```css
@media (max-width: 960px) { .card-list { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); } }
@media (max-width: 640px) { .card-list { grid-template-columns: 1fr; } }
```

**The collapsed card should look roughly like this:**
```
┌─────────────────────────────┐
│ 🟢 CrownCoins         [S]  │
│                             │
│ SC Balance    Net P/L       │
│ 1,240        +$84.50        │
│                             │
│ Last Activity   Alerts      │
│ 2h ago          2 alerts    │
└─────────────────────────────┘
```

Compact, scannable. Dozens fit on screen. The current layout wastes space with full-width rows for what is essentially 5-6 data points.

---

## Bug 3: Intel Feed — Attribution showing raw email address (CRITICAL)

**File:** `src/pages/api/intel/feed.ts` (line 56)

**Problem:** In screenshot 5, the signal shows "goobspins@gmail.com" as attribution. This is because `submitted_by` stores the user_id (which is the email), and the feed API returns it directly:
```typescript
display_name: item.submitted_by === null ? 'SweepsIntel Team' : item.submitted_by,
```

`item.submitted_by` is the user_id (email). It should be the user's display name, but we don't have a display_name column on user_settings yet.

**Fix (two-part):**

**Part A: Short-term (this pass):** For named (non-anonymous) user signals, show a sanitized version of the email — take the portion before `@` and capitalize it. E.g., "goobspins@gmail.com" → "Goobspins". This is a stopgap.

```typescript
function emailToDisplayName(email: string): string {
  const local = email.split('@')[0] ?? 'User';
  return local.charAt(0).toUpperCase() + local.slice(1);
}
```

Apply this in the feed.ts response mapping when `item.submitted_by` is not null and the signal is not anonymous.

**Part B: Future (not this pass):** Add a `display_name` column to `user_settings` and let users set it in Settings. For now the email-prefix approach works.

---

## Bug 4: Intel Feed — Submit form always visible, takes up half the page

**File:** `src/components/intel/IntelFeed.tsx`

**Problem:** The `<SignalSubmitForm>` renders inline between the filter bar and the signal list, always open. It dominates the page and pushes actual signals below the fold. The form should be hidden by default behind a button.

**Fix:**
1. Add a `showSubmitForm` state (default: false)
2. Add a "Submit Signal" button after the filter bar (styled as a prominent CTA, green accent)
3. When clicked, the form slides open (or simply toggles visibility). When the signal is successfully submitted, collapse the form back.
4. The signal list should be the hero of this page, not the submission form.

```tsx
const [showSubmitForm, setShowSubmitForm] = useState(false);

// In the JSX, between filter bar and signal list:
<div className="submit-row">
  <button type="button" className="submit-toggle" onClick={() => setShowSubmitForm(v => !v)}>
    {showSubmitForm ? 'Cancel' : '+ Submit Signal'}
  </button>
</div>
{showSubmitForm ? (
  <SignalSubmitForm
    casinos={initialData.trackedCasinos}
    onCreated={(signal) => {
      setItems((current) => [signal, ...current]);
      setShowSubmitForm(false);
    }}
  />
) : null}
```

---

## Bug 5: Intel Feed — Signal cards need better visual hierarchy

**File:** `src/components/intel/SignalCard.tsx`

**Problem:** The signal cards are flat and hard to scan. Everything is the same size and weight. Looking at the screenshot, the card shows: type badge, raw date string, email, casino name, title, body, vote buttons, expand link — all crammed together with similar styling.

**Fixes:**

1. **Type badge should be more prominent** — larger, bolder, with the full-width top of the card as a subtle colored bar or left border accent based on signal type.

2. **Attribution line should be secondary** — smaller text, muted color. The casino name and signal title are what matter. Move attribution below the title, not above it.

3. **Layout restructure for each card:**
```
┌──────────────────────────────────────────────┐
│ [Free SC]                   2 hours ago      │
│                                              │
│ CrownCoins                                   │
│ Free 50 SC for all users today               │
│                                              │
│ Details text here, truncated to two lines    │
│ with an expand option...                     │
│                                              │
│ By Community member        Expires in 3h 20m │
│                                              │
│ [✓ Worked · 12]  [✗ Didn't work · 4]       │
└──────────────────────────────────────────────┘
```

4. **Time format** — `formatAgo` currently calls `date.toLocaleString()` which produces ugly output like "3/17/2026, 1:19:02 AM". Use relative time: "2 hours ago", "Yesterday", "3 days ago". Simple implementation:
```typescript
function formatAgo(value: string): string {
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return 'now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}
```

5. **Expiry formatting** — same issue. `formatExpiry` returns a full locale string. For active expiry: "Expires in 3h 20m". For expired: just "Expired" in muted red.

6. **Signal type labels should be human-readable:**
```typescript
const TYPE_LABELS: Record<string, string> = {
  free_sc: 'Free SC',
  promo_code: 'Promo Code',
  flash_sale: 'Flash Sale',
  playthrough_deal: 'Playthrough Deal',
  platform_warning: 'Warning',
  general_tip: 'General Tip',
};
```
Use this instead of `item.item_type.replace(/_/g, ' ')`.

---

## Bug 6: Intel Feed — No empty state

**File:** `src/components/intel/IntelFeed.tsx`

**Problem:** When there are no signals (or filters exclude everything), the signal list area is just blank. Needs an empty state.

**Fix:** After the signal list map, if `filteredItems.length === 0`:
```tsx
{filteredItems.length === 0 ? (
  <div className="empty-state surface-card">
    <p style={{ fontWeight: 700 }}>No signals yet</p>
    <p className="muted">Signals for your tracked casinos will appear here. Be the first to submit one!</p>
  </div>
) : null}
```

---

## Bug 7: Dashboard — Latest Signal card shows raw date

**File:** `src/components/dashboard/DashboardTracker.tsx`

**Problem:** The "Latest Signal" card in Zone 3 shows "3/17/2026, 1:19:02 AM" — same raw locale string issue. Should use relative time like the Intel Feed.

**Fix:** Use the same `formatAgo` function. Either extract it to a shared utility (`src/lib/format.ts`) or duplicate it. Shared utility is cleaner since both DashboardTracker and SignalCard need it.

Create `src/lib/format.ts` with the shared `formatAgo` and `formatRelativeExpiry` functions, then import in both DashboardTracker.tsx and SignalCard.tsx.

---

## Bug 8: Dashboard — Discovery sidebar "Collapse" button text

**File:** `src/components/dashboard/DashboardTracker.tsx`

**Problem:** There's both a "Collapse" text button at the top-right of the discovery sidebar AND a "Collapse discovery" button at the bottom of the casino list. This is redundant and confusing.

**Fix:** Remove the "Collapse discovery" button from the casino list section. Keep only the "Collapse" / chevron at the top of the discovery sidebar header. The spec says: "The collapse arrow should be subtle — a small chevron at the top of the discovery column." Replace the text "Collapse" with a small chevron icon (▸ when collapsed, ▾ when open, or ◂ pointing toward the sidebar to indicate collapse).

---

## Bug 9: Source column leaking to non-admin users

**File:** `src/pages/api/intel/feed.ts`

**Problem:** Need to verify that the `source` column is NOT included in the API response. Looking at the code, it's correctly excluded from the response mapping — but the `attribution.contributor_tier` is returned even for anonymous signals. Per spec Decision #25: "Anonymous signals hide contributor badges."

**Fix:** When `is_anonymous` is true, the attribution object should return `contributor_tier: null` (not the actual tier):
```typescript
attribution: item.is_anonymous
  ? { display_name: null, contributor_tier: null }  // was: item.contributor_tier
  : { ... }
```

The frontend SignalCard.tsx correctly checks for `display_name` before showing the tier badge, but the API should not leak the tier for anonymous signals at all.

---

## Summary of Files to Modify

```
src/components/dashboard/DashboardTracker.tsx  — Bugs 1, 7, 8
src/components/my-casinos/MyCasinosBoard.tsx   — Bug 2
src/components/intel/IntelFeed.tsx              — Bugs 4, 6
src/components/intel/SignalCard.tsx             — Bug 5
src/components/intel/SignalSubmitForm.tsx       — (no changes needed, just hidden by default)
src/pages/api/intel/feed.ts                    — Bugs 3, 9
src/lib/format.ts                              — NEW shared utility (Bug 7)
```

## Priority Order

1. Bug 3 (email leak — critical, 2 minutes to fix)
2. Bug 9 (tier leak on anonymous — critical, 1 minute to fix)
3. Bug 4 (form always visible — quick win, big visual impact)
4. Bug 5 (signal card hierarchy — biggest visual improvement)
5. Bug 1 (dashboard height — layout fix)
6. Bug 2 (My Casinos grid — largest refactor in this pass)
7. Bug 7 + shared format utility
8. Bugs 6, 8 (polish)
