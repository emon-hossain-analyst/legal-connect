-- =============================================================================
-- Phase 20: Fix Lawyers Table Permissions
-- Description: Grants SELECT permissions to anon/authenticated roles for the 
-- lawyers and users tables, and ensures public read access policies exist.
-- =============================================================================

BEGIN;

-- Grant basic table read permissions to public roles
GRANT SELECT ON public.lawyers TO anon, authenticated;
GRANT SELECT ON public.users TO anon, authenticated;

-- Ensure RLS policies allow public reads
DROP POLICY IF EXISTS "Lawyers viewable by everyone" ON public.lawyers;
CREATE POLICY "Lawyers viewable by everyone" ON public.lawyers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users viewable by everyone" ON public.users;
CREATE POLICY "Users viewable by everyone" ON public.users FOR SELECT USING (true);

COMMIT;
