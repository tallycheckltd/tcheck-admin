import { format, parseISO } from 'date-fns';

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
 *
 * Accepts `null`/`undefined` at runtime even though callers are typed for `string | Date` —
 * a malformed row from the API (or `typeof null === 'object'` sneaking past the old
 * string-only check) used to reach `d.getTime()` with `d` still `null`, throwing a render-time
 * `TypeError` with no error boundary around most routes, which white-screened the whole app.
 */
export function formatClassCalendarDate(iso: string | Date | null | undefined): string {
  if (iso == null) return '—';
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
export function formatClassTimeLocal(iso: string | Date | null | undefined): string {
  if (iso == null) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Wraps a date-fns `format(parseISO(...))` call so a malformed/null date string from the API
 * can't throw a synchronous `RangeError` during render — there's no error boundary around most
 * routes, so an uncaught throw here white-screens the whole app, not just the offending row.
 */
export function safeFormat(dateStr: string | null | undefined, formatStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    return format(d, formatStr);
  } catch {
    return '—';
  }
}
