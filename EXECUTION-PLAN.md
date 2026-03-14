# SweepsIntel — 7-Day MVP Execution Plan

**Case:** case-biz-007
**Platform:** SweepsIntel
**Timeline:** 7 days (2026-03-14 to 2026-03-21)
**Owner:** Axiom
**Authority:** Dylan (gates UX changes, new casino intake, strategic decisions)

---

## Executive Summary

This document details the day-by-day build plan for SweepsIntel MVP. The goal: launch a functional, affiliate-driven sweepstakes casino knowledge platform in 7 days with:
- 33+ casino profiles (from bearcave master summary)
- Daily bonus tracker (retention + soft affiliate conversion)
- Basic P&L tracker
- Ban/issue report system with IP deduplication
- Discord invite embed
- Live affiliate links (Dylan-enrolled casinos only)

Success metric: Platform live, affiliate links functional, accepting daily tracking submissions by end of Day 7.

---

## Critical Path & Dependencies

```
Day 1: Tech stack, schema, casino template → Days 2-4: Casino profile content writing
Day 1: Neon schema design → Day 2-3: Backend API scaffolding → Day 4-5: Frontend features
Day 3: Ban report deduplication logic spec → Day 5: Ban report form + moderation queue UI
Day 6: Final testing, affiliate link verification, DNS/domain setup
Day 7: Launch, monitoring, affiliate tracking verification
```

**Critical blockers:**
- All 33 casino affiliate enrollments must be confirmed active by Day 0 evening (Dylan verification)
- Casino profile content must be staged/drafted by end of Day 3 (Collective writes from bearcave data)
- Neon schema must be finalized by end of Day 1 (blocks API work)

---

## Technology Stack Decisions

### Frontend
- **Framework:** Astro.js (3.x)
  - Why: Astro excels at content-heavy sites (casino profiles), static generation with hybrid dynamic routes, minimal JavaScript shipped to browser, built-in image optimization, zero-config routing
  - Astro for pages (casino profiles, homepage, tracker forms) + Astro components for interactive elements (daily tracker, ban report form, P&L dashboard)
  - Build time: ~2 sec per deploy, perfect for rapid iteration

### Backend / Database
- **Database:** Neon PostgreSQL (Dylan confirmed available)
  - Connection: Neon serverless client or standard psycopg2 via connection pooling (Vercel supports both)
  - Schema: 5 tables (see schema section below)
- **API:** Vercel serverless functions (edge functions for sub-100ms latency on tracking queries)
- **Auth:** Email-based OTP (no passwords) for ban report submissions + tracking account creation
  - Session storage: Encrypted HTTP-only cookies (no JWT client-side to avoid leakage)
  - Why: Lightweight, no user friction, suitable for sweepstakes audience

### Content Management
- **Casino profiles:** Markdown (.mdx) files in `/src/content/casinos/` directory
  - Astro's native content collections API for type-safe querying
  - Profiles authored in Markdown, stored in git, deployed with app
  - Daily updates via PR workflow (Collective writes update → Dylan reviews → merge → auto-redeploy)
- **Affiliate link management:** Stored in Neon DB, embedded in MDX at build time
  - Each casino has a row in `casinos` table with Dylan's current affiliate link
  - Links rotated per casino when new programs launch (Dylan provides new link, Collective updates DB + redeploy)

### Hosting & Deployment
- **Host:** Vercel (Dylan confirmed available)
  - Auto-deploys on git push
  - Edge config for fast geographic redirection (not needed MVP but available)
  - Built-in analytics (free tier)
  - Vercel Edge Functions for affiliate link tracking (optional, Phase 2)
- **Domain:** TBD (Dylan to provide; DNS setup ~10 min)

### Cost Profile
- Neon DB: ~$20/month (free tier acceptable for MVP)
- Vercel: Free (hobby tier sufficient for startup phase)
- Stripe (if premium tier added later): Free until revenue
- **Total:** <$100 first month

---

## Data Model & Schema

### 1. Casinos Table
Stores casino metadata and affiliate links. Updated daily by Collective via Neon.

```sql
CREATE TABLE casinos (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,  -- "global-poker", "shuffle", etc.
  name VARCHAR(100) NOT NULL,
  tier INT DEFAULT 2,  -- 1=Tier1 (8-9/10), 2=Tier2 (7-7.5/10), etc.
  rating DECIMAL(3,1),  -- 9.0, 8.5, etc.
  wash_games TEXT,  -- "Dice (98%)", "Blackjack (mobile)", semicolon-separated
  pa_available BOOLEAN DEFAULT TRUE,  -- PA state availability
  ban_risk VARCHAR(50),  -- "None", "Low", "Moderate", "High", "Extreme"
  redemption_speed VARCHAR(50),  -- "Instant (GC)", "20 min", "1-2 days", etc.
  redemption_fee VARCHAR(100),  -- "$0", "Variable ~$3", "Aeropay chargebacks block", etc.
  crossing_available BOOLEAN DEFAULT FALSE,
  crossing_notes TEXT,  -- "WOW cross confirmed", "Family cross (Zula, Fortune)", etc.
  playthrough_multiplier DECIMAL(3,1),  -- 1.0, 2.0, 3.0, etc.
  platform VARCHAR(50),  -- "VGW", "b2", "Ruby", "Hacksaw", etc.
  one_oh_nines_status VARCHAR(50),  -- "Confirmed", "Likely", "Unknown"
  affiliate_link_url TEXT,  -- Dylan's tracked link for this casino
  affiliate_type VARCHAR(20),  -- "CPA", "RevShare", "Both"
  affiliate_enrollment_verified BOOLEAN DEFAULT FALSE,  -- Dylan confirms link is live
  notes TEXT,  -- Warnings, quirks, special notes
  profile_content_md TEXT,  -- Full MDX casino profile (populated from /content/casinos/ at build)
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Note:** `profile_content_md` is denormalized for fast lookup; source-of-truth is Markdown files in git.

### 2. Daily Bonus Claims (User Tracking)
Tracks which dailies a user has claimed across casinos.

```sql
CREATE TABLE daily_bonus_claims (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,  -- Email or opaque user ID
  casino_id INT REFERENCES casinos(id),
  casino_name VARCHAR(100),  -- Denormalized for UX speed
  sc_amount DECIMAL(8,2),  -- SC claimed today (e.g., 1.50)
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  claimed_date DATE DEFAULT CURRENT_DATE,  -- Indexed for "today's claims" queries
  notes TEXT,  -- "Claimed via app", "Manual count", etc.
  is_affiliate_clicked BOOLEAN DEFAULT FALSE,  -- Did user click affiliate link to signup for this casino?
  UNIQUE(user_id, casino_id, claimed_date)  -- One claim per user per casino per day
);

CREATE INDEX idx_daily_by_user_date ON daily_bonus_claims(user_id, claimed_date);
CREATE INDEX idx_daily_by_casino_date ON daily_bonus_claims(casino_id, claimed_date);
```

### 3. P&L Tracking (Ledger)
Records offer spend, SC earned, and redemptions.

```sql
CREATE TABLE pl_ledger (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  casino_id INT REFERENCES casinos(id),
  casino_name VARCHAR(100),  -- Denormalized
  entry_type VARCHAR(20),  -- "spend", "earn", "redeem", "fee"
  amount DECIMAL(10,2),  -- Dollar or SC amount
  sc_amount DECIMAL(8,2),  -- SC earned (if entry_type='earn')
  description TEXT,  -- "Offer spend on Fortune Coins", "Redemption to PayPal", etc.
  is_cross_wash BOOLEAN DEFAULT FALSE,  -- Is this a crossing transaction?
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  recorded_date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX idx_pl_by_user_casino ON pl_ledger(user_id, casino_id, recorded_date);
```

### 4. Ban Reports (UGC with Deduplication)
Community-submitted ban and issue reports.

```sql
CREATE TABLE ban_reports (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  casino_name VARCHAR(100),  -- Denormalized
  issue_type VARCHAR(50),  -- "promoban", "suspension", "redemption_failure", "other"
  reporter_email VARCHAR(255),  -- Optional; hashed in public view
  reporter_ip_hash VARCHAR(64),  -- SHA256(IP) for deduplication
  report_text TEXT NOT NULL,  -- User's description
  severity VARCHAR(20),  -- "low", "medium", "high"
  is_flagged BOOLEAN DEFAULT FALSE,  -- TRUE = awaiting manual review; FALSE = auto-published
  flagged_reason VARCHAR(255),  -- "Duplicate IP (3 reports today)", "Same user, 4 reports", "Unverifiable claim"
  is_published BOOLEAN DEFAULT FALSE,  -- Only flagged=FALSE and is_published=TRUE appear in public feed
  community_votes INT DEFAULT 0,  -- Upvote count for credibility scoring
  report_submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  report_date DATE DEFAULT CURRENT_DATE,
  reviewed_by VARCHAR(100),  -- Collective agent who reviewed (if flagged)
  reviewed_at TIMESTAMP
);

CREATE INDEX idx_reports_by_casino ON ban_reports(casino_id, report_date);
CREATE INDEX idx_reports_published ON ban_reports(is_published, report_date DESC);
CREATE INDEX idx_reports_flagged ON ban_reports(is_flagged, report_date);
CREATE INDEX idx_reports_ip_hash ON ban_reports(reporter_ip_hash, report_date);
```

### 5. Ban Report Aggregation & Alerts (Signal Detection)
Tracks detected uptick patterns for broadcast.

```sql
CREATE TABLE ban_uptick_alerts (
  id SERIAL PRIMARY KEY,
  casino_id INT REFERENCES casinos(id),
  issue_type VARCHAR(50),
  unique_reporters_7d INT,  -- Count of unique IPs reporting in last 7 days
  unique_reporters_24h INT,  -- Count of unique IPs reporting in last 24 hours
  confidence_score DECIMAL(3,2),  -- 0.0 to 1.0; >0.7 triggers broadcast
  alert_message TEXT,  -- "14 reports of promoban on Moonspin in 7 days (9 unique IPs)"
  was_broadcast BOOLEAN DEFAULT FALSE,
  broadcast_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Deduplication Logic (Pseudo-code)

When a ban report is submitted:

```
1. Hash reporter IP: ip_hash = SHA256(request.ip)
2. Check last 7 days for same IP + same casino:
   - If 3+ reports from same IP → flag with reason "Duplicate IP (N reports)"
3. Check last 7 days for same email hash + same casino:
   - If email provided: email_hash = SHA256(email); if 3+ reports → flag
4. Check textual similarity (cosine distance on report text):
   - If 90%+ match to existing report → flag "Duplicate submission"
5. If flagged: is_flagged=TRUE, hold in moderation queue
6. If not flagged: is_published=TRUE, auto-publish to public feed
7. Async job (runs hourly): Re-aggregate ban_uptick_alerts table:
   - For each casino + issue_type combo in last 7 days:
     - Count unique IPs, unique 24h IPs
     - Calculate confidence_score = (unique_ips_7d / 30) ^ 0.8  [tunable]
     - If confidence_score > 0.7 and was_broadcast=FALSE:
       - Generate alert message
       - Broadcast to all subscribed users (email + in-app notification)
       - Set was_broadcast=TRUE
```

---

## Day-by-Day Build Plan

### Day 1 (Friday, 2026-03-14) — Scaffold & Schema
**Goal:** Project initialized, schema finalized, templates created, first 10 casinos drafted.

**Daily standup with Dylan:** 5:00 PM (30 min) — review tech decisions, confirm casino list, approve schema.

**Tasks:**

1. **Initialize Astro project** (1 hour)
   - `npm create astro@latest` → sweepsintel directory
   - Select: TypeScript, React integration (for tracker form), Tailwind CSS
   - Install dependencies: `npm install`
   - Git init + initial commit

2. **Set up Neon database** (30 min)
   - Create new Neon project via Dylan's account or shared access
   - Get connection string → store in `.env.local` (Vercel secrets later)
   - Test connection: simple `SELECT 1` query
   - Document connection steps in `docs/NEON_SETUP.md`

3. **Design & execute Neon schema** (2 hours)
   - Run all 5 CREATE TABLE statements above in Neon console
   - Verify indexes are created
   - Add sample row to `casinos` table (e.g., Global Poker) for testing
   - Create backup script: `scripts/backup-neon.sh` (pg_dump via Neon API)

4. **Create Astro content structure** (1 hour)
   - Create `/src/content/casinos/` directory
   - Create `/src/content/config.ts` (Astro collection schema for casino profiles)
   - Create casino profile template file: `/src/content/casinos/_template.mdx` with frontmatter:
     ```yaml
     ---
     name: "Casino Name"
     slug: "casino-slug"
     tier: 2
     rating: 7.5
     washGames: "Blackjack (mobile-only)"
     paAvailable: true
     banRisk: "Low"
     redemptionSpeed: "20 min (bank transfer)"
     affiliateLink: "https://affiliate.casino.com/refid-dylan"
     ---
     ```
   - Create `src/content/casinos/global-poker.mdx` as first example (from master summary tier 1)

5. **Create API route scaffolds** (1.5 hours)
   - `/api/casinos.ts` — GET all casinos, GET casino by slug
   - `/api/claims/add.ts` — POST new daily claim
   - `/api/claims/today.ts` — GET today's claims for logged-in user
   - `/api/reports/submit.ts` — POST new ban report (with deduplication logic)
   - `/api/reports/feed.ts` — GET published reports
   - Stub implementations only; no DB connection yet

6. **Create Astro pages structure** (1 hour)
   - `/src/pages/index.astro` — Homepage (hero, top 5 casinos, signup CTA)
   - `/src/pages/casinos/[slug].astro` — Dynamic casino profile page
   - `/src/pages/casinos/index.astro` — Casino directory listing
   - `/src/pages/tracker.astro` — Daily bonus tracker (requires auth)
   - `/src/pages/pl.astro` — P&L tracker (requires auth)
   - `/src/pages/reports.astro` — Ban/issue feed (public)
   - `/src/pages/submit-report.astro` — Report submission form (public)

7. **Draft first 10 casino profiles from master summary** (2.5 hours)
   - Axiom writes `.mdx` files for:
     1. Global Poker (Tier 1, 9/10)
     2. Shuffle (Tier 1, 8/10)
     3. Betr (Tier 2, 7.5/10)
     4. Fliff (Tier 2, 7.5/10)
     5. American Luck (Tier 2, 7/10)
     6. Gold Machine (Tier 2, 7/10)
     7. LuckyRush (Tier 2, 7/10)
     8. Moozi (Tier 2, 7/10)
     9. Scrooge (Tier 2, 7/10)
     10. Spindoo (Tier 2, 7/10)
   - Each profile includes: wash game, PA info, crossing chains, redemption details, ban risk rating, affiliate link placeholder
   - Format: ~200-300 words per casino, highlight risks and strategies

**Dylan review checkpoint (5:00 PM):**
- [ ] Approve tech stack (Astro.js, Neon, Vercel)
- [ ] Confirm 33 casinos to profile (master summary + Dylan's additional ~30)
- [ ] Verify all 33 affiliate links are enrolled and active
- [ ] Approve first 10 casino profile drafts (Axiom to share via screen/document)

**End of Day 1 deliverables:**
- Astro project initialized and committed to git
- Neon database created, 5 tables + indexes deployed
- Astro content structure ready (`/src/content/casinos/`)
- 10 casino profile `.mdx` files ready for Dylan review
- API route scaffolds in place (stub implementations)
- Astro page templates created

**Time estimate:** 9-10 hours solo Axiom work + 0.5 hour Dylan review

---

### Day 2 (Saturday, 2026-03-15) — Casino Profiles & Auth Backend
**Goal:** All 33 casino profiles drafted (Axiom writes remaining 23), basic auth system working.

**Tasks:**

1. **Write remaining 23 casino profiles** (3.5 hours)
   - Casinos 11-33 from master summary + additional tier-3 & tier-4 casinos Dylan provides
   - Format matches first 10; each profile links to affiliate URL
   - Quality check: all profiles have wash game, PA status, ban risk, redemption method

2. **Implement email OTP auth** (3 hours)
   - Create auth schema: `auth_sessions` table (user_email, otp_token, expires_at, verified_at)
   - `/api/auth/request-otp.ts` — user submits email → Neon stores hashed OTP + timestamp → send email with OTP
   - `/api/auth/verify-otp.ts` — user submits OTP → verify hash, create session cookie, set 60-day expiry
   - Create `src/middleware/auth.ts` — check session cookie on protected pages (/tracker, /pl, /submit-report)
   - Email sending: use Resend API (free tier, 100/day) or Vercel email (built-in)

3. **Connect DB to API routes** (2 hours)
   - Update `/api/casinos.ts` to query Neon casinos table
   - Update `/api/claims/add.ts` to insert into daily_bonus_claims
   - Add deduplication check: one claim per user per casino per day (UNIQUE constraint handles DB-level, form prevents duplicate submission)
   - Add affiliate_link from casinos table to response

4. **Create Astro content loader** (1.5 hours)
   - Modify `/src/pages/casinos/[slug].astro` to:
     - Query `/api/casinos?slug=` at build time or request time
     - Render casino profile MDX content
     - Embed affiliate link CTA prominently (button: "Sign Up & Claim Daily Bonus")
     - Display wash game, PA status, crossing info, ban risk rating

5. **Build Daily Bonus Tracker UI** (2.5 hours)
   - `/src/pages/tracker.astro` — React component (Astro island)
   - Displays: list of 33 casinos, claimed/unclaimed status for today, SC total claimed
   - Form: for each casino, input SC amount claimed, submit → `/api/claims/add`
   - Auto-populate from yesterday's claims (show what was claimed last day, prefill common values)
   - CTA: "Sign up at [Casino Name]" button with affiliate link (only for casinos not yet joined)

6. **Stub out ban report deduplication** (1 hour)
   - `/api/reports/submit.ts` — full implementation:
     - Hash reporter IP
     - Query ban_reports last 7 days, same casino + IP: if 3+, flag
     - Hash email if provided, check same: if 3+, flag
     - Textual similarity check (simple: token overlap >90%)
     - If flagged: is_flagged=TRUE, reviewed_by=NULL
     - If not flagged: is_published=TRUE
   - Create `/api/reports/moderation-queue.ts` — GET flagged reports (Dylan-only; requires auth role)

**Dylan review checkpoint (6:00 PM):**
- [ ] Approve all 33 casino profile drafts (final edits)
- [ ] Confirm Daily Bonus Tracker UX (test at least 3 casinos)
- [ ] Test auth flow (request OTP, verify, access tracker)

**End of Day 2 deliverables:**
- All 33 casino profiles drafted, formatted, uploaded to git
- Email OTP auth fully functional
- Daily Bonus Tracker UI functional, linked to DB
- Ban report deduplication logic implemented
- API routes connected to Neon DB

**Time estimate:** 13-14 hours solo Axiom + 0.5 hour Dylan review

---

### Day 3 (Sunday, 2026-03-16) — P&L Tracker & Ban Feed
**Goal:** P&L tracker functional, ban report feed live, Discord embed configured.

**Tasks:**

1. **Build P&L Tracker UI & Backend** (3 hours)
   - `/src/pages/pl.astro` — P&L dashboard
   - Display: summary (total spend, total earned, net profit), per-casino breakdown, daily/weekly/monthly filters
   - Form: add ledger entries (Casino name, Type [spend/earn/redeem], Amount, Date, Description)
   - `/api/pl/add.ts` — POST to pl_ledger table
   - `/api/pl/summary.ts` — GET user's P&L stats (total spent, total earned, net, by casino)
   - Generate simple CSV export (Dylan requested in constraint notes)

2. **Ban Report Feed & Public Page** (2 hours)
   - `/src/pages/reports.astro` — Public, unauthenticated page
   - Displays: real-time feed of published ban reports (is_published=TRUE, is_flagged=FALSE)
   - Filters: by casino, by issue type, date range
   - `/api/reports/feed.ts` — GET published reports with pagination (20 per page)
   - Sort by: newest first, optionally by confidence_score (if uptick alerts implemented)

3. **Create Ban Report Form** (1.5 hours)
   - `/src/pages/submit-report.astro` — public form
   - Fields: Casino (dropdown), Issue Type (select), Email (optional), Description
   - Client-side validation: non-empty casino + description
   - Server-side deduplication: happens in `/api/reports/submit.ts` (already built Day 2)
   - Success message: "Report submitted! We'll review and publish within 24 hours."
   - UX note: no CAPTCHA at MVP (will add if spam detected)

4. **Implement Ban Uptick Detection (Async Job)** (2 hours)
   - Create `/scripts/detect-ban-upticks.ts` — runs on schedule (hourly)
   - Logic: for each casino + issue_type combo in last 7 days:
     - Count unique reporter IPs in ban_reports (is_published=TRUE)
     - Count unique IPs in last 24h
     - Calculate confidence_score = (unique_ips_7d / 25) ^ 0.8  [tunable threshold]
     - If score > 0.7 and was_broadcast=FALSE: insert into ban_uptick_alerts, set was_broadcast=TRUE
   - For MVP: run script manually (Collective runs via CLI); later automate via Vercel cron function

5. **Discord Embed Configuration** (1 hour)
   - Add Discord invite widget to homepage + sidebar (persistent)
   - Get Discord invite link from Dylan (for SweepstakeSideHustle server)
   - Embed using Discord widget: `https://discord.com/widget?id=SERVER_ID&theme=dark`
   - Place in: `/src/components/DiscordPanel.astro`
   - Test: load homepage, verify embed loads + invite works

6. **Create Dashboard / Onboarding Page** (1.5 hours)
   - `/src/pages/dashboard.astro` — logged-in user homepage
   - Shows: today's bonus claims total, this week's P&L, next recommended casinos to signup
   - CTA buttons: "Track Today's Bonus", "View P&L", "Read Casino Guide", "Report Ban Issue"
   - For new users: brief onboarding modal explaining the platform

**Dylan review checkpoint (5:00 PM):**
- [ ] Test P&L tracker (add a few entries, verify calculations)
- [ ] Check ban report feed (submit a test report, verify moderation queue)
- [ ] Confirm Discord embed + invite URL correct
- [ ] Final UX review: homepage, tracker, P&L, reports

**End of Day 3 deliverables:**
- P&L tracker fully functional
- Ban report feed + form live
- Ban uptick detection logic ready
- Discord embed configured
- Onboarding flow implemented

**Time estimate:** 11-12 hours solo Axiom + 0.5 hour Dylan review

---

### Day 4 (Monday, 2026-03-17) — Content Polish & Testing
**Goal:** All casino profiles finalized, content polished, final testing of all features.

**Tasks:**

1. **Polish all 33 casino profiles** (3 hours)
   - Dylan + Axiom review all profiles
   - Edits: accuracy check (wash game names, PA availability, redemption speeds), add missing data, fix typos
   - Add affiliate links: Dylan confirms all 33 links are current + trackable
   - Add "Last Updated" date to each profile frontmatter

2. **Create Homepage & About Page** (2 hours)
   - `/src/pages/index.astro` — redesign with:
     - Hero section: "The Casino Intelligence Platform for Sweepstakes Players"
     - Subheading: "Track daily bonuses. Avoid bans. Know your casinos."
     - Top 5 casinos carousel (highest rated)
     - 3-column feature section: "Daily Bonus Tracker", "Ban Intelligence", "P&L Reports"
     - CTA: "Start Tracking Now" (auth button)
     - Social proof: "33 casinos profiled. 100+ community reports. $400k+ community winnings."
   - `/src/pages/about.astro` — explain mission, data sources, affiliate transparency

3. **Create Guides Section** (1.5 hours)
   - `/src/pages/guides/index.astro` — guide directory
   - Create 3-5 starter guides:
     - "Newcomer's Guide: Which Casino to Start With"
     - "Wash Game Strategies: Highest Win Rates"
     - "Avoiding Promobans: Safe Play Strategies"
     - "Crossing Chains: Maximizing SC Across Casinos"
     - "Redemption Methods: Fastest Payouts"
   - Each guide: ~500 words, links to relevant casino profiles

4. **Build Admin/Moderation UI** (2 hours)
   - `/src/pages/admin/moderation.astro` — restricted to Dylan only (auth role check)
   - Displays: flagged ban reports (is_flagged=TRUE), with approve/reject buttons
   - Approve: set is_flagged=FALSE, is_published=TRUE
   - Reject: set is_flagged=FALSE, is_published=FALSE (delete from view)
   - Shows: reporter IP hash, report text, reason flagged
   - `/api/admin/approve-report.ts`, `/api/admin/reject-report.ts`

5. **Create Affiliate Tracking Dashboard** (1 hour)
   - `/src/pages/admin/affiliate-dashboard.astro` — Dylan-only
   - Shows: total clicks per casino (from analytics or DB log), estimated CPA conversions, revenue tracking
   - Note: full revenue tracking requires CPA provider API integration (Phase 2); MVP shows click counts only
   - Rough data: count of `/api/click?casino=X` hits (add simple click log to DB)

6. **Full UAT Testing** (2 hours)
   - Test all happy paths:
     - [ ] Create account via OTP, login, logout
     - [ ] Add daily bonus claims for 5 casinos
     - [ ] Check daily total calculations
     - [ ] Add P&L entries, verify running net
     - [ ] Submit ban report (unverified), check it's flagged
     - [ ] Submit duplicate report (same IP), verify flagged
     - [ ] Check public ban feed (published reports visible, flagged hidden)
     - [ ] Navigate casino directory, click affiliate links, verify they work
     - [ ] Check Discord embed on homepage
   - Bug fix: any issues found

7. **Prepare Launch Checklist** (1 hour)
   - Create `/docs/LAUNCH-CHECKLIST.md`:
     - [ ] All affiliate links verified live (Dylan confirmation)
     - [ ] All casino profiles final-reviewed (Dylan approval)
     - [ ] Database backups configured
     - [ ] Domain DNS configured (waiting on domain provider)
     - [ ] Vercel environment variables set (.env)
     - [ ] Email sending tested (OTP delivery confirmed)
     - [ ] Analytics configured (Vercel analytics enabled)
     - [ ] Legal/ToS reviewed (basic disclaimer added)
     - [ ] Mobile responsiveness tested

**Dylan review checkpoint (6:00 PM):**
- [ ] Final review of all 33 casino profiles
- [ ] Test full user flow (signup → track bonus → view P&L → submit report)
- [ ] Verify all affiliate links are live and trackable
- [ ] Approve homepage copy and guides
- [ ] Confirm launch date/time

**End of Day 4 deliverables:**
- All casino profiles polished + final-approved
- Homepage, guides, admin UI complete
- Full feature UAT complete (no critical bugs)
- Launch checklist created and verified

**Time estimate:** 12 hours solo Axiom + 1 hour Dylan review

---

### Day 5 (Tuesday, 2026-03-18) — Backend Optimization & Edge Cases
**Goal:** Performance optimization, edge case handling, API hardening.

**Tasks:**

1. **Database Indexing & Query Optimization** (1.5 hours)
   - Review slow queries (use Neon console slow query log)
   - Add indexes for common queries:
     - `/api/claims/today.ts` → query by user_id + claimed_date (already indexed)
     - `/api/reports/feed.ts` → query is_published=TRUE, order by date (already indexed)
     - `/api/pl/summary.ts` → query by user_id, group by casino_id (add index)
   - Verify all SELECT queries use indexes (EXPLAIN ANALYZE)

2. **Rate Limiting & Spam Protection** (1.5 hours)
   - Add rate limiting to `/api/reports/submit.ts`: max 5 reports per IP per day
   - Add rate limiting to `/api/auth/request-otp.ts`: max 3 OTP requests per email per hour
   - Implement using Redis (Vercel KV) or simple in-memory store (acceptable for MVP)
   - Return 429 if exceeded + helpful message

3. **Input Validation & Sanitization** (1 hour)
   - Validate all POST request bodies:
     - `/api/claims/add.ts`: casino_id (int), sc_amount (decimal), claimed_date (date)
     - `/api/pl/add.ts`: casino_id (int), entry_type (enum), amount (decimal), description (string)
     - `/api/reports/submit.ts`: casino_id (int), issue_type (enum), reporter_email (email opt.), report_text (string)
   - Sanitize text fields: strip HTML/scripts, max length 1000 chars for reports
   - Return 400 with error message if invalid

4. **Session Security & CSRF Protection** (1 hour)
   - Add CSRF token to all forms (Astro middleware generates + validates)
   - Set secure cookie flags: HttpOnly, SameSite=Lax, Secure (HTTPS only)
   - Add request signing: POST requests require valid session + CSRF token
   - Test: attempt to submit form without token → should fail

5. **Error Handling & Logging** (1 hour)
   - Add try-catch to all API routes
   - Log errors to console (Vercel captures logs)
   - Return user-friendly error messages (don't leak DB schema)
   - Create error boundary page (`/src/pages/500.astro`) for crashes

6. **Cache Headers & Static Generation** (1 hour)
   - Set cache headers for casino profiles: `Cache-Control: public, max-age=3600` (1 hour)
   - Casino directory listing: cache 10 minutes
   - Dynamic pages (tracker, P&L): no cache (user-specific)
   - Ban report feed: cache 5 minutes (updated frequently)
   - Prerender static casinos at build time (Astro default)

7. **Affiliate Link Tracking** (1 hour)
   - Create `/api/click.ts` — simple click logger
   - When user clicks casino affiliate link, route through `/api/click?casino=X&ref=Y`
   - Log to clicks table (casino_id, user_id if logged in, timestamp, referrer)
   - Redirect to affiliate URL
   - Note: CPA attribution happens at casino provider; we track clicks only

**Dylan review checkpoint (4:00 PM):**
- [ ] Performance test: homepage load time <2 sec, tracker <1 sec
- [ ] Security review: no obvious vulnerabilities (manual check)
- [ ] Test error scenarios: invalid inputs, network errors, rate limits

**End of Day 5 deliverables:**
- Database indexes optimized
- Rate limiting implemented
- Input validation complete
- Session security hardened
- Error handling robust
- Click tracking functional

**Time estimate:** 8-9 hours solo Axiom

---

### Day 6 (Wednesday, 2026-03-19) — Domain, DNS & Pre-Launch Setup
**Goal:** Domain live, DNS configured, final integration testing, staging deployment.

**Tasks:**

1. **Domain Setup & DNS** (1 hour)
   - Dylan provides domain name (e.g., sweepsintel.com)
   - Register domain (if not already) — Dylan handles or Collective via Godaddy/Namecheap
   - Add Vercel nameservers to domain registrar
   - Verify DNS propagation (may take 15-30 min)
   - Test: `nslookup sweepsintel.com` should resolve to Vercel IP

2. **Vercel Deployment & Environment Setup** (1.5 hours)
   - Create Vercel project (link to git repo)
   - Set environment variables in Vercel dashboard:
     - `DATABASE_URL` = Neon connection string
     - `RESEND_API_KEY` (for email OTP)
     - `DISCORD_INVITE_URL` (for embed widget)
     - `AFFILIATE_TRACKING_ENABLED` = true
   - Deploy main branch to production
   - Test production domain: https://sweepsintel.com/

3. **SSL Certificate & HTTPS Verification** (30 min)
   - Vercel auto-provisions Let's Encrypt SSL (automatic)
   - Verify HTTPS works: `curl -I https://sweepsintel.com/`
   - Test all pages load over HTTPS

4. **Email Delivery Testing** (1 hour)
   - Send test OTP email to Dylan + Axiom
   - Verify email arrives within 30 sec
   - Verify OTP code works
   - Check email headers (SPF/DKIM) if possible (Resend handles)
   - If email fails: fallback to SMS OTP (Twilio) or display OTP in-app for testing

5. **Analytics & Monitoring Setup** (1 hour)
   - Enable Vercel Analytics (free tier)
   - Add Google Analytics 4 tag (optional, Dylan's preference)
   - Set up basic alerts: if traffic >50k requests/day, notify (unlikely MVP)
   - Monitor Neon DB: check slow query logs, connection count

6. **Final Integration Testing** (1.5 hours)
   - Full end-to-end test on production domain:
     - [ ] Homepage loads, all links work
     - [ ] Create account via email OTP
     - [ ] Login, access tracker
     - [ ] Add daily claims, verify saved in DB
     - [ ] Add P&L entries, verify calculations
     - [ ] Submit ban report, check moderation queue (as Dylan/admin)
     - [ ] Check public ban feed, verify published reports visible
     - [ ] Navigate all casino profiles, click affiliate links
     - [ ] Check Discord embed loads
     - [ ] Test mobile responsiveness (iPhone + Android)
   - Bug fixes: any issues found

7. **Create Monitoring & Runbook Docs** (1 hour)
   - `/docs/RUNBOOK.md` — how to handle common issues:
     - Database down: fallback behavior
     - Email failing: manual OTP or SMS bypass
     - Affiliate link broken: how to update
     - High traffic spikes: Vercel auto-scales, no action needed
     - Ban report spam: manual moderation queue review
   - `/docs/POSTLAUNCH-MONITORING.md` — daily checklist:
     - [ ] Check Vercel analytics (traffic, errors)
     - [ ] Check Neon slow query log
     - [ ] Review moderation queue (flagged ban reports)
     - [ ] Verify affiliate link clicks and conversions trending

**Dylan review checkpoint (5:00 PM):**
- [ ] Production domain live + HTTPS verified
- [ ] Full production test: account creation → tracking → affiliate links
- [ ] Email delivery working
- [ ] Analytics dashboard accessible
- [ ] Go/no-go for launch tomorrow

**End of Day 6 deliverables:**
- Domain live, DNS configured, SSL active
- Vercel production deployment complete
- All environment variables configured
- Full end-to-end test passed
- Monitoring dashboard set up
- Runbooks created

**Time estimate:** 8-9 hours solo Axiom + 1 hour Dylan sign-off

---

### Day 7 (Thursday, 2026-03-20) — Launch & Day 1 Monitoring
**Goal:** Platform live, monitoring active, affiliate tracking verified, community announcement.

**Tasks:**

1. **Pre-Launch Final Checklist** (1 hour)
   - [ ] All 33 casinos displayed in directory
   - [ ] All affiliate links verified live (random spot check)
   - [ ] Ban report feed showing published reports
   - [ ] User onboarding email configured (welcome email after signup)
   - [ ] Vercel monitoring alerts configured
   - [ ] Database backups scheduled (daily snapshots)

2. **Community Launch Announcement** (30 min)
   - Dylan posts announcement in SweepstakeSideHustle Discord:
     - "SweepsIntel now live: [domain], track daily bonuses across 33 casinos, community ban intelligence, free tracking tools"
     - Link to platform
     - Call-to-action: "Sign up + start tracking"
   - Post to Reddit: r/sweepstakes, r/gambling
   - Share link in personal networks (Dylan's existing players)

3. **Go Live** (immediate)
   - Last health check: platform loads, no 500 errors
   - Enable analytics tracking
   - Begin monitoring (real-time)

4. **Day 1 Monitoring Shift** (6-8 hours)
   - **Axiom monitors:**
     - [ ] Traffic flowing (>10 users expected, realistic: 2-5)
     - [ ] Affiliate links clicked (track via `/api/click` logs)
     - [ ] Ban reports submitted (expect 0-5 on day 1)
     - [ ] No critical errors in Vercel logs
     - [ ] Database connection stable
     - [ ] Email delivery working (if users signup)
   - **Dylan monitors:**
     - [ ] User feedback (Discord, email)
     - [ ] Affiliate program confirmations (any issues from casinos?)
     - [ ] Content accuracy (any casinos outdated?)

5. **Real-Time Issue Response** (on-call)
   - Bug found? Axiom fixes + redeploys (Vercel auto-deploys git push)
   - Database issue? Rollback to backup or notify Dylan
   - Spam reports? Manual review in moderation queue
   - Missing data? Update casino profile via git push

6. **Evening Standdown & Day 1 Report** (2 hours)
   - Compile Day 1 metrics:
     - Total visits: X
     - Signups: Y
     - Affiliate clicks: Z
     - Ban reports submitted: W
     - Critical issues: [list]
   - Update case file with execution log
   - Document any issues + fixes applied

7. **Post-Launch Tweaks** (as needed)
   - If traffic is higher than expected (unlikely): scale DB connection pool
   - If email is failing: switch to SMS OTP or display code in-app
   - If spam reports detected: lower spam threshold, add CAPTCHA
   - If no signups: review onboarding flow, landing page copy

**Dylan review checkpoint (7:00 PM, end of Day 1):**
- [ ] Platform stable, no critical errors
- [ ] At least 1 signup and affiliate click verified
- [ ] Day 1 report reviewed: traffic, issues, next steps

**End of Day 7 deliverables:**
- Platform LIVE: https://sweepsintel.com/
- First users gaining value (tracking bonuses, viewing casinos)
- Affiliate links driving clicks
- Monitoring active, no critical issues
- Day 1 success metrics logged

**Time estimate:** 10-12 hours shared between Axiom + Dylan (active monitoring)

---

## Affiliate Link Architecture

### How Affiliate Links Are Embedded

1. **Source:** Dylan provides affiliate URL for each casino (tracked via his account/referral code)
   - Example: `https://globalpokertournaments.com/?ref=dylan_001`
   - Stored in Neon `casinos` table, column `affiliate_link_url`

2. **Embedding in Casino Profiles:**
   - Each casino profile page displays a prominent CTA button:
     ```
     [Sign Up & Claim Daily Bonus] → https://affiliate.casino.com/?ref=dylan
     ```
   - Button links directly to Dylan's affiliate URL
   - For new users (no account), clicking any casino link routes through affiliate URL (primary conversion)

3. **Daily Bonus Tracker Integration:**
   - Users check off which daily bonuses they've claimed
   - For casinos they haven't joined yet, a "Sign Up" link appears next to that casino
   - Clicking "Sign Up" routes through affiliate link
   - Secondary soft affiliate conversion: users coming back daily will eventually click signup links for casinos they're not yet on
   - This is THE stickiness mechanism: daily tracking habit + opportunistic signup

4. **Click Tracking:**
   - Link format: `/api/click?casino=global-poker&source=tracker`
   - Logs to `clicks` table: casino_id, user_id (optional), timestamp, referrer
   - Provides Dylan with click count per casino per day
   - CPA attribution (actual conversion) happens at casino provider (Dylan's affiliate dashboard)

5. **Link Rotation/Updates:**
   - When a casino changes affiliate program or Dylan enrolls in new program: Dylan provides new link
   - Collective updates DB: `UPDATE casinos SET affiliate_link_url='...' WHERE slug='global-poker'`
   - Vercel redeploy: automatic (changes sync to production within 1 min)
   - No downtime, no user-facing change

### Revenue Attribution

- **MVP tracking:** click counts only (what we count)
- **Actual revenue:** Dylan monitors his affiliate dashboards at each casino provider
  - CPA: $20-40 per new signup (Dylan verified)
  - RevShare: 20-40% of player losses (Dylan confirmed available per casino)
- **Reporting:** Dylan provides weekly revenue summary to Axiom for case file updates
- **Success threshold:** $1k in affiliate revenue by end of 30 days

---

## Daily Bonus Tracker Data Model & UX

### Schema (Already Defined Above)

`daily_bonus_claims` table:
- One row per user per casino per day
- Tracks: user_id, casino_id, sc_amount, claimed_at, is_affiliate_clicked

### User Flow

1. **New User:**
   - Signup via email OTP
   - Sees list of 33 casinos
   - Each casino shows: daily SC amount (e.g., $1.50), claimed/unclaimed today
   - Claim button (if not claimed) or checkmark (if claimed)

2. **Daily Habit:**
   - User visits tracker every morning
   - Quickly checks off which casinos had daily bonuses claimed
   - Sees running total: "Today: 47 SC claimed ($12.50 value)"
   - Sees which casinos they haven't joined yet ("Sign up at [Casino]")

3. **Affiliate Conversion Point:**
   - User hasn't joined Casino X yet
   - Sees "Sign up at Casino X" button next to it
   - Clicks → routes through Dylan's affiliate link → user opens casino page, signs up
   - Collective logs: is_affiliate_clicked=TRUE in daily_bonus_claims row
   - Dylan's affiliate dashboard records deposit/conversion
   - Collective counts toward monthly affiliate revenue

### Retention Mechanics

- **Stickiness:** Users return daily (habit + daily bonus value)
- **Conversion:** With 33 casinos, users will eventually signup for new ones (low friction signup flow in tracker)
- **LTV:** User who signs up for 20 casinos = 20 × $20-40 CPA = $400-800 lifetime value (Dylan's math)
- **Secondary Value:** Daily tracking tool itself is valuable (saves time vs. spreadsheet)

---

## Ban Report Deduplication Logic — Detailed Spec

### Submission Flow

When a user submits a ban report via `/api/reports/submit.ts`:

```
1. Extract reporter IP from request: ip = request.headers['x-forwarded-for'] || request.ip
2. Hash IP: ip_hash = SHA256(ip)
3. Get email if provided, hash: email_hash = SHA256(email) if email else null
4. Query database: reports in last 7 days with same casino_id
5. Deduplication checks:

   a) IP Duplicate Check:
      - COUNT(*) WHERE casino_id=X AND reporter_ip_hash=ip_hash AND report_date >= CURRENT_DATE - 7
      - If count >= 3: flag with reason "Duplicate reporter (3+ reports from same IP)"

   b) Email Duplicate Check (if email provided):
      - COUNT(*) WHERE casino_id=X AND reporter_email_hash=email_hash AND report_date >= CURRENT_DATE - 7
      - If count >= 3: flag with reason "Duplicate reporter (3+ reports from same email)"

   c) Textual Similarity Check:
      - Compute cosine similarity between report_text and all other reports (same casino, last 7 days)
      - Tokenize text: split into words, remove stop words, compute TF-IDF vectors
      - If any similarity > 0.90: flag with reason "Likely duplicate submission"

   d) Overall Decision:
      - If any check flags: is_flagged=TRUE, is_published=FALSE, flagged_reason=[reason from step c]
      - Else: is_flagged=FALSE, is_published=TRUE

6. Insert into ban_reports table
7. Return to user: "Report submitted. Thank you!" (same message regardless of flagged status)
```

### Moderation Queue

Dylan (admin) accesses `/src/pages/admin/moderation.astro`:
- Displays all flagged reports (is_flagged=TRUE)
- Shows: casino, reporter IP hash (first 8 chars), report text, reason flagged, report date
- Actions: [Approve] [Reject] [Mark as Spam]
  - Approve: set is_flagged=FALSE, is_published=TRUE (goes live immediately)
  - Reject: set is_flagged=FALSE, is_published=FALSE (deleted from view)
  - Spam: set is_flagged=FALSE, is_published=FALSE, future reports from that IP auto-flagged

### Uptick Detection (Confidence Scoring)

Hourly async job (`scripts/detect-ban-upticks.ts`):

```
For each (casino_id, issue_type) pair in ban_reports table (last 7 days):

1. Count unique reporter IPs:
   - unique_ips_7d = COUNT(DISTINCT reporter_ip_hash) WHERE is_published=TRUE, last 7 days
   - unique_ips_24h = COUNT(DISTINCT reporter_ip_hash) WHERE is_published=TRUE, last 24 hours

2. Calculate confidence score:
   - confidence_score = (unique_ips_7d / THRESHOLD) ^ EXPONENT
   - THRESHOLD = 25 casinos in network (estimated)
   - EXPONENT = 0.8 (tunable)
   - Example: 10 unique IPs / 25 ^ 0.8 = 0.4 * 0.8 = 0.32 (low)
   - Example: 50 unique IPs / 25 ^ 0.8 = 2.0 * 0.8 = 0.77 (HIGH → broadcast)

3. Broadcast Logic:
   - If confidence_score > 0.70 AND was_broadcast=FALSE:
     - Generate alert message: "⚠️ Ban Spike on [Casino]: 14 reports of [issue_type] from 10 unique players (7 days)"
     - Insert into ban_uptick_alerts table
     - Set was_broadcast=TRUE
     - Send email/notification to all subscribed users
   - Else if confidence_score already broadcast: skip

4. Notification Delivery (Phase 2):
   - Email: "SweepsIntel Alert: [Casino Name]" (HTML email with details)
   - In-app: red banner at top of tracker page, clickable for details
   - Discord: optional webhook notification to SweepstakeSideHustle server
```

### Implementation Notes

- **Similarity matching:** Use simple token-based matching (word overlap) for MVP; can upgrade to ML embedding (Phase 2)
- **False positives:** Some legitimate duplicate submissions (same casino, different players). System flags, Dylan approves in moderation. This is fine.
- **Spam resistance:** Rate limiting + IP hashing reduces abuse. If spam detected, lower threshold or add CAPTCHA.
- **Privacy:** Email hash + IP hash are one-way (can't reverse). No PII exposed in public feed.

---

## P&L Tracker Data Model & UX

### Schema (Already Defined Above)

`pl_ledger` table:
- One row per ledger entry
- Tracks: user_id, casino_id, entry_type (spend/earn/redeem/fee), amount, sc_amount, description, recorded_date

### User Flow

1. **Add Entry:**
   - Form with fields:
     - Casino (dropdown, 33 options)
     - Type (select: Offer Spend, SC Earned, Redemption, Fee)
     - Amount ($)
     - SC Amount (if earning SC, otherwise hidden)
     - Description (free text: "Offer spend on 888sport", "Redemption to PayPal", etc.)
     - Date (default: today, user can backdate)
   - Submit → `/api/pl/add.ts` → insert into pl_ledger

2. **View Summary:**
   - Dashboard displays:
     - Total Spend (all time, this week, this month)
     - Total SC Earned
     - Total Redeemed
     - Net Profit = Total Redeemed - Total Spend
     - Per-casino breakdown (table: Casino, Spend, Earned, Redeemed, Net)
   - Charts (simple): daily/weekly net trend
   - Filters: date range, casino

3. **Export:**
   - CSV download: all ledger entries, formatted for tax prep
   - Columns: Date, Casino, Type, USD Amount, SC Amount, Description

### Secondary Use Case

- User plans to redeem $1k but wants to track net per casino
- Adds entries as they play: offer spends, SC earned, crossing details
- At redemption time: sees which casino gave best ROI, adjusts strategy
- Tax tracking: CSV export for 1099 reference

---

## Content Staging Plan (Collective Workflow)

### Source Data
- **Bearcave master summary** (33 casinos): Dylan + Collective maintain
- **Dylan's additional casinos** (~30 more): Dylan provides list + details
- **Community input:** Discord discussions, DMs, feedback

### Writing Process

1. **Phase 1 (Day 1-2):** First 10 profiles (Axiom writes from master summary)
   - Dylan reviews, approves, suggests edits
   - Format confirmed: Markdown, ~250 words, wash game + PA + ban risk + redemption

2. **Phase 2 (Day 2-3):** Remaining 23 profiles + tier 3-4 casinos (Axiom writes)
   - Dylan provides additional ~30 casinos + brief notes
   - Axiom writes full profiles following template
   - Dylan spot-checks random 5, approves batch

3. **Phase 3 (Day 4):** Final polish
   - Dylan + Axiom do final accuracy pass
   - Check for: outdated info, missing wash games, incorrect state availability
   - Add latest affiliate links

4. **Ongoing (Weeks 2+):**
   - Dylan monitors bearcave-chat for new casino info
   - Provides weekly updates to Collective
   - Collective writes profiles for new casinos (Dylan gate required before publish)

### SOP: Adding a New Casino Post-MVP

1. Community flags: "Is XYZ Casino worth adding?"
2. Dylan evaluates: security, legitimacy, affiliate availability
3. If approved: Dylan provides casino details + affiliate link
4. Collective writes profile (~2 hours)
5. Dylan final review (~30 min)
6. Publish: merge to main → Vercel redeploy
7. Update casino directory listing (auto-generated from `/src/content/casinos/`)

---

## Authority Levels & Dylan Touchpoints

### Axiom (Full Autonomy)
- [ ] Tech stack decisions (day 1)
- [ ] Database schema (day 1)
- [ ] Writing casino profiles from bearcave data (days 1-3)
- [ ] UX implementation (forms, layouts, flows)
- [ ] Feature building (tracker, P&L, reports)
- [ ] Testing & bug fixing
- [ ] Deployment to staging/production

### Dylan Gates (Explicit Approval Required)
- [ ] Launching to public (day 7 sign-off)
- [ ] Adding new casinos beyond initial 63 (post-MVP)
- [ ] UX-altering changes post-launch (major redesigns)
- [ ] Changing affiliate link strategy per casino
- [ ] Publishing major policy changes (new moderation rules, data usage)

### Dylan Touchpoints (Daily During Build)
- Day 1, 5 PM: Tech stack, casino list, schema approval (30 min)
- Day 2, 6 PM: First 10 casino profiles review + auth flow test (30 min)
- Day 3, 5 PM: P&L tracker, ban feed, Discord embed review (30 min)
- Day 4, 6 PM: Final UX review + all 33 profiles final approval (1 hour)
- Day 5, 4 PM: Performance + security review, production test (30 min)
- Day 6, 5 PM: Domain live, analytics setup, go/no-go for launch (30 min)
- Day 7, 7 PM: Launch! Day 1 monitoring + success metrics review (1 hour)

---

## Success Metrics (Day 7 & Beyond)

### MVP Launch (Day 7)
- [ ] Platform live, zero critical errors
- [ ] 10+ users signed up
- [ ] 5+ daily bonus claims recorded
- [ ] 2+ ban reports submitted
- [ ] All affiliate links trackable + generating clicks

### Week 1 (Days 8-14)
- [ ] 100+ unique visitors
- [ ] 20+ conversions (signups)
- [ ] Affiliate click-through rate >2%
- [ ] <5 spam reports in moderation queue
- [ ] Platform uptime >99.9%

### Week 2 (Days 15-21)
- [ ] 500+ unique visitors
- [ ] 100+ conversions
- [ ] First affiliate commission confirmed from casino providers
- [ ] 50+ daily bonus claims/day
- [ ] Community ban intelligence actively flowing (10+ reports/week)

### 30-Day Threshold (2026-04-14)
- [ ] $1,000+ in affiliate revenue (success condition)
- [ ] 1,000+ monthly active users
- [ ] Daily active users stabilizing at 50-100
- [ ] Affiliate LTV per user validating (~$400-800 across 20 casinos)
- [ ] If <$1,000: re-evaluate, pivot, or sunset

---

## Known Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| 7-day timeline too aggressive | Medium | High | Pre-stage all casino content; work near-continuously; defer non-MVP features |
| Ban report spam floods moderation | Medium | Medium | IP deduplication + rate limiting; add CAPTCHA if needed |
| Affiliate links break/change | Low | Medium | Weekly verification by Collective; Dylan notifies on changes |
| Database down during MVP | Low | High | Daily backups; Neon auto-recovery; fallback to read-only mode |
| Poor traffic/conversions | Medium | High | Have SEO keyword strategy; drive via Discord; pivot to premium-first if needed |
| Regulatory challenge | Low | High | Pre-launch legal review; add disclaimers; monitor state laws |
| Collective capacity exceeded | Low | High | Dylan provides hours/day; hire contractor if needed; scale post-MVP |

---

## Git & Deployment Workflow

### Repository Structure
```
/sweepsintel (Vercel-linked repo)
├── /src
│   ├── /pages (Astro pages)
│   ├── /components (Astro components)
│   ├── /content/casinos (Markdown profiles)
│   └── /middleware (auth, CSRF)
├── /api (Vercel functions)
├── /scripts (cron jobs, utilities)
├── /docs (runbooks, guides)
├── package.json
├── astro.config.ts
└── .env.example (no secrets in repo)
```

### Deployment
- Main branch: always production-ready
- Feature branches: dev work, reviewed before merge
- Auto-deploy: every merge to main → Vercel redeploy (1-2 min)
- Rollback: `vercel rollback` if critical issue

---

## Questions for Dylan / [DYLAN INPUT NEEDED]

1. **Domain name:** What's the target domain? (e.g., sweepsintel.com, casinointel.io, other)
   - Axiom default: SweepsIntel.com (matches brand name)

2. **Affiliate link verification:** How should Collective verify affiliate links are live?
   - Default: Dylan spot-checks 5 random casinos day 6; Collective does rest
   - Or: Axiom writes automated script to test each link

3. **Community Discord:** Is SweepstakeSideHustle server the right embed target?
   - Axiom assumes yes based on case notes
   - Dylan confirms invite URL + any permissions needed

4. **Email service:** Prefer Resend (free, 100/day) or Vercel email or other?
   - Default: Resend
   - Dylan confirms if preference

5. **Analytics:** Include Google Analytics 4 in addition to Vercel?
   - Default: Vercel only (sufficient MVP)
   - Dylan confirms if wants GA4

6. **Referral tracking for premium tier (Phase 2):** Should we track referral links (users refer friends)?
   - Default: No referral incentive at MVP; add in phase 2
   - Dylan confirms

---

## Next Steps After Execution Plan Approval

1. Dylan reviews this plan (30 min)
2. Dylan confirms tech stack, domains, and confirms all 33 affiliate links enrolled
3. Axiom begins Day 1 immediately upon Dylan approval
4. Daily standups: 5-6 PM (30 min each day, sync on blockers)
5. End of Day 7: platform live, case file updated, retrospective

---

**End of Execution Plan**

---
