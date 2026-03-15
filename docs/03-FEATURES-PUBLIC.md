# SweepsIntel — Public Features

_Features 1-4, 10-11: Deploy config, Casino directory, State availability, Ban reports, Homepage, Getting Started_

## Feature specs

### 1. Deploy configuration (do first)

Wire `@astrojs/vercel` into `astro.config.ts`. Create `src/lib/db.ts` with the Neon connection (reads `DATABASE_URL` from env). Create `.env.example`. All Neon queries go through `src/lib/db.ts`.

---

### 2. Casino directory (public)

- `/casinos` — table/grid view. Default sort: tier ascending, then rating descending (Tier 1 highest-rated first). Think of it as a well-formatted spreadsheet — this is where SweepsIntel beats Dogbear's outdated list. Casino cards show: name, tier badge, rating, promoban risk badge, redemption speed, live games indicator.
- `/casinos/[slug]` — full casino profile. Renders MDX editorial content + structured data panel.

**Filtering:** Togglable filter chips above the list — no user-personalized or state-based filtering at MVP. Filter options: Tier (1 / 2 / 3), Promoban Risk (None / Low / Medium / High), Has Live Games (yes/no). Multiple filters can be active simultaneously. No user-level or saved filters.

**CTA placement:** Wherever the casino name appears — on cards, in tables, in any list — it is a clickable link that fires the affiliate two-state logic. The name IS the CTA. No separate "Join" button needed on the directory; clicking the casino name routes through `/api/affiliate/click` for unjoined users or directly to the casino site for joined users.

**Structured data panel on casino profile includes:**
- Tier, rating, parent company
- Promoban risk (colored badge: green/yellow/orange/red), family ban propagation warning if true
- Whether banning confiscates funds (explicit warning if true)
- Redemption: speed description, fee description, minimum amount
- Streak mode and reset time (with next reset countdown if user is authed)
- Playthrough multiplier and notes
- Live games: yes/no; if yes, which provider(s). Below the provider list, show the `casino_game_availability` table for this casino: specific games tracked, with confidence badges (high=green, medium=yellow, low=orange, unverified=gray) and cross-wash relevance flag. This is public information — knowing which games exist at a casino is free. Data is populated by the monitoring pipeline and admin edits. **Note:** The game availability *display* is MVP scope (read-only table populated by monitoring pipeline + admin). The community *submission form* for volatility reports (Feature #12) is post-MVP — do not build the VolatilityReportForm at launch.
- Intra-family cross-wash: does/doesn't support SC transfer, which direction (public). Detail and live game cross-wash notes paywalled.
- Live games cross-wash: yes/no + which provider(s). Compatible cross-wash partner suggestions paywalled. Required warning when live games are present: "Live game providers log multi-account connections at the same table. Separate devices and IPs are required."
- Community wash game volatility table — **post-MVP, do not build at launch** (see Feature #12). Leave a placeholder section on the profile page: "Community Volatility Reports — Coming Soon" so the layout reserves space.
- State availability notice (amber for `legal_but_pulled_out`, grey factual note for `operates_despite_restrictions`)
- Ban reports feed (published reports for this casino, sorted by date)
- Ban uptick alert banner if active
- Average redemption time stats (median, p80, trend signal, sample size)
- Affiliate CTA button (two-state logic as described above)
- **Email capture banner** (same component as homepage — non-blocking aside). Source: `'casino_profile'`. Place below the structured data panel, above the community reports section. Only shown to unauthenticated visitors.

**MDX frontmatter expansion** — add to `src/content/config.ts` Zod schema: `claimUrl`, `streakMode`, `resetTimeLocal`, `resetTimezone`, `hasStreaks`, `scToUsdRatio`, `parentCompany`, `hasLiveGames`, `cwDirection`.

**Data source precedence:** The `casinos` table in Neon is authoritative for all live operations (reset times, affiliate links, ratings, tier, promoban risk). MDX frontmatter duplicates some of these fields for editorial convenience and content collection type safety, but the database is the source of truth for all dynamic features (tracker countdown, affiliate routing, directory sort). On casino profile pages, render MDX editorial content alongside structured data pulled from the database — not from frontmatter. Same pattern as affiliate links: `casinos.affiliate_link_url` in the DB is live, `affiliateLink` in MDX is editorial reference only.

**Field precedence matrix (casino profile render):**

| Field | Source | Why |
|---|---|---|
| name, slug | DB | URL routing, display everywhere |
| tier, rating | DB | Admin-editable, sort/filter |
| promoban_risk, hardban_risk, ban_confiscates_funds | DB | Admin-editable risk profile |
| affiliate_link_url, has_affiliate_link | DB | Live click routing |
| reset_time_local, reset_timezone, streak_mode | DB | Tracker countdown calculation |
| daily_bonus_desc, daily_bonus_sc_avg | DB | Section 2 display, sort |
| redemption_speed_desc, redemption_fee_desc, min_redemption_usd | DB | Structured data panel |
| sc_to_usd_ratio, playthrough_multiplier | DB | Calculations, display |
| has_live_games, cw_direction, cw_notes | DB | Live games section |
| parent_company | DB | Display, family ban grouping |
| Editorial prose (about section, strategy notes, detailed descriptions) | MDX body | Content collection, SEO |
| claimUrl (in MDX frontmatter) | MDX | Editorial reference only — NOT used for live link routing |

**Rule: if a field exists in both MDX frontmatter and the DB, the DB value wins at render time.** MDX frontmatter serves only as (a) type-safe validation via Zod schema at build time and (b) editorial reference for content authors. The DB is always the runtime source.

---

### 3. State availability (public)

- `/states` — US map or table. Each state: legal status, number of casinos available, recent pullout alerts.
- `/states/[code]` — state detail: legal status with source, all casinos available, recent pullout events. **Email capture banner** (same shared component) for unauthenticated visitors. Source: `'state_page'`. State pages are high-intent — someone checking their state's legality is a strong conversion signal.
- Community state report submission: same IP dedup flow as ban reports (3 same-IP reports in 7 days → flagged). Reports go into `state_availability_reports` as `is_published = false` for admin review.

**State pullout alert fires from THREE paths:**
1. Admin directly updates `casino_state_availability.status = 'legal_but_pulled_out'` (single casino)
2. Admin approves a `state_availability_reports` row with `reported_status = 'legal_but_pulled_out'` (single casino or provider)
3. Admin updates a provider's state status via the provider cascade action (see Admin panel spec — affects all casinos using that provider in that state simultaneously)

Paths 1 and 2 trigger: create `state_pullout_alerts` row + create `user_notifications` rows for all users in `user_state_subscriptions` for that state. Path 3 creates ONE state-level notification per affected user (not per casino) — see provider cascade spec in Admin panel.

**Email for state pullouts:** At MVP, state pullout alerts are in-app notifications only. Email blasts for severe events are manual (admin-composed via `/admin/notifications`). `email_waitlist` entries (soft-captured, not full accounts) do NOT receive any automated alerts — they are a separate marketing funnel.

---

### 4. Ban report system (public)

**Submission requires a logged-in account (email OTP auth).** Anonymous submission is not permitted. If an unauthenticated user attempts to submit, prompt the email entry flow inline.

- Rate limit: 1 submission per report topic (casino) per user account per 7 days. Enforced per `reporter_user_id`. IP hashing is stored for audit but IP-only dedup is secondary to account-level dedup.
- IP dedup threshold (secondary): 3 same-IP reports for any casino within 7 days → `is_flagged = true`
- Uptick threshold: 5 unique-account reports for same casino within 7 days → write `ban_uptick_alerts` row + create `admin_flags` row with `source = 'ban_uptick'`
- **All reports go into manual review queue.** `is_published = false` on submission. Admin reviews and publishes via the community reports queue.
- **Confirmation message to user after submit:** "Your report has been submitted and will be reviewed before publishing. Thank you."
- Published reports appear on casino detail page
- Uptick alert shows as a banner: "⚠️ Elevated ban activity reported in the last 7 days"
- Users can report: promoban, hardban, account review, fund confiscation (maps to `report_type` values: 'promoban', 'hardban', 'account_review', 'fund_confiscation')

Apply the same submission rules (account required, 1 per topic per 7 days, manual review queue, confirmation message) to: `state_availability_reports` and `reset_time_suggestions`. (`game_volatility_reports` uses the same pattern but is post-MVP — see Feature #12.)

---

### 10. Homepage

`/` — the marketing surface for new players.

- Headline + subheadline: what SweepsIntel is
- **Two primary CTAs:** "Start earning today" → `/getting-started` (new players) and "Open tracker" → `/tracker` (existing players). The Getting Started guide is the highest-converting page for new visitors — it MUST be the primary CTA for first-time visitors, not the casino directory. Directory is discoverable from nav and from within the guide.
- Active state pullout alerts — if any `state_pullout_alerts` fired in last 30 days, show them prominently (proof of value)
- Active ban uptick alerts — recent ban activity
- Top-rated casinos grid: top 6 casinos WHERE `tier = 1 AND rating IS NOT NULL` ORDER BY `rating DESC`. If fewer than 6 Tier 1 casinos have ratings, fill remaining slots with Tier 2 casinos by rating. Casinos with NULL rating are excluded from this grid (they can still appear in the full directory).
- External community link: plain link to Dogbear's SweepstakeSideHustle Discord (https://discord.gg/9CgSgJHFu8). No embed, no widget — just a styled link card. "Join the community →"
- No Discord embed of any kind.
- **Email capture banner** (non-blocking — inline banner or aside, NOT a modal). This is the public-facing `email_waitlist` funnel described in Feature #8 OTP prompt strategy entry point 2. Copy: "Get state pullout alerts and ban intel in your inbox" or similar. Captures email → stores in `email_waitlist` with `source = 'homepage_banner'`. Does NOT create a `user_settings` row or trigger OTP. This is the homepage's conversion hook for casual visitors who aren't ready to create an account. Place below the hero section, above or alongside the top-rated casinos grid.

---

### 11. Getting Started guide (public, featured editorial)

Route: `/getting-started`

A single static editorial page — the highest-converting page on the platform. Designed for someone who has heard about sweepstakes casinos but never signed up. Written by Dylan, formatted by Codex.

**Structure:**
1. What sweepstakes casinos are and why they're legal (plain English)
2. What SC and GC are (SC = the redeemable currency, GC = the sweepstakes "play money" that lets you earn SC)
3. The complete first-day loop with one specific casino: sign up → verify ID → purchase the welcome offer → play [specific game] at [specific bet size] → submit a redemption → receive money
4. Key terms defined in-context as they appear (playthrough, wash, SC-to-USD ratio)
5. Common new player mistakes (don't skip ID verification, don't ignore playthrough before redeeming)
6. Next steps: add more casinos, use the daily tracker

**Casino selection:** MyPrize. Criteria met: instant redemptions (a major differentiator), wide slot + live game catalog, low promoban risk, VIP system, strong daily reward with streak mechanic, celebrity brand recognition, wide state availability. Referral code: `goobspins` — affiliate link: `https://myprize.us/invite/goobspins`.

**MyPrize-specific guide notes (editorial, not schema):**
- Referral program is SC-based not USD CPA: Level 1 (referred user purchases $19.99+) = 100K GC + 20 SC to referrer; Level 2 (referred user reaches $999.99+ total) = 400K GC + 80 SC to referrer.
- Welcome offer sequence on day 1 is extensive: multiple tiered offers (Welcome Offer 1-4 + Flash Offer + Email Offer). The Getting Started guide should recommend starting with the smallest welcome offer first to understand the mechanics before committing more.
- Playthrough system is batched: each batch of SC has its own independent 1x playthrough tracker shown separately in a list (not a single aggregated counter). This is unusual and needs to be explained in the guide — it looks more complex than it is. Each batch must be washed independently in order.
- **Wash game for the guide is TBD — Pigsby is NOT confirmed as the recommendation.** Dylan needs to research the best wash game to recommend to a new user. The guide must name a specific game, bet size, and expected spin count. Leave a clear `TODO: wash game recommendation` comment in the guide template. Do not publish until filled in.
- Guide must include the playthrough step explicitly: "check your Playthrough screen, find the active batch, play [GAME] at [BET SIZE]/spin until that batch reaches 100%."

**Design:** Long-form editorial prose, explicit step-by-step with screenshots at each key step (sign up screen, ID verify screen, welcome offer purchase screen, playthrough tracker screen, redemption submit screen, redemption received confirmation). Screenshots are placeholders at build time — leave `[SCREENSHOT: description]` markers in the MDX where they go. Minimal UI chrome. Highly SEO-optimized (`/getting-started` as standalone route). This page earns the affiliate click at the bottom.

---
