-- =============================================================================
-- Migration 55: Fix Approved Lawyers Not Appearing on Public Pages
-- Root causes fixed:
--   1. search_lawyers RPC declared id as UUID but lawyers.id is INT (serial).
--      This caused a type-cast error → RPC returned 0 rows → frontend fell
--      through to the direct query which also had join issues.
--   2. search_lawyers used INNER JOIN on users, silently excluding lawyers
--      whose user row could not be matched by id alone (auth_id mismatch).
--   3. RLS "lawyers_public_select" policy may have been overwritten by later
--      migrations with a restrictive USING clause.
--   4. anon role was missing EXECUTE on search_lawyers (unauthenticated home page).
--   5. Backfill: any lawyer with is_verified=true but users.is_active=false/null
--      is still excluded by some queries — ensure backfill is re-applied.
-- =============================================================================

-- ─── 1. Drop ALL existing overloads of search_lawyers to avoid return-type conflicts ───
DO $$
DECLARE
  r RECORD;
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

-- ─── 2. Recreate search_lawyers with correct INT id and LEFT JOIN ─────────────
CREATE OR REPLACE FUNCTION public.search_lawyers(
  p_query        TEXT    DEFAULT NULL,
  p_category     TEXT    DEFAULT NULL,
  p_location     TEXT    DEFAULT NULL,
  p_max_rate     NUMERIC DEFAULT NULL,
  p_verified_only BOOLEAN DEFAULT true,
  p_limit        INT     DEFAULT 20,
  p_offset       INT     DEFAULT 0
)
RETURNS TABLE (
  id                  INT,        -- lawyers.id is SERIAL (integer), NOT uuid
  user_id             UUID,
  name                TEXT,
  profile_picture_url TEXT,
  specialization      TEXT,       -- returned as text for frontend compatibility
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
    COALESCE(u.name, u.full_name, 'Verified Lawyer')::TEXT        AS name,
    COALESCE(u.profile_picture_url, l.profile_image_url)::TEXT    AS profile_picture_url,
    -- Normalise specialization: if it's an array cast to text, else use as-is
    CASE
      WHEN l.specialization IS NULL THEN 'General Practice'
      ELSE array_to_string(l.specialization, ', ')
    END::TEXT                                                       AS specialization,
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
  -- LEFT JOIN so lawyers without a matching users row are still returned
  LEFT JOIN public.users u
    ON u.id = l.user_id OR u.auth_id = l.user_id
  WHERE
    -- Verification filter: accept is_verified=true OR verification_status='verified'
    (
      NOT p_verified_only
      OR l.is_verified = true
      OR l.verification_status::TEXT = 'verified'
    )
    AND (p_category  IS NULL OR p_category  = '' OR p_category = 'All'
         OR array_to_string(l.specialization, ',') ILIKE '%' || p_category || '%'
         OR l.bio ILIKE '%' || p_category || '%')
    AND (p_location  IS NULL OR p_location  = ''
         OR l.location ILIKE '%' || p_location || '%')
    AND (p_max_rate  IS NULL OR p_max_rate  <= 0
         OR l.hourly_rate <= p_max_rate)
    AND (
      p_query IS NULL OR p_query = ''
      OR COALESCE(u.name, u.full_name, '') ILIKE '%' || p_query || '%'
      OR l.bio ILIKE '%' || p_query || '%'
      OR l.location ILIKE '%' || p_query || '%'
      OR array_to_string(l.specialization, ' ') ILIKE '%' || p_query || '%'
    )
  ORDER BY l.avg_rating DESC NULLS LAST, l.total_reviews DESC NULLS LAST, l.experience_years DESC NULLS LAST
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

-- Grant to BOTH anon (unauthenticated home page) and authenticated
GRANT EXECUTE ON FUNCTION public.search_lawyers(TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, INT, INT)
  TO anon, authenticated;

-- ─── 3. Ensure RLS on lawyers allows public SELECT (anon + authenticated) ────
ALTER TABLE public.lawyers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lawyers_public_select"   ON public.lawyers;
DROP POLICY IF EXISTS "public_read_lawyers"     ON public.lawyers;
DROP POLICY IF EXISTS "allow_public_read"       ON public.lawyers;
DROP POLICY IF EXISTS "Lawyers are publicly readable" ON public.lawyers;

CREATE POLICY "lawyers_public_select"
  ON public.lawyers FOR SELECT
  USING (true);   -- all rows readable; verification filter is in the query/RPC

-- ─── 4. Ensure RLS on users allows public SELECT for directory lookups ────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_public_select"     ON public.users;
DROP POLICY IF EXISTS "public_read_users"       ON public.users;

CREATE POLICY "users_public_select"
  ON public.users FOR SELECT
  USING (true);

-- ─── 5. Grant table-level SELECT to anon so unauthenticated pages work ────────
GRANT SELECT ON public.lawyers TO anon, authenticated;
GRANT SELECT ON public.users   TO anon, authenticated;

-- ─── 6. Backfill: activate users whose lawyer row is already verified ─────────
UPDATE public.users u
SET
  is_active   = true,
  is_verified = true,
  updated_at  = NOW()
FROM public.lawyers l
WHERE l.user_id = u.id
  AND (l.is_verified = true OR l.verification_status::TEXT = 'verified')
  AND (u.is_active IS DISTINCT FROM true OR u.is_verified IS DISTINCT FROM true);

-- ─── 7. Ensure lawyers + users tables are in the Realtime publication ─────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lawyers;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ─── 8. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
