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
        background: 'rgba(17, 24, 39, 0.92)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div
          style={{
              maxWidth: 'var(--header-max-width)',
              margin: '0 auto',
              padding: '1rem var(--content-gutter)',
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              minWidth: 0,
            }}
          >
            <a
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                textDecoration: 'none',
                color: 'var(--color-ink)',
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
                  background: 'linear-gradient(135deg, var(--accent-green) 0%, var(--accent-blue) 100%)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              >
                SI
              </span>
              <span style={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
                SweepsIntel
              </span>
            </a>

            <div className="desktop-nav" style={{ display: 'none', minWidth: 0 }}>
              <Nav currentPath={currentPath} user={user} />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              marginLeft: 'auto',
            }}
          >
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
                      color: 'var(--text-secondary)',
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
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
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
                  href="/login"
                  style={{
                    borderRadius: '999px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
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
                className="mobile-nav-toggle"
                style={{
                  border: '1px solid var(--color-border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
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
              borderTop: '1px solid var(--color-border)',
              paddingTop: '1rem',
              display: 'grid',
              gap: '0.85rem',
            }}
          >
            {user ? (
              <div
                style={{
                  color: 'var(--text-secondary)',
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
            flex: 1 1 auto;
          }

          .mobile-nav-toggle {
            display: none !important;
          }
        }

        @media (min-width: 1280px) {
          .desktop-email {
            display: inline !important;
          }
        }

        @media (max-width: 1279px) {
          .desktop-email {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}

