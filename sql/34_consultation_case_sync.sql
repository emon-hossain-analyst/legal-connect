-- =============================================================================
-- Migration 34: Consultation to Case Sync & Medium Selection
-- Run this script in your Supabase SQL Editor
-- =============================================================================

-- 0. Standardize cases.status column to VARCHAR(100) to prevent enum casing errors
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.cases ALTER COLUMN status DROP DEFAULT;
  ALTER TABLE IF EXISTS public.cases ALTER COLUMN status TYPE VARCHAR(100) USING status::text;
  ALTER TABLE IF EXISTS public.cases ALTER COLUMN status SET DEFAULT 'Active';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter status column type: %', SQLERRM;
END $$;

-- 1. Add case_type and linked_appointment_id to public.cases
ALTER TABLE IF EXISTS public.cases
  ADD COLUMN IF NOT EXISTS case_type VARCHAR(50) DEFAULT 'Full Representation';

-- Ensure linked_appointment_id has the correct UUID type matching appointments(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'cases' AND column_name = 'linked_appointment_id' AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE public.cases DROP COLUMN linked_appointment_id CASCADE;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.cases
  ADD COLUMN IF NOT EXISTS linked_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

-- 2. Add medium column to public.appointments and supported_mediums to consultation_settings
ALTER TABLE IF EXISTS public.appointments
  ADD COLUMN IF NOT EXISTS medium VARCHAR(50) DEFAULT 'video_call';

ALTER TABLE IF EXISTS public.consultation_settings
  ADD COLUMN IF NOT EXISTS supported_mediums JSONB DEFAULT '["video_call", "platform_chat", "phone_call", "in_office"]'::jsonb;

-- 3. Create trigger function to auto-create case record when consultation is confirmed/active
CREATE OR REPLACE FUNCTION public.fn_sync_consultation_to_case()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('confirmed', 'active', 'Upcoming', 'In Progress') THEN
    INSERT INTO public.cases (
      client_id,
      lawyer_id,
      title,
      description,
      status,
      case_type,
      linked_appointment_id
    )
    SELECT
      NEW.client_id,
      NEW.lawyer_id,
      COALESCE(NEW.session_type || ' (' || NEW.reason || ')', 'Consultation Matter'),
      COALESCE(NEW.notes, NEW.reason, 'Consultation booked via client portal.'),
      'Active',
      'Consultation',
      NEW.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cases WHERE linked_appointment_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_consultation_to_case ON public.appointments;
CREATE TRIGGER trg_sync_consultation_to_case
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_consultation_to_case();

-- 4. Backfill existing confirmed/active consultations into public.cases immediately
INSERT INTO public.cases (client_id, lawyer_id, title, description, status, case_type, linked_appointment_id)
SELECT 
  client_id, 
  lawyer_id, 
  COALESCE(session_type || ' (' || reason || ')', 'Consultation Matter'), 
  COALESCE(notes, reason, 'Consultation booked via client portal.'), 
  'Active', 
  'Consultation', 
  id
FROM public.appointments
WHERE status IN ('confirmed', 'active', 'Upcoming', 'In Progress')
  AND NOT EXISTS (SELECT 1 FROM public.cases WHERE linked_appointment_id = appointments.id);
