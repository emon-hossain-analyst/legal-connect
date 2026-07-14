import React from 'react';

const CancellationCard = ({ settings, onChange }) => {
  const {
    cancellation_window = 24,
    refund_policy = 'Full',
    late_fee_enabled = false,
    late_fee_percentage = 0,
  } = settings;

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-sm space-y-6 transition hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg">
          <span>🛡️</span>
        </div>
        <div>
          <h3 className="text-xl font-serif font-bold text-navy-primary">Cancellation & Refund Policy</h3>
          <p className="text-xs text-text-muted mt-0.5">Establish terms for missed appointments, cancellation deadlines, and refund schedules.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Cancellation Window Dropdown */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-navy-primary">
            Cancellation Deadline Window
          </label>
          <select
            value={cancellation_window}
            onChange={(e) => onChange('cancellation_window', Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-border-subtle rounded-xl bg-white focus:outline-none focus:border-accent-gold text-sm font-semibold text-navy-primary transition"
          >
            <option value={12}>12 hours prior to start time</option>
            <option value={24}>24 hours prior to start time</option>
            <option value={48}>48 hours prior to start time</option>
            <option value={72}>72 hours prior to start time</option>
          </select>
          <span className="text-xs text-gray-500 block">Clients canceling after this window may be subject to penalty.</span>
        </div>

        {/* Refund Policy Radio Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-navy-primary">
            Default Refund Policy
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['Full', 'Partial', 'None'].map((policy) => {
              const isSelected = refund_policy === policy;
              return (
                <button
                  type="button"
                  key={policy}
                  onClick={() => onChange('refund_policy', policy)}
                  className={`py-2.5 px-3 rounded-xl border font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-navy-primary text-white border-navy-primary shadow-sm font-black'
                      : 'bg-white text-gray-600 border-border-subtle hover:bg-bg-light'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-accent-gold' : 'bg-gray-300'}`}></span>
                  <span>{policy === 'None' ? 'No Refund' : `${policy} Refund`}</span>
                </button>
              );
            })}
          </div>
          <span className="text-xs text-gray-500 block">Applies to eligible cancellations requested within the deadline.</span>
        </div>
      </div>

      {/* Late Cancellation Fee Toggle */}
      <div className="p-4 rounded-xl bg-bg-light/50 border border-border-subtle/80 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-navy-primary block">Charge Late Cancellation Fee</span>
            <span className="text-xs text-text-muted block mt-0.5">
              Deduct a penalty percentage if the client cancels after the deadline or misses the session.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange('late_fee_enabled', !late_fee_enabled)}
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
              late_fee_enabled ? 'bg-navy-primary' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                late_fee_enabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Percentage Input if enabled */}
        {late_fee_enabled && (
          <div className="pt-3 border-t border-border-subtle/60 flex items-center gap-4 animate-fadeIn">
            <label className="text-xs font-bold text-navy-primary uppercase tracking-wider whitespace-nowrap">
              Penalty Percentage:
            </label>
            <div className="relative w-36">
              <input
                type="number"
                min="0"
                max="100"
                value={late_fee_percentage || 0}
                onChange={(e) => onChange('late_fee_percentage', Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-full pl-4 pr-10 py-2 border border-border-subtle rounded-xl focus:outline-none focus:border-accent-gold text-sm font-bold text-navy-primary transition"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-black text-gray-500 text-sm select-none">
                %
              </span>
            </div>
            <span className="text-xs text-gray-500">of the total consultation fee.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CancellationCard;
