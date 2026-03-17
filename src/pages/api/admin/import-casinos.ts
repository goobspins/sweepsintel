import type { APIRoute } from 'astro';

import { methodNotAllowed } from '../../../lib/api';
import { isHttpError, requireAdmin } from '../../../lib/auth';
import { invalidateCachedPrefix } from '../../../lib/cache';
import {
  mapImportFields,
  normalizeImportRow,
  parseWorkbookRows,
  slugify,
  type ImportRowPayload,
  type PreviewRow,
  validateImportRow,
} from '../../../lib/casino-import';
import { transaction, type TransactionClient } from '../../../lib/db';

export const prerender = false;


function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}


async function getUniqueSlug(tx: TransactionClient, name: string) {
  const base = slugify(name) || 'casino';
  const rows = await tx.query<{ slug: string }>(
    `SELECT slug
    FROM casinos
    WHERE slug = $1 OR slug LIKE $2`,
    [base, `${base}-%`],
  );
  const existing = new Set(rows.map((row) => row.slug));
  if (!existing.has(base)) {
    return base;
  }

  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

async function findExistingCasino(tx: TransactionClient, slug: string | null, normalizedName: string) {
  if (slug) {
    const slugRows = await tx.query<{ id: number }>(
      `SELECT id
      FROM casinos
      WHERE slug = $1
      LIMIT 1`,
      [slug],
    );
    if (slugRows[0]) return slugRows[0].id;
  }

  const nameRows = await tx.query<{ id: number }>(
    `SELECT id
    FROM casinos
    WHERE normalized_name = $1
    LIMIT 1`,
    [normalizedName],
  );
  return nameRows[0]?.id ?? null;
}

async function getOrCreateProvider(tx: TransactionClient, providerName: string) {
  const existing = await tx.query<{ id: number }>(
    `SELECT id
    FROM game_providers
    WHERE LOWER(name) = LOWER($1)
    LIMIT 1`,
    [providerName],
  );

  if (existing[0]) {
    await tx.query(
      `UPDATE game_providers
      SET is_live_game_provider = true
      WHERE id = $1`,
      [existing[0].id],
    );
    return existing[0].id;
  }

  const slug = slugify(providerName) || 'provider';
  const created = await tx.query<{ id: number }>(
    `INSERT INTO game_providers (slug, name, is_live_game_provider)
    VALUES ($1, $2, true)
    RETURNING id`,
    [slug, providerName],
  );
  return created[0].id;
}

async function syncProviders(tx: TransactionClient, casinoId: number, providerNames: string[]) {
  const providerIds: number[] = [];
  for (const providerName of providerNames) {
    providerIds.push(await getOrCreateProvider(tx, providerName));
  }

  await tx.query(`DELETE FROM casino_live_game_providers WHERE casino_id = $1`, [casinoId]);
  for (const providerId of providerIds) {
    await tx.query(
      `INSERT INTO casino_live_game_providers (casino_id, provider_id)
      VALUES ($1, $2)
      ON CONFLICT (casino_id, provider_id) DO NOTHING`,
      [casinoId, providerId],
    );
  }
}

async function importRows(rows: ImportRowPayload[]) {
  const warnings: string[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  await transaction(async (tx) => {
    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const row = rows[index];
      if (!validateImportRow(row)) {
        skipped += 1;
        continue;
      }

      const payload = normalizeImportRow(row, rowNumber, warnings);

      const existingId = await findExistingCasino(tx, payload.slug, payload.normalizedName);
      let casinoId = existingId;

      if (existingId) {
        const updateRows = await tx.query<{ id: number }>(
          `UPDATE casinos
          SET slug = COALESCE(NULLIF($2, ''), slug),
              name = COALESCE(NULLIF($3, ''), name),
              normalized_name = $4,
              tier_label = COALESCE($5, tier_label),
              claim_url = COALESCE(NULLIF($6, ''), claim_url),
              reset_mode = COALESCE($7, reset_mode),
              reset_time_local = COALESCE(NULLIF($8, ''), reset_time_local),
              reset_timezone = COALESCE(NULLIF($9, ''), reset_timezone),
              reset_interval_hours = COALESCE($10, reset_interval_hours),
              has_streaks = COALESCE($11, has_streaks),
              sc_to_usd_ratio = COALESCE($12, sc_to_usd_ratio),
              parent_company = COALESCE(NULLIF($13, ''), parent_company),
              promoban_risk = COALESCE($14, promoban_risk),
              hardban_risk = COALESCE($15, hardban_risk),
              family_ban_propagation = COALESCE($16, family_ban_propagation),
              ban_confiscates_funds = COALESCE($17, ban_confiscates_funds),
              daily_bonus_sc_avg = COALESCE($18, daily_bonus_sc_avg),
              has_live_games = COALESCE($19, has_live_games),
              min_redemption_usd = COALESCE($20, min_redemption_usd),
              has_affiliate_link = COALESCE($21, has_affiliate_link),
              affiliate_link_url = COALESCE(NULLIF($22, ''), affiliate_link_url),
              affiliate_type = COALESCE(NULLIF($23, ''), affiliate_type),
              source = 'admin',
              last_updated_at = NOW()
          WHERE id = $1
          RETURNING id`,
          [
            existingId,
            payload.slug,
            payload.name,
            payload.normalizedName,
            payload.tierLabel,
            payload.claimUrl,
            payload.resetMode,
            payload.resetTimeLocal,
            payload.resetTimezone,
            payload.resetIntervalHours,
            payload.hasStreaks,
            payload.scToUsdRatio,
            payload.parentCompany,
            payload.promobanRisk,
            payload.hardbanRisk,
            payload.familyBanPropagation,
            payload.banConfiscatesFunds,
            payload.dailyBonusScAvg,
            payload.hasLiveGames,
            payload.minRedemptionUsd,
            payload.hasAffiliateLink,
            payload.affiliateLinkUrl,
            payload.affiliateType,
          ],
        );
        casinoId = updateRows[0]?.id ?? existingId;
        updated += 1;
      } else {
        const nextSlug = payload.slug || (await getUniqueSlug(tx, payload.name));
        const createdRows = await tx.query<{ id: number }>(
          `INSERT INTO casinos (
            slug,
            name,
            normalized_name,
            tier_label,
            claim_url,
            reset_mode,
            reset_time_local,
            reset_timezone,
            reset_interval_hours,
            has_streaks,
            sc_to_usd_ratio,
            parent_company,
            promoban_risk,
            hardban_risk,
            family_ban_propagation,
            ban_confiscates_funds,
            daily_bonus_sc_avg,
            has_live_games,
            min_redemption_usd,
            has_affiliate_link,
            affiliate_link_url,
            affiliate_type,
            source,
            last_updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'admin',NOW()
          )
          RETURNING id`,
          [
            nextSlug,
            payload.name,
            payload.normalizedName,
            payload.tierLabel,
            payload.claimUrl,
            payload.resetMode ?? 'rolling',
            payload.resetTimeLocal,
            payload.resetTimezone,
            payload.resetIntervalHours,
            payload.hasStreaks ?? false,
            payload.scToUsdRatio ?? 1,
            payload.parentCompany,
            payload.promobanRisk ?? 'unknown',
            payload.hardbanRisk ?? 'unknown',
            payload.familyBanPropagation ?? false,
            payload.banConfiscatesFunds ?? false,
            payload.dailyBonusScAvg,
            payload.hasLiveGames ?? false,
            payload.minRedemptionUsd,
            payload.hasAffiliateLink ?? false,
            payload.affiliateLinkUrl,
            payload.affiliateType,
          ],
        );
        casinoId = createdRows[0].id;
        created += 1;
      }

      if (casinoId) {
        await syncProviders(tx, casinoId, providerNames);
      }
    }
  });

  return { created, updated, skipped, warnings };
}

export const GET: APIRoute = async () => methodNotAllowed(['POST']);

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const action = String(formData.get('action') ?? 'preview');
      if (action !== 'preview') {
        return json({ error: 'Unsupported import action.' }, 400);
      }

      const file = formData.get('file');
      if (!(file instanceof File)) {
        return json({ error: 'Import file is required.' }, 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const { headers, rows } = parseWorkbookRows(buffer);
      return json({
        headers,
        rows,
        preview: rows.slice(0, 10),
        total_rows: rows.length,
      });
    }

    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? (body.rows as PreviewRow[]) : [];
    const mapping = body?.mapping && typeof body.mapping === 'object' ? (body.mapping as Record<string, string>) : {};
    if (rows.length === 0) {
      return json({ error: 'No rows provided for import.' }, 400);
    }

      const mappedRows = mapImportFields(rows, mapping);
    const result = await importRows(mappedRows);
    invalidateCachedPrefix('dashboard-discovery:');
    return json(result);
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('admin/import-casinos failed', error);
    return json({ error: 'Unable to import casinos.' }, 500);
  }
};
