import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

const LawyerCasesView = () => {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { user } = useAuth();
  
  const [cases, setCases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [caseFilter, setCaseFilter] = useState('All');
  const [selectedCase, setSelectedCase] = useState(null);

  useEffect(() => {
    if (caseId && cases.length > 0) {
      const found = cases.find(c => String(c.id) === String(caseId) || String(c.linked_appointment_id) === String(caseId));
      if (found) setSelectedCase(found);
    }
  }, [caseId, cases]);

  // Milestone states
  const [milestones, setMilestones] = useState([]);
  const [milestoneLoading, setMilestoneLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState('timeline');
  const [newMilestone, setNewMilestone] = useState({ title: '', description: '', milestone_fee: '' });
  const [submittingMilestone, setSubmittingMilestone] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    
    fetchCasesData();

    // Set up realtime subscriptions for live data updates
    const channel = supabase.channel(`lawyer_cases_realtime_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, (payload) => {
        fetchCasesData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, (payload) => {
        fetchCasesData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
        fetchCasesData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchCasesData = async () => {
    try {
      setLoading(true);
      const rawUserIds = [...new Set([user?.id, user?.auth_id].filter(Boolean))];
      if (rawUserIds.length === 0) {
        setCases([]);
        setDocuments([]);
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

      let casesData = [];
      let contractsData = [];
      let appointmentsData = [];

      // Fetch using UUIDs
      if (uuidList.length > 0) {
        try {
          const { data } = await supabase.from('cases').select('*, client:users!cases_client_id_fkey(id, name, profile_picture_url), case_progress(*)').in('lawyer_id', uuidList).order('updated_at', { ascending: false });
          if (data) casesData = [...casesData, ...data];
        } catch(e) {}
        
        try {
          const { data } = await supabase.from('contracts').select('*, client:users!contracts_client_id_fkey(id, name, profile_picture_url)').in('lawyer_id', uuidList);
          if (data) contractsData = [...contractsData, ...data];
        } catch(e) {}

        try {
          const { data } = await supabase.from('appointments').select('*, client:users!appointments_client_id_fkey(id, name, profile_picture_url)').in('lawyer_id', uuidList).in('status', ['confirmed', 'active', 'Upcoming', 'In Progress', 'pending_negotiation']);
          if (data) appointmentsData = [...appointmentsData, ...data];
        } catch(e) {}
      }

      // Fetch using Integers
      if (intList.length > 0) {
        try {
          const { data } = await supabase.from('cases').select('*, client:users!cases_client_id_fkey(id, name, profile_picture_url), case_progress(*)').in('lawyer_id', intList).order('updated_at', { ascending: false });
          if (data) casesData = [...casesData, ...data];
        } catch(e) {}
        
        try {
          const { data } = await supabase.from('contracts').select('*, client:users!contracts_client_id_fkey(id, name, profile_picture_url)').in('lawyer_id', intList);
          if (data) contractsData = [...contractsData, ...data];
        } catch(e) {}

        try {
          const { data } = await supabase.from('appointments').select('*, client:users!appointments_client_id_fkey(id, name, profile_picture_url)').in('lawyer_id', intList).in('status', ['confirmed', 'active', 'Upcoming', 'In Progress', 'pending_negotiation']);
          if (data) appointmentsData = [...appointmentsData, ...data];
        } catch(e) {}
      }

      // Fallbacks if relational queries failed
      if (casesData.length === 0) {
        try {
           const { data } = await supabase.from('cases').select('*').in('lawyer_id', rawUserIds).order('updated_at', { ascending: false });
           if (data) casesData = data;
        } catch(e) {}
      }
      
      if (appointmentsData.length === 0) {
        try {
           const { data } = await supabase.from('appointments').select('*').in('lawyer_id', rawUserIds).in('status', ['confirmed', 'active', 'Upcoming', 'In Progress', 'pending_negotiation']);
           if (data) appointmentsData = data;
        } catch(e) {}
      }

      const mergedMap = new Map();
      if (casesData) {
        casesData.forEach(c => mergedMap.set(String(c.id), c));
      }

      if (contractsData) {
        contractsData.forEach(cnt => {
          if (cnt.case_id && mergedMap.has(String(cnt.case_id))) {
            const existing = mergedMap.get(String(cnt.case_id));
            existing.contract = cnt;
            existing.agreed_fee = cnt.amount || cnt.agreed_amount;
            existing.outstanding_balance = cnt.outstanding_balance;
          } else if (!cnt.case_id || !mergedMap.has(String(cnt.case_id))) {
            const synthId = cnt.case_id || `contract_${cnt.id}`;
            mergedMap.set(String(synthId), {
              id: synthId,
              title: cnt.title || 'Legal Contract Matter',
              description: cnt.terms || 'Contract representation matter.',
              status: cnt.status?.toLowerCase() === 'active' ? 'active' : 'pending',
              case_type: 'Full Representation',
              client: cnt.client,
              client_id: cnt.client_id,
              lawyer_id: cnt.lawyer_id,
              contract: cnt,
              agreed_fee: cnt.amount || cnt.agreed_amount,
              outstanding_balance: cnt.outstanding_balance,
              updated_at: cnt.updated_at || cnt.created_at
            });
          }
        });
      }

      if (appointmentsData) {
        appointmentsData.forEach(apt => {
          const existsByLinked = Array.from(mergedMap.values()).some(c => String(c.linked_appointment_id) === String(apt.id));
          if (!existsByLinked) {
            const synthId = `consultation_${apt.id}`;
            mergedMap.set(String(synthId), {
              id: synthId,
              linked_appointment_id: apt.id,
              title: apt.session_type ? `${apt.session_type} (${apt.reason})` : (apt.reason || 'Consultation Matter'),
              description: apt.notes || apt.reason || 'Active consultation matter.',
              status: apt.status === 'confirmed' || apt.status === 'active' || apt.status === 'Upcoming' || apt.status === 'In Progress' ? 'active' : 'pending',
              case_type: 'Consultation',
              medium: apt.medium || 'video_call',
              client: apt.client,
              client_id: apt.client_id,
              lawyer_id: apt.lawyer_id,
              agreed_fee: apt.agreed_fee || apt.fee_amount,
              updated_at: apt.updated_at || apt.created_at
            });
          }
        });
      }

      const mergedList = Array.from(mergedMap.values());
      
      // Resolve client profiles across users, profiles, and clients tables
      const allClientIds = [...new Set(mergedList.map(item => item.client_id || item.user_id || item.client?.id).filter(Boolean))];
      const clientsMap = {};

      if (allClientIds.length > 0) {
        try {
          const { data: usersRes } = await supabase
            .from('users')
            .select('id, name, full_name, email, profile_picture_url, user_type')
            .in('id', allClientIds);
          if (usersRes) {
            usersRes.forEach(u => {
              clientsMap[u.id] = { ...u, name: u.name || u.full_name || u.email || 'Client' };
            });
          }
        } catch(e) {}

        try {
          const { data: profilesRes } = await supabase
            .from('profiles')
            .select('id, full_name, email, profile_picture_url')
            .in('id', allClientIds);
          if (profilesRes) {
            profilesRes.forEach(p => {
              if (!clientsMap[p.id] || !clientsMap[p.id].name) {
                clientsMap[p.id] = { ...p, name: p.full_name || p.email || 'Client' };
              }
            });
          }
        } catch(e) {}

        try {
          const { data: clientsTableRes } = await supabase
            .from('clients')
            .select('id, user_id, full_name, email, profile_picture_url')
            .in('user_id', allClientIds);
          if (clientsTableRes) {
            clientsTableRes.forEach(c => {
              const targetId = c.user_id || c.id;
              if (!clientsMap[targetId] || !clientsMap[targetId].name) {
                clientsMap[targetId] = { ...c, name: c.full_name || c.email || 'Client' };
              }
            });
          }
        } catch(e) {}
      }

      mergedList.forEach(item => {
        const cId = item.client_id || item.user_id || item.client?.id;
        const resolvedClient = clientsMap[cId] || item.client || {};
        const resolvedName = resolvedClient.name || resolvedClient.full_name || item.client_name || item.guest_name || item.contact_name || item.sender_name || 'Client';
        
        item.client = {
          ...resolvedClient,
          name: resolvedName !== 'Unassigned' ? resolvedName : 'Client',
          profile_picture_url: resolvedClient.profile_picture_url || item.client?.profile_picture_url
        };
      });

      setCases(mergedList);

      if (casesData && casesData.length > 0) {
        const caseIds = casesData.map(c => c.id);
        const { data: docsData } = await supabase
          .from('documents')
          .select('*')
          .in('case_id', caseIds)
          .order('uploaded_at', { ascending: false });
        setDocuments(docsData || []);
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching cases:', error.message, error);
      setError('Failed to load cases. Please check your network connection.');
      setCases([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch milestones for the selected case
  const fetchMilestones = useCallback(async (caseId) => {
    if (!caseId) return;
    setMilestoneLoading(true);
    try {
      const { data, error } = await supabase
        .from('case_milestones')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMilestones(data || []);
    } catch (err) {
      console.error('Error fetching milestones:', err);
      setMilestones([]);
    } finally {
      setMilestoneLoading(false);
    }
  }, []);

  // When selectedCase changes, fetch its milestones
  useEffect(() => {
    if (selectedCase) {
      fetchMilestones(selectedCase.id);
      setDrawerTab('timeline');
    } else {
      setMilestones([]);
    }
  }, [selectedCase, fetchMilestones]);

  // Realtime subscription for milestone changes on selected case
  useEffect(() => {
    if (!selectedCase) return;
    const channel = supabase
      .channel(`milestones_case_${selectedCase.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'case_milestones',
        filter: `case_id=eq.${selectedCase.id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMilestones(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setMilestones(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
          if (payload.new.status === 'approved') {
            toast.success(`Milestone "${payload.new.title}" approved!`);
          } else if (payload.new.status === 'rejected') {
            toast('Milestone rejected by client', { icon: '⚠️' });
          } else if (payload.new.status === 'revision_requested') {
            toast('Client requested revisions', { icon: '📝' });
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedCase]);

  // Submit a new milestone
  const handleSubmitMilestone = async () => {
    if (!newMilestone.title.trim()) { toast.error('Milestone title is required'); return; }
    if (!selectedCase || !user) return;
    setSubmittingMilestone(true);
    try {
      const { error } = await supabase
        .from('case_milestones')
        .insert([{
          case_id: selectedCase.id,
          lawyer_id: user.id,
          title: newMilestone.title.trim(),
          description: newMilestone.description.trim() || null,
          milestone_fee: Number(newMilestone.milestone_fee || 0),
          status: 'submitted',
          submitted_at: new Date().toISOString()
        }]);

      if (error) throw error;
      toast.success('Milestone submitted to client for review');
      setNewMilestone({ title: '', description: '', milestone_fee: '' });
      // Realtime will handle adding to the list
    } catch (err) {
      console.error('Error submitting milestone:', err);
      toast.error('Failed to submit milestone');
    } finally {
      setSubmittingMilestone(false);
    }
  };

  // Resubmit a revised milestone
  const handleResubmitMilestone = async (milestoneId) => {
    try {
      const { error } = await supabase
        .from('case_milestones')
        .update({ status: 'submitted', reviewed_at: null, client_feedback: null, submitted_at: new Date().toISOString() })
        .eq('id', milestoneId);

      if (error) throw error;
      toast.success('Milestone resubmitted for review');
    } catch (err) {
      toast.error('Failed to resubmit milestone');
    }
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

  // Milestone progress calculation
  const approvedCount = milestones.filter(m => m.status === 'approved').length;
  const totalCount = milestones.length;
  const milestonePercent = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  const getStatusBadge = (status) => {
    const map = {
      pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Pending' },
      submitted: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Submitted' },
      approved: { bg: 'bg-green-50', text: 'text-green-700', label: 'Approved' },
      rejected: { bg: 'bg-red-50', text: 'text-red-700', label: 'Rejected' },
      revision_requested: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Revision Requested' },
    };
    const s = map[status] || map.pending;
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-container-max mx-auto flex items-center justify-center min-h-[400px]">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md text-center space-y-4">
          <span className="material-symbols-outlined text-5xl text-red-500">error_outline</span>
          <h3 className="text-xl font-bold text-primary">Failed to Load Cases</h3>
          <p className="text-gray-600 text-sm">{error}</p>
          <button 
            onClick={() => { setLoading(true); setError(null); fetchCasesData(); }}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow transition active:scale-95"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredCases = cases.filter(c => {
    if (caseFilter === 'All') return true;
    const st = (c.status || '').toLowerCase();
    if (caseFilter === 'Active') return st === 'active' || st === 'in progress' || st === 'confirmed' || st === 'upcoming';
    if (caseFilter === 'Pending') return st === 'pending' || st === 'pending_negotiation' || st === 'draft' || st === 'pending review';
    if (caseFilter === 'Closed') return st === 'closed' || st === 'completed' || st === 'archived' || st === 'terminated';
    return true;
  });

  return (
    <div className="animate-fadeIn p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
        <div>
          <h2 className="font-serif text-[32px] font-bold text-[#041635] mb-2">My Legal Cases</h2>
          <p className="text-gray-600 text-[15px] max-w-xl">Manage your ongoing legal proceedings, track milestones, and communicate with your clients.</p>
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
            <p className="text-gray-600 font-bold text-lg">No legal cases found in this category</p>
            <p className="text-sm text-gray-400 max-w-md mx-auto">When clients hire you or initiate contracts, your active and archived matters will be listed here.</p>
          </div>
        ) : (
          filteredCases.map(c => {
            // Use real milestones if this case is selected, otherwise fallback to case_progress
            const caseMilestones = selectedCase?.id === c.id ? milestones : [];
            const caseApproved = caseMilestones.filter(m => m.status === 'approved').length;
            const caseTotal = caseMilestones.length || ((c.case_progress?.length || 0) + 2);
            const caseCompleted = caseMilestones.length > 0 ? caseApproved : (c.case_progress?.length || 0);
            const percent = caseTotal > 0 ? Math.round((caseCompleted / caseTotal) * 100) : 0;
            
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
                    <span className="text-[11px] font-bold tracking-wider text-gray-500 mb-1 block uppercase">Case #{String(c.id).substring(0,8)}</span>
                    <h3 className="font-serif text-[22px] font-bold text-[#041635] mb-3 leading-tight line-clamp-1">{c.title}</h3>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full ${badgeBg} ${badgeText} text-[11px] font-bold`}>{c.category || 'Legal Matter'}</span>
                      <span className="flex items-center gap-1 text-gray-500 text-[12px]"><span className="material-symbols-outlined text-[16px]">{icon}</span> {updateText}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img alt="Client Avatar" className="w-10 h-10 rounded-full object-cover" src={c.client?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.client?.name || 'Client')}&background=041635&color=fff`} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#041635]">{c.client?.name || 'Client'}</p>
                      <p className="text-[11px] font-semibold text-gray-500">
                        {c.case_type === 'Consultation' ? 'Booked Appointment / Consulting' : c.case_type === 'Full Representation' ? 'Contract Client' : 'Case Client'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 items-end">
                    <div className="w-full max-w-[140px]">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-medium text-gray-500">{caseCompleted} of {caseTotal} complete</span>
                        <span className={`text-[11px] font-bold text-[#041635]`}>{percent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${barColorClass} rounded-full transition-all duration-500`} style={{ width: `${percent}%` }}></div>
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

      {/* Case Detail Drawer */}
      <div 
        className={`fixed inset-0 bg-[#041635]/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${selectedCase ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setSelectedCase(null)}
      ></div>
      <aside 
        className={`fixed right-0 top-0 h-full w-full max-w-xl bg-white z-[70] transition-transform duration-500 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] overflow-y-auto ${selectedCase ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedCase && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Case Details</span>
                <h2 className="font-serif text-[24px] font-bold text-[#041635] leading-tight mt-1">{selectedCase.title}</h2>
              </div>
              <button onClick={() => setSelectedCase(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Client Card */}
            <div className="bg-[#eef4ff] rounded-lg p-5 mb-6 border border-gray-200 flex items-center gap-4">
              <img className="w-14 h-14 rounded-lg object-cover" src={selectedCase.client?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedCase.client?.name || 'Client')}&background=041635&color=fff`} alt="Client" />
              <div>
                <h4 className="font-bold text-[#041635] text-[16px]">{selectedCase.client?.name || 'Client'}</h4>
                <p className="text-gray-600 font-medium text-[12px] mb-2">
                  {selectedCase.case_type === 'Consultation' ? 'Booked Appointment / Consulting' : selectedCase.case_type === 'Full Representation' ? 'Contract Client' : 'Case Client'}
                </p>
                <button onClick={() => navigate(`/lawyer-suite/communication`)} className="bg-[#041635] text-white text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-[#1b2b4b] transition-colors"><span className="material-symbols-outlined text-[14px]">mail</span> Message</button>
              </div>
            </div>

            {/* Milestone Progress Bar */}
            {totalCount > 0 && (
              <div className="mb-6 bg-gradient-to-r from-[#041635] to-[#1b2b4b] rounded-lg p-5 text-white">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[13px] font-medium opacity-80">Case Progress</span>
                  <span className="text-[20px] font-bold">{milestonePercent}%</span>
                </div>
                <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-[#fed977] rounded-full transition-all duration-700" style={{ width: `${milestonePercent}%` }}></div>
                </div>
                <p className="text-[11px] mt-2 opacity-70">{approvedCount} of {totalCount} milestones approved</p>
              </div>
            )}

            {/* Drawer Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
              {[
                { key: 'timeline', label: 'Milestones', icon: 'timeline' },
                { key: 'documents', label: 'Documents', icon: 'folder_shared' },
                { key: 'invoice', label: 'Contract/Invoice', icon: 'receipt_long' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setDrawerTab(tab.key)}
                  className={`flex-1 py-2 px-3 rounded-md text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all ${drawerTab === tab.key ? 'bg-white text-[#041635] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>{tab.label}
                </button>
              ))}
            </div>

            {/* Milestones Tab */}
            {drawerTab === 'timeline' && (
              <div>
                {/* Create Milestone Form */}
                <div className="mb-6 border border-dashed border-[#755b00] rounded-lg p-4 bg-[#fffdf5]">
                  <h5 className="text-[13px] font-bold text-[#041635] mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#755b00]">add_circle</span> Submit New Milestone
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    <input
                      type="text"
                      value={newMilestone.title}
                      onChange={e => setNewMilestone(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Milestone title (e.g., 'Filed initial petition')"
                      className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#755b00]/30 focus:border-[#755b00]"
                    />
                    <input
                      type="number"
                      value={newMilestone.milestone_fee}
                      onChange={e => setNewMilestone(prev => ({ ...prev, milestone_fee: e.target.value }))}
                      placeholder="Fee (BDT)"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#755b00]/30 focus:border-[#755b00]"
                    />
                  </div>
                  <textarea
                    value={newMilestone.description}
                    onChange={e => setNewMilestone(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] mb-3 focus:outline-none focus:ring-2 focus:ring-[#755b00]/30 focus:border-[#755b00] resize-none"
                  />
                  <button
                    onClick={handleSubmitMilestone}
                    disabled={submittingMilestone || !newMilestone.title.trim()}
                    className="w-full bg-[#041635] text-white py-2 rounded-lg text-[12px] font-bold hover:bg-[#1b2b4b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    {submittingMilestone ? 'Submitting...' : 'Submit to Client for Review'}
                  </button>
                </div>

                {/* Milestone Timeline */}
                {milestoneLoading ? (
                  <div className="text-center py-8 text-gray-400 animate-pulse">Loading milestones...</div>
                ) : milestones.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">timeline</span>
                    <p className="text-gray-500 text-[13px]">No milestones yet. Submit your first milestone above.</p>
                  </div>
                ) : (
                  <div className="relative pl-8 space-y-6 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                    {milestones.map((m, i) => {
                      const dotColor = m.status === 'approved' ? 'bg-green-500' 
                        : m.status === 'rejected' ? 'bg-red-500'
                        : m.status === 'revision_requested' ? 'bg-amber-500'
                        : m.status === 'submitted' ? 'bg-blue-500 animate-pulse'
                        : 'bg-gray-400';

                      return (
                        <div key={m.id} className="relative">
                          <div className={`absolute -left-[27px] top-1 w-4 h-4 rounded-full border-4 border-white shadow-sm ${dotColor}`}>
                            {m.status === 'approved' && (
                              <span className="material-symbols-outlined text-white text-[8px] absolute inset-0 flex items-center justify-center" style={{fontVariationSettings: "'FILL' 1"}}>check</span>
                            )}
                          </div>
                          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                            <div className="flex justify-between items-start mb-1">
                              <div>
                                <p className="font-bold text-[14px] text-[#041635]">{m.title}</p>
                                {Number(m.milestone_fee || 0) > 0 && (
                                  <span className="text-xs font-bold text-[#10b981]">Fee: BDT {Number(m.milestone_fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                )}
                              </div>
                              {getStatusBadge(m.status)}
                            </div>
                            {m.description && <p className="text-gray-500 text-[12px] mb-2">{m.description}</p>}
                            <p className="text-gray-400 text-[11px]">Submitted {new Date(m.submitted_at || m.created_at).toLocaleDateString()}</p>
                            {m.reviewed_at && <p className="text-gray-400 text-[11px]">Reviewed {new Date(m.reviewed_at).toLocaleDateString()}</p>}
                            
                            {/* Client feedback */}
                            {m.client_feedback && (
                              <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-3">
                                <p className="text-[11px] font-bold text-amber-800 mb-1">Client Feedback:</p>
                                <p className="text-[12px] text-amber-700">{m.client_feedback}</p>
                              </div>
                            )}

                            {/* Resubmit button for rejected/revision_requested */}
                            {(m.status === 'rejected' || m.status === 'revision_requested') && (
                              <button
                                onClick={() => handleResubmitMilestone(m.id)}
                                className="mt-3 px-3 py-1.5 bg-[#041635] text-white text-[11px] font-bold rounded-lg hover:bg-[#1b2b4b] transition-colors flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">refresh</span> Resubmit
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Documents Tab */}
            {drawerTab === 'documents' && (
              <div>
                <div className="space-y-3">
                  {documents.filter(doc => doc.case_id === selectedCase.id).length === 0 ? (
                     <p className="text-sm text-gray-500 italic text-center py-8">No documents linked to this case yet.</p>
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
            )}

            {/* Invoice Tab */}
            {drawerTab === 'invoice' && (
              <div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-[#041635] p-5 text-white flex justify-between items-center">
                     <div>
                       <h3 className="text-lg font-bold">Case Contract & Fee Details</h3>
                       <p className="text-xs text-blue-200 mt-0.5">Ref: #{String(selectedCase.id).substring(0, 8).toUpperCase()}</p>
                     </div>
                  </div>
                  <div className="p-6 space-y-5">
                     <div className="flex flex-col md:flex-row justify-between border-b border-gray-100 pb-5 gap-3">
                       <div>
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Client</p>
                         <p className="text-[15px] font-bold text-[#041635] mt-0.5">{selectedCase.client?.name || 'Unassigned Client'}</p>
                       </div>
                       <div className="md:text-right">
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Agreement Status</p>
                         <span className="inline-block mt-1 px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full text-[10px] font-bold uppercase tracking-wider">{selectedCase.status || 'Active'}</span>
                       </div>
                     </div>
                     <div>
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Scope of Legal Work</p>
                       <p className="text-gray-800 text-[13px] whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-gray-100 leading-relaxed">
                         {selectedCase.contract?.scope_of_work || selectedCase.contract?.terms || selectedCase.description || 'General Legal Representation / Consultation'}
                       </p>
                     </div>
                     <div className="bg-[#041635]/5 p-5 rounded-xl border border-[#041635]/10 flex justify-between items-center">
                       <span className="font-bold text-[#041635] text-[13px]">Total Agreed Fee</span>
                       <span className="text-[20px] font-black text-[#755b00]">BDT {Number(selectedCase.agreed_fee || 0).toLocaleString()}</span>
                     </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

    </div>
  );
};

export default LawyerCasesView;
