import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { APPOINTMENT_STATUS } from '../../constants/appointmentStatus';

const STATUS_LABELS = {
  [APPOINTMENT_STATUS.COMPLETED]: 'Completed',
  [APPOINTMENT_STATUS.HISTORY]: 'Completed',
  [APPOINTMENT_STATUS.CANCELLED]: 'Cancelled',
  [APPOINTMENT_STATUS.NO_SHOW]: 'No-Show',
};

const STATUS_BADGE = {
  [APPOINTMENT_STATUS.COMPLETED]: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  [APPOINTMENT_STATUS.HISTORY]: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  [APPOINTMENT_STATUS.CANCELLED]: 'bg-red-50 text-red-700 border border-red-200',
  [APPOINTMENT_STATUS.NO_SHOW]: 'bg-amber-50 text-amber-700 border border-amber-200',
};

// Read-only archive of completed/cancelled/no-show bookings — kept out of
// the active bookings list in LawyerAppointmentsView.js.
const BookingHistory = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select('*, client:client_id(id, name, full_name, avatar_url)')
        .eq('lawyer_id', user.id)
        .in('status', [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.HISTORY, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW])
        .order('scheduled_at', { ascending: false });
      if (!error) setBookings(data || []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">Loading booking history...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h2 className="text-xl font-serif font-bold text-[#041635]">Booking History</h2>
      <p className="text-sm text-gray-500">Completed, cancelled, and no-show consultations. This list is read-only.</p>

      {bookings.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500 text-sm">
          No past bookings yet.
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((apt) => (
            <div key={apt.id} className="bg-white rounded-lg border border-[#D0D7E3] p-4 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-[#041635] text-sm">{apt.consultation_type || apt.reason || 'Legal Consultation'}</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_BADGE[apt.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[apt.status] || apt.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  With {apt.client?.name || apt.client?.full_name || 'Client'} &middot; {new Date(apt.scheduled_at || apt.scheduled_time).toLocaleString()}
                </p>
              </div>
              <div className="text-right text-sm font-bold text-[#041635]">
                BDT {Number(apt.agreed_fee || apt.fee_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingHistory;
