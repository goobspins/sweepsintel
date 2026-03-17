# Overnight Claude Chat Prompts

These are starter prompts for independent Claude (Cowork) sessions. Each is designed to run long and produce deeply considered output through iterative self-refinement.

---

## Chat 1: Intelligence System Deep Design (The Big One)

**Why this matters**: The intel system is the product differentiator. Right now it's functional but shallow — signals go in, they get voted on, they decay. The overnight goal is to design what this system *should* become when it's serving hundreds of users, with a deep library of historical intelligence, community trust dynamics, and algorithmic discovery.

**Prompt to paste**:

```
You are a senior product architect designing the intelligence layer for SweepsIntel, a sweepstakes casino tracking platform. This is a system design exercise, not a coding task. Your output is a comprehensive design document.

## Context

SweepsIntel tracks ~60 sweepstakes casinos. Users add casinos to their portfolio, log daily bonus claims, track purchases/redemptions, and monitor their P&L. The 3.0 release added an intelligence layer:

- **Intel signals**: User-submitted tips (free SC, promo codes, flash sales, warnings, general tips) with expiry times, tied to specific casinos
- **Community voting**: "Worked for me" / "Didn't work for me" on each signal. Mixed ratios are normal (conditional deals). Only overwhelmingly negative triggers disputed status.
- **Health system**: Per-casino health score (healthy/watch/at_risk/critical) computed every 30 minutes from warning signals, redemption trends, and personal exposure
- **Trust scoring**: Per-user score (0.00-1.00) computed from account age, submission history, community standing, and portfolio performance. Trust >= 0.65 bypasses submission time gates.
- **Contributor tiers**: Newcomer → Scout → Insider → Operator (admin-granted only). Earned through quality contributions.
- **Discovery queue**: Dashboard sidebar recommending untracked casinos based on state eligibility, sorted by estimated daily value

The current system is functional but it's a v1. We need to design what it becomes.

## Your Task

Design the intelligence system in depth across these domains. For EACH domain, follow this process:

### Mandatory Design Process (for each domain)

**Pass 1 — First Draft**: Design the system naively. Get the obvious stuff down.

**Pass 2 — Adversarial Critique**: Now attack your own design. What are the failure modes? What happens at 10 users vs 500? What gets gamed? What creates perverse incentives? What's confusing? What data are you not capturing that you'll wish you had? Be ruthless — find at least 5 problems with your Pass 1 design.

**Pass 3 — Perspective Shift**: Evaluate your design from three user archetypes:
- **The Grinder**: Tracks 30+ casinos, claims every daily bonus, optimizes every dollar. Cares about speed, accuracy, and competitive edge. Will game any system for advantage.
- **The Casual**: Tracks 5-8 casinos, checks in once a day, doesn't want complexity. Needs the system to surface what matters without requiring engagement.
- **The Contributor**: Active in Discord communities, knows the space, wants recognition. Motivated by status and being useful. Will submit intel to build their reputation.

For each archetype: What do they love about your design? What frustrates them? What would make them stop using it?

**Pass 4 — Reconciliation**: Rebuild the design incorporating the critique and perspective feedback. This is your final answer for this domain. Flag any remaining tensions that can't be fully resolved (tradeoffs that require a product decision).

## Domains to Design

### Domain 1: Signal Lifecycle & Quality

How should signals flow from creation to archival? Think about:
- Signal creation (submission UX, required fields, what metadata to capture)
- Signal validation (what happens between submission and visibility?)
- Signal aging (how does a signal's value change over time?)
- Signal archival (when does old intel become historical data vs noise?)
- Signal deduplication (what if 3 people report the same promo code?)
- Signal correction (what if a signal was wrong? what if it was right but changed?)
- The difference between "this signal expired" and "this signal was wrong"

### Domain 2: Trust & Reputation Dynamics

The trust system determines who can submit, whose signals get prominence, and who earns contributor tiers. Think about:
- Cold start (new user with no history — how do they build trust?)
- Trust decay (should trust score decay if a user goes inactive?)
- Manipulation resistance (how do you prevent vote rings? sockpuppets? revenge downvoting?)
- Recovery (a trusted user submits one bad signal — how much should it hurt them?)
- Implicit trust signals (users who claim daily bonuses consistently are clearly active and knowledgeable — how to weight behavioral data vs explicit contributions?)
- The tension between encouraging submissions (more data) and quality gatekeeping (better data)

### Domain 3: Discovery & Recommendation Algorithm

The discovery queue currently just shows untracked casinos. It should be much smarter. Think about:
- Personalization signals (user's existing portfolio, P&L trends, preferred casino tiers, risk tolerance)
- Intel-informed recommendations ("Casino X has 3 active promo codes right now — you're missing out")
- Temporal relevance (showing different things at different times — morning vs evening, weekday vs weekend)
- Herd intelligence ("Users who track Casino A also track Casino B" — collaborative filtering)
- Negative signals (user removed a casino from their portfolio — that's useful information)
- The "quiet expert" problem: a user who never submits intel but has top-5 portfolio performance should still influence recommendations
- How to balance showing *good* casinos vs showing *timely* casinos

### Domain 4: Community Intelligence at Scale

When you have 500 active users, the dynamics change. Think about:
- Signal volume management (10 signals/day is manageable, 200/day needs curation)
- Community moderation (who handles disputes? automated vs human?)
- Regional intelligence (state-specific deals, state-specific risks)
- Trending detection (suddenly everyone is reporting problems with Casino X — how to surface this?)
- Expert identification (some users are reliably first to find deals — how to recognize and reward this?)
- Cross-casino pattern detection (Casino group X owns casinos A, B, C — if A has problems, B and C might too)
- The editorial vs algorithmic tension (should a human curate the "top signals" or should an algorithm?)

### Domain 5: Data Architecture for Intelligence

What data should the system be capturing NOW that it will need LATER? Think about:
- Event sourcing (should we log every state change for signals, votes, trust scores?)
- Analytics pipeline (what metrics tell you the health of the intelligence system itself?)
- Historical data value (old signals have research value — what's the right archival strategy?)
- Privacy considerations (users submit intel — what's their expectation about attribution persistence?)
- API surface for future integrations (Discord bot, browser extension, mobile push)

## Output Format

For each domain, show all four passes clearly labeled. The final reconciled design for each domain should be specific enough that a developer could implement it, but focus on *what and why*, not *how* (no code, no SQL, no API schemas). Name specific data points, thresholds, and behaviors.

End with a "System-Wide Tensions" section that identifies the 5-10 biggest product tradeoffs across all domains that require founder decisions.

This document should be 3000-5000 words. Take your time. Quality over speed.
```

---

## Chat 2: Schema & Data Architecture Reference

**Why this matters**: Every Codex prompt we write needs to reference the schema accurately. Right now schema knowledge is scattered across schema.sql, 10 migration files, and tribal knowledge. A canonical reference saves time on every future prompt.

**Prompt to paste**:

```
You are a database architect producing a canonical schema reference for a production application. This is a documentation task — do NOT modify any files.

## Context

SweepsIntel is a sweepstakes casino tracking platform (Astro + React + Neon Postgres). The database schema is defined across multiple files:

- `src/db/schema.sql` — Original base schema
- `src/db/` — Contains multiple migration files (read all .sql files in this directory)

## Your Task

Produce a single comprehensive schema reference document. For EVERY table in the database:

### For Each Table

1. **Purpose** — One sentence explaining what this table does in the system
2. **Columns** — Every column with: name, type, nullable, default, constraints, and a plain-English description of what it stores
3. **Indexes** — All existing indexes (from CREATE INDEX statements). Also note columns that are frequently queried but LACK indexes (check the API routes in `src/pages/api/` to see what WHERE clauses are used)
4. **Relationships** — Foreign keys, and also implicit relationships (columns that reference other tables but lack FK constraints)
5. **Query Patterns** — How this table is typically queried. Read the lib files (`src/lib/*.ts`) and API routes to find the actual queries. Note the most common JOINs, WHERE patterns, and aggregations.
6. **Active vs Vestigial Columns** — Search the TypeScript codebase for references to each column. If a column exists in the schema but is never referenced in TypeScript (except in migration files), flag it as potentially vestigial.
7. **Data Volume Estimate** — Based on the application logic, estimate relative growth rate (static, slow growth, fast growth, append-only log)

### Additional Sections

- **Table Dependency Graph** — Which tables reference which. What's the deletion cascade chain.
- **Migration History** — Chronological list of all migrations with a one-line summary of what each added/changed
- **Known Schema Debt** — Any inconsistencies, missing constraints, or design smells found during the audit
- **Recommended Indexes** — Based on actual query patterns found in the codebase

Read every .sql file in src/db/, every .ts file in src/lib/, and sample API routes to build this. Be thorough — this document will be referenced every time we write a database query or plan a feature.

Save the output as a markdown file.
```

---

## Chat 3: Comprehensive Test Specification

**Why this matters**: No tests exist. When we add them, having a spec means Codex can write them in one shot instead of going back and forth. This document maps every testable behavior.

**Prompt to paste**:

```
You are a QA architect writing a comprehensive test specification for a production web application. This is a documentation task — do NOT write actual test code, only specify what should be tested.

## Context

SweepsIntel is a sweepstakes casino tracking platform (Astro 4.0 + React 18 + Neon Postgres). It has zero tests currently. The application has:

- ~56 API endpoints (src/pages/api/)
- ~21 library files with business logic (src/lib/)
- ~66 React components (src/components/)
- Cron jobs for health computation and trust scoring

Auth is OTP-based (email magic links). Database access uses raw SQL via `query<T>()` and `transaction()` from src/lib/db.ts.

## Your Task

Write a test specification that covers every testable behavior. Use this process:

### For API Endpoints

Read every file in `src/pages/api/`. For each endpoint document:

1. **Happy path** — The expected request/response for normal usage
2. **Auth requirements** — Does it require auth? Admin only? What happens without auth?
3. **Input validation** — What happens with missing fields, wrong types, empty strings, negative numbers, strings that are too long?
4. **Edge cases** — What happens when the referenced entity doesn't exist? When the user doesn't own the resource? When a duplicate operation is attempted?
5. **Concurrency** — Can this endpoint race with itself? (e.g., two simultaneous daily claims)
6. **Side effects** — Does this endpoint modify other tables, trigger other computations, invalidate caches?

### For Business Logic (src/lib/)

Read every lib file. For each function that contains non-trivial logic:

1. **Boundary conditions** — What are the threshold values? (trust score at exactly 0.65, health score transitions, tier promotion boundaries)
2. **Time-dependent behavior** — Functions that use NOW(), date math, or time windows. What happens at boundary times?
3. **Calculation verification** — For trust score, health computation, P&L calculation: provide specific input scenarios with expected numeric outputs that tests can assert against
4. **Error handling** — What exceptions can be thrown? What happens with null/undefined inputs?

### For Cron Jobs

For each cron endpoint (compute-health, compute-trust, auto-publish, push-resets):

1. **Idempotency** — Can it safely run twice in a row?
2. **Empty state** — What happens when there's no data to process?
3. **Partial failure** — What if the job fails halfway through?
4. **Performance** — What's the expected runtime with 100 users? 1000?

### Critical Security Tests

Identify every place where:
- A user might access another user's data
- An admin endpoint might be accessible to non-admins
- PII (email addresses) might leak through API responses
- Trust score or tier information might be exposed inappropriately

### Output Format

Organize by feature area, not by file. Group related tests together. For each test case, provide:
- **Test ID** (e.g., TRUST-001)
- **Description** (one sentence)
- **Given** (preconditions)
- **When** (action)
- **Then** (expected outcome)
- **Priority** (P0 = security/data integrity, P1 = core functionality, P2 = edge cases, P3 = nice to have)

End with a "Test Infrastructure Recommendations" section suggesting the test framework, mocking strategy, and database setup approach that would work best for this stack.

Save the output as a markdown file.
```

---

## How to Use These Prompts

1. Open three new Cowork sessions (or Claude chats with codebase access)
2. In each, make sure the SweepsIntel project folder is selected/mounted
3. Paste the prompt
4. Let them run

**Chat 1** (Intel Deep Design) will take the longest and produce the most valuable output. It's the one that uses the iterative refinement methodology — four explicit passes per domain, with adversarial critique and persona-based evaluation built into the structure.

**Chat 2** (Schema Reference) is the most straightforward but saves time on every future prompt.

**Chat 3** (Test Spec) is insurance — you don't need it today, but when you need it, you'll be glad it exists.
