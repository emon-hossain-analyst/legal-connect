import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import styles from './FeedbackRatings.module.css';

const Stars = ({ value, interactive = false, onChange }) => (
  <div className={styles.stars}>
    {[1, 2, 3, 4, 5].map((n) => (
      <span
        key={n}
        className={`${styles.star} ${value >= n ? styles.filled : ''} ${interactive ? styles.interactive : ''}`}
        onClick={interactive && onChange ? () => onChange(n) : undefined}
        role={interactive ? 'button' : undefined}
        aria-label={interactive ? `${n} star${n !== 1 ? 's' : ''}` : undefined}
      >
        ★
      </span>
    ))}
  </div>
);

const RatingBar = ({ label, count, total }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={styles.ratingBar}>
      <span className={styles.ratingBarLabel}>{label} ★</span>
      <div className={styles.ratingBarTrack}>
        <div className={styles.ratingBarFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.ratingBarCount}>{count}</span>
    </div>
  );
};

const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 86400) return 'Today';
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  if (s < 2592000) return `${Math.floor(s / 604800)}w ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

/**
 * Props:
 *   lawyerUserId  — the users.id of the lawyer whose reviews to show
 *   lawyerName    — display name
 *   avgRating     — pre-fetched avg (optional, will compute from reviews if absent)
 */
const FeedbackRatings = ({ lawyerUserId, lawyerName, avgRating: propAvg }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ rating: 0, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const { user } = useAuth();
  const isClient = user?.user_type === 'client';

  const load = useCallback(async () => {
    if (!lawyerUserId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('lawyer_id', lawyerUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      console.error('Error loading feedback:', err);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [lawyerUserId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.rating === 0) { toast.error('Please select a star rating'); return; }
    if (!form.comment.trim()) { toast.error('Please write a review'); return; }
    if (!user) { toast.error('You must be logged in'); return; }
    setSubmitting(true);
    try {
      const payload = {
        lawyer_id: lawyerUserId,
        client_id: user.id,
        rating: form.rating,
        comment: form.comment,
        client_name: user.name || 'Anonymous Client'
      };
      const { error } = await supabase.from('feedback').insert([payload]);
      if (error) throw error;
      
      toast.success('Review submitted!');
      setForm({ rating: 0, comment: '' });
      load();
    } catch (err) {
      console.error('Submit feedback error:', err);
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  // Compute stats from loaded reviews
  const total = reviews.length;
  const avg = total > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1)
    : (propAvg ?? 0);
  const dist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.filter((r) => r.rating === n).length,
  }));

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.heading}>Reviews</h2>

      {/* ── Summary bar ── */}
      {total > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryScore}>
            <span className={styles.bigScore}>{avg}</span>
            <Stars value={Math.round(avg)} />
            <span className={styles.totalCount}>{total} review{total !== 1 ? 's' : ''}</span>
          </div>
          <div className={styles.summaryBars}>
            {dist.map(({ n, count }) => (
              <RatingBar key={n} label={n} count={count} total={total} />
            ))}
          </div>
        </div>
      )}

      {/* ── Submit form (clients only) ── */}
      {isClient && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <h3>Leave a Review</h3>
          <div className={styles.formRating}>
            <span>Your rating</span>
            <Stars value={form.rating} interactive onChange={(v) => setForm((f) => ({ ...f, rating: v }))} />
          </div>
          <textarea
            className={styles.textarea}
            rows={4}
            placeholder={`Share your experience with ${lawyerName || 'this lawyer'}…`}
            value={form.comment}
            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
          />
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </form>
      )}

      {/* ── Review list ── */}
      <div className={styles.list}>
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={styles.skeletonAvatar} />
              <div className={styles.skeletonLines}>
                <div className={styles.skeletonLine} />
                <div className={`${styles.skeletonLine} ${styles.short}`} />
                <div className={styles.skeletonLine} />
              </div>
            </div>
          ))
        ) : reviews.length === 0 ? (
          <p className={styles.empty}>No reviews yet{isClient ? ' — be the first!' : '.'}</p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className={styles.reviewCard}>
              <div className={styles.reviewTop}>
                <div className={styles.reviewerAvatar}>
                  {r.client_name.charAt(0).toUpperCase()}
                </div>
                <div className={styles.reviewerMeta}>
                  <span className={styles.reviewerName}>{r.client_name}</span>
                  <Stars value={r.rating} />
                </div>
                <span className={styles.reviewDate}>{timeAgo(r.created_at)}</span>
              </div>
              <p className={styles.reviewText}>{r.comment}</p>
              {r.lawyer_response && (
                <div className={styles.lawyerResponse}>
                  <span className={styles.responseLabel}>Response from {lawyerName || 'lawyer'}</span>
                  <p>{r.lawyer_response}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FeedbackRatings;
