import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pageCount, onPageChange, total }) {
  if (!pageCount || pageCount <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-3 text-sm text-slate-500 dark:text-slate-400">
      <span>
        {total ? `${total} records` : ''} · Page {page} of {pageCount}
      </span>
      <div className="flex items-center gap-1">
        <button
          className="btn-ghost !px-2 !py-1 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="btn-ghost !px-2 !py-1 disabled:opacity-40"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}