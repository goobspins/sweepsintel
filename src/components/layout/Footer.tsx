export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid rgba(15, 23, 42, 0.08)',
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: '2rem 1.25rem 3rem',
          display: 'grid',
          gap: '0.5rem',
          color: '#475569',
        }}
      >
        <div style={{ fontWeight: 700, color: '#0f172a' }}>SweepsIntel</div>
        <div>Not affiliated with any casino.</div>
        <div>Copyright 2026 SweepsIntel.</div>
        <a href="#" style={{ color: '#0f172a', textDecoration: 'none' }}>
          Privacy policy
        </a>
      </div>
    </footer>
  );
}
