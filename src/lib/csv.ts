/** Escape a CSV field — wraps in quotes if it contains a comma, quote, or newline. */
export function csvField(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Builds a CSV (with UTF-8 BOM for Excel) and triggers a browser download. Column order follows
 * common SIS/gradebook-import convention (ID/name/email first) — a generic, clean handoff format,
 * not a certified drop-in for one specific vendor's exact importer spec.
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const csv = ['﻿' + headers.map(csvField).join(','), ...rows.map((row) => row.map(csvField).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
