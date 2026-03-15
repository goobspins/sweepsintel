import { useState } from 'react';

import type { CasinoTier } from '../../lib/casino-tier';

interface ProviderOption {
  id: number;
  name: string;
}

interface GameRow {
  id?: number;
  provider_id: number | null;
  game_name: string;
  game_type: string | null;
  is_cross_wash_relevant: boolean;
  confidence: string;
  status: string;
}

interface CasinoRecord {
  id?: number;
  slug: string;
  name: string;
  tier: CasinoTier;
  claim_url?: string | null;
  reset_mode?: string | null;
  reset_time_local?: string | null;
  reset_timezone?: string | null;
  reset_interval_hours?: number | null;
  has_streaks?: boolean;
  sc_to_usd_ratio?: number | string | null;
  parent_company?: string | null;
  promoban_risk?: string | null;
  hardban_risk?: string | null;
  family_ban_propagation?: boolean;
  ban_confiscates_funds?: boolean;
  daily_bonus_desc?: string | null;
  daily_bonus_sc_avg?: number | null;
  has_live_games?: boolean;
  redemption_speed_desc?: string | null;
  redemption_fee_desc?: string | null;
  min_redemption_usd?: number | string | null;
  has_affiliate_link?: boolean;
  affiliate_link_url?: string | null;
  affiliate_type?: string | null;
  affiliate_enrollment_verified?: boolean;
  source?: string;
  is_excluded?: boolean;
}

interface AdminCasinoFormProps {
  casino: CasinoRecord;
  providers: ProviderOption[];
  selectedProviders: number[];
  games: GameRow[];
  mode: 'new' | 'edit';
}

const tierOptions: CasinoTier[] = ['S', 'A', 'B', 'C'];

export default function AdminCasinoForm({
  casino,
  providers,
  selectedProviders,
  games,
  mode,
}: AdminCasinoFormProps) {
  const [form, setForm] = useState<CasinoRecord>(casino);
  const [providerIds, setProviderIds] = useState<number[]>(selectedProviders);
  const [gameRows, setGameRows] = useState<GameRow[]>(games);
  const [pending, setPending] = useState(false);

  function update<K extends keyof CasinoRecord>(key: K, value: CasinoRecord[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(flagForReview = false) {
    setPending(true);
    try {
      const response = await fetch('/api/admin/casinos', {
        method: mode === 'new' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          id: form.id,
          providers: providerIds,
          games: gameRows,
          flag_for_review: flagForReview,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save casino.');
      }

      if (mode === 'new') {
        window.location.assign(`/admin/casinos/${data.id}`);
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="form-shell">
      <Section title="Basic info">
        <Text label="Name" value={form.name} onChange={(value) => update('name', value)} />
        <Text label="Slug" value={form.slug} onChange={(value) => update('slug', value)} />
        <Select label="Tier" value={form.tier} options={tierOptions} onChange={(value) => update('tier', value as CasinoTier)} />
        <Text label="Parent company" value={form.parent_company ?? ''} onChange={(value) => update('parent_company', value)} />
      </Section>

      <Section title="Risk profile">
        <Select label="Promoban risk" value={form.promoban_risk ?? 'unknown'} options={['none', 'low', 'medium', 'high', 'unknown']} onChange={(value) => update('promoban_risk', value)} />
        <Select label="Hardban risk" value={form.hardban_risk ?? 'unknown'} options={['none', 'low', 'medium', 'high', 'unknown']} onChange={(value) => update('hardban_risk', value)} />
        <Checkbox label="Family ban propagation" checked={Boolean(form.family_ban_propagation)} onChange={(value) => update('family_ban_propagation', value)} />
        <Checkbox label="Ban confiscates funds" checked={Boolean(form.ban_confiscates_funds)} onChange={(value) => update('ban_confiscates_funds', value)} />
      </Section>

      <Section title="Daily bonus">
        <Text label="Daily bonus description" value={form.daily_bonus_desc ?? ''} onChange={(value) => update('daily_bonus_desc', value)} />
        <NumberField label="Daily bonus SC average" value={form.daily_bonus_sc_avg ?? null} onChange={(value) => update('daily_bonus_sc_avg', value)} />
        <Checkbox label="Has streaks" checked={Boolean(form.has_streaks)} onChange={(value) => update('has_streaks', value)} />
      </Section>

      <Section title="Reset time">
        <Select label="Reset mode" value={form.reset_mode ?? 'rolling'} options={['rolling', 'fixed']} onChange={(value) => update('reset_mode', value)} />
        <Text label="Reset time local" value={form.reset_time_local ?? ''} onChange={(value) => update('reset_time_local', value)} />
        <Text label="Reset timezone" value={form.reset_timezone ?? ''} onChange={(value) => update('reset_timezone', value)} />
        <NumberField label="Reset interval hours" value={form.reset_interval_hours ?? 24} onChange={(value) => update('reset_interval_hours', value)} />
      </Section>

      <Section title="Redemption">
        <Text label="Speed description" value={form.redemption_speed_desc ?? ''} onChange={(value) => update('redemption_speed_desc', value)} />
        <Text label="Fee description" value={form.redemption_fee_desc ?? ''} onChange={(value) => update('redemption_fee_desc', value)} />
        <NumberField label="Min redemption USD" value={form.min_redemption_usd ?? null} onChange={(value) => update('min_redemption_usd', value)} />
      </Section>

      <Section title="Affiliate and access">
        <Text label="Claim URL" value={form.claim_url ?? ''} onChange={(value) => update('claim_url', value)} />
        <NumberField label="SC to USD ratio" value={form.sc_to_usd_ratio ?? null} onChange={(value) => update('sc_to_usd_ratio', value)} />
        <Checkbox label="Has affiliate link" checked={Boolean(form.has_affiliate_link)} onChange={(value) => update('has_affiliate_link', value)} />
        <Text label="Affiliate URL" value={form.affiliate_link_url ?? ''} onChange={(value) => update('affiliate_link_url', value)} />
        <Text label="Affiliate type" value={form.affiliate_type ?? ''} onChange={(value) => update('affiliate_type', value)} />
        <Checkbox label="Enrollment verified" checked={Boolean(form.affiliate_enrollment_verified)} onChange={(value) => update('affiliate_enrollment_verified', value)} />
      </Section>

      <Section title="Providers">
        <Checkbox label="Has live games" checked={Boolean(form.has_live_games)} onChange={(value) => update('has_live_games', value)} />
        <div className="provider-grid">
          {providers.map((provider) => (
            <label key={provider.id} className="checkbox-row">
              <input
                type="checkbox"
                checked={providerIds.includes(provider.id)}
                onChange={(event) =>
                  setProviderIds((current) =>
                    event.target.checked
                      ? [...current, provider.id]
                      : current.filter((value) => value !== provider.id),
                  )
                }
              />
              <span>{provider.name}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title={`Game availability (${gameRows.length} games tracked)`}>
        <div className="game-grid">
          {gameRows.map((game, index) => (
            <div key={`${game.id ?? 'new'}-${index}`} className="game-row">
              <Text label="Game name" value={game.game_name} onChange={(value) => updateGame(index, { game_name: value })} />
              <Select label="Provider" value={String(game.provider_id ?? '')} options={['', ...providers.map((provider) => String(provider.id))]} optionLabels={['Unassigned', ...providers.map((provider) => provider.name)]} onChange={(value) => updateGame(index, { provider_id: value ? Number(value) : null })} />
              <Text label="Type" value={game.game_type ?? ''} onChange={(value) => updateGame(index, { game_type: value })} />
              <Select label="Confidence" value={game.confidence} options={['high', 'medium', 'low', 'unverified']} onChange={(value) => updateGame(index, { confidence: value })} />
              <Select label="Status" value={game.status} options={['available', 'removed', 'unconfirmed']} onChange={(value) => updateGame(index, { status: value })} />
              <Checkbox label="Cross-wash relevant" checked={game.is_cross_wash_relevant} onChange={(value) => updateGame(index, { is_cross_wash_relevant: value })} />
            </div>
          ))}
          <button type="button" className="ghost-button" onClick={() => setGameRows((current) => [...current, { provider_id: null, game_name: '', game_type: '', is_cross_wash_relevant: false, confidence: 'unverified', status: 'available' }])}>
            Add game
          </button>
        </div>
      </Section>

      <Section title="Meta">
        <Select label="Source" value={form.source ?? 'admin'} options={['admin', 'user_suggested']} onChange={(value) => update('source', value)} />
        <Checkbox label="Excluded" checked={Boolean(form.is_excluded)} onChange={(value) => update('is_excluded', value)} />
      </Section>

      <div className="actions">
        <button type="button" onClick={() => void submit(false)} disabled={pending}>
          {pending ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="ghost-button" onClick={() => void submit(true)} disabled={pending}>
          Flag for review
        </button>
      </div>

      <style>{`
        .form-shell { display: grid; gap: 1rem; }
        .provider-grid, .game-grid { display: grid; gap: 0.85rem; }
        .game-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.85rem;
          padding: 1rem;
          border-radius: 1rem;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
        }
        .checkbox-row { display: flex; gap: 0.6rem; align-items: center; }
        .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .actions button, .ghost-button {
          border: none;
          border-radius: 999px;
          padding: 0.85rem 1rem;
          background: var(--color-primary);
          color: var(--text-primary);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .ghost-button {
          background: var(--color-surface);
          color: var(--color-ink);
          border: 1px solid var(--color-border);
          width: fit-content;
        }
      `}</style>
    </div>
  );

  function updateGame(index: number, patch: Partial<GameRow>) {
    setGameRows((current) =>
      current.map((game, gameIndex) =>
        gameIndex === index ? { ...game, ...patch } : game,
      ),
    );
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card" style={{ padding: '1rem', display: 'grid', gap: '0.85rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{title}</h2>
      {children}
    </section>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'grid', gap: '.35rem' }}>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} style={fieldStyle} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | string | null; onChange: (value: number | null) => void }) {
  return (
    <label style={{ display: 'grid', gap: '.35rem' }}>
      <span>{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        style={fieldStyle}
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  optionLabels,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  optionLabels?: string[];
}) {
  return (
    <label style={{ display: 'grid', gap: '.35rem' }}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={fieldStyle}>
        {options.map((option, index) => (
          <option key={`${label}-${option}-${index}`} value={option}>
            {optionLabels?.[index] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="checkbox-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

const fieldStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: '0.9rem',
  padding: '0.8rem 0.9rem',
  font: 'inherit',
  width: '100%',
};

