import React from 'react';

const CommunicationCard = ({ settings, onChange }) => {
  const {
    communication_methods = [],
    preferred_channel = 'Video Call',
    email_confirmation = true,
    sms_reminder = false,
  } = settings;

  const allMethods = [
    { id: 'Video Call', label: 'Video Call', icon: '📹', desc: 'In-app or Google Meet / Zoom' },
    { id: 'Phone', label: 'Phone Call', icon: '📞', desc: 'Direct cellular audio session' },
    { id: 'Chat', label: 'Platform Chat', icon: '💬', desc: 'Secure real-time text consultation' },
    { id: 'In Office', label: 'In Office', icon: '🏢', desc: 'Face-to-face chamber visit' },
  ];

  const handleToggleMethod = (methodId) => {
    let updated = [...communication_methods];
    if (updated.includes(methodId)) {
      updated = updated.filter((m) => m !== methodId);
    } else {
      updated.push(methodId);
    }
    onChange('communication_methods', updated);
  };

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-sm space-y-6 transition hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
        <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-lg">
          <span>💬</span>
        </div>
        <div>
          <h3 className="text-xl font-serif font-bold text-navy-primary">Communication & Reminders</h3>
          <p className="text-xs text-text-muted mt-0.5">Specify supported contact mediums and automated client notifications.</p>
        </div>
      </div>

      {/* Supported Mediums Checkboxes */}
      <div className="space-y-3">
        <label className="block text-sm font-bold text-navy-primary">
          Supported Consultation Mediums <span className="text-gray-400 font-normal text-xs">(Check all that apply)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {allMethods.map((m) => {
            const isChecked = communication_methods.includes(m.id);
            return (
              <button
                type="button"
                key={m.id}
                onClick={() => handleToggleMethod(m.id)}
                className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                  isChecked
                    ? 'bg-navy-primary/5 border-navy-primary shadow-sm'
                    : 'bg-white border-border-subtle hover:bg-bg-light'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 transition ${
                    isChecked ? 'bg-navy-primary text-white' : 'border border-gray-300 bg-white'
                  }`}
                >
                  {isChecked && '✓'}
                </div>
                <div>
                  <div className="font-bold text-navy-primary text-sm flex items-center gap-1.5">
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{m.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferred Channel Dropdown */}
      <div className="space-y-2 pt-2 border-t border-border-subtle/60">
        <label className="block text-sm font-bold text-navy-primary">
          Preferred Communication Channel
        </label>
        <select
          value={preferred_channel}
          onChange={(e) => onChange('preferred_channel', e.target.value)}
          className="w-full sm:max-w-md px-4 py-2.5 border border-border-subtle rounded-xl bg-white focus:outline-none focus:border-accent-gold text-sm font-semibold text-navy-primary transition"
        >
          <option value="Video Call">📹 Video Call (Recommended)</option>
          <option value="Phone Call">📞 Direct Phone Call</option>
          <option value="Platform Chat">💬 Secure Platform Chat</option>
          <option value="In-Office Visit">🏢 Chamber In-Office Visit</option>
        </select>
        <span className="text-xs text-gray-500 block">Highlighted to clients as your top recommended meeting method.</span>
      </div>

      {/* Automated Notifications Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* Email Confirmation Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-bg-light/50 border border-border-subtle">
          <div>
            <span className="text-sm font-bold text-navy-primary block">Email Confirmation</span>
            <span className="text-[11px] text-text-muted block mt-0.5">Send instant PDF receipts and calendar invites via email.</span>
          </div>
          <button
            type="button"
            onClick={() => onChange('email_confirmation', !email_confirmation)}
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 ${
              email_confirmation ? 'bg-navy-primary' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                email_confirmation ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* SMS Reminder Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-bg-light/50 border border-border-subtle">
          <div>
            <span className="text-sm font-bold text-navy-primary block">SMS Reminder</span>
            <span className="text-[11px] text-text-muted block mt-0.5">Automated SMS alerts 1 hour prior to session start.</span>
          </div>
          <button
            type="button"
            onClick={() => onChange('sms_reminder', !sms_reminder)}
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 ${
              sms_reminder ? 'bg-navy-primary' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                sms_reminder ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommunicationCard;
