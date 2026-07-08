import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const LawyerAppointmentsView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [selectedApt, setSelectedApt] = useState(null);
  const [meetingUrlInput, setMeetingUrlInput] = useState('');
  
  // Negotiation State
  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterNote, setCounterNote] = useState('');

  useEffect(() => {
    if (!user) return;
    
    fetchAppointments();

    const channel = supabase.channel(`lawyer_appointments_realtime_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
        fetchAppointments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      // 1. Auth Verification & ID Collection
      const { data: { session } } = await supabase.auth.getSession();
      const rawUserIds = [...new Set([session?.user?.id, user?.id, user?.auth_id].filter(Boolean))];
      if (rawUserIds.length === 0) {
        setAppointments([]);
        setLoading(false);
        return;
      }

      const uuidList = rawUserIds.filter(id => isNaN(Number(id)));
      let intList = [];

      // Get lawyer Integer IDs safely
      if (uuidList.length > 0) {
        try {
          const { data: lRes } = await supabase
            .from('lawyers')
            .select('id')
            .in('user_id', uuidList);
          if (lRes) {
            intList = lRes.map(l => l.id).filter(Boolean);
          }
        } catch (lErr) {}
      }

      let aptsData = [];

      // Fetch using UUIDs
      if (uuidList.length > 0) {
        try {
          const { data } = await supabase
            .from('appointments')
            .select('*, client:users!appointments_client_id_fkey(id, name, profile_picture_url, email)')
            .in('lawyer_id', uuidList);
          if (data) aptsData = [...aptsData, ...data];
        } catch (e) {}
      }

      // Fetch using Integers
      if (intList.length > 0) {
        try {
          const { data } = await supabase
            .from('appointments')
            .select('*, client:users!appointments_client_id_fkey(id, name, profile_picture_url, email)')
            .in('lawyer_id', intList);
          if (data) aptsData = [...aptsData, ...data];
        } catch (e) {}
      }

      // Manual fallback if relational join failed
      if (aptsData.length === 0) {
        let fallbackData = [];
        if (uuidList.length > 0) {
          try {
            const { data } = await supabase.from('appointments').select('*').in('lawyer_id', uuidList);
            if (data) fallbackData = [...fallbackData, ...data];
          } catch(e) {}
        }
        if (intList.length > 0) {
          try {
            const { data } = await supabase.from('appointments').select('*').in('lawyer_id', intList);
            if (data) fallbackData = [...fallbackData, ...data];
          } catch(e) {}
        }
        
        if (fallbackData.length > 0) {
          const cIds = [...new Set(fallbackData.map(a => a.client_id).filter(Boolean))];
          let uList = [];
          if (cIds.length > 0) {
             const cUuidList = cIds.filter(id => isNaN(Number(id)));
             if (cUuidList.length > 0) {
                try {
                  const { data: uRes } = await supabase.from('users').select('id, name, profile_picture_url').in('id', cUuidList);
                  if (uRes) uList = uRes;
                } catch(e) {}
             }
          }
          aptsData = fallbackData.map(a => ({
            ...a,
            client: uList.find(u => u.id === a.client_id) || null
          }));
        }
      }

      // Sort & set
      aptsData.sort((a, b) => new Date(a.scheduled_at || a.scheduled_time || 0) - new Date(b.scheduled_at || b.scheduled_time || 0));
      setAppointments(aptsData);

      setAppointments(aptsData || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Failed to load appointments. Please check your network connection.');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus, updateType = null, customMessage = null) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      // Map status to update_type if not provided
      const typeMap = {
        'Upcoming': 'confirmed',
        'Completed': 'completed',
        'Cancelled': 'cancelled',
        'In Progress': 'started',
      };
      const finalType = updateType || typeMap[newStatus] || 'custom';
      
      const msgMap = {
        'confirmed': 'Your consultation has been confirmed by your lawyer.',
        'started': 'Your consultation session is now marked as Started / In Progress.',
        'completed': 'Your consultation session has been marked as Completed.',
        'no_show': 'Consultation marked as No-Show.',
        'cancelled': 'Your consultation has been cancelled.'
      };
      const finalMsg = customMessage || msgMap[finalType] || `Appointment status updated to ${newStatus}`;

      if (user?.id) {
        await supabase.from('consultation_updates').insert([{
          appointment_id: id,
          update_type: finalType,
          message: finalMsg,
          created_by: user.id
        }]);
      }

      toast.success(`Appointment marked as ${newStatus}`);
      fetchAppointments();
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to update appointment status');
    }
  };

  const handleJoinMeeting = (apt) => {
    const url = apt.google_meet_url || apt.meeting_url || `https://meet.jit.si/LegalConnect-Consultation-${apt.id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSaveMeetingUrl = async (e) => {
    e.preventDefault();
    if (!selectedApt || !meetingUrlInput.trim()) return;
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ google_meet_url: meetingUrlInput.trim() })
        .eq('id', selectedApt.id);
      if (error && error.code !== '42703') throw error;
      toast.success('Meeting link saved successfully!');
      setMeetingModalOpen(false);
      window.open(meetingUrlInput.trim(), '_blank', 'noopener,noreferrer');
      fetchAppointments();
    } catch (err) {
      toast.error('Could not save meeting link');
    }
  };


  const handleAcceptNegotiation = async (apt) => {
    try {
      const agreedFee = apt.proposed_fee_client || apt.fee_amount || 3000;
      const { error } = await supabase.from('appointments').update({
        status: 'confirmed',
        agreed_fee: agreedFee,
        fee_amount: agreedFee,
        fee_locked: true
      }).eq('id', apt.id);
      if (error) throw error;
      toast.success(`Fee accepted at BDT ${agreedFee}! Consultation confirmed.`);
      fetchAppointments();
    } catch (err) {
      console.error('Error accepting fee:', err);
      toast.error('Failed to accept fee proposal');
    }
  };

  const handleCounterOfferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedApt || !counterAmount) return;
    try {
      const numAmt = Number(counterAmount);
      const round = (selectedApt.negotiation_round || 1) + 1;
      const history = Array.isArray(selectedApt.negotiation_history) ? [...selectedApt.negotiation_history] : [];
      history.push({
        proposed_by: 'lawyer',
        amount: numAmt,
        note: counterNote,
        timestamp: new Date().toISOString()
      });
      const { error } = await supabase.from('appointments').update({
        status: 'pending_negotiation',
        proposed_fee_lawyer: numAmt,
        fee_amount: numAmt,
        negotiation_note: counterNote,
        negotiation_round: round,
        negotiation_history: history
      }).eq('id', selectedApt.id);
      if (error) throw error;
      toast.success(`Counter offer of BDT ${numAmt} sent to client!`);
      setCounterModalOpen(false);
      fetchAppointments();
    } catch (err) {
      console.error('Error sending counter:', err);
      toast.error('Failed to send counter offer');
    }
  };

  const filterAppointments = (tab) => {
    return appointments.filter(app => {
      const status = (app.status || '').toLowerCase();
      if (tab === 'upcoming') return status === 'upcoming' || status === 'confirmed';
      if (tab === 'pending') return status === 'pending';
      if (tab === 'negotiation') return status === 'pending_negotiation';
      if (tab === 'completed') return status === 'completed';
      if (tab === 'cancelled') return status === 'cancelled';
      return false;
    });
  };

  const displayedAppointments = filterAppointments(activeTab);

  const getMonthStr = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('default', { month: 'short' });
  };

  const getDayStr = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).getDate();
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-container-max mx-auto flex items-center justify-center min-h-[400px]">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md text-center space-y-4">
          <span className="material-symbols-outlined text-5xl text-red-500">error_outline</span>
          <h3 className="text-xl font-bold text-primary">Failed to Load Schedule</h3>
          <p className="text-gray-600 text-sm">{error}</p>
          <button 
            onClick={() => { setLoading(true); setError(null); fetchAppointments(); }}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow transition active:scale-95"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-surface-container-lowest">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6 animate-fadeIn">
        <div>
          <h2 className="font-serif text-[32px] font-bold text-[#041635] mb-2">Client Appointments</h2>
          <p className="text-gray-600 text-[15px] max-w-xl">
            Manage your consultations and client meetings efficiently.
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {['upcoming', 'pending', 'negotiation', 'completed', 'cancelled'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap capitalize ${
                activeTab === tab 
                ? 'bg-[#041635] text-white' 
                : 'bg-white border border-gray-300 text-gray-600 hover:border-[#755b00] hover:text-[#755b00]'
              }`}
            >
              {tab === 'negotiation' ? 'Fee Requests' : tab}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 max-w-5xl animate-fadeIn">
        {displayedAppointments.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-[#D0D7E3] text-center space-y-3 shadow-sm">
            <span className="material-symbols-outlined text-5xl text-slate-300">event_busy</span>
            <p className="text-gray-600 font-bold text-lg capitalize">No {activeTab === 'negotiation' ? 'fee requests' : activeTab} appointments</p>
            <p className="text-sm text-gray-400 max-w-md mx-auto">When clients book consultation sessions or request fee negotiations, they will appear in this tab.</p>
          </div>
        ) : (
          displayedAppointments.map(apt => {
            const isUpcoming = activeTab === 'upcoming';
            const isPending = activeTab === 'pending';
            const isNegotiation = activeTab === 'negotiation';
            const isCompleted = activeTab === 'completed';
            
            let statusBadgeClass = 'bg-[#e7eefb] text-[#374668]';
            let dateBoxClass = 'bg-[#ffe08f] text-[#241a00]';

            if (isUpcoming) {
              statusBadgeClass = 'bg-[#e6f4ea] text-[#1e8e3e]';
              dateBoxClass = 'bg-[#041635] text-white';
            } else if (isPending) {
              statusBadgeClass = 'bg-[#fff8e1] text-[#f57f17]';
            } else if (isNegotiation) {
              statusBadgeClass = 'bg-[#e0f2fe] text-[#0369a1]';
              dateBoxClass = 'bg-[#0369a1] text-white';
            } else if (isCompleted) {
              statusBadgeClass = 'bg-gray-100 text-gray-600';
              dateBoxClass = 'bg-gray-200 text-gray-600';
            } else {
              statusBadgeClass = 'bg-[#fce8e6] text-[#c5221f]';
              dateBoxClass = 'bg-[#fce8e6] text-[#c5221f]';
            }

            const clientName = apt.client?.name || 'Client';
            const clientPic = apt.client?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(clientName)}&background=041635&color=fff`;

            return (
              <div key={apt.id} className="bg-white rounded-lg border border-[#D0D7E3] shadow-sm p-6 hover:shadow-md hover:-translate-y-0.5 flex flex-col md:flex-row items-center gap-6 transition-all group">
                
                <div className={`rounded-lg p-3 w-20 flex flex-col items-center justify-center shrink-0 ${dateBoxClass}`}>
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                    {getMonthStr(apt.scheduled_at || apt.scheduled_time || Date.now())}
                  </span>
                  <span className="text-2xl font-bold">{getDayStr(apt.scheduled_at || apt.scheduled_time || Date.now())}</span>
                </div>
                
                {/* Info */}
                <div className="flex-1 w-full text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:items-center gap-3 mb-1">
                    <h4 className="text-lg font-bold text-[#041635]">{apt.consultation_type || 'Legal Consultation'}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter self-center md:self-auto ${statusBadgeClass}`}>
                      {apt.status}
                    </span>
                    {apt.medium && (
                      <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase">
                        {apt.medium === 'video_call' ? '📹 Video Call' : apt.medium === 'platform_chat' ? '💬 Platform Chat' : apt.medium === 'phone_call' ? '📞 Phone Call' : '🏢 In-Office'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-3 mt-2 mb-3">
                    <img alt="Client Avatar" className="w-8 h-8 rounded-full object-cover" src={clientPic} />
                    <p className="text-gray-600 text-sm">
                      With <span className="font-bold text-[#041635]">{clientName}</span>
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 font-medium mb-3 flex items-center justify-center md:justify-start gap-1">
                    <span className="material-symbols-outlined text-[14px]">schedule</span> {formatTime(apt.scheduled_at || apt.scheduled_time)}
                  </div>
                  
                  {/* Actions */}
                  {isNegotiation && (
                    <div className="bg-[#f8fafc] p-3 rounded-lg border border-[#e2e8f0] mb-3 text-left">
                      <div className="flex justify-between items-center mb-1 text-xs font-bold text-[#0F2A5E]">
                        <span>Client Proposed Fee: BDT {Number(apt.proposed_fee_client || apt.fee_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <span>Round #{apt.negotiation_round || 1} of 2</span>
                      </div>
                      {apt.negotiation_note && (
                        <p className="text-xs text-gray-600 italic bg-white p-2 rounded border border-gray-200 mt-1">
                          "{apt.negotiation_note}"
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    {isNegotiation && (
                      <>
                        <button 
                          onClick={() => handleAcceptNegotiation(apt)}
                          className="bg-[#10b981] text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-[#059669] transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[14px]">check</span> Accept Fee & Confirm
                        </button>
                        {(apt.negotiation_round || 1) < 2 && (
                          <button 
                            onClick={() => { setSelectedApt(apt); setCounterAmount(apt.fee_amount || ''); setCounterNote(''); setCounterModalOpen(true); }}
                            className="bg-[#041635] text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-[#1B2B4B] transition-colors"
                          >
                            Counter Offer
                          </button>
                        )}
                        <button 
                          onClick={() => handleUpdateStatus(apt.id, 'Cancelled', 'cancelled')}
                          className="border border-red-500 text-red-600 px-4 py-1.5 rounded text-xs font-bold hover:bg-red-50 transition-colors"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {isPending && !isNegotiation && (
                      <>
                        <button 
                          onClick={() => handleUpdateStatus(apt.id, 'Upcoming', 'confirmed')}
                          className="bg-[#041635] text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-[#1B2B4B] transition-colors"
                        >
                          Accept & Confirm
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(apt.id, 'Cancelled', 'cancelled')}
                          className="border border-red-500 text-red-600 px-4 py-1.5 rounded text-xs font-bold hover:bg-red-50 transition-colors"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {isUpcoming && (
                      <>
                        {(!apt.medium || apt.medium === 'video_call') && (
                          <button onClick={() => handleJoinMeeting(apt)} className="bg-[#041635] text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-[#1B2B4B] transition-colors flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">videocam</span> Join Video
                          </button>
                        )}
                        {apt.medium === 'platform_chat' && (
                          <button onClick={() => navigate('/lawyer-suite/messages')} className="bg-[#0F2A5E] text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-[#1B2B4B] transition-colors flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">chat</span> Open Platform Chat
                          </button>
                        )}
                        {apt.medium === 'phone_call' && (
                          <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs font-bold border border-gray-300">
                            📞 Contact: Client Phone
                          </span>
                        )}
                        {apt.medium === 'in_office' && (
                          <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs font-bold border border-gray-300">
                            🏢 Office Address Consultation
                          </span>
                        )}
                        <button 
                          onClick={() => handleUpdateStatus(apt.id, 'In Progress', 'started')}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 transition-colors"
                        >
                          Mark Started
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(apt.id, 'Completed', 'completed')}
                          className="border border-[#041635] text-[#041635] px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-50 transition-colors"
                        >
                          Completed
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(apt.id, 'Cancelled', 'no_show', 'Consultation marked as No-Show by lawyer.')}
                          className="border border-amber-500 text-amber-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-amber-50 transition-colors"
                        >
                          No-Show
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Right side icons */}
                <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto justify-center pt-4 md:pt-0 border-t md:border-t-0 border-gray-100">
                  <button onClick={() => navigate(`/lawyer-suite/communication`)} className="p-2 text-gray-400 hover:text-[#041635] hover:bg-gray-100 transition-colors rounded-full" title="Message Client">
                    <span className="material-symbols-outlined">forum</span>
                  </button>
                  <button className="p-2 text-gray-400 hover:text-[#041635] hover:bg-gray-100 transition-colors rounded-full" title="View Details">
                    <span className="material-symbols-outlined">info</span>
                  </button>
                </div>
                
              </div>
            );
          })
        )}
      </div>

      {meetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <h3 className="font-serif text-xl font-bold text-[#041635] flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">video_camera_front</span>
              Video Consultation Room
            </h3>
            <p className="text-sm text-gray-600">
              Provide or confirm the video meeting URL (Google Meet, Zoom, etc.) for this consultation session:
            </p>
            <form onSubmit={handleSaveMeetingUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Meeting URL</label>
                <input
                  type="url"
                  required
                  value={meetingUrlInput}
                  onChange={(e) => setMeetingUrlInput(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#041635]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMeetingModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#041635] text-white rounded-lg text-xs font-bold hover:bg-[#1B2B4B] shadow-sm"
                >
                  Save & Launch Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {counterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <h3 className="font-serif text-xl font-bold text-[#041635] flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">handshake</span>
              Send Fee Counter Offer
            </h3>
            <p className="text-sm text-gray-600">
              Propose a different consultation fee to {selectedApt?.client?.name}. You can submit up to 2 rounds of negotiation.
            </p>
            <form onSubmit={handleCounterOfferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Counter Fee (BDT)</label>
                <input
                  type="number"
                  required
                  value={counterAmount}
                  onChange={(e) => setCounterAmount(e.target.value)}
                  placeholder="e.g. 4000"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#041635]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Explanation Note</label>
                <textarea
                  required
                  rows="3"
                  value={counterNote}
                  onChange={(e) => setCounterNote(e.target.value)}
                  placeholder="Explain why you are counter-offering..."
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#041635]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCounterModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#041635] text-white rounded-lg text-xs font-bold hover:bg-[#1B2B4B] shadow-sm"
                >
                  Send Counter Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LawyerAppointmentsView;
