# SweepsIntel MVP

A sweepstakes casino intelligence platform with daily bonus tracking, community ban reporting, and affiliate monetization.

**Status:** Day 1 Execution Started (2026-03-14)
**Target Launch:** 2026-03-20 (7 days)
**Owner:** Axiom (Apex Collective)
**Authority:** Dylan (Gates UX changes, new casinos, strategic decisions)

## Quick Links

- **Execution Plan:** `/EXECUTION-PLAN.md` — Complete 7-day build plan
- **Database Schema:** `/docs/NEON_SCHEMA.sql` — Neon PostgreSQL schema
- **Case File:** `/mnt/Cowork/collective/queue/approved/case-biz-007.md` — Full case details

## Stack

- **Frontend:** Astro.js (TypeScript + React islands)
- **Backend:** Vercel serverless functions (Edge Functions)
- **Database:** Neon PostgreSQL (Dylan confirmed available)
- **Hosting:** Vercel (auto-deploy on git push)
- **Auth:** Email OTP (no passwords)

## Project Structure

```
/src
  /pages          — Astro pages (casino profiles, tracker, P&L, reports)
  /components     — Reusable Astro/React components
  /content/
    /casinos      — Markdown profiles for each casino
  /middleware     — Auth, CSRF protection
/api              — Vercel serverless functions (claims, reports, etc.)
/scripts          — Utility scripts (backup, uptime checks)
/docs             — Runbooks, guides, schema
.env.example      — Environment variables template
```

## Features (MVP)

- [x] Casino knowledge base (33 casinos)
- [x] Daily bonus tracker (retention engine)
- [x] P&L tracker (expense/earning ledger)
- [x] Ban/issue report system (IP deduplication)
- [x] Discord embed (invite widget)
- [x] Email OTP auth
- [ ] Premium tier (Phase 2)

## Current Status (Day 1)

**Completed:**
- Execution plan written and approved
- Project initialized (Astro + git)
- Database schema designed (`NEON_SCHEMA.sql`)
- Astro content collection configured
- First 10 casino profiles drafted:
  - Global Poker (9/10)
  - Shuffle (8/10)
  - Betr (7.5/10)
  - Fliff (7.5/10)
  - American Luck (7/10)
  - Gold Machine (7/10)
  - LuckyRush (7/10)
  - Moozi (7/10)
  - Scrooge (7/10)
  - Spindoo (7/10)

**In Progress:**
- Remaining 23 casino profiles (Day 2-3)
- API route scaffolding (Day 2)
- Email OTP auth (Day 2)
- Daily bonus tracker UI (Day 2-3)
- Ban report system with deduplication (Day 3-5)

**Next Milestone:**
- Dylan review of first 10 casinos + tech stack (Day 1, 5:00 PM)
- Complete all 33 profiles (Day 3 evening)
- Full end-to-end testing (Day 4-5)
- Domain setup & DNS (Day 6)
- Launch (Day 7)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Deploy to Vercel
npm run deploy
```

## Dylan Touchpoints (Daily Standups)

- **Day 1, 5:00 PM:** Tech stack approval, casino list confirmation, schema review
- **Day 2, 6:00 PM:** First 10 profiles review, auth flow test
- **Day 3, 5:00 PM:** P&L tracker, ban feed, Discord embed review
- **Day 4, 6:00 PM:** Final UX review, all profiles approved
- **Day 5, 4:00 PM:** Performance review, production test
- **Day 6, 5:00 PM:** Domain live, go/no-go for launch
- **Day 7, 7:00 PM:** Launch! Day 1 monitoring + metrics

## Contact

- **Axiom:** Day-to-day execution, technical decisions
- **Dylan:** Strategic decisions, content review, authority gates

---

**Execution Clock:** 7 days to launch. Revenue target: $1,000+ by day 30.
