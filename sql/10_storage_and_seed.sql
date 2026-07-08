-- =============================================================================
-- Phase 10: Storage Buckets and Seed Data
-- =============================================================================

-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create documents bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Avatars Policies (Public Read, Authenticated Insert/Update)
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible." 
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatars." ON storage.objects;
CREATE POLICY "Users can upload their own avatars." 
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can update their own avatars." ON storage.objects;
CREATE POLICY "Users can update their own avatars." 
  ON storage.objects FOR UPDATE USING (
    bucket_id = 'avatars' AND auth.uid() IS NOT NULL
  );

-- Documents Policies (Authenticated Read/Write)
DROP POLICY IF EXISTS "Authenticated users can read documents." ON storage.objects;
CREATE POLICY "Authenticated users can read documents." 
  ON storage.objects FOR SELECT USING (
    bucket_id = 'documents' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Authenticated users can upload documents." ON storage.objects;
CREATE POLICY "Authenticated users can upload documents." 
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can update their own documents." ON storage.objects;
CREATE POLICY "Users can update their own documents." 
  ON storage.objects FOR UPDATE USING (
    bucket_id = 'documents' AND auth.uid() IS NOT NULL
  );

-- =============================================================================
-- Seed Data
-- =============================================================================

-- Departments
INSERT INTO public.departments (name, slug) VALUES
  ('Corporate and Business Law',               'corporate-business-law'),
  ('Intellectual Property and Technology Law', 'intellectual-property-technology-law'),
  ('Criminal Defense Law',                     'criminal-defense-law'),
  ('Family, Marriage and Civil Law',           'family-marriage-civil-law'),
  ('Property, Real Estate and Land Law',       'property-real-estate-land-law'),
  ('Labor, Employment and HR Law',             'labor-employment-hr-law'),
  ('Tax, Financial and Banking Law',           'tax-financial-banking-law'),
  ('Immigration and Human Rights Law',         'immigration-human-rights-law')
ON CONFLICT (slug) DO NOTHING;
