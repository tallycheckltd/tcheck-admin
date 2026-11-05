import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/*
 * Page controls under a client-side table (11-05): rows per page, "1–25 of 120", first / previous /
 * next / last. Pair with usePagedRows below; row numbers come from `offset`.
 */

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export function TablePager({
  page, pageSize, total, onPage, onPageSize, noun = 'rows',
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  noun?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= PAGE_SIZES[0]) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const btn = 'inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5';
  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-500 dark:border-white/5 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
      <label className="inline-flex items-center gap-2">
        Rows per page
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-1.5">
        <span className="mr-2 tabular-nums">{from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} {noun}</span>
        <button type="button" className={btn} onClick={() => onPage(0)} disabled={page === 0} aria-label="First page"><ChevronsLeft size={14} /></button>
        <button type="button" className={btn} onClick={() => onPage(page - 1)} disabled={page === 0} aria-label="Previous page"><ChevronLeft size={14} /></button>
        <span className="px-1 tabular-nums">Page {page + 1} of {pages}</span>
        <button type="button" className={btn} onClick={() => onPage(page + 1)} disabled={page >= pages - 1} aria-label="Next page"><ChevronRight size={14} /></button>
        <button type="button" className={btn} onClick={() => onPage(pages - 1)} disabled={page >= pages - 1} aria-label="Last page"><ChevronsRight size={14} /></button>
      </div>
    </div>
  );
}
