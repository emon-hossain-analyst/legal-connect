-- =============================================================================
-- Phase 5: Cases and Appointments
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id SERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status appointment_status_enum NOT NULL DEFAULT 'pending',
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  notes TEXT,
  meeting_link TEXT,
  location VARCHAR(255),
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_client ON public.appointments(client_id);
CREATE INDEX idx_appointments_lawyer ON public.appointments(lawyer_id);

CREATE TABLE IF NOT EXISTS public.cases (
  id SERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status case_status_enum NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cases_client ON public.cases(client_id);
CREATE INDEX idx_cases_lawyer ON public.cases(lawyer_id);

CREATE TABLE IF NOT EXISTS public.case_progress (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  progress_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_progress_case ON public.case_progress(case_id);
