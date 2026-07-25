// Canonical appointments.status values — mirrors the CHECK constraint added
// in sql/75_appointment_status_normalization.sql.
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  PENDING_NEGOTIATION: 'pending_negotiation',
  CONFIRMED: 'confirmed',
  RESCHEDULE_PROPOSED: 'reschedule_proposed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
  COMPLETED: 'completed', // legacy path via fn_consultation_action (ungated)
  HISTORY: 'history', // new gated path via fn_complete_consultation (post slot-end)
};

// Both mean "the consultation is done" — kept as two values so the existing
// ungated fn_consultation_action('complete') stays backward compatible while
// fn_complete_consultation writes the new, properly-gated terminal state.
export const isFinishedAppointment = (status) =>
  status === APPOINTMENT_STATUS.COMPLETED || status === APPOINTMENT_STATUS.HISTORY;
