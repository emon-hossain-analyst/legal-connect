import React from 'react';

const LawyerNotificationsView = () => {
  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-surface-container-lowest">
      <div className="mb-8 animate-fadeIn">
        <h2 className="font-serif text-[32px] font-bold text-[#041635] mb-2">Notifications</h2>
        <p className="text-gray-600 text-[15px] max-w-xl">
          Stay updated on your appointments, cases, and messages.
        </p>
      </div>

      <div className="bg-white p-8 rounded-lg border border-[#D0D7E3] text-center text-gray-500 shadow-sm animate-fadeIn">
        <span className="material-symbols-outlined text-4xl mb-4 text-gray-300">notifications_off</span>
        <h3 className="text-xl font-bold text-gray-700 mb-2">You're all caught up!</h3>
        <p>You have no new notifications at this time.</p>
      </div>
    </div>
  );
};

export default LawyerNotificationsView;
