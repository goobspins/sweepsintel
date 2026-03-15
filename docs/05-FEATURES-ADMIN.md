# SweepsIntel — Admin & Intel Features

_Features 12-14: Volatility reports (post-MVP), Admin panel, Discord intel feed_

### 12. Community game volatility reports — POST-MVP

**This feature is deferred from the MVP build.** The database schema (`game_volatility_reports` table, `game_providers` table, `casino_live_game_providers` junction) is already defined above and MUST be created with the initial schema migration — do not skip the tables. But do NOT build the submission form, admin review queue tab, aggregation logic, or casino profile display table at MVP.

**Why deferred:** At launch there will be zero reports. The volatility table would show "Insufficient data" on every casino profile, adding noise to the UI with no value. Build this when the platform has 50+ active tracker users generating enough reports for consensus to be meaningful.

**What to build now:** Nothing. The `VolatilityTable.tsx` component, `VolatilityReportForm.tsx`, `volatility-submit.ts` endpoint, `volatility.ts` lib, and the "Volatility Reports" tab in the admin reports queue are all deferred. Keep them in the file structure as comments or placeholders so the architecture is visible, but do not implement.

**What to build later (reference spec for future Codex session):**

**Submission** (auth required — account required, same as all community reports):
- User can submit a volatility report for any game at any casino they have ledger entries for
- Form fields: game name (text + optional provider dropdown), volatility (Low / Medium / High), optional community RTP observation (labeled explicitly: "This may not reflect the casino's current settings"), optional notes
- One report per user per game per casino per 7 days (prevent flooding — enforced by `reporter_user_id`)
- Trust score snapshot stored with report
- All reports enter manual review queue (`is_published = false`). Confirmation message to user: "Your report has been submitted and will be reviewed before publishing. Thank you."

**Display** (public on casino profile):
- Per casino, show a table: Game Name | Provider | Community Volatility | Reports
- Consensus volatility = weighted mode (weight = trust_score_at_report). Show "Disputed" if no clear consensus.
- Show "X community reports" count
- Bold disclaimer above table: "Volatility is community-reported and weighted by reporter trust. RTP values shown reflect community observations only — casinos can and do change game settings without notice."

**Trust scoring** (simple implementation):
- Default trust_score = 1.0 for all users
- Trust score updates are manual (admin-adjustable) initially
- Future: auto-adjust based on report corroboration patterns

---

### 13. Admin panel (admin auth required)

Route prefix: `/admin`

This is the Collective operations interface. It must be fast — Dylan is a 5-second reviewer, not a full-time editor.

**Design principles for the admin UI:**
- **Queue-driven.** The dashboard is a single screen showing everything that needs attention. Dylan opens it, sees counts, works through queues top to bottom. Zero navigation required for the 80% case.
- **One-click actions.** Every queue item has approve/reject/dismiss as direct action buttons on the row — no "open detail page then find the button." Destructive actions (publish a report, fire an alert) get a lightweight confirmation modal, but the modal must pre-fill all required fields from context. Dylan should never have to re-type information that's already in the flag.
- **AI summaries front and center.** For discord-sourced flags, the `ai_summary` is the first thing displayed — not buried below raw content. Dylan reads the one-liner, glances at the proposed action, and clicks. Raw `flag_content` is expandable for full context but collapsed by default.
- **Keyboard shortcuts for power use.** `a` = approve/act, `d` = dismiss, `n` = next item, `p` = previous. The queue should be navigable without a mouse once Dylan enters the flow. This is what makes 5-second reviews possible.
- **Inline editing.** Casino tier, rating, promoban_risk, redemption_speed_desc are editable directly in the casino list — click the cell, type, tab to save. No "open edit page" round-trip for common field updates.
- **Batch processing.** When multiple flags of the same type stack up (e.g., 5 ban reports for the same casino), allow selecting multiple and acting on them as a batch. One publish action for all 5 rather than 5 individual clicks.
- **Visual priority.** Flag types should be color-coded or badge-styled so Dylan can visually scan the queue for high-priority items (state pullouts > ban surges > redemption slowdowns > data anomalies). Discord-sourced flags with AI summaries should be visually distinct from raw auto-detected flags.

**Dashboard** (`/admin`):
- Queue counts: pending ban reports, pending state reports, pending reset suggestions, pending volatility reports, unresolved admin flags, unpublished discord intel items, **user-suggested casinos pending review** (count of `casinos` rows where `source = 'user_suggested'`)
- Recent admin flags (last 10 — shows ai_summary when present, raw flag_content otherwise)
- Recent discord intel items pending review
- Recent state pullout alerts
- System health: active users (7d), pending redemptions count, ban uptick active count

**Casino CRUD** (`/admin/casinos`):
- Table of all casinos with edit links. **Filter tabs: Admin-curated | User-suggested | Excluded**
- "New Casino" form with all fields from the `casinos` schema
- Inline quick-edit for tier, rating, promoban_risk, redemption_speed_desc
- Live game providers management (checkboxes to assign providers to casino)
- **Game availability management:** Below the provider checkboxes, show a table of `casino_game_availability` rows for this casino. Columns: Game Name | Provider | Type | Cross-wash? | Confidence | Positive/Negative signals | Status. Admin can: add games manually (name, provider, type, cross-wash flag), edit status (available/removed), toggle `is_cross_wash_relevant`. Most rows will be auto-populated by the monitoring pipeline — admin's job is verification and correction, not data entry. Show a count badge on the casino edit page: "12 games tracked (3 cross-wash)" for quick reference.
- Per-casino: one-click "flag for review" — creates an `admin_flags` row with `source = 'manual'` and `flag_type = 'data_anomaly'` so it surfaces in the flags queue before publishing
- **User-suggested casino actions:** For `source = 'user_suggested'` rows, show: tracked-by count ("3 users tracking this"), **"Build Profile"** button (promotes to `source = 'admin'`, opens full edit form), **"Exclude"** button (sets `is_excluded = true`). This is the affiliate expansion demand signal — high tracked-by counts tell Dylan which casinos to prioritize for affiliate enrollment.

**Admin flags queue** (`/admin/flags`):
- List of pending `admin_flags` rows, sorted by created_at
- Each flag shows: source, flag_type, casino/state if relevant, raw `flag_content`, and `ai_summary` + `proposed_action` when present
- **Discord-sourced flags will have `ai_summary` and `proposed_action` populated** by the monitoring script at ingest time. When the monitoring pipeline POSTs to `/api/discord/ingest` with `admin_flag: true`, the payload includes a one-line AI summary and a proposed action (e.g., "LoneStar redemptions slowing — 3 reports in 24h" / "Update redemption_speed_desc + monitor"). Dylan reads these to make fast decisions. **Nothing auto-acts — Dylan's click is always required.**
- **Flags from automated detection** (ban uptick, trend signals) are created by in-app logic with no AI summary — admin reads raw `flag_content` directly for these. No background LLM workers. No async AI processing of user-submitted reports.
- Action buttons: **Act** (triggers relevant action — opens modal to confirm the action), **Dismiss** (mark dismissed with optional note)

**Act button behavior per `flag_type`:**

| flag_type | Act button opens | On confirm |
|---|---|---|
| `potential_pullout` | Modal: confirm casino + state + new status dropdown | Updates `casino_state_availability`, fires pullout alert flow |
| `ban_surge` | Modal: pre-filled casino name, checkboxes for "Update promoban_risk tier" and "Create ban_uptick_alert" | Updates casino risk field and/or creates alert row |
| `redemption_slowdown` | Modal: pre-filled casino, current vs. flagged redemption speed | Updates `redemption_speed_desc` on casino if admin agrees the speed has changed |
| `data_anomaly` | Modal: shows flag content, free-text "admin action taken" field | Logs the admin's note, marks flag resolved. No automated side effect — this is a catch-all. |
| `new_casino_signal` | Modal: "Create casino profile?" with pre-filled name from flag content | Creates `casinos` row with `source = 'admin'`, opens edit form for full profile build |
| `premium_content_candidate` | Modal: "Save to premium content queue?" with tag/category selector | Saves to a `premium_content_notes` text field on the flag (future: premium content system). At MVP, this just bookmarks it for Dylan's reference. |
| `positive_redemption` | No modal. Single-click dismiss with auto-note: "Noted — positive signal" | Marks flag dismissed. No database side effect. This is informational. |
| `game_availability_change` | Modal: shows casino + game name + signal counts, "Confirm removal?" toggle | If confirmed: updates `casino_game_availability.status = 'removed'`. If not: dismisses flag, signal counts persist for future monitoring. |
| `broken_platform_feature` | Modal: pre-filled casino, free-text "status update" field | Logs note on flag. No automated side effect — Dylan monitors manually and updates casino profile if needed. |

Flags with unknown `flag_type` values (the field is VARCHAR, not an enum — the monitoring pipeline may introduce new types): show raw `flag_content` with a generic "Dismiss with note" action only. No automated side effects.

**Community reports queue** (`/admin/reports`):
- Tabs: Ban Reports | State Reports | Reset Suggestions (Volatility Reports tab is post-MVP — do not build)
- Each row: submission content, reporter (hashed IP + user_id if authed), flagged status, publish/reject buttons
- Reject: requires no additional action
- Publish (ban report): sets `is_published = true`, appears on casino profile
- Publish (state report with `legal_but_pulled_out` status): triggers pullout alert flow
- Publish (reset suggestion): updates `casinos.reset_time_local` + `casinos.reset_timezone`
- All publish/reject actions log to `admin_flags` with `source = 'manual'` for audit trail

**State availability management** (`/admin/states`):
- Per-casino-per-state status table
- Inline update: dropdown to change status → on save if new status is `legal_but_pulled_out`, auto-fires pullout alert

**Provider state availability management** (`/admin/states` — second tab or section):
- Per-provider-per-state status table (from `provider_state_availability`)
- Inline update: dropdown to change provider status for a state
- **Cascade action:** When a provider's status changes to `restricted` for a state, the admin panel shows a confirmation modal: "This affects [N] casinos using [Provider] in [State]: [casino list]. Update all affected casino state availability?" On confirm:
  1. For each casino linked via `casino_live_game_providers` to this provider in this state: update `casino_state_availability.status` if appropriate (e.g. if the casino's only live game provider in that state is the one leaving, mark it `legal_but_pulled_out`)
  2. Create ONE `state_pullout_alerts` row referencing the provider (not per-casino)
  3. Create ONE `user_notifications` row per affected user in that state (via `user_state_subscriptions`) — state-level notification, not per-casino. Message: "⚠️ [Provider] has stopped serving [State] — this affects [casino list]"
  4. The notification is state-scoped per Principle 1: all state subscribers see it regardless of which casinos they track
- **Provider data is primarily user-reported at MVP.** Admin seeds initial known data, but most provider state availability updates will come from community reports. Users in affected states are the first to notice when a provider disappears — they just can't confirm whether it's a state-level issue or an account-level issue. Multiple reports from different users in the same state confirming the same provider loss is the signal. Consider adding `provider_id` as an optional field on `state_availability_reports` so users can report provider-level exits directly.

**Notification controls** (`/admin/notifications`):
- Compose system notification (title, message, action_url, user segment: all users / users in state / users at casino)
- Send → creates `user_notifications` rows for target segment
- Email blast option (for severe events): generates draft email, requires explicit send confirmation

**Discord intel queue** (`/admin/discord`):
- List of pending `discord_intel_items` rows (`is_published = false`), newest first
- Each row shows: item_type badge, casino if relevant, title, content preview, expires_at, **confidence badge** (color-coded: high=green, medium=yellow, low=orange, unverified=gray), **confidence_reason** text
- Sort: confidence descending (high first), then created_at descending within each confidence tier. High-confidence items are fast approvals; low/unverified need more review.
- Actions: **Publish** (sets `is_published = true`, sets `published_at`) | **Discard** (delete or soft-delete)
- No AI processing. Admin reads raw sanitized content, glances at confidence + reason, and decides.

---

### 14. Discord intel feed (three surfaces)

Published `discord_intel_items` surface in three places, each with different scope and auth requirements.

---

**Surface A: Tracker "My Alerts" section (private, auth required)**

Rendered inside the `/tracker` React component, **between Section 1 (your casinos) and Section 2 (casinos to add)**. On mobile: full-width block. On desktop: full-width block between sections (not a sidebar — the tracker is a single-column layout on all breakpoints for scannability). Shows published, non-expired intel items **filtered to casinos in the user's `user_casino_settings`**. This is the primary intel surface for logged-in users.

- Query: `WHERE casino_id IN (SELECT casino_id FROM user_casino_settings WHERE user_id = $1) AND is_published = true AND (expires_at IS NULL OR expires_at > NOW())`
- If no items for the user's casino list: show nothing (no empty state needed — absence is fine).
- Items are ordered newest-first.
- This is deliberately narrow. If you don't track DimeSweeps, you never see a DimeSweeps promo. Keeps the tracker signal-to-noise high. Also makes it viable to publish intel for niche casinos with small user bases — only their trackers see it.
- Items with `casino_id = null` (general alerts not tied to a casino) show here for all logged-in users.

**Surface B: Casino profile page (public, no auth required)**

If published, non-expired intel items exist for a specific `casino_id`, show them in a "Community Intel" callout on that casino's `/casinos/[slug]` profile page. Visible to anyone, including anonymous visitors. Gives a reason to return to profile pages and demonstrates the platform is active.

**Surface C: Homepage teaser (public, no auth required)**

Show the last 3 published non-expired items regardless of casino. Type badge (Free SC / Playthrough Deal / Alert) + title + casino name if relevant + "Posted X hours ago." Not personalized — this is a marketing surface showing the platform has live signal. Casual visitors see proof of value before signing up.

---

**Display rules (all surfaces):**
- Hide items where `expires_at < NOW()` even if `is_published = true`
- No Discord attribution anywhere. Source label is "Community Intel" or "Today's Alerts." The platform is the source, not Discord.
- Show `confirm_count` and `dispute_count`. Label adapts by `item_type`: promo codes / flash sales → "✓ N confirmed working · ✗ N disputed"; state intel → "✓ N users confirmed in their state"; general tips → "✓ N found this helpful."
- Auth required to react. Reaction button: "✓ Confirm" | "✗ Dispute." One reaction per user per item, changeable.

**Verification mechanic:** Community confirm/dispute turns admin-curated intel into community-validated intel over time. A promo code with 12 confirms is actionable. One with 0 confirms and 3 disputes is a warning signal.

**No public submission form.** Admin-curated only. Not a community report system.

**API ingest endpoint** (`POST /api/discord/ingest`): API-key gated (bearer token, key in env as `DISCORD_INGEST_KEY`).

Accepts a JSON body:
```json
{
  "item_type": "flash_sale",           // required — one of the item_type enum values
  "casino_slug": "mcluck",             // optional — endpoint resolves to casino_id; if no match, stores raw name in casino_name_raw
  "title": "McLuck VIP flash sale...", // required
  "content": "...",                    // required — must already be sanitized (no usernames, no Discord attribution)
  "source_channel": "bearcave_chat",   // required — 'free_sc' | 'bearcave_chat'
  "expires_at": "2026-03-14T23:59:00Z", // optional — omit for tips/warnings
  "admin_flag": true,                  // optional — if true, ALSO creates an admin_flags row (not instead of)
  "ai_summary": "McLuck running 40% off VIP packages until midnight", // required when admin_flag: true
  "proposed_action": "Publish to intel feed + update flash_sale expiry", // required when admin_flag: true
  "confidence": "high",               // required — 'high' | 'medium' | 'low' | 'unverified'
  "confidence_reason": "Tier 1 confirmed + 5 positive reactions" // required — one-line explanation for Dylan's fast review
}
```

**New fields — `confidence` and `confidence_reason`:** Every item from the monitoring pipeline carries a confidence assessment. `confidence` is one of `'high'`, `'medium'`, `'low'`, `'unverified'`. `confidence_reason` is a human-readable one-liner explaining how confidence was determined (e.g., "Single Tier 2 report, no corroboration yet" or "3 independent confirmations + 6 positive reactions"). These are stored on the `discord_intel_items` row and displayed in the admin queue to support Dylan's fast-review workflow. **See `MONITORING-SPEC-v1.md` in this directory for the full confidence scoring model, trust tier architecture, signal filtering rules, and two-stage pipeline design.**

**Casino slug resolution:** Endpoint looks up `casino_slug` in `casinos.slug`. If matched: sets `casino_id`. If not matched: leaves `casino_id = null`, stores the slug string in `casino_name_raw` for admin to manually link.

**`admin_flag: true` behavior:** Creates BOTH a `discord_intel_items` row AND an `admin_flags` row. The intel item lands in the admin publish queue. The flag lands in the flags queue with the ai_summary and proposed_action for Dylan's fast-approve flow. These serve different purposes and are not mutually exclusive. For `platform_warning` and `state_intel` types, `admin_flag` should almost always be `true` — they require a platform action AND may be worth publishing once that action is taken.

All items created as `is_published = false`. Admin reviews both queues and publishes independently.

**Game availability signal endpoint** (`POST /api/discord/game-availability`): Same API-key gate as the main ingest endpoint (`DISCORD_INGEST_KEY`).

Accepts a JSON body (array — multiple signals per scan):
```json
[
  {
    "casino_slug": "chanced",               // required — resolved to casino_id same as main ingest
    "game_name": "Iconic 21 BJ",            // required
    "provider_slug": "evolution",            // optional — resolved to provider_id
    "game_type": "blackjack",               // optional — 'blackjack' | 'roulette' | 'baccarat' | 'slots' | 'dice' | 'other'
    "signal_type": "positive",              // required — 'positive' | 'negative'
    "is_cross_wash_relevant": true           // optional — defaults to false. Opus sets this when the context involves cross-wash discussion.
  }
]
```

**Endpoint behavior per signal:**
1. Resolve `casino_slug` → `casino_id`. If no match, skip signal (game availability without a matched casino is useless).
2. UPSERT into `casino_game_availability` on `(casino_id, game_name)`.
3. If positive: increment `positive_signal_count`, update `last_confirmed_at`. If row was `status = 'removed'`, flip to `status = 'unconfirmed'` and reset `negative_signal_count = 0`.
4. If negative: increment `negative_signal_count`, update `last_negative_at`.
5. Recalculate `confidence` per the scoring rules in the schema.
6. If `negative_signal_count >= 2`: auto-create `admin_flags` row with `flag_type = 'game_availability_change'`.

---
