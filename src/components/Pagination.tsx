'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [6, 12, 24, 48];

/**
 * Devuelve los numeros a mostrar, con elipsis cuando hay muchas paginas:
 * 1 … 4 5 6 … 20. Se mantiene el ancho estable para que la barra no salte.
 */
function pageItems(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const items: (number | 'gap')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) items.push('gap');
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < pageCount - 1) items.push('gap');

  items.push(pageCount);
  return items;
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: Props) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5">
      <p className="text-2xs tabular-nums text-text-3">
        Mostrando {from}–{to} de {total}
      </p>

      <nav aria-label="Paginacion" className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Pagina anterior"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-3 transition-colors hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-35"
        >
          <ChevronLeft size={14} />
        </button>

        {pageItems(page, pageCount).map((item, i) =>
          item === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-2xs text-text-3">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              className={cn(
                'inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1.5 text-2xs font-medium tabular-nums transition-colors',
                item === page
                  ? 'bg-accent text-white'
                  : 'text-text-2 hover:bg-surface-2 hover:text-text',
              )}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Pagina siguiente"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-3 transition-colors hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-35"
        >
          <ChevronRight size={14} />
        </button>
      </nav>

      <label className="flex items-center gap-1.5 text-2xs text-text-3">
        <span className="hidden sm:inline">Por pagina</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-7 rounded-md border border-line bg-surface-2 px-1.5 text-2xs text-text-2 transition-colors hover:text-text focus:border-accent/40"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
