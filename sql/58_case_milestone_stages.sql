-- =============================================================================
-- Migration 58: Unified Case Milestone Stages System
-- Predefined stages, progress derivation, notification triggers, realtime
-- =============================================================================

-- 1. Ensure case_milestones table exists with UUID primary key (matches migration 31)
-- The table was originally created in migration 31 with id UUID, not SERIAL.
-- We only ADD missing columns here — never recreate the table.
ALTER TABLE public.case_milestones ADD COLUMN IF NOT EXISTS stage       VARCHAR(100);
ALTER TABLE public.case_milestones ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.case_milestones ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill stage from title for existing rows that predate this migration
UPDATE public.case_milestones SET stage = title WHERE stage IS NULL;

-- Ensure status column accepts the values used by fn_update_case_stage
-- (migration 31 used: pending/submitted/approved/rejected/revision_requested)
-- We extend it to also accept in_progress and completed via a permissive policy;
-- the safest approach is to drop the old constraint and add a new one.
ALTER TABLE public.case_milestones DROP CONSTRAINT IF EXISTS case_milestones_status_check;
ALTER TABLE public.case_milestones
  ADD CONSTRAINT case_milestones_status_check
  CHECK (status IN ('pending','submitted','approved','rejected','revision_requested','in_progress','completed'));

CREATE INDEX IF NOT EXISTS idx_case_milestones_case   ON public.case_milestones(case_id);
CREATE INDEX IF NOT EXISTS idx_case_milestones_status ON public.case_milestones(status);

-- Unique constraint so ON CONFLICT (case_id, stage) works in fn_update_case_stage
DO $$ BEGIN
  ALTER TABLE public.case_milestones ADD CONSTRAINT case_milestones_case_stage_unique UNIQUE (case_id, stage);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- 2. RLS for case_milestones
ALTER TABLE public.case_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Case participants access milestones" ON public.case_milestones;
CREATE POLICY "Case participants access milestones" ON public.case_milestones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_milestones.case_id
        AND (public.is_owner(c.lawyer_id) OR public.is_owner(c.client_id) OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_milestones.case_id
        AND (public.is_owner(c.lawyer_id) OR public.is_admin())
    )
  );

-- No sequence grant needed — id is UUID (gen_random_uuid()), not SERIAL
GRANT SELECT, INSERT, UPDATE ON TABLE public.case_milestones TO authenticated;

-- 3. Trigger: on milestone update → update case.updated_at + send notification
CREATE OR REPLACE FUNCTION public.handle_milestone_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case    public.cases%ROWTYPE;
  v_lawyer_name TEXT;
  v_total   INT;
  v_done    INT;
BEGIN
  -- Update case updated_at
  UPDATE public.cases SET updated_at = NOW() WHERE id = NEW.case_id;

  -- Only notify on status change to completed
  IF TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed' THEN
    SELECT * INTO v_case FROM public.cases WHERE id = NEW.case_id;
    SELECT name INTO v_lawyer_name FROM public.users WHERE id = v_case.lawyer_id;

    SELECT COUNT(*) INTO v_total FROM public.case_milestones WHERE case_id = NEW.case_id;
    SELECT COUNT(*) INTO v_done  FROM public.case_milestones WHERE case_id = NEW.case_id AND status = 'completed';

    -- Notify client
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
      VALUES (
        v_case.client_id,
        'case_update',
        'Case Progress Update',
        COALESCE(v_lawyer_name, 'Your lawyer') || ' completed stage: "' || NEW.title || '" (' || v_done || '/' || v_total || ' stages done)',
        false,
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- If all milestones done, auto-complete the case
    IF v_done = v_total AND v_total > 0 THEN
      UPDATE public.cases SET status = 'Completed', updated_at = NOW() WHERE id = NEW.case_id;
      BEGIN
        INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
        VALUES (
          v_case.client_id, 'case_update', '🎉 Case Completed!',
          'All stages for "' || v_case.title || '" have been completed.',
          false, NOW()
        );
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_milestone_update ON public.case_milestones;
CREATE TRIGGER trigger_milestone_update
  AFTER INSERT OR UPDATE ON public.case_milestones
  FOR EACH ROW EXECUTE FUNCTION public.handle_milestone_update();

-- 4. RPC: fn_update_case_stage — lawyer updates a stage atomically
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_update_case_stage' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_update_case_stage(
  p_case_id   UUID,
  p_stage     TEXT,
  p_title     TEXT,
  p_status    TEXT DEFAULT 'completed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case      public.cases%ROWTYPE;
  v_milestone_id UUID;
  v_total     INT;
  v_done      INT;
  v_progress  INT;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;

  -- Only the assigned lawyer can update stages
  IF NOT (public.is_owner(v_case.lawyer_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the assigned lawyer can update case stages';
  END IF;

  -- Upsert milestone for this stage (id is UUID — use gen_random_uuid())
  INSERT INTO public.case_milestones (id, case_id, stage, title, status, completed_at, updated_at)
  VALUES (
    gen_random_uuid(), p_case_id, p_stage, p_title, p_status,
    CASE WHEN p_status = 'completed' THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (case_id, stage) DO NOTHING
  RETURNING id INTO v_milestone_id;

  -- If already exists, update it
  IF v_milestone_id IS NULL THEN
    UPDATE public.case_milestones
    SET status = p_status,
        title = p_title,
        completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE case_id = p_case_id AND stage = p_stage
    RETURNING id INTO v_milestone_id;
  END IF;

  -- Compute progress
  SELECT COUNT(*) INTO v_total FROM public.case_milestones WHERE case_id = p_case_id;
  SELECT COUNT(*) INTO v_done  FROM public.case_milestones WHERE case_id = p_case_id AND status = 'completed';
  v_progress := CASE WHEN v_total > 0 THEN ROUND((v_done::NUMERIC / v_total) * 100) ELSE 0 END;

  RETURN jsonb_build_object(
    'success', true,
    'milestone_id', v_milestone_id,
    'progress', v_progress,
    'completed', v_done,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_update_case_stage(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- 5. Enable realtime for case_milestones
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.case_milestones;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';
