import { query, type TransactionClient } from './db';

export type NotificationSegment =
  | { kind: 'all' }
  | { kind: 'state'; stateCode: string }
  | { kind: 'casino'; casinoId: number };

interface NotificationPayload {
  notificationType: 'state_pullout' | 'ban_uptick' | 'system';
  title: string;
  message: string;
  actionUrl?: string | null;
  casinoId?: number | null;
  stateCode?: string | null;
}

function buildInsertSql(segment: NotificationSegment) {
  if (segment.kind === 'all') {
    return {
      sql: `INSERT INTO user_notifications (
        user_id,
        notification_type,
        casino_id,
        state_code,
        title,
        message,
        action_url
      )
      SELECT
        us.user_id,
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      FROM user_settings us`,
      params: [] as unknown[],
    };
  }

  if (segment.kind === 'state') {
    return {
      sql: `INSERT INTO user_notifications (
        user_id,
        notification_type,
        casino_id,
        state_code,
        title,
        message,
        action_url
      )
      SELECT
        uss.user_id,
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      FROM user_state_subscriptions uss
      WHERE uss.state_code = $7`,
      params: [segment.stateCode],
    };
  }

  return {
    sql: `INSERT INTO user_notifications (
      user_id,
      notification_type,
      casino_id,
      state_code,
      title,
      message,
      action_url
    )
    SELECT DISTINCT
      ucs.user_id,
      $1,
      $2,
      $3,
      $4,
      $5,
      $6
    FROM user_casino_settings ucs
    WHERE ucs.casino_id = $7
      AND ucs.removed_at IS NULL`,
    params: [segment.casinoId],
  };
}

export async function createNotificationsForSegment(
  segment: NotificationSegment,
  payload: NotificationPayload,
  tx?: TransactionClient,
) {
  const { sql, params } = buildInsertSql(segment);
  const fullParams = [
    payload.notificationType,
    payload.casinoId ?? null,
    payload.stateCode ?? null,
    payload.title,
    payload.message,
    payload.actionUrl ?? null,
    ...params,
  ];

  if (tx) {
    await tx.query(sql, fullParams);
    return;
  }

  await query(sql, fullParams);
}

