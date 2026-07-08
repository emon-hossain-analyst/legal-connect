-- ==============================================================================
-- Migration: 004_security_and_rls_hardening.sql
-- Description: Hardens Row-Level Security (RLS) across storage buckets, 
--              administrative tables, and creates reusable security definer functions.
-- ==============================================================================

-- 1. Security Definer Helper: is_admin()
-- Avoids RLS recursion and guarantees clean administrative role checking.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() AND user_type = 'admin'
  );
$$;

-- 2. Security Definer Helper: is_workspace_participant(workspace_id)
-- Checks if the authenticated user is the client or lawyer of the workspace/contract.
CREATE OR REPLACE FUNCTION public.is_workspace_participant(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.contracts 
    WHERE (workspace_id = p_workspace_id OR id = p_workspace_id)
      AND (client_id = auth.uid() OR lawyer_id = auth.uid())
  ) OR public.is_admin();
$$;

-- 3. Security Definer Helper: is_conversation_participant(conversation_id)
-- Checks if the authenticated user is part of the chat conversation.
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.conversations 
    WHERE id = p_conversation_id
      AND (client_id = auth.uid() OR lawyer_id = auth.uid())
  ) OR public.is_admin();
$$;

-- 4. Storage Bucket Hardening for 'documents'
-- Ensure the documents bucket exists in storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 
  'documents', 
  true, 
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']::text[]
)
ON CONFLICT (id) DO UPDATE 
SET public = true, file_size_limit = 52428800;

-- Note: RLS is already enabled by default on storage.objects in Supabase.
-- Do NOT run ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; as it causes ERROR 42501 (must be owner of table objects).

-- Drop existing generic or loose policies on storage.objects for 'documents' if any
DROP POLICY IF EXISTS "Anyone can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Documents are readable by participants" ON storage.objects;
DROP POLICY IF EXISTS "Documents are uploadable by authenticated users" ON storage.objects;

-- Create strict storage policies for 'documents' bucket
CREATE POLICY "Documents readable by authenticated users and admins"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND (
    auth.role() = 'authenticated' 
    OR public.is_admin()
  )
);

CREATE POLICY "Documents uploadable by authenticated users"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Documents deletable by owner or admin"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' 
  AND (
    owner = auth.uid() 
    OR public.is_admin()
  )
);

-- 5. Harden Admin RLS on Commission & Verification Tables
-- Ensure tables exist before enabling RLS
CREATE TABLE IF NOT EXISTS public.platform_commission_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

INSERT INTO public.platform_commission_config (id, commission_percentage)
VALUES (1, 10.00)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.commission_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  contract_id UUID,
  lawyer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_transactions_lawyer ON public.commission_transactions(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_commission_transactions_payment ON public.commission_transactions(payment_id);

-- Ensure RLS is enabled
ALTER TABLE public.platform_commission_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_transactions ENABLE ROW LEVEL SECURITY;

-- Recreate Commission Config policies using is_admin()
DROP POLICY IF EXISTS "Anyone can read commission config" ON public.platform_commission_config;
DROP POLICY IF EXISTS "Only admins can update commission config" ON public.platform_commission_config;

CREATE POLICY "Anyone can read commission config"
ON public.platform_commission_config FOR SELECT
USING (true);

CREATE POLICY "Only admins can modify commission config"
ON public.platform_commission_config FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Recreate Commission Transactions policies using is_admin()
DROP POLICY IF EXISTS "Only admins can view commission transactions" ON public.commission_transactions;
DROP POLICY IF EXISTS "System can insert commission transactions" ON public.commission_transactions;

CREATE POLICY "Admins can view all commission transactions"
ON public.commission_transactions FOR SELECT
USING (public.is_admin());

CREATE POLICY "Lawyers can view their own commission transactions"
ON public.commission_transactions FOR SELECT
USING (lawyer_id = auth.uid());

CREATE POLICY "System and admins can insert commission transactions"
ON public.commission_transactions FOR INSERT
WITH CHECK (auth.role() = 'authenticated' OR public.is_admin());

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_participant(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(UUID) TO authenticated, anon;
