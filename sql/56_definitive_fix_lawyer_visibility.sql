-- =============================================================================
-- Migration 56: Definitive Fix — Approved Lawyers Not Appearing on Public Pages
--
-- ROOT CAUSE ANALYSIS (full data-flow trace):
--
-- FLOW: auth.users → public.users (trigger) → public.lawyers (trigger)
--       → admin sets is_verified=true → public pages query lawyers
--
-- ROOT CAUSE 1 — specialization column type mismatch in search_lawyers RPC
--   public.lawyers.specialization is VARCHAR(255) in migration 01, but
--   migration 48 wrote the RPC treating it as TEXT[] (array), calling
--   array_to_string() on a scalar VARCHAR. This causes a runtime error
--   → RPC returns 0 rows or errors silently → frontend shows empty list.
--
-- ROOT CAUSE 2 — search_lawyers RPC id column declared as UUID
--   lawyers.id is SERIAL (INT). Migration 48 declared RETURNS TABLE(id UUID).
--   PostgreSQL cannot implicitly cast INT→UUID → entire RPC call fails with
--   "cannot cast type integer to uuid" → frontend falls to direct query.
--
-- ROOT CAUSE 3 — Direct fallback query uses .or() with verification_status
--   verification_status is a custom ENUM (verification_status_enum), not TEXT.
--   Supabase PostgREST .or('verification_status.eq.verified') compares the
--   enum value to the string 'verified'. This works only if PostgREST knows
--   the cast. If the schema cache is stale, this filter silently returns 0 rows.
--
-- ROOT CAUSE 4 — users.is_active column missing from original schema
--   Migration 01 defines is_active BOOLEAN NOT NULL DEFAULT TRUE on users.
--   But migration 26 (complete overhaul) recreates users WITHOUT is_active.
--   So newly registered users may have is_active = NULL, and any query
--   filtering .eq('is_active', true) silently excludes them.
--
-- ROOT CAUSE 5 — handle_new_lawyer trigger may not fire for existing users
--   If a lawyer registered before the trigger existed, or if the trigger
--   failed silently, no row exists in public.lawyers for that user.
--   Admin approval updates a non-existent row → nothing changes.
--
-- ROOT CAUSE 6 — Multiple conflicting RLS policies on public.lawyers
--   Migrations 09, 25, 43, 45, 49, 55 each DROP and CREATE policies with
--   different names. The last one to run wins. If migration 55 ran correctly
--   the policy is fine, but if it was skipped or partially applied, an older
--   restrictive policy may be blocking anon reads.
--
-- ROOT CAUSE 7 — fn_verify_lawyer updates lawyers WHERE id=p_lawyer_id OR
--   user_id=p_user_id. If p_lawyer_id is passed as NULL (because the admin
--   UI sends the serial INT as a string and isNaN() check fails), the WHERE
--   clause matches nothing → is_verified stays false.
--
-- FIXES APPLIED:
--   1. Recreate search_lawyers with correct return types and scalar specialization
--   2. Ensure is_active column exists on users with DEFAULT TRUE
--   3. Backfill missing lawyer rows for all users with user_type='lawyer'
--   4. Backfill is_active=true for all verified lawyers
--   5. Recreate all public.lawyers RLS policies cleanly (drop all, create one)
--   6. Recreate all public.users RLS policies cleanly
--   7. Fix fn_verify_lawyer to handle NULL p_lawyer_id gracefully
--   8. Grant SELECT + EXECUTE to anon role
--   9. Add lawyers + users to realtime publication
--  10. Reload PostgREST schema cache
-- =============================================================================

-- ─── STEP 1: Ensure is_active exists on users (migration 26 dropped it) ──────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── STEP 2: Backfill missing lawyer rows for all lawyer-type users ───────────
-- If handle_new_lawyer trigger failed or didn't exist when user registered,
-- they have no row in public.lawyers → admin approval has nothing to update.
INSERT INTO public.lawyers (user_id, verification_status, is_verified, created_at, updated_at)
SELECT
  u.id,
  'pending'::public.verification_status_enum,
  false,
  NOW(),
  NOW()
FROM public.users u
WHERE u.user_type::text = 'lawyer'
  AND NOT EXISTS (SELECT 1 FROM public.lawyers l WHERE l.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- ─── STEP 3: Backfill is_active + is_verified on users for approved lawyers ───
UPDATE public.users u
SET
  is_active   = TRUE,
  is_verified = TRUE,
  updated_at  = NOW()
FROM public.lawyers l
WHERE l.user_id = u.id
  AND (l.is_verified = TRUE OR l.verification_status::text = 'verified')
  AND (u.is_active IS DISTINCT FROM TRUE OR u.is_verified IS DISTINCT FROM TRUE);

-- ─── STEP 4: Drop ALL existing search_lawyers overloads ──────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS fn_sig
    FROM pg_proc
    WHERE proname = 'search_lawyers'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;';
  END LOOP;
END $$;

-- ─── STEP 5: Recreate search_lawyers with correct types ──────────────────────
-- lawyers.id        = SERIAL (INT)
-- lawyers.specialization = VARCHAR(255)  ← scalar, NOT an array
CREATE OR REPLACE FUNCTION public.search_lawyers(
  p_query         TEXT    DEFAULT NULL,
  p_category      TEXT    DEFAULT NULL,
  p_location      TEXT    DEFAULT NULL,
  p_max_rate      NUMERIC DEFAULT NULL,
  p_verified_only BOOLEAN DEFAULT TRUE,
  p_limit         INT     DEFAULT 20,
  p_offset        INT     DEFAULT 0
)
RETURNS TABLE (
  id                  INT,
  user_id             UUID,
  name                TEXT,
  profile_picture_url TEXT,
  specialization      TEXT,
  bio                 TEXT,
  location            TEXT,
  hourly_rate         NUMERIC,
  experience_years    INT,
  avg_rating          NUMERIC,
  total_reviews       INT,
  is_verified         BOOLEAN,
  verification_status TEXT,
  slug                TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.user_id,
    COALESCE(u.name, 'Verified Lawyer')::TEXT                     AS name,
    COALESCE(u.profile_picture_url, l.profile_image_url)::TEXT    AS profile_picture_url,
    COALESCE(l.specialization, 'General Practice')::TEXT          AS specialization,
    l.bio,
    l.location,
    l.hourly_rate,
    l.experience_years,
    l.avg_rating,
    l.total_reviews,
    l.is_verified,
    l.verification_status::TEXT,
    l.slug
  FROM public.lawyers l
  LEFT JOIN public.users u ON u.id = l.user_id
  WHERE
    (
      NOT p_verified_only
      OR l.is_verified = TRUE
      OR l.verification_status::TEXT = 'verified'
    )
    AND (p_category IS NULL OR p_category = '' OR p_category = 'All'
         OR l.specialization ILIKE '%' || p_category || '%'
         OR l.bio ILIKE '%' || p_category || '%')
    AND (p_location IS NULL OR p_location = ''
         OR l.location ILIKE '%' || p_location || '%')
    AND (p_max_rate IS NULL OR p_max_rate <= 0
         OR l.hourly_rate <= p_max_rate)
    AND (
      p_query IS NULL OR p_query = ''
      OR COALESCE(u.name, '') ILIKE '%' || p_query || '%'
      OR COALESCE(l.bio, '') ILIKE '%' || p_query || '%'
      OR COALESCE(l.location, '') ILIKE '%' || p_query || '%'
      OR COALESCE(l.specialization, '') ILIKE '%' || p_query || '%'
    )
  ORDER BY
    l.avg_rating DESC NULLS LAST,
    l.total_reviews DESC NULLS LAST,
    l.experience_years DESC NULLS LAST
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_lawyers(TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, INT, INT)
  TO anon, authenticated;

-- ─── STEP 6: Fix fn_verify_lawyer to handle NULL p_lawyer_id safely ──────────
-- Must DROP first — CREATE OR REPLACE cannot change return type of existing function
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS fn_sig
    FROM pg_proc
    WHERE proname = 'fn_verify_lawyer'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;';
  END LOOP;
END $$;

CREATE FUNCTION public.fn_verify_lawyer(
  p_lawyer_id        INT,
  p_user_id          UUID,
  p_status           TEXT,
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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can perform lawyer verification.';
  END IF;

  v_is_verified := (p_status = 'verified');

  -- Update lawyers table — handle both INT id and UUID user_id
  -- Use separate UPDATE statements to avoid ambiguous OR matching
  IF p_lawyer_id IS NOT NULL AND p_lawyer_id > 0 THEN
    UPDATE public.lawyers
    SET
      verification_status = p_status::public.verification_status_enum,
      is_verified         = v_is_verified,
      verification_date   = CASE WHEN v_is_verified THEN v_now ELSE verification_date END,
      rejection_reason    = CASE
                              WHEN p_status IN ('rejected', 'action_required') THEN p_rejection_reason
                              ELSE NULL
                            END,
      updated_at          = v_now
    WHERE id = p_lawyer_id;
  END IF;

  IF p_user_id IS NOT NULL THEN
    UPDATE public.lawyers
    SET
      verification_status = p_status::public.verification_status_enum,
      is_verified         = v_is_verified,
      verification_date   = CASE WHEN v_is_verified THEN v_now ELSE verification_date END,
      rejection_reason    = CASE
                              WHEN p_status IN ('rejected', 'action_required') THEN p_rejection_reason
                              ELSE NULL
                            END,
      updated_at          = v_now
    WHERE user_id = p_user_id;

    -- Also update public.users
    UPDATE public.users
    SET
      is_verified = v_is_verified,
      is_active   = CASE WHEN v_is_verified THEN TRUE ELSE is_active END,
      updated_at  = v_now
    WHERE id = p_user_id;
  END IF;

  -- Send notification to the lawyer
  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (
      p_user_id,
      'verification',
      CASE
        WHEN v_is_verified THEN 'Verification Approved'
        WHEN p_status = 'rejected' THEN 'Verification Rejected'
        ELSE 'Verification Update'
      END,
      CASE
        WHEN v_is_verified
          THEN 'Your lawyer profile has been verified. You now appear in search results.'
        WHEN p_status = 'rejected'
          THEN COALESCE('Verification rejected. Reason: ' || p_rejection_reason, 'Your verification was rejected.')
        ELSE 'Your verification status has been updated to: ' || p_status
      END,
      FALSE,
      v_now
    )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_verify_lawyer(INT, UUID, TEXT, TEXT) TO authenticated;

-- ─── STEP 7: Clean slate RLS for public.lawyers ───────────────────────────────
ALTER TABLE public.lawyers ENABLE ROW LEVEL SECURITY;

-- Drop every known policy name across all migrations
DROP POLICY IF EXISTS "lawyers_public_select"          ON public.lawyers;
DROP POLICY IF EXISTS "lawyers_select"                 ON public.lawyers;
DROP POLICY IF EXISTS "lawyers_read_all"               ON public.lawyers;
DROP POLICY IF EXISTS "Lawyers viewable by everyone"   ON public.lawyers;
DROP POLICY IF EXISTS "Lawyers are publicly readable"  ON public.lawyers;
DROP POLICY IF EXISTS "public_read_lawyers"            ON public.lawyers;
DROP POLICY IF EXISTS "allow_public_read"              ON public.lawyers;
DROP POLICY IF EXISTS "lawyers_update_own"             ON public.lawyers;
DROP POLICY IF EXISTS "Lawyers update own profile"     ON public.lawyers;
DROP POLICY IF EXISTS "lawyers_insert_own"             ON public.lawyers;
DROP POLICY IF EXISTS "Lawyers insert own profile"     ON public.lawyers;
DROP POLICY IF EXISTS "lawyers_admin_all"              ON public.lawyers;

-- Single clean policy set
CREATE POLICY "lawyers_select_public"
  ON public.lawyers FOR SELECT
  USING (TRUE);

CREATE POLICY "lawyers_insert_own"
  ON public.lawyers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "lawyers_update_own"
  ON public.lawyers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "lawyers_delete_admin"
  ON public.lawyers FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ─── STEP 8: Clean slate RLS for public.users ────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_public_select"            ON public.users;
DROP POLICY IF EXISTS "users_select"                   ON public.users;
DROP POLICY IF EXISTS "users_read_public"              ON public.users;
DROP POLICY IF EXISTS "Users viewable by everyone"     ON public.users;
DROP POLICY IF EXISTS "Public can view basic user info" ON public.users;
DROP POLICY IF EXISTS "users_update_own"               ON public.users;
DROP POLICY IF EXISTS "Users update own profile"       ON public.users;
DROP POLICY IF EXISTS "Users can update own profile"   ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users"    ON public.users;
DROP POLICY IF EXISTS "users_insert"                   ON public.users;
DROP POLICY IF EXISTS "Users insert own profile"       ON public.users;

CREATE POLICY "users_select_public"
  ON public.users FOR SELECT
  USING (TRUE);

CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR auth_id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR auth_id = auth.uid() OR public.is_admin());

-- ─── STEP 9: Grant table-level SELECT to anon ────────────────────────────────
GRANT SELECT ON public.lawyers TO anon, authenticated;
GRANT SELECT ON public.users   TO anon, authenticated;

-- ─── STEP 10: Ensure Realtime publication includes lawyers + users ────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lawyers;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ─── STEP 11: Reload PostgREST schema cache ───────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── VERIFICATION QUERIES (run these manually to confirm the fix worked) ──────
-- SELECT id, user_id, is_verified, verification_status FROM public.lawyers WHERE is_verified = true;
-- SELECT id, user_type, is_active, is_verified FROM public.users WHERE user_type = 'lawyer';
-- SELECT * FROM public.search_lawyers(p_verified_only := true, p_limit := 10);
