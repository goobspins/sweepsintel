import { useEffect, useState } from 'react';

import type { SessionUser } from '../../lib/auth';

interface NotificationBadgeProps {
  user: SessionUser | null;
}

export default function NotificationBadge({ user }: NotificationBadgeProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    async function loadCount() {
      try {
        const response = await fetch('/api/notifications/unread-count');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Unable to load notification count.');
        }

        if (!cancelled) {
          setCount(Number(data.count ?? 0));
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    }

    void loadCount();
    const interval = window.setInterval(() => void loadCount(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <a
      href="/notifications"
      aria-label="Notifications"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '2.5rem',
        height: '2.5rem',
        borderRadius: '999px',
        border: '1px solid var(--color-border)',
        color: 'var(--text-primary)',
        textDecoration: 'none',
        background: 'var(--bg-secondary)',
        position: 'relative',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>
        {'\u{1F514}'}
      </span>
      {count > 0 ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '0.2rem',
            right: '0.2rem',
            minWidth: '1.1rem',
            height: '1.1rem',
            borderRadius: '999px',
            background: 'var(--accent-red)',
            color: 'var(--text-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '0 0.2rem',
          }}
        >
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </a>
  );
}

