-- =============================================================================
-- Migration 45: Fix Lawyer Approval Visibility
-- Root causes fixed:
--   1. fn_verify_lawyer did not set users.is_active = true, so lawyers with
--      is_active = NULL/false were excluded by the useLawyers inner join.
--   2. Backfill: set is_active = true for all users whose lawyer row is verified.
--   3. Ensure lawyers table is in supabase_realtime publication so CDC fires.
--   4. Ensure anon role can SELECT from lawyers + users (public directory).
-- =============================================================================

-- ─── 1. Replace fn_verify_lawyer to also activate the user account ───────────
CREATE OR REPLACE FUNCTION public.fn_verify_lawyer(
    p_lawyer_id  INT,
    p_user_id    UUID,
    p_status     TEXT,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_verified BOOLEAN;
    v_now         TIMESTAMPTZ := NOW();
BEGIN
    -- Only admins may call this function
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can perform lawyer verification.';
    END IF;

    v_is_verified := (p_status = 'verified');

    -- 1. Update public.lawyers (primary source of truth for the frontend)
    UPDATE public.lawyers
    SET
        verification_status = p_status,
        is_verified         = v_is_verified,
        verification_date   = CASE WHEN v_is_verified THEN v_now ELSE verification_date END,
        rejection_reason    = CASE
                                WHEN p_status IN ('rejected', 'action_required')
                                THEN p_rejection_reason
                                ELSE NULL
                              END,
        updated_at          = v_now
    WHERE
        (p_lawyer_id IS NOT NULL AND id = p_lawyer_id)
        OR (p_user_id IS NOT NULL AND user_id = p_user_id);

    -- 2. Update public.users — set is_verified AND is_active so the user
    --    appears in every query that filters on is_active = true
    IF p_user_id IS NOT NULL THEN
        UPDATE public.users
        SET
            is_verified = v_is_verified,
            is_active   = CASE WHEN v_is_verified THEN true ELSE is_active END,
            updated_at  = v_now
        WHERE id = p_user_id;
    END IF;

    -- 3. Notify the lawyer via the notifications table
    IF p_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
        VALUES (
            p_user_id,
            'verification',
            CASE
                WHEN v_is_verified THEN 'Verification Approved 🎉'
                WHEN p_status = 'rejected' THEN 'Verification Rejected'
                ELSE 'Verification Update'
            END,
            CASE
                WHEN v_is_verified
                    THEN 'Congratulations! Your lawyer profile has been verified. You can now appear in search results and submit proposals.'
                WHEN p_status = 'rejected'
                    THEN COALESCE('Your verification was rejected. Reason: ' || p_rejection_reason, 'Your verification was rejected. Please contact support.')
                ELSE 'Your verification status has been updated to: ' || p_status
            END,
            false,
            v_now
        )
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_verify_lawyer(INT, UUID, TEXT, TEXT) TO authenticated;

-- ─── 2. Backfill: activate users whose lawyer row is already verified ─────────
UPDATE public.users u
SET
    is_active   = true,
    is_verified = true,
    updated_at  = NOW()
FROM public.lawyers l
WHERE
    l.user_id = u.id
    AND l.is_verified = true
    AND (u.is_active IS NULL OR u.is_active = false OR u.is_verified IS NULL OR u.is_verified = false);

-- ─── 3. Ensure anon + authenticated can SELECT lawyers and users ──────────────
GRANT SELECT ON public.lawyers TO anon, authenticated;
GRANT SELECT ON public.users   TO anon, authenticated;

-- Idempotent RLS policies for public lawyer directory
ALTER TABLE public.lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lawyers_public_select" ON public.lawyers;
CREATE POLICY "lawyers_public_select"
    ON public.lawyers FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "users_public_select" ON public.users;
CREATE POLICY "users_public_select"
    ON public.users FOR SELECT
    USING (true);

-- ─── 4. Add lawyers table to Supabase Realtime publication ───────────────────
-- This is required for Postgres CDC (postgres_changes) to fire on the lawyers table.
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lawyers;
EXCEPTION WHEN OTHERS THEN
    NULL; -- already in publication
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ─── 5. Notify PostgREST to reload schema cache ──────────────────────────────
NOTIFY pgrst, 'reload schema';
