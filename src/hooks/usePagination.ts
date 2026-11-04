import { useState } from 'react';
import type { PaginationProps } from '../components/ui/Pagination';

/**
 * Client-side paging over a fully loaded list. `resetKey` is anything that changes when the
 * search/filter changes (e.g. `${search}|${tab}`) — a new key jumps back to page 1. The page is
 * also clamped, so a refresh that shrinks the list never strands you past the end.
 *
 *   const pager = usePagination(filtered, { resetKey: `${search}|${filter}` });
 *   pager.rows.map((row, i) => <tr><RowNumberCell n={pager.offset + i + 1} />…</tr>)
 *   <Pagination {...pager.props} />
 */
export function usePagination<T>(
  items: readonly T[] | null | undefined,
  { initialPageSize = 10, resetKey }: { initialPageSize?: number; resetKey?: unknown } = {},
) {
  const [state, setState] = useState<{ key: unknown; page: number }>({ key: resetKey, page: 0 });
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const total = items?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const requested = Object.is(state.key, resetKey) ? state.page : 0;
  const page = Math.min(Math.max(0, requested), pages - 1);
  const offset = page * pageSize;
  const rows = (items ?? []).slice(offset, offset + pageSize);

  const setPage = (p: number) => setState({ key: resetKey, page: p });
  const setPageSize = (n: number) => {
    setPageSizeState(n);
    setState({ key: resetKey, page: 0 });
  };

  return {
    page, pageSize, total, pages, offset, rows, setPage, setPageSize,
    props: { page, pageSize, total, onPage: setPage, onPageSize: setPageSize } satisfies PaginationProps,
  };
}
