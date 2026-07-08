-- =============================================================================
-- Migration 26: Complete Architectural Overhaul
-- Unified Supabase Database Schema linking auth.users, relational tables, and RLS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure auth_id is unique on existing public.users table if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_auth_id_key UNIQUE (auth_id);
  END IF;
EXCEPTION
  WHEN others THEN null;
END $$;

-- Helper macro function to verify admin status safely in RLS policies
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE (id = auth.uid() OR auth_id = auth.uid()) AND user_type = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 1. PROFILES & ROLES (Linked to Supabase auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_id UUID UNIQUE DEFAULT auth.uid(),
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('client', 'lawyer', 'admin')),
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('client', 'lawyer', 'admin')),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync trigger between users and profiles
CREATE OR REPLACE FUNCTION public.sync_user_profile() RETURNS TRIGGER AS $$
DECLARE
  v_id UUID := COALESCE(NEW.id, NEW.auth_id);
BEGIN
  INSERT INTO public.profiles (id, user_type, full_name, email, phone, profile_picture_url, created_at, updated_at)
  VALUES (v_id, NEW.user_type, NEW.name, NEW.email, NEW.phone, NEW.profile_picture_url, NEW.created_at, NEW.updated_at)
  ON CONFLICT (id) DO UPDATE SET
    user_type = EXCLUDED.user_type,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    profile_picture_url = EXCLUDED.profile_picture_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_user_profile ON public.users;
CREATE TRIGGER trg_sync_user_profile
  AFTER INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();

-- -----------------------------------------------------------------------------
-- 2. LAWYER SPECIFICS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lawyer_credentials (
  lawyer_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bar_registration_number VARCHAR(100) UNIQUE NOT NULL,
  practice_areas TEXT[] DEFAULT '{}',
  education JSONB DEFAULT '[]'::jsonb,
  certifications JSONB DEFAULT '[]'::jsonb,
  court_admissions TEXT[] DEFAULT '{}',
  years_experience INT DEFAULT 0,
  hourly_rate NUMERIC(10, 2) DEFAULT 0.00,
  bio TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lawyer_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('national_id', 'passport', 'bar_license', 'chamber_license')),
  document_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.lawyer_availability (
  lawyer_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_schedule JSONB DEFAULT '{"monday": [], "tuesday": [], "wednesday": [], "thursday": [], "friday": [], "saturday": [], "sunday": []}'::jsonb,
  active_days VARCHAR(20)[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  consultation_rules JSONB DEFAULT '{"buffer_minutes": 15, "max_daily_slots": 8}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. SHARED ENTITIES (JUNCTIONS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Active', 'Pending', 'Closed')),
  budget NUMERIC(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,
  type VARCHAR(20) DEFAULT 'Video' CHECK (type IN ('Video', 'In-person', 'Phone')),
  status VARCHAR(20) DEFAULT 'Upcoming' CHECK (status IN ('Upcoming', 'Completed', 'Cancelled', 'Rescheduled')),
  meeting_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID UNIQUE DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  terms TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending_Signature', 'Active', 'Completed', 'Terminated')),
  pdf_storage_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  signed_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 4. REAL-TIME MESSAGING SYSTEM
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, lawyer_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.contracts(workspace_id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image')),
  content TEXT,
  attachment_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync trigger to populate both workspace_id and conversation_id on messages
CREATE OR REPLACE FUNCTION public.sync_message_ids() RETURNS TRIGGER AS $$
DECLARE
  v_client UUID;
  v_lawyer UUID;
  v_conv UUID;
  v_work UUID;
BEGIN
  IF NEW.conversation_id IS NOT NULL AND NEW.workspace_id IS NULL THEN
    SELECT client_id, lawyer_id INTO v_client, v_lawyer FROM public.conversations WHERE id = NEW.conversation_id;
    SELECT workspace_id INTO v_work FROM public.contracts WHERE (client_id = v_client AND lawyer_id = v_lawyer) OR (client_id = v_lawyer AND lawyer_id = v_client) LIMIT 1;
    IF v_work IS NOT NULL THEN NEW.workspace_id := v_work; END IF;
  ELSIF NEW.workspace_id IS NOT NULL AND NEW.conversation_id IS NULL THEN
    SELECT client_id, lawyer_id INTO v_client, v_lawyer FROM public.contracts WHERE workspace_id = NEW.workspace_id;
    SELECT id INTO v_conv FROM public.conversations WHERE (client_id = v_client AND lawyer_id = v_lawyer) OR (client_id = v_lawyer AND lawyer_id = v_client) LIMIT 1;
    IF v_conv IS NULL AND v_client IS NOT NULL AND v_lawyer IS NOT NULL THEN
      INSERT INTO public.conversations (client_id, lawyer_id) VALUES (v_client, v_lawyer) RETURNING id INTO v_conv;
    END IF;
    IF v_conv IS NOT NULL THEN NEW.conversation_id := v_conv; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_message_ids ON public.messages;
CREATE TRIGGER trg_sync_message_ids
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_message_ids();

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users / Profiles RLS
DROP POLICY IF EXISTS "Users viewable by everyone" ON public.users;
CREATE POLICY "Users viewable by everyone" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.users;
CREATE POLICY "Users update own profile" ON public.users FOR UPDATE USING (auth.uid() = id OR auth.uid() = auth_id);

DROP POLICY IF EXISTS "Users insert own profile" ON public.users;
CREATE POLICY "Users insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() = auth_id);

DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Lawyer Credentials & Availability RLS
DROP POLICY IF EXISTS "Credentials viewable by all" ON public.lawyer_credentials;
CREATE POLICY "Credentials viewable by all" ON public.lawyer_credentials FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lawyers manage own credentials" ON public.lawyer_credentials;
CREATE POLICY "Lawyers manage own credentials" ON public.lawyer_credentials FOR ALL USING (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "Availability viewable by all" ON public.lawyer_availability;
CREATE POLICY "Availability viewable by all" ON public.lawyer_availability FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lawyers manage own availability" ON public.lawyer_availability;
CREATE POLICY "Lawyers manage own availability" ON public.lawyer_availability FOR ALL USING (auth.uid() = lawyer_id);

-- Lawyer Verifications RLS
DROP POLICY IF EXISTS "Lawyers manage own verifications" ON public.lawyer_verifications;
CREATE POLICY "Lawyers manage own verifications" ON public.lawyer_verifications FOR ALL USING (auth.uid() = lawyer_id OR public.is_admin());

-- Shared Entities RLS
DROP POLICY IF EXISTS "Participants access cases" ON public.cases;
CREATE POLICY "Participants access cases" ON public.cases FOR ALL 
  USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());

DROP POLICY IF EXISTS "Participants access appointments" ON public.appointments;
CREATE POLICY "Participants access appointments" ON public.appointments FOR ALL 
  USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());

DROP POLICY IF EXISTS "Participants access contracts" ON public.contracts;
CREATE POLICY "Participants access contracts" ON public.contracts FOR ALL 
  USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());

-- Messaging RLS
DROP POLICY IF EXISTS "Participants access conversations" ON public.conversations;
CREATE POLICY "Participants access conversations" ON public.conversations FOR ALL 
  USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());

DROP POLICY IF EXISTS "Participants access messages" ON public.messages;
CREATE POLICY "Participants access messages" ON public.messages FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id = messages.conversation_id 
        AND (c.client_id = auth.uid() OR c.lawyer_id = auth.uid() OR public.is_admin())
    ) OR EXISTS (
      SELECT 1 FROM public.contracts ct
      WHERE ct.workspace_id = messages.workspace_id
        AND (ct.client_id = auth.uid() OR ct.lawyer_id = auth.uid() OR public.is_admin())
    )
  );
