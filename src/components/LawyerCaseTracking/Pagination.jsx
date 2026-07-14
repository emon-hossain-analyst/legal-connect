import React from 'react';

const Pagination = ({ currentPage = 1, totalPages = 1, onPageChange, totalItems = 0, itemsPerPage = 20 }) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to display
  const getPages = () => {
    const pages = [];
    const maxDisplayed = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxDisplayed - 1);

    if (end - start < maxDisplayed - 1) {
      start = Math.max(1, end - maxDisplayed + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4 transition">
      <div className="text-xs font-bold text-gray-600 select-none">
        Showing <span className="text-navy-primary font-black">{startItem}</span> to{' '}
        <span className="text-navy-primary font-black">{endItem}</span> of{' '}
        <span className="text-navy-primary font-black">{totalItems}</span> legal matters
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-xl bg-bg-light/80 hover:bg-bg-light disabled:opacity-40 disabled:cursor-not-allowed text-navy-primary text-xs font-bold transition border border-border-subtle flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">chevron_left</span>
          <span>Previous</span>
        </button>

        <div className="flex items-center gap-1">
          {getPages().map((pageNum) => (
            <button
              type="button"
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center ${
                currentPage === pageNum
                  ? 'bg-navy-primary text-accent-gold shadow-xs'
                  : 'bg-bg-light/50 hover:bg-bg-light text-gray-700 border border-border-subtle/80'
              }`}
            >
              {pageNum}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-xl bg-bg-light/80 hover:bg-bg-light disabled:opacity-40 disabled:cursor-not-allowed text-navy-primary text-xs font-bold transition border border-border-subtle flex items-center gap-1"
        >
          <span>Next</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </button>
      </div>
    </div>
  );
};

export default Pagination;
