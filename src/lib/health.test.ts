import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./db');
vi.mock('./cache');

import { getCached } from './cache';
import { query, transaction } from './db';
import {
  computeAllCasinoHealth,
  getCasinoHealthForUser,
} from './health';

const mockQuery = vi.mocked(query);
const mockTransaction = vi.mocked(transaction);
const mockGetCached = vi.mocked(getCached);

function setupHealthCompute({
  warnings,
  trends,
  casinos,
}: {
  warnings: Array<Record<string, unknown>>;
  trends: Array<Record<string, unknown>>;
  casinos: Array<Record<string, unknown>>;
}) {
  const txQuery = vi.fn().mockResolvedValue([]);
  mockQuery
    .mockResolvedValueOnce(warnings)
    .mockResolvedValueOnce(trends)
    .mockResolvedValueOnce(casinos);
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
        status_reason: 'No active warnings detected.',
        active_warning_count: 0,
        redemption_trend: null,
        last_computed_at: '2026-03-17T00:00:00.000Z',
        admin_override_status: null,
        admin_override_reason: null,
        admin_override_at: null,
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
  });

  it('escalates by one level when the user has a pending redemption', async () => {
    mockQuery
      .mockResolvedValueOnce([{
        casino_id: 1,
        global_status: 'healthy',
        status_reason: '1 warning signal',
        active_warning_count: 1,
        redemption_trend: null,
        last_computed_at: '2026-03-17T00:00:00.000Z',
        admin_override_status: null,
        admin_override_reason: null,
        admin_override_at: null,
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
        status_reason: '2 warning signals',
        active_warning_count: 2,
        redemption_trend: null,
        last_computed_at: '2026-03-17T00:00:00.000Z',
        admin_override_status: null,
        admin_override_reason: null,
        admin_override_at: null,
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
        status_reason: 'No active warnings detected.',
        active_warning_count: 0,
        redemption_trend: null,
        last_computed_at: '2026-03-17T00:00:00.000Z',
        admin_override_status: 'critical',
        admin_override_reason: 'Admin pinned',
        admin_override_at: '2026-03-16T00:00:00.000Z',
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
