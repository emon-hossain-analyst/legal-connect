import React, { useState } from 'react';

const LanguageSelector = ({ settings, onChange }) => {
  const { languages = ['English', 'Bangla'] } = settings;
  const [searchTerm, setSearchTerm] = useState('');

  const defaultSuggestions = ['English', 'Bangla', 'Hindi', 'Arabic', 'Urdu', 'French', 'Spanish'];

  const availableSuggestions = defaultSuggestions.filter(
    (sug) =>
      !languages.includes(sug) &&
      sug.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  const handleAddLanguage = (lang) => {
    const clean = lang.trim();
    if (!clean) return;
    if (!languages.includes(clean)) {
      onChange('languages', [...languages, clean]);
    }
    setSearchTerm('');
  };

  const handleRemoveLanguage = (lang) => {
    if (languages.length <= 1) {
      // Keep at least one language
      return;
    }
    onChange('languages', languages.filter((l) => l !== lang));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchTerm.trim()) {
        handleAddLanguage(searchTerm);
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-sm space-y-6 transition hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
          <span>🗣️</span>
        </div>
        <div>
          <h3 className="text-xl font-serif font-bold text-navy-primary">Consultation Languages</h3>
          <p className="text-xs text-text-muted mt-0.5">Select languages you are fully proficient consulting and advising clients in.</p>
        </div>
      </div>

      {/* Currently Selected Languages */}
      <div className="space-y-3">
        <label className="block text-sm font-bold text-navy-primary">
          Selected Languages <span className="text-rose-500">*</span>
          {languages.length === 1 && (
            <span className="text-[11px] font-normal text-amber-600 ml-2">(Minimum 1 required)</span>
          )}
        </label>
        <div className="flex flex-wrap gap-2.5 min-h-[44px] p-3 rounded-xl bg-bg-light/60 border border-border-subtle items-center">
          {languages.map((lang) => (
            <span
              key={lang}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-navy-primary text-white text-xs font-bold shadow-sm"
            >
              <span>{lang}</span>
              {languages.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveLanguage(lang)}
                  className="hover:text-amber-300 transition font-black focus:outline-none"
                  title="Remove Language"
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {languages.length === 0 && (
            <span className="text-xs text-rose-500 font-semibold">Please select at least one language below.</span>
          )}
        </div>
      </div>

      {/* Searchable Multi-Select & Custom Addition */}
      <div className="space-y-3 pt-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
          Add Language / Search Suggestions
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
              translate
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or type a custom language (Press Enter to add)..."
              className="w-full pl-10 pr-4 py-2.5 border border-border-subtle rounded-xl focus:outline-none focus:border-accent-gold text-sm transition"
            />
          </div>
          <button
            type="button"
            disabled={!searchTerm.trim()}
            onClick={() => handleAddLanguage(searchTerm)}
            className="px-5 py-2.5 bg-navy-primary text-white font-bold rounded-xl text-sm hover:bg-navy-primary/90 disabled:opacity-40 transition shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <span>+ Add Custom</span>
          </button>
        </div>

        {/* Suggestion Chips */}
        <div className="pt-2">
          <span className="text-[11px] font-bold text-text-muted uppercase block mb-2">Recommended Languages:</span>
          <div className="flex flex-wrap gap-2">
            {availableSuggestions.map((sug) => (
              <button
                type="button"
                key={sug}
                onClick={() => handleAddLanguage(sug)}
                className="px-3 py-1.5 rounded-lg border border-border-subtle bg-white hover:bg-navy-primary hover:text-white hover:border-navy-primary transition text-xs font-semibold text-gray-700 flex items-center gap-1 shadow-2xs"
              >
                <span>+</span>
                <span>{sug}</span>
              </button>
            ))}
            {availableSuggestions.length === 0 && (
              <span className="text-xs text-gray-400 italic">No additional default suggestions match your search.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;
