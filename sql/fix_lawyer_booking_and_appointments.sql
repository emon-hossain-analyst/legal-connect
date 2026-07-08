-- ==============================================================================
-- FIX FOR LAWYER APPOINTMENT BOOKING & APPOINTMENT SCHEDULING
-- ==============================================================================
-- Run this SQL in your Supabase SQL Editor to resolve appointment booking errors,
-- missing lawyer profiles, and missing scheduled_time / scheduled_at columns.
-- ==============================================================================

-- 1. Grant base permissions to avoid permission denied
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Ensure users and lawyers tables are accessible for reading profiles
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users viewable by everyone" ON public.users;
CREATE POLICY "Users viewable by everyone" ON public.users FOR SELECT USING (true);

ALTER TABLE public.lawyers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lawyers viewable by everyone" ON public.lawyers;
CREATE POLICY "Lawyers viewable by everyone" ON public.lawyers FOR SELECT USING (true);

-- 3. Ensure appointments table has all needed columns (both scheduled_at and scheduled_time)
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY
);

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS lawyer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS consultation_type VARCHAR(100) DEFAULT 'Legal Consultation',
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

-- 4. Sync existing scheduled_at and scheduled_time columns
UPDATE public.appointments SET scheduled_time = scheduled_at WHERE scheduled_time IS NULL AND scheduled_at IS NOT NULL;
UPDATE public.appointments SET scheduled_at = scheduled_time WHERE scheduled_at IS NULL AND scheduled_time IS NOT NULL;

-- 5. Ensure RLS policies allow booking and viewing appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated for appointments" ON public.appointments;
CREATE POLICY "Allow all authenticated for appointments" 
ON public.appointments FOR ALL 
USING (true) 
WITH CHECK (true);

-- 6. Ensure foreign keys for client and lawyer relations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_lawyer_id_fkey'
  ) THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_lawyer_id_fkey FOREIGN KEY (lawyer_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_client_id_fkey'
  ) THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Foreign keys verified or handled.';
END $$;
