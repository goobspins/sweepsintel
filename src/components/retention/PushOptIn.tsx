import { useEffect, useState } from 'react';

import {
  enablePushNotifications,
  getCookie,
  getCurrentPushSubscription,
  getServiceWorkerRegistration,
  isStandaloneDisplay,
  setCookie,
} from '../../lib/push-browser';

const VISIT_COOKIE = 'sweepsintel_visit_count';
const A2HS_SUPPRESS_COOKIE = 'sweepsintel_a2hs_suppressed';
const PUSH_PROMPT_COOKIE = 'sweepsintel_push_prompted';

interface PushOptInProps {
  claimCount: number;
  vapidPublicKey: string;
  blocked?: boolean;
}

export default function PushOptIn({
  claimCount,
  vapidPublicKey,
  blocked = false,
}: PushOptInProps) {
  const [eligible, setEligible] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkEligibility() {
      const visits = Number(getCookie(VISIT_COOKIE) ?? '0');
      const a2hsSuppressed = Boolean(getCookie(A2HS_SUPPRESS_COOKIE));
      const addToHomeEligible = visits >= 3 && !a2hsSuppressed && !isStandaloneDisplay();
      const prompted = Boolean(getCookie(PUSH_PROMPT_COOKIE));
      const permissionDenied = typeof Notification !== 'undefined' && Notification.permission === 'denied';

      if (
        claimCount < 3 ||
        prompted ||
        permissionDenied ||
        addToHomeEligible
      ) {
        if (!cancelled) {
          setEligible(false);
        }
        return;
      }

      try {
        await getServiceWorkerRegistration();
        const existing = await getCurrentPushSubscription();
        if (!cancelled) {
          setSubscribed(Boolean(existing));
          setEligible(!existing);
        }
      } catch {
        if (!cancelled) {
          setEligible(false);
        }
      }
    }

    void checkEligibility();
    return () => {
      cancelled = true;
    };
  }, [claimCount]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function enablePush() {
    if (!vapidPublicKey) {
      setToast('Push keys are not configured yet.');
      return;
    }

    setBusy(true);
    try {
      await enablePushNotifications(vapidPublicKey);
      setCookie(PUSH_PROMPT_COOKIE, '1', 365 * 24 * 60 * 60);
      setSubscribed(true);
      setEligible(false);
      setToast('Notifications enabled.');
    } catch (error) {
      console.error(error);
      setToast('Unable to enable notifications.');
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setCookie(PUSH_PROMPT_COOKIE, '1', 365 * 24 * 60 * 60);
    setEligible(false);
  }

  if (!eligible || blocked || subscribed) {
    return null;
  }

  return (
    <section className="retention-banner push-banner">
      {toast ? <div className="toast">{toast}</div> : null}
      <div className="copy">
        <strong>Never miss a reset.</strong>
        <p>Get notified when your casinos are ready to claim.</p>
      </div>
      <div className="actions">
        <button type="button" onClick={() => void enablePush()} disabled={busy}>
          {busy ? 'Enabling...' : 'Enable notifications'}
        </button>
        <button type="button" className="ghost" onClick={dismiss} disabled={busy}>
          No thanks
        </button>
      </div>

      <style>{`
        .retention-banner {
          display:grid; gap:.85rem; padding:1rem 1.1rem; border-radius:1.25rem;
          border:1px solid rgba(22, 163, 74, 0.18); background:rgba(22, 163, 74, 0.08);
        }
        .copy { display:grid; gap:.35rem; }
        .copy p, .copy strong { margin:0; }
        .copy p { color:var(--color-muted); line-height:1.6; }
        .actions { display:flex; gap:.65rem; flex-wrap:wrap; }
        .actions button {
          border:none; border-radius:999px; padding:.8rem 1rem; background:var(--color-primary);
          color:var(--text-primary); font:inherit; font-weight:700; cursor:pointer;
        }
        .actions .ghost {
          border:1px solid var(--color-border); background:var(--color-surface); color:var(--color-ink);
        }
        .toast {
          justify-self:start; padding:.7rem .9rem; border-radius:999px; background:rgba(16, 185, 129, 0.16);
          color:var(--accent-green); font-weight:700;
        }
      `}</style>
    </section>
  );
}

