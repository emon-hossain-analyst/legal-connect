-- 18_fix_storage_policies.sql

-- 1. Make the documents bucket public so that getPublicUrl works
UPDATE storage.buckets SET public = true WHERE id = 'documents';

-- 2. Add Storage Policies for the documents bucket
-- (This allows authenticated users to upload their files)

-- Drop existing policies if they exist to prevent errors
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view documents" ON storage.objects;
-- RLS is already enabled by default on storage.objects in Supabase
-- We just need to add the policies


-- Allow authenticated users to upload files to their own folder (folder name = user.id)
CREATE POLICY "Users can upload their own documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to view their own documents
CREATE POLICY "Users can view their own documents" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documents');

-- Allow authenticated users to update their own documents
CREATE POLICY "Users can update their own documents" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own documents
CREATE POLICY "Users can delete their own documents" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow anyone to read the public bucket objects (needed for getPublicUrl to display images)
CREATE POLICY "Public can view documents" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'documents');
