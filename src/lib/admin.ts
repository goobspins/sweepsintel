import { createNotificationsForSegment } from './notifications';
import { query, transaction } from './db';

export async function createAdminFlag(input: {
  source: string;
  flagType: string;
  flagContent: string;
  casinoId?: number | null;
  stateCode?: string | null;
  aiSummary?: string | null;
  proposedAction?: string | null;
}) {
  const rows = await query<{ id: number }>(
    `INSERT INTO admin_flags (
      source,
      flag_type,
      casino_id,
      state_code,
      flag_content,
      ai_summary,
      proposed_action
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
    [
      input.source,
      input.flagType,
      input.casinoId ?? null,
      input.stateCode ?? null,
      input.flagContent,
      input.aiSummary ?? null,
      input.proposedAction ?? null,
    ],
  );

  return rows[0]?.id ?? null;
}

export async function markFlagStatus(input: {
  flagId: number;
  status: 'actioned' | 'dismissed';
  userId: string;
  note?: string | null;
}) {
  await query(
    `UPDATE admin_flags
    SET status = $1,
        actioned_at = NOW(),
        actioned_by = $2,
        proposed_action = CASE
          WHEN $3 IS NULL OR $3 = '' THEN proposed_action
          WHEN proposed_action IS NULL OR proposed_action = '' THEN $3
          ELSE proposed_action || E'\nAdmin note: ' || $3
        END
    WHERE id = $4`,
    [input.status, input.userId, input.note ?? null, input.flagId],
  );
}

export async function runCasinoPulloutFlow(input: {
  casinoId: number;
  stateCode: string;
  status: 'available' | 'restricted' | 'legal_but_pulled_out' | 'operates_despite_restrictions';
  message: string;
  actionUrl?: string | null;
}) {
  const result = await transaction(async (tx) => {
    await tx.query(
      `INSERT INTO casino_state_availability (
        casino_id,
        state_code,
        status,
        verified,
        last_updated_at
      ) VALUES ($1, $2, $3, true, NOW())
      ON CONFLICT (casino_id, state_code)
      DO UPDATE SET
        status = EXCLUDED.status,
        verified = true,
        last_updated_at = NOW()`,
      [input.casinoId, input.stateCode, input.status],
    );

    const alertRows = await tx.query<{ id: number }>(
      `INSERT INTO state_pullout_alerts (
        casino_id,
        state_code,
        alert_message
      ) VALUES ($1, $2, $3)
      RETURNING id`,
      [input.casinoId, input.stateCode, input.message],
    );

    return { alertId: alertRows[0].id };
  });

  try {
    await createNotificationsForSegment(
      { kind: 'state', stateCode: input.stateCode },
      {
        notificationType: 'state_pullout',
        casinoId: input.casinoId,
        stateCode: input.stateCode,
        title: 'State Pullout Alert',
        message: input.message,
        actionUrl: input.actionUrl ?? null,
      },
    );
  } catch (error) {
    console.error('state pullout notification fan-out failed', error);
  }

  return result;
}

export async function runProviderCascadeFlow(input: {
  providerId: number;
  providerName: string;
  stateCode: string;
  status: 'available' | 'restricted' | 'legal_but_pulled_out' | 'operates_despite_restrictions';
}) {
  return transaction(async (tx) => {
    await tx.query(
      `INSERT INTO provider_state_availability (
        provider_id,
        state_code,
        status,
        last_updated_at
      ) VALUES ($1, $2, $3, NOW())
      ON CONFLICT (provider_id, state_code)
      DO UPDATE SET
        status = EXCLUDED.status,
        last_updated_at = NOW()`,
      [input.providerId, input.stateCode, input.status],
    );

    const affected = await tx.query<{ casino_id: number; name: string }>(
      `SELECT DISTINCT c.id AS casino_id, c.name
      FROM casino_live_game_providers clgp
      JOIN casinos c ON c.id = clgp.casino_id
      WHERE clgp.provider_id = $1`,
      [input.providerId],
    );

    if (input.status === 'restricted') {
      for (const casino of affected) {
        await tx.query(
          `INSERT INTO casino_state_availability (
            casino_id,
            state_code,
            status,
            verified,
            last_updated_at
          ) VALUES ($1, $2, 'legal_but_pulled_out', true, NOW())
          ON CONFLICT (casino_id, state_code)
          DO UPDATE SET
            status = 'legal_but_pulled_out',
            verified = true,
            last_updated_at = NOW()`,
          [casino.casino_id, input.stateCode],
        );
      }

      await tx.query(
        `INSERT INTO state_pullout_alerts (
          provider_id,
          state_code,
          alert_message
        ) VALUES ($1, $2, $3)`,
        [
          input.providerId,
          input.stateCode,
          `${input.providerName} has stopped serving ${input.stateCode}.`,
        ],
      );

      await createNotificationsForSegment(
        { kind: 'state', stateCode: input.stateCode },
        {
          notificationType: 'state_pullout',
          stateCode: input.stateCode,
          title: 'Provider State Exit',
          message: `${input.providerName} has stopped serving ${input.stateCode}. This affects ${affected
            .map((casino) => casino.name)
            .join(', ')}.`,
          actionUrl: '/admin/states',
        },
        tx,
      );
    }

    return affected;
  });
}

export async function logManualReportAudit(input: {
  flagContent: string;
  casinoId?: number | null;
  stateCode?: string | null;
}) {
  await createAdminFlag({
    source: 'manual',
    flagType: 'data_anomaly',
    flagContent: input.flagContent,
    casinoId: input.casinoId ?? null,
    stateCode: input.stateCode ?? null,
  });
}

