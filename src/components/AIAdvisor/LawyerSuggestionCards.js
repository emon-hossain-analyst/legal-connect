import React from 'react';
import { Link } from 'react-router-dom';

const DEPT_COLORS = {
  'Corporate': 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  'IP': 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  'Criminal': 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  'Family': 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
  'Property': 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  'Labor': 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  'Tax': 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  'Immigration': 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
  'default': 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
};

const getDeptColor = (name = '') => {
  for (const key in DEPT_COLORS) {
    if (name?.toLowerCase().includes(key.toLowerCase())) return DEPT_COLORS[key];
  }
  return DEPT_COLORS['default'];
};

const LawyerSuggestionCards = ({
  lawyers = [],
  category = 'General Practice',
  isFallback = false,
  onShowMore,
  hasMore = false,
  isLoadingMore = false
}) => {
  if (!lawyers || lawyers.length === 0) {
    return (
      <div className="mt-5 p-6 bg-surface-container-lowest border border-outline-variant rounded-2xl flex flex-col items-center text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-2xl">person_search</span>
        </div>
        <h4 className="font-headline-sm text-on-surface text-base font-bold mb-1">Verified Directory Expanding</h4>
        <p className="text-xs text-on-surface-variant max-w-md mb-4 leading-relaxed">
          Our directory of verified Supreme Court and District Court advocates for <strong className="text-primary">{category}</strong> is currently growing. In the meantime, you can post your legal matter on our Job Board to receive custom consultation proposals!
        </p>
        <Link
          to="/jobs"
          className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-secondary transition-all shadow-md active:scale-95 flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">add_circle</span>
          Post on Job Board
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-outline-variant/60 pt-5 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4 bg-surface-container-low p-3 rounded-xl border border-outline-variant/40">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px] filled-icon">manage_search</span>
          <span className="font-bold text-sm text-on-surface">
            {isFallback ? (
              <>Top-Rated Verified Counsel <span className="text-xs font-normal text-on-surface-variant">(General recommendations)</span></>
            ) : (
              <>Recommended Legal Counsel for <span className="text-primary font-extrabold underline decoration-secondary decoration-2 underline-offset-4">{category}</span></>
            )}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
          Supabase Verified
        </span>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {lawyers.map((lawyer) => {
          const name = lawyer.full_name || lawyer.user?.name || 'Verified Lawyer';
          const initials = name.substring(0, 2).toUpperCase();
          const profilePic = lawyer.avatar_url || lawyer.user?.profile_picture_url;
          const slugOrId = lawyer.slug || lawyer.id || lawyer.user_id;
          const bookId = lawyer.user_id || lawyer.id;
          const specialization = lawyer.specialization || category || 'General Practice';
          const hourlyRate = lawyer.hourly_rate || lawyer.consultation_fee || '1,000';
          const rating = Number(lawyer.avg_rating || lawyer.rating || 0).toFixed(1);
          const reviews = lawyer.total_reviews || 0;
          const expYears = lawyer.experience_years || 0;
          const location = lawyer.location || lawyer.city || 'Dhaka, Bangladesh';

          return (
            <div
              key={lawyer.id || bookId}
              className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Top Accent Bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent-gold opacity-80 group-hover:opacity-100 transition-opacity" />

              <div>
                {/* Lawyer Header */}
                <div className="flex items-center gap-3 mb-3 pt-1">
                  <div className="w-12 h-12 rounded-full bg-primary text-secondary-fixed flex items-center justify-center font-bold text-base uppercase shrink-0 overflow-hidden border border-outline-variant shadow-sm">
                    {profilePic ? (
                      <img src={profilePic} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-sm text-on-surface truncate flex items-center gap-1 leading-tight">
                      {name}
                      <span className="material-symbols-outlined text-emerald-500 text-[16px] shrink-0" title="Verified Advocate">verified</span>
                    </h5>
                    <div className="flex items-center gap-1 text-xs text-on-surface-variant mt-0.5 truncate">
                      <span className="material-symbols-outlined text-[13px] text-outline">location_on</span>
                      <span className="truncate">{location}</span>
                    </div>
                  </div>
                </div>

                {/* Specialization Pill */}
                <div className="mb-3">
                  <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border truncate max-w-full ${getDeptColor(specialization)}`}>
                    {specialization}
                  </span>
                </div>

                {/* Metrics Bar */}
                <div className="grid grid-cols-2 gap-2 py-2 px-2.5 bg-surface-container-low rounded-xl mb-3 text-xs">
                  <div className="flex items-center gap-1 text-amber-600 font-bold">
                    <span className="material-symbols-outlined text-[16px] fill-current">star</span>
                    <span>{rating}</span>
                    <span className="text-[10px] text-on-surface-variant font-normal">({reviews})</span>
                  </div>
                  <div className="text-right font-bold text-primary">
                    BDT {hourlyRate}/hr
                  </div>
                </div>

                {/* Experience & Languages */}
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-4 px-1">
                  <span>💼 {expYears > 0 ? `${expYears} yrs experience` : 'Experienced Counsel'}</span>
                  <span className="bg-surface-container-high px-1.5 py-0.5 rounded text-[10px] font-medium">Bangla / Eng</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-outline-variant/50">
                <Link
                  to={`/lawyers/${slugOrId}`}
                  className="flex-1 bg-surface-container text-on-surface hover:bg-surface-container-high py-2 rounded-xl text-xs font-semibold transition-colors text-center block border border-outline-variant/60"
                >
                  Profile
                </Link>
                <Link
                  to={`/book-appointment/${bookId}`}
                  className="flex-1 bg-primary text-on-primary hover:bg-secondary py-2 rounded-xl text-xs font-semibold transition-colors text-center block shadow-sm"
                >
                  Book Consult
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show More Button */}
      {onShowMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={onShowMore}
            disabled={isLoadingMore || !hasMore}
            className="px-5 py-2 bg-surface-container-low hover:bg-surface-container border border-outline-variant text-on-surface rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-95"
          >
            {isLoadingMore ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Finding lawyers...</span>
              </>
            ) : hasMore ? (
              <>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
                <span>Show me more lawyers</span>
              </>
            ) : (
              <span className="text-outline">No more matching lawyers</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default LawyerSuggestionCards;
