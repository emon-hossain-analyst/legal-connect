import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

// Lawyer-side counterpart to ReviewSubmissionModal.jsx (client reviews
// lawyer). Deliberately simpler — a single overall rating + comment, since
// the lawyer-specific sub-category breakdown (expertise, professionalism,
// etc.) doesn't apply symmetrically to a client.
const ReviewClientModal = ({ contractId, clientId, clientName, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    const checkExisting = async () => {
      if (!contractId) { setLoading(false); return; }
      try {
        const { data } = await supabase
          .from('reviews')
          .select('*')
          .eq('contract_id', contractId)
          .eq('reviewer_role', 'lawyer')
          .maybeSingle();
        if (data) {
          setExistingReview(data);
          setRating(data.rating || 5);
          setComment(data.comment || '');
          setIsAnonymous(Boolean(data.is_anonymous));
        }
      } catch (err) {
        console.error('Check client review error:', err);
      } finally {
        setLoading(false);
      }
    };
    checkExisting();
  }, [contractId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating || rating < 1 || rating > 5) {
      toast.error('Please select a rating of at least 1 star.');
      return;
    }
    if (!comment || comment.trim().length < 10) {
      toast.error('Please write a review comment of at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      if (existingReview) {
        const { error } = await supabase
          .from('reviews')
          .update({ rating, comment: comment.trim(), is_anonymous: isAnonymous, updated_at: new Date().toISOString() })
          .eq('id', existingReview.id);
        if (error) throw error;
        toast.success('Your review has been updated.');
      } else {
        const { error } = await supabase.rpc('fn_submit_client_review', {
          p_contract_id: contractId,
          p_rating: rating,
          p_comment: comment.trim(),
          p_is_anonymous: isAnonymous,
          p_lawyer_id: user?.id
        });
        if (error) throw error;
        toast.success('Review submitted for this client.');
      }
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      console.error('Submit client review error:', err);
      toast.error(err.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', textAlign: 'center' }}>
          <p style={{ color: '#64748B', fontWeight: 600 }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            {existingReview ? '★ Edit Client Review' : `★ Review ${clientName || 'Client'}`}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ textAlign: 'center', padding: '20px', background: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '12px 0' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  onClick={() => setRating(star)}
                  style={{ fontSize: '36px', color: star <= rating ? '#F59E0B' : '#CBD5E1', cursor: 'pointer' }}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#0F172A', marginBottom: '8px' }}>
              Written Review <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How was working with this client? Communication, responsiveness, clarity of instructions..."
              rows={4}
              required
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', fontFamily: 'inherit', lineHeight: '1.5', color: '#334155' }}
            />
            <span style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>Minimum 10 characters</span>
          </div>

          <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#F1F5F9', borderRadius: '10px' }}>
            <input
              type="checkbox"
              id="is_anon_client_review"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="is_anon_client_review" style={{ fontSize: '13px', fontWeight: '600', color: '#334155', cursor: 'pointer', margin: 0 }}>
              Submit review anonymously
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={submitting}
              style={{ padding: '12px 20px', background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              style={{ padding: '12px 24px', background: '#0F172A', color: '#FFFFFF', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
              {submitting ? 'Submitting...' : (existingReview ? 'Update Review' : 'Submit Review')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewClientModal;
