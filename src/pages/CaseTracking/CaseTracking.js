import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { SkeletonCard } from '../../components/Skeleton/Skeleton';
import toast from 'react-hot-toast';
import styles from './CaseTracking.module.css';

const STATUS_COLORS = {
  active:    '#0F2A5E',
  on_hold:   '#C8920A',
  closed:    '#1E6B4A',
  archived:  '#6B7280',
};

const STATUS_LABELS = {
  active:   'In Progress',
  on_hold:  'On Hold',
  closed:   'Completed',
  archived: 'Archived',
};

const CaseTracking = ({ inline = false }) => {
  const { user } = useAuth();
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      if (!user) return;
      try {
        const currentUserId = user?.id;
        if (!currentUserId) {
          setCases([]);
          setLoading(false);
          return;
        }

        const { data: casesData, error } = await supabase
          .from('cases')
          .select('*, lawyer:users!cases_lawyer_id_fkey(id, name, profile_picture_url), case_progress(*)')
          .or(`client_id.eq.${currentUserId},lawyer_id.eq.${currentUserId}`)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        
        let casesList = casesData || [];
        if (casesList.length > 0) {
          const caseIds = casesList.map(c => c.id);
          const { data: msData } = await supabase.from('case_milestones').select('*').in('case_id', caseIds);
          if (msData) {
            casesList = casesList.map(c => ({
              ...c,
              milestones: msData.filter(m => m.case_id === c.id)
            }));
          }
        }

        const { data: cData } = await supabase
          .from('contracts')
          .select('*, lawyer:users!contracts_lawyer_id_fkey(id, name, profile_picture_url)')
          .eq('client_id', currentUserId)
          .order('created_at', { ascending: false });
        if (cData) setContracts(cData);

        const { data: aptData } = await supabase
          .from('appointments')
          .select('*, lawyer:users!appointments_lawyer_id_fkey(id, name, profile_picture_url)')
          .eq('client_id', currentUserId)
          .in('status', ['confirmed', 'active', 'Upcoming', 'In Progress', 'pending_negotiation']);

        const mergedMap = new Map();
        casesList.forEach(c => mergedMap.set(String(c.id), c));

        if (cData) {
          cData.forEach(cnt => {
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
                lawyer: cnt.lawyer,
                lawyer_id: cnt.lawyer_id,
                client_id: cnt.client_id,
                contract: cnt,
                agreed_fee: cnt.amount || cnt.agreed_amount,
                outstanding_balance: cnt.outstanding_balance,
                updated_at: cnt.updated_at || cnt.created_at
              });
            }
          });
        }

        if (aptData) {
          aptData.forEach(apt => {
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
                lawyer: apt.lawyer,
                lawyer_id: apt.lawyer_id,
                client_id: apt.client_id,
                agreed_fee: apt.agreed_fee || apt.fee_amount,
                updated_at: apt.updated_at || apt.created_at
              });
            }
          });
        }

        setCases(Array.from(mergedMap.values()));

      } catch (err) {
        console.error('Error fetching cases:', err.message, err.code, err);
        setCases([]);
        setContracts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, [user]);

  const handleContractAction = async (contractId, action) => {
    try {
      const newStatus = action === 'accept' ? 'Active' : action === 'decline' ? 'Terminated' : 'Negotiation Requested';
      const { error } = await supabase
        .from('contracts')
        .update({ status: newStatus, ...(action === 'accept' ? { fee_locked: true } : {}) })
        .eq('id', contractId);
      if (error) throw error;
      toast.success(`Contract ${action === 'accept' ? 'Accepted! Retainer payment initialized.' : newStatus}`);
      setContracts(prev => prev.map(c => c.id === contractId ? { ...c, status: newStatus } : c));
    } catch (err) {
      toast.error('Failed to update contract status');
    }
  };

  if (loading) {
    return (
      <div className={styles.caseTracking}>
        <div className={styles.header}>
          <h1>Case Tracking</h1>
          <p>Monitor the progress of your legal cases</p>
        </div>
        <div className={styles.casesGrid}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.caseTracking}>
      <div className={styles.header}>
        <h1>Case & Contract Tracking</h1>
        <p>Monitor the progress of your legal representations and review pending contracts</p>
      </div>

      {contracts.filter(c => c.status === 'Pending Review').length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0F2A5E', marginBottom: '12px' }}>Action Required: Pending Legal Contracts</h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            {contracts.filter(c => c.status === 'Pending Review').map(contract => (
              <div key={contract.id} style={{ background: '#fff8e1', border: '1px solid #ffe08f', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0F2A5E', margin: 0 }}>{contract.title}</h3>
                    <p style={{ fontSize: '13px', color: '#4B5563', margin: '4px 0' }}>Lawyer: Adv. {contract.lawyer?.name || 'Assigned Council'}</p>
                  </div>
                  <span style={{ background: '#f57f17', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>Pending Review</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'white', padding: '12px', borderRadius: '6px', margin: '12px 0', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#6B7280', display: 'block' }}>Fee Structure</span>
                    <strong style={{ color: '#111827' }}>{contract.fee_structure || 'Fixed Fee'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6B7280', display: 'block' }}>Total Fee</span>
                    <strong style={{ color: '#0F2A5E' }}>BDT {Number(contract.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6B7280', display: 'block' }}>Retainer Due</span>
                    <strong style={{ color: '#c5221f' }}>BDT {Number(contract.retainer_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button onClick={() => handleContractAction(contract.id, 'negotiate')} style={{ padding: '6px 14px', border: '1px solid #D97706', color: '#D97706', background: 'white', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Request Changes</button>
                  <button onClick={() => handleContractAction(contract.id, 'decline')} style={{ padding: '6px 14px', border: '1px solid #EF4444', color: '#EF4444', background: 'white', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Decline</button>
                  <button onClick={() => handleContractAction(contract.id, 'accept')} style={{ padding: '6px 16px', background: '#0F2A5E', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Accept Contract & Pay Retainer</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cases.length === 0 ? (
        <div className={styles.noCases}>
          <h3>No cases found</h3>
          <p>You don't have any active cases at the moment.</p>
        </div>
      ) : (
        <div className={styles.casesGrid}>
          {cases.map((c) => {
            const ms = c.milestones || [];
            const approvedCount = ms.filter(m => m.status === 'approved').length;
            const totalCount = ms.length || ((c.case_progress?.length || 0) + 2);
            const completedCount = ms.length > 0 ? approvedCount : (c.case_progress?.length || 0);
            const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            const latestMilestone = ms.length > 0
              ? ms.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
              : (c.case_progress && c.case_progress.length > 0
                ? c.case_progress.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
                : null);
            
            const isHighlighted = caseId && (String(c.id) === String(caseId) || String(c.linked_appointment_id) === String(caseId));
            return (
              <div key={c.id} className={styles.caseCard} style={isHighlighted ? { border: '2px solid #D97706', boxShadow: '0 0 12px rgba(217,119,6,0.3)' } : {}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {c.case_type || 'Full Representation'}
                  </span>
                  <span
                    className={styles.status}
                    style={{ backgroundColor: STATUS_COLORS[c.status] || '#6B7280' }}
                  >
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
                </div>
                <div className={styles.caseHeader}>
                  <h3>{c.title}</h3>
                </div>
                {c.lawyer && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <img src={c.lawyer.profile_picture_url || 'https://via.placeholder.com/32'} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontSize: '13px', color: '#1F2937', fontWeight: '500' }}>Adv. {c.lawyer.name}</span>
                  </div>
                )}
                <p className={styles.description}>{c.description}</p>
                
                {c.agreed_fee > 0 && (
                  <div style={{ background: '#F9FAFB', padding: '8px 12px', borderRadius: '6px', margin: '8px 0', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#4B5563' }}>Agreed Fee / Balance:</span>
                    <strong style={{ color: '#0F2A5E' }}>BDT {Number(c.agreed_fee || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}

                {/* Milestone Progress Bar */}
                <div style={{ margin: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#4B5563', marginBottom: '4px', fontWeight: 'bold' }}>
                    <span>Progress ({completedCount}/{totalCount} milestones)</span>
                    <span>{percent}%</span>
                  </div>
                  <div style={{ height: '6px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: '#0F2A5E', transition: 'width 0.5s ease' }} />
                  </div>
                </div>

                {latestMilestone && (
                  <p className={styles.milestone}>
                    Latest: {latestMilestone.title} {latestMilestone.status ? `(${latestMilestone.status})` : ''}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #E5E7EB' }}>
                  <span style={{ fontSize: '11px', color: '#6B7280' }}>Updated: {new Date(c.updated_at).toLocaleDateString()}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => navigate(`/client/portal/cases/${c.id}`)} style={{ padding: '6px 12px', border: '1px solid #0F2A5E', color: '#0F2A5E', background: 'white', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>View Details</button>
                    <button onClick={() => navigate('/client/portal/messages')} style={{ padding: '6px 12px', background: '#0F2A5E', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Open Messages</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CaseTracking;
