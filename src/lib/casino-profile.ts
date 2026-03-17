import { getCollection } from 'astro:content';

import { getCached } from './cache';
import { query } from './db';

export interface CasinoProfileCasino {
  id: number;
  slug: string;
  name: string;
  tier: string;
  parent_company: string | null;
  promoban_risk: string;
  hardban_risk: string;
  family_ban_propagation: boolean;
  ban_confiscates_funds: boolean;
  sc_to_usd_ratio: number | string | null;
  redemption_speed_desc: string | null;
  redemption_fee_desc: string | null;
  min_redemption_usd: number | string | null;
  reset_mode: string | null;
  reset_time_local: string | null;
  reset_timezone: string | null;
  has_live_games: boolean;
  has_affiliate_link: boolean;
  affiliate_link_url: string | null;
  is_excluded: boolean;
}

export interface CasinoProfileHealthSummary {
  global_status: string;
  status_reason: string | null;
}

export interface CasinoProfileProvider {
  provider_id: number;
  name: string;
  slug: string;
}

export interface CasinoProfileGame {
  id: number;
  game_name: string;
  provider_name: string | null;
  is_cross_wash_relevant: boolean;
  confidence: string;
}

export interface CasinoProfileBanReport {
  id: number;
  report_type: string;
  description: string;
  submitted_at: string;
}

export interface CasinoProfileIntelItem {
  id: number;
  item_type: string;
  title: string;
  content: string;
  created_at: string;
  expires_at: string | null;
  worked_count: number | string | null;
  didnt_work_count: number | string | null;
  signal_status: string | null;
}

export interface CasinoProfileState {
  state_code: string;
  state_name: string;
  status: string;
  compliance_note: string | null;
}

export interface CasinoProfileReportsSummary {
  providers: CasinoProfileProvider[];
  games: CasinoProfileGame[];
  banReports: CasinoProfileBanReport[];
  hasBanUptick: boolean;
  intelItems: CasinoProfileIntelItem[];
  states: CasinoProfileState[];
}

export async function getCasinoBySlug(
  slug: string,
): Promise<CasinoProfileCasino | null> {
  const casinoRows = await query<CasinoProfileCasino>(
    `SELECT
      id,
      slug,
      name,
      tier,
      parent_company,
      promoban_risk,
      hardban_risk,
      family_ban_propagation,
      ban_confiscates_funds,
      sc_to_usd_ratio,
      redemption_speed_desc,
      redemption_fee_desc,
      min_redemption_usd,
      reset_mode,
      reset_time_local,
      reset_timezone,
      has_live_games,
      has_affiliate_link,
      affiliate_link_url,
      is_excluded
    FROM casinos
    WHERE slug = $1
    LIMIT 1`,
    [slug],
  );

  return casinoRows[0] ?? null;
}

export async function getCasinoEditorialData(slug: string) {
  const editorialEntries = await getCollection(
    'casinos',
    ({ data }) => data.slug === slug,
  );

  return editorialEntries[0] ?? null;
}

export async function getCasinoHealthSummary(
  casinoId: number,
): Promise<CasinoProfileHealthSummary | null> {
  const healthRows = await query<CasinoProfileHealthSummary>(
    `SELECT global_status, status_reason
      FROM casino_health
      WHERE casino_id = $1
      ORDER BY last_computed_at DESC
      LIMIT 1`,
    [casinoId],
  );

  return healthRows[0] ?? null;
}

export async function getCasinoRecentIntel(
  casinoId: number,
): Promise<CasinoProfileIntelItem[]> {
  return query<CasinoProfileIntelItem>(
    `SELECT
      id,
      item_type,
      title,
      content,
      created_at,
      expires_at,
      worked_count,
      didnt_work_count,
      COALESCE(signal_status, 'active') AS signal_status
    FROM discord_intel_items
    WHERE casino_id = $1
      AND is_published = true
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT 10`,
    [casinoId],
  );
}

export async function getCasinoReportsSummary(
  slug: string,
  casinoId: number,
): Promise<CasinoProfileReportsSummary> {
  return getCached(`casino-profile:${slug}`, 5 * 60 * 1000, async () => {
    const [providers, games, banReports, uptick, intelItems, states] =
      await Promise.all([
        query<CasinoProfileProvider>(
          `SELECT clgp.provider_id, gp.name, gp.slug
          FROM casino_live_game_providers clgp
          JOIN game_providers gp ON gp.id = clgp.provider_id
          WHERE clgp.casino_id = $1`,
          [casinoId],
        ),
        query<CasinoProfileGame>(
          `SELECT
            cga.id,
            cga.game_name,
            gp.name AS provider_name,
            cga.is_cross_wash_relevant,
            cga.confidence
          FROM casino_game_availability cga
          LEFT JOIN game_providers gp ON gp.id = cga.provider_id
          WHERE cga.casino_id = $1
            AND cga.status != 'removed'
          ORDER BY
            CASE cga.confidence
              WHEN 'high' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'low' THEN 3
              ELSE 4
            END,
            cga.game_name`,
          [casinoId],
        ),
        query<CasinoProfileBanReport>(
          `SELECT id, report_type, description, submitted_at
          FROM ban_reports
          WHERE casino_id = $1
            AND is_published = true
          ORDER BY submitted_at DESC
          LIMIT 20`,
          [casinoId],
        ),
        query<{ id: number }>(
          `SELECT id
          FROM ban_uptick_alerts
          WHERE casino_id = $1
            AND is_active = true
          LIMIT 1`,
          [casinoId],
        ),
        getCasinoRecentIntel(casinoId),
        query<CasinoProfileState>(
          `SELECT
            csa.state_code,
            sls.state_name,
            csa.status,
            csa.compliance_note
          FROM casino_state_availability csa
          JOIN state_legal_status sls ON sls.state_code = csa.state_code
          WHERE csa.casino_id = $1`,
          [casinoId],
        ),
      ]);

    return {
      providers,
      games,
      banReports,
      hasBanUptick: uptick.length > 0,
      intelItems,
      states,
    };
  });
}

export async function getUserTimezoneForProfile(
  userId: string,
): Promise<string | null> {
  const rows = await query<{ timezone: string }>(
    'SELECT timezone FROM user_settings WHERE user_id = $1 LIMIT 1',
    [userId],
  );

  return rows[0]?.timezone ?? null;
}
