/**
 * Visitors (2026-11-13) — invite time windows: a start date + time and an end date + time (a pass can
 * span several days, up to 31), the quick presets, and the form's values → an ISO window.
 */
const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export type When = { date: string; from: string; untilDate: string; until: string };
const span = (from: Date, until: Date): When => ({ date: localDate(from), from: localTime(from), untilDate: localDate(until), until: localTime(until) });

/** Today, from now (to the next quarter hour) until 17:00 — or 4 hours on, if that's later. */
export function todayWindow(): When {
  const now = new Date();
  const start = new Date(now); start.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(now); end.setHours(17, 0, 0, 0);
  return span(start, end > start ? end : new Date(start.getTime() + 4 * 3_600_000));
}
export function tomorrowMorning(): When {
  const from = new Date(); from.setDate(from.getDate() + 1); from.setHours(9, 0, 0, 0);
  const until = new Date(from); until.setHours(13, 0, 0, 0);
  return span(from, until);
}
/** The working week: now (or next Monday at a weekend, or once Friday's work is over) until Friday 17:00. */
export function weekdays(): When {
  const from = new Date();
  if (from.getDay() === 6) from.setDate(from.getDate() + 2);
  if (from.getDay() === 0) from.setDate(from.getDate() + 1);
  const isToday = from.toDateString() === new Date().toDateString();
  if (isToday && new Date().getHours() >= 8) { from.setMinutes(Math.ceil(from.getMinutes() / 15) * 15, 0, 0); } else from.setHours(8, 0, 0, 0);
  const until = new Date(from); until.setDate(until.getDate() + (5 - until.getDay())); until.setHours(17, 0, 0, 0);
  // This week's working hours are over (e.g. Friday evening): next Monday 08:00 to Friday 17:00.
  if (until <= from) {
    const mon = new Date(from); mon.setDate(mon.getDate() + ((8 - mon.getDay()) % 7 || 7)); mon.setHours(8, 0, 0, 0);
    const fri = new Date(mon); fri.setDate(fri.getDate() + 4); fri.setHours(17, 0, 0, 0);
    return span(mon, fri);
  }
  return span(from, until);
}
/** The guest's last slot — same weekday, times and length — at its next occurrence from now. */
export function sameAsLast(lastFrom: string, lastUntil: string): When {
  const f = new Date(lastFrom); const u = new Date(lastUntil);
  const from = new Date(); from.setHours(f.getHours(), f.getMinutes(), 0, 0);
  while (from.getDay() !== f.getDay() || from <= new Date()) from.setDate(from.getDate() + 1);
  return span(from, new Date(from.getTime() + (u.getTime() - f.getTime())));
}

export function toIsoWindow(w: When) {
  return { validFrom: new Date(`${w.date}T${w.from}`).toISOString(), validUntil: new Date(`${w.untilDate || w.date}T${w.until}`).toISOString() };
}

/** "Same day, 4 h" / "3 days — the guest can come and go" / a problem to show instead. */
export function describeWindow(w: When): { ok: boolean; text: string } {
  const a = new Date(`${w.date}T${w.from}`); const b = new Date(`${w.untilDate || w.date}T${w.until}`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return { ok: false, text: 'Choose a start and an end.' };
  if (b <= a) return { ok: false, text: 'The end must be after the start.' };
  if (b <= new Date()) return { ok: false, text: 'That time has already passed.' };
  const days = Math.round((new Date(b.toDateString()).getTime() - new Date(a.toDateString()).getTime()) / 86_400_000) + 1;
  if (b.getTime() - a.getTime() > 31 * 86_400_000) return { ok: false, text: 'A pass can cover at most 31 days.' };
  if (days === 1) { const h = (b.getTime() - a.getTime()) / 3_600_000; return { ok: true, text: `One visit, ${h < 1 ? `${Math.round(h * 60)} min` : `${Math.round(h * 10) / 10} h`}` }; }
  return { ok: true, text: `${days} days — the guest can come and go between these dates` };
}
