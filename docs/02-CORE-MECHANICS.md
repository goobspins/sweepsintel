# SweepsIntel — Core Mechanics

## The redemption state machine — implement this exactly

**When a user submits a new redemption:**
1. Create a `redemptions` row with `status = 'pending'`
2. Do NOT create a ledger entry yet
3. Show the pending redemption in the UI as "in transit" — SC has left the casino balance but cash hasn't arrived

**How casino SC balance is calculated for a user:**
```
available_sc = (sum of ledger_entries.sc_amount WHERE user_id=$1 AND casino_id=$2)
             - (sum of redemptions.sc_amount WHERE user_id=$1 AND casino_id=$2 AND status='pending')
```

**When a user marks a redemption as received:**
1. Set `status = 'received'`, set `confirmed_at = NOW()`
2. Create a `ledger_entries` row: `entry_type = 'redeem_confirmed'`, `usd_amount = +(usd_amount - fees_usd)`, `sc_amount = -sc_amount`, set `source_redemption_id`
3. The ledger entry uses net-of-fees USD. Gross and fees are on the `redemptions` row for reference.

**When a redemption is cancelled or rejected:**
1. Set status to `'cancelled'` or `'rejected'`
2. Do NOT create a ledger entry
3. SC balance restores automatically because pending deduction disappears

---

## The affiliate two-state logic — implement this exactly

**Gate is ledger-based.** If an authenticated user has ANY `ledger_entries` rows for a given casino, they've joined that casino — show a direct link. If they have no ledger entries (or are anonymous), fire the affiliate link.

```
user_has_joined(user_id, casino_id) = EXISTS (
  SELECT 1 FROM ledger_entries
  WHERE user_id = $1 AND casino_id = $2
  LIMIT 1
)
```

For anonymous users: always show affiliate link. For authenticated users: check ledger.

**Critical: simple mode tracker claims must still write a ledger entry.** Even when a user taps "Claimed" in simple mode (no SC amount entered), `/api/tracker/claim` must create both a `daily_bonus_claims` row AND a `ledger_entries` row of type `'daily'` with `sc_amount = null`, `usd_amount = 0`. This is what closes the affiliate gate. Do not skip the ledger entry because SC is null.

**When an affiliate click happens:** POST to `/api/affiliate/click` → log to `clicks` → redirect to `casinos.affiliate_link_url`. Never embed the raw affiliate URL in HTML where it can be scraped.

For casinos where `has_affiliate_link = false`: the link on the casino card goes directly to the casino site (no affiliate tracking). Show these casinos with full profiles but without the CTA styling that implies a referral benefit.

**Note on affiliate link formats:** Casinos use different tracking models. Some use query-parameter affiliate links (`casino.com?ref=sweepsintel`), others use path-based referral links (`casino.com/invite/goobspins`). The platform treats these identically — store the full URL in `casinos.affiliate_link_url`, redirect through `/api/affiliate/click`. No special handling per link format.

The daily tracker surfaces not-joined casinos below the main checklist — "Casinos you haven't claimed at yet." Every click logs to `clicks` with `referrer_source = 'tracker_suggestions'`.

---
