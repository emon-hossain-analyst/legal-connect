import React from 'react';

const BookingRulesCard = ({ settings, onChange }) => {
  const {
    advance_notice = 24,
    booking_window = 90,
    buffer_time = 15,
    auto_accept = false,
  } = settings;

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-sm space-y-6 transition hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg">
          <span>⏳</span>
        </div>
        <div>
          <h3 className="text-xl font-serif font-bold text-navy-primary">Booking & Scheduling Rules</h3>
          <p className="text-xs text-text-muted mt-0.5">Control advance booking notices, calendar windows, and buffer times between sessions.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {/* Minimum Advance Notice Dropdown */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Min. Advance Notice
          </label>
          <select
            value={advance_notice}
            onChange={(e) => onChange('advance_notice', Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-border-subtle rounded-xl bg-white focus:outline-none focus:border-accent-gold text-sm font-semibold text-navy-primary transition"
          >
            <option value={6}>6 hours before session</option>
            <option value={12}>12 hours before session</option>
            <option value={24}>24 hours (1 day)</option>
            <option value={48}>48 hours (2 days)</option>
            <option value={72}>72 hours (3 days)</option>
          </select>
          <span className="text-[11px] text-gray-500 block">Shortest notice required to book.</span>
        </div>

        {/* Maximum Booking Window Dropdown */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Max. Booking Window
          </label>
          <select
            value={booking_window}
            onChange={(e) => onChange('booking_window', Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-border-subtle rounded-xl bg-white focus:outline-none focus:border-accent-gold text-sm font-semibold text-navy-primary transition"
          >
            <option value={14}>Up to 14 days in advance</option>
            <option value={30}>Up to 30 days in advance</option>
            <option value={60}>Up to 60 days in advance</option>
            <option value={90}>Up to 90 days in advance</option>
          </select>
          <span className="text-[11px] text-gray-500 block">How far ahead clients can book.</span>
        </div>

        {/* Buffer Time Dropdown */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Buffer Time Between Sessions
          </label>
          <select
            value={buffer_time}
            onChange={(e) => onChange('buffer_time', Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-border-subtle rounded-xl bg-white focus:outline-none focus:border-accent-gold text-sm font-semibold text-navy-primary transition"
          >
            <option value={0}>No buffer (0 minutes)</option>
            <option value={10}>10 minutes buffer</option>
            <option value={15}>15 minutes buffer</option>
            <option value={30}>30 minutes buffer</option>
            <option value={45}>45 minutes buffer</option>
          </select>
          <span className="text-[11px] text-gray-500 block">Rest/prep time after each meeting.</span>
        </div>
      </div>

      {/* Auto Accept Bookings Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-bg-light/50 border border-border-subtle/80 pt-4">
        <div>
          <span className="text-sm font-bold text-navy-primary block">Auto-accept Bookings</span>
          <span className="text-xs text-text-muted block mt-0.5">
            Skip manual review. New appointment slots will automatically be confirmed upon payment or booking submission.
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange('auto_accept', !auto_accept)}
          className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
            auto_accept ? 'bg-navy-primary' : 'bg-gray-300'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
              auto_accept ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export default BookingRulesCard;
