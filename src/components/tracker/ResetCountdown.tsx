import { DateTime } from 'luxon';

import { computeNextReset } from '../../lib/reset';

interface ResetCountdownProps {
  streakMode: string | null;
  resetTimeLocal: string | null;
  resetTimezone: string | null;
  lastClaimedAt: string | null;
  claimedToday: boolean;
  userTimezone: string;
  nowTs: number;
}

export default function ResetCountdown({
  streakMode,
  resetTimeLocal,
  resetTimezone,
  lastClaimedAt,
  claimedToday,
  userTimezone,
  nowTs,
}: ResetCountdownProps) {
  void nowTs;

  const summary = computeNextReset(
    {
      streak_mode: streakMode,
      reset_time_local: resetTimeLocal,
      reset_timezone: resetTimezone,
      last_claimed_at: lastClaimedAt,
    },
    userTimezone,
  );

  const nextResetLabel = summary?.label ?? 'Reset time unknown';

  let text = nextResetLabel;
  let tone = 'var(--color-muted)';

  if (!claimedToday && nextResetLabel === 'Available now') {
    text = 'Available now';
    tone = 'var(--color-success)';
  } else if (claimedToday && summary?.nextResetAt) {
    const next = DateTime.fromISO(summary.nextResetAt).setZone(userTimezone);
    if (next.isValid) {
      const minutes = Math.max(0, Math.ceil(next.diffNow('minutes').minutes));
      const hours = Math.floor(minutes / 60);
      const remainder = minutes % 60;
      text = `Next in ${hours}h ${remainder}m`;
    }
  } else if (!claimedToday && nextResetLabel !== 'Available now') {
    text = `Resets in ${nextResetLabel}`;
  }

  return <span style={{ color: tone, fontWeight: 700 }}>{text}</span>;
}
