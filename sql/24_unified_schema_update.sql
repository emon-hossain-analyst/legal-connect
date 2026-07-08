-- ============================================================================
-- 24_unified_schema_update.sql
-- WARNING: This script drops existing mock tables and recreates them
-- with the new unified, dynamic architecture.
-- ============================================================================

-- Enable UUID extension for auto-generating primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Standard Trigger Function for Auto-updating 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CLEANUP EXISTING TABLES (WIPING DATA FOR NEW ARCHITECTURE)
-- ============================================================================
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.contracts CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.case_progress CASCADE;
DROP TABLE IF EXISTS public.cases CASCADE;

-- ============================================================================
-- ENUM DEFINITIONS (DROP IF EXISTS TO AVOID CONFLICTS)
-- ============================================================================
DROP TYPE IF EXISTS case_status_enum CASCADE;
DROP TYPE IF EXISTS appointment_status_enum CASCADE;
DROP TYPE IF EXISTS contract_status_enum CASCADE;
DROP TYPE IF EXISTS message_type_enum CASCADE;

CREATE TYPE case_status_enum AS ENUM ('Active', 'Pending', 'Closed');
CREATE TYPE appointment_status_enum AS ENUM ('Upcoming', 'Pending', 'Completed', 'Cancelled');
CREATE TYPE contract_status_enum AS ENUM ('Draft', 'Sent', 'Signed', 'Active', 'Terminated');
CREATE TYPE message_type_enum AS ENUM ('text', 'file', 'image', 'system');

-- ============================================================================
-- 1. CASES MODULE
-- ============================================================================
CREATE TABLE public.cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    status case_status_enum NOT NULL DEFAULT 'Pending',
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cases_lawyer_id ON cases(lawyer_id);
CREATE INDEX idx_cases_client_id ON cases(client_id);
CREATE INDEX idx_cases_status ON cases(status);

CREATE TRIGGER update_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lawyers can access and modify their cases" 
    ON public.cases FOR ALL 
    USING (auth.uid() = lawyer_id) 
    WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "Clients can access and modify their cases" 
    ON public.cases FOR ALL 
    USING (auth.uid() = client_id) 
    WITH CHECK (auth.uid() = client_id);

CREATE TABLE public.case_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    progress_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_progress_case_id ON case_progress(case_id);

CREATE TRIGGER update_case_progress_updated_at
    BEFORE UPDATE ON case_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.case_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lawyers can access and modify case progress" 
    ON public.case_progress FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_progress.case_id AND c.lawyer_id = auth.uid())) 
    WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_progress.case_id AND c.lawyer_id = auth.uid()));

CREATE POLICY "Clients can view case progress" 
    ON public.case_progress FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_progress.case_id AND c.client_id = auth.uid()));

-- ============================================================================
-- 2. APPOINTMENTS MODULE
-- ============================================================================
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    consultation_type VARCHAR(100),
    meeting_details TEXT,
    status appointment_status_enum NOT NULL DEFAULT 'Upcoming',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_lawyer_id ON appointments(lawyer_id);
CREATE INDEX idx_appointments_client_id ON appointments(client_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_scheduled_at ON appointments(scheduled_at);

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lawyers can access and modify their appointments" 
    ON public.appointments FOR ALL 
    USING (auth.uid() = lawyer_id) 
    WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "Clients can access and modify their appointments" 
    ON public.appointments FOR ALL 
    USING (auth.uid() = client_id) 
    WITH CHECK (auth.uid() = client_id);

-- ============================================================================
-- 3. CONTRACTS & AGREEMENTS MODULE
-- ============================================================================
CREATE TABLE public.contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    terms TEXT,
    amount NUMERIC(15, 2),
    storage_url VARCHAR(512),
    status contract_status_enum NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_lawyer_id ON contracts(lawyer_id);
CREATE INDEX idx_contracts_client_id ON contracts(client_id);
CREATE INDEX idx_contracts_case_id ON contracts(case_id);
CREATE INDEX idx_contracts_status ON contracts(status);

CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lawyers can access and modify their contracts" 
    ON public.contracts FOR ALL 
    USING (auth.uid() = lawyer_id) 
    WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "Clients can access and modify their contracts" 
    ON public.contracts FOR ALL 
    USING (auth.uid() = client_id) 
    WITH CHECK (auth.uid() = client_id);

-- ============================================================================
-- 4. ADVANCED MESSAGING & COMMUNICATION MODULE
-- ============================================================================
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_lawyer_client_conversation UNIQUE (lawyer_id, client_id)
);

CREATE INDEX idx_conversations_lawyer_id ON conversations(lawyer_id);
CREATE INDEX idx_conversations_client_id ON conversations(client_id);
CREATE INDEX idx_conversations_is_archived ON conversations(is_archived);

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lawyers can access and modify their conversations" 
    ON public.conversations FOR ALL 
    USING (auth.uid() = lawyer_id) 
    WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "Clients can access and modify their conversations" 
    ON public.conversations FOR ALL 
    USING (auth.uid() = client_id) 
    WITH CHECK (auth.uid() = client_id);


CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT,
    message_type message_type_enum NOT NULL DEFAULT 'text',
    attachment_url VARCHAR(512),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access and modify messages in their conversations" 
    ON public.messages FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c 
            WHERE c.id = messages.conversation_id 
            AND (c.lawyer_id = auth.uid() OR c.client_id = auth.uid())
        )
    ) 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c 
            WHERE c.id = messages.conversation_id 
            AND (c.lawyer_id = auth.uid() OR c.client_id = auth.uid())
        )
    );

-- ============================================================================
-- 5. UPGRADE DEPENDENT TABLES TO UUID
-- ============================================================================

-- Documents -> Cases
ALTER TABLE public.documents DROP COLUMN IF EXISTS case_id CASCADE;
ALTER TABLE public.documents ADD COLUMN case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL;

-- Feedback -> Appointments
ALTER TABLE public.feedback DROP COLUMN IF EXISTS appointment_id CASCADE;
ALTER TABLE public.feedback ADD COLUMN appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

-- Transactions -> Contracts
ALTER TABLE public.transactions DROP COLUMN IF EXISTS contract_id CASCADE;
ALTER TABLE public.transactions ADD COLUMN contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE;

-- Disputes -> Contracts
ALTER TABLE public.disputes DROP COLUMN IF EXISTS contract_id CASCADE;
ALTER TABLE public.disputes ADD COLUMN contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE;

-- Contract Milestones -> Contracts
ALTER TABLE public.contract_milestones DROP COLUMN IF EXISTS contract_id CASCADE;
ALTER TABLE public.contract_milestones ADD COLUMN contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE;
