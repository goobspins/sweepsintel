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
    { href: '/tracker', label: 'Tracker' },
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
        gap: mobile ? '0.4rem' : '1rem',
        alignItems: mobile ? 'stretch' : 'center',
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
              color: active ? '#0f172a' : '#475569',
              textDecoration: 'none',
              fontWeight: active ? 700 : 500,
              padding: mobile ? '0.7rem 0.85rem' : '0.45rem 0.25rem',
              borderRadius: '0.75rem',
              background: active ? 'rgba(148, 163, 184, 0.16)' : 'transparent',
            }}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
