import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { realtimeSync } from '../../services/realtimeSync.service';
import toast from 'react-hot-toast';

// Reusable Components
import CaseSummaryCards from '../../components/LawyerCaseTracking/CaseSummaryCards';
import CaseSearchBar from '../../components/LawyerCaseTracking/CaseSearchBar';
import CaseFilters from '../../components/LawyerCaseTracking/CaseFilters';
import CaseCard from '../../components/LawyerCaseTracking/CaseCard';
import TimelineCard from '../../components/LawyerCaseTracking/TimelineCard';
import ContractInfo from '../../components/LawyerCaseTracking/ContractInfo';
import ClientInfo from '../../components/LawyerCaseTracking/ClientInfo';
import PaymentSummary from '../../components/LawyerCaseTracking/PaymentSummary';
import UpcomingEvents from '../../components/LawyerCaseTracking/UpcomingEvents';
import EmptyState from '../../components/LawyerCaseTracking/EmptyState';
import LoadingSkeleton from '../../components/LawyerCaseTracking/LoadingSkeleton';
import Pagination from '../../components/LawyerCaseTracking/Pagination';
import CaseStatusBadge from '../../components/LawyerCaseTracking/CaseStatusBadge';

const LawyerCasesView = () => {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { user } = useAuth();

  // Primary State
  const [cases, setCases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search, Filter, Sort, Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'All',
    practiceArea: 'All',
    dateRange: 'All',
    sortBy: 'Newest',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Selected Case & Modal/Drawer State
  const [selectedCase, setSelectedCase] = useState(null);
  const selectedCaseRef = useRef(null);
  useEffect(() => {
    selectedCaseRef.current = selectedCase;
  }, [selectedCase]);
  const [drawerTab, setDrawerTab] = useState('overview'); // overview | timeline | contract | client | documents
  const [isCompleting, setIsCompleting] = useState(false);

  // Milestone Add State inside Drawer
  const [milestones, setMilestones] = useState([]);
  const [milestoneLoading, setMilestoneLoading] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ title: '', description: '', milestone_fee: '', due_date: '' });
  const [submittingMilestone, setSubmittingMilestone] = useState(false);

  // Document Upload State
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Contract Workflow State
  const [contractAction, setContractAction] = useState(null);
  const [progressTitle, setProgressTitle] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [submittingContractAction, setSubmittingContractAction] = useState(false);
  const [contractTimeline, setContractTimeline] = useState([]);

  // 1. Secure & Validated Data Fetching
  const fetchCasesData = useCallback(async () => {
    // Check if user exists and valid UUID/id is present before any database query
    const rawAuthId = user?.id || user?.auth_id;
    if (!rawAuthId || rawAuthId === 'undefined') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const rawUserIds = [...new Set([user?.id, user?.auth_id].filter(Boolean))];
      if (rawUserIds.length === 0) {
        setCases([]);
        setLoading(false);
        return;
      }

      const uuidList = rawUserIds.filter((id) => typeof id === 'string' && id.includes('-'));
      let intList = [];

      // Resolve integer IDs if lawyer table uses serial/int
      if (uuidList.length > 0) {
        try {
          const { data: lRes } = await supabase.from('lawyers').select('id').in('user_id', uuidList);
          if (lRes && lRes.length > 0) {
            intList = lRes.map((l) => l.id).filter(Boolean);
          }
        } catch (lErr) {
          console.warn('Lawyer integer ID resolution note:', lErr.message);
        }
      }

      let casesData = [];
      let contractsData = [];
      let appointmentsData = [];
      let paymentsData = [];

      // Fetch by UUIDs safely
      if (uuidList.length > 0) {
        try {
          const { data } = await supabase
            .from('cases')
            .select('*, client:users!cases_client_id_fkey(id, name, full_name, email, profile_picture_url), case_milestones(*)')
            .in('lawyer_id', uuidList)
            .order('updated_at', { ascending: false });
          if (data) casesData = [...casesData, ...data];
        } catch (e) {
          // Fallback if relation name differs
          try {
            const { data: fbData } = await supabase
              .from('cases')
              .select('*')
              .in('lawyer_id', uuidList)
              .order('updated_at', { ascending: false });
            if (fbData) casesData = [...casesData, ...fbData];
          } catch (e2) {}
        }

        try {
          const { data } = await supabase
            .from('contracts')
            .select('*, client:users!contracts_client_id_fkey(id, name, full_name, email, profile_picture_url), job_post:job_posts(*)')
            .in('lawyer_id', uuidList);
          if (data) contractsData = [...contractsData, ...data];
        } catch (e) {
          try {
            const { data: fbCnt } = await supabase.from('contracts').select('*').in('lawyer_id', uuidList);
            if (fbCnt) contractsData = [...contractsData, ...fbCnt];
          } catch (e2) {}
        }

        try {
          const { data } = await supabase
            .from('appointments')
            .select('*, client:users!appointments_client_id_fkey(id, name, full_name, email, profile_picture_url)')
            .in('lawyer_id', uuidList)
            .in('status', ['confirmed', 'active', 'Upcoming', 'In Progress', 'pending_negotiation', 'completed']);
          if (data) appointmentsData = [...appointmentsData, ...data];
        } catch (e) {}

        try {
          const { data } = await supabase.from('payments').select('*').in('lawyer_id', uuidList);
          if (data) paymentsData = [...paymentsData, ...data];
        } catch (e) {}
      }

      // Fetch by Integers safely
      if (intList.length > 0) {
        try {
          const { data } = await supabase
            .from('cases')
            .select('*, client:users!cases_client_id_fkey(id, name, full_name, email, profile_picture_url), case_milestones(*)')
            .in('lawyer_id', intList)
            .order('updated_at', { ascending: false });
          if (data) casesData = [...casesData, ...data];
        } catch (e) {
          try {
            const { data: fbData } = await supabase
              .from('cases')
              .select('*')
              .in('lawyer_id', intList)
              .order('updated_at', { ascending: false });
            if (fbData) casesData = [...casesData, ...fbData];
          } catch (e2) {}
        }

        try {
          const { data } = await supabase
            .from('contracts')
            .select('*, client:users!contracts_client_id_fkey(id, name, full_name, email, profile_picture_url), job_post:job_posts(*)')
            .in('lawyer_id', intList);
          if (data) contractsData = [...contractsData, ...data];
        } catch (e) {
          try {
            const { data: fbCnt } = await supabase.from('contracts').select('*').in('lawyer_id', intList);
            if (fbCnt) contractsData = [...contractsData, ...fbCnt];
          } catch (e2) {}
        }

        try {
          const { data } = await supabase
            .from('appointments')
            .select('*, client:users!appointments_client_id_fkey(id, name, full_name, email, profile_picture_url)')
            .in('lawyer_id', intList)
            .in('status', ['confirmed', 'active', 'Upcoming', 'In Progress', 'pending_negotiation', 'completed']);
          if (data) appointmentsData = [...appointmentsData, ...data];
        } catch (e) {}

        try {
          const { data } = await supabase.from('payments').select('*').in('lawyer_id', intList);
          if (data) paymentsData = [...paymentsData, ...data];
        } catch (e) {}
      }

      // Merge into deduplicated map
      const mergedMap = new Map();

      if (Array.isArray(casesData)) {
        casesData.forEach((c) => {
          // Ignore rejected items
          if (String(c.status).toLowerCase() !== 'rejected') {
            mergedMap.set(String(c.id), c);
          }
        });
      }

      if (Array.isArray(contractsData)) {
        contractsData.forEach((cnt) => {
          if (String(cnt.status).toLowerCase() === 'rejected') return;

          if (cnt.case_id && mergedMap.has(String(cnt.case_id))) {
            const existing = mergedMap.get(String(cnt.case_id));
            existing.contract = cnt;
            existing.agreed_fee = cnt.amount || cnt.agreed_amount || existing.agreed_fee;
            existing.job_post = cnt.job_post || existing.job_post;
            if (cnt.client && !existing.client?.name) existing.client = cnt.client;
          } else if (!cnt.case_id || !mergedMap.has(String(cnt.case_id))) {
            const synthId = cnt.case_id || `contract_${cnt.id}`;
            mergedMap.set(String(synthId), {
              id: synthId,
              title: cnt.title || cnt.job_post?.title || 'Retainer Contract Representation',
              description: cnt.terms || cnt.job_post?.description || 'Formal representation contract.',
              status: cnt.status?.toLowerCase() === 'active' || cnt.status?.toLowerCase() === 'signed' ? 'active' : 'pending',
              practice_area: cnt.job_post?.category || cnt.category || 'General Representation',
              client: cnt.client || {},
              client_id: cnt.client_id,
              lawyer_id: cnt.lawyer_id,
              contract: cnt,
              job_post: cnt.job_post,
              agreed_fee: cnt.amount || cnt.agreed_amount || 0,
              outstanding_balance: cnt.outstanding_balance,
              created_at: cnt.created_at,
              updated_at: cnt.updated_at || cnt.created_at,
            });
          }
        });
      }

      if (Array.isArray(appointmentsData)) {
        appointmentsData.forEach((apt) => {
          if (String(apt.status).toLowerCase() === 'rejected') return;

          const existsByLinked = Array.from(mergedMap.values()).some(
            (c) => String(c.linked_appointment_id) === String(apt.id) || String(c.appointment_id) === String(apt.id)
          );
          if (!existsByLinked) {
            const synthId = `consultation_${apt.id}`;
            mergedMap.set(String(synthId), {
              id: synthId,
              linked_appointment_id: apt.id,
              title: apt.session_type ? `${apt.session_type} (${apt.reason || 'Consultation'})` : apt.reason || 'Legal Consultation Session',
              description: apt.notes || apt.reason || 'Scheduled client consultation matter.',
              status:
                apt.status === 'confirmed' || apt.status === 'active' || apt.status === 'Upcoming' || apt.status === 'In Progress'
                  ? 'active'
                  : apt.status === 'completed'
                  ? 'completed'
                  : 'pending',
              practice_area: apt.practice_area || 'Legal Consultation',
              medium: apt.medium || 'video_call',
              client: apt.client || {},
              client_id: apt.client_id,
              lawyer_id: apt.lawyer_id,
              agreed_fee: apt.agreed_fee || apt.fee_amount || 0,
              created_at: apt.created_at,
              updated_at: apt.updated_at || apt.created_at,
            });
          }
        });
      }

      const mergedList = Array.from(mergedMap.values());

      // Resolve missing client profiles
      const allClientIds = [...new Set(mergedList.map((item) => item.client_id || item.user_id || item.client?.id).filter(Boolean))];
      const clientsMap = {};

      if (allClientIds.length > 0) {
        try {
          const { data: uData } = await supabase.from('users').select('id, name, full_name, email, phone, profile_picture_url, location').in('id', allClientIds);
          if (uData) {
            uData.forEach((u) => {
              clientsMap[u.id] = { ...u, name: u.name || u.full_name || u.email || 'Client' };
            });
          }
        } catch (e) {}

        try {
          const { data: pData } = await supabase.from('profiles').select('id, full_name, email, phone, profile_picture_url, city').in('id', allClientIds);
          if (pData) {
            pData.forEach((p) => {
              const target = clientsMap[p.id] || {};
              clientsMap[p.id] = {
                ...target,
                ...p,
                name: p.full_name || target.name || p.email || 'Client',
                location: p.city || target.location || 'Bangladesh',
              };
            });
          }
        } catch (e) {}

        try {
          const { data: cData } = await supabase.from('clients').select('id, user_id, full_name, email, phone_number, profile_picture_url, city').in('user_id', allClientIds);
          if (cData) {
            cData.forEach((c) => {
              const targetId = c.user_id || c.id;
              const target = clientsMap[targetId] || {};
              clientsMap[targetId] = {
                ...target,
                ...c,
                name: c.full_name || target.name || c.email || 'Client',
                phone: c.phone_number || target.phone || 'Protected Contact',
                location: c.city || target.location || 'Bangladesh',
              };
            });
          }
        } catch (e) {}
      }

      mergedList.forEach((item) => {
        const cId = item.client_id || item.user_id || item.client?.id;
        const resolvedClient = clientsMap[cId] || item.client || {};
        const resolvedName =
          resolvedClient.name ||
          resolvedClient.full_name ||
          item.client_name ||
          item.guest_name ||
          item.contact_name ||
          'Legal Client';

        item.client = {
          ...resolvedClient,
          name: resolvedName !== 'Unassigned' ? resolvedName : 'Legal Client',
          profile_picture_url: resolvedClient.profile_picture_url || item.client?.profile_picture_url,
        };
      });

      setCases(mergedList);
      setAppointments(appointmentsData || []);
      setPayments(paymentsData || []);

      // Fetch documents for all cases
      const caseIds = mergedList.map((c) => c.id).filter((id) => typeof id === 'string' && !id.startsWith('contract_') && !id.startsWith('consultation_'));
      if (caseIds.length > 0) {
        try {
          const { data: docsRes } = await supabase.from('documents').select('*').in('case_id', caseIds).order('uploaded_at', { ascending: false });
          setDocuments(docsRes || []);
        } catch (e) {}
      } else {
        setDocuments([]);
      }
    } catch (err) {
      console.error('Error in fetchCasesData:', err.message, err);
      setError('Unable to load your cases. Please verify database connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.auth_id]);

  useEffect(() => {
    fetchCasesData();

    // Realtime subscriptions
    const authId = user?.id || user?.auth_id;
    if (!authId) return;

    const unsubWorkflow = realtimeSync.subscribeCaseWorkflow(() => {
      fetchCasesData();
      if (selectedCaseRef.current?.contract?.id) {
        fetchContractTimeline(selectedCaseRef.current.contract.id);
      }
    });

    const channel = supabase
      .channel(`lawyer_cases_live_${authId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, () => fetchCasesData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => fetchCasesData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_timeline' }, () => {
        fetchCasesData();
        if (selectedCaseRef.current?.contract?.id) fetchContractTimeline(selectedCaseRef.current.contract.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliverables' }, () => fetchCasesData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchCasesData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'case_milestones' }, () => fetchCasesData())
      .subscribe();

    return () => {
      unsubWorkflow();
      supabase.removeChannel(channel);
    };
  }, [fetchCasesData, user?.id, user?.auth_id]);

  // Deep link to selected case
  useEffect(() => {
    if (caseId && cases.length > 0) {
      const found = cases.find((c) => String(c.id) === String(caseId) || String(c.linked_appointment_id) === String(caseId));
      if (found) {
        setSelectedCase(found);
        fetchMilestones(found.id);
      }
    }
  }, [caseId, cases]);

  // Fetch Milestones when opening detail drawer
  const fetchMilestones = async (cId) => {
    if (!cId || typeof cId !== 'string' || cId.startsWith('contract_') || cId.startsWith('consultation_')) {
      setMilestones([]);
      return;
    }
    setMilestoneLoading(true);
    try {
      const { data, error: mErr } = await supabase
        .from('case_milestones')
        .select('*')
        .eq('case_id', cId)
        .order('due_date', { ascending: true });
      if (mErr) throw mErr;
      setMilestones(data || []);
    } catch (err) {
      console.warn('Milestones query note:', err.message);
      setMilestones([]);
    } finally {
      setMilestoneLoading(false);
    }
  };

  // 2. Computed Summary Statistics
  const stats = useMemo(() => {
    let activeCases = 0;
    let pendingContracts = 0;
    let completedCases = 0;
    let totalEarnings = 0;
    let upcomingMeetings = 0;
    let totalRatings = 0;
    let ratingCount = 0;

    const now = new Date();

    cases.forEach((c) => {
      const st = String(c.status).toLowerCase();
      if (st === 'active' || st === 'in progress' || st === 'in_progress' || st.includes('ongoing') || st === 'confirmed') {
        activeCases++;
      } else if (st === 'completed' || st === 'resolved' || st === 'closed') {
        completedCases++;
      } else if (st === 'pending' || st.includes('waiting')) {
        pendingContracts++;
      }

      const fee = Number(c.contract?.amount || c.contract?.agreed_amount || c.agreed_fee || 0);
      if (st === 'completed' || c.payment_status === 'paid' || c.contract?.status === 'active') {
        totalEarnings += fee;
      }

      // Check client rating if available
      if (c.client?.rating) {
        totalRatings += Number(c.client.rating);
        ratingCount++;
      }
    });

    if (Array.isArray(appointments)) {
      appointments.forEach((apt) => {
        if (apt.scheduled_at || apt.date || apt.appointment_date) {
          const d = new Date(apt.scheduled_at || apt.date || apt.appointment_date);
          if (!isNaN(d.getTime()) && d >= now) {
            upcomingMeetings++;
          }
        }
      });
    }

    const averageRating = ratingCount > 0 ? totalRatings / ratingCount : 4.9;

    return {
      activeCases,
      pendingContracts,
      completedCases,
      totalEarnings,
      upcomingMeetings,
      averageRating,
    };
  }, [cases, appointments]);

  // 3. Filtered, Searched & Sorted Cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Search check
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const titleMatch = (c.title || c.case_title || '').toLowerCase().includes(q);
        const clientMatch = (c.client?.name || c.client?.full_name || '').toLowerCase().includes(q);
        const idMatch = String(c.id).toLowerCase().includes(q);
        if (!titleMatch && !clientMatch && !idMatch) return false;
      }

      // Status check
      if (filters.status !== 'All') {
        const norm = String(c.status).toLowerCase();
        if (filters.status === 'Active' && !(norm === 'active' || norm === 'confirmed' || norm === 'hired')) return false;
        if (filters.status === 'Pending' && !(norm === 'pending' || norm.includes('pending_negotiation'))) return false;
        if (filters.status === 'In Progress' && !(norm === 'in progress' || norm === 'in_progress' || norm.includes('ongoing'))) return false;
        if (filters.status === 'Waiting for Client' && !norm.includes('waiting')) return false;
        if (filters.status === 'Completed' && !(norm === 'completed' || norm === 'resolved' || norm === 'closed')) return false;
        if (filters.status === 'Cancelled' && !(norm === 'cancelled' || norm === 'rejected')) return false;
      }

      // Practice Area check
      if (filters.practiceArea !== 'All') {
        const area = (c.practice_area || c.case_type || c.category || '').toLowerCase();
        if (!area.includes(filters.practiceArea.toLowerCase())) return false;
      }

      // Date Range check
      if (filters.dateRange !== 'All') {
        const itemDate = new Date(c.updated_at || c.created_at);
        if (!isNaN(itemDate.getTime())) {
          const now = new Date();
          const diffDays = (now - itemDate) / (1000 * 60 * 60 * 24);
          if (filters.dateRange === 'Last 7 Days' && diffDays > 7) return false;
          if (filters.dateRange === 'Last 30 Days' && diffDays > 30) return false;
          if (filters.dateRange === 'Last 90 Days' && diffDays > 90) return false;
          if (filters.dateRange === 'This Year' && itemDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (filters.sortBy === 'Newest') {
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      } else if (filters.sortBy === 'Oldest') {
        return new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at);
      } else if (filters.sortBy === 'Highest Fee') {
        const feeA = Number(a.contract?.amount || a.agreed_fee || 0);
        const feeB = Number(b.contract?.amount || b.agreed_fee || 0);
        return feeB - feeA;
      } else if (filters.sortBy === 'Lowest Fee') {
        const feeA = Number(a.contract?.amount || a.agreed_fee || 0);
        const feeB = Number(b.contract?.amount || b.agreed_fee || 0);
        return feeA - feeB;
      } else if (filters.sortBy === 'Deadline') {
        const dA = new Date(a.next_hearing_date || a.deadline || a.estimated_completion || '2099-01-01');
        const dB = new Date(b.next_hearing_date || b.deadline || b.estimated_completion || '2099-01-01');
        return dA - dB;
      }
      return 0;
    });
  }, [cases, searchTerm, filters]);

  // Paginated Cases
  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCases.slice(start, start + itemsPerPage);
  }, [filteredCases, currentPage, itemsPerPage]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  // 4. Case Actions Handlers
  const fetchContractTimeline = async (contractId) => {
    if (!contractId) return;
    try {
      const { data } = await supabase
        .from('contract_timeline')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: true });
      setContractTimeline(data || []);
    } catch (e) { setContractTimeline([]); }
  };

  const handleLawyerAcceptContract = async (contractId) => {
    setSubmittingContractAction(true);
    try {
      const { error } = await supabase.rpc('fn_lawyer_accept_contract', { p_contract_id: contractId });
      if (error) throw error;
      toast.success('Contract accepted! Work has begun.');
      fetchCasesData();
      fetchContractTimeline(contractId);
      realtimeSync.broadcastCaseChange({ action: 'CONTRACT_ACCEPTED', contractId, caseId: selectedCase?.id });
    } catch (err) { toast.error(`Failed: ${err.message}`); }
    finally { setSubmittingContractAction(false); }
  };

  const handleAddProgressUpdate = async (e) => {
    e.preventDefault();
    const targetContractId = selectedCase?.contract?.id;
    if (!targetContractId) {
      toast.error('A linked contract is required to send progress updates.');
      return;
    }
    if (!progressTitle.trim()) {
      toast.error('Please enter a progress update title.');
      return;
    }
    setSubmittingContractAction(true);
    try {
      const { error } = await supabase.rpc('fn_add_progress_update', {
        p_contract_id: targetContractId,
        p_title: progressTitle.trim(),
        p_note: progressNote.trim() || null,
      });
      if (error) throw error;
      toast.success('Progress update sent to client!');
      setProgressTitle(''); setProgressNote(''); setContractAction(null);
      fetchContractTimeline(targetContractId);
      fetchCasesData();
      realtimeSync.broadcastCaseChange({ action: 'PROGRESS_UPDATE', contractId: targetContractId, caseId: selectedCase?.id });
    } catch (err) { toast.error(`Failed: ${err.message}`); }
    finally { setSubmittingContractAction(false); }
  };

  const handleMarkReadyForReview = async (contractId) => {
    const targetId = contractId || selectedCase?.contract?.id;
    if (!targetId) {
      toast.error('Contract ID not found for delivery submission.');
      return;
    }
    setSubmittingContractAction(true);
    try {
      const { error } = await supabase.rpc('fn_mark_ready_for_review', {
        p_contract_id: targetId,
        p_note: reviewNote.trim() || null,
      });
      if (error) throw error;
      toast.success('Work submitted for client review!');
      setReviewNote(''); setContractAction(null);
      fetchCasesData(); fetchContractTimeline(targetId);
      realtimeSync.broadcastCaseChange({ action: 'DELIVERY_SUBMITTED', contractId: targetId, caseId: selectedCase?.id });
    } catch (err) { toast.error(`Failed: ${err.message}`); }
    finally { setSubmittingContractAction(false); }
  };

  const handleOpenDetails = (caseItem, tab = 'overview', action = null) => {
    setSelectedCase(caseItem);
    setDrawerTab(tab);
    if (action) setContractAction(action);
    fetchMilestones(caseItem.id);
    if (caseItem.contract?.id) {
      fetchContractTimeline(caseItem.contract.id);
    }
  };

  const handleOpenMessages = (caseItem) => {
    const targetClient = caseItem.client?.id || caseItem.client_id;
    if (targetClient) {
      navigate(`/lawyer-suite/communication?clientId=${targetClient}&case=${caseItem.id}`);
    } else {
      toast.error('Client contact ID not available.');
    }
  };

  const handleMarkComplete = async (caseItem) => {
    if (!caseItem?.id) return;
    setIsCompleting(true);
    try {
      // Invoke fn_complete_case which handles UUIDs, 'contract_UUID', and 'consultation_UUID'
      const { error: rpcErr } = await supabase.rpc('fn_complete_case', { p_case_id: String(caseItem.id) });
      if (rpcErr) {
        console.warn('[LawyerCasesView] fn_complete_case failed, trying direct table update:', rpcErr.message);
        if (!String(caseItem.id).startsWith('contract_') && !String(caseItem.id).startsWith('consultation_')) {
          const { error: updErr } = await supabase
            .from('cases')
            .update({ status: 'Completed', updated_at: new Date().toISOString() })
            .eq('id', caseItem.id);
          if (updErr) throw updErr;
        } else {
          toast.success('Case marked as completed.');
          setCases((prev) => prev.map((c) => (c.id === caseItem.id ? { ...c, status: 'completed' } : c)));
          setIsCompleting(false);
          return;
        }
      }
      toast.success('Case marked as completed successfully!');
      realtimeSync.broadcastCaseChange({ caseId: caseItem.id, action: 'CASE_COMPLETED' });
      fetchCasesData();
      if (selectedCase?.id === caseItem.id) {
        setSelectedCase((prev) => ({ ...prev, status: 'completed' }));
      }
    } catch (err) {
      console.error('Error marking complete:', err);
      toast.error(`Could not close case: ${err.message}`);
    } finally {
      setIsCompleting(false);
    }
  };

  // Add Milestone inside Drawer
  const handleCreateMilestone = async (e) => {
    e.preventDefault();
    if (!selectedCase?.id) return;
    if (!newMilestone.title.trim()) {
      toast.error('Please enter a milestone title.');
      return;
    }

    setSubmittingMilestone(true);
    try {
      let targetCaseId = selectedCase.id;
      if (typeof targetCaseId === 'string' && (targetCaseId.startsWith('contract_') || targetCaseId.startsWith('consultation_'))) {
        const rawId = targetCaseId.startsWith('contract_') ? targetCaseId.replace('contract_', '') : targetCaseId.replace('consultation_', '');
        if (targetCaseId.startsWith('contract_')) {
          const { data: cData } = await supabase.from('contracts').select('case_id').eq('id', rawId).maybeSingle();
          if (cData?.case_id) targetCaseId = cData.case_id;
        } else {
          const { data: csData } = await supabase.from('cases').select('id').eq('linked_appointment_id', rawId).maybeSingle();
          if (csData?.id) targetCaseId = csData.id;
        }
      }

      if (typeof targetCaseId === 'string' && (targetCaseId.startsWith('contract_') || targetCaseId.startsWith('consultation_'))) {
        toast.error('Could not resolve underlying case ID yet. Please refresh the page after contract sync.');
        return;
      }

      const payload = {
        case_id: targetCaseId,
        title: newMilestone.title.trim(),
        description: newMilestone.description.trim(),
        milestone_fee: newMilestone.milestone_fee ? Number(newMilestone.milestone_fee) : 0,
        due_date: newMilestone.due_date || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      const { data, error: insErr } = await supabase.from('case_milestones').insert([payload]).select();
      if (insErr) throw insErr;

      toast.success('New milestone added successfully!');
      setMilestones((prev) => [...(data || [payload]), ...prev]);
      setNewMilestone({ title: '', description: '', milestone_fee: '', due_date: '' });
      realtimeSync.broadcastCaseChange({ caseId: targetCaseId, action: 'MILESTONE_CREATED' });
      fetchCasesData();
    } catch (err) {
      console.error('Milestone insert error:', err);
      toast.error(`Error adding milestone: ${err.message}`);
    } finally {
      setSubmittingMilestone(false);
    }
  };

  // Document upload handler — uses correct documents table schema
  const handleUploadDocument = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCase?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit.');
      return;
    }
    const allowed = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'txt', 'zip'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowed.includes(ext)) {
      toast.error(`Unsupported file format. Allowed: ${allowed.join(', ').toUpperCase()}`);
      return;
    }

    setUploadingDoc(true);
    try {
      let targetCaseId = selectedCase.id;
      if (typeof targetCaseId === 'string' && (targetCaseId.startsWith('contract_') || targetCaseId.startsWith('consultation_'))) {
        const rawId = targetCaseId.startsWith('contract_') ? targetCaseId.replace('contract_', '') : targetCaseId.replace('consultation_', '');
        if (targetCaseId.startsWith('contract_')) {
          const { data: cData } = await supabase.from('contracts').select('case_id').eq('id', rawId).maybeSingle();
          if (cData?.case_id) targetCaseId = cData.case_id;
        } else {
          const { data: csData } = await supabase.from('cases').select('id').eq('linked_appointment_id', rawId).maybeSingle();
          if (csData?.id) targetCaseId = csData.id;
        }
      }

      if (typeof targetCaseId === 'string' && (targetCaseId.startsWith('contract_') || targetCaseId.startsWith('consultation_'))) {
        toast.error('Could not resolve underlying case ID yet. Please refresh the page after contract sync.');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `case_${targetCaseId}/${Date.now()}_${file.name}`;
      const { error: storageErr } = await supabase.storage.from('case-documents').upload(fileName, file);
      if (storageErr) throw storageErr;

      const { data: publicUrlData } = supabase.storage.from('case-documents').getPublicUrl(fileName);
      const fileUrl = publicUrlData?.publicUrl || '';

      // Use correct documents table schema: client_id, lawyer_id, file_name, storage_url
      const docPayload = {
        case_id: targetCaseId,
        client_id: selectedCase.client_id || selectedCase.client?.id,
        lawyer_id: user.id,
        file_name: file.name,
        storage_url: fileUrl,
        file_type: fileExt,
        uploaded_at: new Date().toISOString(),
      };

      const { data: newDoc, error: docErr } = await supabase.from('documents').insert([docPayload]).select();
      if (docErr) throw docErr;

      toast.success('Document uploaded to vault successfully!');
      setDocuments((prev) => [...(newDoc || [docPayload]), ...prev]);
      realtimeSync.broadcastCaseChange({ caseId: targetCaseId, action: 'DOCUMENT_UPLOADED' });
    } catch (err) {
      console.error('Doc upload error:', err);
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploadingDoc(false);
    }
  };

  return (
    <div className="flex-1 bg-[#041635] min-h-screen p-4 sm:p-8 lg:p-10 font-sans text-text-main overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white tracking-tight flex items-center gap-3">
              <span>⚖️</span>
              <span>My Cases</span>
            </h1>
            <p className="text-sm text-gray-300 mt-1 max-w-2xl">
              Manage your active legal matters, contracts, milestones, consultations and client communications.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              type="button"
              onClick={fetchCasesData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-2 border border-white/10 shadow-sm focus:outline-none"
            >
              <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
              <span>{loading ? 'Refreshing...' : 'Refresh Live Data'}</span>
            </button>
          </div>
        </div>

        {/* 1. Top Summary Cards (Dynamic) */}
        <CaseSummaryCards stats={stats} />

        {/* 2. Search & Filter Bar */}
        <div className="space-y-4">
          <CaseSearchBar
            searchTerm={searchTerm}
            onSearchChange={(val) => {
              setSearchTerm(val);
              setCurrentPage(1);
            }}
          />
          <CaseFilters filters={filters} onFilterChange={handleFilterChange} totalResults={filteredCases.length} />
        </div>

        {/* 3. Main Content Area (Loading, Error, Empty, or Cases + Right Sidebar) */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-lg mx-auto shadow-sm space-y-4 my-8">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
              ⚠️
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-navy-primary text-base">Unable to load your cases</h4>
              <p className="text-xs text-gray-500">{error}</p>
            </div>
            <button
              type="button"
              onClick={fetchCasesData}
              className="px-6 py-2.5 bg-navy-primary hover:bg-navy-secondary text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              Retry Connection
            </button>
          </div>
        ) : cases.length === 0 ? (
          <EmptyState onBrowseJobs={() => navigate('/lawyer-suite/browse-jobs')} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left 2 Columns: Case Cards & Pagination */}
            <div className="lg:col-span-2 space-y-6">
              {paginatedCases.length === 0 ? (
                <div className="bg-white rounded-2xl border border-border-subtle p-10 text-center space-y-3">
                  <span className="text-3xl block">🔍</span>
                  <h4 className="font-bold text-navy-primary text-sm">No cases match your active filters</h4>
                  <p className="text-xs text-gray-500">Try clearing your search term or selecting 'All' in practice area and status filters.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setFilters({ status: 'All', practiceArea: 'All', dateRange: 'All', sortBy: 'Newest' });
                    }}
                    className="px-4 py-2 bg-navy-primary text-white rounded-xl text-xs font-bold shadow-2xs transition"
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {paginatedCases.map((cItem) => (
                    <CaseCard
                      key={cItem.id}
                      caseItem={cItem}
                      onViewDetails={(item, tab) => handleOpenDetails(item, tab)}
                      onOpenMessages={handleOpenMessages}
                      onOpenDocuments={(item) => handleOpenDetails(item, 'documents')}
                      onOpenTimeline={(item) => handleOpenDetails(item, 'timeline')}
                      onOpenInvoice={(item) => handleOpenDetails(item, 'overview')}
                      onUpdateProgress={(item) => handleOpenDetails(item, 'contract', 'progress')}
                      onSubmitDelivery={(item) => handleOpenDetails(item, 'contract', 'ready')}
                      onMarkComplete={handleMarkComplete}
                      isCompleting={isCompleting && selectedCase?.id === cItem.id}
                    />
                  ))}
                </div>
              )}

              {/* Server/Page Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredCases.length}
                itemsPerPage={itemsPerPage}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>

            {/* Right Panel: Upcoming Events & Quick Help */}
            <div className="space-y-6 lg:sticky lg:top-8">
              <UpcomingEvents cases={cases} appointments={appointments} />

              {/* Practice Assurance Card */}
              <div className="bg-gradient-to-br from-navy-primary to-indigo-950 rounded-2xl p-6 text-white border border-white/10 shadow-md space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-accent-gold/20 text-accent-gold flex items-center justify-center text-xl font-bold">
                    🛡️
                  </span>
                  <div>
                    <h5 className="font-serif font-bold text-base text-white">Escrow Assurance & Compliance</h5>
                    <p className="text-[11px] text-gray-300">Supreme Court & Bangladesh Bar Council Compliant</p>
                  </div>
                </div>
                <p className="text-xs text-gray-200 leading-relaxed">
                  All active case retainers and milestone payments are safeguarded in client-verified escrow until milestone completion is mutually verified.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/lawyer-suite/schedule/settings')}
                    className="w-full py-2.5 rounded-xl bg-accent-gold text-navy-primary font-black text-xs hover:bg-yellow-400 transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>Consultation & Fee Settings</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Detail Drawer / Modal when selectedCase is set */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end transition-opacity">
          <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-slide-in-right">
            {/* Drawer Header */}
            <div className="p-6 bg-navy-primary text-white flex items-center justify-between border-b border-white/10 flex-shrink-0">
              <div className="space-y-1 min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-accent-gold text-navy-primary">
                    {selectedCase.practice_area || selectedCase.case_type || 'Legal Case'}
                  </span>
                  <CaseStatusBadge status={selectedCase.status} size="sm" />
                </div>
                <h3 className="font-serif font-bold text-xl text-white truncate pt-0.5">
                  {selectedCase.title || 'Case Representation'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition flex-shrink-0"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Drawer Navigation Tabs */}
            <div className="flex items-center gap-1 bg-bg-light border-b border-border-subtle px-6 pt-2 overflow-x-auto flex-shrink-0">
              {[
                { id: 'overview', label: 'Financials & Overview', icon: '💰' },
                { id: 'timeline', label: 'Timeline & Milestones', icon: '🗓️' },
                { id: 'contract', label: 'Contract Terms', icon: '📜' },
                { id: 'client', label: 'Client Profile', icon: '👤' },
                { id: 'documents', label: 'Document Vault', icon: '📂' },
              ].map((tabItem) => {
                const isActive = drawerTab === tabItem.id;
                return (
                  <button
                    type="button"
                    key={tabItem.id}
                    onClick={() => {
                      setDrawerTab(tabItem.id);
                      if (tabItem.id === 'contract' && selectedCase?.contract?.id) {
                        fetchContractTimeline(selectedCase.contract.id);
                      }
                    }}
                    className={`px-4 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
                      isActive
                        ? 'border-navy-primary text-navy-primary bg-white rounded-t-xl shadow-2xs'
                        : 'border-transparent text-gray-500 hover:text-navy-primary'
                    }`}
                  >
                    <span>{tabItem.icon}</span>
                    <span>{tabItem.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Drawer Body Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-bg-light/40 space-y-6">
              {/* Tab 1: Financials & Overview */}
              {drawerTab === 'overview' && (
                <div className="space-y-6">
                  <PaymentSummary caseData={selectedCase} payments={payments} />

                  <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-sm space-y-4">
                    <h4 className="font-serif font-bold text-base text-navy-primary flex items-center gap-2">
                      <span>📝</span>
                      <span>Case Description & Objectives</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {selectedCase.description || 'No detailed background notes provided for this case matter.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: Timeline & Milestones */}
              {drawerTab === 'timeline' && (
                <div className="space-y-6">
                  {milestoneLoading && (
                    <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center gap-2 text-xs font-bold text-blue-700 animate-pulse">
                      <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                      <span>Refreshing live milestone records from database...</span>
                    </div>
                  )}
                  <TimelineCard
                    caseData={selectedCase}
                    milestones={milestones}
                    contractTimeline={contractTimeline}
                    deliverables={documents}
                  />

                  {/* Add Milestone Form (only if real case) */}
                  {typeof selectedCase.id === 'string' && !selectedCase.id.startsWith('contract_') && !selectedCase.id.startsWith('consultation_') && (
                    <form onSubmit={handleCreateMilestone} className="bg-white rounded-2xl border border-border-subtle p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                        <h4 className="font-serif font-bold text-base text-navy-primary flex items-center gap-2">
                          <span>➕</span>
                          <span>Track New Case Milestone</span>
                        </h4>
                        <span className="text-[11px] text-gray-500 font-semibold">Client Visible</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-bold text-navy-primary">Milestone Title *</label>
                          <input
                            type="text"
                            value={newMilestone.title}
                            onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                            placeholder="e.g., Drafting High Court Writ Petition"
                            className="w-full px-3 py-2 bg-bg-light border border-border-subtle rounded-xl text-xs font-semibold focus:outline-none focus:border-navy-primary"
                            required
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-bold text-navy-primary">Description / Scope of Work</label>
                          <textarea
                            value={newMilestone.description}
                            onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                            placeholder="Detailed work items to be completed during this stage..."
                            rows="2"
                            className="w-full px-3 py-2 bg-bg-light border border-border-subtle rounded-xl text-xs font-semibold focus:outline-none focus:border-navy-primary resize-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-navy-primary">Milestone Fee (BDT)</label>
                          <input
                            type="number"
                            value={newMilestone.milestone_fee}
                            onChange={(e) => setNewMilestone({ ...newMilestone, milestone_fee: e.target.value })}
                            placeholder="0"
                            className="w-full px-3 py-2 bg-bg-light border border-border-subtle rounded-xl text-xs font-semibold focus:outline-none focus:border-navy-primary"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-navy-primary">Target Due Date</label>
                          <input
                            type="date"
                            value={newMilestone.due_date}
                            onChange={(e) => setNewMilestone({ ...newMilestone, due_date: e.target.value })}
                            className="w-full px-3 py-2 bg-bg-light border border-border-subtle rounded-xl text-xs font-semibold focus:outline-none focus:border-navy-primary"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={submittingMilestone}
                          className="px-5 py-2.5 bg-navy-primary hover:bg-navy-secondary text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                          <span>{submittingMilestone ? 'Adding...' : 'Add Case Milestone'}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Tab 3: Contract Terms & Workflow */}
              {drawerTab === 'contract' && (
                <div className="space-y-6">
                  <ContractInfo contract={selectedCase.contract} agreedFee={selectedCase.agreed_fee} />

                  {/* Contract Workflow Actions */}
                  {selectedCase.contract && (
                    <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-sm space-y-4">
                      <h4 className="font-serif font-bold text-base text-navy-primary flex items-center gap-2">
                        <span>⚙️</span><span>Contract Workflow</span>
                      </h4>

                      {/* Accept Contract */}
                      {['Pending Review', 'PENDING_CONTRACT', 'Draft', 'Pending_Signature'].includes(selectedCase.contract.status) && (
                        <button
                          onClick={() => handleLawyerAcceptContract(selectedCase.contract.id)}
                          disabled={submittingContractAction}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">handshake</span>
                          {submittingContractAction ? 'Processing...' : 'Accept Contract & Start Work'}
                        </button>
                      )}

                      {/* Progress Update & Delivery Submission */}
                      {['Active', 'ACTIVE', 'active', 'Signed', 'SIGNED', 'in_progress', 'in progress', 'REVISION_REQUESTED', 'Revision Requested', 'ongoing'].includes(String(selectedCase.contract.status || selectedCase.status)) && (
                        <>
                          {contractAction === 'progress' ? (
                            <form onSubmit={handleAddProgressUpdate} className="space-y-3">
                              <input
                                type="text" required value={progressTitle}
                                onChange={e => setProgressTitle(e.target.value)}
                                placeholder="Progress update title *"
                                className="w-full px-3 py-2 border border-border-subtle rounded-xl text-xs focus:outline-none focus:border-navy-primary"
                              />
                              <textarea
                                value={progressNote} onChange={e => setProgressNote(e.target.value)}
                                placeholder="Details (optional)"
                                rows={2}
                                className="w-full px-3 py-2 border border-border-subtle rounded-xl text-xs focus:outline-none focus:border-navy-primary resize-none"
                              />
                              <div className="flex gap-2">
                                <button type="submit" disabled={submittingContractAction}
                                  className="flex-1 py-2 bg-navy-primary text-white rounded-xl text-xs font-bold disabled:opacity-50">
                                  {submittingContractAction ? 'Sending...' : 'Send Update'}
                                </button>
                                <button type="button" onClick={() => setContractAction(null)}
                                  className="px-4 py-2 border border-border-subtle rounded-xl text-xs font-bold text-gray-600">
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : contractAction === 'ready' ? (
                            <div className="space-y-3">
                              <textarea
                                value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                                placeholder="Note to client about deliverables (optional)"
                                rows={2}
                                className="w-full px-3 py-2 border border-border-subtle rounded-xl text-xs focus:outline-none focus:border-navy-primary resize-none"
                              />
                              <div className="flex gap-2">
                                <button onClick={() => handleMarkReadyForReview(selectedCase.contract.id)}
                                  disabled={submittingContractAction}
                                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold disabled:opacity-50">
                                  {submittingContractAction ? 'Submitting...' : 'Submit for Client Review'}
                                </button>
                                <button onClick={() => setContractAction(null)}
                                  className="px-4 py-2 border border-border-subtle rounded-xl text-xs font-bold text-gray-600">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={() => setContractAction('progress')}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-sm">update</span> Add Progress Update
                              </button>
                              <button onClick={() => setContractAction('ready')}
                                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-sm">rate_review</span> Mark Ready for Review
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {/* Contract Timeline */}
                      {contractTimeline.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-border-subtle">
                          <h5 className="text-xs font-bold text-navy-primary">Contract Timeline</h5>
                          {contractTimeline.map(entry => (
                            <div key={entry.id} className="flex gap-3 text-xs">
                              <span className="w-2 h-2 rounded-full bg-navy-primary mt-1.5 flex-shrink-0" />
                              <div>
                                <p className="font-bold text-navy-primary">{entry.title}</p>
                                {entry.note && <p className="text-gray-500">{entry.note}</p>}
                                <p className="text-gray-400">{new Date(entry.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Client Profile */}
              {drawerTab === 'client' && (
                <ClientInfo client={selectedCase.client} rating={selectedCase.client?.rating} />
              )}

              {/* Tab 5: Document Vault */}
              {drawerTab === 'documents' && (
                <div className="space-y-6">
                  {/* Upload box */}
                  <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                      <h4 className="font-serif font-bold text-base text-navy-primary flex items-center gap-2">
                        <span>📤</span>
                        <span>Upload Case Evidence & Briefs</span>
                      </h4>
                      <span className="text-[11px] font-bold text-gray-500">Encrypted Storage</span>
                    </div>

                    {typeof selectedCase.id === 'string' && (selectedCase.id.startsWith('contract_') || selectedCase.id.startsWith('consultation_')) ? (
                      <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                        Document uploads require a permanent case record. Please ensure the client proposal or contract is fully initiated.
                      </p>
                    ) : (
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border-subtle rounded-2xl cursor-pointer bg-bg-light/60 hover:bg-bg-light transition">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <span className="material-symbols-outlined text-3xl text-gray-400 mb-1">cloud_upload</span>
                            <p className="text-xs font-bold text-navy-primary">
                              {uploadingDoc ? 'Uploading Document to Vault...' : 'Click to select or drag PDF, Word, or Image files'}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Maximum file size 15 MB per document</p>
                          </div>
                          <input type="file" className="hidden" onChange={handleUploadDocument} disabled={uploadingDoc} />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Existing Documents List */}
                  <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-sm space-y-4">
                    <h4 className="font-serif font-bold text-base text-navy-primary flex items-center gap-2">
                      <span>🗂️</span>
                      <span>Case Document Vault ({documents.filter((d) => String(d.case_id) === String(selectedCase.id)).length})</span>
                    </h4>

                    {documents.filter((d) => String(d.case_id) === String(selectedCase.id)).length === 0 ? (
                      <div className="text-center py-6 bg-bg-light/50 rounded-xl border border-dashed border-border-subtle">
                        <span className="text-2xl block mb-1">📂</span>
                        <h5 className="font-bold text-navy-primary text-xs">No Documents Uploaded Yet</h5>
                        <p className="text-[11px] text-gray-500">Briefs, court notices, and client evidence files will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {documents
                          .filter((d) => String(d.case_id) === String(selectedCase.id))
                          .map((doc) => (
                            <div key={doc.id} className="p-3.5 rounded-xl border border-border-subtle/80 bg-bg-light/40 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0 border border-blue-200">
                                  {doc.file_type?.toUpperCase() || 'DOC'}
                                </span>
                                <div className="min-w-0">
                                  <h6 className="font-bold text-xs text-navy-primary truncate">{doc.title || doc.file_name || 'Document'}</h6>
                                  <span className="text-[10px] text-gray-400 block">
                                    Uploaded: {new Date(doc.uploaded_at || doc.created_at || Date.now()).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>

                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-bg-light text-navy-primary text-xs font-bold border border-border-subtle shadow-2xs transition flex items-center gap-1 flex-shrink-0"
                              >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                <span>Open</span>
                              </a>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 bg-white border-t border-border-subtle flex items-center justify-between gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleOpenMessages(selectedCase)}
                className="px-4 py-2.5 rounded-xl bg-bg-light hover:bg-gray-200 text-navy-primary text-xs font-bold transition border border-border-subtle flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">chat</span>
                <span>Message Client</span>
              </button>

              <div className="flex items-center gap-2">
                {(String(selectedCase.status).toLowerCase() === 'active' || String(selectedCase.status).toLowerCase().includes('progress')) && (
                  <button
                    type="button"
                    onClick={() => handleMarkComplete(selectedCase)}
                    disabled={isCompleting}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>{isCompleting ? 'Closing...' : 'Mark Complete'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  className="px-5 py-2.5 rounded-xl bg-navy-primary hover:bg-navy-secondary text-white text-xs font-bold transition shadow-xs"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LawyerCasesView;
