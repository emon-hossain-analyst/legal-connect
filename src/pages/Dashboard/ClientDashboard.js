import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { SkeletonDashboard } from '../../components/Skeleton/Skeleton';

const ClientDashboard = ({ inline = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Dashboard Data State
  const [appointments, setAppointments] = useState([]);
  const [cases, setCases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  
  // Tab State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [caseFilter, setCaseFilter] = useState('All');
  const [selectedCase, setSelectedCase] = useState(null);
  
  // Profile State
  const [saving, setSaving] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [profilePicFile, setProfilePicFile] = useState(null);
  const fileInputRef = useRef(null);
  
  const [basicInfo, setBasicInfo] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    nid: '',
    clientType: 'individual',
    company_name: '',
    registration_number: '',
    industry: 'Technology',
    company_size: '1-10 employees',
    designation: '',
    company_website: ''
  });

  useEffect(() => { 
    if (user?.id) fetchDashboardData(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Fix 5: Real-time subscription for live dashboard updates
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`client_dashboard_realtime_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchDashboardData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'consultation_updates' }, (payload) => {
        toast(payload.new.message || `Consultation status updated to ${payload.new.update_type}`, { icon: '📅' });
        fetchDashboardData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchDashboardData = async () => {
    try {
      const authId = user.auth_id || user.id;

      // 1. Fetch public user
      const { data: publicUser } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authId)
        .maybeSingle();

      let publicUserId = publicUser?.id;

      if (publicUser) {
        setBasicInfo(prev => ({ 
          ...prev, 
          name: publicUser.name || prev.name || '',
          email: publicUser.email || user.email || prev.email || ''
        }));
        if (publicUser.profile_picture_url) {
          setProfilePic(publicUser.profile_picture_url);
        }
      }

      // 2. Fetch Client specific info using authId (or publicUserId fallback)
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .or(`user_id.eq.${authId}${publicUserId ? `,user_id.eq.${publicUserId}` : ''}`)
        .maybeSingle();
        
      if (clientData) {
        setBasicInfo(prev => ({
          ...prev,
          phone: clientData.phone || '',
          dob: clientData.dob || '',
          nid: clientData.nid || '',
          clientType: clientData.client_type || 'individual',
          company_name: clientData.company_name || '',
          registration_number: clientData.registration_number || '',
          industry: clientData.industry || 'Technology',
          company_size: clientData.company_size || '1-10 employees',
          designation: clientData.designation || '',
          company_website: clientData.company_website || ''
        }));
      }

      // 3. Auth Verification & Fetch Dashboard Stats
      const userIds = [...new Set([user?.id, user?.auth_id, authId, publicUserId].filter(Boolean))];

      // Fetch Appointments with lawyer data (Fix 1)
      let aptsData = [];
      try {
        const { data } = await supabase
          .from('appointments')
          .select('*, lawyer:users!appointments_lawyer_id_fkey(id, name, profile_picture_url)')
          .in('client_id', userIds)
          .order('scheduled_at', { ascending: true });
        if (data) aptsData = data;
      } catch (e) {}

      if (!aptsData || aptsData.length === 0) {
        try {
          const { data } = await supabase
            .from('appointments')
            .select('*')
            .in('client_id', userIds);
          if (data && data.length > 0) {
            const lIds = [...new Set(data.map(a => a.lawyer_id).filter(Boolean))];
            let uList = [];
            if (lIds.length > 0) {
              const { data: uRes } = await supabase.from('users').select('id, name, profile_picture_url').in('id', lIds);
              if (uRes) uList = uRes;
            }
            aptsData = data.map(a => ({
              ...a,
              lawyer: uList.find(u => u.id === a.lawyer_id) || null
            }));
            aptsData.sort((a, b) => new Date(a.scheduled_at || a.scheduled_time || 0) - new Date(b.scheduled_at || b.scheduled_time || 0));
          }
        } catch (e2) {}
      }

      setAppointments(aptsData || []);

      // Fetch Cases with lawyer + case_progress data (Fix 1)
      let casesResult = [];
      try {
        const { data: casesData } = await supabase
          .from('cases')
          .select('*, lawyer:users!cases_lawyer_id_fkey(id, name, profile_picture_url), case_progress(*)')
          .in('client_id', userIds)
          .order('created_at', { ascending: false });
        if (casesData) casesResult = casesData;
      } catch (e) {}

      if (!casesResult || casesResult.length === 0) {
        try {
          const { data: casesData } = await supabase
            .from('cases')
            .select('*')
            .in('client_id', userIds)
            .order('created_at', { ascending: false });
          if (casesData) casesResult = casesData;
        } catch (e) {}
      }
        
      setCases(casesResult || []);

      if (casesResult && casesResult.length > 0) {
        const caseIds = casesResult.map(c => c.id);
        const { data: docsData } = await supabase
          .from('documents')
          .select('*')
          .in('case_id', caseIds)
          .order('uploaded_at', { ascending: false });
        setDocuments(docsData || []);
      } else {
        setDocuments([]);
      }

      // Fix 3: Fetch real unread messages count
      try {
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id')
          .in('client_id', userIds);

        if (conversations && conversations.length > 0) {
          const convIds = conversations.map(c => c.id);
          const { count: msgCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .in('conversation_id', convIds)
            .eq('is_read', false)
            .not('sender_id', 'in', `(${userIds.join(',')})`);
          setUnreadMessages(msgCount || 0);
        } else {
          setUnreadMessages(0);
        }
      } catch {
        setUnreadMessages(0);
      }

      // Fix 3: Derive notification count from pending/upcoming appointments
      const pendingOrUpcoming = (aptsData || []).filter(
        a => a.status === 'Pending' || a.status === 'Upcoming' || a.status === 'pending_negotiation'
      ).length;
      setNotificationCount(pendingOrUpcoming);

      // Fix 7: Fetch client payment history
      try {
        const { data: payRecords } = await supabase
          .from('payments')
          .select('*, lawyer:users!payments_lawyer_id_fkey(name)')
          .in('client_id', userIds)
          .order('created_at', { ascending: false });
        setPaymentHistory(payRecords || []);
      } catch (payErr) {
        setPaymentHistory([]);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error.message, error.code, error);
      setError('Failed to load dashboard data. Please check your network connection or try again.');
      setAppointments([]);
      setCases([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (id) => {
    try {
      const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      toast.success('Appointment cancelled');
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to cancel appointment');
    }
  };

  const handleAcceptLawyerOffer = async (apt) => {
    try {
      const agreedFee = apt.proposed_fee_lawyer || apt.fee_amount || 3000;
      const { error } = await supabase.from('appointments').update({
        status: 'confirmed',
        agreed_fee: agreedFee,
        fee_amount: agreedFee,
        fee_locked: true
      }).eq('id', apt.id);
      if (error) throw error;
      toast.success(`Accepted lawyer fee at BDT ${agreedFee}! Consultation confirmed.`);
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to accept fee proposal');
    }
  };

  const handleJoinSession = (apt) => {
    const url = apt.google_meet_url || apt.meeting_url || `https://meet.jit.si/LegalConnect-Consultation-${apt.id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getRelativeTime = (dateStr) => {
    const diffMs = new Date().getTime() - new Date(dateStr).getTime();
    if (diffMs < 60000) return 'Just now';
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days === 0) {
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      if (hours === 0) return rtf.format(-Math.floor(diffMs / 60000), 'minute');
      return rtf.format(-hours, 'hour');
    }
    return rtf.format(-days, 'day');
  };

  const handleProfileChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setBasicInfo(prev => ({ ...prev, [name]: checked ? 'business' : 'individual' }));
    } else {
      setBasicInfo(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePicFile(file);
      setProfilePic(URL.createObjectURL(file));
    }
  };

  const saveProfile = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      let finalPicUrl = profilePic;
      if (profilePicFile) {
        const fileExt = profilePicFile.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('avatars')
          .upload(fileName, profilePicFile, { upsert: true });
          
        if (!uploadError && data) {
          const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          finalPicUrl = publicUrlData.publicUrl;
        }
      }

      const authId = user.auth_id || user.id;
      
      // Update public.users table cleanly
      const { error: userError } = await supabase
        .from('users')
        .update({
          name: basicInfo.name,
          profile_picture_url: finalPicUrl
        })
        .or(`id.eq.${authId},auth_id.eq.${authId}`);
        
      if (userError && userError.code !== '42P01') {
        console.warn('User table update warning:', userError);
      }

      // Prepare payload for clients table using authId and sanitizing empty date strings
      const clientPayload = {
        user_id: authId,
        phone: basicInfo.phone || null,
        dob: basicInfo.dob ? basicInfo.dob : null,
        nid: basicInfo.nid || null,
        client_type: basicInfo.clientType || 'individual',
        company_name: basicInfo.company_name || null,
        registration_number: basicInfo.registration_number || null,
        industry: basicInfo.industry || null,
        company_size: basicInfo.company_size || null,
        designation: basicInfo.designation || null,
        company_website: basicInfo.company_website || null
      };

      // Atomic upsert into clients table to prevent query locking or hang
      const { error: clientError } = await supabase
        .from('clients')
        .upsert(clientPayload, { onConflict: 'user_id' });

      if (clientError && clientError.code !== '42P01') {
        throw clientError;
      }

      toast.success('Profile saved successfully!');
      await fetchDashboardData();
    } catch (err) {
      console.error('Save profile error:', err);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-screen bg-[#F4F6F9] p-8"><SkeletonDashboard /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] p-8 flex items-center justify-center">
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md text-center shadow-lg space-y-4">
          <span className="material-symbols-outlined text-5xl text-red-500">error_outline</span>
          <h3 className="text-xl font-bold text-[#041635]">Failed to Load Dashboard</h3>
          <p className="text-gray-600 text-sm">{error}</p>
          <button 
            onClick={() => { setLoading(true); setError(null); fetchDashboardData(); }}
            className="px-6 py-2.5 bg-[#041635] hover:bg-[#0a2351] text-white font-bold rounded-xl shadow transition active:scale-95"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const activeCases = cases.filter(c => c.status === 'Active');
  const upcomingAppointments = appointments.filter(apt => apt.status === 'Upcoming' || apt.status === 'Pending' || apt.status === 'In Progress').slice(0, 4);
  const totalAppointmentsCount = appointments.length;

  const userProfilePic = profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(basicInfo.name || 'Client')}&background=041635&color=fff`;

  // --- RENDER HELPERS ---
  const renderDashboardTab = () => (
    <div className="space-y-8 animate-fadeIn">
      {/* Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-[#D0D7E3] shadow-sm border-t-4 border-t-[#ffe08f] flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Appointments</p>
            <span className="material-symbols-outlined text-[#041635]">event</span>
          </div>
          <p className="text-3xl font-serif font-bold text-[#041635]">{totalAppointmentsCount.toString().padStart(2, '0')}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-[#D0D7E3] shadow-sm border-t-4 border-t-[#ffe08f] flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Active Cases</p>
            <span className="material-symbols-outlined text-[#041635]">work</span>
          </div>
          <p className="text-3xl font-serif font-bold text-[#041635]">{activeCases.length.toString().padStart(2, '0')}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-[#D0D7E3] shadow-sm border-t-4 border-t-[#ffe08f] flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Notifications</p>
            <span className="material-symbols-outlined text-[#041635]">notifications</span>
          </div>
          <p className="text-3xl font-serif font-bold text-[#041635]">{notificationCount.toString().padStart(2, '0')}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-[#D0D7E3] shadow-sm border-t-4 border-t-[#ffe08f] flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Unread Messages</p>
            <span className="material-symbols-outlined text-[#041635]">chat</span>
          </div>
          <p className="text-3xl font-serif font-bold text-[#041635]">{unreadMessages.toString().padStart(2, '0')}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-[65%] space-y-8">
          {/* Upcoming Appointments */}
          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-serif font-bold text-[#041635]">Upcoming Appointments</h3>
              <button onClick={() => setActiveTab('appointments')} className="text-[#041635] font-bold text-sm hover:underline">View Calendar</button>
            </div>
            <div className="space-y-4">
              {upcomingAppointments.length === 0 ? (
                <div className="bg-white p-8 rounded-xl border border-gray-200 text-center space-y-3">
                  <span className="material-symbols-outlined text-4xl text-gray-400">event_busy</span>
                  <p className="text-gray-600 font-bold">No upcoming consultations</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">Book an appointment with a specialized lawyer to get expert legal advice.</p>
                  <button onClick={() => navigate('/lawyer-search')} className="mt-2 px-4 py-2 bg-[#041635] text-white text-xs font-bold rounded-lg hover:bg-[#1B2B4B] transition-all">Find a Lawyer</button>
                </div>
              ) : (
                upcomingAppointments.map(apt => (
                  <div key={apt.id} className="bg-white rounded-lg border border-[#D0D7E3] shadow-sm p-6 hover:shadow-md hover:-translate-y-0.5 flex flex-col md:flex-row items-center gap-6 transition-all">
                    <div className={`rounded-lg p-3 w-20 flex flex-col items-center justify-center shrink-0 ${apt.status === 'Upcoming' || apt.status === 'In Progress' ? 'bg-[#041635] text-white' : 'bg-[#ffe08f] text-[#241a00]'}`}>
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{new Date(apt.scheduled_at).toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-2xl font-bold">{new Date(apt.scheduled_at).getDate()}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="text-lg font-bold text-[#041635]">{apt.consultation_type || 'Consultation'}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter ${apt.status === 'In Progress' ? 'bg-blue-100 text-blue-800 animate-pulse' : apt.status === 'Upcoming' ? 'bg-[#e6f4ea] text-[#1e8e3e]' : 'bg-[#fff8e1] text-[#f57f17]'}`}>
                          {apt.status === 'In Progress' ? 'Session In Progress' : apt.status}
                        </span>
                        {apt.medium && (
                          <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase">
                            {apt.medium === 'video_call' ? '📹 Video Call' : apt.medium === 'platform_chat' ? '💬 Platform Chat' : apt.medium === 'phone_call' ? '📞 Phone Call' : '🏢 In-Office'}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm mb-3">With <span className="font-bold text-[#041635]">{apt.lawyer?.name || 'Assigned Lawyer'}</span></p>
                      <div className="flex flex-wrap gap-2">
                        {(apt.status === 'Upcoming' || apt.status === 'In Progress') && (
                          <>
                            {(!apt.medium || apt.medium === 'video_call') && (
                              <button onClick={() => handleJoinSession(apt)} className="bg-[#041635] text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-[#1B2B4B] transition-colors flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">videocam</span> Join Session
                              </button>
                            )}
                            {apt.medium === 'platform_chat' && (
                              <button onClick={() => navigate(`/client/portal/messages?lawyerId=${apt.lawyer_id}`)} className="bg-[#0F2A5E] text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-[#1B2B4B] transition-colors flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">chat</span> Open Chat Room
                              </button>
                            )}
                            {apt.medium === 'phone_call' && (
                              <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs font-bold border border-gray-300">
                                📞 Contact: Lawyer Phone
                              </span>
                            )}
                            {apt.medium === 'in_office' && (
                              <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs font-bold border border-gray-300">
                                🏢 Office Address Consultation
                              </span>
                            )}
                          </>
                        )}
                        {apt.status === 'Pending' && <button className="border border-[#041635] text-[#041635] px-4 py-1.5 rounded text-xs font-bold hover:bg-gray-50 transition-colors">Confirm</button>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => navigate(`/client/portal/messages?lawyerId=${apt.lawyer_id}`)} className="p-2 text-gray-400 hover:text-[#041635] hover:bg-gray-100 transition-colors rounded-full" title="Message Lawyer">
                        <span className="material-symbols-outlined">forum</span>
                      </button>
                      <button onClick={() => handleCancelAppointment(apt.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded-full" title="Cancel Appointment">
                        <span className="material-symbols-outlined">cancel</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Recent Cases preview */}
          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-serif font-bold text-[#041635]">Active Legal Matters</h3>
              <button onClick={() => setActiveTab('cases')} className="text-[#041635] font-bold text-sm hover:underline">View All Cases</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeCases.length === 0 ? (
                <div className="col-span-full bg-white p-8 rounded-xl border border-gray-200 text-center space-y-3">
                  <span className="material-symbols-outlined text-4xl text-gray-400">folder_off</span>
                  <p className="text-gray-600 font-bold">No active legal matters</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">Your ongoing cases, contract drafting, and milestone tracking will appear here.</p>
                </div>
              ) : (
                activeCases.slice(0, 4).map(c => {
                  const totalMilestones = (c.case_progress?.length || 0) + 2; 
                  const completedMilestones = c.case_progress?.length || 0;
                  const percent = Math.round((completedMilestones / totalMilestones) * 100);

                  return (
                    <div key={c.id} className="bg-white rounded-lg border border-[#D0D7E3] shadow-sm p-6 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-transform">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Matter #{c.id.substring(0, 8)}</p>
                            <h4 className="text-lg font-bold text-[#041635] leading-tight line-clamp-2">{c.title}</h4>
                          </div>
                          <span className="material-symbols-outlined text-gray-400">gavel</span>
                        </div>
                        <div className="mb-6">
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-gray-500">Resolution Progress</span>
                            <span className="font-bold text-[#041635]">{percent}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="bg-[#ffe08f] h-1.5 rounded-full" style={{ width: `${percent}%` }}></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <button onClick={() => navigate(`/cases/${c.id}`)} className="text-[#041635] text-xs font-bold hover:bg-gray-100 px-3 py-1 rounded transition-colors ml-auto">Case Details →</button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>

        <div className="lg:w-[35%] space-y-8">
          <section className="bg-white rounded-lg border border-[#D0D7E3] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-[#041635]">Important Alerts</h3>
            </div>
            <div className="p-6 text-center text-sm text-gray-500">
              No recent alerts
            </div>
          </section>

          <div className="bg-[#041635] text-white rounded-lg p-6 relative overflow-hidden group shadow-lg">
            <div className="relative z-10">
              <h4 className="text-lg font-serif font-bold mb-2">Need Immediate Help?</h4>
              <p className="text-xs text-blue-200 mb-4">Our dedicated client support team is available 24/7 for urgent legal matters.</p>
              <button onClick={() => navigate('/contact')} className="bg-[#ffe08f] text-[#241a00] font-bold text-sm px-5 py-2 rounded-lg hover:scale-105 transition-transform">Contact Priority Support</button>
            </div>
            <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-9xl opacity-10 group-hover:rotate-12 transition-transform duration-700">support_agent</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCasesTab = () => {
    const filteredCases = cases.filter(c => {
      if (caseFilter === 'All') return true;
      if (caseFilter === 'Active') return c.status === 'Active';
      if (caseFilter === 'Pending') return c.status === 'Pending';
      if (caseFilter === 'Closed') return c.status === 'Closed';
      return true;
    });

    return (
    <div className="animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
        <div>
          <h2 className="font-serif text-[32px] font-bold text-[#041635] mb-2">My Legal Cases</h2>
          <p className="text-gray-600 text-[15px] max-w-xl">Manage your ongoing legal proceedings, track milestones, and communicate with your assigned council.</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {['All', 'Active', 'Pending', 'Closed'].map(filter => (
            <button 
              key={filter} 
              onClick={() => setCaseFilter(filter)}
              className={`px-5 py-2 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap ${caseFilter === filter ? 'bg-[#041635] text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-[#755b00] hover:text-[#755b00]'}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 max-w-5xl">
        {filteredCases.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-gray-200 text-center space-y-3">
            <span className="material-symbols-outlined text-5xl text-gray-300">work_history</span>
            <p className="text-gray-600 font-bold text-lg">No legal cases in this category</p>
            <p className="text-sm text-gray-400 max-w-md mx-auto">When you initiate legal proceedings or hire counsel, your case records and milestones will be organized here.</p>
          </div>
        ) : (
          filteredCases.map(c => {
            const totalMilestones = (c.case_progress?.length || 0) + 2; 
            const completedMilestones = c.case_progress?.length || 0;
            const percent = Math.round((completedMilestones / totalMilestones) * 100);
            
            // Bar color logic and styling matching the HTML design
            const isCompleted = c.status === 'Closed';
            const isPending = c.status === 'Pending';
            
            const barColorClass = isCompleted ? 'bg-[#569f9f]' : isPending ? 'bg-[#e6c364]' : 'bg-[#fed977]';
            const badgeBg = isCompleted ? 'bg-[#569f9f]/10' : isPending ? 'bg-[#dce3ef]' : 'bg-[#fed977]';
            const badgeText = isCompleted ? 'text-[#569f9f]' : isPending ? 'text-[#44474e]' : 'text-[#785d00]';
            const icon = isCompleted ? 'check_circle' : 'schedule';
            const updateText = isCompleted ? `Closed ${new Date(c.updated_at || c.created_at).toLocaleDateString('default', {month:'short', year:'numeric'})}` : isPending ? 'Pending Review' : `Updated ${getRelativeTime(c.updated_at || c.created_at)}`;

            return (
              <div key={c.id} className="bg-white rounded-lg border border-gray-300 overflow-hidden hover:shadow-md hover:-translate-y-0.5 flex flex-col md:flex-row relative transition-all group">
                <div className={`w-2 shrink-0 ${barColorClass}`}></div>
                <div className="p-6 flex-1 grid md:grid-cols-4 items-center gap-6">
                  
                  <div className="md:col-span-2">
                    <span className="text-[11px] font-bold tracking-wider text-gray-500 mb-1 block uppercase">Case #{c.id.substring(0,8)}</span>
                    <h3 className="font-serif text-[22px] font-bold text-[#041635] mb-3 leading-tight line-clamp-1">{c.title}</h3>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full ${badgeBg} ${badgeText} text-[11px] font-bold`}>{c.category || 'Legal Matter'}</span>
                      <span className="flex items-center gap-1 text-gray-500 text-[12px]"><span className="material-symbols-outlined text-[16px]">{icon}</span> {updateText}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img alt="Lawyer Avatar" className="w-10 h-10 rounded-full object-cover" src={c.lawyer?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.lawyer?.name || 'Lawyer')}&background=041635&color=fff`} />
                      <span className="material-symbols-outlined absolute -right-1 -bottom-1 bg-white text-[#755b00] rounded-full text-[14px] p-0.5" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#041635]">{c.lawyer?.name ? `Adv. ${c.lawyer.name}` : 'Unassigned'}</p>
                      <p className="text-[11px] text-gray-500">Assigned Council</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 items-end">
                    <div className="w-full max-w-[140px]">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-medium text-gray-500">{completedMilestones} of {totalMilestones} complete</span>
                        <span className={`text-[11px] font-bold text-[#041635]`}>{percent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${barColorClass} rounded-full`} style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedCase(c)} className="px-4 py-2 border border-[#041635] text-[#041635] rounded-lg text-[13px] font-medium hover:bg-[#041635] hover:text-white transition-all active:scale-95">View Case</button>
                  </div>

                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Fix 7: Client Payment & Consultation Billing History */}
      <div className="mt-12 max-w-5xl bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-[#041635] text-white flex justify-between items-center">
          <div>
            <h3 className="font-serif text-xl font-bold">Payment & Billing History</h3>
            <p className="text-xs text-gray-300">Detailed log of all retainer fees, consultation charges, and milestone disbursements.</p>
          </div>
          <span className="material-symbols-outlined text-amber-400 text-3xl">receipt_long</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase border-b border-gray-200">
                <th className="p-4 font-bold">Date</th>
                <th className="p-4 font-bold">Ref / Description</th>
                <th className="p-4 font-bold">Counsel</th>
                <th className="p-4 font-bold">Amount Paid</th>
                <th className="p-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {paymentHistory.map(pay => (
                <tr key={pay.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-600">{new Date(pay.created_at).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className="font-bold text-[#041635] block">{pay.description || pay.reference_number || `TX-${pay.id.substring(0,8)}`}</span>
                    {pay.payment_method && <span className="text-xs text-gray-400 uppercase">{pay.payment_method}</span>}
                  </td>
                  <td className="p-4 font-semibold text-gray-700">{pay.lawyer?.name ? `Adv. ${pay.lawyer.name}` : 'Assigned Counsel'}</td>
                  <td className="p-4 font-bold text-green-700">BDT {Number(pay.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-full ${pay.status === 'completed' || pay.status === 'released' || pay.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                      {pay.status || 'completed'}
                    </span>
                  </td>
                </tr>
              ))}
              {paymentHistory.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-500 bg-gray-50/50">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="material-symbols-outlined text-4xl text-gray-300">account_balance_wallet</span>
                      <span className="font-bold text-gray-600">No payment records found</span>
                      <span className="text-xs text-gray-400">Retainer payments, milestone disbursements, and consultation invoices will be logged here.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )};

  const renderAppointmentsTab = () => (
    <div className="animate-fadeIn max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-serif font-bold text-[#041635]">My Legal Appointments</h3>
      </div>
      <div className="space-y-4">
        {appointments.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-gray-200 text-center space-y-3">
            <span className="material-symbols-outlined text-5xl text-gray-300">calendar_clock</span>
            <p className="text-gray-600 font-bold text-lg">No scheduled appointments</p>
            <p className="text-sm text-gray-400 max-w-md mx-auto">You have no upcoming or past legal sessions. Search our directory to book a consultation.</p>
            <button onClick={() => navigate('/lawyer-search')} className="mt-2 px-6 py-2.5 bg-[#041635] text-white text-sm font-bold rounded-xl hover:bg-[#1B2B4B] shadow transition-all">Explore Lawyers</button>
          </div>
        ) : (
          appointments.map(apt => {
            const aptDate = new Date(apt.scheduled_at || apt.scheduled_time || Date.now());
            return (
              <div key={apt.id} className="bg-white rounded-lg border border-[#D0D7E3] shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6 flex-1">
                  <div className={`rounded-lg p-3 w-20 flex flex-col items-center justify-center shrink-0 ${apt.status === 'Upcoming' || apt.status === 'pending' || apt.status === 'confirmed' ? 'bg-[#041635] text-white' : apt.status === 'pending_negotiation' ? 'bg-[#0369a1] text-white' : 'bg-gray-100 text-gray-700'}`}>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{aptDate.toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-2xl font-bold">{aptDate.getDate()}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-bold text-[#041635]">{apt.consultation_type || apt.reason || 'Legal Consultation'}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-gray-100 text-gray-700">{apt.status}</span>
                    </div>
                    <p className="text-gray-500 text-sm">With <span className="font-bold text-[#041635]">{apt.lawyer?.name || 'Assigned Lawyer'}</span></p>
                    <p className="text-xs text-gray-400 mt-1">{aptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    
                    {apt.status === 'pending_negotiation' && (
                      <div className="mt-3 bg-[#e0f2fe] p-3 rounded border border-[#bae6fd] text-xs text-[#0369a1]">
                        <div className="font-bold mb-1">Fee Negotiation in Progress</div>
                        <div>Current Proposed Fee: <span className="font-bold">BDT {Number(apt.fee_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        {apt.negotiation_note && <div className="italic mt-1 text-gray-700">Note: "{apt.negotiation_note}"</div>}
                      </div>
                    )}
                  </div>
                </div>
              <div className="flex items-center gap-3">
                {apt.status === 'pending_negotiation' && apt.proposed_fee_lawyer && (
                  <button onClick={() => handleAcceptLawyerOffer(apt)} className="bg-[#10b981] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#059669] transition-colors shadow-sm">
                    Accept BDT {apt.proposed_fee_lawyer}
                  </button>
                )}
                {(apt.status === 'Upcoming' || apt.status === 'confirmed' || apt.status === 'In Progress') && (
                  <button onClick={() => handleJoinSession(apt)} className="bg-[#041635] text-white px-5 py-2 rounded-lg text-xs font-bold hover:bg-[#1B2B4B] transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">videocam</span> Join Video
                  </button>
                )}
                {apt.status !== 'cancelled' && (
                  <button onClick={() => handleCancelAppointment(apt.id)} className="border border-red-500 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })
        )}
      </div>
    </div>
  );

  const renderProfileTab = () => (
    <div className="animate-fadeIn max-w-5xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Avatar & Progress */}
        <div className="md:col-span-4">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-center">
            <div className="relative inline-block mb-6 group">
              <img alt="Profile Avatar" className="w-48 h-48 rounded-full object-cover border-4 border-gray-100 shadow-inner" src={userProfilePic} />
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
              <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-2 right-2 bg-[#1B2B4B] text-white p-3 rounded-full shadow-lg hover:bg-[#C9A84C] transition-colors">
                <span className="material-symbols-outlined">photo_camera</span>
              </button>
            </div>
            <div className="text-left mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-[#1B2B4B]">Profile Completion</span>
                <span className="text-sm font-bold text-[#C9A84C]">85%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-[#C9A84C] h-2.5 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            <p className="text-xs text-gray-500 italic">
              Complete your profile to unlock premium legal consultation features and personalized contract templates.
            </p>
          </div>
        </div>

        {/* Right Column: Form Subsections */}
        <div className="md:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            {/* Client Type Toggle */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200">
              <div>
                <h3 className="font-serif text-[22px] font-bold text-[#1B2B4B]">Client Type</h3>
                <p className="text-[14px] text-gray-500">Switch between Personal or Business accounts</p>
              </div>
              <label className="flex items-center cursor-pointer">
                <span className="mr-3 font-bold text-[#1B2B4B] text-sm">Individual</span>
                <div className="relative">
                  <input className="sr-only peer" name="clientType" type="checkbox" checked={basicInfo.clientType === 'business'} onChange={handleProfileChange} />
                  <div className="block bg-gray-200 w-14 h-8 rounded-full border border-gray-300"></div>
                  <div className="absolute left-1 top-1 bg-[#1B2B4B] w-6 h-6 rounded-full transition-transform peer-checked:translate-x-full"></div>
                </div>
                <span className={`ml-3 font-bold text-[#1B2B4B] text-sm transition-opacity ${basicInfo.clientType === 'business' ? 'opacity-100' : 'opacity-50'}`}>Business</span>
              </label>
            </div>

            <form className="space-y-8" onSubmit={saveProfile}>
              {/* Personal Info */}
              <div>
                <h4 className="font-bold text-[18px] text-[#1B2B4B] mb-4 flex items-center">
                  <span className="material-symbols-outlined mr-2 text-[#C9A84C]">person</span>
                  Personal Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[13px] font-medium text-gray-600">Full Name</label>
                    <input name="name" value={basicInfo.name} onChange={handleProfileChange} className="w-full px-4 py-2 bg-white border border-gray-300 focus:border-[#1B2B4B] outline-none rounded-lg transition-all" type="text" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[13px] font-medium text-gray-600">Date of Birth</label>
                    <input name="dob" value={basicInfo.dob} onChange={handleProfileChange} className="w-full px-4 py-2 bg-white border border-gray-300 focus:border-[#1B2B4B] outline-none rounded-lg transition-all" type="date" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[13px] font-medium text-gray-600">National ID / Passport</label>
                    <input name="nid" value={basicInfo.nid} onChange={handleProfileChange} className="w-full px-4 py-2 bg-white border border-gray-300 focus:border-[#1B2B4B] outline-none rounded-lg transition-all" placeholder="Enter NID Number" type="text" />
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h4 className="font-bold text-[18px] text-[#1B2B4B] mb-4 flex items-center">
                  <span className="material-symbols-outlined mr-2 text-[#C9A84C]">contact_page</span>
                  Contact Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[13px] font-medium text-gray-600">Email Address</label>
                    <input name="email" value={basicInfo.email} disabled className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed" type="email" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[13px] font-medium text-gray-600">Phone Number</label>
                    <input name="phone" value={basicInfo.phone} onChange={handleProfileChange} className="w-full px-4 py-2 bg-white border border-gray-300 focus:border-[#1B2B4B] outline-none rounded-lg transition-all" type="tel" />
                  </div>
                </div>
              </div>

              {/* Business Fields */}
              {basicInfo.clientType === 'business' && (
                <div className="animate-fadeIn">
                  <h4 className="font-bold text-[18px] text-[#1B2B4B] mb-4 flex items-center">
                    <span className="material-symbols-outlined mr-2 text-[#C9A84C]">domain</span>
                    Business Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[13px] font-medium text-gray-600">Company Name</label>
                      <input name="company_name" value={basicInfo.company_name} onChange={handleProfileChange} className="w-full px-4 py-2 bg-white border border-gray-300 focus:border-[#1B2B4B] outline-none rounded-lg" type="text" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[13px] font-medium text-gray-600">Registration Number (TIN/BIN)</label>
                      <input name="registration_number" value={basicInfo.registration_number} onChange={handleProfileChange} className="w-full px-4 py-2 bg-white border border-gray-300 focus:border-[#1B2B4B] outline-none rounded-lg" type="text" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[13px] font-medium text-gray-600">Industry</label>
                      <select name="industry" value={basicInfo.industry} onChange={handleProfileChange} className="w-full px-4 py-2 bg-white border border-gray-300 focus:border-[#1B2B4B] outline-none rounded-lg">
                        <option>Technology</option>
                        <option>Real Estate</option>
                        <option>Manufacturing</option>
                        <option>E-commerce</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[13px] font-medium text-gray-600">Company Size</label>
                      <select name="company_size" value={basicInfo.company_size} onChange={handleProfileChange} className="w-full px-4 py-2 bg-white border border-gray-300 focus:border-[#1B2B4B] outline-none rounded-lg">
                        <option>1-10 employees</option>
                        <option>11-50 employees</option>
                        <option>50+ employees</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[13px] font-medium text-gray-600">Your Designation</label>
                      <input name="designation" value={basicInfo.designation} onChange={handleProfileChange} className="w-full px-4 py-2 bg-white border border-gray-300 focus:border-[#1B2B4B] outline-none rounded-lg" type="text" />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-[13px] font-medium text-gray-600">Company Website</label>
                      <input name="company_website" value={basicInfo.company_website} onChange={handleProfileChange} className="w-full px-4 py-2 bg-white border border-gray-300 focus:border-[#1B2B4B] outline-none rounded-lg" type="url" />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-gray-200 flex justify-end space-x-4">
                <button type="button" onClick={fetchDashboardData} className="px-8 py-3 text-[#1B2B4B] font-bold border border-[#1B2B4B] rounded-lg hover:bg-gray-50 transition-colors">
                  Discard Changes
                </button>
                <button type="submit" disabled={saving} className="px-10 py-3 bg-[#1B2B4B] text-white font-bold rounded-lg hover:bg-[#C9A84C] transition-all shadow-md">
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <div className="font-sans text-gray-900 bg-[#F4F6F9] min-h-screen">
      <style>{`
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
      `}</style>
      
      {/* Sidebar Navigation Shell */}
      {!inline && (
        <aside className="h-screen w-64 fixed left-0 top-0 bg-[#041635] flex flex-col py-6 z-50">
          <div className="px-6 mb-8">
            <h1 className="font-serif text-[28px] font-bold text-white">LegalConnect</h1>
            <p className="text-[13px] text-[#b7c6ee] opacity-70">Bangladesh Legal Marketplace</p>
          </div>
          <nav className="flex-1 space-y-1">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center px-6 py-3 font-medium text-[13px] transition-all ${activeTab === 'dashboard' ? 'text-white border-l-4 border-[#fed977] bg-[#1b2b4b] font-bold' : 'text-[#8393b8] hover:text-white hover:bg-[#1b2b4b]'}`}>
              <span className="material-symbols-outlined mr-3">dashboard</span> Dashboard
            </button>
            <button onClick={() => setActiveTab('cases')} className={`w-full flex items-center px-6 py-3 font-medium text-[13px] transition-all ${activeTab === 'cases' ? 'text-white border-l-4 border-[#fed977] bg-[#1b2b4b] font-bold' : 'text-[#8393b8] hover:text-white hover:bg-[#1b2b4b]'}`}>
              <span className="material-symbols-outlined mr-3">gavel</span> Cases
            </button>
            <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center px-6 py-3 font-medium text-[13px] transition-all ${activeTab === 'profile' ? 'text-white border-l-4 border-[#fed977] bg-[#1b2b4b] font-bold' : 'text-[#8393b8] hover:text-white hover:bg-[#1b2b4b]'}`}>
              <span className="material-symbols-outlined mr-3">account_circle</span> Privacy
            </button>
            <button onClick={() => setActiveTab('appointments')} className={`w-full flex items-center px-6 py-3 font-medium text-[13px] transition-all ${activeTab === 'appointments' ? 'text-white border-l-4 border-[#fed977] bg-[#1b2b4b] font-bold' : 'text-[#8393b8] hover:text-white hover:bg-[#1b2b4b]'}`}>
              <span className="material-symbols-outlined mr-3">event_available</span> Appointments
            </button>
            <button onClick={() => navigate('/client/portal/messages')} className={`w-full flex items-center px-6 py-3 font-medium text-[13px] transition-all text-[#8393b8] hover:text-white hover:bg-[#1b2b4b]`}>
              <span className="material-symbols-outlined mr-3">mail</span> Messages
            </button>
          </nav>
          <div className="px-6 mt-auto">
            <button onClick={() => navigate('/lawyers')} className="w-full bg-[#755b00] text-white font-medium text-[13px] py-3 rounded-lg hover:bg-[#ffe08f] hover:text-[#241a00] transition-colors">
              New Case Request
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className={inline ? "flex-1 min-h-screen flex flex-col w-full" : "ml-64 min-h-screen flex flex-col"}>
        {/* TopNavBar Shell */}
        <header className="flex justify-between items-center h-16 px-8 sticky top-0 z-40 bg-white bg-opacity-95 backdrop-blur-sm border-b border-[#c5c6cf]">
          <div className="flex items-center space-x-4 flex-1">
            <h2 className="font-bold text-[18px] text-[#041635] capitalize">
              {activeTab === 'dashboard' ? 'Overview' : activeTab === 'profile' ? 'My Profile' : `My ${activeTab}`}
            </h2>
            {activeTab === 'profile' && (
              <div className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${basicInfo.clientType === 'business' ? 'bg-[#fed977] text-[#785d00]' : 'bg-[#e7eefb] text-[#374668]'}`}>
                {basicInfo.clientType}
              </div>
            )}
            
            <div className="relative w-96 ml-8 hidden lg:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
              <input className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:ring-2 focus:ring-[#755b00] focus:outline-none transition-all" placeholder="Search cases, lawyers, or files..." type="text"/>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-gray-500">
              <span className="material-symbols-outlined cursor-pointer hover:text-[#755b00] transition-colors">help_outline</span>
              <span className="material-symbols-outlined cursor-pointer hover:text-[#755b00] transition-colors relative">
                notifications
                {appointments.length > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>}
              </span>
              <span className="material-symbols-outlined cursor-pointer hover:text-[#755b00] transition-colors">settings</span>
            </div>
            <div className="h-8 w-px bg-gray-200 mx-2"></div>
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('profile')}>
              <div className="text-right hidden sm:block">
                <p className="text-[13px] font-bold text-[#041635]">{basicInfo.name || 'Client'}</p>
                <p className="text-[11px] text-gray-500">Client ID: #LC-{user?.id?.substring(0,4) || '9902'}</p>
              </div>
              <img alt="Client Avatar" className="w-10 h-10 rounded-full border border-[#755b00] object-cover" src={userProfilePic} />
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <section className="p-8 flex-1">
          {activeTab === 'dashboard' && renderDashboardTab()}
          {activeTab === 'cases' && renderCasesTab()}
          {activeTab === 'appointments' && renderAppointmentsTab()}
          {activeTab === 'profile' && renderProfileTab()}
        </section>

        {/* Footer */}
        <footer className="mt-auto p-8 border-t border-gray-200 bg-white">
          <div className="max-w-5xl mx-auto flex justify-between items-center text-gray-400 text-xs font-medium">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-sm">security</span>
              <span>End-to-End Encrypted Data Protection</span>
            </div>
            <div>© {new Date().getFullYear()} LegalConnect Bangladesh. All Rights Reserved.</div>
          </div>
        </footer>
      </main>

      {/* Case Detail Drawer */}
      <div 
        className={`fixed inset-0 bg-[#041635]/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${selectedCase ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setSelectedCase(null)}
      ></div>
      <aside 
        className={`fixed right-0 top-0 h-full w-full max-w-lg bg-white z-[70] transition-transform duration-500 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] overflow-y-auto ${selectedCase ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedCase && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Case Details</span>
                <h2 className="font-serif text-[26px] font-bold text-[#041635] leading-tight mt-1">{selectedCase.title}</h2>
              </div>
              <button onClick={() => setSelectedCase(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Lawyer Card */}
            <div className="bg-[#eef4ff] rounded-lg p-6 mb-8 border border-gray-200 flex items-center gap-4">
              <img className="w-16 h-16 rounded-lg object-cover" src={selectedCase.lawyer?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedCase.lawyer?.name || 'Lawyer')}&background=041635&color=fff`} alt="Lawyer" />
              <div>
                <h4 className="font-bold text-[#041635] text-[18px]">{selectedCase.lawyer?.name ? `Adv. ${selectedCase.lawyer.name}` : 'Unassigned'}</h4>
                <p className="text-gray-600 text-[13px] mb-2">Assigned Legal Counsel</p>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/client/portal/messages?lawyerId=${selectedCase.lawyer_id}`)} className="bg-[#041635] text-white text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-[#1b2b4b] transition-colors"><span className="material-symbols-outlined text-[14px]">mail</span> Message</button>
                  <button className="bg-white border border-gray-300 text-[#041635] text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-gray-50 transition-colors"><span className="material-symbols-outlined text-[14px]">call</span> Call</button>
                </div>
              </div>
            </div>

            {/* Vertical Milestone Timeline */}
            <div className="mb-10">
              <h4 className="font-bold text-[#041635] mb-6 text-[18px] flex items-center gap-2">
                <span className="material-symbols-outlined">analytics</span> Case Timeline
              </h4>
              <div className="relative pl-8 space-y-8 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                
                {/* Dynamically render milestones from case_progress */}
                {selectedCase.case_progress && selectedCase.case_progress.length > 0 ? (
                  selectedCase.case_progress.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)).map((progress, index, arr) => {
                    const isLast = index === arr.length - 1;
                    return (
                      <div key={progress.id} className="relative">
                        <div className={`absolute -left-[27px] top-1 w-4 h-4 rounded-full border-4 border-white shadow-sm ${isLast ? 'bg-[#fed977] animate-pulse' : 'bg-[#569f9f]'}`}></div>
                        <p className={`font-bold text-[15px] ${isLast ? 'text-[#755b00]' : 'text-[#041635]'}`}>{progress.title || progress.description}</p>
                        <p className="text-gray-500 text-[12px]">Completed on {new Date(progress.created_at).toLocaleDateString()}</p>
                      </div>
                    )
                  })
                ) : (
                   <div className="relative">
                     <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-[#fed977] border-4 border-white shadow-sm animate-pulse"></div>
                     <p className="font-bold text-[#755b00] text-[15px]">Case Initiated</p>
                     <p className="text-gray-500 text-[12px]">Opened on {new Date(selectedCase.created_at).toLocaleDateString()}</p>
                   </div>
                )}
                
                {/* Future Placeholder */}
                <div className="relative opacity-50">
                  <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-gray-300 border-4 border-white"></div>
                  <p className="font-medium text-gray-500 text-[15px]">Final Resolution</p>
                  <p className="text-gray-500 text-[12px]">Date to be determined</p>
                </div>
              </div>
            </div>

            {/* Linked Documents List */}
            <div>
              <h4 className="font-bold text-[#041635] mb-4 text-[18px] flex items-center gap-2">
                <span className="material-symbols-outlined">folder_shared</span> Linked Documents
              </h4>
              <div className="space-y-3">
                {documents.filter(doc => doc.case_id === selectedCase.id).length === 0 ? (
                   <p className="text-sm text-gray-500 italic">No documents explicitly linked to this case yet. Upload general documents from the Documents tab.</p>
                ) : (
                  documents.filter(doc => doc.case_id === selectedCase.id).map(doc => (
                    <div key={doc.id} onClick={() => window.open(doc.storage_url, '_blank')} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-[#f8f9ff] hover:bg-[#eef4ff] transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-blue-600 bg-blue-50 p-2 rounded">article</span>
                        <div>
                          <p className="text-[13px] font-bold text-[#041635]">{doc.file_name}</p>
                          <p className="text-[11px] text-gray-500">{(doc.file_size / 1024).toFixed(1)} KB • Uploaded {new Date(doc.uploaded_at).toLocaleDateString('default', { month: 'short', day: 'numeric' })}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">download</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </aside>

    </div>
  );
};

export default ClientDashboard;
