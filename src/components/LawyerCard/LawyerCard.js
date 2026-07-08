import React from 'react';
import { Link } from 'react-router-dom';
import StarRating from '../StarRating/StarRating';

const DEPT_COLORS = {
  'Corporate': 'bg-navy-primary text-white',
  'IP': 'bg-purple-100 text-purple-700',
  'Criminal': 'bg-red-100 text-danger-red',
  'Family': 'bg-teal-100 text-teal-700',
  'Property': 'bg-green-100 text-success-green',
  'Labor': 'bg-orange-100 text-orange-700',
  'Tax': 'bg-amber-100 text-amber-700',
  'Immigration': 'bg-blue-100 text-blue-700',
  'default': 'bg-gray-100 text-gray-700'
};

const getDeptColor = (name) => {
  for (const key in DEPT_COLORS) {
    if (name?.toLowerCase().includes(key.toLowerCase())) return DEPT_COLORS[key];
  }
  return DEPT_COLORS['default'];
};

export const LawyerCardSkeleton = () => (
  <div className="bg-surface-white rounded-lg border border-border-subtle p-5 shadow-sm border-t-[3px] border-t-accent-gold animate-pulse">
    <div className="flex flex-col items-center mb-4">
      <div className="w-16 h-16 rounded-full bg-gray-200 mb-3"></div>
      <div className="w-32 h-4 bg-gray-200 rounded mb-2"></div>
      <div className="w-24 h-4 bg-gray-200 rounded"></div>
    </div>
    <div className="w-full h-8 bg-gray-200 rounded mb-4"></div>
    <div className="w-full h-4 bg-gray-200 rounded mb-2"></div>
    <div className="w-2/3 h-4 bg-gray-200 rounded mb-6"></div>
    <div className="flex gap-2">
      <div className="w-1/2 h-10 bg-gray-200 rounded"></div>
      <div className="w-1/2 h-10 bg-gray-200 rounded"></div>
    </div>
  </div>
);

const LawyerCard = ({ lawyer }) => {
  // Safe access with optional chaining. Some profiles might have nested users or fallback
  const userObj = lawyer.users || lawyer.user || lawyer;
  const name = userObj?.name || 'Verified Lawyer';
  const initials = name.substring(0, 2).toUpperCase();
  const profilePic = userObj?.profile_picture_url;

  return (
    <div className="bg-surface-white rounded-lg border border-border-subtle p-5 shadow-sm border-t-[3px] border-t-accent-gold flex flex-col justify-between hover:shadow-md transition-shadow">
      <div>
        <div className="flex flex-col items-center mb-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-navy-primary text-accent-gold flex items-center justify-center font-bold text-xl uppercase overflow-hidden">
              {profilePic ? (
                <img src={profilePic} alt={name} className="w-full h-full object-cover" />
              ) : initials}
            </div>
          </div>
          <h3 className="text-lg font-bold text-navy-primary mt-3 flex items-center gap-1">
            {name}
            {lawyer.is_verified && <span className="text-accent-gold text-sm" title="Verified">✓</span>}
          </h3>
          <span className={`mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${getDeptColor(lawyer.specialization)}`}>
            {lawyer.specialization || 'General Practice'}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <StarRating rating={lawyer.avg_rating || 0} size="small" />
          <span className="text-sm font-bold text-navy-primary">{Number(lawyer.avg_rating || 0).toFixed(1)}</span>
          <span className="text-xs text-text-muted">({lawyer.total_reviews || 0})</span>
        </div>

        <p className="text-sm text-text-muted text-center mb-6 line-clamp-2 min-h-[40px]">
          {lawyer.bio || 'Experienced legal professional ready to assist you with your case.'}
        </p>
      </div>

      <div>
        <div className="flex justify-between items-center text-sm mb-4 bg-bg-light p-2 rounded">
          <div className="font-bold text-navy-primary">BDT {lawyer.hourly_rate || '1000'}/hr</div>
          <div className="text-text-muted">{lawyer.experience_years || 0} yrs exp</div>
          <div className="text-text-muted flex items-center gap-1"><span>📍</span> {lawyer.location || 'Dhaka'}</div>
        </div>

        <div className="flex gap-2">
          <Link 
            to={`/lawyers/${lawyer.slug || lawyer.id || lawyer.user_id}`}
            className="flex-1 bg-navy-primary text-white py-2 rounded text-sm font-semibold hover:bg-navy-primary/90 transition-colors text-center block"
          >
            View Profile
          </Link>
          <Link 
            to={`/book-appointment/${lawyer.user_id}`}
            className="flex-1 bg-white border border-navy-primary text-navy-primary py-2 rounded text-sm font-semibold hover:bg-bg-light transition-colors text-center block"
          >
            Book Consult
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LawyerCard;
