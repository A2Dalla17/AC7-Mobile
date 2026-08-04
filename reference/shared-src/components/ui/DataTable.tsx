import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight, Inbox, Search } from 'lucide-react';

import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';
import { cn } from '@shared/lib/utils';

export interface Column<T> {
  /** Stable key, also used for sorting. */
  key: string;
  header: string;
  /** Cell renderer. Receives the whole row. */
  render: (row: T) => ReactNode;
  /** Value used for sorting and searching. Omit to make the column inert. */
  value?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  /** Hidden below `lg` — use for secondary columns on narrow screens. */
  secondary?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;

  /** Client-side search across every column that defines `value`. */
  searchable?: boolean;
  searchPlaceholder?: string;

  /** Rows per page. Omit to disable pagination. */
  pageSize?: number;

  onRowClick?: (row: T) => void;

  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;

  /** Rendered above the table, right-aligned — filters, export buttons. */
  toolbar?: ReactNode;
}

/**
 * Data table with search, sort, pagination and the three states every table
 * needs: loading, empty and error.
 *
 * Sorting and filtering are client-side, which is right for the page sizes the
 * admin console deals with. If a list grows past a few thousand rows, move
 * both to the API and pass `rows` already sorted.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error = false,
  onRetry,
  searchable = false,
  searchPlaceholder = 'Search…',
  pageSize,
  onRowClick,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  toolbar,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const processed = useMemo(() => {
    let data = rows ?? [];

    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      data = data.filter((row) =>
        columns.some((col) => {
          const v = col.value?.(row);
          return v != null && String(v).toLowerCase().includes(needle);
        }),
      );
    }

    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.value) {
        data = [...data].sort((a, b) => {
          const av = col.value!(a);
          const bv = col.value!(b);

          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;

          const cmp =
            typeof av === 'number' && typeof bv === 'number'
              ? av - bv
              : String(av).localeCompare(String(bv));

          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }

    return data;
  }, [rows, columns, query, sortKey, sortDir]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(processed.length / pageSize)) : 1;
  const current = Math.min(page, pageCount - 1);
  const visible = pageSize
    ? processed.slice(current * pageSize, current * pageSize + pageSize)
    : processed;

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  }

  /* -- States ------------------------------------------------------------- */

  if (error) {
    return (
      <div className="rounded-card border border-line bg-card">
        <EmptyState
          tone="error"
          icon={<AlertTriangle size={22} />}
          title="Couldn't load this data"
          description="The request failed. Check your connection and try again."
          action={onRetry && <Button onClick={onRetry}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-card">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          {searchable ? (
            <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
              <Search
                size={16}
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-10 w-full rounded-pill border border-line bg-bg pl-10 pr-4 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ink/20"
              />
            </div>
          ) : (
            <span />
          )}

          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: pageSize ?? 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Inbox size={22} />}
          title={query ? 'No matches' : emptyTitle}
          {...(query
            ? { description: `Nothing matched “${query}”. Try a different search.` }
            : emptyDescription
              ? { description: emptyDescription }
              : {})}
          {...(!query && emptyAction ? { action: emptyAction } : {})}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.secondary && 'hidden lg:table-cell',
                    )}
                  >
                    {col.value ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={cn(
                          'inline-flex items-center gap-1.5 transition-colors hover:text-ink',
                          sortKey === col.key && 'text-brand-ink',
                        )}
                      >
                        {col.header}
                        <ArrowUpDown size={12} aria-hidden />
                        <span className="sr-only">
                          {sortKey === col.key
                            ? `sorted ${sortDir === 'asc' ? 'ascending' : 'descending'}`
                            : 'not sorted'}
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {visible.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-elevated',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3.5 text-body text-ink',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.secondary && 'hidden lg:table-cell',
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageSize && !loading && processed.length > pageSize && (
        <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
          <p className="tabular text-sm text-ink-muted">
            {current * pageSize + 1}–{Math.min((current + 1) * pageSize, processed.length)} of{' '}
            {processed.length}
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              aria-label="Previous page"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="tabular px-2 text-sm text-ink">
              {current + 1} / {pageCount}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={current >= pageCount - 1}
              aria-label="Next page"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
