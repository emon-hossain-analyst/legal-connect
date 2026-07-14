import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  pending:       { label: 'Pending Review',    bg: 'bg-blue-100 text-blue-800',     pulse: true  },
  shortlisted:   { label: '⭐ Shortlisted',    bg: 'bg-amber-100 text-amber-800',   pulse: false },
  counter_offer: { label: '↔ Counter Offer',   bg: 'bg-purple-100 text-purple-800', pulse: true  },
  accepted:      { label: '🎉 Accepted',        bg: 'bg-emerald-100 text-emerald-800', pulse: false },
  rejected:      { label: 'Not Selected',       bg: 'bg-red-100 text-red-800',       pulse: false },
  withdrawn:     { label: 'Withdrawn',          bg: 'bg-gray-100 text-gray-700',     pulse: false },
  expired:       { label: 'Expired',            bg: 'bg-gray-100 text-gray-500',     pulse: false },
  cancelled:     { label: 'Cancelled',          bg: 'bg-gray-100 text-gray-500',     pulse: false },
};

const FILTER_TABS = [
  { id: 'all',          label: 'All'          },
  { id: 'pending',      label: 'Pending'      },
  { id: 'shortlisted',  label: 'Shortlisted'  },
  { id: 'counter_offer',label: 'Counter Offer'},
  { id: 'accepted',     label: 'Accepted'     },
  { id: 'rejected',     label: 'Not Selected' },
  { id: 'withdrawn',    label: 'Withdrawn'    },
];

const LawyerProposalsView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [withdrawingId, setWithdrawingId] = useState(null);
  const [counterOffers, setCounterOffers] = useState({}); // proposalId → latest offer
  const [respondingId, setRespondingId] = useState(null);

  const fetchMyProposals = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_proposals')
        .select('*')
        .eq('lawyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const raw = data || [];

      if (raw.length > 0) {
        const jobIds = [...new Set(raw.map(p => p.job_post_id).filter(Boolean))];
        let jobMap = {};
        if (jobIds.length > 0) {
          const { data: jobsData } = await supabase
            .from('job_posts')
            .select('*')
            .in('id', jobIds);

          if (jobsData) {
            const clientIds = [...new Set(jobsData.map(j => j.client_id).filter(Boolean))];
            let userMap = {};
            if (clientIds.length > 0) {
              const { data: usersData } = await supabase
                .from('users')
                .select('id, full_name, name, avatar_url, profile_picture_url')
                .in('id', clientIds);
              if (usersData) usersData.forEach(u => { userMap[u.id] = u; });
            }
            jobsData.forEach(j => {
              jobMap[j.id] = { ...j, client: userMap[j.client_id] || { name: 'Client' } };
            });
          }
        }

        // Fetch latest counter-offer per proposal
        const proposalIds = raw.map(p => p.id);
        const { data: offersData } = await supabase
          .from('proposal_counter_offers')
          .select('*')
          .in('proposal_id', proposalIds)
          .order('created_at', { ascending: false });

        const offerMap = {};
        if (offersData) {
          offersData.forEach(o => {
            if (!offerMap[o.proposal_id]) offerMap[o.proposal_id] = o;
          });
        }
        setCounterOffers(offerMap);

        setProposals(raw.map(p => ({ ...p, job: jobMap[p.job_post_id] || null })));
      } else {
        setProposals([]);
      }
    } catch (err) {
      console.error('Error fetching proposals:', err);
      toast.error('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMyProposals();
  }, [fetchMyProposals]);

  // Realtime: listen for proposal status changes
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`lawyer_proposals_rt_${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'job_proposals',
        filter: `lawyer_id=eq.${user.id}`
      }, (payload) => {
        const updated = payload.new;
        setProposals(prev => prev.map(p =>
          p.id === updated.id ? { ...p, ...updated } : p
        ));
        const cfg = STATUS_CONFIG[updated.status];
        if (cfg) {
          const msg = `Proposal status changed to: ${cfg.label}`;
          if (updated.status === 'accepted') toast.success(msg);
          else if (updated.status === 'rejected') toast.error(msg);
          else if (updated.status === 'counter_offer') toast(`↔ ${msg}`, { icon: '💬' });
          else if (updated.status === 'shortlisted') toast.success(msg);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'proposal_counter_offers'
      }, () => {
        fetchMyProposals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchMyProposals]);

  const handleWithdraw = async (proposalId, jobPostId) => {
    if (!window.confirm('Withdraw this proposal? You may not be able to re-submit easily.')) return;
    try {
      setWithdrawingId(proposalId);
      const { error } = await supabase
        .from('job_proposals')
        .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
        .eq('id', proposalId);
      if (error) throw error;
      toast.success('Proposal withdrawn.');
      setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'withdrawn' } : p));
      if (jobPostId) {
        const target = proposals.find(p => p.id === proposalId);
        if (target?.job) {
          await supabase.from('job_posts')
            .update({ proposals_count: Math.max(0, (target.job.proposals_count || 1) - 1) })
            .eq('id', jobPostId);
        }
      }
    } catch (err) {
      toast.error('Failed to withdraw proposal');
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleRespondCounterOffer = async (offerId, accept) => {
    try {
      setRespondingId(offerId);
      const { error } = await supabase.rpc('fn_respond_counter_offer', {
        p_offer_id: offerId,
        p_accept: accept
      });
      if (error) throw error;
      toast.success(accept ? 'Counter offer accepted!' : 'Counter offer rejected.');
      fetchMyProposals();
    } catch (err) {
      toast.error('Failed to respond to counter offer');
    } finally {
      setRespondingId(null);
    }
  };

  const filteredProposals = proposals.filter(p =>
    filterStatus === 'all' || p.status === filterStatus
  );

  const stats = {
    total:        proposals.length,
    pending:      proposals.filter(p => p.status === 'pending').length,
    shortlisted:  proposals.filter(p => p.status === 'shortlisted').length,
    counter_offer:proposals.filter(p => p.status === 'counter_offer').length,
    accepted:     proposals.filter(p => p.status === 'accepted').length,
    rejected:     proposals.filter(p => p.status === 'rejected').length,
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#F8F9FF] selection:bg-[#fed977] selection:text-[#041635]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#041635]">My Submitted Proposals</h1>
          <p className="text-sm text-[#8393b8] mt-1">
            Track bids, respond to counter offers, and manage active proposals in real time.
          </p>
        </div>
        <Link
          to="/jobs"
          className="bg-[#041635] text-[#fed977] font-bold px-5 py-3 rounded-xl shadow-lg hover:bg-[#1b2b4b] active:scale-95 transition-all flex items-center gap-2 text-sm shrink-0"
        >
          <span className="material-symbols-outlined text-lg">search</span>
          Browse Open Jobs
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: 'Total',        value: stats.total,         icon: 'folder_shared',  color: 'text-[#041635] bg-[#041635]/10' },
          { label: 'Pending',      value: stats.pending,       icon: 'hourglass_empty',color: 'text-blue-600 bg-blue-500/10' },
          { label: 'Shortlisted',  value: stats.shortlisted,   icon: 'star',           color: 'text-amber-600 bg-amber-500/10' },
          { label: 'Counter Offer',value: stats.counter_offer, icon: 'swap_horiz',     color: 'text-purple-600 bg-purple-500/10' },
          { label: 'Accepted',     value: stats.accepted,      icon: 'verified',       color: 'text-emerald-600 bg-emerald-500/10' },
          { label: 'Not Selected', value: stats.rejected,      icon: 'cancel',         color: 'text-red-600 bg-red-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#8393b8] uppercase leading-none">{s.label}</p>
              <p className="text-xl font-extrabold text-[#041635]">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-gray-200">
        {FILTER_TABS.map(tab => {
          const count = tab.id === 'all' ? stats.total : proposals.filter(p => p.status === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                filterStatus === tab.id
                  ? 'bg-[#041635] text-white shadow-md'
                  : 'bg-white text-[#8393b8] hover:bg-gray-100 hover:text-[#041635]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                filterStatus === tab.id ? 'bg-[#fed977] text-[#041635]' : 'bg-gray-200 text-gray-700'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
          <div className="w-10 h-10 border-4 border-[#041635] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-bold text-[#8393b8]">Loading proposals...</p>
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-sm max-w-2xl mx-auto my-12">
          <span className="material-symbols-outlined text-3xl text-[#8393b8] mb-4 block">history_edu</span>
          <h3 className="text-xl font-bold text-[#041635] mb-2">No Proposals Found</h3>
          <p className="text-sm text-[#8393b8] max-w-md mx-auto mb-6 leading-relaxed">
            {filterStatus === 'all'
              ? "You haven't submitted any proposals yet. Browse open cases and apply."
              : `No proposals with status "${filterStatus}".`}
          </p>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 bg-[#041635] text-[#fed977] font-bold px-6 py-3.5 rounded-xl shadow-md hover:bg-[#1b2b4b] transition-all text-sm"
          >
            <span className="material-symbols-outlined text-lg">work</span>
            Explore Marketplace Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((prop) => {
            const job = prop.job || {};
            const isUrgent = job.urgency === 'urgent' || job.urgency === 'emergency';
            const isExpanded = expandedId === prop.id;
            const cfg = STATUS_CONFIG[prop.status] || STATUS_CONFIG.pending;
            const clientName = job.is_anonymous ? 'Anonymous Client' : (job.client?.full_name || job.client?.name || 'Client');
            const latestOffer = counterOffers[prop.id];
            const isActive = !['rejected', 'withdrawn', 'expired', 'cancelled'].includes(prop.status);

            return (
              <div
                key={prop.id}
                className={`bg-white rounded-2xl border transition-all shadow-sm overflow-hidden ${
                  prop.status === 'accepted'      ? 'border-emerald-400 ring-1 ring-emerald-400' :
                  prop.status === 'shortlisted'   ? 'border-amber-400 ring-1 ring-amber-300' :
                  prop.status === 'counter_offer' ? 'border-purple-400 ring-1 ring-purple-300' :
                  !isActive                       ? 'border-gray-200 opacity-70' :
                  'border-gray-200 hover:border-[#041635]/40'
                }`}
              >
                {/* Top Bar */}
                <div className="p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="bg-[#041635]/10 text-[#041635] px-2.5 py-0.5 rounded-full text-xs font-extrabold">
                        {job.legal_category || 'Legal Case'}
                      </span>
                      {isUrgent && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase flex items-center gap-1 ${
                          job.urgency === 'emergency' ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-500 text-white'
                        }`}>
                          <span className="material-symbols-outlined text-[12px]">bolt</span>
                          {job.urgency}
                        </span>
                      )}
                      <span className="text-xs text-[#8393b8]">
                        Submitted {new Date(prop.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Link to={`/jobs/${prop.job_post_id}`} className="hover:text-[#041635] transition-colors">
                      <h3 className="text-lg sm:text-xl font-extrabold text-[#041635] leading-snug truncate">
                        {job.title || 'Closed / Deleted Case'}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[#8393b8]">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">person</span>
                        {clientName}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        {job.city || job.location || 'Bangladesh'}
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0">
                    <span className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${cfg.bg} ${cfg.pulse ? 'animate-pulse' : ''}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs font-bold text-[#8393b8]">
                      Job: <strong className="uppercase text-[#041635]">{job.status || 'closed'}</strong>
                    </span>
                  </div>
                </div>

                {/* Bid Summary */}
                <div className="bg-[#F8F9FF] px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm border-b border-gray-200/80">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[#8393b8] block text-[10px] uppercase font-bold">Your Bid:</span>
                      <span className="font-extrabold text-[#041635] text-base">
                        BDT {Number(prop.proposed_fee).toLocaleString()}
                        <span className="text-xs font-medium text-[#8393b8] ml-1">({prop.fee_type})</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8393b8] block text-[10px] uppercase font-bold">Duration:</span>
                      <span className="font-bold text-[#041635]">{prop.estimated_duration}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : prop.id)}
                    className="text-xs font-bold text-[#041635] hover:text-[#fed977] flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-gray-300 transition-colors"
                  >
                    <span>{isExpanded ? 'Hide Cover Letter' : 'Read Cover Letter'}</span>
                    <span className="material-symbols-outlined text-sm">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                  </button>
                </div>

                {/* Cover Letter */}
                {isExpanded && (
                  <div className="p-6 bg-white border-b border-gray-100">
                    <h4 className="text-xs font-bold text-[#8393b8] uppercase tracking-wider mb-2">Cover Letter:</h4>
                    <p className="text-xs sm:text-sm text-[#041635] bg-[#F8F9FF] p-4 rounded-xl border border-gray-200 leading-relaxed whitespace-pre-line">
                      {prop.cover_letter}
                    </p>
                  </div>
                )}

                {/* Counter Offer Panel */}
                {prop.status === 'counter_offer' && latestOffer && latestOffer.status === 'pending' && (
                  <div className="p-5 bg-purple-50 border-b border-purple-200">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-1">Counter Offer Received</p>
                        <p className="text-lg font-extrabold text-purple-900">
                          BDT {Number(latestOffer.amount).toLocaleString()}
                        </p>
                        {latestOffer.note && (
                          <p className="text-xs text-purple-700 mt-1 italic">"{latestOffer.note}"</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRespondCounterOffer(latestOffer.id, true)}
                          disabled={respondingId === latestOffer.id}
                          className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          Accept BDT {Number(latestOffer.amount).toLocaleString()}
                        </button>
                        <button
                          onClick={() => handleRespondCounterOffer(latestOffer.id, false)}
                          disabled={respondingId === latestOffer.id}
                          className="border border-red-300 text-red-600 font-bold px-4 py-2 rounded-xl text-xs hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="px-6 py-3 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
                  <Link
                    to={`/jobs/${prop.job_post_id}`}
                    className="font-bold text-[#041635] hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    View Case
                  </Link>

                  <div className="flex items-center gap-3">
                    {/* Message client about this proposal */}
                    {isActive && job.client && !job.is_anonymous && (
                      <button
                        onClick={() => navigate(`/lawyer-suite/communication?clientId=${job.client_id || job.client?.id}`)}
                        className="text-[#041635] font-bold hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
                        Message Client
                      </button>
                    )}

                    {prop.status === 'accepted' && (
                      <button
                        onClick={() => navigate('/lawyer-suite/communication')}
                        className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
                        Open Client Chat
                      </button>
                    )}

                    {['pending', 'shortlisted'].includes(prop.status) && job.status === 'open' && (
                      <button
                        onClick={() => handleWithdraw(prop.id, prop.job_post_id)}
                        disabled={withdrawingId === prop.id}
                        className="text-red-600 font-bold hover:bg-red-50 px-3.5 py-1.5 rounded-lg transition-colors border border-red-200 disabled:opacity-50"
                      >
                        {withdrawingId === prop.id ? 'Withdrawing...' : 'Withdraw'}
                      </button>
                    )}
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

export default LawyerProposalsView;
