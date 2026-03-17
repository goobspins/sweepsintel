# SweepsIntel — v1 Codex Prompt

_Working draft. Dylan + PM iterate before sending._

---

## What we're building

SweepsIntel is a sweepstakes casino knowledge platform for the US market. It's not a directory — it's an intelligence resource. The audience is arbitrage-aware players who are already familiar with the space and want actionable data: which casinos have good wash games, which are banning aggressively, what the redemption situation looks like, and so on.

The revenue model is affiliate CPA. When a user clicks through to a casino they haven't joined yet, they land via Dylan's affiliate link. That's the whole conversion mechanism — there's no paywall, no premium tier at launch. The daily bonus tracker is the retention engine that keeps users coming back, and those daily visits are the funnel.

---

## Existing scaffold

The repo is at `sweepsintel/` — it's been initialized as an Astro 4 project with React 18 and TypeScript. Here's what's already in place:

**`astro.config.ts`** — output is set to `hybrid`, React integration is configured. The Vercel adapter is not yet hooked up (`adapter: undefined`).

**`src/content/config.ts`** — Astro content collection defined for casinos. The schema is typed with Zod.

**`src/content/casinos/`** — 10 casino MDX files already drafted (global-poker, american-luck, betr, fliff, gold-machine, lucky-rush, moozi, scrooge, shuffle, spindoo). Each has a rich frontmatter block and a short editorial write-up.

**Casino MDX frontmatter schema:**
```
name, slug, tier (1-3), rating (0-10), washGames, paAvailable (bool),
banRisk, redemptionSpeed, redemptionFee, crossingAvailable (bool),
crossingNotes, playthroughMultiplier, platform, oneOhNinesStatus,
affiliateLink (URL), affiliateType (CPA/RevShare/etc), notes, lastUpdated
```
Note: `affiliateLink` in the MDX files currently has placeholder URLs — these will be swapped to real affiliate links before launch. The links in the database (see below) will be the live source.

**`docs/NEON_SCHEMA.sql`** — full 7-table PostgreSQL schema designed and ready to run against Neon. Tables: `casinos`, `daily_bonus_claims`, `pl_ledger`, `ban_reports`, `ban_uptick_alerts`, `auth_sessions`, `clicks`.

**`package.json`** — dependencies: `astro ^4.0.0`, `react ^18.2.0`, `react-dom ^18.2.0`. The following packages are not yet installed and will be needed: `@astrojs/vercel`, a Neon client (`@neondatabase/serverless` or `postgres`), and likely `@astrojs/react` as a named import if it isn't wired already.

**`src/pages/index.astro`** — placeholder homepage only, not built out.

---

## What needs to be built

### 1. Deploy configuration (do this first, unblocks everything)

Wire up the Vercel adapter in `astro.config.ts`:

```ts
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  integrations: [react()],
  output: 'hybrid',
  adapter: vercel(),
});
```

Set up environment variable handling for `DATABASE_URL` (Neon connection string). Dylan will provide the actual value — just scaffold the `.env.example` and wire Neon connections through a shared `src/lib/db.ts` file.

Run the schema in `docs/NEON_SCHEMA.sql` against the Neon database to create all 7 tables.

---

### 2. Casino directory pages

Each casino in `src/content/casinos/` needs a generated page at `/casinos/[slug]`. The page should render the MDX editorial content plus a structured data panel pulled from the frontmatter: tier badge, rating, wash games, ban risk, redemption speed, PA availability, crossing info, and the affiliate CTA button.

The affiliate CTA is the key design decision here: the button should pull `affiliateLink` from the **Neon `casinos` table**, not from the MDX frontmatter. The MDX `affiliateLink` field is the fallback/seed value; Neon is the live source. This lets Dylan update affiliate links without a code deploy.

Also build a `/casinos` directory index page — filterable by tier, sortable by rating, showing a card grid. Each card links to the casino's detail page.

---

### 3. Daily bonus tracker (primary feature — this is the affiliate funnel)

This is the most important feature on the platform. Users come back daily to track which casinos they've claimed their bonus at. Build it as a React component embedded in an Astro page at `/tracker`.

**How it works:**

Users select which casinos they're signed up with. This is stored either in `localStorage` (for anonymous users) or in the `daily_bonus_claims` table (for authenticated users). Each day, the tracker shows their casinos as a checklist. When they mark a casino as claimed, a row is written to `daily_bonus_claims`.

**The affiliate two-state logic — this is the conversion mechanism:**

Every casino card in the tracker has a state: "joined" or "not joined."

- Joined casino → clicking the casino name/card goes directly to the casino site (no affiliate link)
- Not-joined casino → clicking the casino card fires Dylan's affiliate link

The tracker UI should surface not-joined casinos as opportunity, not noise. Something like a "Casinos you haven't joined yet — claim your welcome bonus" section below the main checklist. When a user clicks one of those, that's a `clicks` table log entry + affiliate link fire.

**Anonymous vs. authenticated use:** Our lean is toward anonymous-first — a user should be able to use the tracker without creating an account, using localStorage for persistence. Email OTP login is available to sync across devices. Codex, weigh in on this: is anonymous-first with Neon writes for opted-in users the right call, or is there a cleaner approach? Happy to debate this.

**Minimal viable UI for the tracker:**
- List of user's casinos for today, each with: casino name, daily bonus amount (editable), claimed/unclaimed toggle, time last claimed
- Visual indicator of daily completion (e.g., X/12 casinos claimed today)
- "Add casino" flow to expand their tracked list
- Not-joined casino recommendations section below

---

### 4. Ban report system

Build a form at `/report` for users to submit ban/issue reports about specific casinos.

**Form fields:** Casino (dropdown from our casino list), Issue type (ban, redemption delay, KYC demand, bonus rescission, other), Severity (low/medium/high), Description (freeform text), Email (optional, for follow-up).

**IP deduplication on the backend:** On submission, SHA-256 hash the reporter's IP and write it to `reporter_ip_hash`. Before auto-publishing, check: has this IP hash submitted 3 or more reports for any casino in the past 7 days? If yes, set `is_flagged = true` and `is_published = false`. Flagged reports go into a manual review queue. Unflagged reports auto-publish.

**Published reports** appear on the casino's detail page as a community feed. Show issue type, severity, date, and a snippet of the description.

**Uptick detection:** After each submission, check the `ban_reports` table for the affected casino: how many unique `reporter_ip_hash` values have reported in the last 7 days? If that count exceeds 5, upsert a row in `ban_uptick_alerts`. The threshold is 5 unique-IP reports in 7 days — this can be a configurable constant. The alert table is the trigger for future broadcast (Discord webhook, etc.) — for MVP, just write the alert row and surface it on the casino page as a "⚠️ Elevated ban activity in the last 7 days" banner.

---

### 5. P&L tracker

Build at `/pl` — a per-user ledger for tracking sweepstakes performance. Users log: offer spend (USD paid for GC/purchase), SC earned, USD redeemed, and notes. Each entry is associated with a casino.

Display a running summary: total spent, total redeemed, net P&L, and a per-casino breakdown table. This is the "am I actually making money at this" view. It writes to the `pl_ledger` table.

Anonymous users get a localStorage version. Authenticated users get the Neon version.

---

### 6. Homepage

Build the homepage at `/`. It needs:

- Above-the-fold: positioning headline + subheadline explaining what SweepsIntel is (intelligence platform for sweeps players, not a generic directory)
- CTA to the daily tracker ("Track your bonuses →")
- Featured casinos grid (top-rated tier-1 casinos)
- Recent ban reports / uptick alerts feed (if any active alerts, show them prominently)
- Discord embed panel — embed the SweepstakeSideHustle server invite: `https://discord.gg/9CgSgJHFu8`

---

### 7. Email OTP authentication

Build the auth flow. Routes: `POST /api/auth/request-otp` (takes email, generates 6-digit OTP, writes to `auth_sessions`, sends email via whatever transactional email service you recommend), `POST /api/auth/verify-otp` (validates token, sets session cookie). Session token stored in `auth_sessions.session_token`.

No passwords. The OTP is the login.

For transactional email, Resend is the recommendation (simple API, good free tier, easy Vercel integration) — but defer to Codex here. If there's a better option given the stack, say so.

---

## Deployment target

Vercel. Auto-deploy on push to main. Dylan has a Vercel account and Neon instance already. Environment variables needed: `DATABASE_URL` (Neon), `RESEND_API_KEY` (or equivalent), `OTP_SECRET` (for HMAC token generation if used).

---

## File structure expectations

Keep it clean and conventional for Astro 4:

```
src/
  components/
    tracker/         — React components for daily tracker
    casino/          — Casino card, detail panel components
    banreport/       — Report form, report feed components
    pl/              — P&L ledger components
    layout/          — Header, footer, nav
  lib/
    db.ts            — Neon connection + query helpers
    auth.ts          — OTP generation, session validation
    affiliate.ts     — Affiliate link resolution logic (Neon lookup with MDX fallback)
  pages/
    index.astro
    casinos/
      index.astro    — Casino directory
      [slug].astro   — Individual casino pages
    tracker.astro
    report.astro
    pl.astro
    api/
      auth/
        request-otp.ts
        verify-otp.ts
      tracker/
        claim.ts     — Write to daily_bonus_claims
        status.ts    — Today's claim status for user
      reports/
        submit.ts
      pl/
        entry.ts
  content/
    casinos/         — MDX files (already populated)
    config.ts        — Collection schema (already defined)
```

---

## Hard constraints

- Affiliate link resolution always comes from Neon, with MDX as fallback only. Never hardcode affiliate links in components.
- `reporter_ip_hash` is a hash, never the raw IP. Hash on the server before any storage or comparison.
- The daily tracker UNIQUE constraint on `(user_id, casino_id, claimed_date)` is intentional — one claim log per casino per day. Honor it.
- All Neon queries go through `src/lib/db.ts` — no inline connection strings.

---

## Open questions for Codex

A few things where I want Codex's opinion before we lock in:

1. **Anonymous tracker storage:** localStorage for anonymous users, Neon for authenticated — is that clean to implement, or does the state handoff on login create ugly sync problems? What's your preferred approach?

2. **OTP email provider:** Resend is the PM suggestion. Any reason to use something else (Postmark, SendGrid, etc.) given this stack?

3. **Astro island hydration:** The tracker and P&L components need to be reactive. `client:load` or `client:idle` for the tracker — what's your call?

4. **Ban report form — server actions vs. API route:** Astro 4 has server actions in preview. Is that stable enough to use for the report submission, or should we stick with a plain `pages/api/` route?

Tell me where you'd deviate from the above and why. The spec is designed to be argued with.

---

## What's NOT in scope for MVP

- Premium subscription tier
- Advanced analytics / recommendation engine
- Wash game simulator
- Personalized casino recommendations
- Any monetization beyond affiliate CPA
