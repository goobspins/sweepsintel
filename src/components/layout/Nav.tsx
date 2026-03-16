import type { SessionUser } from '../../lib/auth';

interface NavProps {
  currentPath?: string;
  mobile?: boolean;
  user: SessionUser | null;
  section?: 'public' | 'tools';
}

interface NavItem {
  href: string;
  label: string;
}

function buildPublicItems(): NavItem[] {
  return [
    { href: '/casinos', label: 'Casinos' },
    { href: '/states', label: 'States' },
    { href: '/getting-started', label: 'Getting Started' },
  ];
}

function buildToolItems(user: SessionUser | null): NavItem[] {
  if (!user) {
    return [];
  }

  return [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/my-casinos', label: 'My Casinos' },
    { href: '/ledger', label: 'Ledger' },
    { href: '/redemptions', label: 'Redemptions' },
  ];
}

export function getNavSections(user: SessionUser | null) {
  return {
    publicItems: buildPublicItems(),
    toolItems: buildToolItems(user),
  };
}

export default function Nav({
  currentPath = '/',
  mobile = false,
  user,
  section,
}: NavProps) {
  const { publicItems, toolItems } = getNavSections(user);
  const items =
    section === 'public'
      ? publicItems
      : section === 'tools'
        ? toolItems
        : [...publicItems, ...toolItems];

  return (
    <nav
      aria-label="Primary"
      style={{
        display: 'flex',
        flexDirection: mobile ? 'column' : 'row',
        gap: mobile ? '0.35rem' : '0.5rem',
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
              fontSize: mobile ? '0.98rem' : '0.92rem',
              padding: mobile ? '0.68rem 0.8rem' : '0.42rem 0.2rem',
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
