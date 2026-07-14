import React from 'react';

const CaseFilters = ({ filters, onFilterChange, totalResults = 0 }) => {
  const { status = 'All', practiceArea = 'All', dateRange = 'All', sortBy = 'Newest' } = filters;

  const statusOptions = ['All', 'Active', 'Pending', 'In Progress', 'Waiting for Client', 'Completed', 'Cancelled'];
  const practiceOptions = [
    'All',
    'Corporate Law',
    'Family Law',
    'Criminal Defense',
    'Property Law',
    'Labor Law',
    'Tax Law',
    'Intellectual Property',
  ];
  const dateOptions = ['All', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'This Year'];
  const sortOptions = [
    { value: 'Newest', label: 'Newest First' },
    { value: 'Oldest', label: 'Oldest First' },
    { value: 'Deadline', label: 'Nearest Deadline' },
    { value: 'Highest Fee', label: 'Highest Agreed Fee' },
    { value: 'Lowest Fee', label: 'Lowest Agreed Fee' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-5 shadow-xs space-y-4 transition">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1 select-none">Status:</span>
          {statusOptions.map((st) => {
            const isSelected = status === st;
            return (
              <button
                type="button"
                key={st}
                onClick={() => onFilterChange('status', st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-navy-primary text-white shadow-sm'
                    : 'bg-bg-light/80 text-gray-600 hover:bg-bg-light border border-transparent'
                }`}
              >
                <span>{st}</span>
              </button>
            );
          })}
        </div>

        {/* Total count badge */}
        <div className="text-xs font-bold text-gray-600 self-end lg:self-center flex items-center gap-1.5">
          <span>Showing:</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-accent-gold/20 text-navy-primary font-black">
            {totalResults} {totalResults === 1 ? 'case' : 'cases'}
          </span>
        </div>
      </div>

      {/* Secondary Dropdown Filters: Practice Area, Date Range, Sort */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border-subtle/80">
        {/* Practice Area */}
        <div className="flex items-center gap-2 bg-bg-light/50 px-3 py-2 rounded-xl border border-border-subtle">
          <span className="material-symbols-outlined text-gray-500 text-lg">gavel</span>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase font-bold text-text-muted block leading-none">Practice Area</span>
            <select
              value={practiceArea}
              onChange={(e) => onFilterChange('practiceArea', e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-navy-primary focus:outline-none mt-0.5 truncate"
            >
              {practiceOptions.map((area) => (
                <option key={area} value={area}>
                  {area === 'All' ? 'All Practice Areas' : area}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2 bg-bg-light/50 px-3 py-2 rounded-xl border border-border-subtle">
          <span className="material-symbols-outlined text-gray-500 text-lg">calendar_today</span>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase font-bold text-text-muted block leading-none">Date Range</span>
            <select
              value={dateRange}
              onChange={(e) => onFilterChange('dateRange', e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-navy-primary focus:outline-none mt-0.5 truncate"
            >
              {dateOptions.map((dr) => (
                <option key={dr} value={dr}>
                  {dr === 'All' ? 'All Time (No Filter)' : dr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort By */}
        <div className="flex items-center gap-2 bg-bg-light/50 px-3 py-2 rounded-xl border border-border-subtle">
          <span className="material-symbols-outlined text-gray-500 text-lg">sort</span>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase font-bold text-text-muted block leading-none">Sort By</span>
            <select
              value={sortBy}
              onChange={(e) => onFilterChange('sortBy', e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-navy-primary focus:outline-none mt-0.5 truncate"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseFilters;
