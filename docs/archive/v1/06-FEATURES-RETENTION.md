# SweepsIntel — Retention & Re-engagement

_Feature 15_

### 15. Retention and re-engagement mechanics

**The platform must aggressively embed itself into users' daily workflow.** Passive availability is not enough — users will forget to check a website. The tracker is only useful if people come back every day. These mechanics exist to make SweepsIntel the first thing a user thinks of when their casino resets.

---

**PWA manifest (Progressive Web App):**
Create a `manifest.json` with `"display": "standalone"`, appropriate icons, `"start_url": "/tracker"`, `"theme_color"` matching the primary blue. Register a service worker at minimum for the manifest (full offline support is not required at MVP, but the manifest enables "Add to Home Screen" on mobile). This is the single highest-impact retention mechanic — a home screen icon that opens directly to the tracker.

**"Add to Home Screen" prompt:**
On the third visit to `/tracker` (tracked via a cookie counter `sweepsintel_visit_count`), show a non-blocking banner at the top of the page:

```
┌──────────────────────────────────────────┐
│ 📱 Add SweepsIntel to your home screen  │
│ for one-tap access to your tracker.     │
│ [Add now] [Maybe later]                 │
└──────────────────────────────────────────┘
```

- "Add now" triggers the browser's native `beforeinstallprompt` event (Chrome/Edge) or shows platform-specific instructions (Safari/iOS: "Tap Share → Add to Home Screen")
- "Maybe later" dismisses and suppresses for 7 days
- Never show on first visit (too aggressive). Third visit signals intent.

**Browser push notifications (Web Push API):**
After the user has claimed at least 3 daily bonuses (proves they're using the tracker), show a one-time opt-in prompt:

```
┌──────────────────────────────────────────┐
│ 🔔 Never miss a reset                   │
│ Get notified when your casinos are      │
│ ready to claim.                          │
│ [Enable notifications] [No thanks]      │
└──────────────────────────────────────────┘
```

- If accepted: register a push subscription via the Push API + store the subscription in the `push_subscriptions` table (schema defined in `01-SCHEMA.md`).

- **Push notification types at MVP:**
  - **Daily reset reminder:** Fires once daily at the time of the user's earliest casino reset. Message: "Your casinos are ready to claim." Action URL: `/tracker`. Only fires if the user hasn't visited `/tracker` in the last 2 hours (don't notify someone who's already looking at it).
  - **High-value intel alert:** When a `discord_intel_items` row is published with `confidence = 'high'` and `item_type IN ('flash_sale', 'free_sc', 'promo_code')`, push to all users who track that casino. Message: "[Casino]: [title]". These are the time-sensitive items where push notifications earn their keep — a flash sale notification that arrives in real time turns SweepsIntel from a tool into a service.
  - **State pullout alert:** When a `state_pullout_alerts` row is created, push to all users subscribed to that state. Message: "⚠️ [Casino/Provider] has stopped accepting players in [State]."

- **Push sending:** Use the Web Push protocol (VAPID keys stored in env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). The `web-push` npm package handles this. Send from a Vercel serverless function triggered by the event (claim check, intel publish, pullout alert).

- **Frequency cap:** No more than 3 push notifications per user per day. If the cap is hit, queue the notification for the next day's first available slot. Users who get spammed will disable notifications permanently — cap prevents this.

- **Unsubscribe:** Settings page has a "Push notifications" toggle. Disabling sets `is_active = false` on all subscriptions.

**Bookmark prompt (Safari fallback):**
Safari on iOS does not support Web Push at the PWA level in the same way as Chrome. For Safari users who haven't installed the PWA, show a periodic reminder on the tracker page (once every 14 days):

```
┌──────────────────────────────────────────┐
│ ⭐ Bookmark this page for quick access  │
│ Press ⌘+D (or tap Share → Add Bookmark) │
│ [Got it]                                 │
└──────────────────────────────────────────┘
```

Dismiss suppresses for 14 days via cookie.

**Return-path from affiliate redirect:**
When a user clicks "Join" on a Section 2 casino and gets redirected to the casino's signup page, they leave SweepsIntel. The return path:
- Open the affiliate URL in a **new tab** (`target="_blank"`). SweepsIntel stays open in the original tab.
- After the redirect fires, show a toast in the SweepsIntel tab: "✓ [Casino] added to your tracker. Come back here after you sign up to start tracking."
- This is the single most important UX detail for preventing user loss on affiliate clicks.

---
