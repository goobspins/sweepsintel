import { useEffect, useMemo, useRef, useState } from 'react';
import { DateTime } from 'luxon';

import type { SessionUser } from '../../lib/auth';
import type {
  TrackerCasinoRow,
  TrackerStatusData,
  TrackerSuggestion,
} from '../../lib/tracker';
import AddToHomeScreen from '../retention/AddToHomeScreen';
import BookmarkPrompt from '../retention/BookmarkPrompt';
import PushOptIn from '../retention/PushOptIn';
import CasinoRow, { type CasinoRowViewModel } from './CasinoRow';
import PersonalizedIntelFeed from './PersonalizedIntelFeed';

interface DailyTrackerProps {
  user: SessionUser;
  initialData: TrackerStatusData;
  initialClaimCount: number;
  vapidPublicKey: string;
}

type ToastState = {
  tone: 'success' | 'error';
  message: string;
} | null;

type SearchResult = {
  id: number;
  name: string;
  slug: string;
  source: string;
};

export default function DailyTracker({
  user,
  initialData,
  initialClaimCount,
  vapidPublicKey,
}: DailyTrackerProps) {
  const [casinos, setCasinos] = useState(initialData.casinos);
  const [streakClaims, setStreakClaims] = useState(initialData.streakClaims);
  const [alerts, setAlerts] = useState(initialData.alerts);
  const [suggestions, setSuggestions] = useState<TrackerSuggestion[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [pendingClaimId, setPendingClaimId] = useState<number | null>(null);
  const [expandedClaimId, setExpandedClaimId] = useState<number | null>(null);
  const [reactingId, setReactingId] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [bulkImporting, setBulkImporting] = useState(false);
  const [claimCount, setClaimCount] = useState(initialClaimCount);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true);
        const response = await fetch(
          `/api/tracker/search?q=${encodeURIComponent(searchTerm.trim())}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        setSearchResults(data.results ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
        }
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [searchTerm]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const claimMap = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const claim of streakClaims) {
      const current = map.get(claim.casino_id) ?? [];
      current.push(claim.claimed_at);
      map.set(claim.casino_id, current);
    }
    return map;
  }, [streakClaims]);

  const casinoModels = useMemo(() => {
    const rows = casinos.map((casino) =>
      buildCasinoViewModel(casino, claimMap.get(casino.casino_id) ?? [], nowTs),
    );

    const hasManualSort = rows.some((row) => row.sortOrder !== null);

    return rows.sort((a, b) => {
      const statusOrder = statusRank(a.status) - statusRank(b.status);
      if (statusOrder !== 0) {
        return statusOrder;
      }

      if (hasManualSort) {
        const aSort = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const bSort = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (aSort !== bSort) {
          return aSort - bSort;
        }
      }

      const aNext = nextResetSortValue(a, user.timezone);
      const bNext = nextResetSortValue(b, user.timezone);
      if (aNext !== bNext) {
        return aNext - bNext;
      }

      return a.name.localeCompare(b.name);
    });
  }, [casinos, claimMap, nowTs, user.timezone]);

  async function refreshTracker() {
    const response = await fetch('/api/tracker/status');
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to refresh tracker.');
    }

    setCasinos(data.casinos ?? []);
    setStreakClaims(data.streakClaims ?? []);
    setAlerts(data.alerts ?? []);
  }

  async function loadSuggestions() {
    if (suggestionsLoading || suggestions) {
      return;
    }

    setSuggestionsLoading(true);
    try {
      const response = await fetch('/api/tracker/suggestions');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to load suggestions.');
      }
      setSuggestions(data.suggestions ?? []);
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: 'Unable to load more casinos.' });
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function handleClaim(casino: CasinoRowViewModel, scAmount: number | null) {
    const optimisticAt = new Date().toISOString();

    setPendingClaimId(casino.casinoId);
    setExpandedClaimId(null);
    setCasinos((current) =>
      current.map((row) =>
        row.casino_id === casino.casinoId
          ? {
              ...row,
              today_claim_id: -1,
              today_sc: scAmount,
              today_claimed_at: optimisticAt,
            }
          : row,
      ),
    );
    setStreakClaims((current) => [
      { casino_id: casino.casinoId, claimed_at: optimisticAt },
      ...current,
    ]);

    try {
      const response = await fetch('/api/tracker/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: casino.casinoId,
          claim_type: 'daily',
          sc_amount: scAmount,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save claim.');
      }

      setCasinos((current) =>
        current.map((row) =>
          row.casino_id === casino.casinoId
            ? {
                ...row,
                today_claim_id: data.claim_id,
                today_sc: scAmount,
                today_claimed_at: data.claimed_at,
              }
            : row,
        ),
      );
      setStreakClaims((current) => {
        const withoutOptimistic = current.filter(
          (claim) =>
            !(claim.casino_id === casino.casinoId && claim.claimed_at === optimisticAt),
        );
        return [
          { casino_id: casino.casinoId, claimed_at: data.claimed_at },
          ...withoutOptimistic,
        ];
      });
      setClaimCount((current) => current + 1);
      setToast({ tone: 'success', message: `${casino.name} marked claimed.` });
    } catch (error) {
      console.error(error);
      await refreshTracker().catch((refreshError) => console.error(refreshError));
      setToast({ tone: 'error', message: 'Claim failed. Try again.' });
    } finally {
      setPendingClaimId(null);
    }
  }

  async function handleRemove(casino: CasinoRowViewModel) {
    if (!window.confirm(`Remove ${casino.name} from tracker?`)) {
      return;
    }

    try {
      const response = await fetch('/api/tracker/remove-casino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casino_id: casino.casinoId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to remove casino.');
      }

      const removed = casinos.find((item) => item.casino_id === casino.casinoId);
      if (removed && removed.source === 'admin' && suggestions) {
        setSuggestions((current) =>
          current
            ? [{ ...toSuggestionFromCasino(removed), sort_sc: null }, ...current]
            : current,
        );
      }
      setCasinos((current) =>
        current.filter((row) => row.casino_id !== casino.casinoId),
      );
      setToast({ tone: 'success', message: `${casino.name} removed.` });
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: 'Unable to remove casino.' });
    }
  }

  async function handleAddExisting(casinoId: number, fireAffiliate: boolean) {
    try {
      const response = await fetch('/api/tracker/add-casino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casino_id: casinoId,
          fire_affiliate: fireAffiliate,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to add casino.');
      }

      const suggestion = suggestions?.find((item) => item.id === casinoId);
      if (suggestion) {
        setCasinos((current) => [
          ...current,
          {
            casino_id: suggestion.id,
            sort_order: null,
            typical_daily_sc: null,
            personal_notes: null,
            name: suggestion.name,
            slug: suggestion.slug,
            streak_mode: 'rolling',
            reset_time_local: null,
            reset_timezone: null,
            has_streaks: false,
            sc_to_usd_ratio: suggestion.sc_to_usd_ratio,
            has_affiliate_link: suggestion.has_affiliate_link,
            source: 'admin',
            daily_bonus_desc: suggestion.daily_bonus_desc,
            today_claim_id: null,
            today_sc: null,
            today_claimed_at: null,
          },
        ]);
      }

      setSuggestions((current) =>
        current ? current.filter((item) => item.id !== casinoId) : current,
      );
      setToast({
        tone: 'success',
        message: fireAffiliate
          ? `${suggestion?.name ?? 'Casino'} added to your tracker. Come back here after you sign up to start tracking.`
          : 'Casino added to tracker.',
      });

      if (fireAffiliate && data.affiliate_url) {
        window.open(data.affiliate_url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: 'Unable to add casino.' });
    }
  }

  async function handleAddSearch(selected?: SearchResult) {
    const normalized = searchTerm.trim();
    const target = selected?.name ?? normalized;

    if (!target) {
      return;
    }

    if (!selected && !window.confirm(`Add ${target} as a new casino?`)) {
      return;
    }

    try {
      const response = await fetch('/api/tracker/add-casino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          selected
            ? { casino_id: selected.id, fire_affiliate: false }
            : { casino_name: target, fire_affiliate: false },
        ),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to add casino.');
      }

      if (!data.skipped_duplicate) {
        setToast({ tone: 'success', message: `${target} added to tracker.` });
        await refreshTracker();
      }

      setSearchTerm('');
      setSearchResults([]);
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: 'Unable to add casino.' });
    }
  }

  async function handleBulkImport(file: File) {
    setBulkImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/tracker/bulk-import', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to import casinos.');
      }

      setToast({
        tone: 'success',
        message: `Added ${data.added} casinos. ${data.matched_existing} matched existing, ${data.created_suggested} new suggestions.`,
      });

      await refreshTracker();
    } catch (error) {
      console.error(error);
      setToast({ tone: 'error', message: 'Bulk import failed.' });
    } finally {
      setBulkImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleReact(itemId: number, reaction: 'confirm' | 'dispute') {
    setReactingId(itemId);
    const prior = alerts;
    setAlerts((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              confirm_count:
                reaction === 'confirm' ? item.confirm_count + 1 : item.confirm_count,
              dispute_count:
                reaction === 'dispute' ? item.dispute_count + 1 : item.dispute_count,
            }
          : item,
      ),
    );

    try {
      const response = await fetch('/api/discord/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, reaction }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save reaction.');
      }

      setAlerts((current) =>
        current.map((item) =>
          item.id === itemId
            ? {
                ...item,
                confirm_count: data.confirm_count,
                dispute_count: data.dispute_count,
              }
            : item,
        ),
      );
    } catch (error) {
      console.error(error);
      setAlerts(prior);
      setToast({ tone: 'error', message: 'Reaction failed.' });
    } finally {
      setReactingId(null);
    }
  }

  return (
    <div className="tracker-shell">
      <AddToHomeScreen />
      <PushOptIn claimCount={claimCount} vapidPublicKey={vapidPublicKey} />
      <BookmarkPrompt claimCount={claimCount} />

      {toast ? (
        <div className={`toast toast-${toast.tone}`}>{toast.message}</div>
      ) : null}

      <section className="surface-card tracker-section">
        <div className="section-heading">
          <div>
            <h1 className="section-title">Your Casinos</h1>
            <span className="count-badge">{casinoModels.length} casinos</span>
          </div>
        </div>

        <div className="search-bar">
          <div className="search-input-wrap">
            <input
              type="text"
              placeholder="Search or add a casino..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleAddSearch(searchResults[0]);
                }
              }}
            />
            {searching ? <span className="muted">Searching...</span> : null}
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            {bulkImporting ? 'Importing...' : 'Import file'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleBulkImport(file);
              }
            }}
          />
        </div>

        {searchResults.length > 0 ? (
          <div className="search-results">
            {searchResults.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => void handleAddSearch(result)}
              >
                {result.name}
              </button>
            ))}
          </div>
        ) : null}

        {casinoModels.length === 0 ? (
          <div className="empty-state">
            <p>You're not tracking any casinos yet. Search above to add one, or browse the suggestions below.</p>
            <a href="/getting-started">New here? Start with our guide {'->'}</a>
          </div>
        ) : (
          <div className="casino-list">
            {casinoModels.map((casino) => (
              <CasinoRow
                key={casino.casinoId}
                casino={casino}
                ledgerMode={user.ledgerMode}
                userTimezone={user.timezone}
                nowTs={nowTs}
                pending={pendingClaimId === casino.casinoId}
                expanded={expandedClaimId === casino.casinoId}
                onClaimSimple={() => void handleClaim(casino, null)}
                onClaimAdvancedOpen={() => setExpandedClaimId(casino.casinoId)}
                onClaimAdvancedCommit={(amount) => handleClaim(casino, amount)}
                onClaimAdvancedCancel={() => setExpandedClaimId(null)}
                onRemove={() => void handleRemove(casino)}
              />
            ))}
          </div>
        )}
      </section>

      <PersonalizedIntelFeed
        items={alerts}
        nowTs={nowTs}
        reactingId={reactingId}
        onReact={(itemId, reaction) => void handleReact(itemId, reaction)}
      />

      <section className="surface-card tracker-section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Explore More Casinos</h2>
            <p className="muted">Add more daily claim opportunities without leaving your tracker tab.</p>
          </div>
          {!suggestions ? (
            <button type="button" onClick={() => void loadSuggestions()}>
              {suggestionsLoading ? 'Loading...' : 'Show more casinos'}
            </button>
          ) : null}
        </div>

        {!suggestions ? (
          <div className="empty-state">
            <p>Load personalized suggestions when you're ready. This keeps the first tracker view fast.</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="empty-state">
            <p>You've added all our tracked casinos. Nice.</p>
            <button type="button" onClick={() => document.querySelector('input')?.focus()}>
              Suggest a casino {'->'}
            </button>
          </div>
        ) : (
          <div className="suggestions-grid">
            {suggestions.map((casino) => (
              <article key={casino.id} className="suggestion-card">
                <div className="suggestion-copy">
                  <a href={`/casinos/${casino.slug}`} className="casino-link">
                    {casino.name}
                  </a>
                  <p className="muted">{casino.daily_bonus_desc ?? 'Daily bonus details coming soon.'}</p>
                  <div className="muted">
                    ~{formatSortSc(casino.sort_sc)} SC/day (~$
                    {formatUsdEstimate(casino.sort_sc, casino.sc_to_usd_ratio)})
                  </div>
                </div>
                <div className="suggestion-actions">
                  <button type="button" onClick={() => void handleAddExisting(casino.id, true)}>
                    Join {'->'}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void handleAddExisting(casino.id, false)}
                  >
                    Already a member? Add to tracker
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .tracker-shell {
          display: grid;
          gap: 2rem;
        }

        .tracker-section {
          display: grid;
          gap: 1rem;
          padding: 1.25rem;
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .count-badge {
          display: inline-flex;
          margin-top: 0.35rem;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.08);
          color: var(--color-primary);
          padding: 0.3rem 0.7rem;
          font-weight: 700;
        }

        .search-bar {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .search-input-wrap {
          flex: 1 1 20rem;
          display: grid;
          gap: 0.35rem;
        }

        .search-bar input {
          border: 1px solid var(--color-border);
          border-radius: 999px;
          padding: 0.9rem 1rem;
          font: inherit;
        }

        .search-bar button,
        .suggestion-actions button,
        .empty-state button {
          border: none;
          border-radius: 999px;
          padding: 0.85rem 1rem;
          background: var(--color-primary);
          color: #fff;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .search-results {
          display: grid;
          gap: 0.55rem;
        }

        .search-results button {
          text-align: left;
          padding: 0.8rem 0.95rem;
          border-radius: 1rem;
          border: 1px solid var(--color-border);
          background: #fff;
          font: inherit;
          cursor: pointer;
        }

        .empty-state {
          display: grid;
          gap: 0.8rem;
          padding: 1.2rem;
          border: 1px dashed var(--color-border);
          border-radius: 1.2rem;
          color: var(--color-muted);
          background: rgba(255, 255, 255, 0.6);
        }

        .empty-state p {
          margin: 0;
          line-height: 1.6;
        }

        .empty-state a {
          font-weight: 700;
        }

        .casino-list,
        .suggestions-grid {
          display: grid;
          gap: 1rem;
        }

        .suggestion-card {
          display: grid;
          gap: 1rem;
          padding: 1rem;
          border-radius: 1.2rem;
          border: 1px solid var(--color-border);
          background: #fff;
        }

        .suggestion-copy {
          display: grid;
          gap: 0.45rem;
        }

        .suggestion-copy p {
          margin: 0;
        }

        .suggestion-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .suggestion-actions .ghost {
          background: #fff;
          color: var(--color-ink);
          border: 1px solid var(--color-border);
        }

        .toast {
          position: sticky;
          top: 1rem;
          z-index: 20;
          justify-self: center;
          padding: 0.85rem 1rem;
          border-radius: 999px;
          font-weight: 700;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
        }

        .toast-success {
          background: #ecfdf5;
          color: #065f46;
        }

        .toast-error {
          background: #fef2f2;
          color: #991b1b;
        }
      `}</style>
    </div>
  );
}

function buildCasinoViewModel(
  casino: TrackerCasinoRow,
  claims: string[],
  nowTs: number,
): CasinoRowViewModel {
  const todayClaimedAt = casino.today_claimed_at;
  const lastClaimedAt = todayClaimedAt ?? claims[0] ?? null;
  const status = todayClaimedAt
    ? 'claimed'
    : isAvailableNow(casino, lastClaimedAt, nowTs)
      ? 'available'
      : 'countdown';

  return {
    casinoId: casino.casino_id,
    name: casino.name,
    slug: casino.slug,
    source: casino.source,
    dailyBonusDesc: casino.daily_bonus_desc,
    sortOrder: casino.sort_order,
    streakMode: casino.streak_mode,
    resetTimeLocal: casino.reset_time_local,
    resetTimezone: casino.reset_timezone,
    hasStreaks: casino.has_streaks,
    todayClaimId: casino.today_claim_id,
    todaySc: casino.today_sc,
    todayClaimedAt,
    lastClaimedAt,
    status,
    streakText: casino.has_streaks ? buildStreakText(claims, nowTs) : null,
  };
}

function isAvailableNow(
  casino: TrackerCasinoRow,
  lastClaimedAt: string | null,
  nowTs: number,
) {
  const now = DateTime.fromMillis(nowTs);

  if (casino.streak_mode === 'fixed') {
    if (!casino.reset_time_local || !casino.reset_timezone) {
      return false;
    }

    const [hour, minute] = casino.reset_time_local.split(':').map(Number);
    const reset = now
      .setZone(casino.reset_timezone)
      .set({ hour, minute, second: 0, millisecond: 0 });

    return now.setZone(casino.reset_timezone) >= reset;
  }

  if (!lastClaimedAt) {
    return true;
  }

  const nextAvailable = DateTime.fromISO(lastClaimedAt).plus({ hours: 24 });
  return nextAvailable <= now;
}

function buildStreakText(claims: string[], nowTs: number) {
  if (claims.length === 0) {
    return 'Streak: 0';
  }

  const now = DateTime.fromMillis(nowTs);
  const latest = DateTime.fromISO(claims[0]);
  if (!latest.isValid) {
    return 'Streak: 0';
  }

  if (now.diff(latest, 'hours').hours > 48) {
    return `Streak: 0 (broke ${Math.floor(now.diff(latest, 'days').days)}d ago)`;
  }

  let streak = 1;
  for (let index = 1; index < claims.length; index += 1) {
    const previous = DateTime.fromISO(claims[index - 1]);
    const current = DateTime.fromISO(claims[index]);
    if (!previous.isValid || !current.isValid) {
      break;
    }

    if (previous.diff(current, 'hours').hours <= 48) {
      streak += 1;
    } else {
      break;
    }
  }

  return `${streak} days`;
}

function statusRank(status: CasinoRowViewModel['status']) {
  if (status === 'available') {
    return 0;
  }
  if (status === 'countdown') {
    return 1;
  }
  return 2;
}

function nextResetSortValue(
  casino: CasinoRowViewModel,
  userTimezone: string,
) {
  if (casino.status === 'claimed') {
    return Number.MAX_SAFE_INTEGER;
  }

  if (casino.status === 'available') {
    return 0;
  }

  if (casino.streakMode === 'fixed' && casino.resetTimeLocal && casino.resetTimezone) {
    const [hour, minute] = casino.resetTimeLocal.split(':').map(Number);
    const now = DateTime.now().setZone(casino.resetTimezone);
    let next = now.set({ hour, minute, second: 0, millisecond: 0 });
    if (now >= next) {
      next = next.plus({ days: 1 });
    }
    return next.setZone(userTimezone).toMillis();
  }

  if (casino.lastClaimedAt) {
    return DateTime.fromISO(casino.lastClaimedAt).plus({ hours: 24 }).toMillis();
  }

  return 0;
}

function toSuggestionFromCasino(casino: TrackerCasinoRow): TrackerSuggestion {
  return {
    id: casino.casino_id,
    name: casino.name,
    slug: casino.slug,
    daily_bonus_desc: casino.daily_bonus_desc,
    has_affiliate_link: casino.has_affiliate_link,
    affiliate_link_url: null,
    tier: 2,
    sc_to_usd_ratio: casino.sc_to_usd_ratio,
    sort_sc: null,
  };
}

function formatSortSc(value: number | string | null) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  return Number(value).toFixed(0);
}

function formatUsdEstimate(
  scValue: number | string | null,
  ratioValue: number | string | null,
) {
  const sc = Number(scValue);
  const ratio = Number(ratioValue);
  if (!Number.isFinite(sc) || !Number.isFinite(ratio) || ratio <= 0) {
    return '--';
  }

  return (sc / ratio).toFixed(0);
}
