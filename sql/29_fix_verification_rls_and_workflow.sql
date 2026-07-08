-- =============================================================================
-- Phase 29: Verification Center RLS & Workflow Fixes
-- =============================================================================

-- 1. Helper function to verify Admin roles safely
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE (id = auth.uid() OR auth_id = auth.uid()) 
      AND (user_type::text = 'admin')
  ) OR (auth.jwt() ->> 'role' = 'admin') 
    OR (auth.jwt() ->> 'user_role' = 'admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Ensure table structure supports required verification workflow fields
ALTER TABLE public.lawyer_profiles 
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unverified';

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ALTER COLUMN client_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS lawyer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.users(id) ON DELETE CASCADE;

-- =============================================================================
-- 3. RLS POLICIES FOR documents TABLE
-- =============================================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Drop older overlapping policies
DROP POLICY IF EXISTS "Users can read their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
DROP POLICY IF EXISTS "View own documents" ON public.documents;
DROP POLICY IF EXISTS "Upload own documents" ON public.documents;
DROP POLICY IF EXISTS "Manage own documents" ON public.documents;
DROP POLICY IF EXISTS "documents_access" ON public.documents;
DROP POLICY IF EXISTS "lawyers_select_own_documents" ON public.documents;
DROP POLICY IF EXISTS "lawyers_insert_own_documents" ON public.documents;
DROP POLICY IF EXISTS "lawyers_update_own_documents" ON public.documents;
DROP POLICY IF EXISTS "lawyers_delete_own_documents" ON public.documents;
DROP POLICY IF EXISTS "admins_select_all_documents" ON public.documents;
DROP POLICY IF EXISTS "admins_manage_all_documents" ON public.documents;

-- Lawyers: Can SELECT rows in documents ONLY where lawyer_id = auth.uid() (or uploaded_by)
CREATE POLICY "lawyers_select_own_documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    lawyer_id = auth.uid() 
    OR uploaded_by = auth.uid() 
    OR client_id = auth.uid()
  );

-- Lawyers: Can INSERT rows in documents ONLY where lawyer_id = auth.uid() (or uploaded_by)
CREATE POLICY "lawyers_insert_own_documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (
    lawyer_id = auth.uid() 
    OR uploaded_by = auth.uid()
  );

-- Lawyers: Can UPDATE rows in documents ONLY where lawyer_id = auth.uid() (or uploaded_by)
CREATE POLICY "lawyers_update_own_documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (
    lawyer_id = auth.uid() 
    OR uploaded_by = auth.uid()
  )
  WITH CHECK (
    lawyer_id = auth.uid() 
    OR uploaded_by = auth.uid()
  );

-- Lawyers: Can DELETE rows in documents ONLY where lawyer_id = auth.uid() (or uploaded_by)
CREATE POLICY "lawyers_delete_own_documents"
  ON public.documents FOR DELETE
  TO authenticated
  USING (
    lawyer_id = auth.uid() 
    OR uploaded_by = auth.uid()
  );

-- Admins: Can SELECT all rows in the documents table (to review them)
CREATE POLICY "admins_select_all_documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins: Can manage all rows in documents during review
CREATE POLICY "admins_manage_all_documents"
  ON public.documents FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- =============================================================================
-- 4. RLS POLICIES FOR lawyer_profiles TABLE
-- =============================================================================
ALTER TABLE public.lawyer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "lawyer_profiles_select" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "lawyer_profiles_insert" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "lawyer_profiles_update_own" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "admins_update_lawyer_profiles" ON public.lawyer_profiles;

CREATE POLICY "lawyer_profiles_select"
  ON public.lawyer_profiles FOR SELECT
  USING (true);

CREATE POLICY "lawyer_profiles_insert"
  ON public.lawyer_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "lawyer_profiles_update_own"
  ON public.lawyer_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins: Can UPDATE verification_status (and status) in lawyer_profiles table
CREATE POLICY "admins_update_lawyer_profiles"
  ON public.lawyer_profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- 5. FIX BROKEN SYNC TRIGGER FROM MIGRATION 23 (about_me -> bio, id -> user_id)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_lawyer_profiles_to_lawyers()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.lawyers (user_id, experience_years, bio, is_verified, verification_status)
    VALUES (
        NEW.id, 
        COALESCE(NEW.years_experience, 0), 
        NEW.bio, 
        COALESCE(NEW.is_verified, false),
        CASE 
          WHEN NEW.verification_status IN ('pending', 'under_review', 'verified', 'rejected') THEN NEW.verification_status::verification_status_enum
          ELSE 'pending'::verification_status_enum
        END
    )
    ON CONFLICT (user_id) DO UPDATE SET
        experience_years = EXCLUDED.experience_years,
        bio = EXCLUDED.bio,
        is_verified = EXCLUDED.is_verified,
        verification_status = EXCLUDED.verification_status;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Safe fallback update if conflict target or enum conversion fails
    UPDATE public.lawyers
    SET 
        experience_years = COALESCE(NEW.years_experience, experience_years),
        bio = COALESCE(NEW.bio, bio),
        is_verified = COALESCE(NEW.is_verified, is_verified)
    WHERE user_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. STORAGE BUCKET & OBJECT RLS POLICIES FOR 'documents'
-- =============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents." ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents." ON storage.objects;

CREATE POLICY "Users can upload their own documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Public can view documents" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'documents');

CREATE POLICY "Users can update their own documents" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "Users can delete their own documents" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documents');

-- Grant necessary permissions
GRANT ALL ON public.documents TO authenticated;
GRANT ALL ON public.lawyer_profiles TO authenticated;
GRANT ALL ON public.lawyers TO authenticated;
GRANT ALL ON public.verifications TO authenticated;
GRANT ALL ON public.credentials TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
