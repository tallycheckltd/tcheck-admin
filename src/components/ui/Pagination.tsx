import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Shared table paging for every admin list: rows per page, "1–25 of 120", first / previous / next
 * / last, plus a "#" column helper so row numbers keep counting across pages (page 2 at 10 rows
 * starts at 11). Visually matches the Pager in AnalyticsPage.tsx.
 */
export const PAGE_SIZES = [10, 25, 50, 100] as const;

export interface PaginationProps {
  /** Zero-based page index. */
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  /** The server has more rows than are loaded: Next stays available on the last page. */
  hasMore?: boolean;
  loadingMore?: boolean;
  /** Show the bar even when everything fits on one page (default hides it under 10 rows). */
  alwaysShow?: boolean;
  /** Top divider line (default on). Turn off when the bar sits in its own card. */
  bordered?: boolean;
  /** Stack the controls vertically — for narrow panes (~400px) like split-view lists. */
  compact?: boolean;
  /** No horizontal/bottom padding — for bars inside an already-padded card. */
  flush?: boolean;
  className?: string;
}

export function Pagination({
  page, pageSize, total, onPage, onPageSize, hasMore = false, loadingMore = false, alwaysShow = false, bordered = true, compact = false, flush = false, className,
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (!alwaysShow && total <= PAGE_SIZES[0] && !hasMore) return null;
  const from = total ? page * pageSize + 1 : 0;
  const to = Math.min(total, (page + 1) * pageSize);
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5 cursor-pointer';
  return (
    <div
      className={clsx(
        'flex flex-col gap-2 text-xs text-gray-500 dark:text-gray-400',
        !compact && 'sm:flex-row sm:items-center sm:justify-between',
        bordered && 'border-t border-gray-100 dark:border-white/5',
        flush ? 'px-0 pt-3 pb-0' : compact ? 'px-3 py-3' : 'px-4 py-3',
        className,
      )}
    >
      <label className="inline-flex items-center gap-2">
        Rows per page
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white cursor-pointer"
        >
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-2 tabular-nums">{from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}{hasMore ? '+' : ''}</span>
        <button type="button" className={btn} onClick={() => onPage(0)} disabled={page === 0} aria-label="First page"><ChevronsLeft size={14} /></button>
        <button type="button" className={btn} onClick={() => onPage(page - 1)} disabled={page === 0} aria-label="Previous page"><ChevronLeft size={14} /></button>
        <span className="px-1 tabular-nums">Page {page + 1} of {pages}{hasMore ? '+' : ''}</span>
        <button type="button" className={btn} onClick={() => onPage(page + 1)} disabled={(page >= pages - 1 && !hasMore) || loadingMore} aria-label="Next page">
          {loadingMore ? <RefreshCw size={13} className="animate-spin" /> : <ChevronRight size={14} />}
        </button>
        <button type="button" className={btn} onClick={() => onPage(pages - 1)} disabled={page >= pages - 1} aria-label="Last page"><ChevronsRight size={14} /></button>
      </div>
    </div>
  );
}

/** Header for the "#" column. */
export function RowNumberHead({ className }: { className?: string }) {
  return (
    <th scope="col" className={clsx('w-12 px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500', className)}>
      #
    </th>
  );
}

/** The row's overall position (1-based, continuing across pages). */
export function RowNumberCell({ n, className }: { n: number; className?: string }) {
  return (
    <td className={clsx('w-12 px-4 py-3 text-right text-xs font-medium tabular-nums text-gray-400 dark:text-gray-500', className)}>
      {n}
    </td>
  );
}

/** For card/list layouts without a table: a small numbered chip. */
export function RowNumberBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span className={clsx('inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 px-1.5 text-[11px] font-semibold tabular-nums text-gray-500 dark:bg-white/5 dark:text-gray-400', className)}>
      {n}
    </span>
  );
}
