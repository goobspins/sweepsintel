import { useEffect, useMemo, useState } from 'react';

import type { DashboardSearchResult } from './types';
import { getTierBadgeStyle, normalizeCasinoName } from './utils';

interface CasinoSearchProps {
  trackedCasinoIds: Set<number>;
  onAddCasino: (casinoId: number, name: string) => void | Promise<void>;
  onCreateCasino: (name: string) => void | Promise<void>;
  pendingKey: string | null;
}

async function readApiResponse(response: Response) {
  const contentType = response.headers.get('Content-Type') ?? '';
  const rawText = await response.text();
  if (contentType.includes('application/json')) {
    try {
      return rawText ? JSON.parse(rawText) : {};
    } catch {
      return {};
    }
  }
  return {};
}

export default function CasinoSearch({
  trackedCasinoIds,
  onAddCasino,
  onCreateCasino,
  pendingKey,
}: CasinoSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DashboardSearchResult[]>([]);
  const [nearMatch, setNearMatch] = useState<DashboardSearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const normalizedSearch = useMemo(() => normalizeCasinoName(searchQuery), [searchQuery]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setNearMatch(null);
      setSearchLoading(false);
      setSearchOpen(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/tracker/search?q=${encodeURIComponent(trimmed)}`);
        const data = await readApiResponse(response);
        if (!response.ok) {
          throw new Error(data.error ?? 'Unable to search casinos.');
        }
        setSearchResults((data.results ?? []).slice(0, 5));
        setNearMatch(data.near_match ?? null);
        setSearchOpen(true);
      } catch (error) {
        console.error(error);
        setSearchResults([]);
        setNearMatch(null);
        setSearchOpen(true);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  return (
    <div className="search-shell">
      <input
        className="search-input"
        type="text"
        placeholder="Search casinos to add..."
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onFocus={() => {
          if (searchQuery.trim().length >= 2) {
            setSearchOpen(true);
          }
        }}
      />
      {searchOpen ? (
        <div className="search-dropdown">
          {nearMatch && normalizedSearch && !trackedCasinoIds.has(nearMatch.id) ? (
            <div className="near-match-card">
              <span className="near-match-copy">
                Did you mean <strong>{nearMatch.name}</strong>?
              </span>
              <div className="near-match-actions">
                <button type="button" className="search-add" onClick={() => void onAddCasino(nearMatch.id, nearMatch.name)}>
                  Yes, use this
                </button>
                <button
                  type="button"
                  className="search-add search-add-ghost"
                  onClick={() => void onCreateCasino(searchQuery)}
                  disabled={pendingKey === `create:${searchQuery.trim()}`}
                >
                  No, add as {`"${searchQuery.trim()}"`}
                </button>
              </div>
            </div>
          ) : null}
          {searchLoading ? <div className="search-empty">Searching...</div> : null}
          {!searchLoading && searchResults.length > 0
            ? searchResults.map((result) => {
                const addPending = pendingKey === `add:${result.id}`;
                const alreadyTracking = trackedCasinoIds.has(result.id);
                return (
                  <div key={result.id} className={`search-result ${alreadyTracking ? 'search-result-tracked' : ''}`}>
                    <div className="search-result-copy">
                      <span className="search-result-name">{result.name}</span>
                      {result.tier ? (
                        <span className="tier-badge" style={getTierBadgeStyle(result.tier)}>{result.tier}</span>
                      ) : null}
                    </div>
                    {alreadyTracking ? (
                      <span className="search-tracked">Already tracking</span>
                    ) : (
                      <button type="button" className="search-add" onClick={() => void onAddCasino(result.id, result.name)} disabled={addPending}>
                        {addPending ? 'Adding...' : 'Add'}
                      </button>
                    )}
                  </div>
                );
              })
            : null}
          {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
            <div className="search-empty">
              <span>No casinos found.</span>
              <span className="search-suggest">Suggest a casino</span>
            </div>
          ) : null}
          {!searchLoading && searchQuery.trim().length >= 2 && !nearMatch ? (
            <button
              type="button"
              className="add-typed-button"
              onClick={() => void onCreateCasino(searchQuery)}
              disabled={pendingKey === `create:${searchQuery.trim()}`}
            >
              {pendingKey === `create:${searchQuery.trim()}` ? 'Adding...' : `Add "${searchQuery.trim()}"`}
            </button>
          ) : null}
        </div>
      ) : null}
      <style>{`
        .search-shell { position: relative; min-width: 0; }
        .search-input {
          width: 100%;
          border: 1px solid var(--color-border);
          border-radius: 1rem;
          background: var(--bg-primary);
          color: var(--text-primary);
          padding: 0.88rem 1rem;
          font: inherit;
        }
        .search-dropdown {
          position: absolute;
          z-index: 5;
          top: calc(100% + 0.5rem);
          left: 0;
          right: 0;
          display: grid;
          gap: 0.35rem;
          padding: 0.5rem;
          border: 1px solid var(--color-border);
          border-radius: 1rem;
          background: var(--bg-secondary);
          box-shadow: 0 18px 40px rgba(2, 6, 23, 0.42);
        }
        .search-result {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          border-radius: 0.9rem;
          padding: 0.65rem 0.7rem;
          background: rgba(17, 24, 39, 0.45);
        }
        .search-result-copy { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; min-width: 0; }
        .search-result-name { color: var(--text-primary); font-weight: 700; }
        .tier-badge { display: inline-flex; min-width: 2rem; justify-content: center; border-radius: 999px; padding: 0.25rem 0.55rem; font-size: 0.78rem; font-weight: 800; border: 1px solid transparent; }
        .search-add { border: none; border-radius: 999px; background: var(--accent-blue); color: var(--text-primary); padding: 0.58rem 0.9rem; font: inherit; font-weight: 700; cursor: pointer; }
        .search-add-ghost { background: transparent; border: 1px solid var(--color-border); color: var(--text-secondary); }
        .search-result-tracked { opacity: 0.65; }
        .search-tracked { color: var(--text-muted); font-size: 0.88rem; font-weight: 700; }
        .near-match-card { display: grid; gap: 0.5rem; padding: 0.75rem; border-radius: 0.95rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); }
        .near-match-copy { color: var(--text-primary); }
        .near-match-actions { display: flex; gap: 0.55rem; flex-wrap: wrap; }
        .search-empty { display: grid; gap: 0.2rem; padding: 0.7rem 0.8rem; color: var(--text-secondary); }
        .search-suggest { color: var(--text-muted); font-size: 0.88rem; }
        .add-typed-button { border: 1px dashed var(--color-border); border-radius: 0.95rem; background: transparent; color: var(--text-primary); padding: 0.8rem 0.9rem; font: inherit; font-weight: 700; text-align: left; cursor: pointer; }
      `}</style>
    </div>
  );
}

