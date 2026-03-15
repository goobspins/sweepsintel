# SweepsIntel — Private Features (Auth Required)

_Features 5-9: Daily tracker, Redemption tracker, Ledger, Auth, Notifications_

### 5. Daily tracker (private, auth required)

Route: `/tracker`

The tracker is a React component (`client:load`). Two distinct sections on the same page.

---

**Section 1: Your Casinos (top)**

Casinos where the user has a `user_casino_settings` row with `removed_at IS NULL`. These are "their" casinos. This includes both `source = 'admin'` (curated, has a profile) and `source = 'user_suggested'` (user added a casino not in our directory). Both appear in Section 1. User-suggested casinos show the casino name and claim controls but no profile link (no profile exists yet).

**Adding a casino not in the directory:** Users can type any casino name into a search/add field in the tracker. If the name matches an existing `casinos` row (case-insensitive name lookup), use that row. If no match, create a new `casinos` row with `source = 'user_suggested'`, `has_affiliate_link = false`, `is_excluded = false`, and a generated slug. Then create the `user_casino_settings` row. Do not duplicate — check for existing `user_suggested` rows with the same name before creating a new one. The admin dashboard will surface these for review (see Admin panel spec).

**Bulk import:** Users can upload a `.txt` or `.csv` file with casino names (one per line) to add multiple casinos to their tracker at once. `POST /api/tracker/bulk-import` accepts a file upload, parses each line, and runs the same add-casino logic per name: match existing → create `user_casino_settings`; no match → create `user_suggested` casino + `user_casino_settings`. Return a summary: "Added 8 casinos to tracker. 3 matched existing profiles, 5 are new suggestions pending review." This is critical for power users who track 10-20+ casinos — adding them one by one is a bounce-worthy activation barrier. Skip blank lines and duplicates. If a casino is already in the user's tracker (`removed_at IS NULL`), skip it silently.

**Default sort:** Available-now casinos float to the top (reset has passed, not yet claimed today). Below those: ascending time-to-reset (soonest expiring first). Claimed-today casinos sink to the bottom with a ✓. This ensures the most urgent action is always at top.

**User can drag-reorder** their casinos to override the default sort. Drag order persists in `user_casino_settings.sort_order`. When sort_order is set for at least one casino, use sort_order as primary key (with available-now still floating above locked rows). A "Reset sort" option restores default time-based sort.

**Per casino row:**
- Casino name (clickable → casino profile, not affiliate link for joined users)
- Reset countdown (see logic below)
- Streak counter if `casinos.has_streaks = true`
- Today's claim status

**Claim interaction — simple mode:**
A single "Claimed" button. Tapping it does three things atomically via `POST /api/tracker/claim`:
1. Creates a `daily_bonus_claims` row (`claim_type = 'daily'`, `sc_amount = null`)
2. Creates a `ledger_entries` row (`entry_type = 'daily'`, `sc_amount = null`, `usd_amount = 0`, `source_claim_id` = the new claim ID)
3. Resets the timer and increments the streak

**The ledger entry in step 2 is critical.** It closes the affiliate gate for this casino (see affiliate two-state logic). Without it, the user could claim daily for weeks and still see affiliate links for a casino they obviously joined. Do not skip the ledger entry because SC is null.

No SC entry required from the user. The button label changes to "✓ Claimed" and the row moves to the bottom of the section.

**Claim interaction — advanced mode:**
"Claimed" button → immediately shows an inline entry below the row (no modal, no page navigation):
- SC amount number field (empty, not prefilled)
- "No SC today" button

Both paths commit the claim, reset the timer, continue the streak. "No SC today" logs `sc_amount = 0`. Entering a number and tabbing/blurring commits it. No explicit save button — the action is the commitment. After commit, inline collapses and the row moves to the bottom of the section with "✓ Claimed" label.

**The "No SC today" case is important:** The user DID claim — their clock resets, their streak continues — they just received zero SC. This is NOT the same as failing to claim (which would produce a gap in `daily_bonus_claims` and break the streak for casinos with `has_streaks = true`). The distinction must be tracked, not inferred.

**Streak break detection:** For casinos with `has_streaks = true`, if the gap between `last_claim.claimed_at` and the next available window exceeds 48 hours (generous buffer), the streak counter resets to 0. Display this on the row.

---

**Section 2: Casinos to Add (bottom)**

Admin-curated casinos (`source = 'admin'`, `is_excluded = false`) where the user has NO active `user_casino_settings` row (i.e., no row exists OR the row has `removed_at IS NOT NULL`). A casino the user previously removed reappears here — soft-delete returns it to the temptation shelf. These are the temptation shelf. User-suggested casinos and excluded casinos never appear here — only the platform's curated directory.

**Sort:** Highest expected daily SC at top. Use real aggregated data where it exists, admin-set seed as fallback:
```sql
COALESCE(
  AVG(dbc.sc_amount) FILTER (WHERE dbc.sc_amount > 0),
  c.daily_bonus_sc_avg
) AS sort_sc
FROM casinos c
LEFT JOIN daily_bonus_claims dbc ON dbc.casino_id = c.id
GROUP BY c.id
ORDER BY sort_sc DESC NULLS LAST
```
`daily_bonus_sc_avg` is the admin-seeded value at casino intake. Once real claim data flows in, actual averages override it automatically. No manual maintenance required long-term.

**Per card:**
- Casino name (clickable → casino profile)
- `casinos.daily_bonus_desc` (platform-level text like "~200-400 SC/day")
- Two CTAs:
  - **"Join"** — fires affiliate click AND creates `user_casino_settings` row atomically → moves casino to Section 1. Use this CTA when `has_affiliate_link = true`. **Implementation: `POST /api/tracker/add-casino` with `{ casino_id, fire_affiliate: true }`.** The `add-casino` endpoint handles both actions in a single request: logs the click to `clicks` (with `referrer_source = 'tracker_suggestions'`), creates the `user_casino_settings` row, and returns the `affiliate_link_url` for client-side redirect. This must be atomic — if the settings row creation fails, the click should not be logged. Do not split this into two separate API calls from the client.
  - **"Add to tracker"** — creates `user_casino_settings` row without firing affiliate click → moves casino to Section 1. **Implementation: `POST /api/tracker/add-casino` with `{ casino_id, fire_affiliate: false }`.** Same endpoint, different behavior. Show this as secondary link text ("Already a member? Add to tracker") below the Join button, or as the primary CTA when `has_affiliate_link = false`.

---

**Reset countdown logic — use Luxon, no alternatives:**

Replicate `computeCasinoResetSummary` from `Casino/web/lib/v2/casinoReset.ts` in `src/lib/reset.ts`.

- `streak_mode = 'fixed'`: parse `reset_time_local` as `HH:MM`, use `reset_timezone` as IANA zone. Compute today's reset moment. If current time is past it, next reset is tomorrow at the same time. If before it, next reset is today. Luxon handles DST automatically.
- `streak_mode = 'rolling'`: next available = `last_claim.claimed_at + 24 hours`. If no prior claim: "Available now."
- Unknown mode: "Reset time unknown — check the casino site." Link to submit a reset time suggestion.

User timezone from `user_settings.timezone`. Never infer from IP.

**Tracker membership vs. affiliate gate — these are separate:**
- `user_casino_settings` row = "this casino is in my tracker" (Section 1 membership)
- `ledger_entries` EXISTS = "I've transacted here" (affiliate CTA suppression gate)
A user can be in Section 1 (tracker member) without having any ledger entries (e.g. they just joined but haven't logged anything). The affiliate link should still be suppressed once they tap "Join" — log the click in `clicks` at that moment as the attribution event.

---

### 6. Redemption tracker (private, auth required)

Route: `/redemptions`

- List of all redemptions, filterable by status, sortable by date
- Submit Redemption modal: casino, SC amount, USD amount, fees, method, bank note, notes
- Per pending redemption: casino, amounts, method, submitted date, elapsed time indicator, average redemption time for this casino (from public stats)
- **Redemption slowdown alert:** If the casino's recent 30d median redemption time shows a >20% increase (trend signal from `redemption-stats.ts`), show a critical alert banner on this page next to the pending redemption: "⚠️ Processing times at [Casino] appear to be increasing recently." Passive display only — no push notification.
- Actions: **Mark Received**, **Cancel**, **Reject**
- "In Transit" balance at top: total USD pending

---

### 7. Ledger (private, auth required)

Route: `/ledger`

**Simple mode** (`user_settings.ledger_mode = 'simple'`):
- Shows all ledger entries
- Summary: total USD in (redemptions), total USD out (offer purchases), net P/L
- Does NOT show SC balance prominently — just as informational
- Manual entry form only shows USD-facing entry types (adjustment, offer, redeem)
- Prompt to daily claims is "log SC amount" — stores it but doesn't require it for P/L

**Advanced mode** (`user_settings.ledger_mode = 'advanced'`):
- Full SC balance display per casino
- SC balance = sum of ledger sc_amount - pending redemptions sc_amount
- Session linking via `link_id` (future: wash session logs)
- Full entry type menu including wager/winnings

**Both modes:**
- Per-casino P/L breakdown
- Paginated (20/page), filterable by casino, type, date range
- CSV export
- P/L formula: `net_pl_usd = SUM(usd_amount)` where usd_amount is positive for money in, negative for money out. Nothing else.
- No tax fields, no tax math, no tax language. P/L is money in minus money out.

Mode can be toggled in settings. Switching preserves all data — only display changes.

---

### 8. Auth (email OTP)

Routes: `POST /api/auth/request-otp`, `POST /api/auth/verify-otp`, `POST /api/auth/logout`

6-digit OTP, 15-minute expiry. Store hashed in `auth_sessions.otp_token_hash`. On verify: set `session_token` cookie (HttpOnly, Secure, SameSite=Strict), 90-day expiry. **Session expiry is rolling:** on every authenticated request, update `auth_sessions.last_active_at = NOW()`. Session is valid as long as `last_active_at` is within 90 days. This means active users never get logged out. Inactive users (90+ days since last visit) must re-authenticate. Follow security best practices but lean generous — users shouldn't be re-prompted constantly.

**Post-login redirect:** After successful OTP verification, redirect to `/tracker`. This is the user's "home screen." All authenticated sessions start here. The nav should visually indicate `/tracker` as active.

On first verify: prompt for home state → populates `user_state_subscriptions`. **Also on first verify:** check `email_waitlist` for a matching email. If found, update the row: `converted_user_id = [new user_id]`, `converted_at = NOW()`. This links the waitlist capture to the converted account for funnel analytics (which capture source converts best).

Admin check: middleware reads `user_settings.is_admin` — admin routes reject non-admin sessions.

**OTP prompt strategy — two distinct entry points:**

1. **Private tools (tracker, ledger, redemptions):** Do NOT show a login wall upfront. Let the user browse freely. The auth prompt triggers when the user first attempts to enter data — for example, when they tap "Claimed" on a casino row or start a ledger entry. Show an inline nudge at that moment: "Make sure your data gets saved — just enter your email." This captures intent while removing friction for casual browsers.

2. **Public / info pages:** Show a lightweight newsletter-style email capture prompt (non-blocking — a banner or aside, not a modal). Copy: something like "Get state pullout alerts and ban intel in your inbox." This pipelines casual visitors toward conversion without forcing them into full auth. Captured emails before OTP verification are stored separately as `email_waitlist` (simple table: email, captured_at, source) — they are not `user_settings` rows yet. Do NOT create a user account from a newsletter capture alone.

---

### 9. In-app notification panel (private, auth required)

Route: `/notifications`
Nav: bell icon with unread count badge (red dot if > 0)

- List of all `user_notifications` for the user, sorted by newest first
- Unread items visually distinct
- Click-through via `action_url` to relevant page
- "Mark all as read" button
- Notification types displayed:
  - `state_pullout`: "⚠️ [Casino] has stopped accepting players in [State]"
  - `ban_uptick`: "🚩 Elevated ban reports for [Casino] in the last 7 days"
  - `system`: generic platform messages
- **`redemption_slow` is NOT a notification type.** It does NOT create `user_notifications` rows. It is a passive visual banner only — displayed on casino profile pages and the redemptions page when the trend signal is active. See Feature #6 for display rules.

**Notification creation rules — two scoping principles:**

**Principle 1: State-level alerts are universal within that state.** If you live in Ohio, you see every state-relevant signal for Ohio — pullouts, provider exits, legal changes — regardless of which casinos you track. These are defensive intel. You don't need to play at a casino to care that it's leaving your state or that a provider is exiting.

**Principle 2: Casino-level signals are scoped to tracker members.** Promo codes, flash sales, ban upticks, redemption slowdowns — these only display for users who have that specific casino in their `user_casino_settings`. If you don't track DimeSweeps, DimeSweeps intel is invisible to you. This keeps individual feeds clean, makes it viable to publish niche casino intel (only the 4 people tracking it see it), and creates a natural incentive to expand your tracker — your intel surface area grows with your casino list.

**Per notification type:**

- **State pullout** → `user_notifications` for ALL users with `user_state_subscriptions.state_code = [state]`. Universal within state. Does not filter by casino tracker. Same logic applies to provider state exits (e.g. Pragmatic Play pulling from MI affects cross-wash at every casino using Pragmatic in MI — notify all MI subscribers).

- **Ban uptick** → `user_notifications` for users who have that casino in `user_casino_settings` (tracker members). NOT ledger-based. If you're actively tracking a casino, you care about ban activity there. If you stopped tracking it, you don't need the noise.

- **Redemption slow** → NOT a push notification at MVP. Instead, show a visual critical alert banner on the casino profile page, the redemptions page (for pending redemptions at that casino), and the admin dashboard. The trend signal from `redemption-stats.ts` creates an `admin_flags` row — Dylan reviews and decides whether to take action. Users see the alert passively when they visit relevant pages. No email, no notification fan-out. Keep it simple.

- **Discord intel items (promo codes, flash sales, free SC, playthrough deals, general tips)** → these are NOT push notifications. They display on the user's `/tracker` page in a personalized "My Alerts" section, filtered to casinos in the user's `user_casino_settings`. If you don't track DimeSweeps, a DimeSweeps flash sale is invisible to you. This also means small/niche casinos can have intel items published without cluttering the feed for users who don't play there. **Exception:** Items with `casino_id = null` (general alerts not tied to a specific casino, e.g. "March Madness flash sales across all platforms") display for all logged-in users.

- **System notifications** → created manually by admin, targeted by segment (all users / state / casino).

---
