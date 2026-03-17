# SweepsIntel — Discord Monitoring Pipeline Specification v1

_Companion document to CODEX-PROMPT-v3. This spec defines how the monitoring pipeline extracts, filters, and routes Discord intel to the SweepsIntel ingest endpoint. The Codex prompt defines what the site accepts (the ingest endpoint schema). This document defines what gets sent and how._

_The monitoring pipeline is NOT part of the Codex build. It runs as a separate Claude-in-Chrome session. But its design constraints shape the ingest endpoint schema and admin panel behavior, which is why both documents must stay aligned._

---

## Architecture overview — two-stage pipeline

The monitoring pipeline uses two models in sequence to balance cost, speed, and judgment quality.

**Stage 1: Extraction (Sonnet)**
Runs frequently (every scan interval, e.g. 30 minutes). Scrapes Discord channels via Claude-in-Chrome screenshot approach. Applies the Layer 1 kill filter. Outputs a structured intermediate format — a cleaned list of candidate signals with raw text, identified casino name, author username, timestamp, any extracted terms (codes, prices, SC amounts), and emoji reaction counts visible in the screenshot.

Sonnet is well-suited here because extraction is mechanical: read messages, identify structure, pull out deal terms, match casino names, extract codes. The noise it throws is an instructions problem, not a capability problem — with a tight schema and explicit discard rules, Sonnet cleans up significantly.

**Stage 2: Interpretation (Opus)**
Runs on Stage 1 output only — a much smaller input (typically 5-15 candidate signals per scan, not 200 raw messages). Opus handles the judgment calls: confidence scoring (including trust tier lookups), corroboration matching against recent flags, expiry estimation, cross-channel deduplication, routing decisions, AI summary generation, and final JSON payload construction for the ingest endpoint.

This is where Opus earns its cost. Deciding whether a cluster of messages constitutes a corroborated pattern, assessing single-user report credibility, writing the AI summary for Dylan's admin queue, estimating expiry from context clues, distinguishing novel game mechanic discoveries from generic strategy chat — all of these benefit from deeper reasoning.

**The usage math works** because Stage 1 processes high volume cheaply. Stage 2 only touches survivors. Opus runs on 5-15 signals instead of 200 raw messages.

---

## Layer 1 — Kill filter (applied by Sonnet at extraction)

These items are discarded at extraction time. They never reach the ingest endpoint. They never enter Dylan's review queue. The monitoring script does not report them, summarize them, or acknowledge them.

**Always kill:**

- **@notifiers bot posts.** All posts from the @notifiers bot role. These are automated notifications, not user intel. Skip entirely.
- **Dogbear, DogBot, and any Dogbear announcements.** These will appear substantial — server announcements, event notices, promotional posts from the server owner. They are not actionable intel for SweepsIntel. Dogbear's SweepsGrail promos, server events, partnership announcements = all killed. The monitoring pipeline extracts community intel, not server operator content.
- **GIFs, memes, emoji-only messages, off-topic chatter.** Car photos, Spider-Man GIFs, Wordle results, reaction chains with no informational content.
- **Giveaway announcements.** Discord giveaways last seconds to minutes. By the time the monitoring pipeline scans, extracts, ingests, and Dylan reviews — the giveaway is over. These are not viable for the SweepsIntel intel feed. Kill them.
- **Streamer information, stream schedules, streaming discussion.** Who is streaming where and when is a separate feature (Streamer Schedule, post-MVP). The monitoring pipeline does not extract streamer intel at MVP.
- **Strategy discussions with no novel discoverable edge.** "I like baccarat for washing" = kill. "Shuffle dice: play 1k through on turbo at .1 = ~10k dice, yields 3 SC/day" = keep (novel, specific, replicable). The distinction is: does this contain a specific, actionable technique that a user could apply? If it's general chatter about known approaches, kill it.
- **Individual win screenshots** unless the amount or context signals something systemic (a $50k cashout at a casino known for small limits = systemic signal; a $51 first redemption = individual milestone, kill it).
- **Unanswered questions.** "Can you crosswash on American Luck?" with no response = noise. A question only becomes signal when it gets an answer or when multiple people ask the same question (which itself becomes a signal routed to admin_flags as demand/confusion indicator).
- **Single-user complaints about support or email delivery** unless they describe account closure, ban, or fund confiscation. "I haven't gotten my Punt promo email" from one person = kill. "Punt banned my account and confiscated my balance" = keep regardless of single-user status.
- **Deal commentary without deal terms.** "Omg more deals just dropped" or "HungryKitten already bought and washed it" = kill. The DEAL ITSELF (terms, price, SC amount, casino) is what gets extracted — not the reaction to it.
- **Blacklisted users.** Any message from a user on Dylan's distrust blacklist (see Trust Tiers section) is killed entirely. Their content is invisible to the pipeline.
- **Excluded platforms** (when Dylan defines them). At MVP, no platforms are excluded. When an exclusion list is defined, all discussion of excluded platforms is killed at Layer 1.

**The test for Layer 1 is simple:** If Sonnet cannot extract at least one of (a) a specific deal with terms, (b) a promo/bonus code, (c) a platform health signal with casino identification, (d) a state/regulatory event, (e) a novel game mechanic discovery, or (f) a game availability signal (which games exist at which casinos) — then the message cluster is noise. Kill it.

---

## Layer 2 — Route to `discord_intel_items` (Opus decides)

These are items destined for the public intel feed after Dylan's approval. The filter: would a SweepsIntel user who tracks this casino want to see this, and will it still be relevant by the time it publishes?

**Routes to intel items:**

- **Promo codes with confirmed working status.** A code posted by one user AND confirmed by at least one other user (or confirmed by a Tier 1 trusted user alone) = high confidence. A code posted with no confirmation = low confidence, still route but flag as unverified.
- **Flash sales with specific terms and reasonable shelf life.** "McLuck VIP deal: $49.99 → 106,000 GC + 53 Free SC, ends in 11 hours" = yes. Must include: casino name, price, what you get, and ideally a time window.
- **Deposit match offers with concrete numbers.** "Stimi 40% deposit match on $250 — deposit 250, get 100 in free bets" = yes.
- **Free spin/coin drops that are platform-wide** (not account-specific). "Luck Party email: 30 free spins in Diamond X — load the game from SC mode" = yes. "Nolskeet's personal email PB deal at $5.99 → 7.2 SC" = no (account-specific, personal referral link territory).
- **Opt-in giveaway links with expiry windows** (distinct from instant giveaways which are killed). A promotional opt-in page at `casino.com/promotions/...` that stays live for hours/days = yes. These are platform-wide promotional URLs, not personal links.
- **Novel playthrough/game discoveries.** "Spinquest game X has x1 playthrough instead of x3 — bet at Y per spin" = high-value intel item. This is the gold standard signal.

**Critical sub-filter: every intel item must map to a `casino_id`.** If the script can't confidently match a casino name from the message to a casino in the SweepsIntel database, it should:
1. Attempt fuzzy match against the casino slug list
2. If no match: still route, but set `casino_id = null` and populate `casino_name_raw` with the raw name
3. Admin manually links or ignores unmatched items

**What does NOT route to intel items:**
- Positive redemption signals ("MyPrize paying again!") → admin_flags (low priority, positive health signal)
- Cross-wash and washing strategy intel → admin_flags with "premium content candidate" tag
- Deal quality assessments ("profit margin too thin") → not extracted separately; the deal itself routes, editorial context does not
- Platform health warnings → admin_flags (requires platform action, not just user awareness)

---

## Layer 3 — Route to `admin_flags` (Opus decides)

These are signals that affect platform operations. Dylan reviews and acts in the admin queue.

**Routes to admin_flags:**

- **State legislation or regulatory action.** "Indiana sweepstakes ban confirmed — shutdown by July" = immediate flag. Proposed action: "Update state_legal_status for IN, review casino_state_availability for all IN casinos."
- **Provider pullouts with state identification.** "Sit n Spin provider pulled from Indiana and Minnesota" = flag. Proposed action: "Provider cascade — update provider_state_availability, cascade to affected casinos, notify state subscribers."
- **Redemption pattern shifts when corroborated.** Two or more users reporting cancellations/delays at the same casino within a scan window = flag. Proposed action: "Monitor — [N] users report redemption issues at [Casino] in last [timeframe]. Consider updating redemption_speed_desc."
- **Platform fee discoveries corroborated by 2+ users.** "TAO charges ~2% on bank transfers" confirmed by multiple users = flag. Proposed action: "Update redemption_fee_desc for TAO."
- **Ban reports from Discord.** Any mention of account closure, hardban, promoban, or fund confiscation = flag. Single reports are valid here (bans are individually experienced). Proposed action: "Review — ban report at [Casino], type: [promoban/hardban/confiscation]."
- **New casino sightings not in the database.** A casino name discussed that doesn't match any slug = flag with "new casino signal" type. Proposed action: "New casino mentioned: [Name]. [N] users discussed it. Consider adding to database."
- **Positive redemption signals (low priority).** "MyPrize paying again" = flag at low priority. Proposed action: "Positive signal — [Casino] redemptions confirmed flowing. No action required unless redemption health was previously flagged."
- **Premium content candidates.** Novel washing strategies, cross-wash intel, specific game mechanic discoveries that are too detailed for the free feed. Flag with "premium content candidate" tag. Proposed action: "Premium content candidate — review for future paywall content."
- **Broken platform features when corroborated.** "Chanced purchase button broken during sale" from 2+ users = flag. Proposed action: "Platform issue — [Casino] purchase flow reported broken by [N] users. Monitor for resolution."

---

## Trust tiers — source authority weighting

The monitoring pipeline weights source credibility using a hardcoded trust tier configuration. This is NOT the same as the `trust_score` on `user_settings` (which is for SweepsIntel registered users submitting community reports). Discord trust tiers are maintained by Dylan as a monitoring config — a simple JSON object the monitoring script references when it identifies message authors.

### Tier 1 — Absolute authority

A short list (5-8 people). Dylan personally knows and trusts these voices. When a Tier 1 user reports something, the pipeline treats it as equivalent to 2 regular reports for corroboration purposes.

**Effects:**
- A single Tier 1 report of a provider pullout or state restriction → flagged immediately at medium confidence (no corroboration wait)
- A Tier 1 confirmation of a promo code → treated as confirmed (sufficient for intel item routing without additional confirmation)
- A Tier 1 deal quality assessment is noted in the AI summary for Dylan's context (not published, but informs Dylan's review)

**Maintenance:** Dylan adds/removes names manually. This list is small enough that it never needs automation.

### Tier 2 — Known regulars

Broader list (15-20 people). Consistent posters whose reports are generally reliable but don't carry standalone authority.

**Effects:**
- Two Tier 2 reports corroborate each other (whereas two unknown users don't auto-corroborate)
- A Tier 2 confirmation of a promo code adds weight but doesn't single-handedly confirm it
- Tier 2 users' messages are processed normally but their author identity is available to Opus for confidence scoring

**Maintenance:** Dylan adds/removes names periodically as he observes the Discord.

### Untiered users

Everyone else. Their reports enter the pipeline at base confidence. Standard corroboration rules apply — typically 2-3 independent reports needed to promote confidence.

### Blacklisted users (distrust list)

Users Dylan has flagged as unreliable, malicious, or noise generators. **All messages from blacklisted users are killed at Layer 1.** Their content is invisible to the pipeline. This is a safety mechanism — if someone is consistently posting bad codes, misleading deal terms, or spam, Dylan can remove them from the pipeline entirely.

**Maintenance:** Dylan adds names manually via admin config. Blacklist takes priority over all trust tiers (a formerly Tier 1 user who turns malicious gets blacklisted and all future messages are killed).

### Configuration format

```json
{
  "trust_tiers": {
    "tier_1": ["HungryKitten", "LeFloop", "Darb", "Zitrone", "Nolskeet"],
    "tier_2": ["coryanderson830", "blitz28179", "TheFractionzz", "Zircon35", "SweetKitty", "Jack"],
    "blacklist": []
  }
}
```

_The names above are illustrative based on observed bearcave activity. Dylan will confirm the actual list._

### Trust promotion signals — reaction-based discovery

The monitoring pipeline should **actively surface trust promotion candidates** based on Discord emoji reactions. When an untiered or Tier 2 user's message receives 3+ positive reactions (✅, 🔥, 💯, 🙏, 👍), log this as a trust promotion signal in the scan report:

```
TRUST_SIGNAL: [username] received [N] positive reactions on [casino/topic] intel. Consider promoting to Tier 2.
```

**Why this matters:** Active contributors whose content the community consistently validates are the pipeline's best signal sources. Tracking who gets reactions across multiple scans surfaces Tier 2 candidates organically — Dylan doesn't have to manually watch every conversation to know who's reliable.

**Accumulation logic:** A user who receives 3+ positive reactions on 5+ separate scan cycles is a strong Tier 2 candidate. A Tier 2 user who consistently gets 5+ reactions may warrant Tier 1 consideration. The pipeline does not auto-promote — it surfaces the evidence, Dylan decides.

**Negative signal:** A user whose messages repeatedly receive 2+ negative reactions (❌, 👎) is a watch-list candidate for potential blacklisting. Log these too:
```
TRUST_WARNING: [username] received [N] negative reactions on [topic]. Review for blacklist consideration.
```

---

## Emoji reaction signals — community pre-validation

Discord users already signal quality through emoji reactions on messages. The monitoring pipeline MUST extract visible reaction counts from screenshots and use them as a corroboration signal.

**How this works in practice:**

When a user posts a promo link or deal and other users react with ✅, 🔥, 🙏, or similar positive reactions — that is a community pre-validation signal. The screenshot in Dylan's example shows a CrownCoins Casino link with ✅ 3 and 🔥 1 reactions. Those reactions told Dylan the link would work before he clicked it.

**Extraction rules (Stage 1 — Sonnet):**
- For every candidate signal, extract the visible emoji reaction counts from the screenshot
- Map positive reactions (✅, ✔️, 🔥, 💯, 🙏, thumbs up) to a `positive_reaction_count`
- Map negative reactions (❌, 👎, ⚠️) to a `negative_reaction_count`
- Include both counts in the intermediate output

**Interpretation rules (Stage 2 — Opus):**
- `positive_reaction_count >= 3` on a promo code or deal = treat as community-confirmed (equivalent to 1 corroboration report)
- `negative_reaction_count >= 2` = flag as potentially broken/expired, reduce confidence
- High positive-to-negative ratio (e.g. 8:1) = high confidence signal
- Reactions alone don't replace Tier 1/2 confirmation, but they stack with it

**This is NOT visible to SweepsIntel users.** Reaction counts from Discord are internal confidence signals only. SweepsIntel has its own community verification mechanic (confirm/dispute on published intel items). The Discord reactions inform whether to publish; the SweepsIntel reactions validate after publishing.

---

## Cross-channel deduplication

The same intel item often surfaces in multiple Discord channels. The most common pattern: a deal or code appears in #bearcave-chat first (organic discussion), then gets posted to #free-sc by an authority user who tags @notifiers (as seen in Dylan's screenshot example — Zircon35 tagged @notifiers after the CrownCoins link was already posted in bearcave by Melon).

**Deduplication rules:**

1. **Content hash matching.** The ingest endpoint already checks `content_hash` (SHA-256 of title+content) before inserting. If the same deal is extracted from both channels in the same scan, only the first insert succeeds.

2. **Casino + item_type + time window matching.** Even if title/content differ slightly between channels, Opus should recognize the same underlying deal. If a flash sale for McLuck was already extracted from #bearcave-chat in this scan, and a similar McLuck flash sale appears in #free-sc — Opus should merge them (keeping the richer content) rather than creating two items.

3. **Source channel priority.** When a duplicate is detected, prefer the version from #bearcave-chat (typically richer context from organic discussion) over #free-sc (typically shorter/formatted). Exception: if the #free-sc version includes a confirmed-working platform-wide URL and the bearcave version doesn't, prefer the #free-sc version.

4. **Cross-scan deduplication.** If a deal was already ingested in a previous scan (exists in `discord_intel_items` with matching casino + item_type + within 24h), the current scan should not re-ingest it. Opus checks recent items before constructing the payload.

---

## Expiry estimation

Every intel item routed to `discord_intel_items` should include an `expires_at` timestamp when possible. This prevents stale deals from filling Dylan's review queue and auto-hides expired items on the site.

**Estimation rules:**

- **Explicit countdown visible.** "Ends in 11:40:55" or "Expires tonight at 11:59 PM PT" → calculate exact expiry from scan timestamp.
- **"Today only" / "flash sale" / "limited time" without specific end.** → Default to end of day in the casino's typical timezone (midnight ET if unknown).
- **Weekend sales / recurring patterns.** "Golden weekend sale" → expires end of Sunday ET.
- **Promo codes with no expiry signal.** → Default 48 hours from first sighting. Codes that outlive this window can be re-ingested if they appear in a later scan.
- **Platform warnings, state intel, general tips.** → `expires_at = null`. These don't expire in the traditional sense — they remain relevant until the situation changes. Admin dismisses or updates manually.
- **Account-specific offers that slipped through.** If an item is determined to be account-specific during Opus interpretation → kill it (shouldn't have survived Layer 1, but this is a safety net).

**Staleness protection:** If an item's estimated remaining life is less than 1 hour at the time of ingest, consider whether it's worth routing at all. Dylan may not review for hours. A flash sale with 45 minutes left is dead on arrival. Route these only if they're Tier 1 confirmed and Dylan is actively online (determined by recent admin activity timestamp, if available).

---

## Game availability signals — cross-wash intelligence

The monitoring pipeline extracts which specific games are available at which casinos. This is operational intel for cross-wash strategy and a distinct signal type from deals, codes, or platform health. It feeds into `casino_game_availability` in the database (see Codex prompt schema).

**Why this matters:** Cross-wash pairing requires knowing that Casino A and Casino B both have the same live game (e.g., Iconic 21 BJ). When a game disappears from a casino, every cross-wash pair involving that casino and game breaks. This is high-value intelligence that changes infrequently but matters enormously when it does.

**Extraction rules (Stage 1 — Sonnet):**

When Sonnet encounters messages that identify specific games at specific casinos, extract:
- `casino_name` — the casino being discussed
- `game_name` — the specific game (e.g., "Iconic 21 BJ", "Evolution Lightning Roulette", "Pragmatic Mega Wheel")
- `provider_name` — if identifiable from context (e.g., "Evolution" in "Evolution Lightning Roulette")
- `signal_type` — `'positive'` (game exists/works) or `'negative'` (game is gone/removed/broken)
- `game_type` — if identifiable: `'blackjack'` | `'roulette'` | `'baccarat'` | `'slots'` | `'dice'` | `'other'`

**Positive signal examples (game exists at casino):**
- "Chanced has Iconic 21 BJ" → positive, Chanced, Iconic 21 BJ, blackjack
- "Just did a cross-wash on Crown using Evolution Roulette" → positive, Crown, Evolution Roulette, roulette
- "McLuck added Pragmatic slots last week" → positive, McLuck, [specific games if named], slots
- Any message where a user describes playing a specific game at a specific casino = implicit positive signal

**Negative signal examples (game disappeared):**
- "Iconic 21 isn't on Chanced anymore" → negative, Chanced, Iconic 21 BJ, blackjack
- "Can't find Lightning Roulette on DingDing — did they remove it?" → negative, DingDing, Lightning Roulette, roulette
- "Evolution games are gone from Stimi" → negative, Stimi, [all Evolution games], provider-level removal

**Interpretation rules (Stage 2 — Opus):**

Game availability signals do NOT route to `discord_intel_items`. They route directly to the `casino_game_availability` table via a dedicated field in the ingest payload (or a separate lightweight endpoint — Codex decides). The pipeline:

1. **Match casino to `casino_id`** (same fuzzy match as intel items)
2. **Match or create game row** in `casino_game_availability` (UPSERT on `casino_id + game_name`)
3. **Increment signal count:** positive signal → `positive_signal_count += 1`, update `last_confirmed_at`. Negative signal → `negative_signal_count += 1`, update `last_negative_at`.
4. **Confidence recalculation** happens at the database level (see Codex prompt schema for scoring rules)
5. **Negative signal escalation:** When `negative_signal_count >= 2`, the ingest endpoint auto-creates an `admin_flags` row: `flag_type = 'game_availability_change'`, with AI summary and proposed action. Dylan verifies and updates status.

**What this does NOT do:**
- Does not auto-remove games. Dylan confirms.
- Does not surface in the public intel feed. Game availability is reference data, not time-sensitive intel.
- Does not replace `casino_live_game_providers` (provider-level tracking). It supplements it at the game level.

**Provider-level negative signals:** When a message indicates an entire provider is gone from a casino ("Evolution games are gone from Stimi"), Opus should create negative signals for ALL known games from that provider at that casino, plus flag for admin review. This is a cascade signal — it may indicate a provider state exit.

---

## Confidence scoring model

Every item routed to the ingest endpoint carries a `confidence` field. This informs Dylan's review priority and can eventually drive auto-publish thresholds (post-MVP).

**Confidence levels:**

- **`high`** — Multiple independent confirmations, or Tier 1 single confirmation, or high positive reaction count (5+). Dylan can approve with minimal review.
- **`medium`** — Single Tier 1 report without confirmation, two Tier 2 reports corroborating, or one report with moderate reaction support (3-4 positive). Dylan should glance at raw content before approving.
- **`low`** — Single untiered report, or single Tier 2 report, or new/unfamiliar signal type. Dylan should read full content before deciding.
- **`unverified`** — Extracted signal with no corroboration and no trust tier weight. Sonnet extracted it, Opus couldn't improve confidence. Dylan must evaluate from scratch.

**Confidence promotion:** An item ingested at `low` confidence can be promoted in a subsequent scan if corroborating messages appear. The monitoring script checks recent low-confidence items and upgrades them when new evidence surfaces. This creates a natural "wait and verify" pattern for ambiguous signals.

---

## Ingest endpoint schema additions

The existing ingest endpoint (`POST /api/discord/ingest`) in the Codex prompt needs these additional fields to support the monitoring pipeline's output:

```json
{
  "item_type": "flash_sale",
  "casino_slug": "mcluck",
  "title": "McLuck VIP flash sale...",
  "content": "...",
  "source_channel": "bearcave_chat",
  "expires_at": "2026-03-14T23:59:00Z",
  "admin_flag": true,
  "ai_summary": "McLuck running 40% off VIP packages until midnight",
  "proposed_action": "Publish to intel feed + update flash_sale expiry",
  "confidence": "high",
  "confidence_reason": "Tier 1 confirmed (HungryKitten) + 5 positive reactions"
}
```

**New fields:**
- `confidence` (required) — `'high'` | `'medium'` | `'low'` | `'unverified'`
- `confidence_reason` (required) — one-line explanation of why this confidence level was assigned. Displayed to Dylan in the admin queue alongside `ai_summary`. This is what makes fast review possible — Dylan reads the summary, glances at confidence + reason, and decides.

**Note:** The trust tier configuration and blacklist are NOT stored in the SweepsIntel database. They are maintained as monitoring pipeline config (a JSON file or environment variable). The ingest endpoint is unaware of trust tiers — it only receives the final confidence assessment.

---

## What this spec does NOT cover

- **The monitoring prompt itself.** The actual Claude-in-Chrome prompt (instructions for Sonnet extraction and Opus interpretation) is a separate deliverable. This spec defines the architecture and rules; the prompt implements them.
- **Scan interval and scheduling.** How often the monitoring runs, at what hours, etc. Operational decision for Dylan.
- **Screenshot strategy.** How many screenshots per scan, scrolling behavior, message window size. Part of the monitoring prompt.
- **#free-sc channel handling.** The #free-sc channel is simpler than #bearcave-chat (structured posts, less noise). Its extraction rules may be simpler. Covered in the monitoring prompt.
- **Error handling and retry.** What happens when the ingest endpoint is unreachable, or when a scan fails. Operational concern.

---

## Relationship to Codex prompt

The Codex prompt (CODEX-PROMPT-v3.md) defines:
- The `discord_intel_items` table schema (what gets stored)
- The `admin_flags` table schema (what gets flagged)
- The `POST /api/discord/ingest` endpoint (what the site accepts)
- Feature #14 display rules (how intel surfaces to users)
- Admin panel queue UI (how Dylan reviews)

This monitoring spec defines:
- What gets extracted from Discord (Layer 1 kill filter)
- What gets routed where (Layer 2 intel items, Layer 3 admin flags)
- How confidence is calculated (trust tiers, reactions, corroboration)
- How duplicates are prevented (cross-channel, cross-scan)
- How expiry is estimated
- The two-stage Sonnet/Opus pipeline architecture

**The shared contract is the ingest endpoint JSON schema.** Both documents must agree on it. When either document updates the schema, the other must be updated to match.

---

## Changelog

- **v1 (2026-03-14):** Initial spec. Established three-layer filtering architecture, trust tiers, reaction signals, cross-channel dedup, expiry estimation, Sonnet/Opus two-stage pipeline, confidence scoring model. Added `confidence` and `confidence_reason` to ingest endpoint schema.
- **v1.1 (2026-03-14):** Added trust promotion signals section — reaction-based discovery of Tier 2 candidates. TRUST_SIGNAL logging for users with 3+ positive reactions, accumulation logic (5+ scan cycles = strong Tier 2 candidate), TRUST_WARNING negative signal for blacklist candidates.
