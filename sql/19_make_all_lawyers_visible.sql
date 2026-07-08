-- =============================================================================
-- Phase 19: Make All Lawyers Visible
-- Description: Updates existing lawyer profiles and their associated user
-- accounts so they are visible on the Homepage and "Find Lawyers" search page.
-- =============================================================================

BEGIN;

-- 1. Verify all lawyer profiles so they appear on the "Find Lawyers" search page
-- (The LawyerSearch.js page filters by is_verified = true)
UPDATE public.lawyers
SET is_verified = true
WHERE is_verified = false OR is_verified IS NULL;

-- 2. Activate their underlying user accounts so they appear on the Homepage
-- (The useLawyers.js hook filters by users.is_active = true)
UPDATE public.users u
SET is_active = true
FROM public.lawyers l
WHERE u.id = l.user_id 
  AND (u.is_active = false OR u.is_active IS NULL);

COMMIT;
