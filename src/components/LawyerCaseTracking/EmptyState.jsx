import React from 'react';
import { useNavigate } from 'react-router-dom';

const EmptyState = ({ onBrowseJobs }) => {
  const navigate = useNavigate();

  const handleAction = () => {
    if (onBrowseJobs) {
      onBrowseJobs();
    } else {
      navigate('/lawyer-suite/browse-jobs');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-12 text-center max-w-2xl mx-auto shadow-sm my-8 space-y-5">
      <div className="w-20 h-20 bg-navy-primary/5 text-navy-primary rounded-3xl flex items-center justify-center mx-auto text-4xl font-black border border-navy-primary/10 shadow-xs">
        ⚖️
      </div>
      <div className="space-y-1.5 max-w-md mx-auto">
        <h3 className="font-serif font-bold text-xl text-navy-primary">No Active Cases Yet</h3>
        <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
          Accepted client cases will appear here once you are hired. Explore client legal requests on the Job Board or share your public profile to start onboarding matters.
        </p>
      </div>
      <div className="pt-2">
        <button
          type="button"
          onClick={handleAction}
          className="px-6 py-3 bg-navy-primary hover:bg-navy-secondary text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition inline-flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">search</span>
          <span>Browse Job Board</span>
        </button>
      </div>
    </div>
  );
};

export default EmptyState;
