# SweepsIntel — UI Specification v1

_Companion document to CODEX-PROMPT-v3 and MONITORING-SPEC-v1. This spec defines visual layouts, component states, empty states, user flows, and screen-by-screen behavior. Codex should reference this when building every page and component._

_The Codex prompt defines WHAT to build. This document defines HOW it looks and feels at every state._

---

## Design system foundations

**Mobile-first, single-column primary.** Every user-facing page must work on a 375px viewport before scaling up. The daily tracker, ledger, and redemption pages are phone-first tools — users interact with them while sitting at a casino on their phone.

**Admin panel is desktop-optimized.** Dylan uses a desktop browser. Admin components can assume 1200px+ viewport.

**Color palette (functional, not decorative):**
- Primary action: blue (#2563EB) — CTAs, links, active states
- Success/confirmed: green (#16A34A) — claimed badges, high confidence, confirmed reactions
- Warning: amber (#D97706) — medium confidence, ban uptick, state restrictions
- Danger: red (#DC2626) — low confidence, disputes, fund confiscation warnings, hardban
- Neutral gray: (#6B7280) — unverified confidence, disabled states, secondary text
- Surface: white background, subtle gray borders (#E5E7EB) between sections

**Typography:** System font stack. No custom fonts at MVP — loading speed matters more than brand expression. Body 16px, headings scale proportionally. Casino names in the tracker should be the largest text on their row.

**Spacing rhythm:** 4px base unit. Component internal padding: 16px. Section gaps: 32px. Page margins: 16px mobile, 32px desktop.

**Interactive feedback:** Every tappable element needs a visible active/pressed state. Buttons show loading spinners during API calls — never leave the user wondering if their tap registered. Optimistic UI for claims (move card to "claimed" immediately, revert on error).

---

## Global layout

### Header (all pages)

```
[Logo: "SweepsIntel"]  [Nav links]  [Bell icon + badge]  [User email / Login]
```

**Mobile:** Logo left, hamburger menu right. Bell icon visible next to hamburger (always accessible). Tapping hamburger reveals full nav overlay.

**Desktop:** Horizontal nav bar. Logo left, nav links center, bell + user right.

**Nav links (authenticated):** Tracker | Casinos | States | Ledger | Redemptions | Getting Started
**Nav links (anonymous):** Casinos | States | Getting Started

**Bell icon behavior:**
- Unread count > 0: red dot with number (cap display at "9+")
- Click → navigates to `/notifications`
- On mobile: bell is always visible in the header bar, not hidden behind hamburger

**User area:**
- Authenticated: shows email (truncated to first 12 chars + "..."), click → dropdown with Settings, Admin (if is_admin), Logout
- Anonymous: "Log in" text link

### Footer (all pages)

Minimal. Copyright, Discord community link, legal disclaimer: "SweepsIntel provides informational content about sweepstakes casinos. We are not affiliated with any casino operator. Play responsibly."

---

## Page: Homepage (`/`)

### Layout — top to bottom

**1. Hero section**
```
┌─────────────────────────────────────────┐
│  [Headline: "Track your sweepstakes     │
│   casinos in one place"]                │
│                                          │
│  [Subheadline: 1 sentence value prop]   │
│                                          │
│  [CTA Button: "Start earning today →"]  │
│  [Secondary link: "Open tracker →"]     │
└─────────────────────────────────────────┘
```

- Primary CTA → `/getting-started` (new visitors)
- Secondary CTA → `/tracker` (returning users)
- Mobile: stack CTAs vertically, primary full-width
- Desktop: CTAs side by side

**2. Email capture banner**
```
┌─────────────────────────────────────────┐
│  "Get state pullout alerts and ban      │
│   intel in your inbox"                  │
│  [Email input field] [Subscribe button] │
└─────────────────────────────────────────┘
```

- Inline banner, NOT a modal or popup
- Single email field + "Subscribe" button
- On submit: POST to `/api/waitlist/capture` with `source = 'homepage_banner'`
- Success state: field replaced with "You're in. We'll keep you posted."
- Error (duplicate email): "You're already subscribed."
- Only shown to unauthenticated visitors

**3. Active alerts section** (conditional — only shows if alerts exist)
```
┌─────────────────────────────────────────┐
│  ⚠️ Recent state pullout alerts         │
│  • [Casino] stopped accepting in [State]│
│    — [date]                             │
│  🚩 Active ban uptick warnings          │
│  • Elevated ban reports at [Casino]     │
└─────────────────────────────────────────┘
```

- Show last 30 days of `state_pullout_alerts` and active `ban_uptick_alerts`
- If no alerts: section is entirely absent (not an empty state — just doesn't render)
- Max 5 items. "View all →" link to `/states` if more exist

**4. Intel feed teaser**
```
┌─────────────────────────────────────────┐
│  📡 Today's Community Intel             │
│  ┌───────────────────────────────────┐  │
│  │ [Type badge] [Title]              │  │
│  │ [Casino name] · Posted 2h ago     │  │
│  └───────────────────────────────────┘  │
│  [... up to 3 items]                    │
└─────────────────────────────────────────┘
```

- Last 3 published, non-expired `discord_intel_items`
- Type badge: colored pill (Free SC = green, Flash Sale = blue, Alert = amber, Playthrough Deal = purple)
- If no published items: section absent entirely
- No "View all" link — this is a teaser. Full intel requires tracker sign-up.

**5. Top-rated casinos grid**
```
┌──────────┐ ┌──────────┐ ┌──────────┐
│ [Casino] │ │ [Casino] │ │ [Casino] │
│ Tier 1   │ │ Tier 1   │ │ Tier 1   │
│ ★ 4.8    │ │ ★ 4.7    │ │ ★ 4.6    │
│ [Join →] │ │ [Join →] │ │ [Join →] │
└──────────┘ └──────────┘ └──────────┘
```

- Mobile: 1 column, full-width cards
- Desktop: 3 columns
- Show top 6 Tier 1 casinos by rating
- Each card: name (clickable → profile), tier badge, rating, promoban risk badge, "Join →" CTA (fires affiliate two-state logic)
- "Browse all casinos →" link to `/casinos`

**6. Discord community link**
```
┌─────────────────────────────────────────┐
│  🎮 Join the community                  │
│  Connect with other sweepstakes players │
│  [Join Discord →]                       │
└─────────────────────────────────────────┘
```

- Styled card, not a bare link
- Links to `https://discord.gg/9CgSgJHFu8`
- Opens in new tab

---

## Page: Daily Tracker (`/tracker`)

**This is the most important page in the product.** It's where users spend 90% of their time. Every interaction must be fast, obvious, and satisfying.

### Post-login redirect

After successful OTP verification, redirect to `/tracker`. This is the user's "home." The nav should visually indicate `/tracker` as the current page.

### Layout — three sections, top to bottom

**Section 1: Your Casinos**

Header: "Your Casinos" with count badge ("12 casinos")

Each casino is a row/card:

```
┌─────────────────────────────────────────┐
│  [Casino Name]          [Reset: 2h 14m] │
│  🔥 Streak: 14 days     [Claimed ✓]    │
│                          or             │
│                          [Claim button]  │
└─────────────────────────────────────────┘
```

**Row states:**

_Available now (unclaimed, reset has passed):_
- Background: subtle green tint or left border green
- Claim button: solid blue, prominent
- Reset text: "Available now" in green
- These rows float to top of section

_Countdown (unclaimed, reset hasn't passed yet):_
- Background: default white
- No claim button visible (can't claim yet)
- Reset text: "Resets in 5h 23m" — live countdown, updates every minute
- Sorted by soonest reset first (ascending)

_Claimed today:_
- Background: subtle gray tint
- "✓ Claimed" badge in green where button was
- If advanced mode and SC was entered: "✓ 245 SC" instead of just "✓ Claimed"
- Reset text: "Next in 18h 42m"
- These rows sink to bottom of section

_Drag handle:_ Small grip icon on the left edge of each row. Visible but not prominent. Drag to reorder.

**Casino name click behavior:** Navigates to `/casinos/[slug]` for admin-curated casinos. For `source = 'user_suggested'`: no link (no profile exists).

**Streak display:** Only shown for casinos with `has_streaks = true`. Format: "🔥 14 days" or flame icon + number. Streak break: "Streak: 0 (broke 2d ago)" in muted red.

**Simple mode claim flow:**
1. User taps "Claim" button
2. Button immediately shows spinner (optimistic)
3. API call fires (`POST /api/tracker/claim`)
4. On success: button becomes "✓ Claimed", row animates to bottom of list
5. On error: button reverts, toast error message

**Advanced mode claim flow:**
1. User taps "Claim" button
2. Inline area expands below the row (push content down, no modal):
```
┌─────────────────────────────────────────┐
│  SC amount: [____] or [No SC today]     │
└─────────────────────────────────────────┘
```
3. User enters number and taps away (blur commits) OR taps "No SC today"
4. Both paths: API call, row animates to bottom, inline collapses

**Remove casino:** Swipe left on mobile (or long-press → context menu). Desktop: hover reveals small "×" icon on right edge. Confirm: "Remove [Casino] from tracker?" with "Remove" and "Cancel". Removing sets `removed_at` — casino reappears in Section 2.

**Add casino search bar:** Above Section 1, a search field:
```
┌─────────────────────────────────────────┐
│  🔍 Search or add a casino...           │
└─────────────────────────────────────────┘
```
- Autocomplete against existing `casinos` rows (name match)
- If typed name has no match and user presses enter: "Add [Name] as a new casino?" confirmation → creates `user_suggested` row
- File upload icon next to search bar → opens bulk import (`.txt` or `.csv`)

**Empty state (no casinos in tracker):**
```
┌─────────────────────────────────────────┐
│  You're not tracking any casinos yet.   │
│                                          │
│  Search above to add one, or browse the │
│  suggestions below to get started.      │
│                                          │
│  New here? [Start with our guide →]     │
└─────────────────────────────────────────┘
```
Link to `/getting-started`.

---

**Section 1.5: My Alerts (intel feed)**

Between Section 1 and Section 2. Full width. NOT a sidebar.

```
┌─────────────────────────────────────────┐
│  📡 Intel for Your Casinos              │
│  ┌───────────────────────────────────┐  │
│  │ [Free SC] McLuck: 50 free SC via │  │
│  │ lobby banner — log in and check   │  │
│  │ ✓ 8 confirmed working · ✗ 1      │  │
│  │ [Confirm] [Dispute]     3h ago   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ [Flash Sale] Crown: 40% off VIP  │  │
│  │ packages until midnight ET        │  │
│  │ ✓ 12 confirmed · Expires in 6h   │  │
│  │ [Confirm] [Dispute]     5h ago   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

- Only shows items for casinos in user's `user_casino_settings` + items with `casino_id = null`
- Type badge (colored pill) on each item
- Expiry countdown on items with `expires_at` — "Expires in 6h" in amber, "Expires in 45m" in red
- Confirm/Dispute buttons (auth required)
- After reacting: button changes to filled state, count updates optimistically
- If no items: section absent (not rendered at all — don't show an empty "no alerts" state)
- Newest first, max 10 items, "View older →" link if more

---

**Section 2: Casinos to Add**

Header: "Explore More Casinos" (not "Casinos to Add" — marketing language, not database language)

```
┌─────────────────────────────────────────┐
│  [Casino Name]           ~300 SC/day    │
│  "Daily login bonus with streak system" │
│  [Join →]  [Already a member? Add →]   │
└─────────────────────────────────────────┘
```

**Per card:**
- Casino name (clickable → profile)
- `daily_bonus_desc` text
- Expected daily SC value (from sort query) — display as "~X SC/day" with approximate USD conversion: "~X SC/day (~$Y)"
  - USD conversion: `sc_amount / sc_to_usd_ratio`. Example: 300 SC at 1.0 ratio = ~$300. At 10.0 ratio = ~$30. Round to nearest dollar.
- Promoban risk badge (small, colored)
- Two CTAs:
  - "Join →" (primary, blue): fires affiliate + adds to tracker atomically
  - "Already a member? Add to tracker" (secondary, text link): adds to tracker without affiliate

**After clicking "Join →":**
- Card animates out of Section 2
- Casino appears at bottom of Section 1 with "Available now" state
- Browser opens affiliate URL in new tab (user lands on casino signup page)
- When user returns to SweepsIntel tab, their tracker shows the new casino

**SC-to-USD display:** Every SC amount shown in Section 2 must include the approximate USD equivalent. This is critical for new users who don't know what "300 SC" means in dollars.

**Empty state (user has joined all curated casinos):**
```
┌─────────────────────────────────────────┐
│  You've added all our tracked casinos.  │
│  Nice.                                  │
│                                          │
│  Know one we're missing?               │
│  [Suggest a casino →]                   │
└─────────────────────────────────────────┘
```
"Suggest a casino" focuses the search bar in Section 1.

---

## Page: Casino Profile (`/casinos/[slug]`)

### Layout — top to bottom

**1. Casino header**
```
┌─────────────────────────────────────────┐
│  [Casino Name]           [Tier 1 badge] │
│  ★★★★☆ 4.2              Parent: VGW    │
│  [Join Casino →] or [Visit Casino →]    │
└─────────────────────────────────────────┘
```

- CTA uses affiliate two-state logic
- "Join Casino →" (has affiliate, user not joined) = blue primary button
- "Visit Casino →" (no affiliate OR user already joined) = outlined secondary button

**2. Alert banners** (conditional)
```
┌─────────────────────────────────────────┐
│  ⚠️ Elevated ban activity reported in   │
│  the last 7 days                        │
└─────────────────────────────────────────┘
```
- Ban uptick: amber banner
- State restriction: amber banner with state name
- Redemption slowdown: amber banner

**3. Structured data panel**

Two-column layout on desktop, single column on mobile:

```
Left column:                Right column:
┌──────────────────┐       ┌──────────────────┐
│ Promoban Risk    │       │ Redemption Speed  │
│ 🟢 Low           │       │ 24-48hr ACH       │
│                  │       │                    │
│ Hardban Risk     │       │ Min Redemption     │
│ 🟡 Medium        │       │ $10.00             │
│                  │       │                    │
│ Family Ban       │       │ Fees               │
│ ⚠️ Yes — ban at  │       │ Free ACH, $5 crypto│
│ one = ban at all │       │                    │
│                  │       │ Playthrough        │
│ Confiscates      │       │ 1.0x (full value)  │
│ Funds on Ban     │       │                    │
│ ❌ Yes            │       │ Streak Mode        │
│                  │       │ Fixed @ 12:00 AM ET│
│ SC-to-USD Ratio  │       │                    │
│ 1.0 ($1 per SC)  │       │ Next Reset         │
│                  │       │ 3h 42m (authed)    │
└──────────────────┘       └──────────────────┘
```

Risk badges:
- None = green pill
- Low = green pill
- Medium = yellow pill
- High = red pill
- Unknown = gray pill

"Confiscates Funds" warning: if `ban_confiscates_funds = true`, display in red with explicit warning text. This is the most important risk signal on the page.

**4. Live games section**

```
┌─────────────────────────────────────────┐
│  Live Games: Yes                        │
│  Providers: Evolution, Pragmatic Play   │
│                                          │
│  ⚠️ Live game providers log multi-      │
│  account connections. Use separate       │
│  devices and IPs.                       │
│                                          │
│  Known Games:                            │
│  ┌─────────────────────────────────────┐│
│  │ Game Name      │Provider│CW?│Conf. ││
│  │─────────────────────────────────────││
│  │ Iconic 21 BJ   │Evolut.│ ✓ │🟢 Hi ││
│  │ Lightning Roul. │Evolut.│ ✓ │🟡 Med││
│  │ Mega Wheel     │Pragma.│   │⚪ Unv ││
│  └─────────────────────────────────────┘│
│                                          │
│  Cross-wash compatible: Yes              │
│  Direction: Either way                   │
│  [Strategy notes — Premium]             │
└─────────────────────────────────────────┘
```

- Game availability table: game name, provider, cross-wash flag (✓ if relevant), confidence badge
- If no games tracked: "No game data yet — community monitoring will populate this over time."
- Cross-wash strategy notes are paywalled: show "[Detailed strategy notes available with Premium]" placeholder

**5. Community volatility reports** (POST-MVP)
```
┌─────────────────────────────────────────┐
│  Community Volatility Reports           │
│  — Coming Soon                          │
│  Community-reported game volatility     │
│  data will appear here.                │
└─────────────────────────────────────────┘
```
Placeholder only at MVP. Reserves layout space.

**6. Community intel** (Surface B from Feature #14)
```
┌─────────────────────────────────────────┐
│  📡 Community Intel                      │
│  [Intel items for this casino]          │
│  [Confirm/Dispute buttons]              │
└─────────────────────────────────────────┘
```
- Published, non-expired items for this `casino_id`
- Same card format as tracker intel feed
- If no items: section absent

**7. Redemption stats**
```
┌─────────────────────────────────────────┐
│  Redemption Speed (community data)      │
│  Median: 2.3 days                       │
│  80th percentile: 4.1 days             │
│  Based on 84 redemptions                │
│  ⚠️ Processing times appear to be       │
│  increasing recently (if trend alert)   │
└─────────────────────────────────────────┘
```
- Fewer than 5 redemptions: "Insufficient data — be the first to log a redemption."
- Trend alert: amber text, only shows when 30d median > 20% above prior 30d

**8. Ban reports feed**
```
┌─────────────────────────────────────────┐
│  Ban Reports                            │
│  [Published reports, newest first]      │
│  "Promoban — stopped receiving daily    │
│   bonus after 3 weeks" — Jan 12        │
│  [Submit a report →]                    │
└─────────────────────────────────────────┘
```
- Published reports only
- "Submit a report →" requires auth (inline OTP prompt if unauthenticated)
- Empty: "No ban reports for this casino. That's a good sign."

**9. State availability**
```
┌─────────────────────────────────────────┐
│  State Availability                     │
│  Available in 48 states                 │
│  ⚠️ Restricted in: WA, ID              │
│  [View full state map →]               │
└─────────────────────────────────────────┘
```
- Amber notices for `legal_but_pulled_out` or `restricted` states
- Gray factual note for `operates_despite_restrictions`

**10. Email capture** (unauthenticated only)
```
┌─────────────────────────────────────────┐
│  Stay informed about this casino.       │
│  [Email input] [Subscribe]              │
└─────────────────────────────────────────┘
```
- Same component as homepage, different copy and `source = 'casino_profile'`

**11. Affiliate CTA** (sticky bottom on mobile)
```
┌─────────────────────────────────────────┐
│  [Join Casino Name →]                   │
└─────────────────────────────────────────┘
```
- On mobile: sticky bottom bar when user scrolls past the header CTA
- Disappears if user has already joined (ledger entry exists)
- Same two-state logic

---

## Page: Casino Directory (`/casinos`)

### Layout

**Filter chips bar:**
```
[All] [Tier 1] [Tier 2] [Tier 3] | [Low Risk] [Med Risk] [High Risk] | [Live Games]
```
- Horizontally scrollable on mobile
- Multi-select: can activate Tier 1 + Low Risk simultaneously
- Active chip: filled blue. Inactive: outlined gray.

**Casino list:**
- Mobile: card list (1 column)
- Desktop: table view with sortable column headers

**Card format (mobile):**
```
┌─────────────────────────────────────────┐
│  [Casino Name →]          [Tier badge]  │
│  ★ 4.2  │  🟢 Low risk  │  Live games  │
│  Redemption: 24-48hr ACH               │
└─────────────────────────────────────────┘
```

**Table format (desktop):**
```
Casino Name  │ Tier │ Rating │ Risk    │ Live │ Redemption  │ SC/day
─────────────┼──────┼────────┼─────────┼──────┼─────────────┼───────
McLuck →     │  1   │  4.8   │ 🟢 Low  │  ✓   │ 24-48hr ACH │ ~400
Crown →      │  1   │  4.6   │ 🟡 Med  │  ✓   │ 1-3 days    │ ~300
```

Casino name is always clickable → fires affiliate two-state logic (profile page for joined users).

**Empty state after filtering:** "No casinos match your filters. Try broadening your search."

---

## Page: Redemption Tracker (`/redemptions`)

### Layout

**1. In-transit summary bar**
```
┌─────────────────────────────────────────┐
│  💰 In Transit: $1,245.00               │
│  3 pending redemptions                  │
└─────────────────────────────────────────┘
```

**2. Redemption list**

```
┌─────────────────────────────────────────┐
│  [Casino Name]              [Status]    │
│  $250.00 via ACH            Pending ⏳   │
│  Submitted Jan 12 · 3 days ago         │
│  Avg for this casino: 2.1 days         │
│  [Mark Received] [Cancel]              │
│                                          │
│  ⚠️ Processing times at [Casino] appear │
│  to be increasing recently (if active)  │
└─────────────────────────────────────────┘
```

**Status badges:**
- Pending: amber "⏳ Pending" pill
- Received: green "✓ Received" pill
- Cancelled: gray "Cancelled" pill
- Rejected: red "Rejected" pill

**Submit redemption form:**
- Trigger: "New Redemption" button at top of page
- Opens as modal on desktop, full-screen slide-up on mobile
- Fields in order:
  1. Casino (dropdown — only casinos in user's tracker)
  2. SC Amount (number input, required)
  3. USD Amount (number input, required — auto-calculates from SC × ratio as suggestion, user can override)
  4. Fees (number input, defaults to 0, labeled "Processing fees (USD)")
  5. Method (radio: ACH | Crypto | Gift Card | Other)
  6. Bank Note (text, optional, labeled "Reference note for your records")
  7. Notes (text, optional)
- **Confirmation step before submit:** "Submit $250.00 redemption from [Casino] via ACH?" with [Submit] and [Cancel]. This is a financial action — never one-tap.

**Empty state:**
```
┌─────────────────────────────────────────┐
│  No redemptions logged yet.             │
│                                          │
│  When you submit a redemption at any    │
│  casino, track it here to monitor       │
│  processing time and build community    │
│  speed data.                            │
│                                          │
│  [Log a redemption →]                   │
└─────────────────────────────────────────┘
```

---

## Page: Ledger (`/ledger`)

### Simple mode

**Summary bar:**
```
┌─────────────────────────────────────────┐
│  Total In: $4,230.00   Total Out: $890  │
│  Net P/L: +$3,340.00 ↑                 │
└─────────────────────────────────────────┘
```
- Positive P/L: green with up arrow
- Negative P/L: red with down arrow
- Zero: gray, no arrow

**Entry list:**
```
Date       │ Casino   │ Type      │ USD
───────────┼──────────┼───────────┼────────
Mar 14     │ McLuck   │ Daily     │ —
Mar 13     │ Crown    │ Redeem ✓  │ +$245
Mar 12     │ McLuck   │ Offer     │ -$49.99
```

**Filters:** Casino dropdown, Type dropdown, Date range picker
**Actions:** "Add Entry" button, "Export CSV" button

### Advanced mode

Everything in simple mode plus:
- SC balance per casino (collapsible per-casino breakdown)
- Full entry type menu (includes wager, winnings)
- `link_id` column visible for future session linking

**Mode toggle:** In settings, not on the ledger page itself. Switching mode doesn't change data — only display.

**Empty state:**
```
┌─────────────────────────────────────────┐
│  Your ledger is empty.                  │
│                                          │
│  Claim a daily bonus from your tracker  │
│  to get started — it'll show up here   │
│  automatically.                         │
│                                          │
│  [Go to tracker →]                      │
└─────────────────────────────────────────┘
```

---

## Page: Notifications (`/notifications`)

**List layout:**
```
┌─────────────────────────────────────────┐
│  Notifications          [Mark all read] │
│                                          │
│  ● ⚠️ Crown has stopped accepting       │
│    players in Ohio                       │
│    2 hours ago                          │
│                                          │
│  ○ 🚩 Elevated ban reports for McLuck   │
│    in the last 7 days                   │
│    Yesterday                            │
│                                          │
│  ○ ⏳ Redemption times at DingDing      │
│    appear to be increasing              │
│    3 days ago                           │
└─────────────────────────────────────────┘
```

- ● = unread (bold text, dot indicator)
- ○ = read (normal weight)
- Click → navigates to `action_url`
- "Mark all read" at top right

**Empty state:**
```
┌─────────────────────────────────────────┐
│  No notifications yet.                  │
│                                          │
│  You'll see alerts here when something  │
│  changes at a casino you track or in    │
│  a state you're subscribed to.          │
└─────────────────────────────────────────┘
```

---

## Page: State Map (`/states`)

**Map view (desktop):** Interactive US map with state coloring:
- Green: sweepstakes legal, casinos available
- Amber: legal with restrictions or recent pullouts
- Red: not legal
- Click state → navigates to `/states/[code]`

**List view (mobile):** Alphabetical state list with status badges and casino count.

**State detail (`/states/[code]`):**
```
┌─────────────────────────────────────────┐
│  Ohio                    Legal ✓        │
│  42 casinos available                   │
│                                          │
│  Recent alerts:                         │
│  ⚠️ Crown stopped accepting Jan 5      │
│                                          │
│  Available casinos:                     │
│  [Casino list with tier badges]         │
│                                          │
│  [Email capture: "Get alerts for Ohio"] │
│                                          │
│  [Report a state availability change →] │
└─────────────────────────────────────────┘
```

---

## Page: Getting Started (`/getting-started`)

**Long-form editorial layout.** Single column, max 720px width, generous line spacing. This is a blog-post-style reading experience.

```
# How to Start Earning with Sweepstakes Casinos

[Step 1: What are sweepstakes casinos?]
[Prose explanation — plain English, no jargon]

[Step 2: Understanding SC and GC]
[Prose explanation with concrete examples]

[Step 3: Your first day at MyPrize]
[SCREENSHOT: MyPrize signup page]
3a. Sign up at MyPrize using the link below
3b. Complete ID verification (don't skip this)
3c. Purchase the first welcome offer
[SCREENSHOT: Welcome offer purchase screen]
3d. Open [TODO: wash game] and play at [bet size]
[SCREENSHOT: Playthrough tracker]
3e. Check your playthrough progress
3f. Submit your first redemption
[SCREENSHOT: Redemption submission]
3g. Wait for payment (MyPrize: instant or same-day)
[SCREENSHOT: Money received]

[Step 4: Key terms you'll hear]
Playthrough, wash, SC-to-USD ratio — defined in context

[Step 5: Common mistakes]
- Don't skip ID verification
- Don't try to redeem before playthrough completes
- Don't chase losses

[Step 6: What's next]
- Add more casinos to your tracker
- Check daily for reset timers
- Watch for community intel deals

[AFFILIATE CTA]
┌─────────────────────────────────────────┐
│  Ready to start?                        │
│  [Sign up at MyPrize →]                │
│  Use code: goobspins                    │
└─────────────────────────────────────────┘
```

- Screenshots are placeholders (`[SCREENSHOT: description]`) at build time
- Affiliate CTA at bottom is the conversion moment — make it prominent
- TOC/progress indicator on the right side (desktop) showing which step the reader is on

---

## Page: Settings

**Route:** `/settings`

Accessible from user dropdown menu.

```
┌─────────────────────────────────────────┐
│  Settings                               │
│                                          │
│  Timezone: [America/New_York ▼]         │
│  Home State: [Ohio ▼]                   │
│  Ledger Mode: ○ Simple  ● Advanced      │
│                                          │
│  State Subscriptions:                   │
│  ✓ Ohio  ✓ Indiana  [+ Add state]      │
│                                          │
│  Notifications:                         │
│  ✓ Push notifications (browser)         │
│                                          │
│  [Save changes]                         │
│  [Log out]                              │
└─────────────────────────────────────────┘
```

---

## Admin Panel Screens

### Admin Dashboard (`/admin`)

```
┌─────────────────────────────────────────────────────────────────┐
│  SweepsIntel Admin                                              │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Flags    │ │ Reports  │ │ Intel    │ │ Suggested│          │
│  │   12     │ │    5     │ │    8     │ │    3     │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                  │
│  Recent Flags (last 10):                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🟢 McLuck flash sale — 40% off VIP til midnight          ││
│  │    "Publish to intel feed"  [Act] [Dismiss]  2h ago       ││
│  │ 🟡 LoneStar — 3 ban reports in 24h                       ││
│  │    "Monitor ban situation"  [Act] [Dismiss]  4h ago       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  System Health:                                                 │
│  Active users (7d): 142  │  Pending redemptions: 23            │
│  Ban upticks active: 2    │  Intel items pending: 8             │
└─────────────────────────────────────────────────────────────────┘
```

- Queue count cards are clickable → navigate to respective queue
- Keyboard shortcuts active on this page: `1-4` to jump to queues

### Discord Intel Queue (`/admin/discord`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Discord Intel Queue (8 pending)        Sort: Confidence ▼     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🟢 HIGH  │ Flash Sale  │ McLuck                           ││
│  │ "McLuck VIP flash sale: $49.99 → 106K GC + 53 Free SC"   ││
│  │ Confidence: Tier 1 confirmed + 5 positive reactions       ││
│  │ Expires: 11h remaining                                     ││
│  │ [▼ Raw content]                                            ││
│  │ [Publish]  [Discard]                    Ingested 25m ago  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🟡 MED   │ Promo Code  │ Crown                            ││
│  │ "Crown SPRING25 — 25% off first purchase"                 ││
│  │ Confidence: 2 Tier 2 reports corroborating                ││
│  │ Expires: ~48h (default, no explicit end)                  ││
│  │ [▼ Raw content]                                            ││
│  │ [Publish]  [Discard]                    Ingested 1h ago   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Keyboard: [a] Publish  [d] Discard  [n] Next  [p] Previous   │
└─────────────────────────────────────────────────────────────────┘
```

- Confidence badge: colored pill matching the confidence level
- `confidence_reason` text shown below the title — this is what enables 5-second review
- Raw content collapsed by default (expandable)
- Expiry countdown in amber/red when < 2 hours
- Keyboard shortcut bar visible at bottom

### Admin Casino Edit (`/admin/casinos/[id]`)

Full-form layout with sections:

1. **Basic info:** Name, slug, tier, rating, parent company
2. **Risk profile:** Promoban risk, hardban risk, family ban, fund confiscation, triggers, notes
3. **Playthrough:** Multiplier, notes
4. **Daily bonus:** Description, SC average seed
5. **Redemption:** Speed, fees, minimum
6. **Reset time:** Streak mode, time, timezone
7. **Affiliate:** Has link, URL, type, verified
8. **Providers:** Checkbox grid of all `game_providers`
9. **Game availability:** Table of `casino_game_availability` rows with inline edit
10. **Cross-wash:** Has live games, direction, notes (premium)
11. **Meta:** Source, excluded, notes

Save button at bottom + "Flag for review" button.

---

## Interaction patterns

### Auth prompt (inline, not wall)

When an unauthenticated user attempts a protected action (claim, submit report, react to intel):

```
┌─────────────────────────────────────────┐
│  Save your progress — enter your email  │
│  [email@example.com] [Send code →]     │
│  We'll send a 6-digit code. No password│
│  needed, ever.                          │
└─────────────────────────────────────────┘
```

- Appears inline where the action was attempted (not a page-level modal)
- After email entry → OTP code screen replaces the email field:
```
┌─────────────────────────────────────────┐
│  Check your email for a 6-digit code    │
│  [_ _ _ _ _ _]                          │
│  [Verify →]                             │
│  Didn't get it? [Resend]               │
└─────────────────────────────────────────┘
```
- After successful verify → complete the original action automatically (user doesn't have to re-tap "Claim")

### Toast notifications

For transient feedback (claim success, error, report submitted):
- Appears top-center, slides down
- Auto-dismisses after 3 seconds
- Error toasts: red background, persist until dismissed
- Success toasts: green border, auto-dismiss

### Loading states

- Full page load: centered spinner + "Loading..." text
- Component load (tracker, ledger): skeleton placeholders matching the eventual layout shape
- Button actions: button shows spinner, disabled state, text changes to "Saving..." / "Submitting..."

### Error states

- API error: toast with retry action
- Network offline: persistent top banner "You're offline. Changes will sync when connected."
- 404: "Page not found. [Go to tracker →]"

---

## Responsive breakpoints

- `sm`: 640px — mobile landscape
- `md`: 768px — tablet
- `lg`: 1024px — desktop
- `xl`: 1280px — wide desktop (admin panel)

**Key responsive behaviors:**
- Tracker: always single column, all breakpoints
- Casino directory: card list on mobile, table on desktop (md+)
- Casino profile: structured data stacks to single column on mobile
- Admin panel: requires md+ viewport. Show "Admin panel requires a larger screen" on mobile.
- Getting Started: single column all breakpoints, max-width 720px centered

---

## Changelog

- **v1 (2026-03-14):** Initial UI specification. Covers all MVP pages, component states, empty states, interaction patterns, responsive behavior, admin panel layouts.
