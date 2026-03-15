# SweepsIntel — Build Kickstart Guide

_Everything Dylan needs to start the actual build. No fluff, no recap of what you already know._

_Written 2026-03-14._

---

## Starting the PM

Open a new Cowork session. When it asks you to select a folder, give it your full workspace — `C:\Users\dylba\Desktop\Cowork` — so it can see both `projects/sweepsintel/` (the codebase) and `collective/projects/sweepsintel/PM/` (PM memory).

Paste the contents of `collective/projects/sweepsintel/PM/PM-PROMPT.md` into the chat. That's the activation prompt. The PM will read its memory files, read the spec, and tell you what it sees. From there, ask it what Codex should do first — it'll produce a ready-to-paste prompt.

A few things to know going in:

**The PM writes to its own files.** After each session, tell it to update DECISION-LOG.md and OPEN-ITEMS.md. This is its memory between sessions. If you forget, the next PM session starts cold and wastes time rediscovering state. Make this a habit — "update your files before we close" as your last message every session.

**The PM doesn't know what Codex actually built.** It reads the spec and the codebase. Early on, the codebase is empty, so the PM is working purely from the spec. As Codex builds, the PM's reviews get more valuable because it can compare implementation to spec. The relay loop gets better over time, not worse.

**The PM and Codex will disagree.** That's the point. The PM guards the product vision, Codex guards the technical implementation. When they conflict, you decide. The PM knows this — its authority matrix is explicit about who owns what. Don't feel like you need to side with one by default.

---

## Suggested Codex build order

This is the order I'd recommend, and it's what the PM will likely arrive at independently. Each task is designed to produce something testable before moving to the next:

**1. Project scaffold + deploy config + database schema.**
Start here because everything depends on it. Astro 4 project, Neon connection, Vercel deploy, all CREATE TABLE statements from 01-SCHEMA.md. Codex reads: `00-OVERVIEW.md`, `01-SCHEMA.md`, `07-FILE-STRUCTURE.md`, `08-CONSTRAINTS.md`. Testable: site deploys to Vercel, database connects, tables exist.

**2. Auth system (OTP).**
Email OTP via Resend. 90-day sessions. No registration — entering email IS registration. Auth middleware for protected routes. Codex reads: `04-FEATURES-PRIVATE.md` (Feature 8), `01-SCHEMA.md`, `07-FILE-STRUCTURE.md`. Testable: you can log in with your email and stay logged in.

**3. Casino directory + profile pages.**
The public face. Casino cards, profile pages with all structured data, tier/rating sort, filter chips. No user interaction yet — just display. Codex reads: `03-FEATURES-PUBLIC.md`, `01-SCHEMA.md`, `07-FILE-STRUCTURE.md`, `UI-SPEC-v1.md`. Testable: navigate to `/casinos`, click through to a profile, see structured data.

**4. Daily tracker (Section 1 + Section 2).**
The retention engine. This is the most complex UI and the most performance-critical queries. Section 1 (user's casinos with claim status), Section 2 (temptation shelf), simple/advanced claim modes, reset countdown timers. The 3-query consolidated pattern from `08-CONSTRAINTS.md` is mandatory here. Codex reads: `04-FEATURES-PRIVATE.md`, `02-CORE-MECHANICS.md`, `01-SCHEMA.md`, `08-CONSTRAINTS.md`, `UI-SPEC-v1.md`. Testable: add a casino, claim a bonus, see the timer reset, see Section 2 sorted by expected daily.

**5. Admin panel (core CRUD + queue UI).**
Casino create/edit, report moderation queues (ban, state, reset, flag), keyboard shortcuts, one-click actions. This unblocks you from being able to manage casino data without SQL. Codex reads: `05-FEATURES-ADMIN.md`, `01-SCHEMA.md`, `07-FILE-STRUCTURE.md`, `UI-SPEC-v1.md`. Testable: create a casino, edit it, see it on the directory.

**6. Remaining user features.**
Redemption tracker, ledger, notifications panel, state availability pages, ban report submission forms. These are important but not blocking — you can operate the platform with steps 1-5 done.

**7. Discord intel feed + ingest API.**
The monitoring pipeline endpoint. This is where the scheduled tasks will POST to. Build the ingest endpoint, the admin intel queue, the publish/discard flow, the "My Alerts" feed on the tracker. Codex reads: `05-FEATURES-ADMIN.md`, `MONITORING-SPEC-v1.md`, `04-FEATURES-PRIVATE.md` (Feature 9).

**8. Retention features.**
PWA manifest, push notifications, add-to-home-screen prompt, bookmark prompts. These matter for Day 30 retention, not Day 1 launch.

---

## Things to give Codex upfront

When you first open Codex on this project, point it at:

- `CODEX-README.md` in the project root — this is its map. It tells Codex which files to read for which task.
- The `docs/` directory — all 9 spec files live here.
- `UI-SPEC-v1.md` — Codex should not guess layouts. Every page is mocked.

Codex works best when you give it a focused task with a clear "done" definition. The PM's job is to produce those focused prompts. Don't dump the whole spec at Codex and say "build it" — feed it task by task through the PM.

---

## Decisions you still need to make

These are the open items that will come up during the build. None of them block starting, but they'll block specific features:

- **Admin users.** Who besides you gets `is_admin = true`? Needed before admin panel deploy.
- **Trust tier user lists.** The monitoring pipeline needs real Discord usernames for Tier 1 and Tier 2. Can be populated after launch but before enabling the scheduled tasks.
- **Wash game for Getting Started guide.** Pigsby is your personal choice but unconfirmed for beginners. Blocks the Getting Started page content only.
- **Profile collection spec.** How the profile-writing Claude session knows what to collect for each casino. Blocks the 52 remaining MDX profiles.
- **Affiliate link verification.** Are all 63 casinos enrolled and links active? Blocks revenue, not build.

---

## Advice for the build phase

**Codex is going to want to make architectural decisions.** The spec is opinionated about some things (the 3-query tracker pattern, affiliate gate logic, OTP flow) and silent on others (component styling approach, error handling patterns, test strategy). When it makes a call you didn't spec, that's usually fine — that's why you gave it technical authority. When it contradicts something you did spec, that's when the PM earns its keep.

**The first few PM sessions will feel slow.** The PM is reading everything for the first time, the codebase is empty, and there's nothing to review. It's producing "here's what to build" prompts from a cold start. This is normal. By session 3-4, the PM has context, the codebase has code, and the review loop tightens significantly.

**Don't over-relay.** You don't need to paste every line of Codex's output back to the PM. Paste the interesting parts — the parts where Codex made a judgment call, deviated from spec, or asked a question. "Codex finished the auth system, here's the user flow it implemented" is more useful than dumping 400 lines of code.

**The tracker is the hardest thing in the spec.** Two sections with different data sources, real-time countdown timers, simple/advanced claim modes, lazy-loaded Section 2, consolidated queries. If Codex nails the tracker, everything else is simpler. If it struggles, that's where the PM's review matters most.

**The monitoring pipeline is not urgent.** The scheduled tasks are disabled. The ingest endpoint should be built (step 7) so the schema is wired up, but actually enabling the monitoring can wait until you're confident the admin review UI works and you've confirmed your trust tier lists. Don't rush this — a bad monitoring pipeline publishes garbage intel and tanks credibility on day one.

**Ship before it's perfect.** The spec is thorough, but MVP means MVP. If you have the directory, tracker, admin panel, and auth working — you have a product. Everything else is enhancement. The retention features (push, PWA, bookmarks) and the intel feed make it better, but they don't make or break launch.

**Your $20/month lesson is baked into the spec.** The DB efficiency section exists because you lived through the cost of not optimizing. The 3-query tracker pattern, partial indexes for admin counts, in-memory caching with TTL — these are all designed to keep Neon on the free tier at 100 users. If Codex introduces N+1 queries, the PM should catch it in review. If neither catches it, your Neon bill will.

---

## After launch

Once the platform is live with real users, three things change:

1. **The monitoring pipeline becomes real.** Enable the scheduled tasks, confirm trust tiers, and start the Sonnet/Opus pipeline. The first few runs will need tuning — the kill filter will be too aggressive or too loose. Review the admin queue carefully for the first week.

2. **The PM becomes a reviewer, not a planner.** Instead of "what should Codex build next," the PM's job shifts to "users reported X, Codex fixed it, does the fix match the spec?" Bug fixes, feature tweaks, and user feedback loops replace greenfield prompts.

3. **The Collective's quarterly review (June 13) has a real artifact to evaluate.** SweepsIntel either validated the governance approach or it didn't. That review should be honest about which parts of the Collective contributed to the outcome and which were overhead.

---

_The spec is solid. The PM is ready. The monitoring pipeline is drafted. The only thing left is building it._
