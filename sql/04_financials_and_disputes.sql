-- =============================================================================
-- Phase 4: Financials and Disputes
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.transactions (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  milestone_id INTEGER REFERENCES public.contract_milestones(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status payment_status_enum NOT NULL DEFAULT 'pending',
  stripe_payment_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_contract ON public.transactions(contract_id);
CREATE INDEX idx_transactions_client ON public.transactions(client_id);
CREATE INDEX idx_transactions_lawyer ON public.transactions(lawyer_id);

CREATE TABLE IF NOT EXISTS public.disputes (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status dispute_status_enum NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_contract ON public.disputes(contract_id);
CREATE INDEX idx_disputes_raised_by ON public.disputes(raised_by);
