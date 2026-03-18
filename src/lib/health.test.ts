import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./db');
vi.mock('./cache');

import { getCached } from './cache';
import { query, transaction } from './db';
import {
  computeCoolDownDays,
  computeDisputeFactor,
  computeAllCasinoHealth,
  healthSeverity,
  isRecoveryEligible,
  computePersonalEscalation,
  computeRedemptionTrendScore,
  computeWarningDecayWeight,
  getCasinoHealthForUser,
  mapScoreToHealthStatus,
  resolveHealthTransition,
} from './health';

const mockQuery = vi.mocked(query);
const mockTransaction = vi.mocked(transaction);
const mockGetCached = vi.mocked(getCached);

function setupHealthCompute({
  warnings,
  trends,
  casinos,
  currentHealth = [],
  newNegatives = [],
}: {
  warnings: Array<Record<string, unknown>>;
  trends: Array<Record<string, unknown>>;
  casinos: Array<Record<string, unknown>>;
  currentHealth?: Array<Record<string, unknown>>;
  newNegatives?: Array<Record<string, unknown>>;
}) {
  const txQuery = vi.fn().mockResolvedValue([]);
  mockQuery
    .mockResolvedValueOnce(warnings)
    .mockResolvedValueOnce(trends)
    .mockResolvedValueOnce(casinos)
    .mockResolvedValueOnce(currentHealth)
    .mockResolvedValueOnce(newNegatives);
  mockTransaction.mockImplementationOnce(async (handler) =>
    handler({ query: txQuery }),
  );
  return txQuery;
}

describe('computeAllCasinoHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T00:00:00.000Z'));
    mockQuery.mockReset();
    mockTransaction.mockReset();
    mockGetCached.mockReset();
  });

  it('treats active warnings as full weight and promotes to watch at score 1.5+', async () => {
    const txQuery = setupHealthCompute({
      warnings: [
        {
          casino_id: 1,
          title: 'Warning 1',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T23:00:00.000Z',
        },
        {
          casino_id: 1,
          title: 'Warning 2',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T22:00:00.000Z',
        },
      ],
      trends: [],
      casinos: [{ id: 1 }],
    });

    await computeAllCasinoHealth();

    expect(txQuery).toHaveBeenCalledTimes(1);
    expect(txQuery.mock.calls[0]?.[1]).toEqual([
      1,
      'watch',
      '2 warning signals',
      2,
      null,
      'watch',
      expect.any(Date),
      expect.any(Date),
    ]);
  });

  it('decays warnings to 0.75 within 24 hours after expiry', async () => {
    const txQuery = setupHealthCompute({
      warnings: [
        {
          casino_id: 1,
          title: 'Expired recently',
          expires_at: '2026-03-16T12:00:00.000Z',
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T00:00:00.000Z',
        },
        {
          casino_id: 1,
          title: 'Active',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T23:00:00.000Z',
        },
      ],
      trends: [],
      casinos: [{ id: 1 }],
    });

    await computeAllCasinoHealth();

    expect(txQuery.mock.calls[0]?.[1]?.[1]).toBe('watch');
  });

  it('decays warnings to 0.5 in the 24-48 hour window', async () => {
    const txQuery = setupHealthCompute({
      warnings: [
        {
          casino_id: 1,
          title: 'Expired 36h ago',
          expires_at: '2026-03-15T12:00:00.000Z',
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-15T00:00:00.000Z',
        },
        {
          casino_id: 1,
          title: 'Active',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T23:00:00.000Z',
        },
      ],
      trends: [],
      casinos: [{ id: 1 }],
    });

    await computeAllCasinoHealth();

    expect(txQuery.mock.calls[0]?.[1]?.[1]).toBe('watch');
  });

  it('decays warnings to 0.25 in the 48-72 hour window', async () => {
    const txQuery = setupHealthCompute({
      warnings: [
        {
          casino_id: 1,
          title: 'Expired 60h ago',
          expires_at: '2026-03-14T12:00:00.000Z',
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-14T00:00:00.000Z',
        },
        {
          casino_id: 1,
          title: 'Active',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T23:00:00.000Z',
        },
      ],
      trends: [],
      casinos: [{ id: 1 }],
    });

    await computeAllCasinoHealth();

    expect(txQuery.mock.calls[0]?.[1]?.[1]).toBe('healthy');
  });

  it('drops warning weight to zero after 72 hours', async () => {
    const txQuery = setupHealthCompute({
      warnings: [
        {
          casino_id: 1,
          title: 'Expired too long ago',
          expires_at: '2026-03-13T00:00:00.000Z',
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-12T00:00:00.000Z',
        },
      ],
      trends: [],
      casinos: [{ id: 1 }],
    });

    await computeAllCasinoHealth();

    expect(txQuery.mock.calls[0]?.[1]).toEqual([
      1,
      'healthy',
      'No active warnings detected.',
      0,
      null,
      'healthy',
      null,
      null,
    ]);
  });

  it('applies dispute factor reduction when a warning has 3+ votes', async () => {
    const txQuery = setupHealthCompute({
      warnings: [
        {
          casino_id: 1,
          title: 'Mixed warning',
          expires_at: null,
          worked_count: 2,
          didnt_work_count: 2,
          signal_status: 'active',
          created_at: '2026-03-16T23:00:00.000Z',
        },
        {
          casino_id: 1,
          title: 'Active',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T22:00:00.000Z',
        },
      ],
      trends: [],
      casinos: [{ id: 1 }],
    });

    await computeAllCasinoHealth();

    expect(txQuery.mock.calls[0]?.[1]?.[1]).toBe('watch');
  });

  it('adds one point for a 1.5x redemption slowdown', async () => {
    const txQuery = setupHealthCompute({
      warnings: [],
      trends: [{ casino_id: 1, trend_ratio: 1.5 }],
      casinos: [{ id: 1 }],
    });

    await computeAllCasinoHealth();

    expect(txQuery.mock.calls[0]?.[1]).toEqual([
      1,
      'healthy',
      'redemptions trending 1.50x slower',
      0,
      1.5,
      'healthy',
      null,
      null,
    ]);
  });

  it('adds two points for a 2x redemption slowdown', async () => {
    const txQuery = setupHealthCompute({
      warnings: [],
      trends: [{ casino_id: 1, trend_ratio: 2 }],
      casinos: [{ id: 1 }],
    });

    await computeAllCasinoHealth();

    expect(txQuery.mock.calls[0]?.[1]).toEqual([
      1,
      'watch',
      'redemptions trending 2.00x slower',
      0,
      2,
      'watch',
      expect.any(Date),
      expect.any(Date),
    ]);
  });

  it('maps score thresholds to watch, at_risk, and critical', async () => {
    const txQuery = setupHealthCompute({
      warnings: [
        {
          casino_id: 1,
          title: 'W1',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T23:00:00.000Z',
        },
        {
          casino_id: 1,
          title: 'W2',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T22:00:00.000Z',
        },
        {
          casino_id: 2,
          title: 'A1',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T23:00:00.000Z',
        },
        {
          casino_id: 2,
          title: 'A2',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T22:00:00.000Z',
        },
        {
          casino_id: 2,
          title: 'A3',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T21:00:00.000Z',
        },
        {
          casino_id: 3,
          title: 'C1',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T23:00:00.000Z',
        },
        {
          casino_id: 3,
          title: 'C2',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T22:00:00.000Z',
        },
        {
          casino_id: 3,
          title: 'C3',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T21:00:00.000Z',
        },
        {
          casino_id: 3,
          title: 'C4',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T20:00:00.000Z',
        },
        {
          casino_id: 3,
          title: 'C5',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T19:00:00.000Z',
        },
      ],
      trends: [],
      casinos: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });

    await computeAllCasinoHealth();

    expect(txQuery.mock.calls[0]?.[1]?.[1]).toBe('watch');
    expect(txQuery.mock.calls[1]?.[1]?.[1]).toBe('at_risk');
    expect(txQuery.mock.calls[2]?.[1]?.[1]).toBe('critical');
  });

  it('keeps a downgraded effective status sticky when the recommended status improves before cooldown expiry', async () => {
    const txQuery = setupHealthCompute({
      warnings: [
        {
          casino_id: 1,
          title: 'Decayed warning',
          expires_at: '2026-03-14T12:00:00.000Z',
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-13T12:00:00.000Z',
        },
        {
          casino_id: 1,
          title: 'Active warning',
          expires_at: null,
          worked_count: 0,
          didnt_work_count: 0,
          signal_status: 'active',
          created_at: '2026-03-16T23:00:00.000Z',
        },
      ],
      trends: [],
      casinos: [{ id: 1 }],
      currentHealth: [{
        casino_id: 1,
        global_status: 'at_risk',
        effective_status: 'at_risk',
        health_downgraded_at: '2026-03-10T00:00:00.000Z',
        health_recovery_eligible_at: '2026-04-09T00:00:00.000Z',
      }],
      newNegatives: [],
    });

    await computeAllCasinoHealth();

    expect(txQuery.mock.calls[0]?.[1]).toEqual([
      1,
      'healthy',
      '2 warning signals',
      2,
      null,
      'at_risk',
      new Date('2026-03-10T00:00:00.000Z'),
      new Date('2026-04-09T00:00:00.000Z'),
    ]);
  });

  it('upgrades effective status after cooldown expires when there are no new negatives', async () => {
    const txQuery = setupHealthCompute({
      warnings: [],
      trends: [],
      casinos: [{ id: 1 }],
      currentHealth: [{
        casino_id: 1,
        global_status: 'watch',
        effective_status: 'watch',
        health_downgraded_at: '2026-03-01T00:00:00.000Z',
        health_recovery_eligible_at: '2026-03-02T00:00:00.000Z',
      }],
      newNegatives: [],
    });

    await computeAllCasinoHealth();

    expect(txQuery.mock.calls[0]?.[1]).toEqual([
      1,
      'healthy',
      'No active warnings detected.',
      0,
      null,
      'healthy',
      null,
      null,
    ]);
  });
});

describe('getCasinoHealthForUser', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T00:00:00.000Z'));
    mockQuery.mockReset();
    mockTransaction.mockReset();
    mockGetCached.mockReset();
  });

  it('returns base health with no personal escalation when exposure is low', async () => {
    mockQuery
      .mockResolvedValueOnce([{
        casino_id: 1,
        global_status: 'healthy',
        effective_status: 'healthy',
        status_reason: 'No active warnings detected.',
        active_warning_count: 0,
        redemption_trend: null,
        last_computed_at: '2026-03-17T00:00:00.000Z',
        admin_override_status: null,
        admin_override_reason: null,
        admin_override_at: null,
        health_downgraded_at: null,
        health_recovery_eligible_at: null,
      }])
      .mockResolvedValueOnce([{
        pending_redemptions_count: 0,
        pending_redemptions_usd: 0,
        sc_exposure: 120,
      }])
      .mockResolvedValueOnce([]);

    const result = await getCasinoHealthForUser(1, 'user-1');

    expect(result?.personal_status).toBe('healthy');
    expect(result?.exposure_reason).toBeNull();
    expect(result?.effective_status).toBe('healthy');
  });

  it('escalates by one level when the user has a pending redemption', async () => {
    mockQuery
      .mockResolvedValueOnce([{
        casino_id: 1,
        global_status: 'healthy',
        effective_status: 'healthy',
        status_reason: '1 warning signal',
        active_warning_count: 1,
        redemption_trend: null,
        last_computed_at: '2026-03-17T00:00:00.000Z',
        admin_override_status: null,
        admin_override_reason: null,
        admin_override_at: null,
        health_downgraded_at: null,
        health_recovery_eligible_at: null,
      }])
      .mockResolvedValueOnce([{
        pending_redemptions_count: 1,
        pending_redemptions_usd: 50,
        sc_exposure: 10,
      }])
      .mockResolvedValueOnce([]);

    const result = await getCasinoHealthForUser(1, 'user-1');

    expect(result?.personal_status).toBe('watch');
    expect(result?.exposure_reason).toContain('1 pending redemption');
  });

  it('escalates watch to at_risk when sc exposure crosses 250', async () => {
    mockQuery
      .mockResolvedValueOnce([{
        casino_id: 1,
        global_status: 'watch',
        effective_status: 'watch',
        status_reason: '2 warning signals',
        active_warning_count: 2,
        redemption_trend: null,
        last_computed_at: '2026-03-17T00:00:00.000Z',
        admin_override_status: null,
        admin_override_reason: null,
        admin_override_at: null,
        health_downgraded_at: null,
        health_recovery_eligible_at: null,
      }])
      .mockResolvedValueOnce([{
        pending_redemptions_count: 0,
        pending_redemptions_usd: 0,
        sc_exposure: 300,
      }])
      .mockResolvedValueOnce([]);

    const result = await getCasinoHealthForUser(1, 'user-1');

    expect(result?.personal_status).toBe('at_risk');
    expect(result?.exposure_reason).toContain('300.00 SC exposed');
  });

  it('uses admin override status before applying personal escalation', async () => {
    mockQuery
      .mockResolvedValueOnce([{
        casino_id: 1,
        global_status: 'healthy',
        effective_status: 'watch',
        status_reason: 'No active warnings detected.',
        active_warning_count: 0,
        redemption_trend: null,
        last_computed_at: '2026-03-17T00:00:00.000Z',
        admin_override_status: 'critical',
        admin_override_reason: 'Admin pinned',
        admin_override_at: '2026-03-16T00:00:00.000Z',
        health_downgraded_at: '2026-03-15T00:00:00.000Z',
        health_recovery_eligible_at: '2026-04-14T00:00:00.000Z',
      }])
      .mockResolvedValueOnce([{
        pending_redemptions_count: 0,
        pending_redemptions_usd: 0,
        sc_exposure: 0,
      }])
      .mockResolvedValueOnce([{
        id: 4,
        title: 'Recent warning',
        content: 'Cashouts delayed',
        created_at: '2026-03-16T12:00:00.000Z',
        expires_at: null,
        worked_count: '2',
        didnt_work_count: '1',
        signal_status: null,
      }]);

    const result = await getCasinoHealthForUser(1, 'user-1');

    expect(result?.personal_status).toBe('critical');
    expect(result?.warning_signals).toEqual([{
      id: 4,
      title: 'Recent warning',
      content: 'Cashouts delayed',
      created_at: '2026-03-16T12:00:00.000Z',
      expires_at: null,
      worked_count: 2,
      didnt_work_count: 1,
      signal_status: 'active',
    }]);
  });

  it('returns null when no base health row exists', async () => {
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getCasinoHealthForUser(1, 'user-1');

    expect(result).toBeNull();
  });
});

describe('health - pure computation', () => {
  it('computes warning decay weights across the current age brackets', () => {
    expect(computeWarningDecayWeight(-1)).toBe(1);
    expect(computeWarningDecayWeight(0)).toBe(1);
    expect(computeWarningDecayWeight(12)).toBe(0.75);
    expect(computeWarningDecayWeight(24)).toBe(0.75);
    expect(computeWarningDecayWeight(24.1)).toBe(0.5);
    expect(computeWarningDecayWeight(48)).toBe(0.5);
    expect(computeWarningDecayWeight(48.1)).toBe(0.25);
    expect(computeWarningDecayWeight(72)).toBe(0.25);
    expect(computeWarningDecayWeight(72.1)).toBe(0);
  });

  it('computes dispute factor using the current floor and vote threshold', () => {
    expect(computeDisputeFactor(0, 0)).toBe(1);
    expect(computeDisputeFactor(1, 1)).toBe(1);
    expect(computeDisputeFactor(2, 2)).toBe(0.5);
    expect(computeDisputeFactor(0, 4)).toBe(0.35);
  });

  it('computes redemption trend score from the current ratio thresholds', () => {
    expect(computeRedemptionTrendScore(0, 0)).toBe(0);
    expect(computeRedemptionTrendScore(7, 7)).toBe(0);
    expect(computeRedemptionTrendScore(10.5, 7)).toBe(1);
    expect(computeRedemptionTrendScore(14, 7)).toBe(2);
  });

  it('maps composite scores to health statuses at the current boundaries', () => {
    expect(mapScoreToHealthStatus(0)).toBe('healthy');
    expect(mapScoreToHealthStatus(1.49)).toBe('healthy');
    expect(mapScoreToHealthStatus(1.5)).toBe('watch');
    expect(mapScoreToHealthStatus(2.99)).toBe('watch');
    expect(mapScoreToHealthStatus(3)).toBe('at_risk');
    expect(mapScoreToHealthStatus(4.99)).toBe('at_risk');
    expect(mapScoreToHealthStatus(5)).toBe('critical');
  });

  it('computes personal escalation with the current pending and exposure thresholds', () => {
    expect(computePersonalEscalation('healthy', 0, 0)).toBe('healthy');
    expect(computePersonalEscalation('healthy', 1, 0)).toBe('watch');
    expect(computePersonalEscalation('watch', 0, 250)).toBe('at_risk');
    expect(computePersonalEscalation('at_risk', 1, 0)).toBe('critical');
    expect(computePersonalEscalation('critical', 0, 300)).toBe('critical');
  });

  it('maps health severity ordering from healthy to critical', () => {
    expect(healthSeverity('healthy')).toBe(0);
    expect(healthSeverity('watch')).toBe(1);
    expect(healthSeverity('at_risk')).toBe(2);
    expect(healthSeverity('critical')).toBe(3);
  });

  it('computes cooldown days by health status', () => {
    expect(computeCoolDownDays('healthy')).toBe(0);
    expect(computeCoolDownDays('watch')).toBe(14);
    expect(computeCoolDownDays('at_risk')).toBe(30);
    expect(computeCoolDownDays('critical')).toBe(60);
  });

  it('checks recovery eligibility from severity and cooldown timing', () => {
    const now = new Date('2026-03-17T00:00:00.000Z');
    expect(isRecoveryEligible('watch', 'watch', new Date('2026-03-01T00:00:00.000Z'), now)).toBe(false);
    expect(isRecoveryEligible('watch', 'at_risk', new Date('2026-03-01T00:00:00.000Z'), now)).toBe(false);
    expect(isRecoveryEligible('watch', 'healthy', null, now)).toBe(false);
    expect(isRecoveryEligible('watch', 'healthy', new Date('2026-03-18T00:00:00.000Z'), now)).toBe(false);
    expect(isRecoveryEligible('watch', 'healthy', new Date('2026-03-16T00:00:00.000Z'), now)).toBe(true);
  });

  it('resolves immediate downgrades, sticky holds, and eligible recoveries', () => {
    const now = new Date('2026-03-17T00:00:00.000Z');

    expect(resolveHealthTransition({
      currentEffective: 'healthy',
      recommended: 'watch',
      currentDowngradedAt: null,
      currentRecoveryEligibleAt: null,
      hasNewNegativesSinceDowngrade: false,
      now,
    })).toEqual({
      newEffective: 'watch',
      downgradeAt: now,
      recoveryEligibleAt: new Date('2026-03-31T00:00:00.000Z'),
    });

    const stickyResult = resolveHealthTransition({
      currentEffective: 'at_risk',
      recommended: 'watch',
      currentDowngradedAt: new Date('2026-03-10T00:00:00.000Z'),
      currentRecoveryEligibleAt: new Date('2026-03-30T00:00:00.000Z'),
      hasNewNegativesSinceDowngrade: false,
      now,
    });
    expect(stickyResult).toEqual({
      newEffective: 'at_risk',
      downgradeAt: new Date('2026-03-10T00:00:00.000Z'),
      recoveryEligibleAt: new Date('2026-03-30T00:00:00.000Z'),
    });

    const blockedByNegatives = resolveHealthTransition({
      currentEffective: 'watch',
      recommended: 'healthy',
      currentDowngradedAt: new Date('2026-03-01T00:00:00.000Z'),
      currentRecoveryEligibleAt: new Date('2026-03-02T00:00:00.000Z'),
      hasNewNegativesSinceDowngrade: true,
      now,
    });
    expect(blockedByNegatives).toEqual({
      newEffective: 'watch',
      downgradeAt: new Date('2026-03-01T00:00:00.000Z'),
      recoveryEligibleAt: new Date('2026-03-02T00:00:00.000Z'),
    });

    expect(resolveHealthTransition({
      currentEffective: 'watch',
      recommended: 'healthy',
      currentDowngradedAt: new Date('2026-03-01T00:00:00.000Z'),
      currentRecoveryEligibleAt: new Date('2026-03-02T00:00:00.000Z'),
      hasNewNegativesSinceDowngrade: false,
      now,
    })).toEqual({
      newEffective: 'healthy',
      downgradeAt: null,
      recoveryEligibleAt: null,
    });

    expect(resolveHealthTransition({
      currentEffective: 'watch',
      recommended: 'critical',
      currentDowngradedAt: new Date('2026-03-01T00:00:00.000Z'),
      currentRecoveryEligibleAt: new Date('2026-03-15T00:00:00.000Z'),
      hasNewNegativesSinceDowngrade: true,
      now,
    })).toEqual({
      newEffective: 'critical',
      downgradeAt: now,
      recoveryEligibleAt: new Date('2026-05-16T00:00:00.000Z'),
    });
  });
});
