-- =============================================================================
-- Phase 6: Communication and Documents
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.contracts(workspace_id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sender_name VARCHAR(255) NOT NULL,
  sender_role user_role_enum NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_workspace ON public.messages(workspace_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created ON public.messages(created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE messages;

CREATE TABLE IF NOT EXISTS public.documents (
  id SERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  case_id INTEGER REFERENCES public.cases(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_url TEXT NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(100),
  category VARCHAR(100),
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_client ON public.documents(client_id);
CREATE INDEX idx_documents_case ON public.documents(case_id);
