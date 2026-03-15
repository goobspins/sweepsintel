import { DateTime } from 'luxon';

export interface ResetCasinoInput {
  name?: string;
  reset_mode?: string | null;
  reset_time_local?: string | null;
  reset_timezone?: string | null;
  reset_interval_hours?: number | null;
  last_claimed_at?: string | Date | null;
}

export interface ResetSummary {
  label: string;
  nextResetAt: string | null;
}

export function computeNextReset(
  casino: ResetCasinoInput,
  userTimezone: string,
): ResetSummary | null {
  if (casino.reset_mode === 'fixed') {
    if (!casino.reset_time_local || !casino.reset_timezone) {
      return null;
    }

    const [hour, minute] = casino.reset_time_local.split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }

    const nowInResetZone = DateTime.now().setZone(casino.reset_timezone);
    if (!nowInResetZone.isValid) {
      return null;
    }

    let nextReset = nowInResetZone.set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    });

    if (nowInResetZone >= nextReset) {
      nextReset = nextReset.plus({ days: 1 });
    }

    return {
      label: formatCountdown(nextReset.diffNow(['hours', 'minutes']).toObject()),
      nextResetAt: nextReset.setZone(userTimezone).toISO(),
    };
  }

  if (casino.reset_mode === 'rolling') {
    if (!casino.last_claimed_at) {
      return { label: 'Available now', nextResetAt: null };
    }

    const nextReset = DateTime.fromJSDate(new Date(casino.last_claimed_at), {
      zone: userTimezone,
    }).plus({ hours: casino.reset_interval_hours ?? 24 });

    if (!nextReset.isValid) {
      return null;
    }

    if (nextReset <= DateTime.now().setZone(userTimezone)) {
      return { label: 'Available now', nextResetAt: nextReset.toISO() };
    }

    return {
      label: formatCountdown(nextReset.diffNow(['hours', 'minutes']).toObject()),
      nextResetAt: nextReset.toISO(),
    };
  }

  return null;
}

function formatCountdown(duration: {
  hours?: number;
  minutes?: number;
}) {
  const hours = Math.max(0, Math.floor(duration.hours ?? 0));
  const minutes = Math.max(0, Math.floor(duration.minutes ?? 0));

  if (hours === 0 && minutes === 0) {
    return 'Available now';
  }

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}
