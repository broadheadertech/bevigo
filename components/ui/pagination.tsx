"use client";

import { useState } from "react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border-color)' }}>
      <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-30 transition-colors"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)' }}
        >
          Previous
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
          .map((page, idx, arr) => (
            <span key={page}>
              {idx > 0 && arr[idx - 1] !== page - 1 && (
                <span className="px-1 text-xs" style={{ color: 'var(--muted-fg)' }}>...</span>
              )}
              <button
                onClick={() => onPageChange(page)}
                className="w-8 h-8 rounded-xl text-xs font-medium transition-colors"
                style={page === currentPage
                  ? { backgroundColor: 'var(--accent-color)', color: 'white' }
                  : { color: 'var(--muted-fg)' }
                }
              >
                {page}
              </button>
            </span>
          ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-30 transition-colors"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)' }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function usePagination<T>(items: T[], pageSize: number = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const safePage = Math.min(currentPage, totalPages);
  if (safePage !== currentPage) setCurrentPage(safePage);

  const paginatedItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  return { paginatedItems, currentPage: safePage, totalPages, setCurrentPage };
}
