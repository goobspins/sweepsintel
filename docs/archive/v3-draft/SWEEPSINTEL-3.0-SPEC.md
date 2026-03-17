# SweepsIntel 3.0 — Intelligence Layer Spec (DRAFT v2)

> Status: Draft v2. Feature-complete. Pending: Dylan's review of open questions and final Codex handoff prep.
> Last updated: 2026-03-16
> Prerequisite reading: SWEEPSINTEL-VISION.md, SWEEPSINTEL-2.0-SPEC.md
> This document covers features that build on the 2.0 foundation. It does NOT redefine anything from 2.0 — it extends it.

---

## What 2.0 Built

The daily driver: dashboard with momentum bar, casino claim list, discovery sidebar, ledger, My Casinos, Reports, purchase tracking, dark theme, admin panel. The tool layer and the discovery layer are functional.

Key infrastructure that 3.0 builds on: the Discord monitoring pipeline feeds `discord_intel_items` (with `item_type`, `casino_id`, `is_published`, `expires_at`, `confidence`). The `discord_intel_reactions` table exists for confirm/dispute voting but is currently cosmetic. The admin panel curates what gets published. Casino profiles exist with tier, PB risk, redemption data.

What's missing is the intelligence layer — the thing that makes SweepsIntel more than a ledger with affiliate links.

## What 3.0 Adds

Five systems that turn raw data into user-facing intelligence:

1. **Dashboard redesign** — three-zone layout with swappable discovery queue
2. **Intel Feed** — a dedicated signal page that surfaces actionable community intelligence
3. **Casino Health Cards** — My Casinos page rebuilt around real-time health indicators and risk-weighted exposure
4. **Community Intelligence** — user-submitted signals, trust-weighted visibility, "worked/didn't work" voting with real consequences
5. **Contributor Recognition** — earned tiers (Newcomer → Scout → Insider → Operator) that reward quality signal submitters with visible badges and elevated weight

Plus the infrastructure to connect them: signal classification, notification routing, source sanitization, and (future) the AI question-answering interface.

---

## Source Sanitization (Non-Negotiable)

All intelligence in SweepsIntel must feel native — community-sourced by SweepsIntel's own community, never scraped or attributed to external platforms. This is a hard business requirement, not a style preference.

**Rules:**
- No Discord usernames, channel names, server names, or any indication that Discord exists in the pipeline. Ever.
- No external platform attribution of any kind. No "via Reddit", no "from Bearcave", no "BartHarleyJarvis says..."
- Signals from the Discord pipeline are sanitized on ingest: strip usernames, strip channel references, strip any metadata that reveals the source platform
- The `source` column in the DB tracks provenance for admin/debugging purposes (`discord`, `admin`, `user`), but this value NEVER surfaces to users
- All signals appear in the UI as native SweepsIntel community intel. The source label is "Community Intel" or simply nothing — signals don't need a byline
- User-submitted signals show the user's display name by default, OR "Community member" if the user chooses to post anonymously. Users pick per-submission. This creates a natural mix of named and anonymous signals in the feed.
- Discord-sourced signals ALWAYS show as "Community member" — they blend naturally into the anonymous pool. No personality accounts, no bots. Nobody wonders why some signals are anonymous because anonymous signals are a normal, expected part of the feed.
- Admin-created signals show as "SweepsIntel Team" (or similar neutral label). These carry implicit authority without revealing it's a single person.
- If a signal's raw content contains a Discord username or external reference (e.g., "saw @promoking420 post in #deals"), the ingest pipeline must strip or rewrite it before publishing

**Why this matters:** SweepsIntel's credibility depends on being THE source, not a mirror of someone else's community. If users see that intel is scraped from Discord, the product feels like a wrapper — not a platform. The intelligence layer only works if users believe THEY are the community generating and validating this data.

---

## Signal Classification

All intelligence flowing through SweepsIntel falls into one of three layers. These classifications determine where signals surface and how urgently they're presented.

### Layer 1: Passive Context (Reference)

**What it is:** Slow-moving factual data about a casino. Tier, reset mechanics, wash game tips, PB risk level, redemption methods, getting-started guides.

**How it changes:** Updated by admin or KB sync. Changes on a scale of days/weeks, not hours.

**Where it lives:**
- Casino profile pages (primary home — the deep reference)
- Inline badges/tooltips on dashboard casino rows (one-tap access)
- Compact reference in My Casinos expanded cards

**Key design requirement:** Casino names throughout the app are ALWAYS links to the profile page. Plus a small info icon on dashboard casino rows that shows a quick-reference tooltip (tier, PB risk, redeem speed) without navigating away. Users must never have to hunt for reference data.

---

### Layer 2a: Portfolio Health (Defensive Intelligence)

**What it is:** Signals that indicate risk to the user's money or access. Redemption holds, ban waves, platform instability, closures.

**How it changes:** Hourly/daily. Triggered by community reports, Discord intel items with `item_type` in (`platform_warning`, `state_intel`), and aggregated redemption timing data.

**Where it lives:**
- My Casinos page (primary home — health dots, risk badges, expanded detail)
- Dashboard casino rows (small health dot next to casino name, linking to My Casinos)
- Notification bell (push for critical alerts)

**Source data:**
- `discord_intel_items` where `item_type = 'platform_warning'` and `is_published = true`
- Aggregated redemption stats: if a casino's median redemption time this week is 2x its 30-day average, that's an amber signal
- Community voting ratios on published warnings ("experiencing this" / "not affected" — see Voting Semantics in Feature 2)
- Manual admin escalation (flags something as critical via admin panel)

---

### Layer 2b: Money-Making Signals (Offensive Intelligence)

**What it is:** Time-sensitive opportunities with real dollar value. Deal drops, promo codes, free SC events, bonus multipliers, wash game strategies, rolling offer mechanics.

**How it changes:** Minutes/hours. These are ephemeral — a flash sale that expires in 4 hours, a promo code that works for today only.

**Where it lives:**
- Intel Feed page (primary home — the full scrollable signal feed)
- Notification bell + push notifications (alerts for high-value signals)
- Dashboard under-the-fold area (latest signal preview card)

**Source data:**
- `discord_intel_items` where `item_type` in (`free_sc`, `promo_code`, `flash_sale`, `playthrough_deal`) and `is_published = true`
- Admin-created signals (Dylan spots something the pipeline missed)
- User-submitted signals (see Community Intelligence Layer)

**This is the product differentiator.** No other site in the niche delivers structured, time-sensitive deal intelligence to users. The Discord communities have the raw data but it's noisy, unstructured, and you have to be watching at the right moment. SweepsIntel catches it, structures it, and delivers it.

---

### Layer 3: Actionable Prompts (Synthesized Intelligence)

**What it is:** Recommendations derived from combining Layers 1, 2a, and 2b with the user's personal data. "You should do X because Y."

**Examples:**
- "You have $500 in SC at Casino X, which has been holding redeems for 5+ days. Consider redeeming now."
- "Based on the Modo rolling offers today, buying the full stack at $8.50/10 would give you 120 SC at 18% margin."
- "You're tracking 3 casinos. Adding Chanced and Zula could earn you an estimated $4.50 more per day in dailies."
- "Your claim streak is at 14 days — don't break it today."
- "Casino Y just dropped a 2x daily bonus event. You're due to claim there in 45 minutes."

**Where it lives:**
- Dashboard under-the-fold CTA area (the "you could be earning more" prompt)
- My Casinos expanded cards (per-casino recommendations)
- Push notifications (high-value time-sensitive prompts)
- Intel Feed (synthesized summaries mixed with raw signals)

---

## Feature 1: Dashboard Redesign

### Three Zones

**Page identity:** The Dashboard answers ONE question: **"What do I need to do right now?"** Everything on this page serves the daily routine. Momentum bar, claim statuses, DUE badges, timers. It should feel like a checklist — you open it, see what's green and what's not, go claim.

#### Zone 1: Momentum Strip (full width, top)
Current implementation. Thin collapsed strip with progress bar, percentage, goal amount, Daily/Weekly toggle. Expands on click. No changes needed from current 2.0 state.

#### Zone 2: Side-by-Side (main content)

Two columns, equal visual weight. Both pinned to the same height — determined by whichever column is taller. The page scrolls, not either column individually. No overflow scrolling on either side.

**Left column (default): Casino Dashboard**
- "Dashboard" header + tracked casino count
- Search bar for adding casinos
- Casino rows with claim status, modes, timers
- Compact mode toggle

**Right column (default): Discovery Queue**
- "CASINOS YOU'RE MISSING" header
- 1-2 spotlight-quality cards with real data (only show cards that have sufficient intel to be compelling — see data quality threshold below)
- Dead space is better than filler cards. If only one casino has good enough data, show one card and leave the rest empty.
- The discovery queue is curated, not a dump.

**Data quality threshold for discovery cards:**
A casino qualifies for the discovery queue if it has at least 2 of these 5 data points populated:
1. `daily_bonus_desc` is not null
2. `redemption_speed_desc` is not null
3. `promoban_risk` is not null and not 'unknown'
4. `has_live_games` is true
5. `has_affiliate_link` is true

Below threshold: don't show the card. Quality over quantity.

**User customization:**
- **Swap sides:** Users can swap left/right columns (dashboard on right, discovery on left). Persists in localStorage `si-layout-swap`.
- **Collapse discovery:** Users can click a collapse arrow to hide the discovery column, making the dashboard full-width. This persists for the browser session only (sessionStorage). Resets on new session / tab close. The collapse arrow should be subtle — a small chevron at the top of the discovery column.

#### Zone 3: Under the Fold (full width)

The CTA and expanded discovery area. This is where the revenue engine does its explicit work.

**Section 1: Earnings prompt**
A calculated, personalized call to action:
- "You're tracking {N} casinos. Adding these {M} could earn you an estimated ${X.XX} more per day in daily bonuses."
- Calculation: for each untracked casino with `daily_bonus_sc_avg` > 0, sum `daily_bonus_sc_avg * sc_to_usd_ratio`. Show the aggregate estimated daily value.
- If the calculation yields $0 (no data), use a simpler prompt: "There are {N} casinos available in your state you haven't signed up at yet."
- If no home_state is set: "Set your state in Settings to see personalized recommendations."

**Section 2: Full casino card grid**
All recommended casinos (untracked, available in state, not excluded). Compact card format.
- Filterable: by tier (S/A/B/C), by "has daily bonus", by "has affiliate link", by "has live games"
- Sortable: by tier (default), by estimated daily value, by redemption speed, by PB risk
- Cards show: name, tier badge, pitch (from fallback hierarchy), Sign Up button (if affiliate link exists)
- "Show more" pagination or infinite scroll

**Section 3: Latest signal preview (if Intel Feed exists)**
A single card showing the most recent published intel signal. Teaser format:
- Signal title + casino name + time ago
- "View all signals →" link to Intel Feed page
- Signal type badge (color-coded, same as Intel Feed)

---

## Feature 2: Intel Feed Page

**Page identity:** The Intel Feed answers ONE question: **"What's happening with my casinos?"** Signal cards, color-coded badges, timestamps — it should feel like a live stream. You check it a few times a day to see if anything's changed.

A dedicated page for browsing all intelligence signals. This is where Layer 2b lives in full depth.

**Route:** `/intel` or `/signals`

**Nav position:** Between "Dashboard" and "My Casinos" in the tool nav group. This is a core product page, not a secondary feature.

### Feed Scope

**Critical design decision:** The Intel Feed defaults to showing signals ONLY for casinos in the user's daily tracker. This is not a global news feed — it's YOUR intelligence about YOUR casinos.

You track a casino or you don't. If you track it, you see all signal types for it. No per-casino filter granularity — that's a layer of complexity that doesn't earn its rent.

### Feed Layout

**Header:** "Intel Feed" with subtitle "Intelligence for your tracked casinos"

**Filter bar (horizontal, sticky below nav):**
- Casino filter: checkboxes of user's tracked casinos (all checked by default). No "All casinos" global option — if you want intel on a casino, add it to your tracker first.
- Type filter (global, not per-casino): All | Deals | Promo Codes | Free SC | Warnings | Strategy
- Time filter: Last 24h | Last 7d | Last 30d | All time

**Feed items:**
Each signal is a card with:
- Item type badge (color-coded): green for free_sc, blue for promo_code, amber for flash_sale, purple for playthrough_deal, red for platform_warning, gray for general_tip
- Attribution line: user display name, OR "Community member" (anonymous/discord), OR "SweepsIntel Team" (admin). Plus contributor tier badge if applicable (see Feature 7: Contributor Recognition).
- Casino name + tier badge (linked to profile)
- Signal title
- Signal content — truncated to 2 lines, expandable
- Timestamp ("2 hours ago", "Yesterday at 6:41 PM")
- Expiry indicator if `expires_at` is set ("Expires in 3h 20m" in amber, or "Expired" in red muted)
- Community validation: "✓ 12 worked · 4 didn't work" (see Voting Semantics below)
- "Worked for me" / "Didn't work" buttons for logged-in users

### Expired Signals

Signals with `expires_at` in the past:
- Remain in the feed with a muted "Expired" badge (red, low opacity). Not hidden, not deleted.
- Moved below active signals in default sort order.
- Excluded from the "Last 24h" time filter if expired more than 24h ago (but visible in "Last 7d" and beyond).
- Do NOT count toward casino health computation after expiry.
- Voting remains open on expired signals (users may still report "worked" / "didn't work" for a grace period).

### Voting Semantics: "Worked / Didn't Work" Not "True / False"

**Critical design decision.** The voting buttons are NOT confirm/dispute in the truth sense. They are "worked for me" / "didn't work for me." This distinction matters because many signals in the sweepstakes casino space are conditionally true — a deal might be real but only available to non-promobanned users, or only in certain states, or only for accounts under a certain age.

Example: "Crown Coins giving free $50 SC" — legitimate signal, but Crown Coins promobans aggressively in feast/famine cycles. Most users are promobanned at any given time. They'll hit "didn't work" because it genuinely didn't work for them, not because the signal was false. A binary true/false system would collapse a valid signal and punish the submitter.

**How voting works:**
- "✓ Worked for me" — this signal was accurate for my situation
- "Didn't work" — I couldn't access/use this, regardless of reason
- Both counts display: "✓ 12 worked · 4 didn't work"
- A high "didn't work" count relative to "worked" is useful information — it tells users this signal might be conditional (promoban, state-restricted, expired, etc.) — but it does NOT collapse the signal or trigger "disputed" treatment
- Signals only collapse or get disputed treatment when the ratio is overwhelmingly negative (near-zero "worked" with high "didn't work" after meaningful time has passed). Exact thresholds TBD through real-world tuning.

**Trust score impact:**
- Submitter trust score only penalizes when a signal is overwhelmingly "didn't work" with near-zero "worked" — actual bogus signal
- A signal with 12 "worked" and 4 "didn't work" is healthy and conditional, no penalty
- A signal with 0 "worked" and 8 "didn't work" after several hours is probably bogus — trust score decreases

**For warnings (platform_warning type):** The language adapts. Instead of "worked / didn't work," warning signals show "Experiencing this" / "Not affected." Same mechanics, different framing. "⚠ 6 experiencing this · 2 not affected."

### Signal Detail Expansion

Clicking a signal card expands it inline to show:
- Full content text
- Related signals (other recent signals about the same casino)
- Quick actions: "Add to tracker" (if casino not tracked), "Go to profile", "View in My Casinos"
- Confidence indicator (high/medium/low/unverified — derived from trust score + vote ratio, not from source)

### AI Q&A Interface (P-Future)

At the top of the Intel Feed, a search/question bar:
- "Ask about any casino or strategy..."
- Queries the KB (casino_intel table + discord_intel_items) using semantic search
- Returns a sourced answer with citations: "Based on 3 recent reports, Chanced's redemption time has increased from 24h to 48-72h this week. [Source: Intel #1234, #1235, #1240]"
- Users can ask natural language questions about their casinos and get answers derived from community intelligence.

**Open questions:**
- [ ] Semantic search implementation: vector embeddings on intel items? Or keyword/category matching first?
- [ ] How to handle stale intel in Q&A responses — decay tiers should weight recent data higher
- [ ] Rate limiting on Q&A queries (cost control)

---

## Feature 3: My Casinos — Health Cards

**Page identity:** My Casinos answers ONE question: **"Am I safe?"** Health dots are the first thing your eye hits. If everything's green, you close the tab. If something's amber or red, you expand to understand why. It should feel like a monitoring status board.

Rework My Casinos from a static P/L table into a card-based health dashboard. One glance answers: "Am I safe?" Expand for everything else.

### Card Design (Collapsed — Default State)

Each casino is a card showing:
- **Casino name** + tier badge (linked to profile)
- **Health indicator** (large, left side — this is the first thing your eye hits):
  - 🟢 Healthy — no issues detected
  - 🟡 Watch — minor signals, nothing actionable yet
  - 🔴 At Risk — active reports of holds/bans + user has exposure
  - 🔴⚠️ Critical — multiple confirmed reports + significant exposure (pulsing animation)
- **SC Balance** (your exposure at this casino)
- **Net P/L** (green if positive, red if negative)
- **Last activity** ("2 hours ago", "3 days ago")
- **Active alert count** (if any) — small badge: "2 alerts"

Cards are compact. Scannable. The entire My Casinos page should be graspable in 3 seconds.

**Default sort:** Critical → At Risk → Watch → Healthy, then by exposure (highest SC balance first within each health tier). Your biggest risks surface to the top.

### Card Design (Expanded — On Click)

Clicking a card expands it inline (accordion style, one card expanded at a time) to reveal:

**Section 1: Financial Summary**
- SC Balance | Total Invested (USD) | Total Redeemed (USD) | Net P/L
- Last 10 ledger entries (compact list)
- "View in Ledger →" link (filtered to this casino)

**Section 2: Health Detail**
- Health status explanation: WHY is this casino amber/red? List the specific signals:
  - "3 users reported redemption delays >5 days (last 48h)"
  - "Platform warning — holding redeems for review (reported 2 days ago, 6 experiencing this)"
  - "Your pending redemption has been waiting 7 days (casino average: 2 days)"
- Each signal is clickable → links to the Intel Feed filtered to that casino
- If healthy: "No active warnings. Last checked: [timestamp]"

**Section 3: Casino Quick Reference (Layer 1)**
- Tier, PB risk, redemption speed, daily bonus, live games
- Personal notes (editable, auto-save on blur)
- Reset mode + timer info

**Section 4: Quick Actions**
- "Claim Daily" → opens dashboard with this casino highlighted
- "Log Purchase" → opens purchase form pre-filled with this casino
- "Submit Redemption" → opens redemption form
- "Visit Casino" → external link (website_url fallback chain)
- "View Profile" → casino profile page

### Health Indicator Logic

### Health Computation Model

Health is **computed, not set.** A background job runs every 30–60 minutes, evaluates current inputs for each casino, and derives the status fresh. No manual "resolve" action, no state transitions to manage. The computation is stateless — it looks at current data and outputs a status.

**Inputs (what feeds the computation):**
- Published `platform_warning` intel items for this casino (count + recency + vote ratios)
- Aggregated redemption stats: if median redemption time this week is significantly above the casino's 30-day average
- Community voting ratios on recent warnings ("experiencing this" vs "not affected")
- Promoban risk level changes (if a casino's PB risk was recently escalated)
- Admin override (see below — takes absolute precedence when set)

**Output levels:**
- 🟢 Healthy: no meaningful negative signals
- 🟡 Watch: early signals, nothing actionable yet
- 🔴 At Risk: active confirmed problems + user has exposure
- 🔴⚠️ Critical: severe confirmed issue + significant user exposure (pulsing animation)

**Exact thresholds for each level are TBD — they require real-world tuning.** Start conservative (lean toward green). Dylan compares flagged casinos against domain knowledge and adjusts thresholds until the system "feels right." The computation code should expose threshold constants that can be adjusted without redeploying.

**Recency decay curve (how health recovers naturally):**
Warnings don't disappear the moment they expire. They decay:
- Active (not expired): 100% weight
- Expired 0–24h ago: 75% weight
- Expired 24–48h ago: 50% weight
- Expired 48–72h ago: 25% weight
- Expired 72h+: 0% weight (fully decayed, no longer contributes)

This means health recovers gradually without anyone flipping a switch. A casino that was red will drift through amber back to green over 2-3 days as warnings age out. The specific decay percentages are tunable.

**Personal health modifier (per-user):**
Global health is the same for everyone — it's community-derived. But each user's view is modified by their personal exposure:
- If YOU have a pending redemption that's overdue at a casino with global "watch" status, YOUR health indicator for that casino escalates to "at risk"
- Someone with $0 exposure at a casino having issues sees the global status (maybe amber). Someone with $1500 pending sees red.
- Personal modifier only escalates, never reduces. You never see a healthier status than the global one.

**Admin override:**
Admin can manually pin any casino's health status from the admin panel. When an override is active:
- The pinned status displays regardless of what the computation produces
- The computation continues running in the background, so when the override is lifted, the casino snaps to whatever the current data says
- Overrides are visible in a dedicated admin panel section: **"Active Health Overrides"** — a list showing casino name, pinned status, reason, who set it, when, and a "Clear Override" button
- This prevents overrides from being forgotten — if you pinned 5 casinos to red during a crisis, you can see all 5 in one place weeks later and decide which to release

---

## Feature 4: Notification System Expansion

The bell icon in the nav already exists. Expand it into a proper notification center.

### Notification Types

| Type | Trigger | Urgency |
|---|---|---|
| Casino warning | `platform_warning` published for a tracked casino | High |
| Redemption overdue | User's pending redemption exceeds 2x casino average | High |
| Deal alert | `flash_sale` or `promo_code` published for tracked casino | Medium |
| Free SC drop | `free_sc` published for tracked casino | Medium |
| Streak reminder | User hasn't claimed all dailies and reset window closing | Low |
| Health change | A tracked casino's health status changed (e.g., green → amber) | Medium |
| New intel | General intel published for tracked casino | Low |

### Delivery

- **In-app bell:** All notification types. Unread count badge. Click to see feed.
- **Push notifications (future):** High and Medium urgency only. User opt-in per type.
- **Email digest (future):** Daily or weekly summary of signals for tracked casinos. User-configurable frequency.

---

## Feature 5: AI Casino Q&A (P-Future)

A conversational interface where users can ask natural language questions about casinos and get answers sourced from the SweepsIntel knowledge base.

**Location:** Search bar at top of Intel Feed page + accessible from casino profile pages.

**Examples:**
- "What's the best wash game at Chanced right now?"
- "Is MyPrize safe to redeem from?"
- "How does the Modo rolling offer work?"
- "Which casinos have the lowest promoban risk?"
- "What's the average redemption time at Crown Coins this month?"

**Implementation approach (open):**
- [ ] Semantic search over `casino_intel` + `discord_intel_items` + casino profile data
- [ ] RAG (retrieval-augmented generation) using the KB as context
- [ ] Answers must cite sources: "Based on intel #1234 from 2 days ago..."
- [ ] Answers must respect decay — stale intel should be flagged: "Note: this information is from 3 weeks ago and may be outdated"
- [ ] Rate limited: N queries per user per day (cost control)

---

## Admin Panel Additions (3.0)

The existing admin panel gets three new sections to support the intelligence layer.

### Active Health Overrides

A dedicated view showing all casinos where admin has manually pinned a health status.

**Table columns:** Casino name | Pinned status (color-coded) | Reason | Set by | Set at | "Clear Override" button

This prevents overrides from being forgotten. If 5 casinos were pinned to red during a crisis, they're all visible in one place weeks later. Clearing an override snaps the casino to whatever the background computation currently says.

### Signal Creation

Admin can create signals directly from the admin panel. These appear in the Intel Feed attributed to "SweepsIntel Team."

**Form:** Casino (searchable dropdown) | Signal type (deal, promo code, free SC, warning, strategy tip) | Title | Details | Expiry (optional) | "Publish" button

Admin-created signals enter at high confidence by default. They don't go through trust scoring — they're authoritative.

### Live Signal Tracker

A view of all currently active signals (not expired, not collapsed) across the platform. Admin's operational dashboard for community intelligence.

**Table columns:** Signal title | Casino | Type badge | Source (discord/admin/user) | Author (visible to admin even if user posted anonymously) | Worked/Didn't Work counts | Status (active/conditional/likely_outdated) | Age | Expiry countdown

**Filters:** By source | By casino | By type | By status | "Show expired" toggle

**Actions per signal:** Force-collapse | Force-expire | Edit content | Pin to top of feed (for urgent warnings)

**Weekly digest view:** Summary card at the top: "This week: {N} signals submitted, {N} worked, {N} disputed, {N} expired. {N} user submissions. {N} users flagged (trust score < 0.20)." Links to flagged users for trust score review.

---

## Database Changes

### New Tables

```sql
-- User notification preferences
CREATE TABLE user_notification_preferences (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES user_settings(user_id),
  push_warnings BOOLEAN DEFAULT TRUE,
  push_deals BOOLEAN DEFAULT TRUE,
  push_free_sc BOOLEAN DEFAULT TRUE,
  push_streak_reminders BOOLEAN DEFAULT FALSE,
  email_digest_frequency VARCHAR(20) DEFAULT 'none', -- 'none' | 'daily' | 'weekly'
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Casino health snapshot (computed, refreshed periodically)
CREATE TABLE casino_health (
  casino_id INT PRIMARY KEY REFERENCES casinos(id),
  global_status VARCHAR(20) NOT NULL DEFAULT 'healthy', -- 'healthy' | 'watch' | 'at_risk' | 'critical'
  status_reason TEXT, -- human-readable explanation
  active_warning_count INT DEFAULT 0,
  redemption_trend DECIMAL(6,2), -- ratio of this week's median to 30-day median (1.0 = normal)
  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  admin_override_status VARCHAR(20), -- if set, overrides computed status
  admin_override_reason TEXT,
  admin_override_at TIMESTAMPTZ
);
```

### New Tables (Community)

```sql
-- Vote log for signal voting ("worked" / "didnt_work")
CREATE TABLE signal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id INT NOT NULL REFERENCES discord_intel_items(id),
  user_id VARCHAR(255) NOT NULL REFERENCES user_settings(user_id),
  vote VARCHAR(12) NOT NULL CHECK (vote IN ('worked', 'didnt_work')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (signal_id, user_id)  -- one vote per user per signal, changeable via upsert
);

-- Feed filter preferences removed. You track a casino or you don't.
-- Type filtering (Deals/Warnings/etc) is applied client-side per session, not persisted.
```

### Modified Tables

**user_settings:**
- +`layout_swap BOOLEAN DEFAULT FALSE` (dashboard layout preference)
- +`trust_score DECIMAL(3,2) DEFAULT 0.50` (0.00 = suppressed, 0.50 = new user default, 1.00 = highly trusted. Updated by background job. Invisible to users.)
- +`contributor_tier VARCHAR(30) DEFAULT 'newcomer' CHECK (contributor_tier IN ('newcomer', 'scout', 'insider', 'operator'))` — visible earned rank. Evaluated by background job. Operator tier is admin-granted only.
- _(premium flag deferred — not in 3.0 scope)_

**discord_intel_items:**
- +`source VARCHAR(20) DEFAULT 'discord' CHECK (source IN ('discord', 'admin', 'user'))` — provenance for admin/debugging only, never surfaces to users
- +`submitted_by VARCHAR(255) REFERENCES user_settings(user_id)` — null for discord signals
- +`is_anonymous BOOLEAN DEFAULT FALSE` — user chose to post anonymously. Discord signals always true. Admin signals always false (show as "SweepsIntel Team").
- +`worked_count INT DEFAULT 0` — denormalized from signal_votes
- +`didnt_work_count INT DEFAULT 0` — denormalized from signal_votes
- +`signal_status TEXT DEFAULT 'active' CHECK (signal_status IN ('active', 'conditional', 'likely_outdated', 'collapsed'))` — driven by vote ratios

### New Indexes

```sql
CREATE INDEX idx_casino_health_status ON casino_health(global_status);
CREATE INDEX idx_discord_intel_casino_published ON discord_intel_items(casino_id, is_published, created_at DESC);
CREATE INDEX idx_discord_intel_source ON discord_intel_items(source);
CREATE INDEX idx_signal_votes_signal ON signal_votes(signal_id);
-- user_feed_preferences removed (track or don't track, no per-casino filter granularity)
```

---

## API Summary

### New

```
-- Intel Feed
GET  /api/intel/feed?casino_id=&type=&since=&limit=
GET  /api/intel/signal/:id
POST /api/intel/submit { casino_id, signal_type, title, details, expires_at? }
POST /api/intel/vote/:id { vote: 'worked' | 'didnt_work' }

-- Casino health
GET  /api/casinos/health
GET  /api/casinos/:id/health-detail
POST /api/admin/casino-health-override { casino_id, status, reason }

-- Admin
POST /api/admin/signal { casino_id, signal_type, title, details, expires_at? }
GET  /api/admin/community-digest?period=7d  -- weekly digest data

-- Notifications
GET  /api/notifications/preferences
POST /api/notifications/preferences { ... }

-- Future
POST /api/ai/ask { question } -- P-future
```

### Modified

```
GET  /api/casinos/my-stats -- add health_status, active_warnings, personal_risk_score
GET  /api/tracker/status -- add health_dot per casino
```

---

## Priority Order

1. **Dashboard redesign** (three-zone layout, swap, collapse) — immediate, builds on 2.0
2. **My Casinos health cards** (card UI, expand/collapse, financial summary, quick actions) — immediate, mostly frontend
3. **Casino health computation** (health indicator logic, casino_health table, admin override) — requires tuning
4. **Intel Feed page** (signal browsing, filtering, type badges) — surfaces existing data
5. **Community signals** (user submissions, trust-weighted visibility, structured form, voting wired to consequences) — ships with Intel Feed
6. **Contributor recognition** (tier evaluation job, badge rendering, profile tier display) — ships with or shortly after community signals
7. **Notification expansion** (bell feed, push for warnings) — infrastructure
8. **AI Q&A** (semantic search, RAG, citation) — P-Future

Items 1-2 can ship without 3-8. Item 3 is needed before health dots show real data (use promoban_risk as a placeholder until then). Items 4-5 are tightly coupled — user submissions need the Intel Feed to land in. Item 6 depends on item 5 having real data (needs submissions to evaluate). Item 7 can ship independently. Item 8 is a future phase.

---

## Open Questions

- [ ] Health indicator inputs and thresholds (see Feature 3 open questions)
- [ ] Monetization model — deferred from 3.0. Resolve before 4.0.
- [ ] Intel Feed route: `/intel` or `/signals`?
- [ ] AI Q&A implementation: vector search vs keyword + category matching?
- [ ] Should the under-the-fold CTA area be collapsible/dismissible?
- [ ] Notification push infrastructure: web push vs email-first?
- [x] ~~How does health recovery work after warnings resolve?~~ → Resolved: stateless computation with decay curve. See Decision #21.
- [ ] Should household members share health alerts? (If spouse's casino goes red, do you see it?)

---

## Feature 6: Community Intelligence Layer

### Background: What 2.0 Designed (P-Future)

The 2.0 spec laid out the full community intelligence architecture under P-Future. It was deferred because the user base didn't exist yet to generate meaningful signal. The core design remains sound and 3.0 should build on it, not reinvent it.

**The Content Trust Pipeline (from 2.0):**
```
Community chatter (bearcave, Reddit)
  → KB processor "Loom" (extracts, structures, assigns decay tier)
    → Structured storage (casino_intel table)
      → Product surfaces it (profiles, spotlight, cards, guides)
        → Community rates it "Vigil" (thumbs up/down per intel point)
          → Ratings adjust confidence scoring
            → Low-confidence entries decay faster / get flagged
              → Dylan optionally intervenes at any point "Axiom"
```

**Per-intel-point rating mechanics (from 2.0, revised in 3.0):**
The 2.0 spec used binary confirm/dispute language. 3.0 reframes this as "worked for me" / "didn't work for me" — because signals in this space are often conditionally true (promoban status, state restrictions, timing). See "Voting Semantics" in Feature 2 for full rationale.
- "Worked" votes reinforce confidence
- "Didn't work" votes are informational, not punitive — a high ratio signals conditionality, not falsehood
- Only overwhelmingly negative ratios (near-zero "worked") trigger disputed treatment or trust score penalties
- Pattern detection: many "didn't work" entries across a casino → stale intel flag on the whole casino
- Community can dispute, not censor. Nothing gets deleted by votes.

**Confidence promotion (from 2.0):**
Intel that proves itself earns longevity. If a T1 entry (7-day volatile) survives two KB processor cycles without contradiction AND receives community upvotes, it promotes to T2. T2 entries with sustained validation can promote to T3. Full lifecycle: born pending → confirmed by processor → rated by community → promoted if validated / disputed if challenged / decayed if stale → archived with reason.

**Admin role: oversight, not labor.** Weekly digest: "3 entries disputed this week, 2 casinos flagged for stale intel." Confirm, override, or ignore. System keeps running either way.

### What 2.0 Explicitly Did NOT Include

The 2.0 admin spec (05-FEATURES-ADMIN.md) says: **"No public submission form. Admin-curated only. Not a community report system."** This was deliberate — the pipeline was admin → product, not user → product. Community participation was limited to rating existing intel, not creating new intel.

### What 3.0 Builds

3.0 activates the community layer in two ways: making existing voting mechanics consequential, and opening user-submitted signals.

#### Wiring Community Voting Into Real Consequences

The voting system exists but is cosmetic. In 3.0 it becomes functional:
- Vote ratios feed directly into casino health computation (Feature 3). High "didn't work" / "experiencing this" counts on warning signals contribute to health status changes.
- Community consensus auto-escalates health status without admin intervention (thresholds TBD through real-world tuning — the 2.0 placeholders were illustrative, not final)
- Overwhelmingly negative signals (near-zero "worked" with high "didn't work") get disputed visual treatment (reduced opacity, "likely outdated" label). This is a high bar — conditional signals with mixed ratios stay visible.
- At an even higher threshold, signals collapse entirely — still accessible via "show disputed" toggle, never deleted. Community can dispute, not censor.
- Pattern detection: many "didn't work" entries across a casino triggers a stale-intel flag on the whole casino's profile

This requires zero new infrastructure. It's activating what's already built.

#### User-Submitted Signals (ships with 3.0)

Users can submit signals directly: "Hey, McLuck has a 2x daily right now" or "Chanced is holding my redeem for 6 days." This reverses the 2.0 "admin-curated only" decision. The key design constraint: signals must go live fast enough to be useful, but not so unfiltered that the feed becomes noise.

**The solution: trust score controls entry volume, not a moderation queue.**

Everyone can submit. No premium gate — gating submissions behind premium kills the free-user signal volume, which is the entire point of the sensor network. Instead, the user's trust score determines how the signal enters the feed:

**Low trust (new users, no track record):**
- Signal goes live immediately — no queue, no waiting
- Enters with low visual weight: small card, muted styling, "unverified" badge
- It's in the feed but it's not prominent
- Community upvotes can promote it to normal visibility quickly

**Medium trust (active users, positive submission track record):**
- Signal enters at normal visual weight, no "unverified" badge
- Standard card in the feed

**High trust (veteran users, strong positive track record):**
- Signal enters at elevated visual weight
- May trigger notification delivery for users who follow that casino (when notification system ships)

**Trust score inputs:**
- Account age and activity level (days tracking, claims logged)
- Submission history: ratio of "worked" to overwhelmingly-negative outcomes on past submissions
- Community standing: net upvotes received across all submissions
- **Portfolio performance (passive boosting AND suppression):** The ledger and tracker data already proves — or disproves — expertise. This cuts both ways:
  - **Positive signal:** A user profitably running 15 casinos for 3 months knows the space. Their trust score should reflect that before they ever submit a signal. Inputs: portfolio diversity (casinos actively tracked + claimed), claim consistency (streak length, claim rate), P/L trajectory (sustained positive net over time), redemption success rate, early adoption signal (added casinos before they became popular in the discovery queue).
  - **Negative signal:** A user with sustained losses across their portfolio is either gambling recklessly or doesn't understand the mechanics. Either way, their signal quality is suspect. Sustained negative P/L suppresses trust score — not to zero, but enough to keep their submissions at low visual weight until community voting proves them right. This isn't a punishment, it's a quality filter. Someone losing money consistently is less likely to identify good deals accurately.
  - This is NOT a direct mapping — portfolio data is one weighted input alongside the others. A profitable user with zero submissions starts at a higher trust floor than a brand-new account, but still below someone with a proven submission track record. A losing user doesn't get silenced — their signals still go live, just at lower visual weight. Community voting can still promote a good signal from a bad portfolio.
  - The key insight: this data already exists in the ledger. No new collection needed, just a query in the trust evaluation job.
- Trust score is invisible to users — they never see their own score or anyone else's. It's backend weighting only. Portfolio-derived boosts are invisible too — the user never learns that their P/L influenced their trust score.
- Admin can manually adjust trust scores (escalate or suppress a user)

**Submission form is structured, not freeform:**
- Pick a casino (from their tracked list, or search)
- Pick a signal type (deal, promo code, free SC, warning, strategy tip)
- Fill in structured fields: title, details, expiry (optional), promo code (if applicable)
- "Post anonymously" checkbox (unchecked by default — users get credit unless they opt out)
- No freeform wall-of-text. Structure prevents noise and makes signals parseable.

**Minimum activity threshold to submit:** A user needs some baseline activity before they can create signals. The default threshold is time + usage based (exact values TBD, e.g., 7+ days with account, 5+ claims logged). Prevents throwaway accounts from flooding. "Worked/didn't work" voting has no activity threshold — everyone can vote from day one.

**Portfolio-aware threshold bypass:** The time gate exists to filter out throwaway accounts, not to slow down real users. High-performing portfolios can bypass or reduce the threshold entirely. If someone added 12 casinos in their first week, is claiming consistently, and is already in the green — they clearly know the space. Let them contribute immediately at medium trust instead of making them wait out an arbitrary timer. Conversely, users with sustained negative P/L may face a higher threshold — not blocked, but required to demonstrate more baseline activity before submitting. The threshold check queries the same ledger data the trust score uses. Thresholds TBD through tuning.

**Community self-moderation lifecycle:**
1. User submits signal → goes live at trust-weighted visibility
2. Other users vote "worked for me" or "didn't work"
3. "Worked" votes increase signal confidence and visual prominence
4. Mixed ratios (worked + didn't work) indicate a conditional signal — useful data, no penalty, no collapse
5. Overwhelmingly negative ratio (near-zero "worked") after meaningful time → "likely outdated" visual treatment
6. At even higher threshold → signal collapses (expandable, never deleted)
7. Submitter's trust score only penalized for overwhelmingly negative signals, not conditional ones

**Admin role: exception handling, not gatekeeping.** Weekly digest: "12 signals submitted this week. 8 confirmed by community, 2 disputed, 2 still unverified. 1 user flagged for repeated disputes." Dylan confirms, overrides, or ignores. System keeps running without intervention.

#### Aggregate Portfolio Intelligence (4.0 — needs user base)

The sensor network play. Anonymized, aggregate-only analysis of user portfolio data:
- "40% of users tracking Casino X have a pending redemption older than 7 days" → automatic health signal
- "Casino Y's daily claim rate dropped 30% this week across all users" → possible platform issue
- "Users who track Casino X also track Casino Z (85% overlap)" → discovery recommendation signal

**The quiet expert problem — and the discovery queue solution:**

The best users might never submit a signal. They don't need to — they already know what's happening. But their behavior still generates value if you can read it. The portfolio performance data that feeds trust scores in 3.0 becomes a collective intelligence source in 4.0.

Which casinos are the top 10% of earners adding right now? That's discovery queue data. If 8 of your top performers all added the same casino this week, that's a signal worth surfacing — and nobody had to submit anything. The discovery queue already ranks casinos; this adds a "Trending among top performers" weighting factor that uses behavioral data instead of explicit signals.

**How it works:**
- Define "top performers" by sustained positive P/L + portfolio diversity + claim consistency (same inputs as trust score portfolio boosting, but aggregated)
- Track which casinos this cohort is adding, dropping, or increasing activity on
- Surface patterns in the discovery queue: "Trending among top performers" label on casino cards when adoption by high-performers exceeds a threshold
- Surface anti-patterns in health: if top performers are dropping a casino or reducing activity, that's an early warning signal — potentially before any explicit warning gets submitted
- All aggregate, all anonymous. No individual user data exposed. The query is "what are the top 10% doing" not "what is User X doing."

**The invitation play (growth hack, not a feature):**
The same data that identifies quiet experts enables targeted outreach. Dylan can see who the high-performers are in the admin panel and reach out directly: "You've been crushing it — we're building community signals and your perspective would be valuable." Not automated, not a feature to build — just a smart use of admin-visible data. First contributors should be recruited from proven performers, not random early adopters.

This requires enough active users to produce statistically meaningful data. Not viable at launch. But the data is already being collected — it just needs aggregation queries when the user base is there. The 3.0 trust score portfolio inputs are the foundation that 4.0 aggregation builds on.

### Schema

All community-related schema changes (signal_votes table, discord_intel_items modifications, trust_score column) are consolidated in the **Database Changes** section above. See Modified Tables → `discord_intel_items` and `user_settings`, and New Tables → `signal_votes`.

### Open Questions — Community
- [ ] Minimum activity threshold to unlock signal submissions (7 days + 5 claims? Lower? Higher?)
- [ ] Dispute/collapse thresholds — need real-world tuning. Start conservative and adjust.
- [ ] Should aggregated portfolio data (4.0) be an explicit opt-in or implicit from existing tracking data?
- [ ] Anti-gaming measures beyond trust scoring? (IP-based duplicate detection, rate limiting submissions per user per day)
- [ ] Content generation rails from 2.0 (templated structure, confirmed-only data, freshness indicators) — do these still apply as-is or need revision for user-submitted content?
- [ ] The 2.0 naming (Loom/Vigil/Axiom) — keep the internal codenames or drop them?
- [ ] Future monetization angle: premium users get push notifications for signals faster, not submission gating. Note for 4.0 planning.

---

## Feature 7: Contributor Recognition

### The Split: Earned vs Bought

SweepsIntel has two separate status axes for users. They must never be conflated.

**Contributor Tier (earned):** Reflects track record and community value. You cannot buy it. Visible to other users as badges on signals and profile. Driven by submission quality, voting history, and community trust over time.

**Premium (bought, future):** Gives speed, tools, and access. Faster notification delivery, advanced filtering, dashboard customization — utility features. Does NOT grant credibility, trust score boosts, or higher contributor tier. A premium user with zero submissions is still a "Newcomer."

**Why this matters:** You can't buy trust. A user who contributes 50 confirmed signals over three months has earned their reputation. A troll who pays $10/month hasn't. Keeping these axes separate protects the integrity of the community signal and rewards the people who are actually driving the engine for free.

### Tiers

| Tier | Badge | Requirements | Visual Treatment |
|---|---|---|---|
| Newcomer | — (no badge) | Default for all users. Has account, may have never submitted. | Signals enter at low visual weight per trust score. No special treatment. |
| Scout | 🟢 green dot | Multiple submissions with net-positive community reception. Exact thresholds TBD — likely 5+ submissions where >60% received "worked" votes. | Badge next to display name on signals. Normal visual weight. |
| Insider | ⭐ star | Sustained positive track record over time. Likely 20+ net-positive submissions across 30+ days. Community-confirmed reliability. | Star badge on signals. Elevated visual weight on new submissions. May trigger notifications for casino followers (when notification system ships). |
| Operator | ✅ checkmark | Admin-granted only. Reserved for users with exceptional track record who Dylan personally trusts. Cannot be earned purely through volume. | Checkmark badge. Highest visual weight. Signals treated with near-admin authority in health computation. |

**Key design decisions:**

- Tiers are visible. Users can see their own tier and others' badges on signals. This is the earned, public-facing counterpart to the invisible trust score.
- Tier progression is NOT automatic. A background job evaluates eligibility, but promotion requires meeting thresholds — it's not a level-up animation. Demotion happens if quality degrades (sustained negative signal outcomes).
- Operator is admin-granted, not formula-driven. This prevents gaming through volume and gives Dylan a way to recognize genuinely valuable community members.
- Trust score and contributor tier are correlated but not identical. Trust score is the fine-grained backend weight (0.00–1.00, continuous). Contributor tier is the coarse, visible, earned label. A user's trust score informs tier eligibility, but tier transitions have their own thresholds and aren't a direct mapping.
- Newcomer is not a penalty. Most users will never submit a signal and that's fine — they consume intel and vote. Newcomer just means "hasn't built a submission track record yet."

### Tier Evaluation

A background job runs periodically (same cadence as health computation, every 30–60 min) and evaluates tier eligibility for users who have submitted signals:

**Inputs:**
- Total submissions count
- "Worked" ratio across all submissions (worked_count / total_votes)
- Account age (days since first activity)
- Submission span (days between first and most recent submission)
- Current trust score (which already incorporates portfolio performance — see Feature 6 trust score inputs)
- Admin override flag (for Operator tier, or manual demotion)

**Promotion logic (illustrative — thresholds TBD through real-world tuning):**
- Newcomer → Scout: 5+ submissions, >60% worked ratio, account age 14+ days
- Scout → Insider: 20+ submissions, >70% worked ratio, submission span 30+ days
- Insider → Operator: Admin-only. No automatic path.

**Demotion logic:**
- If a Scout's worked ratio drops below 40% over their last 10 submissions, demote to Newcomer
- If an Insider's ratio drops below 50% over their last 15 submissions, demote to Scout
- Operator can only be demoted by admin action
- Demotion is not instant — evaluated over a rolling window to prevent a single bad signal from tanking someone's status

### Where Tiers Surface

- **Signal cards in Intel Feed:** Badge icon next to the submitter's display name. Anonymous signals show NO badge — if you hide your name, you hide your rank. Keeps it clean and prevents "anonymous but clearly someone important" tells.
- **Signal detail view:** Tier label below the submitter name (hidden on anonymous signals)
- **User's own profile/settings:** "Your contributor tier: Scout 🟢" with a brief explanation of what it means and what the next tier requires
- **Admin panel:** Full tier breakdown per user, with override controls

### Schema

All contributor-related schema changes are consolidated in the **Database Changes** section above. See Modified Tables → `user_settings` for the `contributor_tier` column.

### Open Questions — Contributor Recognition
- [ ] Exact thresholds for tier promotion/demotion — need real-world data. Start conservative.
- [x] ~~Should anonymous signals still show the contributor badge?~~ → Resolved: No. Anonymous = no badge. Hide your name, hide your rank. See Decision #25.
- [ ] Notification when promoted/demoted? Promotion yes (positive reinforcement). Demotion TBD — could feel punitive.
- [ ] Should the "what's next" tier progress be gamified (progress bar) or understated (just text)?
- [ ] Operator capacity — is this 5 people? 50? How exclusive should it feel?

---

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Safety signals (Layer 2a) are always free | Gating risk warnings would erode trust and accelerate churn |
| 2 | Money-making signals (Layer 2b) are the core differentiator | Time-sensitive deal intelligence is the unique value proposition — monetization model TBD |
| 3 | Health indicators combine global + personal factors | A casino's general health matters, but YOUR exposure there matters more |
| 4 | My Casinos default sort: risk first, then exposure | Users need to see their biggest problems first, not their most profitable casino |
| 5 | Discovery collapse is session-scoped, not timed | Timer-based re-expansion feels arbitrary; session scope respects the user's intent |
| 6 | Page scrolls, not columns | Overflow scrolling in columns feels broken; native page scroll is expected behavior |
| 7 | Signal classification uses existing discord_intel_items.item_type | No new pipeline needed; existing data already has the taxonomy |
| 8 | Casino names are always links to profiles | Layer 1 reference must be one tap away from everywhere |
| 9 | Intel Feed scoped to tracked casinos only | This is YOUR intelligence, not a global news feed — add a casino to your tracker to see its signals |
| 10 | No per-casino filter granularity | You track a casino or you don't. Type filtering (Deals/Warnings/etc) is global and session-scoped, not persisted. Keeps the UX simple. |
| 11 | Monetization model deferred from 3.0 | Tension not ready to resolve. Build the value first, gate it later. No premium flags, no time delays, no content blur in 3.0 |
| 12 | User-submitted signals ship in 3.0, reversing 2.0 "admin-only" decision | The sensor network value of free-user signal volume outweighs the curation purity of admin-only. Community self-moderates via voting. |
| 13 | Everyone can submit signals, no premium gate | Gating submissions behind premium kills the signal volume that makes the community layer valuable. Trust score controls visibility, not access. |
| 14 | Trust score is invisible to users | Users never see their own score or others'. It's backend weighting only. Prevents gaming and social pressure. |
| 15 | Signals go live immediately, never queued for moderation | A signal that waits for approval dies. Speed > curation purity. Trust score + community voting handles quality. Admin role is exception handling via weekly digest. |
| 16 | Voting is "worked / didn't work" not "true / false" | Signals in the sweeps space are often conditionally true (promoban, state, timing). A deal that's real but only for non-PB'd users would get falsely killed by true/false voting. "Didn't work for me" is informational, not punitive. |
| 17 | Mixed vote ratios (worked + didn't work) are healthy, not disputed | A signal with 12 "worked" and 4 "didn't work" is conditional, not bogus. No trust penalty, no visual suppression. Only overwhelmingly negative signals (near-zero "worked") trigger disputed treatment. |
| 18 | Signal attribution is user's choice: named or "Community member" | Named signals reward contributors and build social proof. Anonymous option protects privacy. Discord signals always show as "Community member" — blends naturally into the anonymous pool. |
| 19 | Discord/external source attribution never surfaces to users | SweepsIntel must feel like THE source, not a mirror. Source column exists in DB for admin/debugging only. Discord signals always display as "Community member." Non-negotiable business requirement. |
| 20 | Admin signals show as "SweepsIntel Team" | Carries implicit authority without revealing it's a single person. Admin has dedicated creation/tracking panel. |
| 21 | Health is computed, not set | Background job derives status from current inputs every 30-60 min. No manual "resolve" action. Warnings decay naturally over 72h. Admin override is a separate manual pin that takes precedence. |
| 22 | Contributor tier is earned, premium is bought — never conflated | You can't buy trust. Contributor tier reflects track record (submissions, community reception). Premium gives speed/tools/access. A premium user with zero submissions is still a "Newcomer." |
| 23 | Contributor tiers are visible, trust scores are not | Tier badges on signals reward contributors publicly and build social proof. Trust score stays invisible backend weighting to prevent gaming. Two representations of reputation: one for users, one for the system. |
| 24 | Operator tier is admin-granted only | Prevents gaming through volume. Gives Dylan a human judgment layer for the highest trust tier. Cannot be earned purely through formula. |
| 25 | Anonymous signals hide contributor badges | If you hide your name, you hide your rank. Prevents "anonymous but clearly someone important" tells. Clean separation: named signals show badge, anonymous signals don't. |
| 26 | Portfolio performance feeds trust score (both directions) | Ledger data already proves expertise. Profitable diverse portfolios boost trust floor. Sustained losses suppress it. Not a punishment — a quality filter. Losing users still submit, just at lower visual weight. Community voting can still promote their signals. |
| 27 | High-performing portfolios can bypass submission time gates | The time gate filters throwaway accounts, not real users. Someone running 12 casinos profitably in week one clearly knows the space — don't make them wait out an arbitrary timer. |
| 28 | Quiet expert behavior feeds discovery queue (4.0) | Best users may never submit a signal. But if 8 top performers add the same casino this week, that's a signal. Aggregate behavioral data → "Trending among top performers" in discovery queue. All anonymous, all aggregate. |
