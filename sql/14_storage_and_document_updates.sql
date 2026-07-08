-- =============================================================================
-- Phase 14: Storage and Document Schema Updates
-- =============================================================================

-- 1. Alter documents table to support lawyer verification uploads
ALTER TABLE public.documents 
  ALTER COLUMN client_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);

-- 2. Backfill existing uploaded_by data if any documents exist
UPDATE public.documents SET uploaded_by = client_id WHERE uploaded_by IS NULL AND client_id IS NOT NULL;

-- 2.5 Add avatar_url to lawyer_profiles to sync UI directly
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. Update Storage Policies for Avatars bucket (if not fully defined in 10_storage_and_seed.sql)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
  END IF;
END $$;

-- 4. Ensure public.users table has profile_picture_url explicitly defined
-- Note: Already exists from 01_auth_and_users.sql, but keeping this as a safety check
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- 5. RLS for documents table
-- Update documents RLS to allow users to see and manage their own uploads
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own documents" ON public.documents;
CREATE POLICY "Users can read their own documents" 
  ON public.documents FOR SELECT 
  USING (auth.uid() = uploaded_by OR auth.uid() = client_id OR auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents" 
  ON public.documents FOR INSERT 
  WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents" 
  ON public.documents FOR UPDATE 
  USING (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents" 
  ON public.documents FOR DELETE 
  USING (auth.uid() = uploaded_by);
