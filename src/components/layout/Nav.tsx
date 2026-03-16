import type { SessionUser } from '../../lib/auth';

interface NavProps {
  currentPath?: string;
  mobile?: boolean;
  user: SessionUser | null;
}

interface NavItem {
  href: string;
  label: string;
}

function buildNavItems(user: SessionUser | null): NavItem[] {
  const publicItems = [
    { href: '/casinos', label: 'Casinos' },
    { href: '/states', label: 'States' },
    { href: '/getting-started', label: 'Getting Started' },
  ];

  if (!user) {
    return publicItems;
  }

  return [
    ...publicItems,
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/my-casinos', label: 'My Casinos' },
    { href: '/ledger', label: 'Ledger' },
    { href: '/redemptions', label: 'Redemptions' },
    { href: '/settings', label: 'Settings' },
    ...(user.isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];
}

export default function Nav({ currentPath = '/', mobile = false, user }: NavProps) {
  const items = buildNavItems(user);

  return (
    <nav
      aria-label="Primary"
      style={{
        display: 'flex',
        flexDirection: mobile ? 'column' : 'row',
        gap: mobile ? '0.4rem' : '0.7rem',
        alignItems: mobile ? 'stretch' : 'center',
        flexWrap: mobile ? 'nowrap' : 'wrap',
      }}
    >
      {items.map((item) => {
        const active =
          currentPath === item.href ||
          (item.href !== '/' && currentPath.startsWith(`${item.href}/`));

        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              textDecoration: 'none',
              fontWeight: active ? 700 : 500,
              fontSize: mobile ? '1rem' : '0.92rem',
              padding: mobile ? '0.7rem 0.85rem' : '0.45rem 0.2rem',
              borderRadius: '0.75rem',
              background: active ? 'rgba(59, 130, 246, 0.14)' : 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

