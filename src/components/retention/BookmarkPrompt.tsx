import { useEffect, useState } from 'react';

import {
  getCookie,
  getCurrentPushSubscription,
  getServiceWorkerRegistration,
  isIosSafari,
  isStandaloneDisplay,
  setCookie,
} from '../../lib/push-browser';

const VISIT_COOKIE = 'sweepsintel_visit_count';
const A2HS_SUPPRESS_COOKIE = 'sweepsintel_a2hs_suppressed';
const BOOKMARK_COOKIE = 'sweepsintel_bookmark_prompted';
const PUSH_PROMPT_COOKIE = 'sweepsintel_push_prompted';

interface BookmarkPromptProps {
  claimCount: number;
  blocked?: boolean;
}

export default function BookmarkPrompt({
  claimCount,
  blocked = false,
}: BookmarkPromptProps) {
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkEligibility() {
      if (!isIosSafari() || isStandaloneDisplay()) {
        if (!cancelled) {
          setEligible(false);
        }
        return;
      }

      const visits = Number(getCookie(VISIT_COOKIE) ?? '0');
      const a2hsSuppressed = Boolean(getCookie(A2HS_SUPPRESS_COOKIE));
      const bookmarkSuppressed = Boolean(getCookie(BOOKMARK_COOKIE));
      const pushPrompted = Boolean(getCookie(PUSH_PROMPT_COOKIE));
      const addToHomeEligible = visits >= 3 && !a2hsSuppressed;

      if (bookmarkSuppressed || addToHomeEligible) {
        if (!cancelled) {
          setEligible(false);
        }
        return;
      }

      const permissionDenied =
        typeof Notification !== 'undefined' && Notification.permission === 'denied';

      if (claimCount >= 3 && !pushPrompted && !permissionDenied) {
        try {
          await getServiceWorkerRegistration();
          const subscription = await getCurrentPushSubscription();
          if (!cancelled && !subscription) {
            setEligible(false);
            return;
          }
        } catch {
          if (!cancelled) {
            setEligible(false);
          return;
        }
      }
      }

      if (!cancelled) {
        setEligible(true);
      }
    }

    void checkEligibility();
    return () => {
      cancelled = true;
    };
  }, [claimCount]);

  function dismiss() {
    setCookie(BOOKMARK_COOKIE, '1', 14 * 24 * 60 * 60);
    setEligible(false);
  }

  if (!eligible || blocked) {
    return null;
  }

  return (
    <section className="retention-banner bookmark-banner">
      <div className="copy">
        <strong>Bookmark this page for quick access.</strong>
        <p>Press CMD+D or tap Share -&gt; Add Bookmark.</p>
      </div>
      <div className="actions">
        <button type="button" onClick={dismiss}>
          Got it
        </button>
      </div>

      <style>{`
        .retention-banner {
          display:grid; gap:.85rem; padding:1rem 1.1rem; border-radius:1.25rem;
          border:1px solid rgba(217, 119, 6, 0.18); background:rgba(217, 119, 6, 0.08);
        }
        .copy { display:grid; gap:.35rem; }
        .copy p, .copy strong { margin:0; }
        .copy p { color:var(--color-muted); line-height:1.6; }
        .actions button {
          border:none; border-radius:999px; padding:.8rem 1rem; background:var(--color-surface);
          color:var(--color-ink); font:inherit; font-weight:700; cursor:pointer;
          border:1px solid var(--color-border);
        }
      `}</style>
    </section>
  );
}

