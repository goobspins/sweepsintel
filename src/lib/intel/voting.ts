import { query, transaction } from '../db';

const CONDITIONAL_MIN_TOTAL_VOTES = 4;
const LIKELY_OUTDATED_MIN_TOTAL_VOTES = 8;
const LIKELY_OUTDATED_NEGATIVE_RATIO = 0.8;
const COLLAPSED_MIN_TOTAL_VOTES = 12;
const COLLAPSED_NEGATIVE_RATIO = 0.9;

export type SignalVote = 'worked' | 'didnt_work';

export async function updateSignalStatus(signalId: number) {
  const rows = await query<{
    worked_count: number | string | null;
    didnt_work_count: number | string | null;
  }>(
    `SELECT worked_count, didnt_work_count
    FROM discord_intel_items
    WHERE id = $1
    LIMIT 1`,
    [signalId],
  );
  const row = rows[0];
  if (!row) return null;

  const worked = Number(row.worked_count ?? 0);
  const didntWork = Number(row.didnt_work_count ?? 0);
  const total = worked + didntWork;
  const negativeRatio = total > 0 ? didntWork / total : 0;
  let signalStatus = 'active';

  if (total >= COLLAPSED_MIN_TOTAL_VOTES && negativeRatio >= COLLAPSED_NEGATIVE_RATIO) {
    signalStatus = 'collapsed';
  } else if (total >= LIKELY_OUTDATED_MIN_TOTAL_VOTES && negativeRatio >= LIKELY_OUTDATED_NEGATIVE_RATIO) {
    signalStatus = 'likely_outdated';
  } else if (worked > 0 && didntWork > 0 && total >= CONDITIONAL_MIN_TOTAL_VOTES) {
    signalStatus = 'conditional';
  }

  await query(
    `UPDATE discord_intel_items
    SET signal_status = $2
    WHERE id = $1`,
    [signalId, signalStatus],
  );

  return signalStatus;
}

export async function voteOnSignal(signalId: number, userId: string, vote: SignalVote) {
  return transaction(async (tx) => {
    await tx.query(
      `INSERT INTO signal_votes (signal_id, user_id, vote)
      VALUES ($1, $2, $3)
      ON CONFLICT (signal_id, user_id)
      DO UPDATE SET vote = EXCLUDED.vote, created_at = NOW()`,
      [signalId, userId, vote],
    );

    const updatedRows = await tx.query<{
      worked_count: number | string | null;
      didnt_work_count: number | string | null;
    }>(
      `UPDATE discord_intel_items
      SET worked_count = (
            SELECT COUNT(*)::int
            FROM signal_votes
            WHERE signal_id = $1 AND vote = 'worked'
          ),
          didnt_work_count = (
            SELECT COUNT(*)::int
            FROM signal_votes
            WHERE signal_id = $1 AND vote = 'didnt_work'
          )
      WHERE id = $1
      RETURNING worked_count, didnt_work_count`,
      [signalId],
    );

    const counts = updatedRows[0] ?? { worked_count: 0, didnt_work_count: 0 };
    const signalStatus = await updateSignalStatus(signalId);

    return {
      worked_count: Number(counts.worked_count ?? 0),
      didnt_work_count: Number(counts.didnt_work_count ?? 0),
      signal_status: signalStatus ?? 'active',
    };
  });
}
