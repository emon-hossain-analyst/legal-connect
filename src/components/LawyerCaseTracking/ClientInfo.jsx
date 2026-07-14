import React from 'react';

const ClientInfo = ({ client = {}, rating = null }) => {
  const name = client.name || client.full_name || client.contact_name || 'Legal Client';
  const email = client.email || 'Private / Protected via Platform';
  const phone = client.phone || client.phone_number || client.mobile || 'Contact via Secure Chat';
  const location = client.location || client.city || client.address || 'Bangladesh';
  const avatar = client.profile_picture_url || client.avatar_url || null;

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <h4 className="font-serif font-bold text-base text-navy-primary flex items-center gap-2">
          <span>👤</span>
          <span>Client Profile & Contact Info</span>
        </h4>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          Verified Party
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-accent-gold/50 shadow-xs flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-navy-primary text-accent-gold font-bold text-2xl flex items-center justify-center border-2 border-accent-gold/50 shadow-xs flex-shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
          <h5 className="font-bold text-navy-primary text-base truncate">{name}</h5>
          <p className="text-xs text-gray-500 flex items-center justify-center sm:justify-start gap-1">
            <span className="material-symbols-outlined text-sm text-text-muted">location_on</span>
            <span>{location}</span>
          </p>

          <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs">
            {rating !== null && rating !== undefined ? (
              <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                <span>⭐</span>
                <span>Rating Given: {Number(rating).toFixed(1)} / 5.0</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-gray-600 bg-gray-50 px-2.5 py-0.5 rounded-lg border border-gray-200">
                <span>⭐</span>
                <span>Rating: Pending Completion</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-border-subtle/60">
        <div className="bg-bg-light/60 p-3 rounded-xl border border-border-subtle/80 flex items-center gap-2.5">
          <span className="material-symbols-outlined text-navy-primary text-base">mail</span>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold text-text-muted block">Email Address</span>
            <span className="font-semibold text-navy-primary truncate block">{email}</span>
          </div>
        </div>

        <div className="bg-bg-light/60 p-3 rounded-xl border border-border-subtle/80 flex items-center gap-2.5">
          <span className="material-symbols-outlined text-navy-primary text-base">call</span>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold text-text-muted block">Phone / Mobile</span>
            <span className="font-semibold text-navy-primary truncate block">{phone}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientInfo;
