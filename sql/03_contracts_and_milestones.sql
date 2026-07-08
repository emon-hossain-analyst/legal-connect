-- =============================================================================
-- Phase 3: Contracts and Milestones
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contracts (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES public.jobs(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  agreed_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status contract_status_enum NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_client ON public.contracts(client_id);
CREATE INDEX idx_contracts_lawyer ON public.contracts(lawyer_id);
CREATE INDEX idx_contracts_workspace ON public.contracts(workspace_id);

CREATE TABLE IF NOT EXISTS public.contract_milestones (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  due_date DATE,
  status milestone_status_enum NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_milestones_contract ON public.contract_milestones(contract_id);
