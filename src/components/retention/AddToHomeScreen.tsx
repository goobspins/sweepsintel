import { useEffect, useState } from 'react';

import {
  getCookie,
  isIosSafari,
  isStandaloneDisplay,
  setCookie,
} from '../../lib/push-browser';

const VISIT_COOKIE = 'sweepsintel_visit_count';
const SUPPRESS_COOKIE = 'sweepsintel_a2hs_suppressed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

interface AddToHomeScreenProps {
  blocked?: boolean;
}

export default function AddToHomeScreen({ blocked = false }: AddToHomeScreenProps) {
  const [eligible, setEligible] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const visits = Number(getCookie(VISIT_COOKIE) ?? '0') + 1;
    setCookie(VISIT_COOKIE, String(visits), 365 * 24 * 60 * 60);

    const suppressed = getCookie(SUPPRESS_COOKIE);
    setEligible(visits >= 3 && !suppressed && !isStandaloneDisplay());

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  async function handleInstall() {
    if (installPrompt) {
      await installPrompt.prompt().catch(() => {});
      setDismissed(true);
      return;
    }

    if (isIosSafari()) {
      setShowInstructions(true);
      return;
    }

    setShowInstructions(true);
  }

  function dismiss(days: number) {
    setCookie(SUPPRESS_COOKIE, '1', days * 24 * 60 * 60);
    setDismissed(true);
  }

  if (!eligible || blocked || dismissed) {
    return null;
  }

  return (
    <section className="retention-banner a2hs-banner">
      <div className="copy">
        <strong>Add SweepsIntel to your home screen</strong>
        <p>Add SweepsIntel to your home screen for one-tap access to your tracker.</p>
        {showInstructions ? (
          <p className="hint">
            {isIosSafari()
              ? 'Tap Share -> Add to Home Screen.'
              : 'Use your browser menu to install or bookmark this app.'}
          </p>
        ) : null}
      </div>
      <div className="actions">
        <button type="button" onClick={() => void handleInstall()}>
          Add now
        </button>
        <button type="button" className="ghost" onClick={() => dismiss(7)}>
          Maybe later
        </button>
      </div>

      <style>{`
        .retention-banner {
          display:grid; gap:.85rem; padding:1rem 1.1rem; border-radius:1.25rem;
          border:1px solid rgba(37, 99, 235, 0.18); background:rgba(37, 99, 235, 0.08);
        }
        .copy { display:grid; gap:.35rem; }
        .copy p, .copy strong { margin:0; }
        .copy p { color:var(--color-muted); line-height:1.6; }
        .hint { color:var(--color-primary) !important; font-weight:600; }
        .actions { display:flex; gap:.65rem; flex-wrap:wrap; }
        .actions button {
          border:none; border-radius:999px; padding:.8rem 1rem; background:var(--color-primary);
          color:var(--text-primary); font:inherit; font-weight:700; cursor:pointer;
        }
        .actions .ghost {
          border:1px solid var(--color-border); background:var(--color-surface); color:var(--color-ink);
        }
      `}</style>
    </section>
  );
}

