-- ============================================================================
-- Migration 006: Atomic Transactional Lawyer Verification
-- Replaces multi-step client-side updates across lawyer_profiles, lawyers, and users
-- with a single atomic PostgreSQL transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_verify_lawyer(
    p_lawyer_id INT,
    p_user_id UUID,
    p_status TEXT,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_verified BOOLEAN;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Check authorization: only admin can verify counsel
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can perform lawyer verification.';
    END IF;

    v_is_verified := (p_status = 'verified');

    -- 1. Update lawyer_profiles atomically
    IF p_user_id IS NOT NULL THEN
        UPDATE public.lawyer_profiles
        SET status = p_status,
            verification_status = p_status,
            is_verified = v_is_verified
        WHERE id = p_user_id OR user_id = p_user_id;

        -- 2. Update users table verification flag atomically
        UPDATE public.users
        SET is_verified = v_is_verified
        WHERE id = p_user_id;
    END IF;

    -- 3. Update relational lawyers table atomically
    UPDATE public.lawyers
    SET verification_status = p_status,
        is_verified = v_is_verified,
        verification_date = CASE WHEN v_is_verified THEN v_now ELSE verification_date END,
        rejection_reason = CASE WHEN p_status IN ('rejected', 'action_required') THEN p_rejection_reason ELSE NULL END
    WHERE (p_lawyer_id IS NOT NULL AND id = p_lawyer_id) OR (p_user_id IS NOT NULL AND user_id = p_user_id);

END;
$$;
