/** Visitors (2026-11-13) — invite time windows: quick presets and the form's date/time → ISO window. */
const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export type When = { date: string; from: string; until: string };
const at = (d: Date, from: Date, until: Date): When => ({ date: localDate(d), from: localTime(from), until: localTime(until) });

/** Today, from now (to the next quarter hour) until 17:00 — or 4 hours on, if that's later. */
export function todayWindow(): When {
  const now = new Date();
  const start = new Date(now); start.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(now); end.setHours(17, 0, 0, 0);
  return at(start, start, end > start ? end : new Date(start.getTime() + 4 * 3_600_000));
}
export function tomorrowMorning(): When {
  const d = new Date(); d.setDate(d.getDate() + 1);
  const from = new Date(d); from.setHours(9, 0, 0, 0); const until = new Date(d); until.setHours(13, 0, 0, 0);
  return at(d, from, until);
}
/** The guest's last slot — same weekday and times — at its next occurrence from now. */
export function sameAsLast(lastFrom: string, lastUntil: string): When {
  const f = new Date(lastFrom); const u = new Date(lastUntil);
  const from = new Date(); from.setHours(f.getHours(), f.getMinutes(), 0, 0);
  while (from.getDay() !== f.getDay() || from <= new Date()) from.setDate(from.getDate() + 1);
  const until = new Date(from.getTime() + (u.getTime() - f.getTime()));
  return at(from, from, until);
}

export function toIsoWindow(w: When) {
  const validFrom = new Date(`${w.date}T${w.from}`);
  const validUntil = new Date(`${w.date}T${w.until}`);
  // A window that ends earlier in the day than it starts runs past midnight into the next day.
  if (validUntil <= validFrom) validUntil.setDate(validUntil.getDate() + 1);
  return { validFrom: validFrom.toISOString(), validUntil: validUntil.toISOString() };
}
