import React from 'react';

const ProgressCard = ({ milestones = [], status = 'active', showLabel = true, size = 'md' }) => {
  // Calculate percentage dynamically from database milestones or status progression
  let percent = 0;

  if (Array.isArray(milestones) && milestones.length > 0) {
    const completed = milestones.filter(
      (m) => String(m.status).toLowerCase() === 'completed' || m.completed === true || m.is_completed === true
    ).length;
    percent = Math.round((completed / milestones.length) * 100);
  } else {
    const norm = String(status).trim().toLowerCase();
    if (norm === 'completed' || norm === 'resolved' || norm === 'closed') {
      percent = 100;
    } else if (norm === 'in progress' || norm === 'in_progress' || norm.includes('ongoing') || norm === 'hearing') {
      percent = 65;
    } else if (norm === 'active' || norm === 'confirmed' || norm === 'hired') {
      percent = 35;
    } else if (norm.includes('waiting')) {
      percent = 50;
    } else if (norm === 'pending' || norm.includes('pending_negotiation')) {
      percent = 15;
    } else if (norm === 'cancelled' || norm === 'rejected') {
      percent = 0;
    } else {
      percent = 25;
    }
  }

  // Determine progress bar color gradient
  let barColor = 'from-blue-500 to-indigo-600';
  if (percent === 100) {
    barColor = 'from-emerald-500 to-teal-600';
  } else if (percent >= 60) {
    barColor = 'from-purple-500 to-indigo-600';
  } else if (percent <= 20) {
    barColor = 'from-amber-500 to-orange-500';
  }

  const heightClass = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';

  return (
    <div className="w-full space-y-1.5">
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-gray-600 flex items-center gap-1">
            <span>Progress:</span>
            {milestones.length > 0 && (
              <span className="font-normal text-text-muted">
                ({milestones.filter((m) => String(m.status).toLowerCase() === 'completed' || m.completed).length}/{milestones.length} milestones)
              </span>
            )}
          </span>
          <span className="text-navy-primary font-black">{percent}%</span>
        </div>
      )}
      <div className={`w-full bg-bg-light rounded-full overflow-hidden border border-border-subtle/80 ${heightClass}`}>
        <div
          className={`h-full bg-gradient-to-r ${barColor} transition-all duration-700 ease-out rounded-full shadow-2xs`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressCard;
