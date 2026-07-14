import React from 'react';

const TimelineCard = ({ caseData, milestones = [] }) => {
  if (!caseData) return null;

  // Construct standard milestones + dynamic database events
  const events = [];

  // 1. Case Accepted / Created
  if (caseData.created_at || caseData.updated_at) {
    events.push({
      title: 'Case Accepted & Initialized',
      timestamp: new Date(caseData.created_at || caseData.updated_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'completed',
      icon: '🎉',
      desc: 'Client proposal accepted and case record generated in database.',
    });
  }

  // 2. Contract Signed
  if (caseData.contract) {
    const isSigned = caseData.contract.status === 'active' || caseData.contract.status === 'signed';
    events.push({
      title: 'Contract Signed by Parties',
      timestamp: isSigned
        ? new Date(caseData.contract.updated_at || caseData.contract.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Pending Client Signature',
      status: isSigned ? 'completed' : 'in-progress',
      icon: '📜',
      desc: isSigned
        ? `Contract #${caseData.contract.id || 'CNT'} executed and binding.`
        : 'Waiting for client electronic signature.',
    });
  } else {
    events.push({
      title: 'Contract Preparation',
      timestamp: 'Not Yet Drafted',
      status: 'pending',
      icon: '📜',
      desc: 'Formal retainer contract to be issued by advocate.',
    });
  }

  // 3. Payment Received
  const feePaid = caseData.contract?.amount || caseData.agreed_fee;
  const isPaid = caseData.contract?.status === 'active' || caseData.payment_status === 'paid';
  events.push({
    title: 'Initial Retainer / Fee Payment',
    timestamp: isPaid
      ? new Date(caseData.updated_at || Date.now()).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Payment Pending',
    status: isPaid ? 'completed' : caseData.contract ? 'in-progress' : 'pending',
    icon: '💰',
    desc: isPaid ? `Fee deposit confirmed (BDT ${Number(feePaid || 0).toLocaleString()}).` : 'Awaiting payment verification.',
  });

  // 4. Documents Uploaded
  events.push({
    title: 'Case Documents & Evidence Uploaded',
    timestamp: 'In Progress',
    status: 'in-progress',
    icon: '📂',
    desc: 'Shared document vault between advocate and client.',
  });

  // 5. Consultation & Hearings from Milestones
  if (Array.isArray(milestones) && milestones.length > 0) {
    milestones.forEach((m, idx) => {
      const mDone = String(m.status).toLowerCase() === 'completed' || m.completed;
      events.push({
        title: m.title || `Milestone #${idx + 1}`,
        timestamp: m.due_date
          ? new Date(m.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : m.created_at
          ? new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Ongoing',
        status: mDone ? 'completed' : 'in-progress',
        icon: '⚖️',
        desc: m.description || `Specific milestone tracking item (Fee: BDT ${m.milestone_fee || 0}).`,
      });
    });
  } else {
    events.push({
      title: 'Consultations & Court Hearings',
      timestamp: 'Scheduled as needed',
      status: 'pending',
      icon: '🏛️',
      desc: 'Milestones and hearing dates will appear here once tracked.',
    });
  }

  // 6. Case Completion
  const isComplete = String(caseData.status).toLowerCase() === 'completed' || String(caseData.status).toLowerCase() === 'closed';
  events.push({
    title: 'Case Completed & Closed',
    timestamp: isComplete ? new Date(caseData.updated_at).toLocaleDateString() : 'Target Completion',
    status: isComplete ? 'completed' : 'pending',
    icon: '🏆',
    desc: isComplete ? 'All matters resolved and archived.' : 'Final resolution stage.',
  });

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div>
          <h4 className="font-serif font-bold text-lg text-navy-primary flex items-center gap-2">
            <span>📅</span>
            <span>Case Progression & Audit Timeline</span>
          </h4>
          <p className="text-xs text-text-muted mt-0.5">Chronological record of milestones and contract actions.</p>
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
