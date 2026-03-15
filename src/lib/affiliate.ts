import type { SessionUser } from './auth';
import { query } from './db';

export interface AffiliateSurfaceCasino {
  id: number;
  slug: string;
  has_affiliate_link: boolean;
  affiliate_link_url: string | null;
}

export async function hasJoinedCasino(
  user: SessionUser | null,
  casinoId: number,
): Promise<boolean> {
  if (!user) {
    return false;
  }

  const rows = await query<{ joined: number }>(
    `SELECT 1 AS joined
    FROM ledger_entries
    WHERE user_id = $1 AND casino_id = $2
    LIMIT 1`,
    [user.userId, casinoId],
  );

  return rows.length > 0;
}

export function getDirectoryDestination(
  casino: AffiliateSurfaceCasino,
  joined: boolean,
) {
  if (casino.has_affiliate_link && !joined) {
    return {
      kind: 'affiliate' as const,
      href: null,
      fallbackUrl: casino.affiliate_link_url,
    };
  }

  return {
    kind: 'profile' as const,
    href: `/casinos/${casino.slug}`,
    fallbackUrl: null,
  };
}
