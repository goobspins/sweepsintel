import type { SessionUser } from './auth';
import { query } from './db';

export interface AffiliateSurfaceCasino {
  id: number;
  slug: string;
  has_affiliate_link: boolean;
  affiliate_link_url: string | null;
}

export interface TrackerDestinationCasino {
  claim_url: string | null;
  has_affiliate_link: boolean;
  affiliate_link_url: string | null;
  slug: string;
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

export function sanitizeClaimUrl(url: string) {
  try {
    const parsed = new URL(url);
    const stripParams = [
      'ref',
      'source',
      'click_id',
      'aff_id',
      'campaign',
      'redirect',
      'return_url',
    ];

    for (const param of stripParams) {
      parsed.searchParams.delete(param);
    }

    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith('utm_')) {
        parsed.searchParams.delete(key);
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export function getTrackerDestination(
  casino: TrackerDestinationCasino,
  hasLedgerEntry: boolean,
): { kind: 'affiliate' | 'claim' | 'profile'; href: string } {
  if (!hasLedgerEntry && casino.has_affiliate_link && casino.affiliate_link_url) {
    return { kind: 'affiliate', href: casino.affiliate_link_url };
  }

  if (hasLedgerEntry && casino.claim_url) {
    return { kind: 'claim', href: sanitizeClaimUrl(casino.claim_url) };
  }

  return { kind: 'profile', href: `/casinos/${casino.slug}` };
}

