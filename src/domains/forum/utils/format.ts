const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A topic counts as "active" while it had activity in the last 24 hours. */
export const ACTIVE_WINDOW_MS = DAY;

/**
 * Formats a date as a short relative time in Portuguese (e.g. "agora", "45min", "3 dias").
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - date.getTime());

  if (diff < MINUTE) return 'agora';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}min`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;

  const days = Math.floor(diff / DAY);
  if (days < 30) return days === 1 ? '1 dia' : `${days} dias`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function isRecentlyActive(date: Date, now: Date = new Date()): boolean {
  return now.getTime() - date.getTime() < ACTIVE_WINDOW_MS;
}

/** True when the item was edited after creation (ignores the write latency of serverTimestamp). */
export function wasEdited(createdAt: Date, updatedAt: Date): boolean {
  return updatedAt.getTime() - createdAt.getTime() > 5 * 1000;
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
