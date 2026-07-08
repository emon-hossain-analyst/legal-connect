-- =============================================================================
-- Phase 2: Jobs and Proposals
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
  id SERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  budget_min NUMERIC(10,2) NOT NULL,
  budget_max NUMERIC(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  deadline DATE NOT NULL,
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  status job_status_enum NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_client ON public.jobs(client_id);
CREATE INDEX idx_jobs_department ON public.jobs(department_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);

CREATE TABLE IF NOT EXISTS public.job_proposals (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cover_letter TEXT NOT NULL,
  proposed_fee NUMERIC(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  estimated_duration_days INTEGER NOT NULL CHECK (estimated_duration_days > 0),
  status proposal_status_enum NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, lawyer_id)
);

CREATE INDEX idx_job_proposals_job ON public.job_proposals(job_id);
CREATE INDEX idx_job_proposals_lawyer ON public.job_proposals(lawyer_id);
