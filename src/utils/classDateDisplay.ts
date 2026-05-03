/** Device-local calendar day as `YYYY-MM-DD` (dashboard forms, live page query). */
export function localCalendarYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/**
 * Prisma stores `Class.date` at UTC midnight for the session’s calendar day.
 * Formatting with the default local timezone shifts that instant to the *previous* calendar
 * day for most of the Americas — use `timeZone: 'UTC'` so the UI matches the day you picked when creating the class.
 */
export function formatClassCalendarDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return typeof iso === 'string' ? iso : '—';
  return d.toLocaleDateString(undefined, {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** `startTime` / `endTime` are real instants — show in the viewer’s local timezone. */
export function formatClassTimeLocal(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
