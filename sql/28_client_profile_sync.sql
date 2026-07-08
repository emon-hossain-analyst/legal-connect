-- =============================================================================
-- Phase 28: Client Profile Sync & RLS Fixes
-- Ensures the clients and users tables are fully synced, have proper permissions,
-- and allow seamless profile updates and avatar uploads without hanging.
-- =============================================================================

-- 1. Ensure public.clients table exists with all required profile columns
CREATE TABLE IF NOT EXISTS public.clients (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone VARCHAR(50),
    dob DATE,
    nid VARCHAR(100),
    client_type VARCHAR(50) DEFAULT 'individual',
    company_name VARCHAR(255),
    registration_number VARCHAR(100),
    industry VARCHAR(100),
    company_size VARCHAR(50),
    designation VARCHAR(100),
    company_website VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist if the table was created previously with missing fields
DO $$ 
BEGIN
    BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone VARCHAR(50); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS dob DATE; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nid VARCHAR(100); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_type VARCHAR(50) DEFAULT 'individual'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_name VARCHAR(255); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS industry VARCHAR(100); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_size VARCHAR(50); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS designation VARCHAR(100); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_website VARCHAR(255); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- 2. Grant proper permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated, anon, service_role;

-- 3. Enable RLS and setup clean idempotent policies on public.clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can read own data" ON public.clients;
CREATE POLICY "Clients can read own data" ON public.clients
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Clients can insert own data" ON public.clients;
CREATE POLICY "Clients can insert own data" ON public.clients
    FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Clients can update own data" ON public.clients;
CREATE POLICY "Clients can update own data" ON public.clients
    FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- 4. Setup clean idempotent policies on public.users to ensure profile updates succeed
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users viewable by everyone" ON public.users;
CREATE POLICY "Users viewable by everyone" ON public.users
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.users;
CREATE POLICY "Users update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id OR auth.uid() = auth_id OR public.is_admin());

DROP POLICY IF EXISTS "Users insert own profile" ON public.users;
CREATE POLICY "Users insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() = auth_id OR public.is_admin());

-- 5. Storage policies for Avatars (ensure avatar upload works seamlessly)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
    FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
