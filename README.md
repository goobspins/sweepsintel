# SweepsIntel

Sweepstakes casino intelligence platform. Daily bonus tracking, community intel, affiliate monetization.

**Owner:** Dylan | **Operated by:** Apex Collective | **Revenue model:** Affiliate CPA

## For Codex

**Start here → `CODEX-README.md`** in this directory. It maps every spec file and tells you what to read per task.

## Stack

- Astro 4 (hybrid) + React 18 + Neon PostgreSQL + Vercel + TypeScript
- Luxon for timezone/DST. Resend for transactional email.

## Spec files (`docs/`)

| File | What |
|---|---|
| `00-OVERVIEW.md` | Mission, context, tech stack, architecture |
| `01-SCHEMA.md` | Complete database schema (authoritative) |
| `02-CORE-MECHANICS.md` | Redemption state machine, affiliate gate |
| `03-FEATURES-PUBLIC.md` | Casino directory, states, ban reports, homepage, Getting Started |
| `04-FEATURES-PRIVATE.md` | Tracker, redemptions, ledger, auth, notifications |
| `05-FEATURES-ADMIN.md` | Admin panel, discord intel, volatility (post-MVP) |
| `06-FEATURES-RETENTION.md` | PWA, push notifications, bookmarks |
| `07-FILE-STRUCTURE.md` | Complete src/ tree, redemption stats |
| `08-CONSTRAINTS.md` | Hard constraints, DB efficiency, caching, future model |
| `UI-SPEC-v1.md` | Visual layouts for every page |
| `MONITORING-SPEC-v1.md` | Discord monitoring pipeline |

`docs/archive/` contains superseded files — ignore.

## Development

```bash
npm install
npm run dev      # dev server
npm run build    # production build
```

## Revenue target

$1,000 affiliate income within 30 days of launch. CPA ~$20-40/signup, users typically join 20+ casinos.
