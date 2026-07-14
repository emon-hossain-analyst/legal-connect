import React from 'react';

const PricingCard = ({ settings, onChange }) => {
  const {
    hourly_rate = 0,
    initial_fee = 0,
    case_review_fee = 0,
    followup_fee = 0,
    emergency_fee = 0,
    flat_fee = '',
  } = settings;

  const handleNumberChange = (field, val) => {
    if (val === '') {
      onChange(field, '');
      return;
    }
    const num = Math.max(0, Number(val));
    onChange(field, num);
  };

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-sm space-y-6 transition hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
          <span>💳</span>
        </div>
        <div>
          <h3 className="text-xl font-serif font-bold text-navy-primary">Pricing & Fee Structure</h3>
          <p className="text-xs text-text-muted mt-0.5">Configure transparent fee rates displayed directly to clients when booking.</p>
        </div>
      </div>

      {/* Hourly Rate & Flat Fee */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-navy-primary">
            Standard Hourly Rate <span className="text-rose-500">*</span>
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 px-2 py-1 bg-bg-light text-navy-primary font-black text-xs rounded border border-border-subtle select-none">
              BDT
            </span>
            <input
              type="number"
              min="0"
              step="100"
              required
              value={hourly_rate}
              onChange={(e) => handleNumberChange('hourly_rate', e.target.value)}
              placeholder="0"
              className="w-full pl-16 pr-4 py-2.5 border border-border-subtle rounded-xl focus:outline-none focus:border-accent-gold text-sm font-bold text-navy-primary transition"
            />
          </div>
          <span className="text-[11px] text-gray-500 block">Baseline rate charged per 60 minutes.</span>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-navy-primary">
            Optional Flat Fee <span className="text-gray-400 font-normal text-xs">(Retainer / Bundle)</span>
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 px-2 py-1 bg-bg-light text-navy-primary font-black text-xs rounded border border-border-subtle select-none">
              BDT
            </span>
            <input
              type="number"
              min="0"
              step="100"
              value={flat_fee === null || flat_fee === undefined ? '' : flat_fee}
              onChange={(e) => handleNumberChange('flat_fee', e.target.value)}
              placeholder="Leave blank if not offered"
              className="w-full pl-16 pr-4 py-2.5 border border-border-subtle rounded-xl focus:outline-none focus:border-accent-gold text-sm font-bold text-navy-primary transition"
            />
          </div>
          <span className="text-[11px] text-gray-500 block">Fixed rate for standardized advice sessions.</span>
        </div>
      </div>

      {/* Specific Session Type Fees */}
      <div className="space-y-4 pt-4 border-t border-border-subtle/60">
        <h4 className="text-sm font-bold uppercase tracking-wider text-text-muted">
          Session-Type Specific Fees (Starting Rates Displayed to Clients)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700">Initial Consultation Fee</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 px-2 py-1 bg-bg-light text-navy-primary font-black text-xs rounded border border-border-subtle select-none">
                BDT
              </span>
              <input
                type="number"
                min="0"
                step="100"
                value={initial_fee}
                onChange={(e) => handleNumberChange('initial_fee', e.target.value)}
                className="w-full pl-16 pr-4 py-2 border border-border-subtle rounded-xl focus:outline-none focus:border-accent-gold text-sm font-semibold text-navy-primary transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700">Case Review Fee</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 px-2 py-1 bg-bg-light text-navy-primary font-black text-xs rounded border border-border-subtle select-none">
                BDT
              </span>
              <input
                type="number"
                min="0"
                step="100"
                value={case_review_fee}
                onChange={(e) => handleNumberChange('case_review_fee', e.target.value)}
                className="w-full pl-16 pr-4 py-2 border border-border-subtle rounded-xl focus:outline-none focus:border-accent-gold text-sm font-semibold text-navy-primary transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700">Follow-up Session Fee</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 px-2 py-1 bg-bg-light text-navy-primary font-black text-xs rounded border border-border-subtle select-none">
                BDT
              </span>
              <input
                type="number"
                min="0"
                step="100"
                value={followup_fee}
                onChange={(e) => handleNumberChange('followup_fee', e.target.value)}
                className="w-full pl-16 pr-4 py-2 border border-border-subtle rounded-xl focus:outline-none focus:border-accent-gold text-sm font-semibold text-navy-primary transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700">Emergency Consultation Fee</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 px-2 py-1 bg-bg-light text-navy-primary font-black text-xs rounded border border-border-subtle select-none">
                BDT
              </span>
              <input
                type="number"
                min="0"
                step="100"
                value={emergency_fee}
                onChange={(e) => handleNumberChange('emergency_fee', e.target.value)}
                className="w-full pl-16 pr-4 py-2 border border-border-subtle rounded-xl focus:outline-none focus:border-accent-gold text-sm font-semibold text-navy-primary transition"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingCard;
