import { useState } from 'react';

import type { SessionUser } from '../../lib/auth';
import NotificationBadge from '../notifications/NotificationBadge';
import Nav from './Nav';

interface HeaderProps {
  currentPath?: string;
  user: SessionUser | null;
}

export default function Header({
  currentPath = '/',
  user,
}: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } finally {
      window.location.assign('/');
    }
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        backdropFilter: 'blur(18px)',
        background: 'rgba(248, 250, 252, 0.92)',
        borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
      }}
    >
      <div
        style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: '1rem 1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              textDecoration: 'none',
              color: '#0f172a',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '0.85rem',
                background: 'linear-gradient(135deg, #0f766e 0%, #0f172a 100%)',
                color: '#fff',
                fontSize: '1rem',
              }}
            >
              SI
            </span>
            <span style={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
              SweepsIntel
            </span>
          </a>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
            }}
          >
            <div className="desktop-nav" style={{ display: 'none' }}>
              <Nav currentPath={currentPath} user={user} />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <NotificationBadge user={user} />
              {user ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                  }}
                >
                  <span
                    style={{
                      display: 'none',
                      color: '#475569',
                      fontSize: '0.92rem',
                    }}
                    className="desktop-email"
                  >
                    {user.email}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    style={{
                      border: 'none',
                      borderRadius: '999px',
                      background: '#0f172a',
                      color: '#fff',
                      padding: '0.7rem 1rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {isLoggingOut ? 'Logging out...' : 'Log out'}
                  </button>
                </div>
              ) : (
                <a
                  href="#login"
                  style={{
                    borderRadius: '999px',
                    background: '#0f172a',
                    color: '#fff',
                    padding: '0.7rem 1rem',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  Log in
                </a>
              )}
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                aria-expanded={mobileOpen}
                aria-label="Toggle navigation"
                style={{
                  border: '1px solid rgba(15, 23, 42, 0.12)',
                  background: '#fff',
                  color: '#0f172a',
                  borderRadius: '0.85rem',
                  width: '2.75rem',
                  height: '2.75rem',
                  cursor: 'pointer',
                }}
              >
                {mobileOpen ? '×' : '≡'}
              </button>
            </div>
          </div>
        </div>

        {mobileOpen ? (
          <div
            style={{
              marginTop: '1rem',
              borderTop: '1px solid rgba(15, 23, 42, 0.08)',
              paddingTop: '1rem',
              display: 'grid',
              gap: '0.85rem',
            }}
          >
            {user ? (
              <div
                style={{
                  color: '#475569',
                  fontSize: '0.92rem',
                  padding: '0 0.25rem',
                }}
              >
                Signed in as {user.email}
              </div>
            ) : null}
            <Nav currentPath={currentPath} mobile user={user} />
          </div>
        ) : null}
      </div>

      <style>{`
        @media (min-width: 880px) {
          .desktop-nav {
            display: block !important;
          }

          .desktop-email {
            display: inline !important;
          }
        }
      `}</style>
    </header>
  );
}
