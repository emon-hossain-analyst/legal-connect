import React from 'react';

const TimelineCard = ({ caseData, milestones = [], contractTimeline = [], deliverables = [] }) => {
  if (!caseData) return null;

  const rawEvents = [];

  // 1. Case Initialized / Created
  if (caseData.created_at || caseData.updated_at) {
    rawEvents.push({
      title: 'Case Record Initialized',
      rawDate: new Date(caseData.created_at || caseData.updated_at),
      status: 'completed',
      icon: '🎉',
      desc: 'Case matter successfully registered in Supabase database.',
    });
  }

  // 2. Contract Status & Execution
  if (caseData.contract) {
    const normStatus = String(caseData.contract.status).toUpperCase();
    const isSignedOrActive = ['ACTIVE', 'SIGNED', 'COMPLETED', 'ARCHIVED', 'UNDER_CLIENT_REVIEW', 'REVISION_REQUESTED'].includes(normStatus);
    rawEvents.push({
      title: isSignedOrActive ? `Contract #${caseData.contract.id?.slice(0, 6) || 'CNT'} Active` : 'Contract Created & Pending Review',
      rawDate: new Date(caseData.contract.updated_at || caseData.contract.created_at || Date.now()),
      status: isSignedOrActive ? 'completed' : 'in-progress',
      icon: '📜',
      desc: isSignedOrActive
        ? `Contract executed. Agreed Fee: BDT ${Number(caseData.contract.amount || caseData.contract.agreed_fee || 0).toLocaleString()}`
        : 'Awaiting client approval of contract terms.',
    });
  }

  // 3. Database Contract Timeline Events (progress updates, revision requests, approvals, etc.)
  if (Array.isArray(contractTimeline) && contractTimeline.length > 0) {
    contractTimeline.forEach((ct) => {
      let icon = '📋';
      let status = 'completed';
      if (ct.event_type === 'progress_update') icon = '⚡';
      if (ct.event_type === 'ready_for_review') { icon = '👀'; status = 'in-progress'; }
      if (ct.event_type === 'revision_request') { icon = '🔄'; status = 'in-progress'; }
      if (ct.event_type === 'approval') icon = '✅';
      if (ct.event_type === 'contract_accepted') icon = '🤝';

      rawEvents.push({
        title: ct.title || 'Workflow Event',
        rawDate: new Date(ct.created_at || Date.now()),
        status: status,
        icon: icon,
        desc: ct.note || `Update by ${ct.author_role || 'user'}.`,
      });
    });
  }

  // 4. Deliverables Uploaded
  if (Array.isArray(deliverables) && deliverables.length > 0) {
    deliverables.forEach((deliv) => {
      rawEvents.push({
        title: deliv.is_final ? 'Work Delivery Submitted' : `Document Upload: ${deliv.title}`,
        rawDate: new Date(deliv.created_at || Date.now()),
        status: 'completed',
        icon: '📦',
        desc: deliv.description || (deliv.file_url ? `File uploaded: ${deliv.title}` : 'Deliverable submitted for audit.'),
      });
    });
  }

  // 5. Database Milestones
  if (Array.isArray(milestones) && milestones.length > 0) {
    milestones.forEach((m, idx) => {
      const mDone = String(m.status).toLowerCase() === 'completed' || String(m.status).toLowerCase() === 'approved';
      rawEvents.push({
        title: m.title || `Milestone #${idx + 1}`,
        rawDate: new Date(m.completed_at || m.due_date || m.created_at || Date.now()),
        status: mDone ? 'completed' : 'in-progress',
        icon: '⚖️',
        desc: m.description || `Milestone fee: BDT ${Number(m.milestone_fee || 0).toLocaleString()}. Status: ${m.status}`,
      });
    });
  }

  // 6. Case Completion / Closed Status
  const isComplete = String(caseData.status).toLowerCase() === 'completed' || String(caseData.status).toLowerCase() === 'closed';
  if (isComplete) {
    rawEvents.push({
      title: 'Case Completed & Closed',
      rawDate: new Date(caseData.updated_at || Date.now()),
      status: 'completed',
      icon: '🏆',
      desc: 'All work approved, payments released, and matter archived.',
    });
  }

  // Sort events chronologically (oldest to newest)
  rawEvents.sort((a, b) => a.rawDate - b.rawDate);

  const events = rawEvents.map((ev) => ({
    ...ev,
    timestamp: ev.rawDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-sm text-center">
        <p className="text-xs text-text-muted">No timeline events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div>
          <h4 className="font-serif font-bold text-lg text-navy-primary flex items-center gap-2">
            <span>📅</span>
            <span>Case Progression & Audit Timeline</span>
          </h4>
          <p className="text-xs text-text-muted mt-0.5">Real database chronological record of milestones, updates, and deliverables.</p>
        </div>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-subtle">
        {events.map((ev, i) => {
          const isDone = ev.status === 'completed';
          const isCurr = ev.status === 'in-progress';
          return (
            <div key={i} className="relative flex items-start gap-4">
              <div
                className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-10 border-2 ${
                  isDone
                    ? 'bg-emerald-500 text-white border-white shadow-xs'
                    : isCurr
                    ? 'bg-amber-500 text-white border-white animate-pulse shadow-xs'
                    : 'bg-gray-200 text-gray-500 border-white'
                }`}
              >
                {isDone ? '✓' : isCurr ? '•' : ''}
              </div>
              <div className="flex-1 bg-bg-light/50 p-4 rounded-xl border border-border-subtle/80 hover:bg-bg-light transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-bold text-sm text-navy-primary flex items-center gap-1.5">
                    <span>{ev.icon}</span>
                    <span>{ev.title}</span>
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md self-start sm:self-auto ${
                      isDone
                        ? 'bg-emerald-100 text-emerald-800'
                        : isCurr
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {ev.timestamp}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{ev.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineCard;
