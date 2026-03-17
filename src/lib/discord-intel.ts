import crypto from 'node:crypto';

import { query } from './db';

export interface DiscordIntelPayload {
  item_type: string;
  casino_slug?: string | null;
  title: string;
  content: string;
  source_channel: string;
  expires_at?: string | null;
  admin_flag?: boolean;
  ai_summary?: string | null;
  proposed_action?: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unverified';
  confidence_reason: string;
}

function sanitizeIntelContent(value: string) {
  return value
    .replace(/@[a-z0-9._-]+/gi, 'community member')
    .replace(/#[a-z0-9._-]+/gi, 'community note')
    .replace(/\bdiscord\b/gi, 'community')
    .replace(/\bbearcave\b/gi, 'community')
    .replace(/\breddit\b/gi, 'community')
    .trim();
}

export interface PublishedIntelItem {
  id: number;
  title: string;
  content: string;
  item_type: string;
  confidence: 'high' | 'medium' | 'low' | 'unverified';
  casino_id: number | null;
  casino_name: string | null;
}

export interface GameAvailabilitySignal {
  casino_slug: string;
  game_name: string;
  provider_slug?: string | null;
  game_type?: string | null;
  signal_type: 'positive' | 'negative';
  is_cross_wash_relevant?: boolean;
}

export function requireDiscordIngestKey(request: Request) {
  const expected = import.meta.env.DISCORD_INGEST_KEY;
  if (!expected) {
    throw new Error('DISCORD_INGEST_KEY is not configured.');
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return token === expected;
}

export async function resolveCasinoBySlug(slug?: string | null) {
  if (!slug) {
    return null;
  }

  const rows = await query<{ id: number; name: string; slug: string }>(
    `SELECT id, name, slug
    FROM casinos
    WHERE slug = $1
    LIMIT 1`,
    [slug],
  );

  return rows[0] ?? null;
}

export async function resolveProviderBySlug(slug?: string | null) {
  if (!slug) {
    return null;
  }

  const rows = await query<{ id: number; slug: string; name: string }>(
    `SELECT id, slug, name
    FROM game_providers
    WHERE slug = $1
    LIMIT 1`,
    [slug],
  );

  return rows[0] ?? null;
}

export async function createIntelItem(payload: DiscordIntelPayload) {
  const casino = await resolveCasinoBySlug(payload.casino_slug);
  const sanitizedTitle = sanitizeIntelContent(payload.title);
  const sanitizedContent = sanitizeIntelContent(payload.content);
  const contentHash = crypto
    .createHash('sha256')
    .update(`${sanitizedTitle}\n${sanitizedContent}`)
    .digest('hex');

  const existing = await query<{ id: number }>(
    `SELECT id
    FROM discord_intel_items
    WHERE content_hash = $1
    LIMIT 1`,
    [contentHash],
  );

  if (existing.length > 0) {
    return { itemId: existing[0].id, duplicate: true, casinoId: casino?.id ?? null };
  }

  const rows = await query<{ id: number }>(
    `INSERT INTO discord_intel_items (
      item_type,
      casino_id,
      casino_name_raw,
      title,
      content,
      content_hash,
      source_channel,
      expires_at,
      confidence,
      confidence_reason,
      is_published,
      source,
      submitted_by,
      is_anonymous
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, 'discord', NULL, true)
    RETURNING id`,
    [
      payload.item_type,
      casino?.id ?? null,
      casino ? null : payload.casino_slug ?? null,
      sanitizedTitle,
      sanitizedContent,
      contentHash,
      payload.source_channel,
      payload.expires_at ?? null,
      payload.confidence,
      payload.confidence_reason,
    ],
  );

  return { itemId: rows[0].id, duplicate: false, casinoId: casino?.id ?? null };
}

export async function publishIntelItem(itemId: number, options?: { autoPublished?: boolean }) {
  const rows = await query<PublishedIntelItem>(
    `WITH updated AS (
      UPDATE discord_intel_items
      SET is_published = true,
          published_at = NOW(),
          auto_published = COALESCE($2, false)
      WHERE id = $1
      RETURNING id, title, content, item_type, confidence, casino_id
    )
    SELECT
      updated.id,
      updated.title,
      updated.content,
      updated.item_type,
      updated.confidence,
      updated.casino_id,
      c.name AS casino_name
    FROM updated
    LEFT JOIN casinos c ON c.id = updated.casino_id`,
    [itemId, options?.autoPublished ?? false],
  );

  if (rows.length > 0) {
    return rows[0];
  }

  const fallback = await query<PublishedIntelItem>(
    `SELECT
      dii.id,
      dii.title,
      dii.content,
      dii.item_type,
      dii.confidence,
      dii.casino_id,
      c.name AS casino_name
    FROM discord_intel_items dii
    LEFT JOIN casinos c ON c.id = dii.casino_id
    WHERE dii.id = $1
    LIMIT 1`,
    [itemId],
  );

  return fallback[0] ?? null;
}

export async function discardIntelItem(itemId: number) {
  await query('DELETE FROM discord_intel_items WHERE id = $1', [itemId]);
}

