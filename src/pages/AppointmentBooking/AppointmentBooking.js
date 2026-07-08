import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { simulatePayment } from '../../services/payment.service';

const AppointmentBooking = ({ inline = false }) => {
  const navigate = useNavigate();
  const { lawyerId } = useParams();
  const { user } = useAuth();

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState('book'); // 'book', 'consultations', 'contracts'

  // Lawyers & Booking Form State
  const [lawyers, setLawyers] = useState([]);
  const [formData, setFormData] = useState({
    lawyerId: lawyerId || '',
    date: '',
    time: '',
    reason: '',
    notes: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Consultation Fee & Negotiation State
  const [lawyerSettings, setLawyerSettings] = useState(null);
  const [sessionType, setSessionType] = useState('Initial Consultation');
  const [selectedMedium, setSelectedMedium] = useState('video_call');
  const [isCustomFee, setIsCustomFee] = useState(false);
  const [customFeeAmount, setCustomFeeAmount] = useState('');
  const [customFeeNote, setCustomFeeNote] = useState('');
  const [feeDetails, setFeeDetails] = useState(null);

  // Client Consultations & Contracts State
  const [myConsultations, setMyConsultations] = useState([]);
  const [myContracts, setMyContracts] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);

  // Fetch Client Consultations and Contracts
  const fetchClientEngagements = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let userIds = [...new Set([session?.user?.id, user?.id, user?.auth_id].filter(Boolean))];
      if (userIds.length === 0) {
        setLoadingData(false);
        return;
      }

      // Resolve primary user id if possible
      try {
        const { data: uRes } = await supabase
          .from('users')
          .select('id')
          .or(`auth_id.in.(${userIds.map(id => `"${id}"`).join(',')}),id.in.(${userIds.map(id => `"${id}"`).join(',')})`);
        if (uRes) {
          uRes.forEach(u => { if (u.id) userIds.push(u.id); });
          userIds = [...new Set(userIds)];
        }
      } catch (err) {}

      // Fetch Appointments
      let aptsData = [];
      try {
        const { data } = await supabase
          .from('appointments')
          .select('*, lawyer:users!appointments_lawyer_id_fkey(id, name, profile_picture_url)')
          .in('client_id', userIds)
          .order('scheduled_at', { ascending: false });
        if (data) aptsData = data;
      } catch (e) {}

      if (!aptsData || aptsData.length === 0) {
        try {
          const { data } = await supabase
            .from('appointments')
            .select('*')
            .in('client_id', userIds)
            .order('scheduled_at', { ascending: false });
          if (data && data.length > 0) {
            const lIds = [...new Set(data.map(a => a.lawyer_id).filter(Boolean))];
            let uList = [];
            if (lIds.length > 0) {
              const { data: uRes } = await supabase.from('users').select('id, name, profile_picture_url').in('id', lIds);
              if (uRes) uList = uRes;
            }
            aptsData = data.map(a => ({
              ...a,
              lawyer: uList.find(u => u.id === a.lawyer_id) || { name: 'Advocate' }
            }));
          }
        } catch (e2) {}
      }
      setMyConsultations(aptsData || []);

      // Fetch Contracts
      let contData = [];
      try {
        const { data } = await supabase
          .from('contracts')
          .select('*, lawyer:users!contracts_lawyer_id_fkey(name)')
          .in('client_id', userIds)
          .order('created_at', { ascending: false });
        if (data) contData = data;
      } catch (e) {}

      if (!contData || contData.length === 0) {
        try {
          const { data } = await supabase
            .from('contracts')
            .select('*')
            .in('client_id', userIds)
            .order('created_at', { ascending: false });
          if (data && data.length > 0) {
            const lIds = [...new Set(data.map(c => c.lawyer_id).filter(Boolean))];
            let uList = [];
            if (lIds.length > 0) {
              const { data: uRes } = await supabase.from('users').select('id, name').in('id', lIds);
              if (uRes) uList = uRes;
            }
            contData = data.map(c => ({
              ...c,
              lawyer: uList.find(u => u.id === c.lawyer_id) || { name: 'Advocate' }
            }));
          }
        } catch (e2) {}
      }
      setMyContracts(contData || []);
    } catch (error) {
      console.error('Error fetching client engagements:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLawyers();
    fetchClientEngagements();
    if (lawyerId) {
      setFormData(prev => ({ ...prev, lawyerId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawyerId, fetchClientEngagements]);

  useEffect(() => {
    if (!formData.lawyerId) {
      setLawyerSettings(null);
      return;
    }
    const fetchSettings = async () => {
      try {
        const selectedLawyerObj = lawyers.find(l => l.id === formData.lawyerId);
        const targetId = selectedLawyerObj?.realUserId || formData.lawyerId;
        const { data } = await supabase
          .from('consultation_settings')
          .select('*')
          .eq('lawyer_id', targetId)
          .maybeSingle();
        if (data) setLawyerSettings(data);
        else setLawyerSettings(null);
      } catch (err) {
        console.error('Error loading lawyer rates:', err);
      }
    };
    if (lawyers.length > 0) fetchSettings();
  }, [formData.lawyerId, lawyers]);

  useEffect(() => {
    let isMounted = true;
    const fetchFee = async () => {
      if (!formData.lawyerId) return;
      try {
        const customAmt = isCustomFee && customFeeAmount ? Number(customFeeAmount) : null;
        const { data, error } = await supabase.rpc('fn_calculate_booking_fee', {
          p_lawyer_id: formData.lawyerId,
          p_fee_type: sessionType,
          p_custom_amount: customAmt
        });
        if (!error && data && isMounted) {
          setFeeDetails(data);
        }
      } catch (err) {
        console.error('Error calculating fee via RPC:', err);
      }
    };
    fetchFee();
    return () => { isMounted = false; };
  }, [formData.lawyerId, sessionType, isCustomFee, customFeeAmount]);

  const getSessionFee = () => {
    if (feeDetails && feeDetails.total_fee) return Number(feeDetails.total_fee);
    if (isCustomFee && customFeeAmount) return Number(customFeeAmount);
    if (!lawyerSettings) {
      if (sessionType === 'Initial Consultation') return 3000;
      if (sessionType === 'Case Review') return 5000;
      if (sessionType === 'Follow-up') return 2000;
      if (sessionType === 'Emergency') return 8000;
      return 3000;
    }
    if (sessionType === 'Initial Consultation') return Number(lawyerSettings.fee_initial_consultation || 3000);
    if (sessionType === 'Case Review') return Number(lawyerSettings.fee_case_review || 5000);
    if (sessionType === 'Follow-up') return Number(lawyerSettings.fee_follow_up || 2000);
    if (sessionType === 'Emergency') return Number(lawyerSettings.fee_emergency || 8000);
    return 3000;
  };

  const fetchLawyers = async () => {
    try {
      let lawyersMap = new Map();
      const { data: lawyersData } = await supabase
        .from('lawyers')
        .select('id, user_id, specialization, users(id, name, email, profile_picture_url)');

      if (lawyersData) {
        lawyersData.forEach(item => {
          const uName = item.users?.name || item.users?.email || 'Advocate';
          const spec = Array.isArray(item.specialization) 
            ? item.specialization.join(', ') 
            : (item.specialization || 'Supreme Court Advocate');
          const targetId = item.user_id || item.id;
          
          if (targetId) {
            lawyersMap.set(targetId, {
              id: targetId,
              realUserId: item.user_id || item.id,
              name: uName.startsWith('Adv.') ? uName : `Adv. ${uName}`,
              specialization: spec,
              avatar: item.users?.profile_picture_url || ''
            });
          }
          if (item.id && item.id !== targetId) {
            lawyersMap.set(item.id, {
              id: item.id,
              realUserId: item.user_id || item.id,
              name: uName.startsWith('Adv.') ? uName : `Adv. ${uName}`,
              specialization: spec,
              avatar: item.users?.profile_picture_url || ''
            });
          }
        });
      }

      if (lawyerId && !lawyersMap.has(lawyerId)) {
        const { data: lSingle } = await supabase
          .from('lawyers')
          .select('id, user_id, specialization, users(name, email, profile_picture_url)')
          .or(`id.eq.${lawyerId},user_id.eq.${lawyerId}`)
          .maybeSingle();
        if (lSingle) {
          const foundName = lSingle.users?.name || lSingle.users?.email || 'Advocate';
          lawyersMap.set(lawyerId, {
            id: lawyerId,
            realUserId: lSingle.user_id || lawyerId,
            name: foundName.startsWith('Adv.') ? foundName : `Adv. ${foundName}`,
            specialization: Array.isArray(lSingle.specialization) ? lSingle.specialization.join(', ') : lSingle.specialization,
            avatar: lSingle.users?.profile_picture_url || ''
          });
        }
      }

      setLawyers(Array.from(lawyersMap.values()));
    } catch (error) {
      console.error('Error fetching lawyers:', error);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.lawyerId) newErrors.lawyerId = 'Please select a lawyer';
    if (!formData.date) {
      newErrors.date = 'Please select a date';
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) newErrors.date = 'Please select a future date';
    }
    if (!formData.time) newErrors.time = 'Please select a time';
    if (!formData.reason.trim()) newErrors.reason = 'Please provide a reason for the appointment';
    if (isCustomFee) {
      if (!customFeeAmount || Number(customFeeAmount) <= 0) newErrors.customFeeAmount = 'Please enter a valid custom fee';
      if (!customFeeNote.trim()) newErrors.customFeeNote = 'Please explain your proposal';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (!user) { toast.error('You must be logged in'); return; }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let clientIdToUse = session?.user?.id || user?.id;
      try {
        const { data: uRes } = await supabase.from('users').select('id').or(`auth_id.eq.${clientIdToUse},id.eq.${clientIdToUse}`).maybeSingle();
        if (uRes?.id) clientIdToUse = uRes.id;
      } catch (err) {}

      const combinedDateTime = new Date(`${formData.date}T${formData.time}`);
      const scheduledAtIso = !isNaN(combinedDateTime.getTime()) 
        ? combinedDateTime.toISOString() 
        : new Date().toISOString();

      const selectedLawyerObj = lawyers.find(l => l.id === formData.lawyerId);
      const targetLawyerId = selectedLawyerObj?.realUserId || formData.lawyerId;
      const calculatedFee = getSessionFee();

      const payload = {
        client_id: clientIdToUse,
        lawyer_id: targetLawyerId,
        scheduled_at: scheduledAtIso,
        scheduled_time: scheduledAtIso,
        consultation_type: sessionType,
        session_type: sessionType,
        medium: selectedMedium,
        reason: formData.reason,
        notes: formData.notes,
        fee_amount: calculatedFee,
        status: isCustomFee ? 'pending_negotiation' : 'confirmed',
        ...(isCustomFee ? {
          proposed_fee_client: calculatedFee,
          negotiation_note: customFeeNote,
          negotiation_round: 1,
          negotiation_history: [{
            proposed_by: 'client',
            amount: calculatedFee,
            note: customFeeNote,
            timestamp: new Date().toISOString()
          }],
          fee_locked: false
        } : {
          agreed_fee: calculatedFee,
          fee_locked: true
        })
      };

      let { data: insData, error } = await supabase.from('appointments').insert([payload]).select();
      if (error) {
        let fallbackRes = await supabase.from('appointments').insert([{
          client_id: clientIdToUse,
          lawyer_id: targetLawyerId,
          scheduled_at: scheduledAtIso,
          scheduled_time: scheduledAtIso,
          consultation_type: sessionType,
          status: isCustomFee ? 'pending_negotiation' : 'confirmed'
        }]).select();
        error = fallbackRes.error;
        insData = fallbackRes.data;
      }
      if (error) throw error;

      const aptId = insData?.[0]?.id || null;
      if (!isCustomFee) {
        await simulatePayment({
          client_id: clientIdToUse,
          lawyer_id: targetLawyerId,
          amount: calculatedFee,
          appointment_id: aptId,
          payment_method: 'simulated_gateway'
        });
        toast.success('Appointment booked & confirmed!');
      } else {
        toast.success('Custom fee request submitted to lawyer!');
      }

      // Reset form and refresh engagements
      setFormData(prev => ({ ...prev, date: '', time: '', reason: '', notes: '' }));
      await fetchClientEngagements();
      setActiveTab('consultations');
    } catch (error) {
      console.error('Error booking appointment:', error);
      toast.error(error.message || 'Failed to book appointment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getMinDate = () => new Date().toISOString().split('T')[0];

  return (
    <div className={inline ? "w-full p-4 md:p-8" : "min-h-screen bg-[#0b162c] py-10 px-4 md:px-8"}>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header & Title */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#0F2A5E]">Consultations & Legal Engagements</h1>
            <p className="text-slate-600 text-sm mt-1">Book new consultations, join active video sessions, and manage your contracts in one unified workspace.</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => fetchClientEngagements()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-300 pb-2">
          <button
            onClick={() => setActiveTab('book')}
            className={`px-5 py-3 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-sm ${
              activeTab === 'book'
                ? 'bg-[#0F2A5E] text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">calendar_add_on</span>
            Book Consultation
          </button>

          <button
            onClick={() => setActiveTab('consultations')}
            className={`px-5 py-3 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-sm ${
              activeTab === 'consultations'
                ? 'bg-[#0F2A5E] text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">event_available</span>
            My Consultations
            {myConsultations.length > 0 && (
              <span className="bg-[#D97706] text-white text-xs px-2 py-0.5 rounded-full">{myConsultations.length}</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('contracts')}
            className={`px-5 py-3 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-sm ${
              activeTab === 'contracts'
                ? 'bg-[#0F2A5E] text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">description</span>
            Contract Details
            {myContracts.length > 0 && (
              <span className="bg-[#D97706] text-white text-xs px-2 py-0.5 rounded-full">{myContracts.length}</span>
            )}
          </button>
        </div>

        {/* TAB 1: BOOK NEW CONSULTATION */}
        {activeTab === 'book' && (
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-lg border border-slate-200">
            <h2 className="text-xl font-bold text-[#0F2A5E] mb-6 flex items-center gap-2 border-b pb-4">
              <span className="material-symbols-outlined text-[#D97706]">gavel</span>
              Schedule a Consultation Session
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Select Lawyer */}
              <div>
                <label className="block text-sm font-bold text-[#0F2A5E] mb-2">Select Advocate / Legal Specialist *</label>
                <select
                  name="lawyerId"
                  value={formData.lawyerId}
                  onChange={handleChange}
                  disabled={!!lawyerId}
                  className={`w-full px-4 py-3 rounded-xl border bg-slate-50 text-slate-800 font-medium focus:ring-2 focus:ring-[#0F2A5E] outline-none transition ${errors.lawyerId ? 'border-red-500' : 'border-slate-300'}`}
                >
                  <option value="">-- Choose a Verified Lawyer --</option>
                  {lawyers.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.specialization})
                    </option>
                  ))}
                </select>
                {errors.lawyerId && <p className="text-red-500 text-xs mt-1">{errors.lawyerId}</p>}
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#0F2A5E] mb-2">Preferred Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    min={getMinDate()}
                    className={`w-full px-4 py-3 rounded-xl border bg-slate-50 text-slate-800 font-medium focus:ring-2 focus:ring-[#0F2A5E] outline-none transition ${errors.date ? 'border-red-500' : 'border-slate-300'}`}
                  />
                  {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#0F2A5E] mb-2">Preferred Time *</label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-xl border bg-slate-50 text-slate-800 font-medium focus:ring-2 focus:ring-[#0F2A5E] outline-none transition ${errors.time ? 'border-red-500' : 'border-slate-300'}`}
                  />
                  {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}
                </div>
              </div>

              {/* Session Type */}
              <div>
                <label className="block text-sm font-bold text-[#0F2A5E] mb-2">Session Type & Rate *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'Initial Consultation', label: 'Initial Consultation', fee: lawyerSettings?.fee_initial_consultation || 3000 },
                    { id: 'Case Review', label: 'Case Review', fee: lawyerSettings?.fee_case_review || 5000 },
                    { id: 'Follow-up', label: 'Follow-up Session', fee: lawyerSettings?.fee_follow_up || 2000 },
                    { id: 'Emergency', label: 'Emergency Advice', fee: lawyerSettings?.fee_emergency || 8000 }
                  ].map(item => (
                    <div
                      key={item.id}
                      onClick={() => { setSessionType(item.id); setIsCustomFee(false); }}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                        sessionType === item.id && !isCustomFee
                          ? 'border-[#0F2A5E] bg-blue-50/70 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <span className="font-bold text-sm text-[#0F2A5E]">{item.label}</span>
                      <span className="text-xs font-extrabold text-[#D97706] mt-2">BDT {Number(item.fee).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Fee Negotiation Toggle */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCustomFee}
                    onChange={e => setIsCustomFee(e.target.checked)}
                    className="w-4 h-4 text-[#0F2A5E] rounded focus:ring-[#0F2A5E]"
                  />
                  <span className="text-sm font-bold text-[#0F2A5E]">Propose a Custom Negotiation Fee</span>
                </label>
                {isCustomFee && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Proposed Fee (BDT)</label>
                      <input
                        type="number"
                        placeholder="e.g. 4000"
                        value={customFeeAmount}
                        onChange={e => setCustomFeeAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm outline-none"
                      />
                      {errors.customFeeAmount && <p className="text-red-500 text-xs mt-1">{errors.customFeeAmount}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Proposal</label>
                      <input
                        type="text"
                        placeholder="Explain proposed rate..."
                        value={customFeeNote}
                        onChange={e => setCustomFeeNote(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm outline-none"
                      />
                      {errors.customFeeNote && <p className="text-red-500 text-xs mt-1">{errors.customFeeNote}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Consultation Medium */}
              <div>
                <label className="block text-sm font-bold text-[#0F2A5E] mb-2">Consultation Medium *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'video_call', label: '📹 Video Call', helper: 'Instant Jitsi room generated' },
                    { id: 'platform_chat', label: '💬 Platform Chat', helper: 'Secure portal chatroom' },
                    { id: 'phone_call', label: '📞 Phone Call', helper: 'Direct phone contact' },
                    { id: 'in_office', label: '🏢 In-Office', helper: 'Lawyer chamber address' }
                  ].map(m => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMedium(m.id)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition ${
                        selectedMedium === m.id
                          ? 'border-[#0F2A5E] bg-blue-50/70 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="font-bold text-sm text-[#0F2A5E]">{m.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{m.helper}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-bold text-[#0F2A5E] mb-2">Reason for Consultation *</label>
                <input
                  type="text"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  placeholder="e.g., Land dispute initial review, High Court bail hearing advice"
                  className={`w-full px-4 py-3 rounded-xl border bg-slate-50 text-slate-800 font-medium focus:ring-2 focus:ring-[#0F2A5E] outline-none transition ${errors.reason ? 'border-red-500' : 'border-slate-300'}`}
                />
                {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason}</p>}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-bold text-[#0F2A5E] mb-2">Additional Case Notes (Optional)</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Share any key background facts or document titles..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 font-medium focus:ring-2 focus:ring-[#0F2A5E] outline-none transition"
                />
              </div>

              {/* Fee Summary & Submit */}
              <div className="bg-[#0F2A5E] text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#fed977]">Estimated Total Consultation Fee</span>
                  <div className="text-2xl font-black mt-1">BDT {getSessionFee().toLocaleString()}</div>
                  {feeDetails && (
                    <div className="text-[11px] text-blue-200 mt-0.5">
                      Includes BDT {Number(feeDetails.platform_fee || 0).toLocaleString()} platform fee ({feeDetails.commission_rate || 10}%)
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-3.5 bg-[#fed977] hover:bg-[#fbd05a] text-[#0F2A5E] font-black rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? 'Confirming Booking...' : 'Confirm & Book Session'}
                  <span className="material-symbols-outlined font-bold">arrow_forward</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: MY CONSULTATIONS & APPOINTMENTS */}
        {activeTab === 'consultations' && (
          <div className="space-y-4">
            {loadingData ? (
              <div className="bg-white rounded-2xl p-12 text-center text-slate-500 font-medium shadow-sm">
                Loading your appointments...
              </div>
            ) : myConsultations.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
                <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">event_busy</span>
                <h3 className="text-lg font-bold text-[#0F2A5E]">No Consultations Found</h3>
                <p className="text-slate-500 text-sm mt-1 mb-6">You haven't booked any consultation appointments yet.</p>
                <button
                  onClick={() => setActiveTab('book')}
                  className="px-6 py-2.5 bg-[#0F2A5E] text-white font-bold rounded-xl text-sm hover:bg-[#1b2b4b] transition shadow-md"
                >
                  Book Your First Consultation
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {myConsultations.map(apt => {
                  const lName = apt.lawyer?.name || 'Advocate';
                  const fee = apt.agreed_fee || apt.fee_amount || apt.proposed_fee_client || 3000;
                  const dateStr = apt.scheduled_at || apt.scheduled_time;
                  const jitsiUrl = apt.google_meet_url || apt.meeting_url || `https://meet.jit.si/LegalConnect-Consultation-${apt.id}`;

                  return (
                    <div key={apt.id} className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-lg transition">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#0F2A5E]/10 text-[#0F2A5E] font-black flex items-center justify-center text-lg shrink-0">
                          {lName.replace('Adv. ', '').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-[#0F2A5E] text-base">{lName}</h4>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-blue-100 text-blue-800">
                              {apt.consultation_type || apt.session_type || 'Consultation'}
                            </span>
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                              apt.status === 'confirmed' || apt.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                              apt.status === 'pending_negotiation' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {apt.status || 'Confirmed'}
                            </span>
                          </div>
                          <p className="text-slate-600 text-sm mt-1">{apt.reason || 'General Legal Review'}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-500 font-medium mt-3">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-[#D97706]">schedule</span>
                              {dateStr ? new Date(dateStr).toLocaleString() : 'Date TBD'}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-[#D97706]">payments</span>
                              BDT {Number(fee).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-4 md:pt-0">
                        <button
                          onClick={() => {
                            window.open(jitsiUrl, '_blank', 'noopener,noreferrer');
                            toast.success('Joining dedicated Jitsi Video Room...');
                          }}
                          className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
                        >
                          <span className="material-symbols-outlined text-base">videocam</span>
                          Join Video Call
                        </button>
                        <button
                          onClick={() => navigate('/client/portal/messages')}
                          className="px-4 py-2.5 bg-[#0F2A5E] hover:bg-[#1b2b4b] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
                        >
                          <span className="material-symbols-outlined text-base">chat</span>
                          Message Lawyer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CONTRACT DETAILS */}
        {activeTab === 'contracts' && (
          <div className="space-y-4">
            {loadingData ? (
              <div className="bg-white rounded-2xl p-12 text-center text-slate-500 font-medium shadow-sm">
                Loading your contracts...
              </div>
            ) : myContracts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
                <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">folder_off</span>
                <h3 className="text-lg font-bold text-[#0F2A5E]">No Active Contracts</h3>
                <p className="text-slate-500 text-sm mt-1 mb-6">You don't have any formal retainer contracts yet.</p>
                <button
                  onClick={() => setActiveTab('book')}
                  className="px-6 py-2.5 bg-[#0F2A5E] text-white font-bold rounded-xl text-sm hover:bg-[#1b2b4b] transition shadow-md"
                >
                  Schedule Consultation
                </button>
              </div>
            ) : selectedContract ? (
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-[#0F2A5E] p-6 text-white flex justify-between items-center">
                     <div>
                       <h3 className="text-xl font-bold">Contract & Fee Agreement</h3>
                       <p className="text-sm text-blue-200">Ref: #{selectedContract.id.substring(0, 8).toUpperCase()}</p>
                     </div>
                     <button onClick={() => setSelectedContract(null)} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-bold transition flex items-center gap-1">
                       <span className="material-symbols-outlined text-sm">arrow_back</span>
                       Back to List
                     </button>
                  </div>
                  <div className="p-8 space-y-6">
                     <div className="flex flex-col md:flex-row justify-between border-b border-slate-100 pb-6 gap-4">
                       <div>
                         <p className="text-xs font-bold text-slate-400 uppercase">Counsel / Legal Representative</p>
                         <p className="text-lg font-bold text-[#0F2A5E] mt-1">{selectedContract.lawyer?.name || 'Advocate'}</p>
                       </div>
                       <div className="md:text-right">
                         <p className="text-xs font-bold text-slate-400 uppercase">Agreement Status</p>
                         <span className="inline-block mt-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold uppercase tracking-wider">{selectedContract.status || 'Active'}</span>
                       </div>
                     </div>
                     <div>
                       <p className="text-xs font-bold text-slate-400 uppercase mb-2">Scope of Legal Work</p>
                       <p className="text-slate-800 text-sm whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100">
                         {selectedContract.scope_of_work || selectedContract.title || 'General Legal Representation'}
                       </p>
                     </div>
                     <div className="bg-[#0F2A5E]/5 p-6 rounded-xl border border-[#0F2A5E]/10 flex justify-between items-center">
                       <span className="font-bold text-[#0F2A5E]">Total Agreed Retainer Fee</span>
                       <span className="text-2xl font-black text-[#D97706]">BDT {Number(selectedContract.fee_amount || 0).toLocaleString()}</span>
                     </div>
                     <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">print</span>
                          Print Invoice
                        </button>
                     </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {myContracts.map(c => {
                    const lName = c.lawyer?.name || 'Advocate';
                    return (
                      <div key={c.id} className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-lg transition">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-[#D97706]/10 text-[#D97706] font-black flex items-center justify-center text-lg shrink-0">
                            📜
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-[#0F2A5E] text-base">{c.scope_of_work || c.title || 'Legal Representation Retainer'}</h4>
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-purple-100 text-purple-800">
                                {c.status || 'Pending'}
                              </span>
                            </div>
                            <p className="text-slate-600 text-sm mt-1">Counsel: <strong className="text-[#0F2A5E]">{lName}</strong></p>
                            <div className="flex items-center gap-4 text-xs text-slate-500 font-medium mt-3">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-[#D97706]">payments</span>
                                Fee: BDT {Number(c.fee_amount || 0).toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                                Created: {new Date(c.created_at || Date.now()).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
  
                        <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-4 md:pt-0">
                          <button
                            onClick={() => setSelectedContract(c)}
                            className="px-5 py-2.5 bg-[#0F2A5E] hover:bg-[#1b2b4b] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
                          >
                            <span className="material-symbols-outlined text-base">receipt_long</span>
                            View Contract Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        )}

      </div>
    </div>
  );
};

export default AppointmentBooking;
