import React from 'react';

const CaseSearchBar = ({ searchTerm = '', onSearchChange }) => {
  return (
    <div className="relative w-full">
      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl select-none">
        search
      </span>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search cases by title, client name, case number (#CASE-1024), or contract ID..."
        className="w-full pl-12 pr-10 py-3 bg-white border border-border-subtle rounded-xl text-sm font-semibold text-navy-primary focus:outline-none focus:border-accent-gold shadow-xs transition"
      />
      {searchTerm && (
        <button
          type="button"
          onClick={() => onSearchChange('')}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy-primary transition font-black p-1 focus:outline-none"
          title="Clear search"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      )}
    </div>
  );
};

export default CaseSearchBar;
