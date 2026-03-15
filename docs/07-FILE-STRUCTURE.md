# SweepsIntel — File Structure & Redemption Stats

## File structure



```
src/
  components/
    casino/
      CasinoCard.tsx
      CasinoDetailPanel.tsx
      VolatilityTable.tsx         -- community volatility reports display (post-MVP)
      GameAvailabilityTable.tsx  -- cross-wash game availability per casino with confidence badges
      BanReportFeed.tsx
      RedemptionTimeStats.tsx     -- median, p80, trend signal
      LiveGamesIndicator.tsx
    tracker/
      DailyTracker.tsx            -- React island, client:load
      CasinoRow.tsx
      ResetCountdown.tsx
      ClaimModal.tsx
      PersonalizedIntelFeed.tsx   -- "My Alerts" section: intel items for user's tracked casinos only
    redemptions/
      RedemptionList.tsx
      RedemptionForm.tsx
      InTransitBanner.tsx
    ledger/
      LedgerTable.tsx
      LedgerSummary.tsx
      ManualEntryForm.tsx
      LedgerModeToggle.tsx
    notifications/
      NotificationPanel.tsx
      NotificationBadge.tsx       -- bell icon with unread count
    states/
      StateMap.tsx
      StateCard.tsx
      PulloutAlertBanner.tsx
    auth/
      OTPForm.tsx
      SessionGate.tsx
    forms/
      BanReportForm.tsx
      StateReportForm.tsx          -- includes optional provider_id for provider-level exits
      ResetTimeSuggestionForm.tsx
      VolatilityReportForm.tsx
      StateSubscriptionSelector.tsx -- shown on first OTP verify
    admin/
      AdminCasinoForm.tsx
      FlagQueue.tsx
      ReportQueue.tsx
      DiscordIntelQueue.tsx
      UserSuggestedCasinoQueue.tsx  -- review queue for source='user_suggested' casinos
      ProviderStateManager.tsx      -- provider cascade action UI
      NotificationComposer.tsx
      QuickEditRow.tsx
    retention/
      AddToHomeScreen.tsx         -- PWA install prompt (shows on 3rd tracker visit)
      PushOptIn.tsx               -- push notification opt-in (shows after 3 claims)
      BookmarkPrompt.tsx          -- Safari/fallback bookmark reminder
    layout/
      Header.tsx                  -- includes NotificationBadge when authed
      Footer.tsx
      Nav.tsx
  lib/
    db.ts                         -- Neon connection + query helpers
    auth.ts                       -- OTP generation, session validation, middleware, admin check
    affiliate.ts                  -- link resolution + click logging
    email.ts                      -- Resend abstraction
    reset.ts                      -- reset time calculation (Luxon)
    balance.ts                    -- SC balance calculation
    redemption-stats.ts           -- median/p80/trend aggregation
    notifications.ts              -- create + fan out user_notifications
    admin.ts                      -- admin utilities (flag creation, report approval flow)
    trust.ts                      -- trust score logic (simple at MVP)
    volatility.ts                 -- consensus volatility aggregation
    discord-intel.ts              -- discord_intel_items CRUD, expiry filtering, reaction sync, auto-publish check
    push.ts                       -- Web Push sending (VAPID, subscription management, frequency cap)
  pages/
    index.astro
    getting-started.astro
    notifications.astro
    casinos/
      index.astro
      [slug].astro
    states/
      index.astro
      [code].astro
    tracker.astro
    redemptions.astro
    ledger.astro
    admin/
      index.astro
      casinos/
        index.astro
        new.astro
        [id].astro
      flags.astro
      reports.astro
      states.astro
      notifications.astro
      discord.astro             -- discord intel queue
      providers.astro           -- provider state availability management + cascade
      settings.astro            -- admin settings (auto-publish toggle, delay config)
    api/
      auth/
        request-otp.ts
        verify-otp.ts
        logout.ts
      tracker/
        claim.ts
        status.ts
        add-casino.ts            -- search/add casino to tracker (creates user_casino_settings row; creates user_suggested casino row if no match; optionally fires affiliate click + logs to clicks table when fire_affiliate=true — see Section 2 "Join" CTA spec)
        bulk-import.ts           -- POST .txt/.csv file upload → parse casino names → run add-casino logic per line → return summary. Edge cases: max file size 1MB, UTF-8 encoding, handle both CRLF and LF line endings, strip leading/trailing whitespace per line, skip blank lines, case-insensitive ILIKE match against casinos.name, skip duplicates silently (already in tracker), no affiliate clicks fired during bulk import. Return JSON summary: { added: number, matched_existing: number, created_suggested: number, skipped_duplicate: number }
      redemptions/
        submit.ts
        update-status.ts
      ledger/
        entry.ts
      reports/
        ban-submit.ts
        state-submit.ts
        reset-suggestion.ts
        volatility-submit.ts
      affiliate/
        click.ts
      waitlist/
        capture.ts               -- POST email + source → insert into email_waitlist (dedup on email, no OTP, no user_settings row)
      notifications/
        mark-read.ts
      push/
        subscribe.ts              -- POST push subscription JSON from browser
        unsubscribe.ts            -- POST to deactivate subscription
      admin/
        casinos.ts               -- create/update casino (includes promote user_suggested → admin, exclude)
        report-action.ts         -- publish/reject report
        flag-action.ts           -- act/dismiss admin flag (actioning a pullout flag invokes the state pullout alert flow — see Feature #3)
        state-update.ts          -- update casino_state_availability (single casino)
        provider-state-update.ts -- update provider_state_availability + cascade to affected casinos (see Admin panel provider cascade spec)
        notify.ts                -- send system notification
        discord-intel-action.ts  -- publish/discard discord_intel_items
        trust-score.ts           -- admin adjustment of user trust scores
      cron/
        auto-publish.ts          -- Vercel cron (every 15min): auto-publishes high-confidence intel items past delay threshold
        push-resets.ts           -- Vercel cron (every 15min): sends daily reset push notifications to eligible users
      discord/
        ingest.ts                -- API-key gated ingest endpoint for monitoring pipeline
        game-availability.ts     -- API-key gated endpoint for game availability signals (batch UPSERT into casino_game_availability, auto-flag on 2+ negative signals)
        react.ts                 -- POST confirm/dispute reaction on published intel item (auth required, one per user per item, updates discord_intel_reactions + denormalized counts on discord_intel_items)
  content/
    casinos/                     -- MDX files (11 drafted, 52 remaining)
    config.ts                    -- Zod schema (extend with new fields)
```

---

## Average redemption times — platform-level aggregation

This is a major differentiator. No other platform has user-logged redemption data.

**Where it shows:** On each casino profile — "Median: 2.3 days | 80th pct: 4.1 days | Based on 84 community redemptions"

**Trend signal:** If recent 30d median is >20% slower than prior 30d: "⚠️ Processing times appear to be increasing recently." When trend signal trips, also create an `admin_flags` row with `flag_type = 'redemption_slowdown'`.

**Implementation in `src/lib/redemption-stats.ts`:**
```sql
SELECT
  EXTRACT(EPOCH FROM (confirmed_at - submitted_at)) / 86400.0 AS days
FROM redemptions
WHERE casino_id = $1
  AND status = 'received'
  AND confirmed_at IS NOT NULL
ORDER BY confirmed_at DESC
LIMIT 1200
```
Then compute median and p80 in application code. Cache 1 hour per casino.

Reference: `Casino/web/lib/v2/redemptions.ts` → `buildRedemptionCasinoViews`, `median()`, `p80()`, `computeStuckBaselineDays()`.

Fewer than 5 completed redemptions: show "Insufficient data."

---
