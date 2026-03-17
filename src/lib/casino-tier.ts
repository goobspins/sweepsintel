export type CasinoTier = 'S' | 'A' | 'B' | 'C';

const tierRankMap: Record<CasinoTier, number> = {
  S: 0,
  A: 1,
  B: 2,
  C: 3,
};

export function normalizeTier(value: string | null | undefined): CasinoTier {
  if (value === 'S' || value === 'A' || value === 'B' || value === 'C') {
    return value;
  }

  return 'B';
}

export function compareCasinoTiers(a: string, b: string) {
  return tierRankMap[normalizeTier(a)] - tierRankMap[normalizeTier(b)];
}

export function getTierStyles(tierValue: string) {
  const tier = normalizeTier(tierValue);

  if (tier === 'S') {
    return {
      background: 'rgba(217, 119, 6, 0.12)',
      color: '#B45309',
    };
  }

  if (tier === 'A') {
    return {
      background: 'rgba(37, 99, 235, 0.10)',
      color: '#1D4ED8',
    };
  }

  if (tier === 'C') {
    return {
      background: 'rgba(148, 163, 184, 0.14)',
      color: 'var(--text-secondary)',
    };
  }

  return {
    background: 'rgba(15, 23, 42, 0.06)',
    color: '#0F172A',
  };
}

