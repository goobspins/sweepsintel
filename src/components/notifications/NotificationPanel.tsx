import { useEffect, useState } from 'react';

interface NotificationItem {
  id: number;
  notification_type: 'state_pullout' | 'ban_uptick' | 'system';
  casino_id: number | null;
  state_code: string | null;
  title: string;
  message: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationPanelProps {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}

type ToastState = {
  tone: 'success' | 'error';
  message: string;
} | null;

export default function NotificationPanel({
  initialNotifications,
  initialUnreadCount,
}: NotificationPanelProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [busyId, setBusyId] = useState<number | 'all' | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function markAllRead() {
    setBusyId('all');
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to mark notifications read.');
      }

      setNotifications((current) =>
        current.map((notification) => ({ ...notification, is_read: true })),
      );
      setUnreadCount(Number(data.unread_count ?? 0));
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: 'Unable to mark notifications read.' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleClick(notification: NotificationItem) {
    setBusyId(notification.id);
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_one',
          notification_id: notification.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to update notification.');
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item,
        ),
      );
      setUnreadCount(Number(data.unread_count ?? 0));
      window.location.assign(notification.action_url ?? '/notifications');
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: 'Unable to open notification.' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="surface-card notification-panel">
      {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}
      <div className="panel-header">
        <div>
          <h1 className="section-title">Notifications</h1>
          <p className="muted">
            {unreadCount > 0
              ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}`
              : 'Everything is caught up.'}
          </p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void markAllRead()}
          disabled={busyId === 'all' || unreadCount === 0}
        >
          {busyId === 'all' ? 'Saving...' : 'Mark all read'}
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          No notifications yet. You&apos;ll see alerts here when something changes at a casino you track or in a state you&apos;re subscribed to.
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className={notification.is_read ? 'notification-row' : 'notification-row unread'}
              onClick={() => void handleClick(notification)}
              disabled={busyId === notification.id}
            >
              <div className="row-main">
                <span className="dot">{notification.is_read ? '\u25CB' : '\u25CF'}</span>
                <div className="row-copy">
                  <strong>
                    {typePrefix(notification.notification_type)}
                    {notification.title}
                  </strong>
                  <p>{notification.message}</p>
                </div>
              </div>
              <span className="muted">{formatRelative(notification.created_at)}</span>
            </button>
          ))}
        </div>
      )}

      <style>{`
        .notification-panel { display:grid; gap:1rem; padding:1.25rem; }
        .panel-header, .notification-row, .row-main {
          display:flex; gap:.75rem; justify-content:space-between; align-items:flex-start;
        }
        .panel-header p, .row-copy p, .row-copy strong { margin:0; }
        .ghost-button {
          border:1px solid var(--color-border); border-radius:999px; padding:.85rem 1rem;
          background:var(--color-surface); color:var(--color-ink); font:inherit; font-weight:700; cursor:pointer;
        }
        .notification-list { display:grid; gap:.85rem; }
        .notification-row {
          width:100%; text-align:left; border:1px solid var(--color-border); border-radius:1.25rem;
          background:var(--color-surface); padding:1rem; cursor:pointer;
        }
        .notification-row.unread {
          border-color:rgba(37, 99, 235, 0.25); background:rgba(37, 99, 235, 0.04);
        }
        .row-main { align-items:flex-start; justify-content:flex-start; }
        .row-copy { display:grid; gap:.35rem; }
        .row-copy p { color:var(--color-muted); line-height:1.6; }
        .dot { color:var(--color-primary); line-height:1.4; }
        .empty-state {
          border:1px dashed var(--color-border); border-radius:1rem; padding:1.1rem;
          color:var(--color-muted); line-height:1.7;
        }
        .toast {
          position:sticky; top:1rem; z-index:20; justify-self:center; padding:.85rem 1rem;
          border-radius:999px; font-weight:700;
        }
        .toast-success { background:rgba(16, 185, 129, 0.16); color:var(--accent-green); }
        .toast-error { background:rgba(239, 68, 68, 0.16); color:var(--accent-red); }
        @media (max-width: 767px) { .notification-row { display:grid; } }
      `}</style>
    </section>
  );
}

function typePrefix(type: NotificationItem['notification_type']) {
  if (type === 'state_pullout') return '\u26A0\uFE0F ';
  if (type === 'ban_uptick') return '\u{1F6A9} ';
  return '';
}

function formatRelative(timestamp: string) {
  const diffMs = new Date(timestamp).getTime() - Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(diffMs) >= dayMs) return formatter.format(Math.round(diffMs / dayMs), 'day');
  if (Math.abs(diffMs) >= hourMs) return formatter.format(Math.round(diffMs / hourMs), 'hour');
  return formatter.format(Math.round(diffMs / minuteMs), 'minute');
}

