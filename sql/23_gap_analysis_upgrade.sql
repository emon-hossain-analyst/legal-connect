-- =============================================================================
-- LEGALCONNECT: COMPREHENSIVE DB GAP FIX SCRIPT
-- =============================================================================

-- 1. ADD MISSING ENUM VALUES
-- Executed safely via DO block
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'appointment_status_enum' AND e.enumlabel = 'upcoming') THEN
    ALTER TYPE appointment_status_enum ADD VALUE 'upcoming';
  END IF;
END $$;


-- 2. CREATE MISSING CLIENTS TABLE
CREATE TABLE IF NOT EXISTS public.clients (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone VARCHAR(50),
    dob DATE,
    nid VARCHAR(100),
    client_type VARCHAR(50) DEFAULT 'individual',
    company_name VARCHAR(255),
    registration_number VARCHAR(100),
    industry VARCHAR(100),
    company_size VARCHAR(50),
    designation VARCHAR(100),
    company_website VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Note: We must check if policies exist before creating them to ensure idempotency.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'Clients can read own data') THEN
        CREATE POLICY "Clients can read own data" ON public.clients FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'Clients can insert own data') THEN
        CREATE POLICY "Clients can insert own data" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'Clients can update own data') THEN
        CREATE POLICY "Clients can update own data" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;


-- 3. ADD MISSING COLUMNS TO EXISTING TABLES
-- Add next_hearing to cases
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS next_hearing DATE;

-- Add title and type to documents (fallback for file_name and file_type)
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS title VARCHAR(255),
ADD COLUMN IF NOT EXISTS type VARCHAR(100);

-- Trigger to keep document title/type in sync with file_name/file_type
CREATE OR REPLACE FUNCTION public.sync_document_aliases()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.title IS NULL THEN NEW.title := NEW.file_name; END IF;
    IF NEW.type IS NULL THEN NEW.type := NEW.file_type; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_document_aliases ON public.documents;
CREATE TRIGGER trg_sync_document_aliases
BEFORE INSERT OR UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.sync_document_aliases();


-- 4. LAWYER SYNC TRIGGER (lawyer_profiles -> lawyers)
-- To prevent breaking the UI, we ensure data fed into lawyer_profiles 
-- automatically copies over to the lawyers table.
CREATE OR REPLACE FUNCTION public.sync_lawyer_profiles_to_lawyers()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.lawyers (id, experience_years, about_me, is_verified)
    VALUES (NEW.id, NEW.years_experience, NEW.bio, NEW.is_verified)
    ON CONFLICT (id) DO UPDATE SET
        experience_years = EXCLUDED.experience_years,
        about_me = EXCLUDED.about_me,
        is_verified = EXCLUDED.is_verified;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_lawyer_profiles ON public.lawyer_profiles;
CREATE TRIGGER trg_sync_lawyer_profiles
AFTER INSERT OR UPDATE ON public.lawyer_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_lawyer_profiles_to_lawyers();
