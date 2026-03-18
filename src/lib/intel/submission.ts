import { query } from '../db';

export async function submitUserSignal(options: {
  userId: string;
  casinoId: number;
  signalType: string;
  title: string;
  details: string;
  expiresAt?: string | null;
  isAnonymous?: boolean;
}) {
  const trustRows = await query<{ trust_score: number | string | null }>(
    `SELECT trust_score
    FROM user_settings
    WHERE user_id = $1
    LIMIT 1`,
    [options.userId],
  );
  const trustScore = Number(trustRows[0]?.trust_score ?? 0.5);
  const confidence = trustScore > 0.7 ? 'medium' : 'unverified';

  const rows = await query<{
    id: number;
    casino_id: number | null;
    item_type: string;
    title: string;
    content: string;
    expires_at: string | null;
    confidence: string;
    signal_status: string;
    created_at: string;
    is_anonymous: boolean;
  }>(
    `INSERT INTO discord_intel_items (
      item_type,
      casino_id,
      title,
      content,
      expires_at,
      confidence,
      confidence_reason,
      is_published,
      source,
      submitted_by,
      is_anonymous,
      signal_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'user', $8, $9, 'active')
    RETURNING id, casino_id, item_type, title, content, expires_at, confidence, signal_status, created_at, is_anonymous`,
    [
      options.signalType,
      options.casinoId,
      options.title.trim(),
      options.details.trim(),
      options.expiresAt ?? null,
      confidence,
      confidence === 'medium' ? 'Elevated by user trust score.' : 'New community signal.',
      options.userId,
      Boolean(options.isAnonymous),
    ],
  );

  return rows[0];
}
