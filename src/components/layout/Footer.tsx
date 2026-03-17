export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--bg-secondary)',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--content-max-width)',
          margin: '0 auto',
          padding: '2rem var(--content-gutter) 3rem',
          display: 'grid',
          gap: '0.5rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>SweepsIntel</div>
        <div>Not affiliated with any casino.</div>
        <div>Copyright 2026 SweepsIntel.</div>
        <a href="#" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
          Privacy policy
        </a>
      </div>
    </footer>
  );
}

