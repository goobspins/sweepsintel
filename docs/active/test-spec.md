# SweepsIntel -- Comprehensive Test Specification

**Version:** 1.0
**Date:** 2026-03-17
**Stack:** Astro 4.0 + React 18 + Neon Postgres
**Coverage scope:** 56 API endpoints * 21 library files * 4 cron jobs

---

## Table of Contents

1. [Authentication & Session Management](#1-authentication--session-management)
2. [OTP Rate Limiting](#2-otp-rate-limiting)
3. [Tracker -- Casino Management](#3-tracker--casino-management)
4. [Tracker -- Daily Claims](#4-tracker--daily-claims)
5. [Tracker -- Purchases & Free SC](#5-tracker--purchases--free-sc)
6. [Ledger](#6-ledger)
7. [Redemptions](#7-redemptions)
8. [Intel Feed & Signals](#8-intel-feed--signals)
9. [Signal Voting](#9-signal-voting)
10. [Reports & Community Submissions](#10-reports--community-submissions)
11. [Notifications](#11-notifications)
12. [Push Subscriptions](#12-push-subscriptions)
13. [Casino Health](#13-casino-health)
14. [Affiliate Clicks](#14-affiliate-clicks)
15. [User Settings](#15-user-settings)
16. [Waitlist](#16-waitlist)
17. [Admin -- Casino Management](#17-admin--casino-management)
18. [Admin -- Health Override](#18-admin--health-override)
19. [Admin -- Trust Score Override](#19-admin--trust-score-override)
20. [Admin -- Flag Actions](#20-admin--flag-actions)
21. [Admin -- Report Actions](#21-admin--report-actions)
22. [Admin -- State & Provider Updates](#22-admin--state--provider-updates)
23. [Admin -- Signal Creation](#23-admin--signal-creation)
24. [Admin -- Notifications & Settings](#24-admin--notifications--settings)
25. [Admin -- Community Digest](#25-admin--community-digest)
26. [Admin -- Casino Import (XLSX)](#26-admin--casino-import-xlsx)
27. [Discord Ingestion](#27-discord-ingestion)
28. [Cron -- compute-health](#28-cron--compute-health)
29. [Cron -- compute-trust](#29-cron--compute-trust)
30. [Cron -- auto-publish](#30-cron--auto-publish)
31. [Cron -- push-resets](#31-cron--push-resets)
32. [Business Logic -- Trust Score Calculation](#32-business-logic--trust-score-calculation)
33. [Business Logic -- Contributor Tier Evaluation](#33-business-logic--contributor-tier-evaluation)
34. [Business Logic -- Health Score Computation](#34-business-logic--health-score-computation)
35. [Business Logic -- Reset Period Calculation](#35-business-logic--reset-period-calculation)
36. [Business Logic -- Redemption Stats](#36-business-logic--redemption-stats)
37. [Business Logic -- Signal Status Transitions](#37-business-logic--signal-status-transitions)
38. [Security -- Cross-User Data Access](#38-security--cross-user-data-access)
39. [Security -- Admin Endpoint Protection](#39-security--admin-endpoint-protection)
40. [Security -- PII Exposure](#40-security--pii-exposure)
41. [Test Infrastructure Recommendations](#41-test-infrastructure-recommendations)

---

## 1. Authentication & Session Management

### AUTH-001
**Description:** Successful OTP request creates a session record and sends an email.
**Given:** Valid email address; no existing session for this email.
**When:** POST `/api/auth/request-otp` with `{ email: "user@example.com" }`.
**Then:** 200 `{ success: true }`; `auth_sessions` row inserted with hashed OTP; `sendOTP` called once.
**Priority:** P0

### AUTH-002
**Description:** OTP request for an existing session updates the OTP hash rather than inserting a duplicate.
**Given:** Existing `auth_sessions` row for `user@example.com`.
**When:** POST `/api/auth/request-otp` with the same email.
**Then:** 200 `{ success: true }`; row count in `auth_sessions` for that email remains 1; `otp_token_hash` is updated.
**Priority:** P1

### AUTH-003
**Description:** Invalid email format is rejected.
**Given:** No existing session.
**When:** POST `/api/auth/request-otp` with `{ email: "not-an-email" }`.
**Then:** 400 `{ error: "Enter a valid email address." }`.
**Priority:** P1

### AUTH-004
**Description:** Correct OTP within expiry window authenticates the user and creates a session cookie.
**Given:** Valid `auth_sessions` row with unexpired `otp_expires_at`.
**When:** POST `/api/auth/verify-otp` with correct `{ email, otp }`.
**Then:** 200 `{ success: true, isNewUser: false }`; `session_token_hash` set; `otp_token_hash` cleared; `Set-Cookie` header present with `session_token`; cookie is `HttpOnly`, `Secure`, `SameSite=Strict`.
**Priority:** P0

### AUTH-005
**Description:** Expired OTP returns 401.
**Given:** `auth_sessions` row where `otp_expires_at` is in the past.
**When:** POST `/api/auth/verify-otp` with correct OTP value.
**Then:** 401 `{ error: "Code is invalid or expired." }`.
**Priority:** P0

### AUTH-006
**Description:** Wrong OTP returns 401 without leaking whether email exists.
**Given:** Valid session row.
**When:** POST `/api/auth/verify-otp` with incorrect 6-digit OTP.
**Then:** 401 `{ error: "Code is invalid or expired." }`.
**Priority:** P0

### AUTH-007
**Description:** First-time login creates `user_settings` row and marks `isNewUser: true`.
**Given:** Valid OTP; no `user_settings` row for the user.
**When:** POST `/api/auth/verify-otp`.
**Then:** 200 `{ success: true, isNewUser: true }`; `user_settings` row inserted with defaults (`is_admin = false`, `ledger_mode = 'simple'`, `timezone = 'America/New_York'`).
**Priority:** P1

### AUTH-008
**Description:** Verify-OTP converts a matching waitlist email.
**Given:** Email exists in `email_waitlist` with `converted_user_id IS NULL`.
**When:** Successful POST `/api/auth/verify-otp`.
**Then:** `email_waitlist.converted_user_id` and `converted_at` set; only first match converted (idempotent).
**Priority:** P2

### AUTH-009
**Description:** Logout deletes the session and clears the cookie.
**Given:** Authenticated user with active session.
**When:** POST `/api/auth/logout`.
**Then:** 200 `{ success: true }`; session removed from `auth_sessions`; `Set-Cookie` header sets `session_token` with `maxAge: 0`.
**Priority:** P0

### AUTH-010
**Description:** Logout with no session cookie succeeds silently.
**Given:** Request with no `session_token` cookie.
**When:** POST `/api/auth/logout`.
**Then:** 200 `{ success: true }`; no database error.
**Priority:** P2

### AUTH-011
**Description:** Session expires after 90 days of inactivity.
**Given:** `auth_sessions.last_active_at` is 91 days in the past.
**When:** Any authenticated request.
**Then:** 401/302; `auth_sessions` row deleted; `requireAuth` throws `AuthRequiredError`.
**Priority:** P0

### AUTH-012
**Description:** Active session updates `last_active_at` on each request.
**Given:** Valid session.
**When:** Any authenticated GET request.
**Then:** `auth_sessions.last_active_at` updated to within 1 second of NOW().
**Priority:** P1

### AUTH-013
**Description:** OTP must be exactly 6 digits; non-numeric or shorter inputs are rejected.
**Given:** Valid session row.
**When:** POST `/api/auth/verify-otp` with `otp: "12345"` (5 digits) or `otp: "abc123"`.
**Then:** 400 `{ error: "Enter a valid email and 6-digit code." }`.
**Priority:** P1

---

## 2. OTP Rate Limiting

### RATELIMIT-001
**Description:** IP-based rate limit blocks after 10 OTP requests in 15 minutes.
**Given:** Same IP address; first 10 requests succeed.
**When:** 11th POST `/api/auth/request-otp` from same IP.
**Then:** 429 with retry time in minutes; request not processed.
**Priority:** P0

### RATELIMIT-002
**Description:** Email-based rate limit blocks after 3 OTP requests in 15 minutes.
**Given:** Same email; first 3 requests succeed.
**When:** 4th POST `/api/auth/request-otp` for same email.
**Then:** 429 `{ error: "Too many login attempts for this email..." }`; `sendOTP` not called.
**Priority:** P0

### RATELIMIT-003
**Description:** Rate limiter `retryAfterMs` calculation is accurate.
**Given:** IP has used all 10 slots; oldest request is 5 minutes ago; window is 15 minutes.
**When:** Blocked request checked.
**Then:** `retryAfterMs` is approximately 10 minutes (600,000 ms); response shows 10 minutes.
**Priority:** P2

### RATELIMIT-004
**Description:** Rate limiter buckets are cleaned up after the window expires.
**Given:** In-memory rate limiter with windowMs = 100ms.
**When:** Wait 110ms; add new request.
**Then:** Request is allowed (old timestamps evicted).
**Priority:** P3

---

## 3. Tracker -- Casino Management

### TRACK-001
**Description:** Adding a known casino by ID inserts `user_casino_settings` row.
**Given:** Authenticated user; casino with ID 42 exists; user does not currently track casino 42.
**When:** POST `/api/tracker/add-casino` with `{ casino_id: 42 }`.
**Then:** 200 `{ success: true, casino_id: 42, matched_existing: true, skipped_duplicate: false }`; `user_casino_settings` row inserted with `removed_at = NULL`.
**Priority:** P0

### TRACK-002
**Description:** Adding a casino by name performs normalized lookup before creating new record.
**Given:** Casino named "Lucky Slots Casino" exists with `normalized_name = "luckyslots"`.
**When:** POST `/api/tracker/add-casino` with `{ casino_name: "Lucky Slots Casino" }`.
**Then:** Returns existing casino ID; no new casino row created; `matched_existing: true`.
**Priority:** P1

### TRACK-003
**Description:** Adding a casino with an unrecognized name creates a `user_suggested` casino.
**Given:** No casino matching "BrandNewSweeps" in database.
**When:** POST `/api/tracker/add-casino` with `{ casino_name: "BrandNewSweeps" }`.
**Then:** New casino row created with `source = 'user_suggested'`; `created_suggested: true`; casino tracked.
**Priority:** P1

### TRACK-004
**Description:** Adding an already-tracked (active) casino returns `skipped_duplicate: true`.
**Given:** User already tracking casino 42 (`removed_at IS NULL`).
**When:** POST `/api/tracker/add-casino` with `{ casino_id: 42 }`.
**Then:** 200 `{ success: true, skipped_duplicate: true }`; no duplicate `user_casino_settings` row.
**Priority:** P1

### TRACK-005
**Description:** Re-adding a previously removed casino re-activates the tracking row.
**Given:** `user_casino_settings` row for casino 42 with `removed_at` set to past timestamp.
**When:** POST `/api/tracker/add-casino` with `{ casino_id: 42 }`.
**Then:** `removed_at` set to NULL; `added_at` updated; `skipped_duplicate: false`.
**Priority:** P1

### TRACK-006
**Description:** `fireAffiliate: true` inserts a click record when casino has affiliate link.
**Given:** Casino 42 has `has_affiliate_link = true` and a `affiliate_link_url`.
**When:** POST `/api/tracker/add-casino` with `{ casino_id: 42, fire_affiliate: true }`.
**Then:** Row inserted in `clicks` table; `affiliate_url` returned in response.
**Priority:** P2

### TRACK-007
**Description:** Removing a casino sets `removed_at` without deleting the row.
**Given:** User tracking casino 42.
**When:** POST `/api/tracker/remove-casino` with `{ casino_id: 42 }`.
**Then:** 200 `{ success: true }`; `user_casino_settings.removed_at` set to NOW(); row not deleted.
**Priority:** P0

### TRACK-008
**Description:** Removing a casino the user does not track completes without error.
**Given:** User not tracking casino 99.
**When:** POST `/api/tracker/remove-casino` with `{ casino_id: 99 }`.
**Then:** 200 `{ success: true }`; no error; zero rows affected.
**Priority:** P2

### TRACK-009
**Description:** Casino search returns results sorted by normalized-name rank then admin-source priority.
**Given:** Casinos "Lucky Slots", "Lucky Star Casino", "Lucky" in database.
**When:** GET `/api/tracker/search?q=lucky`.
**Then:** Results ordered: exact normalized match first, then partial matches; admin-source casinos before user-suggested.
**Priority:** P1

### TRACK-010
**Description:** Casino search with a query shorter than 2 characters returns empty.
**Given:** Any database state.
**When:** GET `/api/tracker/search?q=l`.
**Then:** 200 `{ results: [], near_match: null, normalized_query: "" }`.
**Priority:** P1

### TRACK-011
**Description:** Bulk import from .csv file correctly parses and adds multiple casinos.
**Given:** .csv file with 3 casino names, one already tracked.
**When:** POST `/api/tracker/bulk-import` with multipart form.
**Then:** `added: 2`, `skipped_duplicate: 1`; appropriate counts in response.
**Priority:** P1

### TRACK-012
**Description:** Bulk import rejects files larger than 1MB.
**Given:** File of 1.1MB.
**When:** POST `/api/tracker/bulk-import`.
**Then:** 400 `{ error: "File must be 1MB or smaller." }`.
**Priority:** P1

### TRACK-013
**Description:** Bulk import rejects non-csv/txt files.
**Given:** File with `.xlsx` extension.
**When:** POST `/api/tracker/bulk-import`.
**Then:** 400 `{ error: "Only .txt and .csv files are supported." }`.
**Priority:** P1

### TRACK-014
**Description:** `casino-settings` endpoint updates `no_daily_reward` flag for tracked casino.
**Given:** User tracking casino 42.
**When:** POST `/api/tracker/casino-settings` with `{ casino_id: 42, no_daily_reward: true }`.
**Then:** 200 with updated values; `user_casino_settings.no_daily_reward = true`.
**Priority:** P1

### TRACK-015
**Description:** `casino-settings` on untracked casino returns 404.
**Given:** User not tracking casino 99.
**When:** POST `/api/tracker/casino-settings` with `{ casino_id: 99, no_daily_reward: true }`.
**Then:** 404 `{ error: "Tracked casino not found." }`.
**Priority:** P1

### TRACK-016
**Description:** Notes update persists up to 4000 characters; excess is truncated.
**Given:** User tracking casino 42.
**When:** POST `/api/my-casinos/notes` with `{ casino_id: 42, notes: "a".repeat(4001) }`.
**Then:** 200; saved notes length is exactly 4000 characters.
**Priority:** P2

### TRACK-017
**Description:** Tracker suggestions exclude casinos already tracked by the user.
**Given:** User tracking casinos 1, 2, 3.
**When:** GET `/api/tracker/suggestions`.
**Then:** Response `suggestions` array does not contain casino IDs 1, 2, or 3.
**Priority:** P1

### TRACK-018
**Description:** Tracker suggestions exclude `is_excluded = true` and `source = 'user_suggested'` casinos.
**Given:** Casino A has `is_excluded = true`; Casino B has `source = 'user_suggested'`.
**When:** GET `/api/tracker/suggestions`.
**Then:** Neither Casino A nor Casino B appear in suggestions.
**Priority:** P1

---

## 4. Tracker -- Daily Claims

### CLAIM-001
**Description:** Successful daily claim creates `daily_bonus_claims` and `ledger_entries` rows atomically.
**Given:** User tracking casino 42; no claim in current reset period.
**When:** POST `/api/tracker/claim` with `{ casino_id: 42, sc_amount: 500 }`.
**Then:** 201 `{ success: true, claim_id, claimed_at }`; both rows created in same transaction; `ledger_entries.entry_type = 'daily'`; `ledger_entries.sc_amount = 500`.
**Priority:** P0

### CLAIM-002
**Description:** Claiming in the same reset period returns 409 duplicate error.
**Given:** User has already claimed casino 42 in the current period; `reset_period_start` is the same.
**When:** POST `/api/tracker/claim` with `{ casino_id: 42 }`.
**Then:** 409 `{ error: "You already claimed this reset period." }`; no new rows inserted.
**Priority:** P0

### CLAIM-003
**Description:** Concurrent simultaneous claims for same user/casino return one success and one 409.
**Given:** Two simultaneous requests arrive before either completes the duplicate check.
**When:** Two concurrent POST `/api/tracker/claim` requests.
**Then:** Exactly one 201 and one 409; exactly one `daily_bonus_claims` row for the period; transaction serialization prevents double-insert.
**Priority:** P0

### CLAIM-004
**Description:** Fixed-mode casino: claim period is determined by `reset_time_local` and `reset_timezone`.
**Given:** Casino with `reset_mode = 'fixed'`, `reset_time_local = '08:00'`, `reset_timezone = 'America/New_York'`; current time is 09:00 ET; no claim today.
**When:** POST `/api/tracker/claim` with `{ casino_id: <fixed_casino_id> }`.
**Then:** `reset_period_start` = today at 08:00 ET; claim succeeds.
**Priority:** P0

### CLAIM-005
**Description:** Fixed-mode casino: claim attempted before the daily reset time uses the previous period's start.
**Given:** Casino reset at 08:00 ET; current time is 07:30 ET; user claimed yesterday.
**When:** POST `/api/tracker/claim`.
**Then:** `reset_period_start` = yesterday at 08:00 ET; 409 duplicate error (already claimed this period).
**Priority:** P0

### CLAIM-006
**Description:** Rolling-mode casino: 24-hour cooldown enforced from last claim time.
**Given:** `reset_mode = 'rolling'`, `reset_interval_hours = 24`; last claim was 23 hours ago.
**When:** POST `/api/tracker/claim`.
**Then:** 409 duplicate error; claim time not yet elapsed.
**Priority:** P0

### CLAIM-007
**Description:** Rolling-mode casino: first-ever claim succeeds regardless of time.
**Given:** `reset_mode = 'rolling'`; user has no prior claims for this casino.
**When:** POST `/api/tracker/claim`.
**Then:** 201 success; `reset_period_start` = current timestamp.
**Priority:** P0

### CLAIM-008
**Description:** Casino with invalid reset config (`reset_mode = 'fixed'` but missing `reset_time_local`) returns 400.
**Given:** Casino has `reset_mode = 'fixed'` but `reset_time_local = NULL`.
**When:** POST `/api/tracker/claim` for that casino.
**Then:** 400 `{ error: "Casino reset configuration is invalid." }`.
**Priority:** P1

### CLAIM-009
**Description:** Claim with `sc_amount: null` is valid and records NULL in ledger.
**Given:** User tracking casino with no prior claim in period.
**When:** POST `/api/tracker/claim` with `{ casino_id: 42, sc_amount: null }`.
**Then:** 201 success; `ledger_entries.sc_amount = NULL`.
**Priority:** P2

### CLAIM-010
**Description:** Non-numeric `sc_amount` returns 400.
**Given:** Valid tracking.
**When:** POST `/api/tracker/claim` with `{ casino_id: 42, sc_amount: "abc" }`.
**Then:** 400 `{ error: "SC amount must be numeric." }`.
**Priority:** P1

### CLAIM-011
**Description:** Claim invalidates `ledger-summary` cache for the user.
**Given:** Cached `ledger-summary:<userId>` entry exists.
**When:** Successful claim.
**Then:** Cache entry removed; next summary request hits database.
**Priority:** P2

---

## 5. Tracker -- Purchases & Free SC

### PURCHASE-001
**Description:** Successful purchase creates two ledger entries (purchase + purchase_credit) linked together.
**Given:** User tracking casino 42; casino has `sc_to_usd_ratio = 1`.
**When:** POST `/api/tracker/purchase` with `{ casino_id: 42, cost_usd: 10, sc_amount: 10 }`.
**Then:** 201; two `ledger_entries` rows: one with `entry_type = 'purchase'`, `usd_amount = -10`, and one with `entry_type = 'purchase_credit'`, `sc_amount = 10`; `linked_entry_id` links them bidirectionally.
**Priority:** P0

### PURCHASE-002
**Description:** Purchase `margin_pct` is calculated correctly.
**Given:** Casino `sc_to_usd_ratio = 0.01`; purchase `cost_usd = 10`, `sc_amount = 1200`.
**When:** POST `/api/tracker/purchase`.
**Then:** `margin_pct = (1200 * 0.01 - 10) / 10 = 0.2` (20% margin); stored in `ledger_entries`.
**Priority:** P2

### PURCHASE-003
**Description:** Zero or negative `cost_usd` is rejected.
**Given:** Any valid tracking state.
**When:** POST `/api/tracker/purchase` with `{ cost_usd: 0, sc_amount: 100 }`.
**Then:** 400 `{ error: "Cost must be a positive number." }`.
**Priority:** P1

### PURCHASE-004
**Description:** Zero or negative `sc_amount` is rejected.
**Given:** Any valid tracking state.
**When:** POST `/api/tracker/purchase` with `{ cost_usd: 10, sc_amount: -5 }`.
**Then:** 400 `{ error: "SC received must be a positive number." }`.
**Priority:** P1

### PURCHASE-005
**Description:** Casino not found in `casinos` table returns 404.
**Given:** Casino ID 9999 does not exist.
**When:** POST `/api/tracker/purchase` with `{ casino_id: 9999, cost_usd: 10, sc_amount: 100 }`.
**Then:** 404 `{ error: "Casino not found." }`.
**Priority:** P1

### FREESC-001
**Description:** Free SC entry creates a single ledger entry with `entry_type = 'free_sc'` and `usd_amount = 0`.
**Given:** Valid user and casino.
**When:** POST `/api/tracker/free-sc` with `{ casino_id: 42, sc_amount: 250 }`.
**Then:** 201; `ledger_entries.entry_type = 'free_sc'`; `usd_amount = 0`; cache invalidated.
**Priority:** P0

### FREESC-002
**Description:** Zero or negative `sc_amount` is rejected for free SC.
**Given:** Valid user and casino.
**When:** POST `/api/tracker/free-sc` with `{ casino_id: 42, sc_amount: 0 }`.
**Then:** 400 `{ error: "SC amount is required." }`.
**Priority:** P1

---

## 6. Ledger

### LEDGER-001
**Description:** GET `/api/ledger/entries` returns only the authenticated user's entries.
**Given:** User A has 5 entries; User B has 10 entries.
**When:** GET `/api/ledger/entries` as User A.
**Then:** Response contains exactly User A's entries (max 20 per page); no User B entries.
**Priority:** P0

### LEDGER-002
**Description:** Pagination with `page=2` returns the correct offset.
**Given:** User has 25 ledger entries.
**When:** GET `/api/ledger/entries?page=2`.
**Then:** Entries 21-25 returned; `page: 2` in response.
**Priority:** P1

### LEDGER-003
**Description:** `casino_id` filter returns only entries for that casino.
**Given:** User has entries for casinos 42 and 55.
**When:** GET `/api/ledger/entries?casino_id=42`.
**Then:** All returned entries have `casino_id = 42`.
**Priority:** P1

### LEDGER-004
**Description:** Date range filter `date_from` and `date_to` correctly filters entries.
**Given:** Entries on 2025-01-01, 2025-06-01, 2025-12-01.
**When:** GET `/api/ledger/entries?date_from=2025-03-01&date_to=2025-09-01`.
**Then:** Only 2025-06-01 entry returned.
**Priority:** P1

### LEDGER-005
**Description:** `redeem_confirmed` entry type is system-generated and cannot be manually created.
**Given:** Authenticated user.
**When:** POST `/api/ledger/entry` with `{ casino_id: 42, entry_type: "redeem_confirmed", usd_amount: 10 }`.
**Then:** 400 `{ error: "redeem_confirmed entries are system-generated only." }`.
**Priority:** P0

### LEDGER-006
**Description:** Invalid `entry_type` is rejected.
**Given:** Authenticated user.
**When:** POST `/api/ledger/entry` with `{ casino_id: 42, entry_type: "hacked_entry" }`.
**Then:** 400 `{ error: "Invalid ledger entry type." }`.
**Priority:** P1

### LEDGER-007
**Description:** `sc_amount` and `usd_amount` may be null simultaneously (valid for `wager` entries).
**Given:** Valid user and casino.
**When:** POST `/api/ledger/entry` with `{ casino_id: 42, entry_type: "wager", sc_amount: null, usd_amount: null }`.
**Then:** 201 success; both amounts stored as NULL.
**Priority:** P2

### LEDGER-008
**Description:** Ledger summary aggregates correctly: `total_in_usd` only sums positive `usd_amount` values.
**Given:** User has entries: +$50, -$30, +$10 across casinos.
**When:** GET `/api/ledger/summary`.
**Then:** `total_in_usd = 60`; `total_out_usd = 30`; `net_pl_usd = 30`.
**Priority:** P0

### LEDGER-009
**Description:** Ledger summary is cached for 5 minutes; adding an entry invalidates the cache.
**Given:** Summary cached; user creates a new ledger entry.
**When:** GET `/api/ledger/summary` after the new entry.
**Then:** Refreshed data (cache was invalidated by `invalidateCached`).
**Priority:** P1

### LEDGER-010
**Description:** CSV export returns all user entries with correct `Content-Disposition` header.
**Given:** User has 150 entries.
**When:** GET `/api/ledger/export-csv`.
**Then:** Response `Content-Type: text/csv`; `Content-Disposition: attachment; filename="ledger-export.csv"`; 151 rows (header + 150 data); no entries from other users.
**Priority:** P0

### LEDGER-011
**Description:** CSV export correctly escapes values containing commas, quotes, and newlines.
**Given:** Ledger entry notes = `He said "hello, world"`.
**When:** GET `/api/ledger/export-csv`.
**Then:** Notes field is `"He said ""hello, world"""` (RFC-4180 escaped).
**Priority:** P2

---

## 7. Redemptions

### REDEEM-001
**Description:** Successful redemption submission creates a `pending` record.
**Given:** Valid user; casino 42 exists; `sc_amount = 1000`, `usd_amount = 10`, `method = 'ach'`.
**When:** POST `/api/redemptions/submit`.
**Then:** 201 `{ success: true, redemption: { status: "pending", ... } }`; `is_crypto = false` for ACH.
**Priority:** P0

### REDEEM-002
**Description:** Crypto method sets `is_crypto = true`.
**Given:** Valid submission.
**When:** POST `/api/redemptions/submit` with `method = 'crypto'`.
**Then:** `redemptions.is_crypto = true`.
**Priority:** P1

### REDEEM-003
**Description:** Zero or negative `sc_amount` rejected.
**Given:** Valid user and casino.
**When:** POST `/api/redemptions/submit` with `sc_amount = 0`.
**Then:** 400 `{ error: "SC amount must be greater than zero." }`.
**Priority:** P1

### REDEEM-004
**Description:** Zero or negative `usd_amount` rejected.
**Given:** Valid user and casino.
**When:** POST `/api/redemptions/submit` with `usd_amount = -5`.
**Then:** 400 `{ error: "USD amount must be greater than zero." }`.
**Priority:** P1

### REDEEM-005
**Description:** Negative `fees_usd` rejected.
**Given:** Valid redemption data.
**When:** POST `/api/redemptions/submit` with `fees_usd = -1`.
**Then:** 400 `{ error: "Fees must be zero or greater." }`.
**Priority:** P1

### REDEEM-006
**Description:** Invalid `method` rejected.
**Given:** Valid redemption data.
**When:** POST `/api/redemptions/submit` with `method = 'venmo'`.
**Then:** 400 `{ error: "Invalid redemption method." }`.
**Priority:** P1

### REDEEM-007
**Description:** Marking redemption as `received` creates a `redeem_confirmed` ledger entry.
**Given:** Pending redemption ID 10 for `usd_amount = 50`, `fees_usd = 2.5`, `sc_amount = 5000`.
**When:** POST `/api/redemptions/update-status` with `{ redemption_id: 10, action: "received" }`.
**Then:** Transaction creates ledger entry with `usd_amount = 47.5` (net after fees); `sc_amount = -5000`; `redemption.status = 'received'`; `confirmed_at` set; cache invalidated.
**Priority:** P0

### REDEEM-008
**Description:** Marking a non-pending redemption returns 409.
**Given:** Redemption 10 has `status = 'received'`.
**When:** POST `/api/redemptions/update-status` with `{ redemption_id: 10, action: "received" }`.
**Then:** 409 `{ error: "Only pending redemptions can be updated." }`.
**Priority:** P0

### REDEEM-009
**Description:** User cannot update a redemption belonging to another user.
**Given:** Redemption 10 belongs to User B.
**When:** User A POSTs `/api/redemptions/update-status` with `{ redemption_id: 10, action: "cancelled" }`.
**Then:** 404 `{ error: "Redemption not found." }`; no update performed.
**Priority:** P0

### REDEEM-010
**Description:** `cancelled` action sets `status = 'cancelled'` and `cancelled_at`.
**Given:** Pending redemption ID 10.
**When:** POST `/api/redemptions/update-status` with `action = 'cancelled'`.
**Then:** `status = 'cancelled'`; `cancelled_at` set; no ledger entry created.
**Priority:** P1

### REDEEM-011
**Description:** Concurrent `received` calls on the same pending redemption only process once.
**Given:** Pending redemption; two simultaneous update-status requests.
**When:** Both requests race to mark `received`.
**Then:** Exactly one `redeem_confirmed` ledger entry created; second request returns 409.
**Priority:** P0

### REDEEM-012
**Description:** GET `/api/redemptions/list` returns only the authenticated user's redemptions.
**Given:** User A has 3 redemptions; User B has 5 redemptions.
**When:** GET `/api/redemptions/list` as User A.
**Then:** Exactly 3 redemptions returned; none belonging to User B.
**Priority:** P0

---

## 8. Intel Feed & Signals

### INTEL-001
**Description:** Intel feed returns only published signals for the user's tracked casinos.
**Given:** User tracks casinos 1 and 2; signals exist for casinos 1, 2, and 3; only some are published.
**Then:** GET `/api/intel/feed` returns published signals for casinos 1 and 2 only.
**Priority:** P0

### INTEL-002
**Description:** `type=warnings` filter returns only `platform_warning` signals.
**Given:** Mix of signal types for user's casinos.
**When:** GET `/api/intel/feed?type=warnings`.
**Then:** All returned signals have `item_type = 'platform_warning'`.
**Priority:** P1

### INTEL-003
**Description:** `type=deals` filter returns `flash_sale` and `playthrough_deal` signals.
**When:** GET `/api/intel/feed?type=deals`.
**Then:** Returned signals have `item_type` in `['flash_sale', 'playthrough_deal']`.
**Priority:** P1

### INTEL-004
**Description:** `limit` parameter caps results at 100 (max enforced server-side).
**When:** GET `/api/intel/feed?limit=500`.
**Then:** At most 100 signals returned.
**Priority:** P1

### INTEL-005
**Description:** Collapsed signals are hidden by default but visible with `show_collapsed=true`.
**Given:** A signal with `signal_status = 'collapsed'`.
**When:** GET `/api/intel/feed` without `show_collapsed`; then with `show_collapsed=true`.
**Then:** First request: collapsed signal absent. Second request: collapsed signal present.
**Priority:** P1

### INTEL-006
**Description:** Anonymous signals do not expose `submitted_by` email in response.
**Given:** Signal with `is_anonymous = true`, submitted by `user@example.com`.
**When:** GET `/api/intel/feed`.
**Then:** `attribution.display_name = null`; `attribution.contributor_tier = null`; no email in response.
**Priority:** P0

### INTEL-007
**Description:** Non-anonymous signal attribution shows display name derived from email (local part only, not full email).
**Given:** Signal submitted by `john.doe@example.com` with `is_anonymous = false`.
**When:** GET `/api/intel/feed`.
**Then:** `attribution.display_name = "John.doe"` (capitalized local part); full email NOT present.
**Priority:** P0

### INTEL-008
**Description:** Operator-created signals (submitted_by = NULL) show "SweepsIntel Team" as attribution.
**Given:** Signal with `submitted_by = NULL` and `is_anonymous = false`.
**When:** GET `/api/intel/feed`.
**Then:** `attribution.display_name = "SweepsIntel Team"`; `attribution.contributor_tier = "operator"`.
**Priority:** P1

### INTEL-009
**Description:** Signal submission eligibility check blocks users with low trust + insufficient account age.
**Given:** User with `trust_score = 0.3`, `account_age_days = 5`, `claim_count = 2`.
**When:** POST `/api/intel/submit`.
**Then:** 403 `{ error: "Submitters need 7 days and 5 claims before posting signals." }`.
**Priority:** P0

### INTEL-010
**Description:** Signal submission eligibility passes when user has trust_score >= 0.65 (bypasses age/claims check).
**Given:** User with `trust_score = 0.65`, `account_age_days = 0`, `claim_count = 0`.
**When:** POST `/api/intel/submit` with valid fields.
**Then:** 201 success (trust score overrides age/claims requirement).
**Priority:** P0

### INTEL-011
**Description:** Signal confidence is elevated to `medium` when submitter trust > 0.7.
**Given:** User with `trust_score = 0.75`.
**When:** POST `/api/intel/submit`.
**Then:** Created signal has `confidence = 'medium'`.
**Priority:** P1

### INTEL-012
**Description:** Signal confidence remains `unverified` when submitter trust <= 0.7.
**Given:** User with `trust_score = 0.65`.
**When:** POST `/api/intel/submit`.
**Then:** Created signal has `confidence = 'unverified'`.
**Priority:** P1

### INTEL-013
**Description:** Signal detail endpoint returns 404 for non-existent signal.
**When:** GET `/api/intel/signal/99999`.
**Then:** 404 `{ error: "Signal not found." }`.
**Priority:** P1

### INTEL-014
**Description:** Signal detail returns related signals for the same casino from the last 7 days.
**Given:** Signal 10 belongs to casino 42; signals 20 and 30 also belong to casino 42, created 3 days ago.
**When:** GET `/api/intel/signal/10`.
**Then:** `related_signals` array contains signals 20 and 30 (but not signal 10 itself).
**Priority:** P2

### INTEL-015
**Description:** Intel feed returns empty array for user with no tracked casinos.
**Given:** User with zero tracked casinos.
**When:** GET `/api/intel/feed`.
**Then:** `{ items: [] }`.
**Priority:** P2

---

## 9. Signal Voting

### VOTE-001
**Description:** Valid vote creates or updates `signal_votes` and updates counts on signal.
**Given:** Signal 10 has `worked_count = 2`, `didnt_work_count = 1`; User has not voted.
**When:** POST `/api/intel/vote/10` with `{ vote: "worked" }`.
**Then:** `signal_votes` upserted; `discord_intel_items.worked_count = 3`; response includes updated counts.
**Priority:** P0

### VOTE-002
**Description:** Changing vote updates counts correctly (removes old vote, adds new vote).
**Given:** User has existing `worked` vote on signal 10.
**When:** POST `/api/intel/vote/10` with `{ vote: "didnt_work" }`.
**Then:** `worked_count` decremented by 1; `didnt_work_count` incremented by 1.
**Priority:** P0

### VOTE-003
**Description:** Invalid vote value is rejected.
**When:** POST `/api/intel/vote/10` with `{ vote: "maybe" }`.
**Then:** 400 `{ error: "Signal id and vote are required." }`.
**Priority:** P1

### VOTE-004
**Description:** Signal transitions to `conditional` after 4+ votes with mixed results.
**Given:** Signal has 2 worked + 2 didnt_work (total >= 4, both positive).
**When:** Vote cast reaching this state.
**Then:** `signal_status = 'conditional'`.
**Priority:** P1

### VOTE-005
**Description:** Signal transitions to `likely_outdated` at 8+ votes with 80%+ negative ratio.
**Given:** Signal has 1 worked + 7 didnt_work (total=8, negative_ratio=0.875 >= 0.8).
**When:** 8th vote cast.
**Then:** `signal_status = 'likely_outdated'`.
**Priority:** P1

### VOTE-006
**Description:** Signal transitions to `collapsed` at 12+ votes with 90%+ negative ratio.
**Given:** Signal has 1 worked + 11 didnt_work (total=12, negative_ratio=0.917 >= 0.9).
**When:** 12th vote cast.
**Then:** `signal_status = 'collapsed'`.
**Priority:** P1

### VOTE-007
**Description:** Signal at exactly the threshold boundary (total=8, negative_ratio exactly 0.8) transitions to `likely_outdated`.
**Given:** 8 total votes, 2 worked + 6 didnt_work (ratio = 0.75 -- below threshold).
**Then:** Status remains `active`. -- With 1 worked + 7 didnt_work (ratio = 0.875), transitions to `likely_outdated`.
**Priority:** P1

---

## 10. Reports & Community Submissions

### REPORT-001
**Description:** Ban report submitted successfully for valid casino and report type.
**Given:** User; casino 42 exists; no recent report from this user for casino 42.
**When:** POST `/api/reports/ban-submit` with `{ casino_id: 42, report_type: "promoban", description: "Got banned" }`.
**Then:** 200 `{ success: true, message: "..." }`; `ban_reports` row created with `is_published = false`.
**Priority:** P0

### REPORT-002
**Description:** Duplicate ban report within 7 days returns 409.
**Given:** User submitted a ban report for casino 42 within the last 7 days.
**When:** POST `/api/reports/ban-submit` for casino 42 again.
**Then:** 409 `{ error: "You've already submitted a report for this casino this week." }`.
**Priority:** P0

### REPORT-003
**Description:** Fifth unique reporter for the same casino triggers an admin flag and `ban_uptick_alert`.
**Given:** 4 unique users already reported casino 42 in the last 7 days; no active alert.
**When:** 5th unique user submits a ban report.
**Then:** `ban_uptick_alerts` row created; `admin_flags` row created with `flag_type = 'ban_surge'`.
**Priority:** P0

### REPORT-004
**Description:** Third report from the same IP within 7 days sets `is_flagged = true`.
**Given:** Same IP hash has 2 prior ban reports for casino 42 this week.
**When:** Third report from same IP.
**Then:** `ban_reports.is_flagged = true`.
**Priority:** P1

### REPORT-005
**Description:** Invalid ban report type is rejected.
**When:** POST `/api/reports/ban-submit` with `report_type = "softban"`.
**Then:** 400 `{ error: "Invalid report type." }`.
**Priority:** P1

### REPORT-006
**Description:** State availability report requires exactly 2-character state code.
**When:** POST `/api/reports/state-submit` with `state_code = "NY1"`.
**Then:** 400 `{ error: "state_code is required." }`.
**Priority:** P1

### REPORT-007
**Description:** State report requires at least one of `casino_id` or `provider_id`.
**When:** POST `/api/reports/state-submit` with no `casino_id` or `provider_id`.
**Then:** 400 `{ error: "A casino or provider is required." }`.
**Priority:** P1

### REPORT-008
**Description:** Reset suggestion rejects invalid time format.
**When:** POST `/api/reports/reset-suggestion` with `suggested_reset_time = "8:00"` (not HH:MM).
**Then:** 400 `{ error: "Reset time must be HH:MM." }`.
**Priority:** P1

### REPORT-009
**Description:** Reset suggestion deduplication blocks same user/casino within 7 days.
**Given:** User submitted reset suggestion for casino 42 within 7 days.
**When:** Second submission.
**Then:** 409 `{ error: "You've already submitted a reset suggestion for this casino this week." }`.
**Priority:** P1

---

## 11. Notifications

### NOTIF-001
**Description:** Notifications list returns only the authenticated user's notifications.
**Given:** User A has 3 notifications; User B has 5.
**When:** GET `/api/notifications/list` as User A.
**Then:** Exactly User A's 3 notifications; none from User B.
**Priority:** P0

### NOTIF-002
**Description:** Notifications list is limited to 50 most recent entries.
**Given:** User has 60 notifications.
**When:** GET `/api/notifications/list`.
**Then:** Exactly 50 notifications; ordered by `created_at DESC`.
**Priority:** P1

### NOTIF-003
**Description:** `mark_all` action marks all unread notifications as read.
**Given:** User has 5 unread notifications.
**When:** POST `/api/notifications/mark-read` with `{ action: "mark_all" }`.
**Then:** `unread_count = 0`; all notifications for user have `is_read = true`.
**Priority:** P0

### NOTIF-004
**Description:** `mark_one` action marks only the specified notification as read.
**Given:** User has 3 unread notifications including notification ID 5.
**When:** POST `/api/notifications/mark-read` with `{ action: "mark_one", notification_id: 5 }`.
**Then:** `unread_count = 2`; only notification 5 has `is_read = true`.
**Priority:** P0

### NOTIF-005
**Description:** User cannot mark another user's notification as read.
**Given:** Notification 5 belongs to User B.
**When:** User A POSTs `mark_one` with `notification_id: 5`.
**Then:** No rows updated (WHERE clause includes `user_id = $2` guard); User A's unread count unchanged.
**Priority:** P0

### NOTIF-006
**Description:** Invalid `action` value returns 400.
**When:** POST `/api/notifications/mark-read` with `{ action: "delete_all" }`.
**Then:** 400 `{ error: "Invalid action." }`.
**Priority:** P1

### NOTIF-007
**Description:** Unread count endpoint returns correct count.
**Given:** User has 7 total notifications; 3 are unread.
**When:** GET `/api/notifications/unread-count`.
**Then:** `{ count: 3 }`.
**Priority:** P1

### NOTIF-008
**Description:** Notification preferences GET creates a default row if none exists.
**Given:** No row in `user_notification_preferences` for user.
**When:** GET `/api/notifications/preferences`.
**Then:** 200 with default values; row created in table.
**Priority:** P1

### NOTIF-009
**Description:** Notification preferences POST accepts only valid `email_digest_frequency` values.
**When:** POST `/api/notifications/preferences` with `email_digest_frequency = "hourly"`.
**Then:** `email_digest_frequency` stored as `'none'` (invalid value defaulted).
**Priority:** P1

---

## 12. Push Subscriptions

### PUSH-001
**Description:** Subscribing with a valid push subscription object stores it.
**Given:** No existing subscription with this endpoint.
**When:** POST `/api/push/subscribe` with valid `{ subscription: { endpoint, keys: { p256dh, auth } } }`.
**Then:** 200 `{ success: true }`; row inserted in `push_subscriptions` with `is_active = true`.
**Priority:** P1

### PUSH-002
**Description:** Re-subscribing with an existing endpoint updates rather than duplicates.
**Given:** Subscription with endpoint X already exists (possibly inactive).
**When:** POST `/api/push/subscribe` with endpoint X.
**Then:** Row updated to `is_active = true`; no duplicate rows for same endpoint.
**Priority:** P1

### PUSH-003
**Description:** Subscribe with missing `endpoint` or `keys` fields returns 400.
**When:** POST `/api/push/subscribe` with `{ subscription: { endpoint: "https://..." } }` (no keys).
**Then:** 400 `{ error: "A valid push subscription is required." }`.
**Priority:** P1

### PUSH-004
**Description:** Unsubscribe marks all user subscriptions as inactive.
**Given:** User has 2 active push subscriptions.
**When:** POST `/api/push/unsubscribe`.
**Then:** Both rows updated to `is_active = false`.
**Priority:** P1

---

## 13. Casino Health

### HEALTH-001
**Description:** GET `/api/casinos/health` returns health data only for the authenticated user's tracked casinos.
**Given:** User tracks casinos 1 and 2; casino 3 exists but is not tracked.
**When:** GET `/api/casinos/health`.
**Then:** Response contains health for casinos 1 and 2 only.
**Priority:** P0

### HEALTH-002
**Description:** Personal health status is escalated one level when user has pending redemptions at casino.
**Given:** Casino global status = `healthy`; user has 1 pending redemption there (`PERSONAL_ESCALATE_PENDING_COUNT = 1`).
**When:** GET `/api/casinos/health-detail/<casino_id>`.
**Then:** `detail.personal_status = 'watch'` (escalated); `exposure_reason` mentions pending redemption.
**Priority:** P0

### HEALTH-003
**Description:** Personal health status is escalated when SC exposure >= 250.
**Given:** Casino global status = `watch`; user has 300 SC net exposure at casino.
**When:** GET `/api/casinos/health-detail/<casino_id>`.
**Then:** `personal_status = 'at_risk'` (escalated from watch).
**Priority:** P0

### HEALTH-004
**Description:** Admin override status takes precedence over computed status.
**Given:** Casino computed `global_status = 'critical'`; admin set `admin_override_status = 'healthy'`.
**When:** GET `/api/casinos/health-detail/<casino_id>`.
**Then:** `personal_status` is derived from `admin_override_status = 'healthy'` (not `critical`).
**Priority:** P0

### HEALTH-005
**Description:** Health detail for non-existent casino returns 404.
**When:** GET `/api/casinos/health-detail/99999`.
**Then:** 404 `{ error: "Health detail not found." }`.
**Priority:** P1

### HEALTH-006
**Description:** Health data for tracked casinos is cached for 5 minutes.
**Given:** First request computes and caches health.
**When:** Second request within 5 minutes.
**Then:** Second request served from cache (no additional DB queries).
**Priority:** P2

---

## 14. Affiliate Clicks

### AFF-001
**Description:** Affiliate click resolves URL and records a click.
**Given:** Casino 42 with `has_affiliate_link = true`, `affiliate_link_url = "https://..."`.
**When:** POST `/api/affiliate/click` with `{ casino_id: 42, user_id: "user1" }`.
**Then:** `{ url: "https://..." }`; `clicks` row inserted.
**Priority:** P1

### AFF-002
**Description:** Casino without affiliate link returns 404.
**Given:** Casino 42 with `has_affiliate_link = false`.
**When:** POST `/api/affiliate/click` with `{ casino_id: 42 }`.
**Then:** 404 `{ error: "Affiliate link unavailable." }`.
**Priority:** P1

### AFF-003
**Description:** Request with neither valid `casino_id` nor `casino_slug` returns 400.
**When:** POST `/api/affiliate/click` with `{ casino_id: null }`.
**Then:** 400 `{ error: "Invalid casino identifier." }`.
**Priority:** P1

### AFF-004
**Description:** Anonymous affiliate click (no `user_id`) stores a click with `user_id = NULL`.
**When:** POST `/api/affiliate/click` with `{ casino_id: 42 }` (no user_id).
**Then:** Click recorded with `user_id = NULL`; no error.
**Priority:** P2

---

## 15. User Settings

### SETTINGS-001
**Description:** GET `/api/settings` returns current user settings with defaults for new user.
**Given:** User with no custom settings; defaults apply.
**When:** GET `/api/settings`.
**Then:** Response includes `timezone = 'America/New_York'`, `ledger_mode = 'simple'`, `daily_goal_usd = 5`.
**Priority:** P1

### SETTINGS-002
**Description:** POST `/api/settings` updates specified fields and leaves others unchanged.
**Given:** User with `timezone = 'America/New_York'`, `ledger_mode = 'simple'`.
**When:** POST `/api/settings` with `{ timezone: "America/Chicago" }`.
**Then:** `timezone` updated; `ledger_mode` unchanged.
**Priority:** P1

### SETTINGS-003
**Description:** Setting `home_state` to `null` explicitly clears the value.
**Given:** User with `home_state = 'CA'`.
**When:** POST `/api/settings` with `{ home_state: null }`.
**Then:** `home_state = NULL` in database.
**Priority:** P1

### SETTINGS-004
**Description:** State subscription update replaces the entire subscription list atomically.
**Given:** User subscribed to `['NY', 'CA']`.
**When:** POST `/api/settings` with `{ state_subscriptions: ["TX"] }`.
**Then:** User now subscribed only to `['TX']`; NY and CA removed.
**Priority:** P1

### SETTINGS-005
**Description:** Invalid `state_code` format in subscription list is silently filtered.
**When:** POST `/api/settings` with `{ state_subscriptions: ["NY", "New York", "123"] }`.
**Then:** Only `["NY"]` stored (others filtered by `/^[A-Z]{2}$/`).
**Priority:** P2

### SETTINGS-006
**Description:** `kpi_cards` with fewer than 3 valid entries is ignored (defaults applied).
**When:** POST `/api/settings` with `{ kpi_cards: ["sc_earned"] }` (only 1 card).
**Then:** `kpi_cards` in DB remains unchanged (null or previous value).
**Priority:** P2

### SETTINGS-007
**Description:** States list is cached for 30 minutes and returned with settings.
**When:** GET `/api/settings`.
**Then:** Response includes `states` array; second call within 30 minutes uses cache.
**Priority:** P3

---

## 16. Waitlist

### WAIT-001
**Description:** Valid email subscribed to waitlist.
**When:** POST `/api/waitlist/capture` with `{ email: "new@example.com", source: "landing" }`.
**Then:** 200 `{ success: true }`; row inserted in `email_waitlist`.
**Priority:** P1

### WAIT-002
**Description:** Duplicate email returns error without exposing whether email exists (same response shape as success).
**Given:** `new@example.com` already in waitlist.
**When:** POST `/api/waitlist/capture` with same email.
**Then:** 200 `{ error: "Already subscribed" }` (intentionally not a 409 to avoid enumeration).
**Priority:** P1

### WAIT-003
**Description:** Invalid email rejected.
**When:** POST `/api/waitlist/capture` with `{ email: "nope" }`.
**Then:** 400 `{ error: "Enter a valid email address." }`.
**Priority:** P1

---

## 17. Admin -- Casino Management

### ADMIN-CASINO-001
**Description:** POST `/api/admin/casinos` creates new casino and returns its ID; requires admin.
**Given:** Admin user; valid casino payload.
**When:** POST `/api/admin/casinos` with required fields `{ slug, name }`.
**Then:** 200 `{ success: true, id: <new_id> }`; casino row created.
**Priority:** P0

### ADMIN-CASINO-002
**Description:** Non-admin cannot create casino.
**Given:** Regular (non-admin) authenticated user.
**When:** POST `/api/admin/casinos`.
**Then:** 403 `{ error: "Admin access required." }`.
**Priority:** P0

### ADMIN-CASINO-003
**Description:** PATCH updates only explicitly provided fields via dynamic SQL; other fields unchanged.
**Given:** Casino 42 with `name = "OldName"`, `tier = 'A'`.
**When:** PATCH `/api/admin/casinos` with `{ id: 42, name: "NewName" }` (no tier field).
**Then:** `name = "NewName"`; `tier = 'A'` unchanged; `last_updated_at` updated.
**Priority:** P1

### ADMIN-CASINO-004
**Description:** PATCH with `flag_for_review = true` creates an admin flag.
**Given:** Admin; casino 42.
**When:** PATCH with `{ id: 42, flag_for_review: true }`.
**Then:** `admin_flags` row created with `flag_type = 'data_anomaly'`.
**Priority:** P2

### ADMIN-CASINO-005
**Description:** `syncProviders` inside a PATCH uses a transaction (deletes old, inserts new).
**Given:** Casino 42 has providers [1, 2]; PATCH provides `providers: [3]`.
**When:** PATCH `/api/admin/casinos`.
**Then:** `casino_live_game_providers` for casino 42 contains only provider 3.
**Priority:** P1

### ADMIN-CASINO-006
**Description:** GET `/api/admin/casinos` returns 405 (method not allowed).
**When:** GET `/api/admin/casinos`.
**Then:** 405 with `Allow: PATCH, POST` header.
**Priority:** P2

---

## 18. Admin -- Health Override

### ADMIN-HEALTH-001
**Description:** Admin can override casino health status with reason.
**Given:** Admin; casino 42 exists.
**When:** POST `/api/admin/casino-health-override` with `{ casino_id: 42, status: "at_risk", reason: "Known issue" }`.
**Then:** `casino_health.admin_override_status = 'at_risk'`; `admin_override_reason = 'Known issue'`; `admin_override_at` set.
**Priority:** P0

### ADMIN-HEALTH-002
**Description:** Setting override status to `null` clears the override.
**Given:** Casino 42 has an active override.
**When:** POST with `{ casino_id: 42, status: null }`.
**Then:** `admin_override_status = NULL`; `admin_override_at = NULL`; computed status applies.
**Priority:** P1

### ADMIN-HEALTH-003
**Description:** Invalid health status value rejected.
**When:** POST with `{ casino_id: 42, status: "terrible" }`.
**Then:** 400 `{ error: "Invalid health status." }`.
**Priority:** P1

---

## 19. Admin -- Trust Score Override

### ADMIN-TRUST-001
**Description:** Admin can manually set a user's trust score.
**Given:** Admin; user "user@example.com" exists.
**When:** POST `/api/admin/trust-score` with `{ user_id: "user@example.com", trust_score: 0.85 }`.
**Then:** `user_settings.trust_score = 0.85`; `trust_score_updated_at` set.
**Priority:** P0

### ADMIN-TRUST-002
**Description:** Setting trust score for non-existent user completes without error (UPDATE affects 0 rows).
**When:** POST with `{ user_id: "nonexistent@example.com", trust_score: 0.5 }`.
**Then:** 200 `{ success: true }`; no error (graceful no-op).
**Priority:** P2

### ADMIN-TRUST-003
**Description:** Missing or non-numeric trust score rejected.
**When:** POST with `{ user_id: "user@example.com", trust_score: "high" }`.
**Then:** 400 `{ error: "User and trust score are required." }`.
**Priority:** P1

---

## 20. Admin -- Flag Actions

### ADMIN-FLAG-001
**Description:** Dismiss action marks flag as dismissed regardless of flag type.
**Given:** Admin; flag ID 5 exists.
**When:** POST `/api/admin/flag-action` with `{ flag_id: 5, action: "dismiss", note: "Not relevant" }`.
**Then:** `admin_flags.status = 'dismissed'`; `actioned_at` and `actioned_by` set.
**Priority:** P0

### ADMIN-FLAG-002
**Description:** Acting on `potential_pullout` flag triggers `runCasinoPulloutFlow`.
**Given:** Flag with `flag_type = 'potential_pullout'`, `casino_id = 42`, `state_code = 'CA'`.
**When:** POST with `{ flag_id: ..., action: "act" }`.
**Then:** `casino_state_availability` upserted; `state_pullout_alerts` row created; notifications fanned out.
**Priority:** P0

### ADMIN-FLAG-003
**Description:** Acting on `ban_surge` flag with `update_promoban_risk = true` updates casino risk.
**Given:** Flag with `flag_type = 'ban_surge'`, `casino_id = 42`.
**When:** POST with `{ flag_id: ..., action: "act", update_promoban_risk: true, promoban_risk: "high" }`.
**Then:** `casinos.promoban_risk = 'high'` for casino 42.
**Priority:** P1

### ADMIN-FLAG-004
**Description:** Flag not found returns 404.
**When:** POST `/api/admin/flag-action` with `{ flag_id: 99999 }`.
**Then:** 404 `{ error: "Flag not found." }`.
**Priority:** P1

### ADMIN-FLAG-005
**Description:** Acting on `new_casino_signal` creates a new casino record.
**Given:** Flag with `flag_type = 'new_casino_signal'`.
**When:** POST with `{ flag_id: ..., action: "act", casino_name: "New Casino" }`.
**Then:** New `casinos` row created; flag marked `actioned`; `redirect_id` returned.
**Priority:** P1

---

## 21. Admin -- Report Actions

### ADMIN-REPORT-001
**Description:** Publishing a `ban` report sets `is_published = true`.
**Given:** Admin; ban report ID 10.
**When:** POST `/api/admin/report-action` with `{ report_type: "ban", report_id: 10, action: "publish" }`.
**Then:** `ban_reports.is_published = true`; audit log created.
**Priority:** P0

### ADMIN-REPORT-002
**Description:** Rejecting a ban report sets `is_published = false` and appends admin notes.
**Given:** Ban report ID 10.
**When:** POST with `action: "reject"`.
**Then:** `is_published = false`; `admin_notes` appended with action log.
**Priority:** P0

### ADMIN-REPORT-003
**Description:** Publishing a `state` report with `reported_status = 'legal_but_pulled_out'` runs the pullout flow.
**Given:** State report with `casino_id = 42`, `state_code = 'CA'`, `reported_status = 'legal_but_pulled_out'`.
**When:** POST with `report_type: "state"`, `action: "publish"`.
**Then:** `runCasinoPulloutFlow` called; `casino_state_availability` updated; notifications sent.
**Priority:** P0

### ADMIN-REPORT-004
**Description:** Publishing an `available` state report upserts `casino_state_availability` with `verified = true`.
**Given:** State report with `reported_status = 'available'`.
**When:** POST with `action: "publish"`.
**Then:** `casino_state_availability` upserted with `status = 'available'`, `verified = true`.
**Priority:** P1

### ADMIN-REPORT-005
**Description:** Publishing a `reset` suggestion updates `casinos` reset fields.
**Given:** Reset suggestion for casino 42 with `suggested_reset_mode = 'fixed'`, `suggested_reset_time = '08:00'`.
**When:** POST with `report_type: "reset"`, `action: "publish"`.
**Then:** `casinos.reset_mode = 'fixed'`, `reset_time_local = '08:00'`.
**Priority:** P1

### ADMIN-REPORT-006
**Description:** Non-existent state report returns 404.
**When:** POST with `report_type: "state"`, `report_id: 99999`.
**Then:** 404 `{ error: "State report not found." }`.
**Priority:** P1

---

## 22. Admin -- State & Provider Updates

### ADMIN-STATE-001
**Description:** Admin state update with `legal_but_pulled_out` triggers pullout flow and push notification.
**Given:** Casino 42 exists; state "CA".
**When:** POST `/api/admin/state-update` with `{ casino_id: 42, state_code: "CA", status: "legal_but_pulled_out" }`.
**Then:** Pullout flow runs; `push_subscriptions` for CA-subscribed users receive notification.
**Priority:** P0

### ADMIN-STATE-002
**Description:** Admin state update with `available` upserts `casino_state_availability` without triggering pullout.
**Given:** Casino 42; state "CA".
**When:** POST with `{ status: "available" }`.
**Then:** `casino_state_availability` upserted; no `state_pullout_alerts` row; no notifications sent.
**Priority:** P1

### ADMIN-PROVIDER-001
**Description:** Restricting a provider cascades to all associated casinos in that state.
**Given:** Provider 5 serves casinos [10, 20, 30]; `state_code = 'TX'`.
**When:** POST `/api/admin/provider-state-update` with `{ provider_id: 5, state_code: "TX", status: "restricted" }`.
**Then:** All three casinos get `casino_state_availability.status = 'legal_but_pulled_out'` for TX; push sent to TX subscribers.
**Priority:** P0

### ADMIN-PROVIDER-002
**Description:** Provider not found returns 404.
**When:** POST with `{ provider_id: 99999, state_code: "TX", status: "restricted" }`.
**Then:** 404 `{ error: "Provider not found." }`.
**Priority:** P1

---

## 23. Admin -- Signal Creation

### ADMIN-SIG-001
**Description:** Admin can create a high-confidence published signal directly.
**Given:** Admin; casino 42 exists.
**When:** POST `/api/admin/signal` with `{ casino_id: 42, signal_type: "flash_sale", title: "50% Bonus", details: "..." }`.
**Then:** 201; signal created with `confidence = 'high'`, `is_published = true`, `source = 'admin'`, `submitted_by = NULL`.
**Priority:** P0

### ADMIN-SIG-002
**Description:** Admin signal with `flash_sale` type for high-confidence item triggers push notification.
**Given:** Admin; casino 42 has push subscribers.
**When:** POST `/api/admin/discord-intel-action` publishing a `flash_sale` with `confidence = 'high'`.
**Then:** Push sent to casino 42 subscribers.
**Priority:** P1

### ADMIN-SIG-003
**Description:** Missing required fields (casino, type, title, details) returns 400.
**When:** POST `/api/admin/signal` with `{ casino_id: 42 }` (missing type/title/details).
**Then:** 400 `{ error: "Casino, type, title, and details are required." }`.
**Priority:** P1

---

## 24. Admin -- Notifications & Settings

### ADMIN-NOTIF-001
**Description:** Admin broadcast to all users creates notifications for every user.
**Given:** 100 users in `user_settings`.
**When:** POST `/api/admin/notify` with `{ title: "Update", message: "...", segment: "all" }`.
**Then:** 100 `user_notifications` rows created.
**Priority:** P1

### ADMIN-NOTIF-002
**Description:** Admin broadcast to `state` segment creates notifications only for subscribers of that state.
**Given:** 10 users subscribed to "CA"; 90 users not subscribed.
**When:** POST with `{ segment: "state", state_code: "CA", title: "CA News", message: "..." }`.
**Then:** Exactly 10 notifications created.
**Priority:** P1

### ADMIN-SETTINGS-001
**Description:** Admin settings POST updates `auto_publish_enabled` and `auto_publish_delay_minutes`.
**When:** POST `/api/admin/settings` with `{ auto_publish_enabled: true, auto_publish_delay_minutes: 60 }`.
**Then:** `admin_settings` rows upserted with values `'true'` and `'60'`.
**Priority:** P1

---

## 25. Admin -- Community Digest

### ADMIN-DIGEST-001
**Description:** Community digest returns signal stats, flagged users, and top contributors.
**Given:** Admin; data from last 7 days.
**When:** GET `/api/admin/community-digest`.
**Then:** Response contains `summary`, `flagged_users`, `top_contributors`; all numeric values cast to numbers.
**Priority:** P1

### ADMIN-DIGEST-002
**Description:** `period` parameter filters to 24h, 7d, or 30d.
**When:** GET `/api/admin/community-digest?period=24h`.
**Then:** Stats computed over last 24 hours only.
**Priority:** P2

### ADMIN-DIGEST-003
**Description:** `flagged_users` contains only users with `trust_score < 0.20`.
**Given:** Users with trust scores 0.10, 0.19, 0.20, 0.50.
**When:** GET `/api/admin/community-digest`.
**Then:** `flagged_users` contains users with scores 0.10 and 0.19 only (< 0.20).
**Priority:** P1

---

## 26. Admin -- Casino Import (XLSX)

### ADMIN-IMPORT-001
**Description:** XLSX preview upload returns parsed headers and up to 10 preview rows.
**Given:** Valid .xlsx file with 20 rows.
**When:** POST `/api/admin/import-casinos` (multipart) with `action = 'preview'`.
**Then:** Response includes `headers`, `preview` (≤10 rows), `total_rows: 20`.
**Priority:** P1

### ADMIN-IMPORT-002
**Description:** Import JSON commit creates new casinos and returns counts.
**Given:** JSON body with 5 rows; 2 match existing casinos, 3 are new.
**When:** POST with `{ rows, mapping }`.
**Then:** `{ created: 3, updated: 2, skipped: 0, warnings: [] }`.
**Priority:** P1

### ADMIN-IMPORT-003
**Description:** Row with no name is skipped.
**Given:** Import row with empty name field.
**When:** POST import.
**Then:** Row counted in `skipped`; no casino row created.
**Priority:** P1

### ADMIN-IMPORT-004
**Description:** Invalid tier value generates a warning and defaults to "B".
**Given:** Row with `tier = "Z"`.
**When:** POST import.
**Then:** Casino created with `tier_label = 'B'`; warning in `warnings` array.
**Priority:** P2

### ADMIN-IMPORT-005
**Description:** Slug collision generates a unique suffix.
**Given:** Casino with slug "lucky-slots" already exists.
**When:** Import row with name "Lucky Slots".
**Then:** New casino slug is "lucky-slots-2".
**Priority:** P2

### ADMIN-IMPORT-006
**Description:** Import invalidates the `dashboard-discovery:` cache prefix.
**When:** Successful import.
**Then:** All keys matching `dashboard-discovery:*` cleared from in-memory cache.
**Priority:** P2

---

## 27. Discord Ingestion

### DISCORD-001
**Description:** Discord ingest requires valid `DISCORD_INGEST_KEY` in Authorization header.
**When:** POST `/api/discord/ingest` without header.
**Then:** 401 `{ error: "Unauthorized." }`.
**Priority:** P0

### DISCORD-002
**Description:** Valid ingest payload creates intel item and returns `item_id`.
**Given:** Valid ingest key; all required fields present.
**When:** POST `/api/discord/ingest` with `{ item_type, title, content, source_channel, confidence, confidence_reason }`.
**Then:** 200 `{ success: true, item_id, duplicate: false }`.
**Priority:** P0

### DISCORD-003
**Description:** Missing required ingest fields returns 400.
**When:** POST `/api/discord/ingest` missing `confidence_reason`.
**Then:** 400 `{ error: "Missing required ingest fields." }`.
**Priority:** P1

### DISCORD-004
**Description:** Ingest with `admin_flag = true` creates an `admin_flags` entry.
**When:** POST with `{ ..., admin_flag: true, proposed_action: "Review immediately" }`.
**Then:** `admin_flags` row created with mapped `flag_type`.
**Priority:** P1

### DISCORD-005
**Description:** Game availability ingest with 3+ positive signals sets confidence to `high`.
**Given:** Game exists with `positive_signal_count = 2`.
**When:** POST `/api/discord/game-availability` with positive signal for same game.
**Then:** `positive_signal_count = 3`; `confidence = 'high'`.
**Priority:** P1

### DISCORD-006
**Description:** Game availability with 2+ negative signals creates an admin flag.
**Given:** Game exists with `negative_signal_count = 1`.
**When:** POST with negative signal.
**Then:** `negative_signal_count = 2`; `admin_flags` row created with `flag_type = 'game_availability_change'`.
**Priority:** P1

### DISCORD-007
**Description:** Game availability confidence formula: mixed signals (>=1 positive, >=1 negative) -> `low`.
**Given:** Game with `positive_signal_count = 2`, `negative_signal_count = 1`.
**When:** Query confidence after update.
**Then:** `confidence = 'low'`.
**Priority:** P2

### DISCORD-008
**Description:** Unknown `casino_slug` in game availability payload is silently skipped.
**When:** POST `/api/discord/game-availability` with `casino_slug = "nonexistent-casino"`.
**Then:** 200 `{ success: true, processed: 0 }`.
**Priority:** P2

---

## 28. Cron -- compute-health

### CRON-HEALTH-001
**Description:** Unauthorized request returns 401.
**When:** GET `/api/cron/compute-health` without Bearer token.
**Then:** 401 `{ error: "Unauthorized." }`.
**Priority:** P0

### CRON-HEALTH-002
**Description:** Missing `CRON_SECRET` env var denies all requests.
**Given:** `CRON_SECRET` is not set.
**When:** GET with any token.
**Then:** 401 (empty secret = no access).
**Priority:** P0

### CRON-HEALTH-003
**Description:** Successful run upserts `casino_health` row for every casino.
**Given:** 50 casinos; some with warnings, some without.
**When:** Cron runs.
**Then:** 200 `{ success: true }`; exactly 50 `casino_health` rows exist (one per casino).
**Priority:** P0

### CRON-HEALTH-004
**Description:** Empty state (no casinos) completes without error.
**Given:** Zero rows in `casinos`.
**When:** Cron runs.
**Then:** 200 `{ success: true }`; zero rows processed; no exception.
**Priority:** P1

### CRON-HEALTH-005
**Description:** Running twice in a row is idempotent (same result, no duplicate rows).
**Given:** 5 casinos.
**When:** Cron runs twice consecutively.
**Then:** Still exactly 5 `casino_health` rows; second run updates `last_computed_at` only.
**Priority:** P0

### CRON-HEALTH-006
**Description:** Casino with redemption trend >= 2x baseline scores +2 health points.
**Given:** Casino where recent avg_days = 10, baseline avg_days = 4 (ratio = 2.5).
**When:** Compute-health runs.
**Then:** Casino health score includes +2; status at least `at_risk` (if no other warnings).
**Priority:** P1

### CRON-HEALTH-007
**Description:** Dispute factor reduces warning weight for signals with 50%+ negative votes.
**Given:** Warning signal with 3 worked + 7 didnt_work (total 10, negative_ratio = 0.7, dispute_factor = max(0.35, 1-0.7) = 0.3).
**When:** Compute-health runs.
**Then:** Warning weight is `1.0 * 0.3 = 0.3` (not full weight of 1.0).
**Priority:** P2

---

## 29. Cron -- compute-trust

### CRON-TRUST-001
**Description:** Unauthorized request returns 401.
**When:** GET `/api/cron/compute-trust` without valid Bearer token.
**Then:** 401.
**Priority:** P0

### CRON-TRUST-002
**Description:** Trust computation updates `trust_score` for all users.
**Given:** 10 users in `user_settings`.
**When:** Cron runs.
**Then:** `trust_score_updated_at` updated for all 10 users; counts returned in response.
**Priority:** P0

### CRON-TRUST-003
**Description:** Tier evaluation runs after trust computation and updates all user tiers.
**When:** Cron runs.
**Then:** `contributor_tier` updated for all users in `user_settings`.
**Priority:** P0

### CRON-TRUST-004
**Description:** Running twice in a row is idempotent (same scores, no duplicates).
**Given:** User data unchanged between runs.
**When:** Two consecutive runs.
**Then:** Both runs produce same `trust_score` values (deterministic computation).
**Priority:** P1

---

## 30. Cron -- auto-publish

### CRON-PUB-001
**Description:** Returns `{ published: 0, skipped: 'disabled' }` when `auto_publish_enabled = false`.
**Given:** `admin_settings.auto_publish_enabled = 'false'`.
**When:** GET `/api/cron/auto-publish`.
**Then:** 200 `{ published: 0, skipped: "disabled" }`; no items published.
**Priority:** P0

### CRON-PUB-002
**Description:** Only publishes items older than `auto_publish_delay_minutes`.
**Given:** `auto_publish_enabled = true`; delay = 120 min; item created 119 min ago.
**When:** Cron runs.
**Then:** Item NOT published (not old enough).
**Priority:** P0

### CRON-PUB-003
**Description:** Only publishes `high` confidence items.
**Given:** Two unpublished items: one `high`, one `medium`.
**When:** Cron runs with delay satisfied.
**Then:** Only the `high` confidence item published.
**Priority:** P0

### CRON-PUB-004
**Description:** Does not publish expired items (expiry within 3 hours).
**Given:** High-confidence item expiring in 2 hours.
**When:** Cron runs.
**Then:** Item not published.
**Priority:** P1

### CRON-PUB-005
**Description:** Published `flash_sale`/`free_sc`/`promo_code` items with `casino_id` trigger push notifications.
**Given:** High-confidence unpublished `flash_sale` item; casino 42 has push subscribers.
**When:** Cron publishes it.
**Then:** Push notification sent to casino 42 subscribers.
**Priority:** P1

### CRON-PUB-006
**Description:** Running twice publishes each item only once.
**Given:** 3 eligible items.
**When:** Cron runs twice.
**Then:** First run: `{ published: 3 }`; second run: `{ published: 0 }` (already published).
**Priority:** P0

---

## 31. Cron -- push-resets

### CRON-RESET-001
**Description:** Unauthorized request returns 401.
**When:** GET `/api/cron/push-resets` without valid token.
**Then:** 401.
**Priority:** P0

### CRON-RESET-002
**Description:** Users active within 2 hours are skipped (already using the app).
**Given:** User with `auth_sessions.last_active_at = 1 hour ago`.
**When:** Cron runs.
**Then:** User counted in `skipped`; no push sent.
**Priority:** P1

### CRON-RESET-003
**Description:** User with no available claims is skipped.
**Given:** User with all casinos claimed in current period.
**When:** Cron runs.
**Then:** User counted in `skipped`.
**Priority:** P1

### CRON-RESET-004
**Description:** User who has already received a "Daily Reset Reminder" today is skipped.
**Given:** `push_notification_log` has entry for user with title "Daily Reset Reminder" today.
**When:** Cron runs.
**Then:** User excluded from candidate list (WHERE clause filters them).
**Priority:** P1

### CRON-RESET-005
**Description:** User with at least one available claim and no recent activity receives push notification.
**Given:** User with one active subscription; casino available to claim; inactive > 2 hours.
**When:** Cron runs.
**Then:** `notified += 1`; push sent with title "Daily Reset Reminder".
**Priority:** P0

---

## 32. Business Logic -- Trust Score Calculation

### TRUST-001
**Description:** Brand-new user with no activity returns default score of 0.5.
**Given:** User created today; no claims, no signals, no redemptions.
**When:** `computeTrustScore(userId)`.
**Then:** Returns `0.5` (default).
**Priority:** P0

### TRUST-002
**Description:** Account age component: 90-day-old account with 100 claims scores max account_activity = 1.0.
**Given:** `accountAgeDays = 90` (maturity = 90), `claimCount = 100` (maturity = 100).
**When:** Account activity computed.
**Then:** `accountActivity = 1.0 * 0.6 + 1.0 * 0.4 = 1.0`.
**Priority:** P1

### TRUST-003
**Description:** Account activity is clamped to [0, 1] -- age > 90 days does not increase score above 1.
**Given:** `accountAgeDays = 200`, `claimCount = 200`.
**When:** Trust score computed.
**Then:** Account activity contribution = `0.20 * 1.0 = 0.20` (not > 0.20).
**Priority:** P1

### TRUST-004
**Description:** Submission history defaults to 0.5 when no votes have been cast.
**Given:** User has submitted 5 signals but none have been voted on (`total_votes = 0`).
**When:** Trust score computed.
**Then:** Submission history component = 0.5.
**Priority:** P1

### TRUST-005
**Description:** Community standing is clamped at 0 and 1: net votes of -10 or less -> 0; net votes ≥ 10 -> 1.
**Given:** Case A: `net_positive_votes = -10`; Case B: `net_positive_votes = 10`.
**When:** Trust score computed (COMMUNITY_STANDING_OFFSET = 10, DIVISOR = 20).
**Then:** Case A: `clamp((-10+10)/20, 0, 1) = 0`; Case B: `clamp((10+10)/20, 0, 1) = 1.0`.
**Priority:** P1

### TRUST-006
**Description:** Portfolio PL -- positive net_pl_usd of $1000 yields portfolioPl = 1.0 (clamped max).
**Given:** `netPlUsd = 1000` (PORTFOLIO_POSITIVE_PL_MATURITY_USD = 1000).
**When:** Trust score computed.
**Then:** `portfolioPl = clamp(1000/1000, 0.5, 1) = 1.0`.
**Priority:** P1

### TRUST-007
**Description:** Portfolio PL -- negative net_pl_usd of -$1000 yields portfolioPl at floor 0.3.
**Given:** `netPlUsd = -1000` (PORTFOLIO_NEGATIVE_PL_DIVISOR_USD = 2000; floor = 0.3).
**When:** Trust score computed.
**Then:** `portfolioPl = clamp(0.5 + (-1000/2000), 0.3, 0.5) = clamp(0.0, 0.3, 0.5) = 0.3`.
**Priority:** P1

### TRUST-008
**Description:** Redemption success uses fallback 0.5 until user has at least 3 redemptions.
**Given:** User has 2 total redemptions (< PORTFOLIO_REDEMPTION_MATURITY = 3).
**When:** Trust score computed.
**Then:** `redemptionSuccess = 0.5` (fallback used regardless of success rate).
**Priority:** P1

### TRUST-009
**Description:** Full score calculation with known inputs produces expected numeric result.
**Given:** accountAgeDays=60, claimCount=50, workedVotes=8, totalVotes=10, netPositiveVotes=5, netPlUsd=500, trackedCasinoCount=5, claimDays=30, successfulRedemptions=3, totalRedemptions=4.
**When:** `computeTrustScore` runs.
**Then:**
- accountActivity = clamp(60/90,0,1)*0.6 + clamp(50/100,0,1)*0.4 = 0.667*0.6 + 0.5*0.4 = 0.400 + 0.200 = 0.600
- submissionHistory = 8/10 = 0.800
- communityStanding = clamp((5+10)/20,0,1) = clamp(0.75,0,1) = 0.750
- portfolioPl = clamp(500/1000, 0.5, 1) = 0.500
- portfolioDiversity = clamp(5/5, 0, 1) = 1.000
- portfolioConsistency = clamp(30/45, 0, 1) = 0.667
- redemptionSuccess = 3/4 = 0.750
- portfolioScore = 0.500*0.35 + 1.000*0.25 + 0.667*0.25 + 0.750*0.15 = 0.175+0.250+0.167+0.113 = 0.705
- finalScore = 0.600*0.20 + 0.800*0.30 + 0.750*0.15 + 0.705*0.35 = 0.120+0.240+0.113+0.247 = **0.720**
**Priority:** P0

---

## 33. Business Logic -- Contributor Tier Evaluation

### TIER-001
**Description:** `operator` tier is never changed by the algorithm.
**Given:** User with `contributor_tier = 'operator'`.
**When:** `evaluateContributorTier(userId)`.
**Then:** Returns `'operator'`; DB write still sets `'operator'`.
**Priority:** P0

### TIER-002
**Description:** New user with no signals starts and stays at `newcomer`.
**Given:** `totalSubmissions = 0`.
**When:** `evaluateContributorTier(userId)`.
**Then:** Returns `'newcomer'`.
**Priority:** P1

### TIER-003
**Description:** Promotion to `scout` requires ≥5 submissions, >60% worked ratio, account age ≥14 days.
**Given:** `totalSubmissions = 5`, `workedRatio = 0.65`, `accountAgeDays = 14`.
**When:** `evaluateContributorTier`.
**Then:** Returns `'scout'`.
**Priority:** P0

### TIER-004
**Description:** `scout` is NOT granted if any condition fails (e.g., worked ratio = exactly 0.6).
**Given:** `totalSubmissions = 5`, `workedRatio = 0.60` (not > 0.6), `accountAgeDays = 14`.
**When:** `evaluateContributorTier`.
**Then:** Returns `'newcomer'` (ratio must be strictly > 0.6).
**Priority:** P1

### TIER-005
**Description:** Promotion to `insider` requires ≥20 submissions, >70% worked, span ≥30 days.
**Given:** `totalSubmissions = 20`, `workedRatio = 0.75`, `submissionSpanDays = 30`.
**When:** `evaluateContributorTier`.
**Then:** Returns `'insider'`.
**Priority:** P0

### TIER-006
**Description:** `insider` is demoted to `scout` when `last_15_ratio < 0.5`.
**Given:** Current tier = `insider`; last 15 signals: 6 worked + 9 didnt_work (ratio = 0.4 < 0.5).
**When:** `evaluateContributorTier`.
**Then:** Returns `'scout'`.
**Priority:** P0

### TIER-007
**Description:** `scout` is demoted to `newcomer` when `last_10_ratio < 0.4`.
**Given:** Current tier = `scout`; last 10 signals: 3 worked + 7 didnt_work (ratio = 0.3 < 0.4).
**When:** `evaluateContributorTier`.
**Then:** Returns `'newcomer'`.
**Priority:** P0

### TIER-008
**Description:** Demotion check only applies to the current tier (insider check ignores scout demotion logic and vice versa).
**Given:** Current tier = `newcomer`; last_10_ratio = 0.2 (< 0.4).
**When:** `evaluateContributorTier`.
**Then:** Returns `'newcomer'` (no demotion below newcomer).
**Priority:** P1

---

## 34. Business Logic -- Health Score Computation

### HLTH-001
**Description:** Zero warnings -> `healthy` status.
**Given:** Casino with no published `platform_warning` items.
**When:** Health computed.
**Then:** `global_status = 'healthy'`; `active_warning_count = 0`.
**Priority:** P0

### HLTH-002
**Description:** 1 active (unexpired) warning with no disputes -> score = 1.0 -> status = `watch` (threshold ≥ 1.5 = watch).
**Given:** 1 warning, no votes, no expiry.
**When:** Health computed.
**Then:** Score ≈ 1.0 < 1.5; `global_status = 'healthy'`. (Note: single undisputed warning with weight 1.0 does NOT reach 'watch' at threshold 1.5.)
**Priority:** P1

### HLTH-003
**Description:** 2 active warnings with no disputes -> score = 2.0 -> `watch` status (>= 1.5, < 3.0).
**Given:** 2 unexpired warnings, no votes.
**When:** Health computed.
**Then:** `global_status = 'watch'`.
**Priority:** P0

### HLTH-004
**Description:** Warning expired 24-48 hours ago has decay weight of 0.5.
**Given:** Warning with `expires_at = 36 hours ago`.
**When:** `decayWeight` called.
**Then:** Returns `0.5` (WARNING_WEIGHT_48H).
**Priority:** P1

### HLTH-005
**Description:** Warning expired > 72 hours ago has decay weight 0 (excluded from score).
**Given:** Warning with `expires_at = 73 hours ago`.
**When:** `decayWeight` called.
**Then:** Returns `0`; not included in warning count.
**Priority:** P1

### HLTH-006
**Description:** Warning with exactly 3 didnt_work + 0 worked (100% negative) gets minimum dispute factor 0.35.
**Given:** Warning with `worked_count = 0`, `didnt_work_count = 3` (total ≥ 3, disputeFactor = max(0.35, 1-1.0) = 0.35).
**When:** Health computed.
**Then:** Warning contributes `1.0 * 0.35 = 0.35` to score.
**Priority:** P2

### HLTH-007
**Description:** `clampStatus` boundary: score exactly at 1.5 -> `watch`; score exactly at 3.0 -> `at_risk`.
**When:** `clampStatus(1.5)` and `clampStatus(3.0)`.
**Then:** `watch` and `at_risk` respectively.
**Priority:** P1

### HLTH-008
**Description:** `escalateStatus` increments status by one level: healthy->watch, watch->at_risk, at_risk->critical, critical->critical.
**When:** `escalateStatus('healthy')`, `escalateStatus('at_risk')`, `escalateStatus('critical')`.
**Then:** `'watch'`, `'critical'`, `'critical'`.
**Priority:** P1

---

## 35. Business Logic -- Reset Period Calculation

### RESET-001
**Description:** `computeFixedResetPeriodStart` returns `null` when `reset_time_local` is missing.
**When:** Called with `{ reset_time_local: null, reset_timezone: 'America/New_York', reset_interval_hours: 24 }`.
**Then:** Returns `null`.
**Priority:** P1

### RESET-002
**Description:** `computeFixedResetPeriodStart` returns `null` for invalid timezone.
**When:** Called with `{ reset_time_local: '08:00', reset_timezone: 'Not/ATimezone', reset_interval_hours: 24 }`.
**Then:** Returns `null`.
**Priority:** P1

### RESET-003
**Description:** Current time before reset -> returns today's reset time (not tomorrow's).
**Given:** `reset_time_local = '12:00'`, timezone = UTC; now = 11:00 UTC.
**When:** `computeFixedResetPeriodStart`.
**Then:** Returns today at 12:00 UTC (current period is yesterday at 12:00 UTC... wait, no: current period start should be yesterday 12:00 since now is before today's 12:00). Returns yesterday at 12:00 UTC as the period start.
**Priority:** P0

### RESET-004
**Description:** Current time after reset -> period start is today's reset time.
**Given:** `reset_time_local = '08:00'`, timezone = UTC; now = 09:00 UTC.
**When:** `computeFixedResetPeriodStart`.
**Then:** Returns today at 08:00 UTC.
**Priority:** P0

### RESET-005
**Description:** 12-hour interval: two resets per day -> period start reflects the most recent interval start.
**Given:** `reset_time_local = '08:00'`, `reset_interval_hours = 12`; now = 21:00 UTC.
**When:** `computeFixedResetPeriodStart`.
**Then:** Returns today at 20:00 UTC (08:00 + 12h = 20:00 is the latest period start before 21:00).
**Priority:** P1

### RESET-006
**Description:** `computeNextReset` for rolling mode with no prior claim returns `{ label: 'Available now', nextResetAt: null }`.
**Given:** `reset_mode = 'rolling'`; `last_claimed_at = null`.
**When:** `computeNextReset`.
**Then:** Returns `{ label: 'Available now', nextResetAt: null }`.
**Priority:** P1

### RESET-007
**Description:** `computeNextReset` for rolling mode 23h after last claim shows countdown.
**Given:** `last_claimed_at = 23 hours ago`; `reset_interval_hours = 24`.
**When:** `computeNextReset`.
**Then:** Returns label `"1h 0m"` (approximately); `nextResetAt` is approximately 1 hour in the future.
**Priority:** P1

---

## 36. Business Logic -- Redemption Stats

### RDSTATS-001
**Description:** Fewer than 5 data points returns `{ medianDays: null, p80Days: null, sampleCount: n, trendWarning: false }`.
**Given:** 4 redemption records.
**When:** `computeStats` called.
**Then:** `medianDays = null`, `p80Days = null`, `sampleCount = 4`, `trendWarning = false`.
**Priority:** P1

### RDSTATS-002
**Description:** Median computed correctly for odd-count sorted array.
**Given:** Days = [1, 3, 5, 7, 9] (sorted).
**When:** `median([1, 3, 5, 7, 9])`.
**Then:** Returns `5`.
**Priority:** P1

### RDSTATS-003
**Description:** Median computed correctly for even-count sorted array.
**Given:** Days = [2, 4, 6, 8] (sorted).
**When:** `median([2, 4, 6, 8])`.
**Then:** Returns `5.0` (average of middle two).
**Priority:** P1

### RDSTATS-004
**Description:** P80 (80th percentile) computed correctly.
**Given:** Days = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] (10 values).
**When:** `percentile([1..10], 0.8)` -> `Math.ceil(10 * 0.8) - 1 = 7` -> index 7 -> value `8`.
**Then:** Returns `8`.
**Priority:** P1

### RDSTATS-005
**Description:** `trendWarning` is true when recent median > prior median x 1.2.
**Given:** Prior 30-day window median = 5 days; recent 30-day median = 7 days (7 > 5*1.2 = 6).
**When:** `computeStats`.
**Then:** `trendWarning = true`.
**Priority:** P1

### RDSTATS-006
**Description:** Stats are cached per casino for 1 hour.
**Given:** Stats computed for casino 42.
**When:** Second call within 1 hour.
**Then:** Cache hit; no DB query issued.
**Priority:** P2

---

## 37. Business Logic -- Signal Status Transitions

### SIGSTATUS-001
**Description:** Signal status stays `active` when total votes < 4.
**Given:** 1 worked + 2 didnt_work (total = 3 < 4).
**When:** `updateSignalStatus`.
**Then:** Status = `active`.
**Priority:** P1

### SIGSTATUS-002
**Description:** `conditional` triggers when total ≥ 4, both sides > 0.
**Given:** 2 worked + 2 didnt_work (total = 4, negRatio = 0.5, < 0.8).
**When:** `updateSignalStatus`.
**Then:** Status = `conditional`.
**Priority:** P1

### SIGSTATUS-003
**Description:** `likely_outdated` threshold: exactly 8 total, exactly 80% negative.
**Given:** 1 worked + 7 didnt_work (total = 8, negRatio = 0.875 >= 0.8).
**When:** `updateSignalStatus`.
**Then:** Status = `likely_outdated`.
**Priority:** P1

### SIGSTATUS-004
**Description:** `collapsed` threshold: exactly 12 total, >= 90% negative.
**Given:** 1 worked + 11 didnt_work (total = 12, negRatio = 0.917 >= 0.9).
**When:** `updateSignalStatus`.
**Then:** Status = `collapsed`.
**Priority:** P1

### SIGSTATUS-005
**Description:** `collapsed` takes precedence over `likely_outdated` (checked first).
**Given:** 1 worked + 12 didnt_work (total = 13 >= 12, negRatio = 0.923 >= 0.9).
**When:** `updateSignalStatus`.
**Then:** Status = `collapsed` (not `likely_outdated`).
**Priority:** P2

---

## 38. Security -- Cross-User Data Access

### SEC-001
**Description:** User A cannot read User B's ledger entries via `/api/ledger/entries`.
**Given:** User B has 10 entries.
**When:** GET as User A.
**Then:** User A sees 0 of User B's entries (WHERE clause `user_id = $1` enforced).
**Priority:** P0

### SEC-002
**Description:** User A cannot read User B's redemptions.
**When:** GET `/api/redemptions/list` as User A.
**Then:** Only User A's redemptions returned.
**Priority:** P0

### SEC-003
**Description:** User A cannot update User B's redemption status.
**Given:** Redemption 10 belongs to User B.
**When:** POST `/api/redemptions/update-status` as User A with `redemption_id: 10`.
**Then:** 404 (ownership check `AND user_id = $2`).
**Priority:** P0

### SEC-004
**Description:** User A cannot mark User B's notification as read.
**Given:** Notification 5 belongs to User B.
**When:** POST `/api/notifications/mark-read` as User A with `notification_id: 5`.
**Then:** 0 rows updated; User B's notification unchanged.
**Priority:** P0

### SEC-005
**Description:** User A cannot view User B's tracker status (health data is user-scoped).
**When:** GET `/api/casinos/health` as User A.
**Then:** Returns only casinos tracked by User A.
**Priority:** P0

### SEC-006
**Description:** User A cannot update casino settings for a casino tracked by User B but not by A.
**When:** POST `/api/tracker/casino-settings` as User A for casino tracked only by User B.
**Then:** 404 `{ error: "Tracked casino not found." }`.
**Priority:** P0

### SEC-007
**Description:** User A cannot update notes for a casino tracked only by User B.
**When:** POST `/api/my-casinos/notes` as User A for User B's tracked casino.
**Then:** 404 `{ error: "Tracked casino not found." }`.
**Priority:** P0

### SEC-008
**Description:** Unauthenticated request to any protected endpoint is rejected.
**When:** GET or POST any `/api/tracker/*`, `/api/ledger/*`, `/api/redemptions/*`, `/api/notifications/*`, `/api/settings`, `/api/intel/*`, `/api/casinos/*` without session cookie.
**Then:** 401 or 302; no data returned.
**Priority:** P0

### SEC-009
**Description:** Intel feed does not return signals for casinos the user does not track.
**Given:** User tracks casino 1; unpublished and published signals exist for casino 99.
**When:** GET `/api/intel/feed`.
**Then:** No signals for casino 99 returned.
**Priority:** P0

### SEC-010
**Description:** Ledger CSV export only exports the requesting user's data.
**Given:** User A has 10 entries; User B has 20 entries.
**When:** GET `/api/ledger/export-csv` as User A.
**Then:** CSV contains exactly 10 data rows.
**Priority:** P0

---

## 39. Security -- Admin Endpoint Protection

### SEC-ADM-001
**Description:** All admin endpoints reject requests from non-admin authenticated users with 403.
**Given:** Regular user (is_admin = false) with valid session.
**When:** POST to any `/api/admin/*` endpoint.
**Then:** 403 `{ error: "Admin access required." }`.
**Priority:** P0

### SEC-ADM-002
**Description:** All admin endpoints reject unauthenticated requests with 401.
**Given:** No session cookie.
**When:** POST to any `/api/admin/*` endpoint.
**Then:** 401.
**Priority:** P0

### SEC-ADM-003
**Description:** Cron endpoints reject requests without matching Bearer token.
**When:** GET `/api/cron/*` with wrong Bearer token.
**Then:** 401 `{ error: "Unauthorized." }`.
**Priority:** P0

### SEC-ADM-004
**Description:** Discord ingest endpoints reject requests without matching ingest key.
**When:** POST to `/api/discord/ingest` or `/api/discord/game-availability` with wrong key.
**Then:** 401.
**Priority:** P0

### SEC-ADM-005
**Description:** Admin trust score override cannot set a user's `is_admin` flag (not a supported field).
**Given:** Admin user.
**When:** POST `/api/admin/trust-score` with `{ user_id: "user@example.com", is_admin: true }`.
**Then:** `is_admin` field not updated (not in the SQL UPDATE statement).
**Priority:** P0

---

## 40. Security -- PII Exposure

### SEC-PII-001
**Description:** Full email address is never returned in intel feed attribution.
**Given:** Signal submitted by `john.doe@example.com` (non-anonymous).
**When:** GET `/api/intel/feed`.
**Then:** `attribution.display_name = "John.doe"` (local part only); full email NOT present anywhere in response.
**Priority:** P0

### SEC-PII-002
**Description:** Session email is not returned in any non-auth API response.
**When:** GET any `/api/tracker/*`, `/api/ledger/*`, `/api/settings` endpoint.
**Then:** No `email` field appears in response body.
**Priority:** P0

### SEC-PII-003
**Description:** Admin community digest exposes `user_id` (which may be an email) -- this should be audited.
**Given:** `admin/community-digest` returns `flagged_users` and `top_contributors` with `user_id`.
**When:** GET `/api/admin/community-digest`.
**Then:** `user_id` values are present (admin view); verify this endpoint is admin-only and the `user_id` exposure is intentional and documented.
**Priority:** P0

### SEC-PII-004
**Description:** Reporter IP hash is stored as a SHA-256 hash, not the raw IP.
**Given:** Ban report submission from `192.168.1.1`.
**When:** Inspect `ban_reports.reporter_ip_hash`.
**Then:** Value is a 64-character hex string (SHA-256); not `192.168.1.1`.
**Priority:** P0

### SEC-PII-005
**Description:** Trust score is not exposed to regular users in the intel feed or signal details.
**When:** GET `/api/intel/feed` or `/api/intel/signal/<id>`.
**Then:** No `trust_score` field present; only `contributor_tier` is exposed.
**Priority:** P1

### SEC-PII-006
**Description:** `emailToDisplayName` handles emails without a local part gracefully.
**Given:** Malformed email `@example.com` or `""`.
**When:** `emailToDisplayName("")`.
**Then:** Returns `"User"` (fallback); no exception; no `@example.com` leaked.
**Priority:** P1

---

## 41. Test Infrastructure Recommendations

### Framework

**Unit/Integration Tests -- Vitest** is strongly recommended over Jest given the ESM-first Astro environment. Vitest provides native TypeScript support, faster execution, and is the de-facto standard in the Vite/Astro ecosystem. Use `@vitest/coverage-v8` for coverage reporting.

**End-to-End Tests -- Playwright** for browser-level integration tests covering the React UI layer. Use Playwright's API request testing for API contract tests that need real HTTP.

### Mocking Strategy

**Database:** Mock the `query<T>()` and `transaction()` functions from `src/lib/db.ts` using `vi.mock('./db')`. Create typed mock helpers that return fixtures for each test. Do **not** mock at the SQL level -- mock at the module boundary.

Example pattern:
```ts
vi.mock('../../lib/db', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));
```

**For integration tests involving the real database**, use a dedicated Neon branch per test run (Neon supports instant branching). Seed each branch with fixtures and tear down after the test suite.

**Auth mocking:** Create a `mockSession(overrides?)` helper that returns a `SessionUser` object. Use `vi.spyOn` on `requireAuth` or `requireAdmin` in `src/lib/auth.ts` to bypass session lookups in unit tests.

**Rate limiter:** For rate limiter tests, use the `createRateLimiter` factory directly in unit tests with a very short `windowMs` (e.g., 100ms) to avoid timing issues.

**Time mocking:** Use Vitest's `vi.useFakeTimers()` / `vi.setSystemTime()` for all time-dependent tests (reset periods, session expiry, decay weights, OTP expiry). Always restore timers in `afterEach`.

**Push/Email:** Mock `sendOTP` from `src/lib/email.ts` and `sendPushToSegment`/`sendPushToUser` from `src/lib/push.ts` using `vi.mock`. Assert call arguments rather than actual delivery.

### Database Setup

Use a layered approach:

1. **Unit tests** (majority): No real DB -- mock `query()` with `vi.fn()`. These should be the fastest tests (< 1s each).

2. **Integration tests**: Use a dedicated Neon test branch. Create a migration script (`test-setup.sql`) that seeds the schema and baseline fixtures. Run migrations via `pnpm db:test:reset` before the suite.

3. **Transaction testing**: Use Neon's `neon-serverless` driver with a real test connection. Test transaction rollback by asserting database state after a simulated mid-transaction failure.

**Fixture strategy:** Create factories for all entity types using a builder pattern:

```ts
// Example factory pattern (not runnable -- for documentation)
type Casino = { id: number; name: string; slug: string; reset_mode: string; ... }
const makeCasino = (overrides: Partial<Casino>): Casino => ({
  id: 1, name: 'Test Casino', slug: 'test-casino',
  reset_mode: 'rolling', reset_interval_hours: 24, ...
  ...overrides
});
```

### Test File Organization

```
src/
  __tests__/
    api/
      auth/
        request-otp.test.ts
        verify-otp.test.ts
        logout.test.ts
      tracker/
        claim.test.ts
        add-casino.test.ts
        ...
      admin/
        casinos.test.ts
        flag-action.test.ts
        ...
    lib/
      trust.test.ts
      health.test.ts
      reset.test.ts
      intel.test.ts
      redemption-stats.test.ts
    integration/    # real DB tests
      auth-flow.test.ts
      claim-race.test.ts
      redemption-received.test.ts
    security/
      cross-user.test.ts
      pii-exposure.test.ts
```

### API Endpoint Testing Pattern

Use the Astro test harness or test the route handlers directly by importing them and constructing `Request` objects:

```ts
// Example pattern (not runnable -- for documentation)
import { POST } from '../../pages/api/tracker/claim';

it('rejects duplicate claims', async () => {
  vi.mocked(transaction).mockImplementationOnce(async (fn) => fn(mockTx));
  mockTx.query.mockResolvedValueOnce([{ id: 1 }]); // existing claim

  const request = new Request('http://localhost/api/tracker/claim', {
    method: 'POST',
    body: JSON.stringify({ casino_id: 42 }),
    headers: { cookie: 'session_token=valid-token' },
  });

  const response = await POST({ request } as any);
  expect(response.status).toBe(409);
});
```

### Concurrency / Race Condition Tests

For tests like CLAIM-003 and REDEEM-011, use actual Postgres advisory locks or transaction isolation in a real test DB. Use `Promise.all([request1, request2])` against the real endpoint. These tests must use the integration test database setup.

### Priority Execution Order

Run tests in this order in CI:
1. **P0 Security** tests first (fail-fast on auth/data leakage regressions)
2. **P0 Core** (auth flow, claims, redemptions)
3. **P1** (all other P1 tests)
4. **P2/P3** (edge cases and nice-to-have)

### Coverage Targets

| Area | Target |
|------|--------|
| `src/lib/trust.ts` | 100% (pure logic) |
| `src/lib/health.ts` | 100% (pure logic) |
| `src/lib/reset.ts` | 100% (pure logic) |
| `src/lib/intel.ts` | 90% |
| `src/lib/auth.ts` | 95% |
| `src/pages/api/**` | 85% |
| `src/lib/redemption-stats.ts` | 100% (pure logic) |

### Suggested First Sprint (P0 Tests)

Start with these 15 tests to get foundational coverage in place immediately:

1. AUTH-004 -- Successful OTP verification
2. AUTH-005 -- Expired OTP rejected
3. AUTH-011 -- Session expiry enforced
4. CLAIM-002 -- Duplicate claim rejected
5. CLAIM-003 -- Race condition test
6. REDEEM-009 -- Cross-user redemption update blocked
7. REDEEM-011 -- Concurrent received calls
8. SEC-001 -- Cross-user ledger isolation
9. SEC-ADM-001 -- Admin endpoint protection
10. SEC-ADM-002 -- Unauthenticated admin rejection
11. TRUST-009 -- Full trust score numeric verification
12. CRON-HEALTH-005 -- Health computation idempotency
13. CRON-PUB-006 -- Auto-publish idempotency
14. SEC-PII-001 -- Email not leaked in intel feed
15. RATELIMIT-001 -- IP rate limiting enforced

---

*End of Test Specification -- 245 test cases across 40 feature areas.*
