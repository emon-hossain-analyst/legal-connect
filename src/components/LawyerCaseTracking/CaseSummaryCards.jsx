import React from 'react';

const CaseSummaryCards = ({ stats = {} }) => {
  const {
    activeCases = 0,
    pendingContracts = 0,
    completedCases = 0,
    totalEarnings = 0,
    upcomingMeetings = 0,
    averageRating = 0,
  } = stats;

  const summaryItems = [
    {
      title: 'Active Cases',
      value: activeCases,
      icon: '⚡',
      color: 'blue',
      desc: 'Ongoing legal matters & hearings',
      bgClass: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    {
      title: 'Pending Contracts',
      value: pendingContracts,
      icon: '⏳',
      color: 'amber',
      desc: 'Awaiting client signature / fee',
      bgClass: 'bg-amber-50 text-amber-600 border-amber-200',
    },
    {
      title: 'Completed Cases',
      value: completedCases,
      icon: '✅',
      color: 'emerald',
      desc: 'Successfully closed matters',
      bgClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
    {
      title: 'Total Earnings',
      value: `BDT ${Number(totalEarnings || 0).toLocaleString()}`,
      icon: '💰',
      color: 'purple',
      desc: 'Net revenue across contracts',
      bgClass: 'bg-purple-50 text-purple-600 border-purple-200',
    },
    {
      title: 'Upcoming Meetings',
      value: upcomingMeetings,
      icon: '📅',
      color: 'indigo',
      desc: 'Scheduled sessions & court dates',
      bgClass: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    },
    {
      title: 'Average Rating',
      value: averageRating > 0 ? `${Number(averageRating).toFixed(1)} ★` : 'N/A',
      icon: '⭐',
      color: 'gold',
      desc: 'Overall client feedback rating',
      bgClass: 'bg-amber-50 text-amber-700 border-amber-300',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {summaryItems.map((item, idx) => (
        <div
          key={idx}
          className="bg-white rounded-2xl border border-border-subtle p-5 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider line-clamp-1">
              {item.title}
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0 border ${item.bgClass}`}
            >
              <span>{item.icon}</span>
            </div>
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-serif font-bold text-navy-primary tracking-tight truncate">
              {item.value}
            </h4>
            <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CaseSummaryCards;
