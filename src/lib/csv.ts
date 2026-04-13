/** Escape a CSV field — wraps in quotes if it contains a comma, quote, or newline. */
export function csvField(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
