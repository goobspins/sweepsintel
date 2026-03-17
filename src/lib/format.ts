export function formatAgo(value: string): string {
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return 'now';

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;

  return new Date(value).toLocaleDateString();
}

export function formatRelativeExpiry(value: string): string {
  const ms = new Date(value).getTime() - Date.now();
  if (Number.isNaN(ms)) return 'Expiry unknown';
  if (ms <= 0) return 'Expired';

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `Expires in ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return `Expires in ${hours}h ${remainder}m`;

  const days = Math.floor(hours / 24);
  return `Expires in ${days}d`;
}

export function emailToDisplayName(email: string): string {
  const local = email.split('@')[0] ?? 'User';
  if (!local) return 'User';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatCurrencySigned(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'exceptZero',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSignedNumber(value: number): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

export function formatSc(value: number): string {
  return formatNumber(value);
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString();
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

export function formatDateTimeCompact(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatEntryType(value: string): string {
  if (value === 'free_sc') return 'Free Spins';
  if (value === 'redeem_confirmed') return 'Redemption';
  if (value === 'purchase') return 'Purchase';
  if (value === 'purchase_credit') return 'Purchase Credit';
  if (value === 'adjustment') return 'Adjust';
  if (value === 'daily') return 'Daily';
  return value.replace(/_/g, ' ');
}

export function formatRelativeTime(timestamp: string): string {
  const diffMs = new Date(timestamp).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return 'Unknown';

  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffMs) >= dayMs) return formatter.format(Math.round(diffMs / dayMs), 'day');
  if (Math.abs(diffMs) >= hourMs) return formatter.format(Math.round(diffMs / hourMs), 'hour');
  return formatter.format(Math.round(diffMs / minuteMs), 'minute');
}

export function riskRank(status: string | null): number {
  if (status === 'critical') return 0;
  if (status === 'at_risk') return 1;
  if (status === 'watch') return 2;
  return 3;
}

export function getTierBadgeStyle(tier: string) {
  if (tier === 'S') {
    return {
      background: 'rgba(245, 158, 11, 0.16)',
      color: 'var(--accent-yellow)',
      borderColor: 'rgba(245, 158, 11, 0.32)',
    };
  }
  if (tier === 'A') {
    return {
      background: 'rgba(16, 185, 129, 0.16)',
      color: 'var(--accent-green)',
      borderColor: 'rgba(16, 185, 129, 0.32)',
    };
  }
  if (tier === 'B') {
    return {
      background: 'rgba(59, 130, 246, 0.16)',
      color: 'var(--accent-blue)',
      borderColor: 'rgba(59, 130, 246, 0.32)',
    };
  }
  return {
    background: 'rgba(156, 163, 175, 0.12)',
    color: 'var(--text-secondary)',
    borderColor: 'rgba(156, 163, 175, 0.26)',
  };
}
