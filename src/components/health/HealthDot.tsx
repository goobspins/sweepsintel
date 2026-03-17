interface HealthDotProps {
  status: string | null | undefined;
  size?: number;
  pulse?: boolean;
}

const COLORS: Record<string, string> = {
  healthy: 'var(--accent-green)',
  watch: 'var(--accent-yellow)',
  at_risk: 'var(--accent-red)',
  critical: '#f43f5e',
};

export default function HealthDot({ status, size = 10, pulse = false }: HealthDotProps) {
  const color = COLORS[status ?? ''] ?? 'var(--text-muted)';
  return (
    <>
      <span
        className={`health-dot${pulse && status === 'critical' ? ' health-dot-pulse' : ''}`}
        style={{ width: size, height: size, background: color, boxShadow: `0 0 0 3px ${color}22` }}
        aria-label={status ?? 'unknown'}
        title={status ? status.replace(/_/g, ' ') : 'unknown'}
      />
      <style>{`
        .health-dot {
          display: inline-flex;
          border-radius: 999px;
          flex-shrink: 0;
        }
        .health-dot-pulse {
          animation: healthPulse 1.6s ease-in-out infinite;
        }
        @keyframes healthPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.75; }
        }
      `}</style>
    </>
  );
}
