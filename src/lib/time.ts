export const ONLINE_WINDOW_MS = 30_000;

export function isOnline(lastSeen: string | null, now = Date.now()): boolean {
  return !!lastSeen && now - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS;
}

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
