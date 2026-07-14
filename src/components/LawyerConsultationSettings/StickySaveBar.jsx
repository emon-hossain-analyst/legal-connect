import React from 'react';

const StickySaveBar = ({ isDirty, saving, onSave, onReset }) => {
  return (
    <div className="sticky bottom-0 z-40 bg-white/90 backdrop-blur-md border-t border-border-subtle p-4 sm:py-5 sm:px-8 shadow-2xl transition-all duration-300 -mx-4 sm:-mx-8 mt-12">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 w-full sm:w-auto justify-between sm:justify-start">
          <span className={`w-2.5 h-2.5 rounded-full ${isDirty ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="font-semibold">
            {isDirty ? 'You have unsaved configuration changes.' : 'All settings are saved and up to date.'}
          </span>
        </div>

        <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
          <button
            type="button"
            disabled={!isDirty || saving}
            onClick={onReset}
            className="px-5 py-2.5 rounded-xl border border-border-subtle font-bold text-sm text-gray-600 hover:bg-bg-light disabled:opacity-40 transition"
          >
            Cancel & Restore
          </button>
          <button
            type="button"
            disabled={!isDirty || saving}
            onClick={onSave}
            className="px-7 py-2.5 rounded-xl bg-navy-primary text-white font-bold text-sm hover:bg-navy-primary/90 disabled:opacity-50 transition shadow-lg flex items-center justify-center gap-2 active:scale-95 min-w-[150px]"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>Save Settings</span>
                <span className="material-symbols-outlined text-base">save</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StickySaveBar;
