import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./db');

import { query } from './db';
import {
  combineTrustComponents,
  computeTrustScore,
  normalizeActivityScore,
  normalizeCommunityScore,
  normalizePortfolioScore,
  normalizeSubmissionScore,
} from './trust';

const mockQuery = vi.mocked(query);

const ACCOUNT_AGE_MATURITY_DAYS = 90;
const CLAIM_COUNT_MATURITY = 100;
const ACCOUNT_AGE_WEIGHT = 0.6;
const CLAIM_ACTIVITY_WEIGHT = 0.4;
const COMMUNITY_STANDING_OFFSET = 10;
const COMMUNITY_STANDING_DIVISOR = 20;
const PORTFOLIO_DEPOSIT_RATIO_THRESHOLD = 0.5;
const PORTFOLIO_REDEMPTION_MATURITY = 3;
const PORTFOLIO_DIVERSITY_MATURITY = 5;
const NEGATIVE_PL_SUPPRESSION_FLOOR = 0.3;
const PORTFOLIO_POSITIVE_PL_MATURITY_USD = 1000;
const PORTFOLIO_NEGATIVE_PL_DIVISOR_USD = 2000;
const CLAIM_DAYS_MATURITY = 45;
const REDEMPTION_SUCCESS_FALLBACK = 0.5;

const WEIGHT_ACCOUNT_ACTIVITY = 0.20;
const WEIGHT_SUBMISSION_HISTORY = 0.30;
const WEIGHT_COMMUNITY_STANDING = 0.15;
const WEIGHT_PORTFOLIO = 0.35;

const PORTFOLIO_PL_WEIGHT = 0.35;
const PORTFOLIO_DIVERSITY_WEIGHT = 0.25;
const PORTFOLIO_CONSISTENCY_WEIGHT = 0.25;
const PORTFOLIO_REDEMPTION_WEIGHT = 0.15;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeExpectedTrustScore(input: {
  created_at: string | null;
  claim_count: number | string | null;
  worked_votes: number | string | null;
  total_votes: number | string | null;
  net_positive_votes: number | string | null;
  net_pl_usd: number | string | null;
  tracked_casino_count: number | string | null;
  claim_days: number | string | null;
  successful_redemptions: number | string | null;
  total_redemptions: number | string | null;
}) {
  const accountAgeDays = input.created_at
    ? Math.max(0, (Date.now() - new Date(input.created_at).getTime()) / 86_400_000)
    : 0;
  const claimCount = Number(input.claim_count ?? 0);
  const accountActivity =
    clamp(accountAgeDays / ACCOUNT_AGE_MATURITY_DAYS, 0, 1) * ACCOUNT_AGE_WEIGHT +
    clamp(claimCount / CLAIM_COUNT_MATURITY, 0, 1) * CLAIM_ACTIVITY_WEIGHT;

  const workedVotes = Number(input.worked_votes ?? 0);
  const totalVotes = Number(input.total_votes ?? 0);
  const submissionHistory = totalVotes > 0 ? workedVotes / totalVotes : 0.5;

  const communityStanding = clamp(
    (Number(input.net_positive_votes ?? 0) + COMMUNITY_STANDING_OFFSET) / COMMUNITY_STANDING_DIVISOR,
    0,
    1,
  );

  const netPlUsd = Number(input.net_pl_usd ?? 0);
  const trackedCasinoCount = Number(input.tracked_casino_count ?? 0);
  const claimDays = Number(input.claim_days ?? 0);
  const successfulRedemptions = Number(input.successful_redemptions ?? 0);
  const totalRedemptions = Number(input.total_redemptions ?? 0);

  const portfolioPl =
    netPlUsd >= 0
      ? clamp(netPlUsd / PORTFOLIO_POSITIVE_PL_MATURITY_USD, PORTFOLIO_DEPOSIT_RATIO_THRESHOLD, 1)
      : clamp(
          PORTFOLIO_DEPOSIT_RATIO_THRESHOLD + netPlUsd / PORTFOLIO_NEGATIVE_PL_DIVISOR_USD,
          NEGATIVE_PL_SUPPRESSION_FLOOR,
          PORTFOLIO_DEPOSIT_RATIO_THRESHOLD,
        );
  const portfolioDiversity = clamp(trackedCasinoCount / PORTFOLIO_DIVERSITY_MATURITY, 0, 1);
  const portfolioConsistency = clamp(claimDays / CLAIM_DAYS_MATURITY, 0, 1);
  const redemptionSuccess =
    totalRedemptions >= PORTFOLIO_REDEMPTION_MATURITY
      ? successfulRedemptions / totalRedemptions
      : REDEMPTION_SUCCESS_FALLBACK;
  const portfolioScore =
    portfolioPl * PORTFOLIO_PL_WEIGHT +
    portfolioDiversity * PORTFOLIO_DIVERSITY_WEIGHT +
    portfolioConsistency * PORTFOLIO_CONSISTENCY_WEIGHT +
    redemptionSuccess * PORTFOLIO_REDEMPTION_WEIGHT;

  return clamp(
    accountActivity * WEIGHT_ACCOUNT_ACTIVITY +
      submissionHistory * WEIGHT_SUBMISSION_HISTORY +
      communityStanding * WEIGHT_COMMUNITY_STANDING +
      portfolioScore * WEIGHT_PORTFOLIO,
    0,
    1,
  );
}

function buildTrustQuerySequence({
  account,
  submission,
  community,
  portfolio,
  updateResult = [],
}: {
  account: Array<Record<string, unknown>>;
  submission: Array<Record<string, unknown>>;
  community: Array<Record<string, unknown>>;
  portfolio: Array<Record<string, unknown>>;
  updateResult?: Array<Record<string, unknown>>;
}) {
  mockQuery
    .mockResolvedValueOnce(account)
    .mockResolvedValueOnce(submission)
    .mockResolvedValueOnce(community)
    .mockResolvedValueOnce(portfolio)
    .mockResolvedValueOnce(updateResult);
}

describe('computeTrustScore', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T00:00:00.000Z'));
  });

  it('returns default score when user not found', async () => {
    buildTrustQuerySequence({
      account: [],
      submission: [],
      community: [],
      portfolio: [],
    });

    const score = await computeTrustScore('missing-user');

    expect(score).toBe(0.5);
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  it('computes a mature user near the top of the range', async () => {
    buildTrustQuerySequence({
      account: [{ created_at: '2025-01-01T00:00:00.000Z', claim_count: 150 }],
      submission: [{ total_signals: 10, worked_votes: 18, total_votes: 20 }],
      community: [{ net_positive_votes: 8 }],
      portfolio: [{
        net_pl_usd: 1200,
        tracked_casino_count: 8,
        claim_days: 60,
        successful_redemptions: 5,
        total_redemptions: 5,
      }],
    });

    const score = await computeTrustScore('mature-user');

    expect(score).toBeCloseTo(computeExpectedTrustScore({
      created_at: '2025-01-01T00:00:00.000Z',
      claim_count: 150,
      worked_votes: 18,
      total_votes: 20,
      net_positive_votes: 8,
      net_pl_usd: 1200,
      tracked_casino_count: 8,
      claim_days: 60,
      successful_redemptions: 5,
      total_redemptions: 5,
    }), 4);
    expect(mockQuery).toHaveBeenCalledTimes(5);
    expect(mockQuery.mock.calls[4]?.[0]).toContain('UPDATE user_settings');
  });

  it('computes mid-range account activity correctly', async () => {
    buildTrustQuerySequence({
      account: [{ created_at: '2026-01-31T00:00:00.000Z', claim_count: 50 }],
      submission: [{ total_signals: 0, worked_votes: 0, total_votes: 0 }],
      community: [{ net_positive_votes: 0 }],
      portfolio: [{
        net_pl_usd: 0,
        tracked_casino_count: 0,
        claim_days: 0,
        successful_redemptions: 0,
        total_redemptions: 0,
      }],
    });

    const score = await computeTrustScore('mid-user');

    expect(score).toBeCloseTo(computeExpectedTrustScore({
      created_at: '2026-01-31T00:00:00.000Z',
      claim_count: 50,
      worked_votes: 0,
      total_votes: 0,
      net_positive_votes: 0,
      net_pl_usd: 0,
      tracked_casino_count: 0,
      claim_days: 0,
      successful_redemptions: 0,
      total_redemptions: 0,
    }), 4);
  });

  it('treats zero submission votes as a neutral 0.5 submission component', async () => {
    buildTrustQuerySequence({
      account: [{ created_at: '2026-01-01T00:00:00.000Z', claim_count: 0 }],
      submission: [{ total_signals: 0, worked_votes: 0, total_votes: 0 }],
      community: [{ net_positive_votes: 0 }],
      portfolio: [{
        net_pl_usd: 0,
        tracked_casino_count: 0,
        claim_days: 0,
        successful_redemptions: 0,
        total_redemptions: 0,
      }],
    });

    const score = await computeTrustScore('neutral-submissions');

    expect(score).toBeCloseTo(computeExpectedTrustScore({
      created_at: '2026-01-01T00:00:00.000Z',
      claim_count: 0,
      worked_votes: 0,
      total_votes: 0,
      net_positive_votes: 0,
      net_pl_usd: 0,
      tracked_casino_count: 0,
      claim_days: 0,
      successful_redemptions: 0,
      total_redemptions: 0,
    }), 4);
  });

  it('drops submission contribution when worked ratio is zero', async () => {
    buildTrustQuerySequence({
      account: [{ created_at: '2026-01-01T00:00:00.000Z', claim_count: 0 }],
      submission: [{ total_signals: 10, worked_votes: 0, total_votes: 10 }],
      community: [{ net_positive_votes: 0 }],
      portfolio: [{
        net_pl_usd: 0,
        tracked_casino_count: 0,
        claim_days: 0,
        successful_redemptions: 0,
        total_redemptions: 0,
      }],
    });

    const score = await computeTrustScore('bad-submissions');

    expect(score).toBeCloseTo(computeExpectedTrustScore({
      created_at: '2026-01-01T00:00:00.000Z',
      claim_count: 0,
      worked_votes: 0,
      total_votes: 10,
      net_positive_votes: 0,
      net_pl_usd: 0,
      tracked_casino_count: 0,
      claim_days: 0,
      successful_redemptions: 0,
      total_redemptions: 0,
    }), 4);
  });

  it('clamps community standing at zero for strongly negative net votes', async () => {
    buildTrustQuerySequence({
      account: [{ created_at: '2026-01-01T00:00:00.000Z', claim_count: 0 }],
      submission: [{ total_signals: 0, worked_votes: 0, total_votes: 0 }],
      community: [{ net_positive_votes: -20 }],
      portfolio: [{
        net_pl_usd: 0,
        tracked_casino_count: 0,
        claim_days: 0,
        successful_redemptions: 0,
        total_redemptions: 0,
      }],
    });

    const score = await computeTrustScore('negative-community');

    expect(score).toBeCloseTo(computeExpectedTrustScore({
      created_at: '2026-01-01T00:00:00.000Z',
      claim_count: 0,
      worked_votes: 0,
      total_votes: 0,
      net_positive_votes: -20,
      net_pl_usd: 0,
      tracked_casino_count: 0,
      claim_days: 0,
      successful_redemptions: 0,
      total_redemptions: 0,
    }), 4);
  });

  it('uses fallback redemption success for small portfolios', async () => {
    buildTrustQuerySequence({
      account: [{ created_at: '2025-12-01T00:00:00.000Z', claim_count: 25 }],
      submission: [{ total_signals: 0, worked_votes: 0, total_votes: 0 }],
      community: [{ net_positive_votes: 0 }],
      portfolio: [{
        net_pl_usd: 100,
        tracked_casino_count: 2,
        claim_days: 10,
        successful_redemptions: 1,
        total_redemptions: 1,
      }],
    });

    const score = await computeTrustScore('small-portfolio');

    expect(score).toBeCloseTo(computeExpectedTrustScore({
      created_at: '2025-12-01T00:00:00.000Z',
      claim_count: 25,
      worked_votes: 0,
      total_votes: 0,
      net_positive_votes: 0,
      net_pl_usd: 100,
      tracked_casino_count: 2,
      claim_days: 10,
      successful_redemptions: 1,
      total_redemptions: 1,
    }), 4);
  });

  it('handles null query values without producing NaN', async () => {
    buildTrustQuerySequence({
      account: [{ created_at: null, claim_count: null }],
      submission: [{ total_signals: null, worked_votes: null, total_votes: null }],
      community: [{ net_positive_votes: null }],
      portfolio: [{
        net_pl_usd: null,
        tracked_casino_count: null,
        claim_days: null,
        successful_redemptions: null,
        total_redemptions: null,
      }],
    });

    const score = await computeTrustScore('null-heavy-user');

    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeCloseTo(computeExpectedTrustScore({
      created_at: null,
      claim_count: null,
      worked_votes: null,
      total_votes: null,
      net_positive_votes: null,
      net_pl_usd: null,
      tracked_casino_count: null,
      claim_days: null,
      successful_redemptions: null,
      total_redemptions: null,
    }), 4);
  });

  it('clamps the final score to 1 when all components saturate', async () => {
    buildTrustQuerySequence({
      account: [{ created_at: '2020-01-01T00:00:00.000Z', claim_count: 500 }],
      submission: [{ total_signals: 50, worked_votes: 100, total_votes: 100 }],
      community: [{ net_positive_votes: 200 }],
      portfolio: [{
        net_pl_usd: 10000,
        tracked_casino_count: 50,
        claim_days: 365,
        successful_redemptions: 20,
        total_redemptions: 20,
      }],
    });

    const score = await computeTrustScore('max-user');

    expect(score).toBe(1);
  });
});

describe('trust score - pure computation', () => {
  it('normalizes activity from fresh to mature accounts', () => {
    expect(normalizeActivityScore(0, 0)).toBe(0);
    expect(normalizeActivityScore(90, 100)).toBe(1);
    expect(normalizeActivityScore(45, 50)).toBeCloseTo(0.5, 4);
  });

  it('normalizes submission score with a neutral fallback and vote ratio', () => {
    expect(normalizeSubmissionScore(0, 0)).toBe(0.5);
    expect(normalizeSubmissionScore(8, 10)).toBe(0.8);
    expect(normalizeSubmissionScore(0, 10)).toBe(0);
  });

  it('normalizes community score with offset-based clamping', () => {
    expect(normalizeCommunityScore(0)).toBe(0.5);
    expect(normalizeCommunityScore(5)).toBe(0.75);
    expect(normalizeCommunityScore(-20)).toBe(0);
    expect(normalizeCommunityScore(20)).toBe(1);
  });

  it('normalizes portfolio score with the current floor and maturity rules', () => {
    expect(
      normalizePortfolioScore({
        netPlUsd: 0,
        trackedCasinoCount: 0,
        claimDays: 0,
        successfulRedemptions: 0,
        totalRedemptions: 0,
      }),
    ).toBeCloseTo(0.25, 4);

    expect(
      normalizePortfolioScore({
        netPlUsd: 1000,
        trackedCasinoCount: 5,
        claimDays: 45,
        successfulRedemptions: 3,
        totalRedemptions: 3,
      }),
    ).toBe(1);

    expect(
      normalizePortfolioScore({
        netPlUsd: -1000,
        trackedCasinoCount: 2,
        claimDays: 10,
        successfulRedemptions: 1,
        totalRedemptions: 4,
      }),
    ).toBeCloseTo(0.298056, 4);
  });

  it('combines trust components with the current weights and clamps the output', () => {
    expect(combineTrustComponents(1, 1, 1, 1)).toBe(1);
    expect(combineTrustComponents(0, 0, 0, 0)).toBe(0);
    expect(combineTrustComponents(0.5, 0.8, 0.25, 1)).toBeCloseTo(0.7275, 4);
    expect(combineTrustComponents(2, 2, 2, 2)).toBe(1);
  });
});
