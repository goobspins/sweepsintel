import { useMemo, useState } from 'react';

type PreviewRow = Record<string, string>;
type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
};

const IMPORT_OPTIONS = [
  { value: 'skip', label: 'Skip' },
  { value: 'slug', label: 'slug' },
  { value: 'name', label: 'name' },
  { value: 'tier', label: 'tier -> tier_label' },
  { value: 'claim_url', label: 'claim_url' },
  { value: 'reset_mode', label: 'reset_mode' },
  { value: 'reset_time_local', label: 'reset_time_local' },
  { value: 'reset_timezone', label: 'reset_timezone' },
  { value: 'reset_interval_hours', label: 'reset_interval_hours' },
  { value: 'has_streaks', label: 'has_streaks' },
  { value: 'sc_to_usd_ratio', label: 'sc_to_usd_ratio' },
  { value: 'parent_company', label: 'parent_company' },
  { value: 'promoban_risk', label: 'promoban_risk' },
  { value: 'hardban_risk', label: 'hardban_risk' },
  { value: 'family_ban_propagation', label: 'family_ban_propagation' },
  { value: 'ban_confiscates_funds', label: 'ban_confiscates_funds' },
  { value: 'daily_bonus_sc_avg', label: 'daily_bonus_sc_avg' },
  { value: 'has_live_games', label: 'has_live_games' },
  { value: 'live_game_providers', label: 'live_game_providers' },
  { value: 'min_redemption_usd', label: 'min_redemption_usd' },
  { value: 'has_affiliate_link', label: 'has_affiliate_link' },
  { value: 'affiliate_link_url', label: 'affiliate_link_url' },
  { value: 'affiliate_type', label: 'affiliate_type' },
  { value: 'affiliate_notes', label: 'affiliate_notes (ignored)' },
] as const;

const AUTO_MAP: Record<string, string> = {
  slug: 'slug',
  name: 'name',
  tier: 'tier',
  claim_url: 'claim_url',
  reset_mode: 'reset_mode',
  reset_time_local: 'reset_time_local',
  reset_timezone: 'reset_timezone',
  reset_interval_hours: 'reset_interval_hours',
  has_streaks: 'has_streaks',
  sc_to_usd_ratio: 'sc_to_usd_ratio',
  parent_company: 'parent_company',
  promoban_risk: 'promoban_risk',
  hardban_risk: 'hardban_risk',
  family_ban_propagation: 'family_ban_propagation',
  ban_confiscates_funds: 'ban_confiscates_funds',
  daily_bonus_sc_avg: 'daily_bonus_sc_avg',
  has_live_games: 'has_live_games',
  live_game_providers: 'live_game_providers',
  min_redemption_usd: 'min_redemption_usd',
  has_affiliate_link: 'has_affiliate_link',
  affiliate_link_url: 'affiliate_link_url',
  affiliate_type: 'affiliate_type',
  affiliate_notes: 'affiliate_notes',
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function parseDelimited(content: string, delimiter: ',' | '\t') {
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

    if (char === delimiter && !inQuotes) {
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
    return { headers: [] as string[], rows: [] as PreviewRow[] };
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((value) => value.trim());
  const parsedRows = dataRows.map((row) => {
    const record: PreviewRow = {};
    headers.forEach((header, index) => {
      record[header] = (row[index] ?? '').trim();
    });
    return record;
  });

  return { headers, rows: parsedRows };
}

async function readApiResponse(response: Response) {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function CasinoImporter() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const previewRows = rows.slice(0, 10);
  const importableCount = useMemo(() => {
    const nameHeader = headers.find((header) => mapping[header] === 'name');
    if (!nameHeader) return 0;
    return rows.filter((row) => (row[nameHeader] ?? '').trim().length > 0).length;
  }, [headers, mapping, rows]);

  function reset() {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setLoading(false);
    setImporting(false);
    setError(null);
    setResult(null);
  }

  function applyPreview(nextHeaders: string[], nextRows: PreviewRow[]) {
    setHeaders(nextHeaders);
    setRows(nextRows);
    setMapping(
      Object.fromEntries(
        nextHeaders.map((header) => {
          const normalized = normalizeHeader(header);
          return [header, AUTO_MAP[normalized] ?? 'skip'];
        }),
      ),
    );
    setError(null);
    setResult(null);
  }

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
        const text = await file.text();
        const parsed = parseDelimited(text, lowerName.endsWith('.tsv') ? '\t' : ',');
        applyPreview(parsed.headers, parsed.rows);
      } else if (lowerName.endsWith('.xlsx')) {
        const formData = new FormData();
        formData.set('action', 'preview');
        formData.set('file', file);
        const response = await fetch('/api/admin/import-casinos', {
          method: 'POST',
          body: formData,
        });
        const data = await readApiResponse(response);
        if (!response.ok) {
          throw new Error(data.error ?? 'Unable to preview import file.');
        }
        applyPreview(Array.isArray(data.headers) ? data.headers : [], Array.isArray(data.rows) ? data.rows : []);
      } else {
        throw new Error('Unsupported file type. Use CSV, TSV, or XLSX.');
      }
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : 'Unable to read import file.');
      setHeaders([]);
      setRows([]);
      setMapping({});
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/import-casinos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, mapping }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to import casinos.');
      }
      setResult({
        created: Number(data.created ?? 0),
        updated: Number(data.updated ?? 0),
        skipped: Number(data.skipped ?? 0),
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
      });
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : 'Unable to import casinos.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="surface-card importer-shell">
      <div className="importer-head">
        <div>
          <div className="eyebrow">Casino Importer</div>
          <h1 className="section-title importer-title">Import casino spreadsheet</h1>
          <p className="muted importer-copy">
            Upload CSV, TSV, or XLSX, preview the mapped fields, then upsert into the live casinos table.
          </p>
        </div>
      </div>

      {!result ? (
        <>
          <label className="upload-card">
            <span className="upload-label">Upload file</span>
            <input
              type="file"
              accept=".csv,.tsv,.xlsx"
              onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
            />
            <span className="muted">Supported columns: 23. Blank cells do not overwrite existing data.</span>
          </label>

          {loading ? <div className="status-card">Preparing preview...</div> : null}
          {error ? <div className="status-card status-error">{error}</div> : null}

          {rows.length > 0 ? (
            <>
              <section className="import-section">
                <div className="section-topline">
                  <h2 className="import-section-title">Column mapping</h2>
                  <span className="muted">{rows.length} casinos found, {importableCount} will be imported</span>
                </div>
                <div className="mapping-grid">
                  {headers.map((header) => (
                    <label key={header} className="mapping-row">
                      <span className="mapping-header">{header}</span>
                      <select
                        value={mapping[header] ?? 'skip'}
                        onChange={(event) =>
                          setMapping((current) => ({ ...current, [header]: event.target.value }))
                        }
                      >
                        {IMPORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </section>

              <section className="import-section">
                <div className="section-topline">
                  <h2 className="import-section-title">Preview</h2>
                  <span className="muted">First 10 rows</span>
                </div>
                <div className="preview-wrap">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        {headers.map((header) => (
                          <th key={header}>
                            <div className="preview-head">
                              <span>{header}</span>
                              <small>{mapping[header] ?? 'skip'}</small>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, index) => {
                        const nameHeader = headers.find((header) => mapping[header] === 'name');
                        const missingName = nameHeader ? !(row[nameHeader] ?? '').trim() : true;
                        return (
                          <tr key={`${index}-${row[headers[0]] ?? 'row'}`} className={missingName ? 'preview-row-missing' : ''}>
                            {headers.map((header) => (
                              <td key={`${index}-${header}`}>{row[header] || '--'}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="import-actions">
                <button type="button" className="ghost-button" onClick={reset} disabled={importing}>
                  Reset
                </button>
                <button type="button" className="primary-button" onClick={() => void handleImport()} disabled={importing || importableCount === 0}>
                  {importing ? 'Importing...' : `Import ${importableCount} casinos`}
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <section className="result-card">
          <h2 className="import-section-title">Import complete</h2>
          <div className="result-grid">
            <div className="result-stat"><span>Created</span><strong>{result.created}</strong></div>
            <div className="result-stat"><span>Updated</span><strong>{result.updated}</strong></div>
            <div className="result-stat"><span>Skipped</span><strong>{result.skipped}</strong></div>
          </div>
          {result.warnings.length > 0 ? (
            <div className="warnings-list">
              {result.warnings.map((warning) => (
                <div key={warning} className="warning-row">{warning}</div>
              ))}
            </div>
          ) : null}
          <button type="button" className="primary-button" onClick={reset}>
            Import more
          </button>
        </section>
      )}

      <style>{`
        .importer-shell { display:grid; gap:1.1rem; padding:1.25rem; }
        .eyebrow { color:var(--text-muted); font-size:.76rem; text-transform:uppercase; letter-spacing:.12em; font-weight:700; }
        .importer-title { margin:.15rem 0 0; }
        .importer-copy { margin:.35rem 0 0; }
        .upload-card, .status-card, .result-card {
          display:grid; gap:.5rem; padding:1rem; border-radius:1rem; border:1px solid var(--color-border); background:rgba(17, 24, 39, 0.42);
        }
        .status-error { color:var(--accent-red); }
        .upload-card input { color:var(--text-primary); }
        .upload-label, .import-section-title { font-size:1rem; font-weight:800; margin:0; }
        .import-section { display:grid; gap:.75rem; }
        .section-topline { display:flex; justify-content:space-between; gap:1rem; align-items:center; flex-wrap:wrap; }
        .mapping-grid { display:grid; gap:.75rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .mapping-row { display:grid; gap:.35rem; }
        .mapping-header { font-weight:700; color:var(--text-primary); }
        .mapping-row select {
          border:1px solid var(--color-border); border-radius:.9rem; background:var(--bg-primary); color:var(--text-primary); padding:.75rem .85rem;
        }
        .preview-wrap { overflow:auto; border:1px solid var(--color-border); border-radius:1rem; }
        .preview-table { width:100%; border-collapse:collapse; min-width:720px; }
        .preview-table th, .preview-table td { padding:.75rem .8rem; border-bottom:1px solid var(--color-border); text-align:left; vertical-align:top; }
        .preview-table tbody tr:nth-child(odd) { background:rgba(17, 24, 39, 0.38); }
        .preview-table tbody tr:nth-child(even) { background:rgba(17, 24, 39, 0.52); }
        .preview-row-missing { box-shadow: inset 3px 0 0 var(--accent-red); }
        .preview-head { display:grid; gap:.15rem; }
        .preview-head small { color:var(--text-muted); font-size:.72rem; text-transform:uppercase; letter-spacing:.08em; }
        .import-actions { display:flex; gap:.75rem; justify-content:flex-end; flex-wrap:wrap; }
        .primary-button, .ghost-button {
          border:none; border-radius:999px; padding:.82rem 1rem; font:inherit; font-weight:700; cursor:pointer;
        }
        .primary-button { background:var(--accent-blue); color:var(--text-primary); }
        .ghost-button { background:transparent; color:var(--text-primary); border:1px solid var(--color-border); }
        .primary-button:disabled, .ghost-button:disabled { opacity:.65; cursor:not-allowed; }
        .result-grid { display:grid; gap:.75rem; grid-template-columns:repeat(3, minmax(0, 1fr)); }
        .result-stat { display:grid; gap:.3rem; padding:.9rem; border:1px solid var(--color-border); border-radius:1rem; background:rgba(17, 24, 39, 0.45); }
        .result-stat span { color:var(--text-muted); text-transform:uppercase; letter-spacing:.08em; font-size:.74rem; font-weight:700; }
        .result-stat strong { font-size:1.7rem; color:var(--text-primary); }
        .warnings-list { display:grid; gap:.5rem; }
        .warning-row { padding:.7rem .8rem; border-radius:.9rem; background:rgba(245, 158, 11, 0.12); border:1px solid rgba(245, 158, 11, 0.24); color:var(--accent-yellow); }
        @media (max-width: 860px) { .mapping-grid, .result-grid { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}
