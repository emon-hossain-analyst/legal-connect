import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const LawyerProposalsView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [withdrawingId, setWithdrawingId] = useState(null);

  useEffect(() => {
    if (user) {
      fetchMyProposals();
    }
  }, [user]);

  const fetchMyProposals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_proposals')
        .select('*, job:job_posts!job_post_id(*, client:users!client_id(full_name, avatar_url, name, profile_picture_url))')
        .eq('lawyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (err) {
      console.error('Error fetching proposals:', err);
      toast.error('Failed to load your submitted proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (proposalId, jobPostId) => {
    if (!window.confirm('Are you sure you want to withdraw this proposal? You may not be able to re-submit easily.')) {
      return;
    }

    try {
      setWithdrawingId(proposalId);
      const { error } = await supabase
        .from('job_proposals')
        .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Proposal withdrawn.');
      setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'withdrawn' } : p));

      // Decrement proposal count in job post
      if (jobPostId) {
        const target = proposals.find(p => p.id === proposalId);
        if (target && target.job) {
          const newCount = Math.max(0, (target.job.proposals_count || 1) - 1);
          await supabase.from('job_posts').update({ proposals_count: newCount }).eq('id', jobPostId);
        }
      }
    } catch (err) {
      console.error('Error withdrawing proposal:', err);
      toast.error('Failed to withdraw proposal');
    } finally {
      setWithdrawingId(null);
    }
  };

  const filteredProposals = proposals.filter(p => {
    if (filterStatus === 'all') return true;
    return p.status === filterStatus;
  });

  const stats = {
    total: proposals.length,
    pending: proposals.filter(p => p.status === 'pending').length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    rejected: proposals.filter(p => p.status === 'rejected').length
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#F8F9FF] selection:bg-[#fed977] selection:text-[#041635]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#041635] font-display-md">
            My Submitted Proposals
          </h1>
          <p className="text-sm text-[#8393b8] mt-1">
            Track your bids on marketplace cases, view client decisions, and manage active proposals.
          </p>
        </div>
        <Link
          to="/job-board"
          className="bg-[#041635] text-[#fed977] font-bold px-5 py-3 rounded-xl shadow-lg hover:bg-[#1b2b4b] active:scale-95 transition-all flex items-center gap-2 text-sm shrink-0"
        >
          <span className="material-symbols-outlined text-lg">search</span>
          Browse Open Jobs
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#041635]/10 text-[#041635] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">folder_shared</span>
          </div>
          <div>
            <p className="text-xs font-bold text-[#8393b8] uppercase">Total Submitted</p>
            <p className="text-2xl font-extrabold text-[#041635]">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">hourglass_empty</span>
          </div>
          <div>
            <p className="text-xs font-bold text-[#8393b8] uppercase">Pending Review</p>
            <p className="text-2xl font-extrabold text-blue-600">{stats.pending}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          </div>
          <div>
            <p className="text-xs font-bold text-[#8393b8] uppercase">Accepted / Hired</p>
            <p className="text-2xl font-extrabold text-emerald-600">{stats.accepted}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">cancel</span>
          </div>
          <div>
            <p className="text-xs font-bold text-[#8393b8] uppercase">Not Selected</p>
            <p className="text-2xl font-extrabold text-red-600">{stats.rejected}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-gray-200">
        {[
          { id: 'all', label: 'All Proposals', count: stats.total },
          { id: 'pending', label: 'Pending Review', count: stats.pending },
          { id: 'accepted', label: 'Accepted', count: stats.accepted },
          { id: 'rejected', label: 'Not Selected', count: stats.rejected },
          { id: 'withdrawn', label: 'Withdrawn', count: proposals.filter(p => p.status === 'withdrawn').length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              filterStatus === tab.id
                ? 'bg-[#041635] text-white shadow-md'
                : 'bg-white text-[#8393b8] hover:bg-gray-100 hover:text-[#041635]'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              filterStatus === tab.id ? 'bg-[#fed977] text-[#041635]' : 'bg-gray-200 text-gray-700'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Proposals List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
          <div className="w-10 h-10 border-4 border-[#041635] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-bold text-[#8393b8]">Loading your proposals...</p>
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-sm max-w-2xl mx-auto my-12">
          <div className="w-16 h-16 bg-[#F8F9FF] rounded-full flex items-center justify-center mx-auto mb-4 text-[#8393b8]">
            <span className="material-symbols-outlined text-3xl">history_edu</span>
          </div>
          <h3 className="text-xl font-bold text-[#041635] mb-2">No Proposals Found</h3>
          <p className="text-sm text-[#8393b8] max-w-md mx-auto mb-6 leading-relaxed">
            {filterStatus === 'all'
              ? "You haven't submitted any proposals to marketplace cases yet. Browse open cases and apply with tailored bids."
              : `You don't have any proposals with status "${filterStatus}".`}
          </p>
          <Link
            to="/job-board"
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
            const isAnonymous = job.is_anonymous;
            const clientName = isAnonymous ? 'Anonymous Client' : (job.client?.full_name || job.client?.name || 'Client');
            const clientAvatar = isAnonymous ? null : (job.client?.avatar_url || job.client?.profile_picture_url);
            const isUrgent = job.urgency === 'urgent' || job.urgency === 'emergency';
            const isExpanded = expandedId === prop.id;

            return (
              <div
                key={prop.id}
                className={`bg-white rounded-2xl border transition-all shadow-sm overflow-hidden ${
                  prop.status === 'accepted' ? 'border-emerald-400 ring-1 ring-emerald-400' :
                  prop.status === 'rejected' || prop.status === 'withdrawn' ? 'border-gray-200 opacity-70' :
                  'border-gray-200 hover:border-[#041635]/40'
                }`}
              >
                {/* Top Card Bar */}
                <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="bg-[#041635]/10 text-[#041635] px-2.5 py-0.5 rounded-full text-xs font-extrabold">
                        {job.legal_category || 'Legal Case'}
                      </span>
                      {isUrgent && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
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
                      <h3 className="text-lg sm:text-xl font-extrabold text-[#041635] leading-snug">
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

                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                    <span className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                      prop.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                      prop.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      prop.status === 'withdrawn' ? 'bg-gray-100 text-gray-700' :
                      'bg-blue-100 text-blue-800 animate-pulse'
                    }`}>
                      {prop.status === 'accepted' ? '🎉 Accepted & Hired' :
                       prop.status === 'rejected' ? 'Not Selected' :
                       prop.status === 'withdrawn' ? 'Withdrawn' : 'Pending Review'}
                    </span>
                    <span className="text-xs font-bold text-[#041635]">
                      Job Status: <strong className="uppercase text-[#8393b8]">{job.status || 'closed'}</strong>
                    </span>
                  </div>
                </div>

                {/* Proposal Bid Summary Bar */}
                <div className="bg-[#F8F9FF] px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm border-b border-gray-200/80">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[#8393b8] block text-[10px] uppercase font-bold">Your Bid Fee:</span>
                      <span className="font-extrabold text-[#041635] text-base">
                        BDT {Number(prop.proposed_fee).toLocaleString()} <span className="text-xs font-medium text-[#8393b8]">({prop.fee_type})</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8393b8] block text-[10px] uppercase font-bold">Estimated Duration:</span>
                      <span className="font-bold text-[#041635]">
                        {prop.estimated_duration}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : prop.id)}
                    className="text-xs font-bold text-[#041635] hover:text-[#fed977] flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-gray-300 transition-colors"
                  >
                    <span>{isExpanded ? 'Hide Cover Letter' : 'Read Cover Letter'}</span>
                    <span className="material-symbols-outlined text-sm">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                </div>

                {/* Expanded Cover Letter */}
                {isExpanded && (
                  <div className="p-6 bg-white border-b border-gray-100 animate-fadeIn">
                    <h4 className="text-xs font-bold text-[#8393b8] uppercase tracking-wider mb-2">
                      Your Submitted Strategy & Cover Letter:
                    </h4>
                    <p className="text-xs sm:text-sm text-[#041635] bg-[#F8F9FF] p-4 rounded-xl border border-gray-200 leading-relaxed whitespace-pre-line font-normal">
                      {prop.cover_letter}
                    </p>
                  </div>
                )}

                {/* Card Actions Footer */}
                <div className="px-6 py-3 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
                  <Link
                    to={`/jobs/${prop.job_post_id}`}
                    className="font-bold text-[#041635] hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    <span>View Case on Job Board</span>
                  </Link>

                  <div className="flex items-center gap-3">
                    {prop.status === 'accepted' && (
                      <button
                        onClick={() => navigate('/lawyer-suite/communication')}
                        className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
                        <span>Open Client Chat</span>
                      </button>
                    )}

                    {prop.status === 'pending' && job.status === 'open' && (
                      <button
                        onClick={() => handleWithdraw(prop.id, prop.job_post_id)}
                        disabled={withdrawingId === prop.id}
                        className="text-red-600 font-bold hover:bg-red-50 px-3.5 py-1.5 rounded-lg transition-colors border border-red-200 disabled:opacity-50"
                      >
                        {withdrawingId === prop.id ? 'Withdrawing...' : 'Withdraw Proposal'}
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
