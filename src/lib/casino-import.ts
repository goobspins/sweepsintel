import * as XLSX from 'xlsx';

import { normalizeCasinoName } from './tracker';

export type PreviewRow = Record<string, string>;
export type ImportField =
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
  | 'daily_bonus_sc_avg'
  | 'has_live_games'
  | 'live_game_providers'
  | 'min_redemption_usd'
  | 'has_affiliate_link'
  | 'affiliate_link_url'
  | 'affiliate_type'
  | 'affiliate_notes';

export type ImportRowPayload = Partial<Record<ImportField, string | null>>;

export type NormalizedImportRow = {
  slug: string | null;
  name: string;
  normalizedName: string;
  tierLabel: string | null;
  claimUrl: string | null;
  resetMode: string | null;
  resetTimeLocal: string | null;
  resetTimezone: string | null;
  resetIntervalHours: number;
  hasStreaks: boolean | null;
  scToUsdRatio: number | null;
  parentCompany: string | null;
  promobanRisk: string | null;
  hardbanRisk: string | null;
  familyBanPropagation: boolean | null;
  banConfiscatesFunds: boolean | null;
  dailyBonusScAvg: number | null;
  hasLiveGames: boolean | null;
  providerNames: string[];
  minRedemptionUsd: number | null;
  hasAffiliateLink: boolean | null;
  affiliateLinkUrl: string | null;
  affiliateType: string | null;
};

export const IMPORT_FIELDS: ImportField[] = [
  'slug', 'name', 'tier', 'claim_url', 'reset_mode', 'reset_time_local', 'reset_timezone',
  'reset_interval_hours', 'has_streaks', 'sc_to_usd_ratio', 'parent_company', 'promoban_risk',
  'hardban_risk', 'family_ban_propagation', 'ban_confiscates_funds', 'daily_bonus_sc_avg',
  'has_live_games', 'live_game_providers', 'min_redemption_usd', 'has_affiliate_link',
  'affiliate_link_url', 'affiliate_type', 'affiliate_notes',
];

export function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

export function parseWorkbookRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { headers: [] as string[], rows: [] as PreviewRow[] };

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
  });
  if (matrix.length === 0) return { headers: [] as string[], rows: [] as PreviewRow[] };

  const [rawHeaders, ...rawRows] = matrix;
  const headers = rawHeaders.map((header) => normalizeCell(header));
  const rows = rawRows.map((row) => {
    const record: PreviewRow = {};
    headers.forEach((header, index) => {
      record[header] = normalizeCell(row[index]);
    });
    return record;
  });
  return { headers, rows };
}

export function mapImportFields(rows: PreviewRow[], mapping: Record<string, string>) {
  return rows.map((row) => {
    const mappedRow: ImportRowPayload = {};
    for (const [header, rawValue] of Object.entries(row)) {
      const mappedField = mapping[header];
      if (!mappedField || mappedField === 'skip' || !IMPORT_FIELDS.includes(mappedField as ImportField)) continue;
      mappedRow[mappedField as ImportField] = normalizeCell(rawValue) || null;
    }
    return mappedRow;
  });
}

function parseBoolean(value: string | null) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'nan') return null;
  if (['true', '1', '1.0', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', '0.0', 'no', 'n'].includes(normalized)) return false;
  return null;
}

function parseInteger(value: string | null) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseDecimal(value: string | null) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEnum(value: string | null, allowed: string[], fallback: string | null, warningLabel: string, rowNumber: number, warnings: string[]) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (allowed.includes(normalized)) return normalized;
  warnings.push(`Row ${rowNumber}: invalid ${warningLabel} "${value}"`);
  return fallback;
}

export function validateImportRow(row: ImportRowPayload) {
  return Boolean(row.name?.trim());
}

export function normalizeImportRow(row: ImportRowPayload, rowNumber: number, warnings: string[]): NormalizedImportRow {
  const rawName = row.name?.trim() ?? '';
  const rawTier = row.tier?.trim().toUpperCase() ?? null;
  let tierLabel: string | null = null;
  if (rawTier) {
    if (['S', 'A', 'B', 'C'].includes(rawTier)) {
      tierLabel = rawTier;
    } else {
      warnings.push(`Row ${rowNumber}: invalid tier "${row.tier}", defaulted to "B"`);
      tierLabel = 'B';
    }
  }

  const providerNames = Array.from(new Set(String(row.live_game_providers ?? '').split(',').map((value) => value.trim()).filter(Boolean)));
  const resetMode = parseEnum(row.reset_mode ?? null, ['rolling', 'fixed'], 'rolling', 'reset_mode', rowNumber, warnings);
  const hasAffiliateLink = parseBoolean(row.has_affiliate_link ?? null);
  const hasLiveGames = providerNames.length > 0 ? true : (parseBoolean(row.has_live_games ?? null) ?? null);

  return {
    slug: row.slug?.trim() ? slugify(row.slug) : null,
    name: rawName,
    normalizedName: normalizeCasinoName(rawName),
    tierLabel,
    claimUrl: row.claim_url?.trim() || null,
    resetMode,
    resetTimeLocal: row.reset_time_local?.trim() || null,
    resetTimezone: (row.reset_timezone?.trim() || null) ?? (resetMode === 'fixed' ? 'America/New_York' : null),
    resetIntervalHours: parseInteger(row.reset_interval_hours ?? null) ?? 24,
    hasStreaks: parseBoolean(row.has_streaks ?? null),
    scToUsdRatio: parseDecimal(row.sc_to_usd_ratio ?? null),
    parentCompany: row.parent_company?.trim() || null,
    promobanRisk: parseEnum(row.promoban_risk ?? null, ['none', 'low', 'medium', 'high', 'unknown'], 'unknown', 'promoban_risk', rowNumber, warnings),
    hardbanRisk: parseEnum(row.hardban_risk ?? null, ['none', 'low', 'medium', 'high', 'unknown'], 'unknown', 'hardban_risk', rowNumber, warnings),
    familyBanPropagation: parseBoolean(row.family_ban_propagation ?? null),
    banConfiscatesFunds: parseBoolean(row.ban_confiscates_funds ?? null),
    dailyBonusScAvg: parseInteger(row.daily_bonus_sc_avg ?? null),
    hasLiveGames,
    providerNames,
    minRedemptionUsd: parseDecimal(row.min_redemption_usd ?? null),
    hasAffiliateLink,
    affiliateLinkUrl: row.affiliate_link_url?.trim() || null,
    affiliateType: row.affiliate_type?.trim() || null,
  };
}
