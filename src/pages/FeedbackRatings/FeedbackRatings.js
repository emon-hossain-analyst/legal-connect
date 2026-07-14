import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import styles from './FeedbackRatings.module.css';

const Stars = ({ value }) => (
  <div className={styles.stars}>
    {[1, 2, 3, 4, 5].map((n) => (
      <span
        key={n}
        className={`${styles.star} ${value >= n ? styles.filled : ''}`}
      >
        ★
      </span>
    ))}
  </div>
);

const timeAgo = (date) => {
  if (!date) return 'Recently';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const FeedbackRatings = ({ lawyerUserId, lawyerName, standalone = false }) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [starFilter, setStarFilter] = useState('All');

  // Reply drawer state: maps reviewId -> reply text
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const targetLawyerId = lawyerUserId || (standalone ? (user?.id || user?.auth_id) : null);
  const isLawyerViewingOwn = standalone || (user?.user_type === 'lawyer' && user?.id === targetLawyerId);

  const fetchReviews = useCallback(async () => {
    if (!targetLawyerId) {
      setLoading(false);
      return;
    }
    try {
      // Primary query from production `reviews` table including `review_replies`
      const { data: revData, error: revErr } = await supabase
        .from('reviews')
        .select('*, replies:review_replies(*)')
        .eq('lawyer_id', targetLawyerId)
        .order('created_at', { ascending: false });

      if (!revErr && revData && revData.length > 0) {
        setReviews(revData);
        setLoading(false);
        return;
      }

      // Fallback query: legacy `feedback` table
      const { data: fbData } = await supabase
        .from('feedback')
        .select('*, client:users!feedback_client_id_fkey(name)')
        .eq('lawyer_id', targetLawyerId)
        .order('created_at', { ascending: false });

      const mapped = (fbData || []).map(r => ({
        ...r,
        client_name: r.client_name || r.client?.name || 'Verified Client',
        is_verified_client: true,
        replies: r.lawyer_response ? [{ reply_text: r.lawyer_response, created_at: r.updated_at || r.created_at }] : []
      }));
      setReviews(mapped);
    } catch (err) {
      console.error('Error loading reviews:', err);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [targetLawyerId]);

  useEffect(() => {
    fetchReviews();

    if (!targetLawyerId) return;

    // Supabase Realtime subscription for instant dashboard synchronization
    const channel = supabase.channel(`lawyer_dashboard_reviews_${targetLawyerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter: `lawyer_id=eq.${targetLawyerId}` }, () => {
        fetchReviews();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'review_replies', filter: `lawyer_id=eq.${targetLawyerId}` }, () => {
        fetchReviews();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReviews, targetLawyerId]);

  const handleReplySubmit = async (reviewId) => {
    if (!replyText || replyText.trim().length < 5) {
      toast.error('Please write a professional reply of at least 5 characters.');
      return;
    }
    setSubmittingReply(true);
    try {
      // First try secure RPC fn_reply_to_review
      const { error: rpcErr } = await supabase.rpc('fn_reply_to_review', {
        p_review_id: reviewId,
        p_lawyer_id: targetLawyerId,
        p_reply_text: replyText.trim()
      });

      if (rpcErr) {
        // Fallback direct insert into review_replies or feedback update
        const { error: insErr } = await supabase.from('review_replies').insert([{
          review_id: reviewId,
          lawyer_id: targetLawyerId,
          reply_text: replyText.trim()
        }]);

        if (insErr) {
          // If review is from legacy table
          await supabase.from('feedback').update({
            lawyer_response: replyText.trim(),
            updated_at: new Date().toISOString()
          }).eq('id', reviewId);
        }
      }

      toast.success('Your response has been published successfully!');
      setReplyingToId(null);
      setReplyText('');
      fetchReviews();
    } catch (err) {
      console.error('Reply submission error:', err);
      toast.error(err.message || 'Failed to submit reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Summary calculation
  const total = reviews.length;
  const avgScore = total > 0
    ? (reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / total).toFixed(1)
    : '0.0';

  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => Number(r.rating) === star).length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { star, count, pct };
  });

  // Filtered reviews
  const filteredReviews = reviews.filter((r) => {
    const matchesStar = starFilter === 'All' || Number(r.rating) === Number(starFilter);
    const displayName = r.is_anonymous ? 'Verified Client (Anonymous)' : (r.client_name || 'Verified Client');
    const matchesQuery = !searchQuery || 
      displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.comment && r.comment.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStar && matchesQuery;
  });

  return (
    <div className={styles.wrapper}>
      <div className={styles.heading}>
        <span>{standalone ? 'Client Reviews & Performance Ratings' : 'Client Reviews'}</span>
        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#64748B' }}>
          {total} {total === 1 ? 'Verified Review' : 'Verified Reviews'}
        </span>
      </div>
      {standalone && (
        <p className={styles.subheading}>
          Monitor verified ratings from completed contracts, track client satisfaction, and respond professionally to public feedback.
        </p>
      )}

      {/* Summary Score Card */}
      {total > 0 && (
        <div className={styles.summaryCard}>
          <div className={styles.summaryScore}>
            <div className={styles.bigScore}>{avgScore}</div>
            <Stars value={Math.round(Number(avgScore))} />
            <div className={styles.totalCount}>Based on {total} completed {total === 1 ? 'matter' : 'matters'}</div>
          </div>

          <div className={styles.summaryBars}>
            {distribution.map(({ star, count, pct }) => (
              <div key={star} className={styles.ratingBar}>
                <span className={styles.ratingBarLabel}>{star}★</span>
                <div className={styles.ratingBarTrack}>
                  <div className={styles.ratingBarFill} style={{ width: `${pct}%` }} />
                </div>
                <span className={styles.ratingBarCount}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      {total > 0 && (
        <div className={styles.controlsBar}>
          <div className={styles.filterPills}>
            {['All', '5', '4', '3', '2', '1'].map((star) => (
              <button
                key={star}
                type="button"
                className={`${styles.pill} ${starFilter === star ? styles.pillActive : ''}`}
                onClick={() => setStarFilter(star)}
              >
                {star === 'All' ? `All (${total})` : `${star}★ (${reviews.filter(r => Number(r.rating) === Number(star)).length})`}
              </button>
            ))}
          </div>

          <div className={styles.searchBox}>
            <span style={{ marginRight: '8px', color: '#94A3B8' }}>🔍</span>
            <input
              type="text"
              placeholder="Search client name or review text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>✕</button>
            )}
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className={styles.list}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: '#64748B', fontWeight: 600 }}>Syncing reviews...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className={styles.empty}>
            {total === 0
              ? 'No client reviews have been published for your profile yet. Reviews are automatically collected when clients accept delivery and resolve cases.'
              : `No reviews found matching your search or ${starFilter}-star filter.`}
          </div>
        ) : (
          filteredReviews.map((r) => {
            const displayName = r.is_anonymous ? 'Verified Client (Anonymous)' : (r.client_name || 'Verified Client');
            const initials = r.is_anonymous ? 'A' : displayName.charAt(0).toUpperCase();
            const existingReply = r.replies?.[0]?.reply_text || r.lawyer_response;
            const replyTimestamp = r.replies?.[0]?.created_at || r.updated_at;

            return (
              <div key={r.id} className={styles.reviewCard}>
                <div className={styles.reviewTop}>
                  <div className={styles.reviewerMeta}>
                    <div className={styles.reviewerAvatar}>
                      {initials}
                    </div>
                    <div className={styles.reviewerDetails}>
                      <div className={styles.reviewerNameRow}>
                        <span className={styles.reviewerName}>{displayName}</span>
                        {r.is_verified_client !== false && (
                          <span className={styles.verifiedBadge}>✓ Verified Client</span>
                        )}
                      </div>
                      <Stars value={r.rating} />
                    </div>
                  </div>
                  <span className={styles.reviewDate}>{timeAgo(r.created_at)}</span>
                </div>

                {/* Sub-Ratings */}
                {(r.rating_communication || r.rating_professionalism || r.rating_expertise || r.rating_responsiveness || r.rating_value) && (
                  <div className={styles.subRatingsContainer}>
                    {r.rating_communication && <span className={styles.subRatingItem}>Communication: <strong className={styles.subRatingScore}>{r.rating_communication}★</strong></span>}
                    {r.rating_professionalism && <span className={styles.subRatingItem}>Professionalism: <strong className={styles.subRatingScore}>{r.rating_professionalism}★</strong></span>}
                    {r.rating_expertise && <span className={styles.subRatingItem}>Expertise: <strong className={styles.subRatingScore}>{r.rating_expertise}★</strong></span>}
                    {r.rating_responsiveness && <span className={styles.subRatingItem}>Responsiveness: <strong className={styles.subRatingScore}>{r.rating_responsiveness}★</strong></span>}
                    {r.rating_value && <span className={styles.subRatingItem}>Value: <strong className={styles.subRatingScore}>{r.rating_value}★</strong></span>}
                  </div>
                )}

                <p className={styles.reviewText}>{r.comment}</p>

                {/* Existing Reply Display */}
                {existingReply ? (
                  <div className={styles.lawyerReplyBox}>
                    <div className={styles.replyHeader}>
                      <span className={styles.replyLabel}>Your Response</span>
                      {replyTimestamp && <span className={styles.replyDate}>{timeAgo(replyTimestamp)}</span>}
                    </div>
                    <p className={styles.replyText}>{existingReply}</p>
                  </div>
                ) : (
                  isLawyerViewingOwn && (
                    <>
                      {replyingToId === r.id ? (
                        <div className={styles.replyForm}>
                          <label style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', display: 'block' }}>
                            Write your professional response:
                          </label>
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Thank the client for their feedback or address any specific points raised..."
                            rows={3}
                            className={styles.replyTextarea}
                          />
                          <div className={styles.replyFormBtns}>
                            <button
                              type="button"
                              onClick={() => { setReplyingToId(null); setReplyText(''); }}
                              className={styles.cancelBtn}
                              disabled={submittingReply}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReplySubmit(r.id)}
                              className={styles.replyBtn}
                              disabled={submittingReply}
                            >
                              {submittingReply ? 'Publishing...' : 'Publish Response'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.replyActions}>
                          <button
                            type="button"
                            onClick={() => { setReplyingToId(r.id); setReplyText(''); }}
                            className={styles.replyBtn}
                          >
                            <span>↩</span> Reply to Client
                          </button>
                        </div>
                      )}
                    </>
                  )
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FeedbackRatings;
