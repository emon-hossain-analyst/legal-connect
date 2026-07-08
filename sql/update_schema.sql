-- ==============================================================================
-- LegalConnect Complete Schema & Permissions Standardization Script
-- ==============================================================================
-- Run this SQL script in your Supabase SQL Editor to resolve permission denied 
-- errors, missing column errors, and configure Row Level Security (RLS) policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. GRANT ALL GRANTS TO SUPABASE ROLES (Prevents 'permission denied for table X')
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 1. CONTRACTS TABLE & POLICIES (Fixes 'permission denied for table contracts')
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY
);

ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS lawyer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS workspace_id UUID,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated for contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can view own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can update own contracts" ON public.contracts;

CREATE POLICY "Allow all authenticated for contracts" 
ON public.contracts FOR ALL 
USING (true) 
WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 2. CONVERSATIONS TABLE & POLICIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY
);

ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS lawyer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS contract_id UUID,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_client_lawyer_pair'
  ) THEN
    ALTER TABLE public.conversations ADD CONSTRAINT unique_client_lawyer_pair UNIQUE(client_id, lawyer_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint unique_client_lawyer_pair handled.';
END $$;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated for conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;

CREATE POLICY "Allow all authenticated for conversations" 
ON public.conversations FOR ALL 
USING (true) 
WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 3. MESSAGES TABLE & REAL-TIME PUBLICATION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY
);

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated for messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can mark messages read" ON public.messages;

CREATE POLICY "Allow all authenticated for messages" 
ON public.messages FOR ALL 
USING (true) 
WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Publication supabase_realtime handled.';
END $$;


-- ------------------------------------------------------------------------------
-- 4. APPOINTMENTS TABLE STANDARDIZATION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY
);

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS lawyer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS consultation_type VARCHAR(50) DEFAULT 'Video',
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated for appointments" ON public.appointments;
CREATE POLICY "Allow all authenticated for appointments" 
ON public.appointments FOR ALL 
USING (true) 
WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 5. LAWYERS & USERS SPECIALIZATION & PERMISSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lawyers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY
);

ALTER TABLE public.lawyers 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS specialization TEXT[];

-- ------------------------------------------------------------------------------
-- 6. STRICT DOCUMENTS TABLE PRIVACY & RLS SECURITY MIGRATION
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY
);

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS lawyer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS storage_url TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS file_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'chat',
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated for documents" ON public.documents;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.documents;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.documents;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.documents;
DROP POLICY IF EXISTS "Verification File Policy" ON public.documents;
DROP POLICY IF EXISTS "Chat File Policy" ON public.documents;
DROP POLICY IF EXISTS "Insert Documents Policy" ON public.documents;
DROP POLICY IF EXISTS "Update Documents Policy" ON public.documents;

-- 1. Verification File Policy: Only owning Lawyer or System Admins can view verification files
CREATE POLICY "Verification File Policy"
ON public.documents FOR SELECT
USING (
  document_type = 'verification' AND (
    auth.uid() = lawyer_id OR
    auth.uid() = uploaded_by OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND user_type::text ILIKE 'admin'
    )
  )
);

-- 2. Chat File Policy: Only Client or Lawyer participating in the linked conversation can view chat files
CREATE POLICY "Chat File Policy"
ON public.documents FOR SELECT
USING (
  document_type = 'chat' AND (
    auth.uid() = client_id OR 
    auth.uid() = lawyer_id OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = public.documents.conversation_id AND (c.client_id = auth.uid() OR c.lawyer_id = auth.uid())
    )
  )
);

-- 3. Insert Documents Policy: Authenticated users can insert their own documents
CREATE POLICY "Insert Documents Policy"
ON public.documents FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by OR auth.uid() = client_id OR auth.uid() = lawyer_id
);

-- 4. Update Documents Policy: Only uploader or owner can update
CREATE POLICY "Update Documents Policy"
ON public.documents FOR UPDATE
USING (
  auth.uid() = uploaded_by OR auth.uid() = client_id OR auth.uid() = lawyer_id
);
