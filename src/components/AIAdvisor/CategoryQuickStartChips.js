import React from 'react';

const QUICK_CATEGORIES = [
  {
    name: 'Family Law',
    icon: 'family_restroom',
    prompt: 'I need guidance on a family law dispute regarding marriage, divorce, child custody, or dower (denmohar).',
    color: 'bg-teal-500/10 text-teal-700 hover:bg-teal-500/20 border-teal-500/20 dark:text-teal-300'
  },
  {
    name: 'Property Law',
    icon: 'real_estate_agent',
    prompt: 'I need help verifying land deeds, khatian records, or resolving a property and tenancy dispute.',
    color: 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/20 dark:text-emerald-300'
  },
  {
    name: 'Criminal Law',
    icon: 'gavel',
    prompt: 'I need legal assistance with a criminal law matter regarding bail, arrest, or police investigation.',
    color: 'bg-red-500/10 text-red-700 hover:bg-red-500/20 border-red-500/20 dark:text-red-300'
  },
  {
    name: 'Corporate Law',
    icon: 'business_center',
    prompt: 'I need legal advice on company formation, RJSC registration, trade license, or corporate compliance.',
    color: 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-blue-500/20 dark:text-blue-300'
  },
  {
    name: 'Civil Law',
    icon: 'balance',
    prompt: 'I need advice regarding a civil contract breach, money recovery, or sending a formal legal notice.',
    color: 'bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 border-purple-500/20 dark:text-purple-300'
  },
  {
    name: 'Labor Law',
    icon: 'work',
    prompt: 'I need guidance on employment rights, wrongful termination, salary dues, or labor court procedures.',
    color: 'bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 border-amber-500/20 dark:text-amber-300'
  },
  {
    name: 'Immigration Law',
    icon: 'flight_takeoff',
    prompt: 'I need assistance regarding visa, work permit, dual citizenship, or overseas employment migration.',
    color: 'bg-cyan-500/10 text-cyan-800 hover:bg-cyan-500/20 border-cyan-500/20 dark:text-cyan-300'
  },
  {
    name: 'Tax Law',
    icon: 'receipt_long',
    prompt: 'I need advice on income tax return, NBR compliance, VAT registration, or customs duty exemption.',
    color: 'bg-yellow-500/10 text-yellow-800 hover:bg-yellow-500/20 border-yellow-500/20 dark:text-yellow-300'
  }
];

const CategoryQuickStartChips = ({ onSelectCategory }) => {
  return (
    <div className="mt-4 pt-4 border-t border-outline-variant/60 animate-fadeIn">
      <div className="flex items-center gap-1.5 mb-3 text-xs font-bold uppercase tracking-wider text-outline">
        <span className="material-symbols-outlined text-[16px]">touch_app</span>
        <span>Quick-Start Practice Areas</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            onClick={() => onSelectCategory(cat.name, cat.prompt)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 active:scale-95 shadow-sm hover:shadow ${cat.color}`}
          >
            <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryQuickStartChips;
