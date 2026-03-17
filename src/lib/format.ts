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
