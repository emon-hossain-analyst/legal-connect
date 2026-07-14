import React from 'react';

const CaseStatusBadge = ({ status = 'Active', size = 'md' }) => {
  const norm = String(status).trim().toLowerCase();

  let colorStyle = 'bg-blue-50 text-blue-700 border-blue-300'; // Default to Blue / Active
  let label = 'Active';
  let icon = '⚡';

  if (norm.includes('pending') && norm.includes('payment')) {
    colorStyle = 'bg-amber-50 text-amber-800 border-amber-300';
    label = 'Payment Pending';
    icon = '💳';
  } else if (norm === 'pending' || norm.includes('pending_negotiation') || norm === 'proposed') {
    colorStyle = 'bg-yellow-50 text-yellow-800 border-yellow-300';
    label = 'Pending';
    icon = '⏳';
  } else if (norm === 'in progress' || norm === 'in_progress' || norm.includes('ongoing') || norm === 'hearing') {
    colorStyle = 'bg-purple-50 text-purple-700 border-purple-300';
    label = 'In Progress';
    icon = '⚖️';
  } else if (norm === 'completed' || norm === 'resolved' || norm === 'closed') {
    colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-300';
    label = 'Completed';
    icon = '✅';
  } else if (norm === 'cancelled' || norm === 'rejected' || norm === 'terminated') {
    colorStyle = 'bg-rose-50 text-rose-700 border-rose-300';
    label = 'Cancelled';
    icon = '❌';
  } else if (norm.includes('waiting') || norm.includes('client review')) {
    colorStyle = 'bg-orange-50 text-orange-700 border-orange-300';
    label = 'Waiting for Client';
    icon = '🔔';
  } else if (norm === 'active' || norm === 'confirmed' || norm === 'hired') {
    colorStyle = 'bg-blue-50 text-blue-700 border-blue-300';
    label = 'Active';
    icon = '⚡';
  } else {
    // Capitalize custom status
    label = status.charAt(0).toUpperCase() + status.slice(1);
  }

  const sizeClass = size === 'sm' 
    ? 'px-2 py-0.5 text-[10px] gap-1' 
    : size === 'lg' 
    ? 'px-3 py-1.5 text-xs sm:text-sm gap-1.5' 
    : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border shadow-2xs whitespace-nowrap select-none transition ${colorStyle} ${sizeClass}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
};

export default CaseStatusBadge;
