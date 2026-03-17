# SweepsIntel — Intelligence Layer Design v2

> **Status:** Design document. Not a spec. Requires founder decisions on flagged tensions before implementation.
> **Date:** 2026-03-17
> **Scope:** Five domains: Signal Lifecycle, Trust & Reputation, Discovery & Recommendation, Community Intelligence at Scale, Data Architecture.
> **Process:** Each domain goes through four passes: naive design, adversarial critique, perspective shift (Grinder/Casual/Contributor archetypes), and reconciled final design.

---

## Domain 1: Signal Lifecycle & Quality

### Pass 1 — First Draft

A signal is born when a user (or admin, or Discord pipeline) submits it. It passes through creation, validation, active life, aging, and archival.

**Creation.** The submission form captures: casino (required, from tracked list or search), signal type (free_sc, promo_code, flash_sale, playthrough_deal, platform_warning, general_tip), title (required, 10-120 chars), details (required, freeform), expiry (optional datetime, defaults vary by type — promo codes default to end-of-day, general tips default to none), and an anonymous toggle. The system auto-captures: submitter trust score at time of submission, submitter's portfolio relationship to the casino (do they track it? have they claimed there recently?), and a timestamp.

**Validation.** Signals from users with trust >= 0.65 publish immediately. Below that threshold, signals enter a brief hold (15 minutes) during which the system checks for duplicates against active signals for the same casino. If no duplicate is found, it publishes. If a duplicate exists, the new submission becomes a "confirmation" vote on the existing signal rather than a new entry.

**Active life.** A published signal is active. Votes accumulate. The signal's effective weight is a function of its age, vote ratio, and submitter trust score. Signals with expiry times show countdown timers.

**Aging.** Signals without explicit expiry get implicit aging: their display prominence decays after 12 hours and drops sharply after 24 hours. They remain visible but sort lower. Signals with explicit expiry transition to "expired" status when the clock runs out.

**Archival.** Expired or collapsed signals move to historical view after 7 days. They remain queryable but don't appear in the default feed. After 90 days, they compact into aggregate statistics (casino X had N promo codes in Q1) rather than individual records.

**Deduplication.** On submission, hash the normalized casino_id + signal_type + first 50 chars of content. If a match exists within the last 24 hours, merge: increment the existing signal's confirmation count, credit the submitter for the confirmation, and don't create a duplicate entry.

**Correction.** If a signal was wrong (promo code doesn't work), votes handle it — enough "didn't work" votes push it to likely_outdated or collapsed. If conditions changed after submission (casino pulled the deal), the original submitter can add an update note to their signal, which appends as a timestamped addendum rather than replacing the original content.

### Pass 2 — Adversarial Critique

1. **The 15-minute hold is theater.** At 10 users, nobody's submitting simultaneously. At 500 users, 15 minutes is too long — a flash sale signal sitting in hold for 15 minutes has already lost value. The hold should scale inversely with submitter trust, not be flat.

2. **Deduplication by content hash is brittle.** "Free 500 SC at Chumba" and "Chumba giving away 500 sweeps coins" are the same signal with completely different text. Content hashing catches exact duplicates (retries) but misses semantic duplicates (different people reporting the same deal). Need casino_id + signal_type + time window as the primary dedup key, with content hash as a secondary exact-match check.

3. **Implicit aging at 12 hours punishes non-US timezones.** A signal posted at 11pm EST is already decayed for a West Coast user checking at 8am. Aging should be relative to the signal's expected lifetime (type-dependent), not a flat clock.

4. **No mechanism to distinguish "expired naturally" from "was wrong."** Both end up in the same archival bucket, but they have very different implications for the submitter's trust score and the casino's signal history. An expired promo code that worked until it expired is a successful signal. A promo code that never worked is a bad signal.

5. **The 90-day compaction destroys forensic value.** If a casino turns problematic in month 6, you want to see the individual warning signals from months 1-3, not just "there were 4 warnings in Q1." Compaction should be for display, not for data destruction.

6. **No signal priority system.** A free 50 SC tip and a "casino is freezing all redemptions" warning have the same visual weight. Warnings should have inherent priority over deals.

7. **Update notes from submitters are gameable.** A bad actor submits a legitimate-looking signal, waits for it to gain traction, then edits the details to include a referral link or misinformation. Updates must be append-only and clearly timestamped, never replacing original content.

### Pass 3 — Perspective Shift

**The Grinder** loves the fast-publish path for trusted users — they've earned it and they want their intel visible immediately. They hate dedup merging because they want credit for being first, not for confirming someone else's find. The 12-hour aging frustrates them because they operate on a 20-hour cycle and often catch deals that Casuals miss. They'd stop using the system if their submissions kept getting merged into someone else's signal.

**The Casual** doesn't submit signals — they consume them. They want a clean feed where the noise is already filtered. They love implicit aging because old stuff disappears without them doing anything. They'd be frustrated if the feed showed 8 variations of the same Chumba deal because dedup failed. They'd stop using it if the feed required too much scrolling or mental filtering.

**The Contributor** cares deeply about attribution. Dedup merging where their submission becomes a "confirmation" feels like theft if they found the deal independently. They want to see "first reported by [them]" on signals they submitted first. They love the update mechanism because it lets them maintain their signals. They'd stop contributing if the system gave them no visible credit for being early or accurate.

### Pass 4 — Reconciliation

**Creation.** Same required fields as Pass 1, plus: the system records whether the submitter tracks the casino and their last claim timestamp (implicit credibility signal). Submitters can optionally tag a signal as "time-sensitive" which affects aging behavior.

**Validation & Publishing.** Trust-gated, not time-gated. Trust >= 0.65: instant publish. Trust 0.40-0.64: publish after 5-minute dedup window (catches most duplicates without killing timeliness). Trust < 0.40: held for next trusted-user confirmation or 30-minute auto-publish, whichever comes first. Warning signals (platform_warning type) always publish within 5 minutes regardless of trust — defensive intel is too important to gate.

**Deduplication.** Primary key: casino_id + signal_type + 4-hour window. When a match is detected: the first submission keeps its identity. Subsequent submissions become "confirmations" that increment the signal's confirmation_count and are listed as "also reported by [user]" in a collapsible section. Confirming users still earn trust credit (slightly less than original submission, but nonzero). A content_hash secondary check catches exact retries and silently drops them without credit.

**Signal Priority.** Signals carry an inherent priority tier: critical (platform_warning), high (flash_sale, promo_code with short expiry), normal (free_sc, playthrough_deal), low (general_tip). Priority affects sort order and visual treatment (critical signals get a persistent banner, not just a feed card).

**Aging.** Type-dependent decay curves rather than flat timers. Promo codes and flash sales decay rapidly (full weight for 4 hours, 50% at 8 hours, 25% at 16 hours, near-zero at 24 hours). Free SC and playthrough deals decay slowly (full weight for 24 hours, gradual decline over 72 hours). Warnings don't decay by time — they decay by resolution (positive health signals or admin dismissal). General tips are evergreen until manually archived or voted down.

**Expiry vs. Wrongness.** Track two terminal states: `expired` (timer ran out, signal served its purpose) and `debunked` (vote ratio exceeded collapse threshold while signal was still within its expected lifetime). These map to different trust score impacts — expired signals are neutral, debunked signals are negative.

**Archival.** Signals move out of the active feed after expiry + 48 hours or collapse + 24 hours. They move to a "recent history" tier visible with one click. After 90 days, they move to deep archive — still individually queryable via API and admin tools, but summarized in aggregate for user-facing views. No data destruction.

**Corrections.** Original submitters can append timestamped updates (max 3 per signal). Updates are append-only, visually distinct from the original, and cannot modify the original text. If an update contradicts the original signal, the system flags it for community re-evaluation.

**Remaining tension:** *First-reporter credit vs. dedup simplicity.* The Contributor wants credit for being first; the Casual wants a clean feed with no duplicates. The reconciliation gives "also reported by" credit, which partially satisfies both, but the first reporter still gets disproportionate visibility. This is a feature, not a bug — it rewards speed and accuracy.

---

## Domain 2: Trust & Reputation Dynamics

### Pass 1 — First Draft

Trust score (0.00-1.00) determines submission privileges, signal prominence, and contributor tier eligibility. Computed from four weighted factors: account activity (20%), submission history (30%), community standing (15%), and portfolio performance (35%).

**Cold start.** New users start at 0.50 trust. They can submit signals after 7 days or 5 claims (whichever comes first, unless trust >= 0.65 from other factors). First 3 submissions get no trust penalty for negative votes (learning period).

**Decay.** Trust decays at 0.02/month for users with no activity (no claims, no submissions, no votes) in the last 30 days. Floor of 0.20 — inactive accounts never reach zero.

**Recovery.** A single bad signal from a trusted user (trust > 0.70) reduces trust by the standard vote-weighted amount, but the system applies a "consistency buffer": if their last 10 signals have a worked ratio > 0.75, the penalty is halved.

**Implicit signals.** Daily claim consistency (claiming 5+ days/week for 4+ weeks) adds a passive trust boost of +0.05 per qualifying month, capped at +0.15 total. This rewards grinders who never submit intel but clearly know the space.

### Pass 2 — Adversarial Critique

1. **Portfolio performance at 35% weight is gameable and opaque.** A user could inflate P&L by logging fake winnings. There's no verification layer for self-reported financial data. Weighting unverifiable data this heavily in a trust system is structurally unsound.

2. **Vote rings.** Three friends can create accounts, submit signals for each other, and vote "worked" on each other's submissions. With the current 3-account minimum for signal status transitions, a small ring can keep bad signals alive indefinitely.

3. **The 7-day/5-claim gate for new users is too rigid.** A user who joins because their friend told them about a deal right now can't share that deal for a week. The gate should be bypassable with some friction (like requiring an existing trusted user to vouch).

4. **Trust decay punishes seasonal users.** Sweepstakes casinos have seasonal patterns (holidays, new launches). A user who's highly active Nov-Jan and dormant Feb-Apr shouldn't see meaningful trust erosion. Monthly decay is too aggressive.

5. **No concept of domain-specific trust.** A user might be an expert on Chumba Casino (submits accurate signals there) but unreliable about smaller casinos they don't track. Trust is currently a single global number.

6. **The consistency buffer for trusted users creates a two-tier system** where high-trust users face lower consequences. This is somewhat intentional (earned reputation provides buffer) but could breed resentment if perceived as favoritism.

### Pass 3 — Perspective Shift

**The Grinder** benefits enormously from implicit trust signals — they claim every day and their portfolio data is rich. They love that consistent activity builds trust passively. They'd be frustrated if their trust decayed during a 2-week vacation. They'd game portfolio weighting if they realized it was 35% of their score.

**The Casual** will never reach high trust through submissions alone because they rarely submit. They need the implicit path (claim consistency, portfolio health) to matter. They'd stop caring about trust entirely if it doesn't unlock anything they can perceive.

**The Contributor** lives for trust score. They want to see it, track its changes, and understand what moves it. They'd be frustrated by opaque calculations and would want a breakdown ("Your trust score is 0.78: activity +0.16, submissions +0.22, community +0.11, portfolio +0.29"). They'd also be the first to discover and exploit any gaming vectors.

### Pass 4 — Reconciliation

**Reweighted formula.** Account activity: 25%. Submission history: 35%. Community standing: 20%. Portfolio performance: 20%. The portfolio weight drops because self-reported financial data is inherently unverifiable. Submission history rises because it's the most auditable signal.

**Cold start.** New users start at 0.45 trust. Submission eligibility requires: (account age >= 3 days AND claim count >= 3) OR (an existing user with trust >= 0.70 invites them via a referral link that grants immediate submission access). The inviter's trust takes a small hit (-0.03) if the invitee's first 3 signals all get debunked, creating skin-in-the-game for vouching. First 3 submissions from any new user are tagged "new contributor" in the feed but otherwise treated normally — no immunity period, because immunity is exploitable.

**Decay.** Trust decays 0.01/month after 60 days of inactivity (not 30). Floor of 0.25. Decay pauses if the user has logged in within the window, even without submitting. This handles seasonal users who check in but don't contribute during slow periods.

**Vote ring resistance.** Votes are weighted by the voter's own trust score. A ring of three 0.45-trust accounts produces votes worth 0.45 each, while a single 0.85-trust vote is worth nearly double any one of them. Additionally: if > 50% of a user's "worked" votes come from the same 3 accounts, flag for review. No automated penalty — human review required because friends legitimately tend to verify each other's signals.

**Revenge downvoting resistance.** If a user votes "didn't work" on > 5 signals from the same submitter within 24 hours, the system caps their negative vote impact on that submitter at 2 signals' worth. The votes still count for signal status but don't compound into trust damage.

**Recovery.** Single-bad-signal from a trusted user (last 10 signals worked ratio > 0.70): penalty is applied but capped at -0.04 trust. This is meaningful but not career-ending. Two bad signals in a row: full penalty. Three in a row: potential tier demotion review.

**Implicit trust.** Daily claim consistency still boosts trust, but capped at +0.10 (down from +0.15) because it's a behavioral proxy, not a quality signal. Portfolio diversity (tracking 10+ casinos across 3+ parent companies) adds +0.03 as a one-time bonus — diverse portfolios indicate genuine engagement rather than single-casino gambling.

**Transparency.** Trust score is visible to the user with a simple breakdown by category (not exact formula, but directional: "Your submission history is your strongest factor"). Contributors see their trust trend over the last 90 days as a sparkline. Exact formula weights are not published to prevent gaming.

**Remaining tension:** *Transparency vs. gaming resistance.* Contributors want to see exactly what moves their trust score so they can optimize. But publishing the exact weights makes manipulation trivial. The compromise (directional feedback without exact coefficients) will satisfy most Contributors but will frustrate power users who reverse-engineer the system anyway.

---

## Domain 3: Discovery & Recommendation Algorithm

### Pass 1 — First Draft

The discovery queue recommends untracked casinos. Currently it's a flat list filtered by state eligibility and sorted by estimated daily value. It should become a personalized, temporally aware recommendation engine.

**Personalization signals.** User's existing portfolio composition (which tiers, which parent companies), P&L trend (are they profitable? at which casinos?), risk tolerance (inferred from promoban risk profile of tracked casinos), and activity level (daily claimer vs. weekly checker).

**Intel-informed.** Casinos with active high-value signals (unexpired promo codes, flash sales) get a temporary boost in discovery ranking. "Casino X has 2 active deals right now" is a compelling pitch.

**Collaborative filtering.** "Users who track Casino A and Casino B also track Casino C" — simple co-occurrence matrix, refreshed daily.

**Negative signals.** When a user removes a casino from their portfolio, record the removal and downweight that casino in their personal recommendations. If many users remove the same casino in a short window, treat it as a weak health signal.

### Pass 2 — Adversarial Critique

1. **Collaborative filtering at 10 users is noise.** You need at least 50-100 users with meaningful portfolio overlap before co-occurrence patterns are statistically useful. At launch, this will produce random-looking recommendations.

2. **Intel-informed boosting creates a feedback loop.** Casinos that already get signals get recommended more, which gets them more users, which gets them more signals. New or underserved casinos get stuck with no intel and no recommendations.

3. **Risk tolerance inference is unreliable.** A user might track high-promoban-risk casinos because they're profitable despite the risk, not because they're risk-tolerant. Inferring preference from behavior here is dicey.

4. **No accounting for casino quality vs. casino novelty.** A new user needs quality recommendations (high-tier, well-understood casinos). An experienced user needs novelty (casinos they haven't tried yet, especially undercovered ones). Same algorithm shouldn't serve both.

5. **Temporal relevance sounds good but is hard to operationalize.** What's different about morning vs. evening recommendations? Unless casinos have time-specific resets or deals, this adds complexity without value.

### Pass 3 — Perspective Shift

**The Grinder** already tracks 30+ casinos and probably knows every casino in the system. Discovery is almost useless to them unless it surfaces genuinely new casinos they haven't seen or highlights temporary deals at casinos they intentionally skipped. They want the algorithm to explain *why* it's recommending something — "You skip this casino but it has a flash sale ending in 3 hours" is useful. "You might like this casino" is not.

**The Casual** has 5-8 casinos and doesn't want to think about optimization. They want discovery to hand them the obvious next casino: "Based on your portfolio, adding Casino X would increase your daily earnings by approximately $2.50." Simple, concrete, one recommendation at a time.

**The Contributor** sees discovery through the intel lens. They want to know which casinos are underserved by intel — "Casino X has 200 users but zero signals this week" is a contribution opportunity. They don't just consume discovery; they use it to identify where to focus their submissions.

### Pass 4 — Reconciliation

**Three-mode discovery based on user maturity.**

*Mode 1: Onboarding (0-5 tracked casinos).* Show top 5 casinos by estimated daily value in the user's state, filtered to tier S and A only. Each card shows a single concrete number: estimated daily SC value. No collaborative filtering, no intel boost — just the fundamentally strong casinos. Goal: get the user to a 6-casino portfolio fast.

*Mode 2: Growth (6-15 tracked casinos).* Begin introducing personalization. Rank untracked casinos by a blended score: 40% estimated daily value, 30% portfolio gap (parent company diversity, tier diversity), 20% active intel boost (signals in last 48 hours), 10% collaborative filtering signal. The collaborative filtering weight stays low until the user base supports it (threshold: 100+ users with 10+ tracked casinos). Below that threshold, redistribute its weight to estimated value.

*Mode 3: Expert (16+ tracked casinos).* The user knows the space. Discovery shifts from "what should you add?" to "what's happening at casinos you chose not to track?" Show two sections: (a) "Opportunities you're missing" — untracked casinos with active high-value signals, sorted by signal recency and value, and (b) "Intel gaps" — casinos with high user counts but low signal volume in the last 7 days, framed as contribution opportunities for those with Contributor motivation.

**Intel-informed boosting with decay and caps.** Active signals boost a casino's discovery score, but the boost is capped at +30% of base score and decays as the signal ages. This prevents the feedback loop where signal-rich casinos dominate discovery permanently.

**Negative signal handling.** User removals suppress that casino for 90 days in that user's feed. Mass removals (5+ users removing the same casino within 7 days) generate an admin flag and reduce the casino's discovery score by 15% globally for 30 days.

**The "quiet expert" influence.** Users who never submit intel but have top-quartile portfolio performance (ROI over 90 days) have their portfolio composition fed into the collaborative filtering model with a 1.5x weight multiplier. Their behavior is treated as a stronger signal than average because they're clearly making good decisions, even if silently.

**Remaining tension:** *Recommending good casinos vs. timely casinos.* A stable, high-value casino with no current deals is a better long-term recommendation than a mediocre casino running a flash sale. But the flash sale has urgency. The reconciliation puts fundamentals first (daily value, tier) with intel as a boost, which means timely-but-mediocre casinos won't dominate — but users who want deal-chasing will need to use the Intel Feed directly rather than relying on discovery.

---

## Domain 4: Community Intelligence at Scale

### Pass 1 — First Draft

At 500 active users, signal volume could reach 50-200 signals/day. The system needs curation, moderation, trend detection, and regional intelligence.

**Signal volume management.** Group signals by casino and type. Instead of showing 15 individual "Chumba free SC" signals, show one consolidated signal card with a confirmation count. Feed defaults to "top signals" sorted by a composite of recency, vote ratio, and submitter trust.

**Moderation.** Automated first pass: signals from trust < 0.30 users are held for review. Signals containing URLs are held regardless of trust (spam vector). Admin queue surfaces held signals with one-tap approve/reject. At scale, recruit volunteer moderators from Insider-tier contributors with a lightweight moderation interface.

**Regional intelligence.** Signals can be tagged with state relevance. Users see state-relevant signals prioritized when their home state is set. State-specific deal availability is tracked (a promo code that only works in certain states should say so).

**Trending detection.** If 3+ unique users submit warning signals about the same casino within 6 hours, the system auto-escalates the casino's health status by one level and generates a "Trending Alert" banner. This catches emerging problems before the cron-computed health score catches up.

**Cross-casino pattern detection.** Casinos sharing a parent_company are linked. A health downgrade at one casino in a family triggers a "Related alert" badge on sibling casinos.

### Pass 2 — Adversarial Critique

1. **Consolidation hides disagreement.** If 10 people confirm a Chumba deal and 5 say it didn't work, the consolidated card might show "15 reports, 10 confirmations" — but the 5 failures might be state-specific or account-type-specific. Consolidation needs to surface the disagreement, not just the net count.

2. **Volunteer moderators create power dynamics.** Insider-tier users moderating Newcomer submissions creates hierarchy that can be abused (suppressing competition, playing favorites). Moderation actions need audit trails and appeal mechanisms.

3. **The 3-user trending threshold is too low at 500 users.** Three coordinated bad actors could manufacture a fake crisis at any casino. The threshold should scale with user base size and require minimum trust levels.

4. **Cross-casino pattern detection assumes parent company problems propagate equally.** VGW owning both Chumba and LuckyLand doesn't mean a Chumba redemption issue affects LuckyLand. The system should flag the relationship, not auto-escalate.

5. **No distinction between signal-generation markets and signal-consumption markets.** Most signals come from power users, but most consumption comes from Casuals. The system is optimized for generation (submission UX, dedup) but not for consumption (feed clarity, noise reduction).

6. **State tagging is optional, which means it'll rarely be used.** Contributors won't bother tagging states unless it's trivially easy or automated.

### Pass 3 — Perspective Shift

**The Grinder** wants raw, unfiltered access to every signal. Consolidation annoys them because they want to see who reported what and when. They'd disable any "simplified" view. They want the trending alerts because they act on information asymmetry — knowing about a problem 30 minutes before the Casual gives them time to act.

**The Casual** is overwhelmed by 200 signals/day. They want the system to tell them 3 things: what deals are active at my casinos, are any of my casinos in trouble, and is there anything I should do today. Everything else is noise.

**The Contributor** wants moderation to feel fair and transparent. If their signal gets held or consolidated into someone else's, they want to know why. They'd volunteer as moderators enthusiastically but would be demoralized if their moderation actions were overridden without explanation.

### Pass 4 — Reconciliation

**Two-layer feed architecture.** The default feed is "curated" — consolidated signals grouped by casino, sorted by a composite score, with smart summaries. One tap expands to the "raw" view showing all individual submissions, timestamps, and per-user attribution. The Casual never leaves curated view. The Grinder lives in raw view. Both are first-class experiences.

**Consolidation with disagreement visibility.** Consolidated signal cards show: title, confirmation count, and a "mixed results" indicator when >20% of votes are negative. The mixed results indicator expands to show a brief breakdown: "Works in most states. Users in MI and WA report issues." State inference is automated where possible (user's home_state from settings, applied probabilistically when they vote "didn't work").

**Moderation.** No volunteer moderators in v2. Instead: automated hold queue (trust < 0.30, contains URLs, flagged keywords) + admin review. At 500+ users, reassess. If volunteer moderation is introduced, it gets its own design pass with audit trails, appeal flow, and rotation to prevent power concentration.

**Trending detection.** Dynamic thresholds: min(5, ceil(active_users / 100)) unique users with trust >= 0.40 submitting warnings about the same casino within 6 hours triggers trending status. At 500 users, that's 5 unique trusted users — much harder to manufacture than 3 random accounts. Trending creates a banner, not an auto-escalation. Health score changes still go through the existing computation pipeline with its own thresholds.

**Cross-casino patterns.** Parent company linkage generates an informational badge ("Casino X's parent company VGW also operates Casino Y, which is experiencing issues"), not automatic health escalation. Admin can manually propagate escalations across a family when warranted.

**State intelligence.** Auto-tag signals with submitter's home state when submitted (user can override). Aggregate state tagging over time reveals which deals are state-specific. Display "Confirmed in: CA, TX, NY (3 states)" on signals where state data exists. Don't require manual state tagging — derive it from who confirms.

**Expert identification.** Track "first reporter" rate: percentage of a user's signals where they were the first to report that deal. Users with first_reporter_rate > 60% and at least 15 signals qualify as "Early Bird" recognition (displayed on their profile, visible in attribution). This is orthogonal to contributor tiers — it rewards speed specifically.

**Remaining tension:** *Editorial vs. algorithmic curation.* The curated feed is algorithmic by default. But some situations (casino shutdowns, industry-wide events) need an editorial hand — a pinned announcement, a curated summary. The system should support admin-pinned signals that override algorithmic sorting, but this is inherently non-scalable. At scale, editorial curation becomes a bottleneck unless the admin team grows.

---

## Domain 5: Data Architecture for Intelligence

### Pass 1 — First Draft

The intelligence layer needs to capture data now that will power features later. This means event sourcing, analytics pipelines, archival strategy, privacy design, and API surface planning.

**Event sourcing.** Log every state change for signals (created, published, status_changed, voted, expired, archived), trust scores (recomputed, decayed, manually adjusted), and health scores (recomputed, escalated, de-escalated, admin overridden). Each event is an immutable append-only record with timestamp, actor, old_value, new_value, and reason.

**Analytics pipeline.** Key system health metrics: signals submitted per day (velocity), signal accuracy rate (% that don't get debunked), mean time to first vote (engagement), trust score distribution (community health), health status distribution across casinos (ecosystem stability).

**Historical data.** All signals retained indefinitely in an archive table. Active tables are kept lean. Archival happens on a schedule (weekly batch move of signals expired > 7 days).

**Privacy.** Users who submit anonymously expect permanent anonymity — their user_id is stored for trust computation but never exposed through any API response. Users who submit with attribution can request retroactive anonymization (GDPR-style right to erasure of identifying information, not of the signal itself).

**API surface.** Design current APIs to be extensible for: Discord bot (read-only feed of high-value signals), browser extension (signal overlay on casino websites), and mobile push (notification endpoint).

### Pass 2 — Adversarial Critique

1. **Full event sourcing is expensive.** At 500 users with trust recomputed every 30 minutes, that's 500 events per recomputation cycle, 24K events per day just for trust, before counting signals and votes. Need selective event sourcing — log meaningful state changes, not routine recomputations.

2. **The archive table will grow without bound.** Signals, votes, events — all immutable, all retained. Need a tiered storage strategy or at minimum a data retention policy with defined horizons.

3. **Analytics pipeline assumes a batch processing model** but the system needs real-time metrics too (trending detection, health escalation). Need both batch (daily/weekly aggregates) and streaming (event-driven) paths.

4. **Privacy design is incomplete.** Anonymous submissions still create entries in the signal_votes table when others vote on them. Those vote records aren't identifying, but if a user requests deletion of their account, the cascading implications on vote counts, trust scores of voters, and signal status need to be thought through.

5. **API surface for external integrations assumes stable data models.** Version the API from day one. A Discord bot built against v1 of the feed API shouldn't break when v2 adds fields.

6. **No consideration of data that should be captured but isn't today.** User session data (time spent on Intel Feed, which signals they expand, scroll depth), submission drafts that were abandoned, and the specific moment a user decides to track or untrack a casino — all valuable behavioral data for improving recommendations and detecting issues.

### Pass 3 — Perspective Shift

**The Grinder** generates enormous amounts of behavioral data (30+ claims/day, frequent feed checks) and would be spooked if they knew how much was tracked. They want data to power better recommendations but don't want to feel surveilled. They'd also want data export — "let me download my full history as CSV."

**The Casual** generates minimal behavioral data and doesn't think about privacy. They assume the app works like any other app. They'd be upset if their anonymous signal was somehow deanonymized.

**The Contributor** wants their data to work for them. They'd love a personal analytics dashboard showing their signal accuracy rate over time, their trust score trend, their contribution impact. They'd also want to know exactly what data is collected about them.

### Pass 4 — Reconciliation

**Selective event sourcing.** Log state changes that are: (a) user-initiated (submissions, votes, portfolio changes), (b) system-initiated with material impact (trust score changes > 0.05, health status transitions, tier promotions/demotions), or (c) admin actions (overrides, signal moderation). Do NOT log routine recomputations where nothing changed. Event schema: `{event_type, entity_type, entity_id, actor_type, actor_id, old_value, new_value, metadata_json, created_at}`.

**Tiered storage.** Hot tier (active signals, last 30 days of events): primary database. Warm tier (archived signals, 30-180 days of events): same database, partitioned tables with relaxed indexing. Cold tier (180+ days): compressed export to object storage (S3/R2), queryable via admin tooling but not real-time APIs. Retention: hot and warm data retained indefinitely in database. Cold data retained for 2 years, then reviewed.

**Behavioral telemetry.** Capture lightweight anonymous behavioral events: feed_view, signal_expand, signal_vote_initiated, discovery_card_click, casino_track, casino_untrack. These are anonymous (keyed to session, not user) by default, attributed to user only if they've opted into "personalized recommendations" in settings. This data powers recommendation quality without creating a surveillance feel.

**Privacy framework.** Two anonymity levels: "anonymous submission" (user_id stored for trust only, never in API responses) and "full account deletion" (user_id removed from all submissions, votes reassigned to a ghost account, trust recalculated for affected signals). Anonymous submission is reversible (user can choose to claim credit later). Full deletion is irreversible. Signal content persists after deletion because the community relied on it — only the attribution link is severed.

**Data export.** Users can export: their submission history, vote history, claim history, ledger entries, and trust score history. Export format: JSON and CSV. Available via settings page. This satisfies GDPR data portability and serves the Grinder's desire for personal analytics.

**API versioning.** All external-facing endpoints get a version prefix (/api/v1/intel/feed). Internal endpoints (cron jobs, admin) don't need versioning. Breaking changes require a new version; additive changes (new optional fields) can be added to existing versions. Deprecation policy: old versions supported for 6 months after successor launch.

**Metrics that matter.** Dashboard for founder: daily active signal submitters, signal accuracy rate (7-day rolling), median time from signal creation to first vote, trust score distribution histogram, health status distribution, discovery conversion rate (recommendations → tracks), and feed engagement (views per signal). These metrics tell you whether the intelligence system is generating value or just generating noise.

**Remaining tension:** *Behavioral telemetry depth vs. user trust.* Richer behavioral data produces better recommendations. But users in this community are privacy-conscious (they're tracking financial activity at semi-regulated casinos). The compromise — anonymous by default, attributed only with opt-in — is the right starting point but may need revisiting if recommendation quality suffers from insufficient attributed data.

---

## System-Wide Tensions

These are product-level tradeoffs that cut across all five domains. Each requires a founder decision.

**1. Quality vs. Volume.** Every mechanism that gates signal quality (trust thresholds, hold queues, dedup merging) reduces signal volume. Every mechanism that encourages volume (low barriers, instant publish, generous trust) risks noise. The current design leans toward quality-first with escalating privilege, but the cold-start period (first 50 users) will feel sparse. **Decision needed:** Accept sparse intel in early months, or lower the quality bar during a defined bootstrap phase?

**2. Attribution vs. Anonymity.** Contributors want credit. But named attribution makes every signal a personal reputation bet, which discourages marginal contributors from submitting uncertain intel. The anonymous toggle helps, but if most people submit anonymously, the contributor tier system loses its motivational power. **Decision needed:** Default to anonymous or default to attributed? The system currently defaults to attributed.

**3. Algorithmic Trust vs. Perceived Fairness.** The trust system uses opaque weights, weighted votes, and behavioral inference. Power users will reverse-engineer it. When they discover that portfolio data or claim consistency affects trust, they'll either optimize (good) or feel manipulated (bad). **Decision needed:** Publish a simplified trust explainer document, or keep it opaque and accept the backlash when users figure it out?

**4. Real-time Health vs. False Alarms.** Trending detection and fast health escalation catches real problems early. But false positives (3 users misreporting, coordinated FUD attack) can tank a casino's health indicator and spook users into pulling redemptions, creating a self-fulfilling crisis. **Decision needed:** Favor sensitivity (catch problems fast, accept some false alarms) or specificity (fewer alerts, risk missing fast-moving problems)?

**5. Discovery Personalization vs. Ecosystem Health.** Personalized discovery sends users to casinos that match their profile, which concentrates the user base on a smaller set of "optimal" casinos. This reduces diversity and makes the platform vulnerable to a single casino's problems. Showing some less-optimal but ecosystem-diversifying recommendations would spread risk. **Decision needed:** Optimize purely for individual user value, or include a diversity factor that serves platform resilience at slight individual cost?

**6. Contributor Tier Prestige vs. Inclusivity.** Tiers motivate the Contributor archetype but can demoralize Newcomers who see high-tier badges and feel outclassed. The gap between Newcomer and Scout (5 signals, 60% accuracy, 14 days) is achievable but non-trivial. **Decision needed:** Keep tiers publicly visible on all signals (prestige motivator), or only show tiers on the contributor's own profile (reduce status anxiety)?

**7. Signal Feed as Record vs. Signal Feed as Tool.** Should the Intel Feed be a chronological record of everything that was reported (newspaper model), or a curated view of what's currently actionable (dashboard model)? The current design supports both via the curated/raw toggle, but the default sets the tone. **Decision needed:** Default to curated (better for Casuals, worse for Contributors who want to see everything) or raw (better for power users, overwhelming for Casuals)?

**8. Admin Bottleneck vs. Community Self-Governance.** The system currently routes all moderation through the admin (Dylan). This works at 10-50 users but breaks at 500. Volunteer moderators introduce governance complexity. Fully algorithmic moderation misses edge cases. **Decision needed:** At what user count does the admin commit to delegating moderation, and to whom — trusted community members, paid part-time moderators, or purely automated systems with admin override?

**9. Data Richness vs. Simplicity of Implementation.** Event sourcing, behavioral telemetry, tiered storage, and API versioning are all architecturally correct but represent significant engineering investment. The current system runs on Neon + Vercel with cron jobs. Some of these designs imply infrastructure that doesn't exist yet. **Decision needed:** Which data architecture investments are prerequisite for v2 features, and which can be deferred until the user base justifies the complexity?
