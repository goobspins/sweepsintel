import webpush from 'web-push';

import { query } from './db';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export type PushSegment =
  | { kind: 'state'; stateCode: string }
  | { kind: 'casino'; casinoId: number }
  | { kind: 'all' };

type SubscriptionRow = {
  id: number;
  user_id: string;
  subscription_json: string;
};

let vapidConfigured = false;

function configureWebPush() {
  if (vapidConfigured) {
    return true;
  }

  const publicKey = import.meta.env.VAPID_PUBLIC_KEY;
  const privateKey = import.meta.env.VAPID_PRIVATE_KEY;
  const subject = import.meta.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

async function markSubscriptionInactive(subscriptionId: number) {
  await query(
    `UPDATE push_subscriptions
    SET is_active = false
    WHERE id = $1`,
    [subscriptionId],
  );
}

async function canSendToUser(userId: string) {
  const rows = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
    FROM push_notification_log
    WHERE user_id = $1
      AND sent_at > NOW() - INTERVAL '24 hours'`,
    [userId],
  );

  return Number(rows[0]?.count ?? 0) < 3;
}

async function logPush(userId: string, title: string) {
  await query(
    `INSERT INTO push_notification_log (user_id, payload_title, sent_at)
    VALUES ($1, $2, NOW())`,
    [userId, title],
  );
}

async function sendToSubscriptions(
  subscriptions: SubscriptionRow[],
  payload: PushPayload,
) {
  if (!configureWebPush()) {
    console.warn('push skipped: VAPID keys are not configured.');
    return 0;
  }

  let sentUsers = 0;
  const byUser = new Map<string, SubscriptionRow[]>();

  for (const subscription of subscriptions) {
    const current = byUser.get(subscription.user_id) ?? [];
    current.push(subscription);
    byUser.set(subscription.user_id, current);
  }

  for (const [userId, userSubscriptions] of byUser) {
    const allowed = await canSendToUser(userId);
    if (!allowed) {
      continue;
    }

    let delivered = false;

    for (const subscription of userSubscriptions) {
      try {
        await webpush.sendNotification(
          JSON.parse(subscription.subscription_json),
          JSON.stringify(payload),
        );
        delivered = true;
      } catch (error) {
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? Number((error as { statusCode?: number }).statusCode)
            : null;

        if (statusCode === 404 || statusCode === 410) {
          await markSubscriptionInactive(subscription.id).catch((markError) =>
            console.error('push subscription deactivate failed', markError),
          );
          continue;
        }

        console.error('push send failed', error);
      }
    }

    if (delivered) {
      await logPush(userId, payload.title);
      sentUsers += 1;
    }
  }

  return sentUsers;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const subscriptions = await query<SubscriptionRow>(
    `SELECT id, user_id, subscription_json
    FROM push_subscriptions
    WHERE user_id = $1
      AND is_active = true`,
    [userId],
  );

  return sendToSubscriptions(subscriptions, payload);
}

export async function sendPushToSegment(
  segment: PushSegment,
  payload: PushPayload,
) {
  let subscriptions: SubscriptionRow[] = [];

  if (segment.kind === 'state') {
    subscriptions = await query<SubscriptionRow>(
      `SELECT DISTINCT ps.id, ps.user_id, ps.subscription_json
      FROM push_subscriptions ps
      JOIN user_state_subscriptions uss ON uss.user_id = ps.user_id
      WHERE uss.state_code = $1
        AND ps.is_active = true`,
      [segment.stateCode],
    );
  } else if (segment.kind === 'casino') {
    subscriptions = await query<SubscriptionRow>(
      `SELECT DISTINCT ps.id, ps.user_id, ps.subscription_json
      FROM push_subscriptions ps
      JOIN user_casino_settings ucs ON ucs.user_id = ps.user_id
      WHERE ucs.casino_id = $1
        AND ucs.removed_at IS NULL
        AND ps.is_active = true`,
      [segment.casinoId],
    );
  } else {
    subscriptions = await query<SubscriptionRow>(
      `SELECT id, user_id, subscription_json
      FROM push_subscriptions
      WHERE is_active = true`,
    );
  }

  return sendToSubscriptions(subscriptions, payload);
}
