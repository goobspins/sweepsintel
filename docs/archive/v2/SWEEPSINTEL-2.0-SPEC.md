# SweepsIntel 2.0 — Product Spec (DRAFT v3)

> Status: Ready for PM review and Codex handoff.
> Last updated: 2026-03-15
> Companion doc: SWEEPSINTEL-VISION.md — read first for UI/UX intent.
> Decision log at bottom tracks what was discussed and resolved.

---

## Business Model

SweepsIntel makes money through casino affiliate signups and ongoing commission. Revenue has two components:

1. **One-time signup bonuses.** User signs up at a casino through SweepsIntel's affiliate link. SweepsIntel gets paid per signup.
2. **Ongoing commission.** Some casino affiliate programs pay 5% (or similar) of the user's ongoing activity. A retained user who actively plays generates recurring revenue indefinitely.

A dedicated user who signs up at 20+ casinos is worth $400-500 in one-time affiliate bonuses. If they stay active and some casinos pay ongoing commission, the lifetime value is significantly higher. Non-dedicated users who sign up at 3-5 casinos and churn are still worth $60-100 in one-time bonuses with near-zero ongoing cost.

**Premium subscriptions ($9.99-14.99/mo) are secondary.** They exist for power users who want analytical tools. Premium revenue covers infrastructure and adds marginal LTV but is not the primary business.

**Implication: the product should optimize for both acquisition AND retention.** Getting users to sign up at casinos matters. Keeping them actively playing those casinos also matters. The daily tracker serves retention directly — every daily claim is casino activity generating commission revenue.

---

## Growth Strategy

The product IS the marketing. SweepsIntel teaches people how to make legitimate free money from sweepstakes casinos, explains everything without a paywall, and provides tools to do it efficiently. That value proposition drives organic sharing.

**Primary growth channels:**

1. **Casino profile pages powered by KB data.** Someone Googles "Chanced casino review" or "is MyPrize legit" and lands on a profile page with trust signals, deal quality, wash game tips, known traps, and a getting-started guide. No other site in the niche has this depth because nobody else has a structured, corroborated knowledge base updated twice daily from community sources. These pages rank in search AND convert visitors into signups. Every casino profile is simultaneously an SEO asset, a trust builder, and an affiliate conversion page.

2. **Public educational content baked into the site.** Getting Started expands into a real curriculum. Not behind a login. Not paywalled. "How sweepstakes casinos work." "How to make your first $50." "Which casinos to start with in your state." This is top-of-funnel content that drives organic traffic and builds authority.

3. **SEO article pipeline.** Already built and running. AI-written articles with Dylan's voice, informed by the KB. Drives search traffic to the site. Separate from the 2.0 spec but feeds into it.

4. **Reddit presence (future).** The Reddit scout already identifies high-value threads. A future pipeline could draft helpful responses for Dylan's review and posting. Casino profile pages become the landing pages that Reddit traffic hits.

**Not in scope:**
- Own Discord community (management overhead, not worth it)
- Referral program (tracking 20+ casino signups per referral, delayed attribution, messy payouts — too complex for the value)
- Paid advertising

**The viral loop is content quality.** Someone finds the site, learns how to make money from sweepstakes, signs up at casinos through affiliate links, starts using the tracker, tells their friend "look at this site." No referral tracking needed.

---

## Product Architecture

Three layers, each feeding the next:

```
Layer 1: CONTENT (SEO articles, casino profiles, state pages, educational guides)
         → Brings users to the site via search and organic sharing

Layer 2: TOOL (daily tracker, ledger, redemptions, momentum dashboard)
         → Keeps users engaged daily, creates habit, generates ongoing commission

Layer 3: DISCOVERY (casino recommendations, trust signals, intel-powered profiles)
         → Converts engagement into new affiliate signups over time
```

Layer 3 drives one-time signup revenue. Layer 2 drives ongoing commission revenue. Layer 1 fills the funnel. All three matter.

---

## What 1.0 Got Right

- Astro hybrid mode (pre-render public pages, serverless for auth'd)
- Neon serverless Postgres (built-in connection pooling)
- OTP auth (frictionless signup)
- Reset countdown logic (fixed + rolling modes with Luxon)
- Affiliate gate logic (new user → affiliate link → then track)
- Redemption stats (median/P80 timing per casino)
- PWA support
- Admin panel for casino management
- Pre-rendered public casino directory and state pages

## What 1.0 Missed

### Revenue-critical gaps
1. **Casino discovery is weak.** "Explore More Casinos" is a flat list below the fold. No intelligence about why to trust a casino, what deals look like, how to use it. No personalization. Even power users don't sign up at casinos they don't understand.
2. **Onboarding doesn't front-load signups.** Getting Started walks through one casino. Should result in 3-5 affiliate signups in the first session.
3. **Casino profiles are data sheets.** No trust signals, no community sentiment, no deal quality assessment. Nothing that helps a user decide "should I sign up here."

### Engagement/retention gaps
4. **No daily momentum.** No progress tracking, no goals, no sense of building something.
5. **Purchase logging is too much friction.** Deals are the core activity for serious users and there's no quick way to log them.
6. **UI feels empty.** Light theme, too much whitespace, doesn't feel like a tool you want to open.
7. **No household support.** Couples running sweepstakes together need independent accounts with combined visibility.

### Data gaps
8. **Timestamps, not dates.** Need precision for multi-transaction days.
9. **Per-casino data is shallow.** Just a balance number. No P/L trend, no deal history.

---

## 2.0 Priorities (Ordered by Impact)

### P0: Casino Discovery Engine + Profiles
The feature most directly tied to revenue. Intel-powered casino profiles that build trust and drive affiliate signups. The "Explore More Casinos" section becomes a personalized recommendation engine on the dashboard.

### P1: Onboarding Funnel
Front-load affiliate signups. State selection → experience level → starter pack of 3-5 casinos with trust pitches → guided signup. Target: 3-5 affiliate signups before the user reaches the dashboard.

### P2: Daily Tracker (Retention Engine)
Make the daily experience sticky. Three entry modes per casino row (Daily/Adjust/Spins). Quick purchase entry. Per-reset-period claim guard. Every daily open = ongoing commission revenue.

### P3: Dashboard + Momentum
Configurable KPIs (3-4 from pool of 10), momentum progress bar (SC value, daily/weekly toggle), goal tracking. Makes users feel like they're building something.

### P4: Dark Theme + UI Overhaul
CSS variable swap to dark theme (default). Visual density where it matters. The app needs to feel good.

### P5: Ledger + My Casinos
Timestamp precision. New entry types. Per-casino stats page with P/L trends.

### P6: Household Support
Multi-user for couples. Separate accounts, combined view.

### P7: Premium Features
Purchase templates, margin calculation, RTP-adjusted margins, advanced analytics. Secondary revenue.

---

## P0: Casino Discovery Engine + Profiles

### Intelligence Layer

Each casino recommendation/profile is powered by data from three sources:

1. **CASINO-INTEL.md** — KB processor output. Confirmed community intelligence: deal quality, wash games, PB risk, platform health, redemption speed, newbie traps. Sanitized of Discord usernames. Updated twice daily.
2. **Admin-curated casino data** — casinos table in Postgres. Tier, reset mechanics, affiliate links, redemption methods. Maintained by Dylan.
3. **Aggregated user data** — redemption stats (median/P80 days, trend warnings), casino popularity (user count), average daily SC.

### Casino Profile Pages (Public)

Each casino gets a detailed profile page that serves as both SEO landing page and affiliate conversion page. Powered by KB data.

**Trust signals section:**
- Platform health (green/yellow/red) — from KB platform health warnings
- Redemption speed and reliability — from redemption stats + KB
- Promoban risk level — from casino data + KB
- Community sentiment — aggregated from KB confirmed entries
- Longevity (how long operating)
- US-based indicator

**Value section:**
- Typical daily bonus SC
- Deal quality — from KB deal tier data (e.g., "regularly offers 20-30% margin deals")
- Best wash games — from KB wash game intelligence
- Redemption minimums and methods

**Getting started guide (per casino):**
- Step-by-step first day: sign up, verify ID, claim daily, buy first deal
- Known newbie traps for this casino (from KB + operator knowledge)
- Recommended first actions
- "What to avoid" notes

**Affiliate CTA:**
- "Sign Up" button (affiliate link) — prominent
- "Add to Tracker" button — for already-signed-up users

### Dashboard Discovery Section

Below the casino claim list on the dashboard. Two-part layout: one **spotlight featured casino** with depth, followed by **compact recommendation cards**.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CASINOS YOU'RE MISSING
  Personalized for your state and activity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ┌───────────────── SPOTLIGHT ─────────────────┐
  │  MyPrize                        ● Green     │
  │                                             │
  │  "Cross-wash hub with strong daily bonus    │
  │   and a streak multiplier system. One of    │
  │   the most reliable redemption speeds in    │
  │   the space."                               │
  │                                             │
  │  Best wash game: Plinko (98.5% RTP)         │
  │  Redeem speed: Instant - 24h                │
  │  PB risk: Low                               │
  │  Trap to know: Streak resets on missed day  │
  │                                             │
  │  [Full Profile →]         [Sign Up →]       │
  └─────────────────────────────────────────────┘

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Chanced  ●G  │  │ Zula    ●G   │  │ Sportz  ●Y   │
  │ Daily deals  │  │ Good daily   │  │ High margin  │
  │ 30%+ margin  │  │ Fast redeem  │  │ deals        │
  │ [More][Sign] │  │ [More][Sign] │  │ [More][Sign] │
  └──────────────┘  └──────────────┘  └──────────────┘

  [Show more casinos →]
```

**Spotlight card:** Rotates through untracked casinos, prioritized by intel coverage quality (casinos where the KB has the richest data rotate in first — this demonstrates the platform's intelligence depth and teaches users about casinos passively). Shows: name, health dot, multi-line trust pitch, best wash game, redeem speed, PB risk, one known trap/tip. Two CTAs: "Full Profile" (→ casino profile page) and "Sign Up" (→ affiliate link). Rotation: changes on each dashboard load or daily, whichever feels better in testing.

**Compact cards:** 3-column grid below spotlight. Casino name, health dot, 1-2 line pitch, "Learn More" and "Sign Up" buttons. Show 3-6 cards with "Show more" to expand.

**Personalization:** Filters by user's state, excludes casinos already tracked, ranked by tier + deal quality + popularity.

All casinos shown regardless of affiliate relationship. (Dylan will sign up for remaining affiliate programs. Don't hurt users by hiding non-affiliate casinos.)

### KB-to-Product Sync

New table to make KB data queryable per casino:

```sql
CREATE TABLE casino_intel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID REFERENCES casinos(id),
  category TEXT NOT NULL,
    -- 'deal_quality', 'wash_game', 'platform_health', 'pb_risk',
    -- 'redemption', 'newbie_trap', 'regulatory', 'general'
  summary TEXT NOT NULL,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'warning')),
  confidence TEXT CHECK (confidence IN ('confirmed', 'pending')),
  decay_tier TEXT CHECK (decay_tier IN ('T1', 'T2', 'T3', 'PERM')),
  source_date DATE NOT NULL,
  expires_at DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_casino_intel_active ON casino_intel(casino_id, is_active, category);
```

A scheduled task runs after each KB processor run. Reads CASINO-INTEL.md, matches entries to casinos by name/slug, categorizes, extracts sentiment, computes expiry from decay tier, upserts into casino_intel. Expired entries marked inactive. Product queries this table — no markdown parsing at runtime.

### Getting-Started Guides

**Confidence-threshold approach:** If a casino has 5+ active KB entries spanning 2+ categories (e.g., wash_game + deal_quality, or redemption + newbie_trap), auto-generate a guide from templated assembly of confirmed entries. Below threshold, show a simplified "Here's what we know" card with whatever entries exist — no fake depth. Admin-written guides for S/A tier casinos (15-20) override auto-generated when they exist. No upfront KB audit needed — the system degrades gracefully and improves as intel coverage grows.

---

## P1: Onboarding Funnel

### Flow

1. **User signs up** (OTP email).
2. **State selection.** "What state are you in?" — filters available casinos. Stored in user_settings.
3. **Experience level.** "Have you played sweepstakes casinos before?"
   - New: never tried
   - Some: played 1-3 casinos
   - Experienced: active on multiple platforms
4. **Starter pack.** Based on state + experience, recommend 3-5 casinos:
   - New: safest, best-known platforms with good dailies (MyPrize, Global Poker, Crown Coins)
   - Some: above + better margin opportunities (Chanced, Sportzino)
   - Experienced: all top-tier casinos for their state, let them pick
5. **Per-casino signup card.** For each recommended casino:
   - 1-2 sentence trust pitch (from KB intel)
   - "Sign Up" button (affiliate link)
   - "I already have an account" → skip to tracking
   - "Skip for now"
6. **First daily walkthrough.** After adding 3+ casinos, brief demo of claiming a daily. Show the core loop.
7. **Dashboard.** Full dashboard with their casinos + discovery section.

### State Gating

Only show casinos available in the user's state. Uses casino_state_availability table from 1.0. Bad experience = recommending a casino that blocks their state.

---

## P2: Daily Tracker (Retention Engine)

### Casino Row — Three Entry Modes

Each casino row has mode toggles:

```
[Daily]  [Adjust]  [Spins]  |  [SC input]  [description]  |  [Save]
```

- **Daily** — logs daily bonus. **Guarded: one per reset period.** The reset period is defined by the casino's `reset_interval_hours` (default 24h, can be 6h, 8h, etc.). For fixed mode: period starts at `reset_time_local` in casino's timezone. For rolling mode: period starts at last claim time. A 6-hour rolling casino has ~4 claimable windows per day, each independently claimable. Attempting to reclaim within the same period is blocked. This guard catches misclicks and has been proven valuable in daily use.
- **Adjust** — correction entry. Creates ledger adjustment. No guard.
- **Spins** — free spins/free SC. SC amount + optional description. Creates free_sc ledger entry. No guard.

Mode toggle changes save button color/label:
- Daily: green "Save"
- Adjust: orange "Save Adj"
- Spins: blue "Save Spins"

### Purchase Entry

Separate from mode toggle. "+ Buy" button on the row opens inline form or modal:
- Cost (USD)
- SC Received
- (Optional) Promo code, notes
- Save → ledger entry type=`purchase`

Available to all users. Premium users additionally see margin calculation.

### Row Display
- Casino name + tier badge
- Timer: "Available now" / "Next in Xh Ym"
- Last claim time
- Expandable: balance, P/L, notes, casino page link

### Sorting
- User-defined sort order
- Optional: "available now" float to top

---

## P3: Dashboard + Momentum

URL: `/dashboard` (renamed from `/tracker`)

### Momentum Bar (always visible, collapsible)

Tracks **SC value earned** (dailies + free SC, converted at sc_to_usd). Always positive, always growing. Motivational by design — net P/L is shown separately as a KPI card for honest accounting.

Cross-washing between a user's own accounts across platforms nets out correctly — the loss on Casino A and gain on Casino B are both real, tracked per-casino, and the portfolio view reflects reality.

**Daily / Weekly toggle:** User switches between daily and weekly momentum goals. Daily = today's progress toward daily goal. Weekly = this week's progress toward weekly goal (7× daily or custom). Toggle persists in user_settings.

**Compact view:**
- Progress bar (rainbow gradient): `$X.XX / $GOAL`
- Toggle: Daily | Weekly
- Inline: top 2-3 KPI values from user's selected cards

**Expanded view:**
- Editable daily USD goal + optional weekly override
- Rolling 7-day daily average
- Rolling 4-week weekly average
- 10-day streak dots (green = goal met, gray = missed)

**Cosmetic options (stored in user_settings):**
- Bar style: rainbow gradient (default), solid color, segmented blocks
- Bar animation: smooth fill (default), step fill
- Goal display: numeric (default), percentage
- Future: custom accent color

### KPI Cards (Configurable)

Users select 3-4 KPI cards from the available pool. Selection stored in user_settings as JSON array (`kpi_cards`). `null` = defaults.

**Available KPI options:**
- SC Earned Today
- USD Earned Today
- Net P/L (today)
- Purchases (count + USD spent)
- Pending Redemptions (count + USD)
- Available Claims
- Rolling 7-Day Avg
- Total SC Balance (all casinos)
- Casinos Tracked
- Current Streak (days)

**Defaults (when `kpi_cards` is null):** SC Earned, USD Earned, Purchases, Pending Redemptions.

Codex implementation note: KPI card component takes a type prop and fetches its own data. Dashboard renders `kpi_cards.map(type => <KpiCard type={type} />)`. Settings page has drag-and-drop or checkbox selector for available KPIs.

---

## P4: Dark Theme + UI Overhaul

Default dark. Light theme via settings toggle.

```css
--bg-primary: #111827;      /* gray-900 */
--bg-secondary: #1f2937;    /* gray-800 */
--bg-tertiary: #374151;     /* gray-700 */
--text-primary: #f3f4f6;    /* gray-100 */
--text-secondary: #d1d5db;  /* gray-300 */
--text-muted: #9ca3af;      /* gray-400 */
--border: #374151;          /* gray-700 */
--accent-green: #10b981;    /* emerald-500 */
--accent-red: #ef4444;      /* red-500 */
--accent-yellow: #f59e0b;   /* amber-500 */
--accent-blue: #3b82f6;     /* blue-500 */
--progress-gradient: linear-gradient(90deg, #ef4444, #f59e0b, #10b981, #3b82f6);
```

Implementation: CSS variable swap. 1.0 already uses CSS variables and inline styles. Add `data-theme` attribute on `<html>`, override variables per theme. Not a rewrite.

---

## P5: Ledger + My Casinos

### Ledger

**Timestamp precision:** `entry_at TIMESTAMPTZ` replaces `entry_date DATE`. Display in user timezone. Keep date range filter.

**Entry types:**

| Type | SC | USD | Description |
|------|-----|------|-------------|
| `daily` | +X | — | Daily bonus claim |
| `free_sc` | +X | — | Free spins, free SC, bonus |
| `purchase` | +X | -$Y | Deal purchase |
| `redeem_confirmed` | -X | +$Y | Redemption received |
| `adjustment` | +/-X | +/-$Y | Manual correction |

Removed from 1.0: `winnings`, `wager` (no play session tracking in 2.0).

**Summary:** Total In / Total Out / Net P/L / Per-casino breakdown (collapsible).

**Filters:** Casino, entry type, date range, amount range.

**Export:** CSV.

### My Casinos Page

Dedicated strategic overview page. Per casino:
- Name + tier
- SC balance + USD value
- Total invested / Total redeemed / Net P/L
- Last activity
- Personal notes (editable)
- Quick actions (claim, purchase, redeem, visit)

Sorting: name, balance, P/L, last activity.

---

## P6: Household Support

```sql
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Household',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE household_members (
  household_id UUID NOT NULL REFERENCES households(id),
  user_id TEXT NOT NULL REFERENCES user_settings(email),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  display_name TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);
```

- Separate logins, separate data, separate casino lists
- Persona toggle: Me | Spouse | Household
- Household = combined read-only aggregate
- No cross-editing

---

## P7: Premium Features ($9.99-14.99/mo)

Everything else is free. Premium adds:
- Purchase templates (saved deal structures for 1-tap repeat logging)
- Quantity/duplicate entry for purchases
- Margin calculation on purchases: `(sc * sc_to_usd - cost) / cost * 100`
- RTP-adjusted margin (user-entered RTP per casino)
- Advanced analytics: per-casino ROI over time, weekly/monthly trends, best/worst performers
- Tax-ready annual export

**The product being free and good IS the monetization strategy.** Engaged free users sign up at casinos and generate affiliate revenue. Premium is supplemental.

---

## Free vs Premium Summary

**Free (everything a user needs):**
- Full daily tracker with all entry modes (Daily/Adjust/Spins)
- Purchase logging (cost + SC received)
- Full ledger with timestamps
- Full redemption tracker
- Dashboard with momentum bar and KPIs
- Casino discovery with KB-powered recommendations
- Casino profiles with trust signals and getting-started guides
- My Casinos page with P/L
- Household support
- Dark theme
- Unlimited casinos
- CSV export

**Premium (power user analytics + convenience):**
- Margin calculation displayed on purchases
- Purchase templates
- Quantity/duplicate purchases
- RTP-adjusted margin
- Per-casino ROI trends over time
- Weekly/monthly performance reports
- Tax-ready annual P/L export

---

## Database Changes Summary

### New Tables
```sql
households (id, name, created_at)
household_members (household_id, user_id, role, display_name, joined_at)
casino_intel (id, casino_id, category, summary, sentiment, confidence, decay_tier, source_date, expires_at, is_active)
purchase_templates (id, user_id, casino_id, name, cost_usd, sc_amount, promo_code) -- premium
daily_aggregates (user_id, agg_date, sc_earned, usd_earned, usd_spent, purchase_count, claim_count, free_sc_count)
```

### Modified Tables

**user_settings:**
- +household_id UUID
- +daily_goal_usd DECIMAL(10,2)
- +weekly_goal_usd DECIMAL(10,2) (null = 7× daily)
- +momentum_period TEXT DEFAULT 'daily' CHECK ('daily', 'weekly')
- +momentum_style JSONB (bar_style, animation, goal_display)
- +kpi_cards JSONB (array of selected KPI type strings, null = defaults)
- +theme TEXT DEFAULT 'dark'
- +is_premium BOOLEAN DEFAULT false
- +experience_level TEXT (new/some/experienced)

**ledger_entries:**
- entry_date DATE → entry_at TIMESTAMPTZ (keep entry_date as computed index)
- +margin_pct DECIMAL(8,4)
- +promo_code TEXT
- entry_type enum: remove winnings/wager, add purchase/free_sc

**daily_bonus_claims:**
- +reset_period_start TIMESTAMPTZ
- UNIQUE constraint on (user_id, casino_id, reset_period_start)

### New Indexes
```sql
idx_ledger_user_date (user_id, entry_at DESC)
idx_ledger_user_casino_type (user_id, casino_id, entry_type)
idx_household_members (user_id)
idx_daily_claims_period UNIQUE (user_id, casino_id, reset_period_start)
idx_casino_intel_active (casino_id, is_active, category)
```

---

## New Scheduled Task: KB-to-Product Sync

Runs after each KB processor completion (twice daily). Reads CASINO-INTEL.md:
1. Match casino name to casinos table (fuzzy match on name/slug)
2. Categorize (deal_quality, wash_game, platform_health, pb_risk, redemption, newbie_trap, regulatory)
3. Extract sentiment
4. Compute expires_at from decay tier
5. Upsert into casino_intel
6. Mark expired entries inactive

---

## API Summary

### New
```
GET  /api/momentum?persona=me|spouse|household
POST /api/momentum/goal { daily_goal_usd, weekly_goal_usd?, momentum_period? }
POST /api/settings/kpi-cards { cards: string[] }
POST /api/settings/momentum-style { bar_style?, animation?, goal_display? }
POST /api/tracker/purchase { casino_id, cost_usd, sc_received, promo_code?, notes? }
POST /api/tracker/free-sc { casino_id, sc_amount, source?, notes? }
GET  /api/discover/recommendations?limit=N
GET  /api/discover/casino/:id/intel
GET  /api/discover/casino/:id/getting-started
POST /api/onboarding/state { state_code }
POST /api/onboarding/experience { level }
GET  /api/onboarding/starter-pack
POST /api/household/create
POST /api/household/invite { email }
POST /api/household/join { invite_token }
POST /api/household/leave
GET  /api/household/members
GET  /api/casinos/my-stats
POST /api/templates/create -- premium
GET  /api/templates -- premium
DELETE /api/templates/:id -- premium
```

### Modified
```
GET  /api/ledger/entries -- timestamp precision, new types
GET  /api/ledger/summary -- margin, trends
POST /api/ledger/entry -- new types
GET  /api/tracker/status -- available claims, last activity
POST /api/tracker/claim -- per-reset-period enforcement
POST /api/settings -- goal, theme
GET  /api/casinos/:slug -- include casino_intel data
```

---

## P-Future: Community Intelligence Layer

Not in the initial build phases. Designed here so nothing in the 2.0 architecture prevents it. Timing depends on having enough users to generate meaningful signal.

### The Content Trust Pipeline

```
Community chatter (bearcave, Reddit)
  → KB processor (extracts, structures, assigns decay tier)
    → CASINO-INTEL.md (structured storage)
      → KB sync (populates casino_intel table)
        → Product surfaces it (profiles, spotlight, compact cards, guides)
          → Community rates it (thumbs up/down per intel point)
            → Ratings adjust confidence scoring
              → Low-confidence entries decay faster / get flagged
                → Dylan optionally intervenes at any point
```

The KB processor is Loom — weaves raw community signal into structured knowledge. The community rating layer is Vigil — validates output quality. The decay system + confidence adjustments are Axiom — tending the garden, composting what's stale, promoting what's proven.

### Per-Intel-Point Rating

On casino profiles (and optionally spotlight cards), each surfaced intel point gets a thumbs up/down. Logged users only. No comments, no text input — just signal. Zero moderation burden.

**What ratings do:**
- Thumbs up on confirmed entry → reinforces confidence, no action needed
- Thumbs down on confirmed entry → increments dispute counter. At threshold (3 downvotes with <2 upvotes), entry status becomes "disputed" — still shown with visual indicator, flagged for next KB processor run to re-evaluate
- Thumbs down on pending entry → accelerates decay (halves remaining time to expiry)
- Pattern detection: multiple downvoted entries for same casino → stale intel flag on the whole casino

**What ratings don't do:**
- Don't delete anything. Community can dispute, not censor.
- Don't override confirmed entries instantly. Threshold prevents griefing.
- Don't create new knowledge. KB processor's job from community sources.

### Confidence Promotion

Intel that proves itself earns longevity. If a T1 entry (7-day volatile) survives two KB processor cycles without contradiction AND receives community upvotes, it promotes to T2. T2 entries with sustained validation can promote to T3. Knowledge that the community validates over time should stick around longer.

Full lifecycle: **born pending → confirmed by processor → rated by community → promoted if validated / disputed if challenged / decayed if stale → archived with reason.**

### Dylan's Role

Oversight, not labor. Weekly digest: "3 entries disputed this week, 2 casinos flagged for stale intel." Confirm, override, or ignore. System keeps running either way.

### Content Generation Rails

All user-facing AI-generated text (compact card pitches, spotlight descriptions, getting-started guides) follows strict rules:
- **Assembled from confirmed KB entries only** — no freeform generation, no pending data
- **Templated structure** — sentence patterns are fixed, KB data fills slots. "Best wash game: [wash_game entry]" not "write a paragraph about this casino"
- **Gaps are gaps** — if data is missing, show "We don't have wash game data for this casino yet," never fabricate
- **Freshness indicator** — every generated content piece carries source_date of its newest KB entry. 14+ days old shows "Intel last updated X days ago"
- **Lead metric per casino** — compact cards show the casino's strongest data point (deal quality if deal-focused, redeem speed if that's the standout), not a one-size-fits-all template. KB sync flags each casino's lead category based on entry count and confidence.

### Schema Additions (when implemented)

```sql
-- Add to casino_intel
ALTER TABLE casino_intel ADD COLUMN upvotes INT DEFAULT 0;
ALTER TABLE casino_intel ADD COLUMN downvotes INT DEFAULT 0;
ALTER TABLE casino_intel ADD COLUMN dispute_status TEXT CHECK (dispute_status IN ('clean', 'disputed', 'resolved'));

-- Rating log
CREATE TABLE intel_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intel_id UUID NOT NULL REFERENCES casino_intel(id),
  user_id TEXT NOT NULL REFERENCES user_settings(email),
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (intel_id, user_id)  -- one vote per user per entry
);
```

---

## Caching & Data Fetching Strategy

The dashboard will be reloaded intensely — potentially 100-200+ times per day per active user. Naive full-refetch on every load would hammer the database and create noticeable latency. The strategy is: aggressive client-side caching with surgical invalidation.

### Data Tiers by Volatility

**Tier 1: Near-static (cache for hours, background refresh)**
- Casino metadata (name, tier, reset mechanics, state availability)
- Casino intel / trust signals (changes twice daily at most — KB sync cadence)
- Discovery recommendations (changes when user adds a casino or intel updates)
- KPI card configuration, momentum bar settings, theme preference

Cache strategy: Stale-while-revalidate. Serve from cache immediately, refresh in background. TTL: 4-6 hours. Invalidate on: KB sync completion (server-sent event or polling flag), user adding/removing a casino.

**Tier 2: Session-volatile (cache for the session, invalidate on writes)**
- Today's claim status per casino (claimed / available / timer)
- Today's KPI aggregates (SC earned, USD earned, purchases, pending redemptions)
- Momentum bar progress
- Ledger summary for current date range

Cache strategy: Cache in memory (React state or lightweight store). Invalidate on: any write action (claim, purchase, adjustment, spins entry). After a write, refetch only the affected data — don't reload everything.

**Tier 3: Always-fresh (no cache, but cheap queries)**
- Claim guard check (is this reset period already claimed?) — must be real-time to prevent double-claims
- Reset countdown timers — computed client-side from cached reset mechanics, no server call needed

### Implementation Approach

**Server-side: Lean API responses with ETags.**
Every GET endpoint returns an `ETag` header (hash of response body). Client sends `If-None-Match` on subsequent requests. Server returns `304 Not Modified` with empty body if nothing changed. This is critical for the 200-loads-per-day pattern — most reloads will be 304s with near-zero data transfer.

**Client-side: SWR pattern (stale-while-revalidate).**
On dashboard mount:
1. Render immediately from cached data (localStorage or in-memory store)
2. Fire background revalidation requests
3. If data changed, update UI seamlessly
4. If 304, do nothing

This means the dashboard feels instant on every load. No loading spinners for cached data.

**Write-through invalidation.**
When user performs a write action (claim daily, log purchase, etc.):
1. Optimistic UI update (show the change immediately)
2. POST to server
3. On success: invalidate only affected cache keys (today's KPIs, claim status for that casino, momentum)
4. On failure: roll back optimistic update, show error

**Specific optimizations:**
- **Timer countdowns:** Computed entirely client-side from `reset_time_local` + `reset_interval_hours` + `last_claim_at`. Zero server calls for "Next in 2h 15m" display. Recomputed on claim write.
- **Discovery section:** Cached aggressively (TTL: 6h). Only changes when user adds a new casino or KB sync runs. Spotlight rotation can be client-side (pick from cached list based on day or load count).
- **KPI aggregates:** Single endpoint returns all KPI values in one call. Cached per-session, invalidated on any ledger write. Avoid N+1 by not fetching each KPI independently.
- **Momentum bar:** Shares data with KPI endpoint. One fetch populates both.

**What NOT to cache:**
- Claim guard checks (safety-critical, must be real-time)
- Ledger entry creation (write path, always hits server)
- Authentication state

### Database-Side

**Materialized aggregates for KPIs.** Rather than computing "SC earned today" from a SUM over ledger_entries on every request, maintain a `daily_aggregates` table (or use Postgres materialized views) that pre-computes per-user-per-day totals. Updated on each ledger write via trigger or application code. The KPI endpoint reads from this table — one row lookup instead of scanning all entries.

```sql
CREATE TABLE daily_aggregates (
  user_id TEXT NOT NULL REFERENCES user_settings(email),
  agg_date DATE NOT NULL,
  sc_earned DECIMAL(12,2) DEFAULT 0,
  usd_earned DECIMAL(10,2) DEFAULT 0,
  usd_spent DECIMAL(10,2) DEFAULT 0,
  purchase_count INT DEFAULT 0,
  claim_count INT DEFAULT 0,
  free_sc_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, agg_date)
);

CREATE INDEX idx_daily_agg_recent ON daily_aggregates(user_id, agg_date DESC);
```

**Connection pooling:** Already handled by Neon serverless. No changes needed.

**Query performance:** Ensure indexes cover the hot paths — `daily_bonus_claims` by (user_id, casino_id, reset_period_start), `ledger_entries` by (user_id, entry_at DESC), `casino_intel` by (casino_id, is_active).

---

## Migration / Implementation Phases

### Phase 1: Schema + KB Sync
- New tables and columns
- KB-to-product sync task
- Backfill casino_intel from CASINO-INTEL.md
- Backfill entry_at from entry_date

### Phase 2: Discovery Engine + Casino Profiles (P0)
- Rebuild casino profile pages with intel, trust signals, getting-started guides
- Build dashboard discovery section
- Affiliate CTAs on all casino touchpoints

### Phase 3: Onboarding Funnel (P1)
- State + experience flow
- Starter pack recommendations
- Guided first-session signup

### Phase 4: Dashboard + Tracker Rebuild (P2, P3, P4)
- Dark theme
- Momentum bar + KPIs
- Casino rows with Daily/Adjust/Spins modes
- Quick purchase entry
- Reset period claim guard
- Rename /tracker → /dashboard

### Phase 5: Ledger + My Casinos (P5)
- Timestamp precision
- New entry types
- My Casinos page

### Phase 6: Household (P6)
- Tables, API, persona toggle, invite flow

### Phase 7: Premium (P7)
- Templates, margin, analytics
- Payment integration

### Phase 8: Polish
- Mobile responsiveness
- Performance audit
- Edge cases

---

## Open Questions

1. ~~**Progress bar metric.**~~ **RESOLVED.** SC value for bar, net P/L as KPI card.
2. ~~**Casino intel display depth.**~~ **RESOLVED.** Compact cards: health dot + lead metric (casino-specific, not templated) + 1 sentence. Spotlight: wash game, redeem speed, PB risk, one trap. Profile: everything. AI-generated text uses templated assembly from confirmed KB entries only — no freeform generation.
3. ~~**Getting-started guide generation.**~~ **RESOLVED.** Confidence threshold: 5+ active KB entries across 2+ categories = auto-generate. Below threshold = simplified "here's what we know" card. Admin-written guides for S/A tier override auto-generated. No KB audit needed — system degrades gracefully.
4. ~~**Recommendation algorithm.**~~ **RESOLVED.** Simple: state + tier + intel coverage quality. Single SQL query with score. No collaborative filtering.
5. ~~**KB sync frequency.**~~ **RESOLVED.** Twice daily. Adjustable later based on experience and token usage.
6. ~~**Dashboard URL.**~~ **RESOLVED.** `/dashboard`.
7. ~~**Push notifications.**~~ **RESOLVED.** Deferred. Not in 2.0 scope. When implemented: optional daily reminder ("X unclaimed dailies"), user-configurable time. Not a marketing channel.
8. ~~**State pages.**~~ **RESOLVED.** AI-generated entirely from KB data + casino metadata. SEO hook. No manual maintenance. If KB data is insufficient for a state, the page is thin and that's fine — it'll fill in as intel grows.
9. ~~**Empty states.**~~ **DEFERRED.** Solve when we have a dashboard we're happy with.

**Remaining open:**

10. **Content maintenance long-term.** The KB processor, decay system, and community intelligence layer are the right architecture. Execution requires iteration. The getting-started guides, compact card pitches, and profile page content all depend on KB quality staying high. No open decision here — just an acknowledged risk that needs ongoing attention.

11. **Community intelligence layer scope and timing.** Designed (see P-Future below) but not committed to a phase. Depends on having enough users to generate meaningful signal. Could be Phase 5 or Phase 9.

---

## Decision Log

Decisions made during spec discussion, preserved for context.

### Momentum tracks actual USD, not EV
Dylan's personal site uses expected value because cross-washing between household members creates artificial losses. SweepsIntel users cross-wash between their own accounts on different platforms — losses on Casino A are real losses there, gains on Casino B are real gains there, and the portfolio view nets correctly. No need for EV abstraction.

### Daily claim guard is per reset period, not per calendar day
Some casinos run 6-hour rolling resets (~4 claim windows per day). Each window is independently claimable but double-claiming within a window is blocked. The guard has proven valuable for catching misclicks in Dylan's daily use.

### Three entry modes on one row (Daily/Adjust/Spins)
Proven UX from Dylan's personal site. Mode toggle changes button color/label. Purchase entry is a separate action (different button, not a mode) because it involves USD.

### No simple/advanced mode toggle
Killed. Instead: free tier is the full product (tracker, ledger, purchases, redemptions, discovery, household). Premium adds analytical tools (margin calc, templates, trends, reports). No feature gates on core tracking functionality.

### Purchase entry is free for everyone
Too much of a pain point to gate. Premium makes it easier (templates, duplicates) and smarter (margin calc, RTP-adjusted), but basic "I spent $100 and got 130 SC" is free.

### All casinos shown regardless of affiliate relationship
Don't hurt users. Dylan will sign up for remaining affiliate programs. A casino without an affiliate link still provides value to users, builds trust in the platform, and the user might sign up at affiliated casinos as a result.

### No referral program
Tracking 20+ casino signups per referral, delayed attribution, messy payouts — complexity far exceeds the value. The product's value proposition drives organic sharing without needing incentive mechanics.

### No own Discord community
Management overhead. "I don't want to talk to people directly or manage them or their concerns." Let existing communities (bearcave, Reddit) serve that role. SweepsIntel is a tool, not a community platform.

### Retained users have high ongoing value
Some affiliate programs pay ongoing commission (5% of activity). A retained user who plays daily through the tracker generates recurring revenue. The daily tracker isn't just a retention feature — it directly generates commission revenue through user activity. Product retention = business revenue.

### The product IS the marketing
SweepsIntel teaches people how to make legitimate free money. No paywall. The educational content, casino profiles, and free tools drive organic sharing. Every casino profile is an SEO landing page, a trust builder, and an affiliate conversion page simultaneously.

### Momentum bar tracks SC value earned, net P/L is a separate KPI card
Progress bar uses SC value (dailies + free SC, always positive, always growing). Motivational by design. Net P/L (which can go negative on purchase-heavy days) is shown honestly but separately as a KPI card. Users who care about net P/L can add it to their KPI selection. Users who don't won't be demotivated by a shrinking progress bar.

### KPI cards are user-configurable (3-4 from a pool of 10)
A single KPI box looks lonely. Users pick 3-4 from available options. Defaults are sensible (SC Earned, USD Earned, Purchases, Pending Redemptions) so the dashboard works perfectly out of the box. "Configurable enough that it feels good and personalized, but the default state is perfectly functional."

### Momentum bar supports daily/weekly toggle
Mirrors Dylan's personal site behavior. Some days are purchase-heavy and look bad on a daily view but the week nets positive. Weekly view smooths that out. Both goals are independently settable.

### Discovery section uses spotlight + compact card layout
One detailed rotating featured casino above compact 3-column cards. The spotlight demonstrates the platform's intelligence depth — shows wash games, redeem speed, PB risk, traps. Teaches users passively as they see different spotlights over time. If the intel looks good for a casino they've never heard of, the "Sign Up" click is easy. Rotates based on KB coverage quality for untracked casinos.

### Aggressive client-side caching with surgical invalidation
Dashboard reloaded 100-200+ times per day per active user. Data split into three volatility tiers: near-static (casino metadata, intel — cache 4-6h), session-volatile (today's KPIs, claims — cache in memory, invalidate on writes), and always-fresh (claim guard checks). Server uses ETags for 304 responses. Client uses stale-while-revalidate pattern for instant loads. Pre-computed daily_aggregates table avoids full ledger scans on every KPI request.

### Compact card content uses templated assembly, not freeform AI generation
AI-generated text on compact cards and spotlight descriptions is assembled from confirmed KB entries only. Sentence structures are fixed templates with KB data filling slots. No freeform generation, no pending data surfaced, no fabrication of missing data. Gaps are shown honestly. Each casino's compact card highlights its lead metric (strongest KB category) rather than a one-size-fits-all template.

### Getting-started guides use confidence threshold, not manual audit
5+ active KB entries across 2+ categories = auto-generate from templates. Below threshold = simplified "here's what we know" card. Admin-written guides for S/A tier casinos (15-20) override auto-generated when they exist. No upfront KB audit needed — system degrades gracefully and improves as intel grows.

### Recommendation algorithm is simple SQL scoring
State availability + tier + intel coverage quality. One query. No collaborative filtering — with 50-80 total casinos and binary state filtering, the problem doesn't warrant algorithmic complexity. Revisit only if casino count grows significantly.

### Push notifications deferred from 2.0
Not a marketing channel. When eventually implemented: optional daily reminder with user-configurable time. "You have X unclaimed dailies" is the killer notification — directly drives the retention loop. Everything else is noise.

### State pages are fully AI-generated SEO hooks
Generated entirely from KB data + casino metadata. No manual maintenance by Dylan. Thin pages for states with sparse KB data are acceptable — they'll fill in as intel grows. The point is search ranking, not editorial quality.

### Community intelligence layer validates AI output over time
Pipeline: community chatter → KB processor → structured intel → product surfaces it → community rates it (thumbs up/down) → ratings adjust confidence → disputed entries flagged → Dylan reviews weekly digest. Community can dispute but not censor. Prevents griefing via threshold (3 downvotes + <2 upvotes = disputed). Intel that survives validation promotes to higher decay tiers. Designed but not committed to a build phase — needs user volume first.

---

## Success Criteria

### Revenue
- New user signs up at 3+ casinos in first session
- Active users add 1+ new casino per month
- Affiliate click-through from discovery section > 15%

### Engagement
- Daily active usage (claim at least 1 daily)
- 7-day retention > 60%
- Average session > 3 minutes

### Product
- Daily claim < 3 seconds
- Purchase logging < 10 seconds from dashboard
- Discovery section loads with intel < 2 seconds
- App feels good on desktop and mobile
- Two household users operate independently
