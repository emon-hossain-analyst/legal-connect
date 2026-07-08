-- =============================================================================
-- Phase 1: Authentication and Users
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_id UUID GENERATED ALWAYS AS (id) STORED,
  email VARCHAR(255) UNIQUE NOT NULL,
  user_type user_role_enum NOT NULL DEFAULT 'client',
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  profile_picture_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_type ON public.users(user_type);
CREATE INDEX idx_users_auth_id ON public.users(auth_id);

CREATE TABLE IF NOT EXISTS public.departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lawyers (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  slug VARCHAR(255) UNIQUE,
  bar_number VARCHAR(100) UNIQUE,
  specialization VARCHAR(255),
  location VARCHAR(255),
  bio TEXT,
  experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status verification_status_enum NOT NULL DEFAULT 'pending',
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (avg_rating BETWEEN 0 AND 5),
  total_reviews INTEGER NOT NULL DEFAULT 0,
  completed_cases INTEGER NOT NULL DEFAULT 0,
  subscription_plan subscription_plan_enum NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lawyers_slug ON public.lawyers(slug);
CREATE INDEX idx_lawyers_is_verified ON public.lawyers(is_verified);

CREATE TABLE IF NOT EXISTS public.lawyer_departments (
  lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (lawyer_id, department_id)
);
CREATE INDEX idx_lawyer_departments_dept ON public.lawyer_departments(department_id);
