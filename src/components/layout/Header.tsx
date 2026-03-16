import { useEffect, useRef, useState } from 'react';

import type { SessionUser } from '../../lib/auth';
import NotificationBadge from '../notifications/NotificationBadge';
import Nav, { getNavSections } from './Nav';

interface HeaderProps {
  currentPath?: string;
  user: SessionUser | null;
}

export default function Header({
  currentPath = '/',
  user,
}: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const { publicItems, toolItems } = getNavSections(user);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

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

  const avatarLabel = user?.email?.trim()?.charAt(0)?.toUpperCase() || 'U';

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
            gap: '1rem',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              minWidth: 0,
              flex: '0 1 auto',
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
                whiteSpace: 'nowrap',
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

            <div className="desktop-public-nav" style={{ display: 'none', minWidth: 0 }}>
              <Nav currentPath={currentPath} user={user} section="public" />
            </div>
          </div>

          {user ? (
            <div
              className="desktop-tools-zone"
              style={{
                display: 'none',
                alignItems: 'center',
                gap: '1rem',
                minWidth: 0,
                flex: '1 1 auto',
                margin: '0 auto',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '1px',
                  height: '20px',
                  background: 'var(--color-border)',
                  opacity: 0.5,
                  flexShrink: 0,
                }}
              />
              <Nav currentPath={currentPath} user={user} section="tools" />
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginLeft: 'auto',
              flexShrink: 0,
            }}
          >
            <NotificationBadge user={user} />

            {user ? (
              <div ref={accountMenuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '999px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {avatarLabel}
                </button>

                {menuOpen ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 0.6rem)',
                      right: 0,
                      minWidth: '220px',
                      borderRadius: '1rem',
                      border: '1px solid var(--color-border)',
                      background: 'rgba(31, 41, 55, 0.98)',
                      boxShadow: '0 20px 40px rgba(2, 6, 23, 0.45)',
                      padding: '0.75rem',
                      display: 'grid',
                      gap: '0.35rem',
                    }}
                  >
                    <div
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.82rem',
                        padding: '0.15rem 0.35rem 0.45rem',
                        borderBottom: '1px solid rgba(156, 163, 175, 0.16)',
                        marginBottom: '0.15rem',
                        wordBreak: 'break-word',
                      }}
                    >
                      {user.email}
                    </div>
                    <a href="/settings" style={menuLinkStyle}>
                      Settings
                    </a>
                    {user.isAdmin ? (
                      <a href="/admin" style={menuLinkStyle}>
                        Admin
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      disabled={isLoggingOut}
                      style={{
                        ...menuButtonStyle,
                        color: 'var(--text-primary)',
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                        event.currentTarget.style.color = 'var(--accent-red)';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = 'transparent';
                        event.currentTarget.style.color = 'var(--text-primary)';
                      }}
                    >
                      {isLoggingOut ? 'Logging out...' : 'Log out'}
                    </button>
                  </div>
                ) : null}
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
              {mobileOpen ? 'x' : '='}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div
            style={{
              marginTop: '1rem',
              borderTop: '1px solid var(--color-border)',
              paddingTop: '1rem',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <div style={sectionLabelStyle}>Browse</div>
              <Nav currentPath={currentPath} mobile user={user} section="public" />
            </div>

            {user && toolItems.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <div style={sectionLabelStyle}>Tools</div>
                <Nav currentPath={currentPath} mobile user={user} section="tools" />
              </div>
            ) : null}

            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <div style={sectionLabelStyle}>Account</div>
              {user ? (
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <div
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.92rem',
                      padding: '0.15rem 0.25rem',
                      wordBreak: 'break-word',
                    }}
                  >
                    {user.email}
                  </div>
                  <a href="/settings" style={mobileAccountLinkStyle}>
                    Settings
                  </a>
                  {user.isAdmin ? (
                    <a href="/admin" style={mobileAccountLinkStyle}>
                      Admin
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={isLoggingOut}
                    style={{
                      ...mobileAccountButtonStyle,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {isLoggingOut ? 'Logging out...' : 'Log out'}
                  </button>
                </div>
              ) : (
                <a href="/login" style={mobileAccountLinkStyle}>
                  Log in
                </a>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <style>{`
        @media (min-width: 880px) {
          .desktop-public-nav,
          .desktop-tools-zone {
            display: flex !important;
          }

          .mobile-nav-toggle {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 700,
  marginBottom: '0.3rem',
  padding: '0 0.25rem',
};

const menuLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '0.8rem',
  padding: '0.65rem 0.75rem',
  color: 'var(--text-primary)',
  textDecoration: 'none',
  fontWeight: 600,
};

const menuButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  borderRadius: '0.8rem',
  padding: '0.65rem 0.75rem',
  textAlign: 'left',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
};

const mobileAccountLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '0.75rem',
  padding: '0.68rem 0.8rem',
  color: 'var(--text-primary)',
  textDecoration: 'none',
  fontWeight: 600,
};

const mobileAccountButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  borderRadius: '0.75rem',
  padding: '0.68rem 0.8rem',
  textAlign: 'left',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
};
