-- =============================================================================
-- Phase 16: Fix Users Table Permissions and RLS
-- =============================================================================

-- 1. Grant access to authenticated and anon roles for the users table
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;

-- 2. Enable Row Level Security (RLS) on public.users to ensure data safety
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Everyone can read public user data
DROP POLICY IF EXISTS "Public users are viewable by everyone" ON public.users;
CREATE POLICY "Public users are viewable by everyone" 
  ON public.users FOR SELECT USING (true);

-- Authenticated users can update ONLY their own row
DROP POLICY IF EXISTS "Users can update their own row" ON public.users;
CREATE POLICY "Users can update their own row" 
  ON public.users FOR UPDATE 
  USING (auth.uid() = auth_id);
