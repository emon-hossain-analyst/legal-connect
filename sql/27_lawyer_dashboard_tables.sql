-- =============================================================================
-- Migration 27: Lawyer Dashboard Unified Schema & RLS Policies
-- Creates missing tables: cases, appointments, contracts, billing_invoices
-- All tables link back to authenticated lawyer (lawyer_id UUID REFERENCES auth.users(id))
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. CASES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'General',
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Pending', 'Closed')),
  budget NUMERIC(12, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lawyers select own cases" ON public.cases;
CREATE POLICY "Lawyers select own cases" ON public.cases
  FOR SELECT USING (auth.uid() = lawyer_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "Lawyers insert own cases" ON public.cases;
CREATE POLICY "Lawyers insert own cases" ON public.cases
  FOR INSERT WITH CHECK (auth.uid() = lawyer_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "Lawyers update own cases" ON public.cases;
CREATE POLICY "Lawyers update own cases" ON public.cases
  FOR UPDATE USING (auth.uid() = lawyer_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "Lawyers delete own cases" ON public.cases;
CREATE POLICY "Lawyers delete own cases" ON public.cases
  FOR DELETE USING (auth.uid() = lawyer_id);


-- -----------------------------------------------------------------------------
-- 2. APPOINTMENTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  title VARCHAR(255) DEFAULT 'Consultation Meeting',
  scheduled_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes INT DEFAULT 30,
  type VARCHAR(50) DEFAULT 'Video' CHECK (type IN ('Video', 'In-person', 'Phone')),
  status VARCHAR(50) DEFAULT 'Upcoming' CHECK (status IN ('Upcoming', 'Completed', 'Cancelled', 'Rescheduled')),
  meeting_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lawyers select own appointments" ON public.appointments;
CREATE POLICY "Lawyers select own appointments" ON public.appointments
  FOR SELECT USING (auth.uid() = lawyer_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "Lawyers insert own appointments" ON public.appointments;
CREATE POLICY "Lawyers insert own appointments" ON public.appointments
  FOR INSERT WITH CHECK (auth.uid() = lawyer_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "Lawyers update own appointments" ON public.appointments;
CREATE POLICY "Lawyers update own appointments" ON public.appointments
  FOR UPDATE USING (auth.uid() = lawyer_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "Lawyers delete own appointments" ON public.appointments;
CREATE POLICY "Lawyers delete own appointments" ON public.appointments
  FOR DELETE USING (auth.uid() = lawyer_id);


-- -----------------------------------------------------------------------------
-- 3. CONTRACTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID UNIQUE DEFAULT uuid_generate_v4(),
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  terms TEXT DEFAULT 'Standard legal representation terms.',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending_Signature', 'Active', 'Completed', 'Terminated')),
  pdf_storage_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  signed_at TIMESTAMPTZ
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lawyers select own contracts" ON public.contracts;
CREATE POLICY "Lawyers select own contracts" ON public.contracts
  FOR SELECT USING (auth.uid() = lawyer_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "Lawyers insert own contracts" ON public.contracts;
CREATE POLICY "Lawyers insert own contracts" ON public.contracts
  FOR INSERT WITH CHECK (auth.uid() = lawyer_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "Lawyers update own contracts" ON public.contracts;
CREATE POLICY "Lawyers update own contracts" ON public.contracts
  FOR UPDATE USING (auth.uid() = lawyer_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "Lawyers delete own contracts" ON public.contracts;
CREATE POLICY "Lawyers delete own contracts" ON public.contracts
  FOR DELETE USING (auth.uid() = lawyer_id);


-- -----------------------------------------------------------------------------
-- 4. BILLING INVOICES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  client_name VARCHAR(150) DEFAULT 'Legal Client',
  invoice_number VARCHAR(100) UNIQUE DEFAULT ('INV-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8))),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'paid', 'cancelled')),
  due_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lawyers select own billing invoices" ON public.billing_invoices;
CREATE POLICY "Lawyers select own billing invoices" ON public.billing_invoices
  FOR SELECT USING (auth.uid() = lawyer_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "Lawyers insert own billing invoices" ON public.billing_invoices;
CREATE POLICY "Lawyers insert own billing invoices" ON public.billing_invoices
  FOR INSERT WITH CHECK (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "Lawyers update own billing invoices" ON public.billing_invoices;
CREATE POLICY "Lawyers update own billing invoices" ON public.billing_invoices
  FOR UPDATE USING (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "Lawyers delete own billing invoices" ON public.billing_invoices;
CREATE POLICY "Lawyers delete own billing invoices" ON public.billing_invoices
  FOR DELETE USING (auth.uid() = lawyer_id);
