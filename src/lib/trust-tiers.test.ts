import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./db');

import { query } from './db';
import { evaluateContributorTier } from './trust';

const mockQuery = vi.mocked(query);

describe('evaluateContributorTier', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns newcomer for a new user with no submissions', async () => {
    mockQuery
      .mockResolvedValueOnce([{
        current_tier: 'newcomer',
        total_submissions: 0,
        worked_ratio: 0,
        account_age_days: 2,
        submission_span_days: 0,
        last_10_ratio: null,
        last_15_ratio: null,
      }])
      .mockResolvedValueOnce([]);

    const tier = await evaluateContributorTier('new-user');

    expect(tier).toBe('newcomer');
  });

  it('promotes to scout only above the strict > 0.6 worked ratio threshold', async () => {
    mockQuery
      .mockResolvedValueOnce([{
        current_tier: 'newcomer',
        total_submissions: 5,
        worked_ratio: 0.61,
        account_age_days: 14,
        submission_span_days: 14,
        last_10_ratio: 0.61,
        last_15_ratio: 0.61,
      }])
      .mockResolvedValueOnce([]);

    const tier = await evaluateContributorTier('scout-user');

    expect(tier).toBe('scout');
  });

  it('does not promote to scout at exactly 0.60 worked ratio', async () => {
    mockQuery
      .mockResolvedValueOnce([{
        current_tier: 'newcomer',
        total_submissions: 5,
        worked_ratio: 0.6,
        account_age_days: 14,
        submission_span_days: 14,
        last_10_ratio: 0.6,
        last_15_ratio: 0.6,
      }])
      .mockResolvedValueOnce([]);

    const tier = await evaluateContributorTier('boundary-scout');

    expect(tier).toBe('newcomer');
  });

  it('promotes to insider when submission and span thresholds are met', async () => {
    mockQuery
      .mockResolvedValueOnce([{
        current_tier: 'scout',
        total_submissions: 20,
        worked_ratio: 0.71,
        account_age_days: 60,
        submission_span_days: 30,
        last_10_ratio: 0.71,
        last_15_ratio: 0.71,
      }])
      .mockResolvedValueOnce([]);

    const tier = await evaluateContributorTier('insider-user');

    expect(tier).toBe('insider');
  });

  it('keeps operator unchanged without querying update thresholds', async () => {
    mockQuery.mockResolvedValueOnce([{
      current_tier: 'operator',
      total_submissions: 100,
      worked_ratio: 1,
      account_age_days: 365,
      submission_span_days: 300,
      last_10_ratio: 1,
      last_15_ratio: 1,
    }]);

    const tier = await evaluateContributorTier('operator-user');

    expect(tier).toBe('operator');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('demotes insider to scout when last 15 ratio drops below 0.5', async () => {
    mockQuery
      .mockResolvedValueOnce([{
        current_tier: 'insider',
        total_submissions: 40,
        worked_ratio: 0.8,
        account_age_days: 100,
        submission_span_days: 60,
        last_10_ratio: 0.7,
        last_15_ratio: 0.49,
      }])
      .mockResolvedValueOnce([]);

    const tier = await evaluateContributorTier('slipping-insider');

    expect(tier).toBe('scout');
  });

  it('demotes scout to newcomer when last 10 ratio drops below 0.4', async () => {
    mockQuery
      .mockResolvedValueOnce([{
        current_tier: 'scout',
        total_submissions: 8,
        worked_ratio: 0.7,
        account_age_days: 40,
        submission_span_days: 20,
        last_10_ratio: 0.39,
        last_15_ratio: 0.39,
      }])
      .mockResolvedValueOnce([]);

    const tier = await evaluateContributorTier('slipping-scout');

    expect(tier).toBe('newcomer');
  });

  it('returns null when the user_settings row is missing', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const tier = await evaluateContributorTier('missing-user');

    expect(tier).toBeNull();
  });
});
