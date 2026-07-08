-- =============================================================================
-- Phase 15: Fix Lawyer Dashboard Table Permissions
-- =============================================================================

-- Grant access to the authenticated role for all lawyer dashboard tables
GRANT ALL ON public.lawyer_profiles TO authenticated;
GRANT ALL ON public.credentials TO authenticated;
GRANT ALL ON public.verifications TO authenticated;
GRANT ALL ON public.availability_rules TO authenticated;
GRANT ALL ON public.analytics_stats TO authenticated;
GRANT ALL ON public.portfolio_cases TO authenticated;

-- Grant access to the anon role for public viewing
GRANT SELECT ON public.lawyer_profiles TO anon;
GRANT SELECT ON public.credentials TO anon;
GRANT SELECT ON public.verifications TO anon;
GRANT SELECT ON public.availability_rules TO anon;
GRANT SELECT ON public.analytics_stats TO anon;
GRANT SELECT ON public.portfolio_cases TO anon;

-- Ensure RLS policies are bulletproof for INSERT/UPSERT on lawyer_profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.lawyer_profiles;
CREATE POLICY "Users can insert own profile" ON public.lawyer_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.lawyer_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.lawyer_profiles FOR DELETE USING (auth.uid() = id);

-- Ensure RLS policies for credentials
DROP POLICY IF EXISTS "Users can manage own credentials" ON public.credentials;
CREATE POLICY "Users can insert own credentials" ON public.credentials FOR INSERT WITH CHECK (auth.uid() = lawyer_id);
CREATE POLICY "Users can update own credentials" ON public.credentials FOR UPDATE USING (auth.uid() = lawyer_id);
CREATE POLICY "Users can delete own credentials" ON public.credentials FOR DELETE USING (auth.uid() = lawyer_id);

-- Ensure RLS policies for verifications
DROP POLICY IF EXISTS "Users can manage own verifications" ON public.verifications;
CREATE POLICY "Users can insert own verifications" ON public.verifications FOR INSERT WITH CHECK (auth.uid() = lawyer_id);
CREATE POLICY "Users can update own verifications" ON public.verifications FOR UPDATE USING (auth.uid() = lawyer_id);
CREATE POLICY "Users can delete own verifications" ON public.verifications FOR DELETE USING (auth.uid() = lawyer_id);

-- Ensure RLS policies for availability_rules
DROP POLICY IF EXISTS "Users can manage own availability" ON public.availability_rules;
CREATE POLICY "Users can insert own availability" ON public.availability_rules FOR INSERT WITH CHECK (auth.uid() = lawyer_id);
CREATE POLICY "Users can update own availability" ON public.availability_rules FOR UPDATE USING (auth.uid() = lawyer_id);
CREATE POLICY "Users can delete own availability" ON public.availability_rules FOR DELETE USING (auth.uid() = lawyer_id);

-- Ensure RLS policies for portfolio_cases
DROP POLICY IF EXISTS "Users can manage own portfolio cases" ON public.portfolio_cases;
CREATE POLICY "Users can insert own portfolio cases" ON public.portfolio_cases FOR INSERT WITH CHECK (auth.uid() = lawyer_id);
CREATE POLICY "Users can update own portfolio cases" ON public.portfolio_cases FOR UPDATE USING (auth.uid() = lawyer_id);
CREATE POLICY "Users can delete own portfolio cases" ON public.portfolio_cases FOR DELETE USING (auth.uid() = lawyer_id);
