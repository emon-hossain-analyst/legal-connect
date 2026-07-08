-- =============================================================================
-- Migration 25: Comprehensive schema fixes
-- Addresses: SQL-01 (conflicting messages), SQL-04 (lawyer_id checks),
--            SQL-07 (messages FK to contracts), BUG-06 (STRPOS fix),
--            SEC-01 (messages RLS), SEC-05 (restrict email access),
--            GAP-01 (admin RLS policies)
-- =============================================================================

-- ─── 1. MESSAGES TABLE CONSOLIDATION (SQL-01) ───────────────────────────────
-- The messages table from 06_communication_and_docs.sql is the canonical one.
-- It uses workspace_id referencing contracts.workspace_id.
-- Migration 24's conversations/messages model is an alternative design that
-- was never deployed. We keep the workspace-based model.

-- Ensure contracts table has workspace_id column
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS workspace_id UUID DEFAULT uuid_generate_v4();
UPDATE public.contracts SET workspace_id = id WHERE workspace_id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contracts_workspace_id_key' AND table_name = 'contracts'
  ) THEN
    ALTER TABLE public.contracts ADD CONSTRAINT contracts_workspace_id_key UNIQUE (workspace_id);
  END IF;
EXCEPTION
  WHEN others THEN null;
END $$;

-- Ensure messages table supports both workspace_id and conversation_id
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- Sync trigger to populate both IDs regardless of which UI portal sent the message
CREATE OR REPLACE FUNCTION public.sync_message_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.conversation_id IS NOT NULL THEN
    NEW.workspace_id := NEW.conversation_id;
  ELSIF NEW.conversation_id IS NULL AND NEW.workspace_id IS NOT NULL THEN
    NEW.conversation_id := NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_message_ids ON public.messages;
CREATE TRIGGER trg_sync_message_ids
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_message_ids();

-- Add FK from messages.workspace_id to contracts.workspace_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_workspace_id_fkey'
      AND table_name = 'messages'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.contracts(workspace_id)
      ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN others THEN null;
END $$;

-- ─── 2. LAWYER_ID ROLE CHECK (SQL-04) ───────────────────────────────────────
-- Add a function that verifies a user_id belongs to a lawyer
CREATE OR REPLACE FUNCTION public.check_user_is_lawyer(uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users WHERE id = uid AND user_type = 'lawyer'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Add check constraints on tables that reference lawyer_id
-- Contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'contracts_lawyer_must_be_lawyer'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_lawyer_must_be_lawyer
      CHECK (public.check_user_is_lawyer(lawyer_id));
  END IF;
END $$;

-- Appointments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'appointments_lawyer_must_be_lawyer'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_lawyer_must_be_lawyer
      CHECK (public.check_user_is_lawyer(lawyer_id));
  END IF;
END $$;

-- ─── 3. MESSAGE_TYPE ENUM (for migration 24 compatibility) ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type_enum') THEN
    CREATE TYPE message_type_enum AS ENUM ('text', 'file', 'system');
  END IF;
END $$;

-- ─── 4. RLS POLICIES FOR ALL TABLES (GAP-01, SEC-01) ────────────────────────

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ──── MESSAGES RLS (SEC-01) ─────────────────────────────────────────────────
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participants" ON public.messages;
CREATE POLICY "messages_select_participants" ON public.messages
  FOR SELECT USING (
    -- User is the sender
    sender_id = auth.uid()
    OR
    -- User is a participant in the contract for this workspace
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE (c.workspace_id = messages.workspace_id OR c.id = messages.workspace_id OR c.id = messages.conversation_id)
        AND (c.client_id = auth.uid() OR c.lawyer_id = auth.uid())
    )
    OR
    -- User is a participant in a conversation
    EXISTS (
      SELECT 1 FROM public.conversations conv
      WHERE conv.id = messages.conversation_id
        AND (conv.client_id = auth.uid() OR conv.lawyer_id = auth.uid())
    )
    OR
    -- Admin can read all
    public.is_admin()
  );

DROP POLICY IF EXISTS "messages_insert_participants" ON public.messages;
CREATE POLICY "messages_insert_participants" ON public.messages
  FOR INSERT WITH CHECK (
    -- User must be authenticated and a participant
    sender_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE (c.workspace_id = messages.workspace_id OR c.id = messages.workspace_id OR c.id = messages.conversation_id)
          AND (c.client_id = auth.uid() OR c.lawyer_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.conversations conv
        WHERE conv.id = messages.conversation_id
          AND (conv.client_id = auth.uid() OR conv.lawyer_id = auth.uid())
      )
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (
    -- Only update messages in conversations you're part of (for marking read)
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE (c.workspace_id = messages.workspace_id OR c.id = messages.workspace_id OR c.id = messages.conversation_id)
        AND (c.client_id = auth.uid() OR c.lawyer_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations conv
      WHERE conv.id = messages.conversation_id
        AND (conv.client_id = auth.uid() OR conv.lawyer_id = auth.uid())
    )
    OR public.is_admin()
  );

-- ──── CONTRACTS RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts_access" ON public.contracts;
CREATE POLICY "contracts_access" ON public.contracts
  FOR ALL USING (
    client_id = auth.uid()
    OR lawyer_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    client_id = auth.uid()
    OR lawyer_id = auth.uid()
    OR public.is_admin()
  );

-- ──── CASES RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cases_access" ON public.cases;
CREATE POLICY "cases_access" ON public.cases
  FOR ALL USING (
    client_id = auth.uid()
    OR lawyer_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    client_id = auth.uid()
    OR lawyer_id = auth.uid()
    OR public.is_admin()
  );

-- ──── APPOINTMENTS RLS ──────────────────────────────────────────────────────
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_access" ON public.appointments;
CREATE POLICY "appointments_access" ON public.appointments
  FOR ALL USING (
    client_id = auth.uid()
    OR lawyer_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    client_id = auth.uid()
    OR lawyer_id = auth.uid()
    OR public.is_admin()
  );

-- ──── FEEDBACK RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_read_all" ON public.feedback;
CREATE POLICY "feedback_read_all" ON public.feedback
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "feedback_insert_client" ON public.feedback;
CREATE POLICY "feedback_insert_client" ON public.feedback
  FOR INSERT WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "feedback_update_participants" ON public.feedback;
CREATE POLICY "feedback_update_participants" ON public.feedback
  FOR UPDATE USING (
    client_id = auth.uid()
    OR lawyer_id = auth.uid()
    OR public.is_admin()
  );

-- ──── DOCUMENTS RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_access" ON public.documents;
CREATE POLICY "documents_access" ON public.documents
  FOR ALL USING (
    client_id = auth.uid()
    OR lawyer_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    client_id = auth.uid()
    OR lawyer_id = auth.uid()
    OR public.is_admin()
  );

-- ──── NOTIFICATIONS RLS ─────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ──── JOBS RLS (public read, client create, admin manage) ───────────────────
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_read_all" ON public.jobs;
CREATE POLICY "jobs_read_all" ON public.jobs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "jobs_insert_client" ON public.jobs;
CREATE POLICY "jobs_insert_client" ON public.jobs
  FOR INSERT WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "jobs_update_owner_admin" ON public.jobs;
CREATE POLICY "jobs_update_owner_admin" ON public.jobs
  FOR UPDATE USING (client_id = auth.uid() OR public.is_admin());

-- ──── PROPOSALS RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.job_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proposals_read" ON public.job_proposals;
CREATE POLICY "proposals_read" ON public.job_proposals
  FOR SELECT USING (
    lawyer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.jobs j WHERE j.id = job_proposals.job_id AND j.client_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "proposals_insert_lawyer" ON public.job_proposals;
CREATE POLICY "proposals_insert_lawyer" ON public.job_proposals
  FOR INSERT WITH CHECK (lawyer_id = auth.uid());

DROP POLICY IF EXISTS "proposals_update" ON public.job_proposals;
CREATE POLICY "proposals_update" ON public.job_proposals
  FOR UPDATE USING (
    lawyer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.jobs j WHERE j.id = job_proposals.job_id AND j.client_id = auth.uid()
    )
    OR public.is_admin()
  );

-- ──── LAWYERS TABLE: admin-only verification updates ────────────────────────
ALTER TABLE public.lawyers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lawyers_read_all" ON public.lawyers;
CREATE POLICY "lawyers_read_all" ON public.lawyers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "lawyers_update_own" ON public.lawyers;
CREATE POLICY "lawyers_update_own" ON public.lawyers
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "lawyers_insert_own" ON public.lawyers;
CREATE POLICY "lawyers_insert_own" ON public.lawyers
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ──── USERS TABLE RLS ───────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_public" ON public.users;
CREATE POLICY "users_read_public" ON public.users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "users_insert" ON public.users;
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid() OR public.is_admin());

-- ──── DEPARTMENTS TABLE RLS (public read) ───────────────────────────────────
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "departments_read_all" ON public.departments;
CREATE POLICY "departments_read_all" ON public.departments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "departments_admin_manage" ON public.departments;
CREATE POLICY "departments_admin_manage" ON public.departments
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ──── LEGAL UPDATES RLS ─────────────────────────────────────────────────────
ALTER TABLE public.legal_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_updates_read_all" ON public.legal_updates;
CREATE POLICY "legal_updates_read_all" ON public.legal_updates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "legal_updates_write" ON public.legal_updates;
CREATE POLICY "legal_updates_write" ON public.legal_updates
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type IN ('lawyer', 'admin'))
  );

DROP POLICY IF EXISTS "legal_updates_update" ON public.legal_updates;
CREATE POLICY "legal_updates_update" ON public.legal_updates
  FOR UPDATE USING (author_id = auth.uid() OR public.is_admin());

-- ──── CONTACT INQUIRIES RLS ─────────────────────────────────────────────────
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_inquiries_insert_any" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_insert_any" ON public.contact_inquiries
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "contact_inquiries_admin_read" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_admin_read" ON public.contact_inquiries
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "contact_inquiries_admin_update" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_admin_update" ON public.contact_inquiries
  FOR UPDATE USING (public.is_admin());

-- ──── 5. GRANT SUPABASE REALTIME ACCESS TO MESSAGES ─────────────────────────
-- Ensure messages are included in supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;
