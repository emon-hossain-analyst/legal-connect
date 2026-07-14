import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const ClientMyPosts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [lawyerProfiles, setLawyerProfiles] = useState({});
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Change request modal state
  const [changeRequestModal, setChangeRequestModal] = useState(null); // { type: 'proposal'|'contract', id, contractId }
  const [changeNote, setChangeNote] = useState('');

  const clientId = user?.id || user?.auth_id;

  const fetchMyPosts = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    try {
      setLoading(true);
      // Fixed: single .eq() instead of duplicate .or()
      const { data, error } = await supabase
        .from('job_posts')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const fetched = data || [];
      setPosts(fetched);
      if (fetched.length > 0) {
        setSelectedPost(prev => prev ? (fetched.find(p => p.id === prev.id) || fetched[0]) : fetched[0]);
      } else {
        setSelectedPost(null);
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
      toast.error('Failed to load your cases');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const fetchProposals = useCallback(async (jobPostId) => {
    if (!jobPostId) return;
    try {
      setLoadingProposals(true);
      const { data, error } = await supabase
        .from('job_proposals')
        .select('*')
        .eq('job_post_id', jobPostId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const raw = data || [];

      if (raw.length > 0) {
        const lawyerIds = [...new Set(raw.map(p => p.lawyer_id).filter(Boolean))];
        let userMap = {};
        try {
          const { data: uData } = await supabase
            .from('users')
            .select('id, full_name, name, avatar_url, profile_picture_url, email')
            .in('id', lawyerIds);
          if (uData) uData.forEach(u => { userMap[u.id] = u; });
        } catch (e) {}

        let profMap = {};
        try {
          const { data: pData } = await supabase
            .from('lawyers')
            .select('user_id, specialization, experience_years, verification_status, rating, is_verified')
            .in('user_id', lawyerIds);
          if (pData) {
            pData.forEach(p => { profMap[p.user_id] = p; });
            setLawyerProfiles(profMap);
          }
        } catch (e) {}

        setProposals(raw.map(p => ({
          ...p,
          lawyer: userMap[p.lawyer_id] || { name: 'Legal Counsel' }
        })));
      } else {
        setProposals([]);
      }
    } catch (err) {
      console.error('Error fetching proposals:', err);
      toast.error('Failed to load proposals');
    } finally {
      setLoadingProposals(false);
    }
  }, []);

  useEffect(() => {
    fetchMyPosts();
  }, [fetchMyPosts]);

  useEffect(() => {
    if (selectedPost?.id) fetchProposals(selectedPost.id);
  }, [selectedPost?.id, fetchProposals]);

  // Realtime: refresh when job_posts or job_proposals change
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`client_posts_rt_${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_posts' }, fetchMyPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_proposals' }, () => {
        if (selectedPost?.id) fetchProposals(selectedPost.id);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [clientId, fetchMyPosts, fetchProposals, selectedPost?.id]);

  const handleAcceptProposal = async (proposal) => {
    if (!window.confirm(`Accept ${proposal.lawyer?.full_name || proposal.lawyer?.name || 'this lawyer'}'s proposal?\n\nThis will create a case workspace and close the job to new proposals.`)) return;
    try {
      setProcessingId(proposal.id);
      const { error } = await supabase.rpc('fn_accept_job_proposal_transactional', {
        p_proposal_id: Number(proposal.id),
        p_client_id: clientId
      });
      if (error) {
        // Fallback
        const { error: fb } = await supabase
          .from('job_proposals')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', proposal.id);
        if (fb) throw fb;
      }
      toast.success('Proposal accepted! Case workspace created.');
      await fetchMyPosts();
      await fetchProposals(selectedPost.id);
    } catch (err) {
      toast.error('Failed to accept proposal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineProposal = async (proposalId) => {
    if (!window.confirm('Decline this proposal?')) return;
    try {
      setProcessingId(proposalId);
      const { error } = await supabase
        .from('job_proposals')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', proposalId);
      if (error) throw error;
      toast.success('Proposal declined.');
      setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'rejected' } : p));
    } catch (err) {
      toast.error('Failed to decline proposal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRequestChanges = async () => {
    if (!changeNote.trim()) { toast.error('Please describe the changes needed.'); return; }
    const modal = changeRequestModal;
    try {
      setProcessingId(modal.id);
      if (modal.type === 'proposal') {
        // For proposals: add a note and keep pending (or use a custom status)
        const { error } = await supabase
          .from('job_proposals')
          .update({ status: 'pending', cover_letter: (modal.originalCoverLetter || '') + '\n\n[Client requested changes: ' + changeNote + ']', updated_at: new Date().toISOString() })
          .eq('id', modal.id);
        if (error) throw error;
        toast.success('Change request sent to lawyer.');
      } else if (modal.type === 'contract') {
        const { error } = await supabase.rpc('fn_request_contract_changes', {
          p_contract_id: modal.contractId,
          p_note: changeNote
        });
        if (error) throw error;
        toast.success('Contract change request sent.');
        await fetchMyPosts();
        if (selectedPost?.id) await fetchProposals(selectedPost.id);
      }
      setChangeRequestModal(null);
      setChangeNote('');
    } catch (err) {
      toast.error('Failed to send change request: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeletePost = async (jobId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this case post? All associated proposals will be removed.')) return;
    try {
      const { error } = await supabase.from('job_posts').delete().eq('id', jobId);
      if (error) throw error;
      toast.success('Case post deleted.');
      const remaining = posts.filter(p => p.id !== jobId);
      setPosts(remaining);
      setSelectedPost(remaining.length > 0 ? remaining[0] : null);
    } catch (err) {
      toast.error('Failed to delete post');
    }
  };

  const getStatusColor = (status) => {
    const map = { open: 'bg-emerald-100 text-emerald-800', in_progress: 'bg-blue-100 text-blue-800', closed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-100 text-red-700', awarded: 'bg-purple-100 text-purple-800' };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 selection:bg-[#fed977] selection:text-[#041635]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#041635]">My Posted Legal Cases</h1>
          <p className="text-sm text-[#8393b8] mt-1">Manage postings, review proposals, and hire legal experts.</p>
        </div>
        <Link to="/client/portal/post-case" className="bg-[#041635] text-[#fed977] font-bold px-5 py-3 rounded-xl shadow-lg hover:bg-[#1b2b4b] transition-all flex items-center gap-2 text-sm shrink-0">
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Post New Case
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
          <div className="w-10 h-10 border-4 border-[#041635] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-[#8393b8]">Loading your cases...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-sm max-w-2xl mx-auto my-12">
          <span className="material-symbols-outlined text-5xl text-[#8393b8] mb-4 block">post_add</span>
          <h3 className="text-xl font-bold text-[#041635] mb-2">No Cases Posted Yet</h3>
          <p className="text-sm text-[#8393b8] max-w-md mx-auto mb-6 leading-relaxed">Post your legal situation to receive tailored proposals from verified lawyers.</p>
          <Link to="/client/portal/post-case" className="inline-flex items-center gap-2 bg-[#041635] text-[#fed977] font-bold px-6 py-3.5 rounded-xl shadow-md hover:bg-[#1b2b4b] transition-all text-sm">
            <span className="material-symbols-outlined text-lg">add</span>
            Post Your First Case
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Post List */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold text-[#8393b8] uppercase tracking-wider px-1">Your Cases ({posts.length})</h3>
            <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1">
              {posts.map(post => {
                const isSelected = selectedPost?.id === post.id;
                return (
                  <div key={post.id} onClick={() => setSelectedPost(post)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative group ${isSelected ? 'bg-[#041635] text-white border-[#041635] shadow-md' : 'bg-white text-[#041635] border-gray-200 hover:border-[#041635]/40 hover:shadow-sm'}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${isSelected ? 'bg-[#fed977]/20 text-[#fed977] border-[#fed977]/30' : 'bg-[#F8F9FF] text-[#041635] border-gray-300'}`}>
                        {post.legal_category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : getStatusColor(post.status)}`}>
                          {post.status}
                        </span>
                        <button onClick={(e) => handleDeletePost(post.id, e)} className={`p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'hover:bg-white/10 text-red-300' : 'hover:bg-gray-100 text-red-500'}`}>
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                    <h4 className="font-bold text-sm leading-snug line-clamp-2 mb-2">{post.title}</h4>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-current/10">
                      <span className={isSelected ? 'text-white/70' : 'text-[#8393b8]'}>{new Date(post.created_at).toLocaleDateString()}</span>
                      <span className={`font-extrabold flex items-center gap-1 ${isSelected ? 'text-[#fed977]' : 'text-[#041635]'}`}>
                        <span className="material-symbols-outlined text-sm">group</span>
                        {post.proposals_count || 0} Proposals
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Proposals Panel */}
          <div className="lg:col-span-8">
            {selectedPost && (
              <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-6">
                {/* Post Header */}
                <div className="border-b border-gray-200 pb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-[#041635]/10 text-[#041635] px-2.5 py-0.5 rounded-full text-xs font-bold">{selectedPost.legal_category}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(selectedPost.status)}`}>{selectedPost.status}</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-[#041635]">{selectedPost.title}</h2>
                    <p className="text-xs text-[#8393b8] mt-1">
                      Budget: <strong className="text-[#041635]">{selectedPost.budget_type === 'negotiable' ? 'Negotiable' : `BDT ${selectedPost.budget_min || 0}–${selectedPost.budget_max || 0}`}</strong>
                    </p>
                  </div>
                  <Link to={`/jobs/${selectedPost.id}`} target="_blank" className="bg-[#F8F9FF] text-[#041635] font-bold px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-100 transition text-xs flex items-center gap-1.5 shrink-0">
                    View Public Page <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </Link>
                </div>

                {/* Proposals */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-extrabold text-[#041635] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#fed977]" style={{ fontVariationSettings: "'FILL' 1" }}>assignment_ind</span>
                      Received Proposals
                      <span className="bg-[#041635] text-white text-xs px-2.5 py-0.5 rounded-full font-bold">{proposals.length}</span>
                    </h3>
                  </div>

                  {loadingProposals ? (
                    <div className="py-16 text-center">
                      <div className="w-8 h-8 border-4 border-[#041635] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-xs font-bold text-[#8393b8]">Loading proposals...</p>
                    </div>
                  ) : proposals.length === 0 ? (
                    <div className="bg-[#F8F9FF] rounded-2xl border border-dashed border-gray-300 p-10 text-center">
                      <span className="material-symbols-outlined text-4xl text-[#8393b8] mb-2">inbox</span>
                      <h4 className="font-bold text-[#041635] text-base mb-1">No Proposals Yet</h4>
                      <p className="text-xs text-[#8393b8] max-w-sm mx-auto">Your case is live. Verified lawyers will submit proposals soon.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {proposals.map(prop => {
                        const lawyerName = prop.lawyer?.full_name || prop.lawyer?.name || 'Legal Counsel';
                        const lawyerAvatar = prop.lawyer?.avatar_url || prop.lawyer?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(lawyerName)}&background=041635&color=fff`;
                        const prof = lawyerProfiles[prop.lawyer_id] || {};
                        const isVerified = prof.is_verified || prof.verification_status === 'verified' || prof.verification_status === 'Approved';
                        const isProcessing = processingId === prop.id;
                        const isAccepted = prop.status === 'accepted';
                        const isRejected = prop.status === 'rejected' || prop.status === 'withdrawn';
                        const isPending = prop.status === 'pending';

                        return (
                          <div key={prop.id} className={`p-6 rounded-2xl border transition-all ${isAccepted ? 'bg-emerald-50/50 border-emerald-300 shadow-sm' : isRejected ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-[#041635]/30 shadow-sm'}`}>
                            {/* Lawyer Header */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
                              <div className="flex items-center gap-3.5">
                                <img src={lawyerAvatar} alt={lawyerName} className="w-12 h-12 rounded-full object-cover border-2 border-gray-200" />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <h4 className="font-extrabold text-[#041635] text-base">{lawyerName}</h4>
                                    {isVerified && <span className="material-symbols-outlined text-sm text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>}
                                  </div>
                                  <p className="text-xs text-[#8393b8] flex items-center gap-3 mt-0.5">
                                    <span>{prof.specialization || selectedPost.legal_category}</span>
                                    {prof.experience_years && <span>• <strong>{prof.experience_years} yrs</strong></span>}
                                    {prof.rating && <span className="flex items-center gap-0.5 text-amber-600 font-bold"><span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>{prof.rating}</span>}
                                  </p>
                                </div>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${isAccepted ? 'bg-emerald-100 text-emerald-800' : isRejected ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800 animate-pulse'}`}>
                                {prop.status}
                              </span>
                            </div>

                            {/* Proposal Details */}
                            <div className="py-4 space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F8F9FF] p-3.5 rounded-xl border border-gray-200/80 text-xs">
                                <div>
                                  <span className="text-[#8393b8] block text-[10px] uppercase font-bold">Proposed Fee</span>
                                  <span className="font-extrabold text-[#041635] text-base">BDT {Number(prop.proposed_fee).toLocaleString()} <span className="text-xs font-medium text-[#8393b8]">({prop.fee_type})</span></span>
                                </div>
                                <div>
                                  <span className="text-[#8393b8] block text-[10px] uppercase font-bold">Duration</span>
                                  <span className="font-bold text-[#041635] text-sm">{prop.estimated_duration}</span>
                                </div>
                              </div>
                              <div>
                                <span className="text-xs font-bold text-[#041635] block mb-1">Cover Letter</span>
                                <p className="text-xs text-[#041635] bg-[#F8F9FF] p-4 rounded-xl border border-gray-200 leading-relaxed whitespace-pre-line">{prop.cover_letter}</p>
                              </div>
                            </div>

                            {/* Action Buttons — role & status driven */}
                            <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Link to={`/lawyers/${prop.lawyer_id}`} target="_blank" className="text-xs font-bold text-[#041635] px-3 py-2 rounded-lg bg-gray-100 hover:bg-[#041635] hover:text-white transition flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm">person</span> View Profile
                                </Link>
                                <button onClick={() => navigate(`/client/portal/messages?lawyerId=${prop.lawyer_id}`)} className="text-xs font-bold text-[#041635] px-3 py-2 rounded-lg bg-gray-100 hover:bg-[#041635] hover:text-white transition flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm">mail</span> Message
                                </button>
                              </div>

                              {/* Pending proposal actions */}
                              {isPending && selectedPost.status === 'open' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => { setChangeRequestModal({ type: 'proposal', id: prop.id, originalCoverLetter: prop.cover_letter }); setChangeNote(''); }}
                                    disabled={isProcessing}
                                    className="text-xs font-bold text-amber-700 hover:bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-200 transition disabled:opacity-50"
                                  >
                                    Request Changes
                                  </button>
                                  <button
                                    onClick={() => handleDeclineProposal(prop.id)}
                                    disabled={isProcessing}
                                    className="text-xs font-bold text-red-600 hover:bg-red-50 px-3.5 py-2 rounded-xl border border-red-200 transition disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => handleAcceptProposal(prop)}
                                    disabled={isProcessing}
                                    className="bg-[#041635] text-[#fed977] font-extrabold px-5 py-2 rounded-xl text-xs hover:bg-[#1b2b4b] transition shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {isProcessing ? (
                                      <><div className="w-3.5 h-3.5 border-2 border-[#fed977] border-t-transparent rounded-full animate-spin" /><span>Accepting...</span></>
                                    ) : (
                                      <><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>handshake</span><span>Accept & Hire</span></>
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* Accepted — show status */}
                              {isAccepted && (
                                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                  Hired — Case workspace created
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Change Request Modal */}
      {changeRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-[#041635] text-lg">Request Changes</h3>
              <button onClick={() => setChangeRequestModal(null)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">✕</button>
            </div>
            <p className="text-sm text-[#8393b8]">Describe the changes you'd like the lawyer to make to their {changeRequestModal.type === 'contract' ? 'contract' : 'proposal'}.</p>
            <textarea
              value={changeNote}
              onChange={e => setChangeNote(e.target.value)}
              placeholder="e.g., Please revise the fee structure to a monthly retainer..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#041635] resize-none"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setChangeRequestModal(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={handleRequestChanges}
                disabled={!changeNote.trim() || !!processingId}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition disabled:opacity-50"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientMyPosts;
