interface DangerZoneSectionProps {
  onLogout: () => void | Promise<void>;
}

export default function DangerZoneSection({ onLogout }: DangerZoneSectionProps) {
  return (
    <section className="surface-card settings-section">
      <div className="eyebrow">Account</div>
      <h2 className="section-title section-heading">Danger Zone</h2>
      <p className="muted">Log out of this device.</p>
      <button type="button" className="ghost-button" onClick={() => void onLogout()}>Log out</button>
      <style>{`
        .settings-section { display:grid; gap:1rem; padding:1.2rem; }
        .section-heading, .muted { margin:0; }
        .ghost-button {
          width:max-content;
          border:1px solid var(--color-border);
          border-radius:999px;
          padding:.85rem 1rem;
          background:var(--color-surface);
          color:var(--color-ink);
          font:inherit;
          font-weight:700;
          cursor:pointer;
        }
      `}</style>
    </section>
  );
}
