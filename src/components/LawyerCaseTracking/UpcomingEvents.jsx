import React from 'react';

const UpcomingEvents = ({ cases = [], appointments = [] }) => {
  const now = new Date();
  const events = [];

  // Extract upcoming appointments / meetings
  if (Array.isArray(appointments)) {
    appointments.forEach((apt) => {
      const aptDate = apt.scheduled_at || apt.date || apt.appointment_date;
      if (aptDate) {
        const d = new Date(aptDate);
        if (!isNaN(d.getTime()) && d >= now) {
          events.push({
            id: `apt_${apt.id}`,
            title: apt.session_type ? `${apt.session_type} with ${apt.client?.name || 'Client'}` : 'Scheduled Client Consultation',
            date: d,
            type: 'Meeting',
            icon: '📅',
            color: 'bg-blue-50 text-blue-700 border-blue-200',
            client: apt.client?.name || 'Client',
            caseTitle: apt.reason || 'Legal Consultation',
          });
        }
      }
    });
  }

  // Extract case deadlines or court hearing dates from active cases and milestones
  if (Array.isArray(cases)) {
    cases.forEach((c) => {
      // Check milestones
      if (Array.isArray(c.case_milestones || c.case_progress)) {
        const mList = c.case_milestones || c.case_progress;
        mList.forEach((m) => {
          if (m.due_date && (!m.status || String(m.status).toLowerCase() !== 'completed')) {
            const md = new Date(m.due_date);
            if (!isNaN(md.getTime()) && md >= now) {
              events.push({
                id: `milestone_${m.id}`,
                title: m.title || 'Case Milestone Deadline',
                date: md,
                type: 'Deadline',
                icon: '⏰',
                color: 'bg-amber-50 text-amber-800 border-amber-200',
                client: c.client?.name || 'Client',
                caseTitle: c.title || 'Active Case Matter',
              });
            }
          }
        });
      }

      // Check next_hearing_date or deadline on case itself
      const cDate = c.next_hearing_date || c.deadline || c.estimated_completion;
      if (cDate) {
        const cd = new Date(cDate);
        if (!isNaN(cd.getTime()) && cd >= now) {
          events.push({
            id: `case_${c.id}`,
            title: c.next_hearing_date ? 'Court Hearing / Bench Session' : 'Estimated Case Completion',
            date: cd,
            type: c.next_hearing_date ? 'Hearing' : 'Deadline',
            icon: c.next_hearing_date ? '🏛️' : '🎯',
            color: c.next_hearing_date ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
            client: c.client?.name || 'Client',
            caseTitle: c.title || 'Active Case Matter',
          });
        }
      }
    });
  }

  // Sort by nearest date ascending
  events.sort((a, b) => a.date - b.date);

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div>
          <h4 className="font-serif font-bold text-base text-navy-primary flex items-center gap-2">
            <span>🗓️</span>
            <span>Upcoming Meetings & Deadlines</span>
          </h4>
          <p className="text-xs text-text-muted mt-0.5">Live schedule sorted by nearest upcoming date.</p>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-navy-primary text-accent-gold shadow-2xs">
          {events.length} {events.length === 1 ? 'Event' : 'Events'}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-6 bg-bg-light/60 rounded-xl border border-dashed border-border-subtle">
          <span className="text-2xl block mb-1">🎉</span>
          <h5 className="font-bold text-navy-primary text-xs">No Upcoming Deadlines or Hearings</h5>
          <p className="text-[11px] text-gray-500 mt-0.5">All scheduled consultations and case milestones are up to date.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="p-3.5 rounded-xl border border-border-subtle/80 bg-bg-light/40 hover:bg-bg-light transition space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-xs text-navy-primary flex items-center gap-1.5 line-clamp-1">
                  <span>{ev.icon}</span>
                  <span>{ev.title}</span>
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap flex-shrink-0 ${ev.color}`}>
                  {ev.type}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-600">
                <span className="truncate max-w-[180px] font-medium text-text-muted">
                  Client: <strong className="text-navy-primary">{ev.client}</strong>
                </span>
                <span className="font-bold text-navy-primary">
                  {ev.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UpcomingEvents;
