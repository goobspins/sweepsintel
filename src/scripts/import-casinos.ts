import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { TransactionClient } from '../lib/db';
import { transaction } from '../lib/db';

type RawRow = Record<string, unknown>;

type SupportedCasinoColumn =
  | 'slug'
  | 'name'
  | 'tier'
  | 'claim_url'
  | 'reset_mode'
  | 'reset_time_local'
  | 'reset_timezone'
  | 'reset_interval_hours'
  | 'has_streaks'
  | 'sc_to_usd_ratio'
  | 'parent_company'
  | 'promoban_risk'
  | 'hardban_risk'
  | 'family_ban_propagation'
  | 'ban_confiscates_funds'
  | 'daily_bonus_desc'
  | 'daily_bonus_sc_avg'
  | 'has_live_games'
  | 'redemption_speed_desc'
  | 'redemption_fee_desc'
  | 'min_redemption_usd'
  | 'has_affiliate_link'
  | 'affiliate_link_url'
  | 'affiliate_type'
  | 'affiliate_enrollment_verified'
  | 'source'
  | 'is_excluded';

const SUPPORTED_COLUMNS: SupportedCasinoColumn[] = [
  'slug',
  'name',
  'tier',
  'claim_url',
  'reset_mode',
  'reset_time_local',
  'reset_timezone',
  'reset_interval_hours',
  'has_streaks',
  'sc_to_usd_ratio',
  'parent_company',
  'promoban_risk',
  'hardban_risk',
  'family_ban_propagation',
  'ban_confiscates_funds',
  'daily_bonus_desc',
  'daily_bonus_sc_avg',
  'has_live_games',
  'redemption_speed_desc',
  'redemption_fee_desc',
  'min_redemption_usd',
  'has_affiliate_link',
  'affiliate_link_url',
  'affiliate_type',
  'affiliate_enrollment_verified',
  'source',
  'is_excluded',
];

const BOOLEAN_COLUMNS = new Set<SupportedCasinoColumn>([
  'has_streaks',
  'family_ban_propagation',
  'ban_confiscates_funds',
  'has_live_games',
  'has_affiliate_link',
  'affiliate_enrollment_verified',
  'is_excluded',
]);

const NUMBER_COLUMNS = new Set<SupportedCasinoColumn>([
  'reset_interval_hours',
  'sc_to_usd_ratio',
  'daily_bonus_sc_avg',
  'min_redemption_usd',
]);

function parseArgs(argv: string[]) {
  const fileIndex = argv.findIndex((arg) => arg === '--file');
  if (fileIndex === -1 || !argv[fileIndex + 1]) {
    throw new Error('Usage: npx tsx src/scripts/import-casinos.ts --file <data.json|data.csv>');
  }

  return {
    file: path.resolve(argv[fileIndex + 1]),
  };
}

function normalizeKey(key: string) {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function parseBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'n', ''].includes(normalized)) {
    return false;
  }

  return null;
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTier(value: unknown) {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();

  if (normalized === 'S' || normalized === 'A' || normalized === 'B' || normalized === 'C') {
    return normalized;
  }

  return 'B';
}

function parseCsv(content: string): RawRow[] {
  const rows: string[][] = [];
  let currentCell = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim().length > 0)) {
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return [];
  }

  const [header, ...dataRows] = rows;
  const keys = header.map((cell) => normalizeKey(cell));

  return dataRows.map((row) => {
    const record: RawRow = {};
    keys.forEach((key, index) => {
      record[key] = row[index] ?? '';
    });
    return record;
  });
}

async function loadRows(filePath: string) {
  const raw = await readFile(filePath, 'utf8');
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.json') {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as RawRow[];
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { casinos?: unknown }).casinos)
    ) {
      return (parsed as { casinos: RawRow[] }).casinos;
    }
    throw new Error('JSON file must contain an array or an object with a "casinos" array.');
  }

  if (extension === '.csv') {
    return parseCsv(raw);
  }

  throw new Error('Only .json and .csv files are supported.');
}

async function getUniqueProviderSlug(tx: TransactionClient, name: string) {
  const base = slugify(name) || 'provider';
  const rows = await tx.query<{ slug: string }>(
    `SELECT slug
    FROM game_providers
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

async function getOrCreateProvider(tx: TransactionClient, name: string) {
  const normalizedName = name.trim();
  const existing = await tx.query<{ id: number }>(
    `SELECT id
    FROM game_providers
    WHERE LOWER(name) = LOWER($1)
    LIMIT 1`,
    [normalizedName],
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

  const slug = await getUniqueProviderSlug(tx, normalizedName);
  const created = await tx.query<{ id: number }>(
    `INSERT INTO game_providers (slug, name, is_live_game_provider)
    VALUES ($1, $2, true)
    RETURNING id`,
    [slug, normalizedName],
  );

  return created[0].id;
}

function parseProviderNames(row: RawRow) {
  const raw = row.live_game_providers;
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return [];
  }

  return Array.from(
    new Set(
      String(raw)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function coerceCasinoValue(column: SupportedCasinoColumn, value: unknown) {
  if (column === 'tier') {
    return parseTier(value);
  }

  if (BOOLEAN_COLUMNS.has(column)) {
    const parsed = parseBoolean(value);
    return parsed === null ? false : parsed;
  }

  if (NUMBER_COLUMNS.has(column)) {
    return parseNumber(value);
  }

  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildCasinoPayload(row: RawRow) {
  const rawSlug = String(row.slug ?? '').trim();
  const rawName = String(row.name ?? '').trim();
  const slug = rawSlug || slugify(rawName);

  if (!slug || !rawName) {
    throw new Error('Each casino row requires at least a name or slug.');
  }

  const providerNames = parseProviderNames(row);
  const payload: Partial<Record<SupportedCasinoColumn, unknown>> = {
    slug,
    name: rawName,
  };

  for (const column of SUPPORTED_COLUMNS) {
    if (!(column in row) || column === 'slug' || column === 'name') {
      continue;
    }
    payload[column] = coerceCasinoValue(column, row[column]);
  }

  if (!('has_live_games' in row) && providerNames.length > 0) {
    payload.has_live_games = true;
  } else if (providerNames.length > 0) {
    payload.has_live_games = Boolean(payload.has_live_games) || true;
  }

  if (!payload.reset_interval_hours) {
    payload.reset_interval_hours = 24;
  }

  return { payload, providerNames };
}

async function upsertCasino(tx: TransactionClient, payload: Partial<Record<SupportedCasinoColumn, unknown>>) {
  const columns = Object.keys(payload) as SupportedCasinoColumn[];
  const values = columns.map((column) => payload[column]);
  const updateColumns = columns.filter((column) => column !== 'slug');

  const insertSql = `INSERT INTO casinos (${columns.join(', ')})
    VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})
    ON CONFLICT (slug) DO UPDATE SET
      ${updateColumns.map((column, index) => `${column} = $${index + columns.length + 1}`).join(', ')},
      last_updated_at = NOW()
    RETURNING id, name, slug`;

  const rows = await tx.query<{ id: number; name: string; slug: string }>(
    insertSql,
    [...values, ...updateColumns.map((column) => payload[column])],
  );

  return rows[0];
}

async function syncCasinoProviders(
  tx: TransactionClient,
  casinoId: number,
  providerNames: string[],
) {
  const providerIds: number[] = [];

  for (const providerName of providerNames) {
    providerIds.push(await getOrCreateProvider(tx, providerName));
  }

  if (providerIds.length === 0) {
    await tx.query(
      `DELETE FROM casino_live_game_providers
      WHERE casino_id = $1`,
      [casinoId],
    );

    return { linked: 0, removed: 0 };
  }

  for (const providerId of providerIds) {
    await tx.query(
      `INSERT INTO casino_live_game_providers (casino_id, provider_id)
      VALUES ($1, $2)
      ON CONFLICT (casino_id, provider_id) DO NOTHING`,
      [casinoId, providerId],
    );
  }

  const removedRows = await tx.query<{ provider_id: number }>(
    `DELETE FROM casino_live_game_providers
    WHERE casino_id = $1
      AND provider_id != ALL($2::int[])
    RETURNING provider_id`,
    [casinoId, providerIds],
  );

  return {
    linked: providerIds.length,
    removed: removedRows.length,
  };
}

async function processRow(row: RawRow) {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value]),
  );
  const { payload, providerNames } = buildCasinoPayload(normalizedRow);

  return transaction(async (tx) => {
    const casino = await upsertCasino(tx, payload);
    const providerResult = await syncCasinoProviders(tx, casino.id, providerNames);

    return {
      casino,
      linkedProviders: providerResult.linked,
      removedProviders: providerResult.removed,
    };
  });
}

async function main() {
  const { file } = parseArgs(process.argv.slice(2));
  const rows = await loadRows(file);

  if (rows.length === 0) {
    console.log('No rows found.');
    return;
  }

  for (const row of rows) {
    const result = await processRow(row);
    console.log(
      `${result.casino.slug}: linked ${result.linkedProviders} provider(s), removed ${result.removedProviders}`,
    );
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

