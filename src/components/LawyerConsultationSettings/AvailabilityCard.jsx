import React from 'react';

const AvailabilityCard = ({ settings, onChange }) => {
  const {
    consultation_mode = 'Both',
    office_address = '',
    meeting_url = '',
    session_duration = 60,
    offer_free_consultation = false,
  } = settings;

  const showOfficeAddress = consultation_mode === 'In Person' || consultation_mode === 'Both';
  const showMeetingUrl = consultation_mode === 'Online' || consultation_mode === 'Both';

  const durationOptions = [30, 45, 60, 90, 120];

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-sm space-y-6 transition hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
          <span>📅</span>
        </div>
        <div>
          <h3 className="text-xl font-serif font-bold text-navy-primary">Consultation Availability & Mode</h3>
          <p className="text-xs text-text-muted mt-0.5">Define where and how clients can schedule sessions with you.</p>
        </div>
      </div>

      {/* Consultation Mode Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-bold text-navy-primary">
          Consultation Mode <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {['Online', 'In Person', 'Both'].map((mode) => {
            const isSelected = consultation_mode === mode;
            return (
              <button
                type="button"
                key={mode}
                onClick={() => onChange('consultation_mode', mode)}
                className={`py-3 px-4 rounded-xl border font-bold text-sm flex flex-col sm:flex-row items-center justify-center gap-2 transition ${
                  isSelected
                    ? 'bg-navy-primary text-white border-navy-primary shadow-md'
                    : 'bg-bg-light/60 text-gray-700 border-border-subtle hover:bg-bg-light'
                }`}
              >
                <span>{mode === 'Online' ? '🌐' : mode === 'In Person' ? '🏢' : '🔄'}</span>
                <span>{mode}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Office Address Input */}
      {showOfficeAddress && (
        <div className="space-y-2 animate-fadeIn">
          <label className="block text-sm font-bold text-navy-primary flex items-center justify-between">
            <span>Office / Chamber Address</span>
            <span className="text-xs font-normal text-text-muted">Required for in-person visits</span>
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-3 text-gray-400 text-lg">location_on</span>
            <textarea
              rows="2"
              value={office_address || ''}
              onChange={(e) => onChange('office_address', e.target.value)}
              placeholder="Enter your complete chamber address (e.g. Suite 402, Supreme Court Bar Association Building, Dhaka)..."
              className="w-full pl-10 pr-4 py-2.5 border border-border-subtle rounded-xl focus:outline-none focus:border-accent-gold text-sm transition"
            />
          </div>
        </div>
      )}

      {/* Meeting URL Input */}
      {showMeetingUrl && (
        <div className="space-y-2 animate-fadeIn">
          <label className="block text-sm font-bold text-navy-primary flex items-center justify-between">
            <span>Default Video Meeting URL</span>
            <span className="text-xs font-normal text-text-muted">Google Meet, Zoom, or Teams link</span>
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">link</span>
            <input
              type="url"
              value={meeting_url || ''}
              onChange={(e) => onChange('meeting_url', e.target.value)}
              placeholder="https://meet.google.com/..."
              className="w-full pl-10 pr-4 py-2.5 border border-border-subtle rounded-xl focus:outline-none focus:border-accent-gold text-sm transition font-mono"
            />
          </div>
        </div>
      )}

      {/* Session Duration Selection */}
      <div className="space-y-3 pt-2 border-t border-border-subtle/60">
        <label className="block text-sm font-bold text-navy-primary">
          Standard Session Duration <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {durationOptions.map((mins) => {
            const isSelected = Number(session_duration) === mins;
            return (
              <button
                type="button"
                key={mins}
                onClick={() => onChange('session_duration', mins)}
                className={`py-2.5 px-3 rounded-xl border font-bold text-xs sm:text-sm transition ${
                  isSelected
                    ? 'bg-amber-500 text-navy-primary border-amber-600 shadow-sm font-black'
                    : 'bg-white text-gray-600 border-border-subtle hover:bg-bg-light'
                }`}
              >
                {mins} min
              </button>
            );
          })}
        </div>
      </div>

      {/* Offer Free Initial Consultation Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-bg-light/50 border border-border-subtle/80 pt-4">
        <div>
          <span className="text-sm font-bold text-navy-primary block">Offer Free Initial Consultation</span>
          <span className="text-xs text-text-muted block mt-0.5">
            Allow prospective clients to book a short introductory discovery session at no charge.
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange('offer_free_consultation', !offer_free_consultation)}
          className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
            offer_free_consultation ? 'bg-navy-primary' : 'bg-gray-300'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
              offer_free_consultation ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export default AvailabilityCard;
