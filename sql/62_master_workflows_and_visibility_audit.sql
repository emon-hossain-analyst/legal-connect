-- =============================================================================
-- Migration 62: Master Workflows & Visibility Audit
-- Purpose:
--   1. Guarantee lawyer visibility on Homepage/Search when approved
--   2. Auto-sync Contracts and Consultations to Cases (zero synthetic IDs)
--   3. Transactional RPCs for all Contract, Consultation, and Case lifecycle actions
-- =============================================================================

-- ─── 1. LAWYER VISIBILITY AUTO-SYNC TRIGGER ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_sync_lawyer_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_status::text = 'verified' THEN
    NEW.is_verified := TRUE;
  ELSIF NEW.is_verified = TRUE THEN
    NEW.verification_status := 'verified'::public.verification_status_enum;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_lawyer_verification_status ON public.lawyers;
CREATE TRIGGER trg_sync_lawyer_verification_status
  BEFORE INSERT OR UPDATE OF verification_status, is_verified ON public.lawyers
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_lawyer_verification_status();

-- Immediate backfill to ensure zero out-of-sync lawyer records
UPDATE public.lawyers
SET is_verified = TRUE, verification_status = 'verified'::public.verification_status_enum
WHERE is_verified = TRUE OR verification_status::text = 'verified';

UPDATE public.users u
SET is_verified = TRUE, is_active = TRUE, updated_at = NOW()
FROM public.lawyers l
WHERE l.user_id = u.id AND l.is_verified = TRUE
  AND (u.is_verified IS DISTINCT FROM TRUE OR u.is_active IS DISTINCT FROM TRUE);


-- ─── 2. EXTEND CASES & CONTRACTS TABLES FOR FULL WORKFLOW INTEGRATION ────────
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS case_type VARCHAR(50) DEFAULT 'Full Representation';
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS linked_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS fee_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS change_request_note TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS terms TEXT;

-- Standardize cases status to VARCHAR(100) to avoid strict ENUM issues
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.cases ALTER COLUMN status DROP DEFAULT;
  ALTER TABLE IF EXISTS public.cases ALTER COLUMN status TYPE VARCHAR(100) USING status::text;
  ALTER TABLE IF EXISTS public.cases ALTER COLUMN status SET DEFAULT 'Active';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter cases status column type: %', SQLERRM;
END $$;


-- ─── 3. CONTRACT TO CASE AUTO-SYNC TRIGGER ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_auto_sync_contract_to_case()
RETURNS TRIGGER AS $$
DECLARE
  v_case_id UUID;
  v_case_status VARCHAR(100);
BEGIN
  -- Determine mapped case status based on contract status
  IF NEW.status IN ('Active', 'ACTIVE', 'Signed', 'UNDER_CLIENT_REVIEW', 'REVISION_REQUESTED') THEN
    v_case_status := 'Active';
  ELSIF NEW.status IN ('Completed', 'COMPLETED') THEN
    v_case_status := 'Completed';
  ELSIF NEW.status IN ('Terminated', 'TERMINATED') THEN
    v_case_status := 'Closed';
  ELSE
    v_case_status := 'Pending';
  END IF;

  -- If contract already has case_id, update case status accordingly
  IF NEW.case_id IS NOT NULL THEN
    UPDATE public.cases SET status = v_case_status, updated_at = NOW() WHERE id = NEW.case_id AND status != v_case_status;
    RETURN NEW;
  END IF;

  -- Check if there is an existing case for this contract or (client_id, lawyer_id, title)
  SELECT id INTO v_case_id FROM public.cases WHERE contract_id = NEW.id LIMIT 1;
  IF v_case_id IS NULL THEN
    SELECT id INTO v_case_id FROM public.cases
    WHERE client_id = NEW.client_id AND lawyer_id = NEW.lawyer_id AND title = NEW.title
    LIMIT 1;
  END IF;

  -- If no case exists, create one
  IF v_case_id IS NULL THEN
    INSERT INTO public.cases (
      client_id, lawyer_id, contract_id, title, description, status, case_type, created_at, updated_at
    ) VALUES (
      NEW.client_id, NEW.lawyer_id, NEW.id, COALESCE(NEW.title, 'Legal Representation Agreement'),
      COALESCE(NEW.terms, 'Formal representation agreement initiated via contract workflow.'),
      v_case_status, 'Full Representation', NOW(), NOW()
    ) RETURNING id INTO v_case_id;
  ELSE
    UPDATE public.cases SET contract_id = NEW.id, status = v_case_status, updated_at = NOW() WHERE id = v_case_id;
  END IF;

  -- Link contract to case directly without recursive trigger loop
  UPDATE public.contracts SET case_id = v_case_id WHERE id = NEW.id AND (case_id IS NULL OR case_id != v_case_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_sync_contract_to_case ON public.contracts;
CREATE TRIGGER trg_auto_sync_contract_to_case
  AFTER INSERT OR UPDATE OF status, case_id ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_sync_contract_to_case();

-- Backfill missing case rows for existing contracts
DO $$
DECLARE
  c RECORD;
  v_new_case UUID;
BEGIN
  FOR c IN SELECT * FROM public.contracts WHERE case_id IS NULL LOOP
    INSERT INTO public.cases (
      client_id, lawyer_id, contract_id, title, description, status, case_type, created_at, updated_at
    ) VALUES (
      c.client_id, c.lawyer_id, c.id, COALESCE(c.title, 'Legal Representation Agreement'),
      COALESCE(c.terms, 'Formal representation agreement.'),
      CASE WHEN c.status IN ('Active', 'ACTIVE', 'Signed') THEN 'Active'
           WHEN c.status IN ('Completed', 'COMPLETED') THEN 'Completed'
           WHEN c.status IN ('Terminated', 'TERMINATED') THEN 'Closed'
           ELSE 'Pending' END,
      'Full Representation', c.created_at, NOW()
    ) ON CONFLICT DO NOTHING RETURNING id INTO v_new_case;

    IF v_new_case IS NOT NULL THEN
      UPDATE public.contracts SET case_id = v_new_case WHERE id = c.id;
    END IF;
  END LOOP;
END $$;


-- ─── 4. CONSULTATION TO CASE LIFECYCLE SYNC UPGRADE ──────────────────────────
CREATE OR REPLACE FUNCTION public.fn_sync_consultation_to_case()
RETURNS TRIGGER AS $$
DECLARE
  v_case_id UUID;
BEGIN
  IF NEW.status IN ('confirmed', 'active', 'Upcoming', 'In Progress', 'started') THEN
    SELECT id INTO v_case_id FROM public.cases WHERE linked_appointment_id = NEW.id LIMIT 1;
    IF v_case_id IS NULL THEN
      INSERT INTO public.cases (
        client_id, lawyer_id, title, description, status, case_type, linked_appointment_id, created_at, updated_at
      ) VALUES (
        NEW.client_id, NEW.lawyer_id,
        COALESCE(NEW.consultation_type || ' (' || COALESCE(NEW.reason, 'Session') || ')', 'Consultation Matter'),
        COALESCE(NEW.notes, NEW.reason, 'Consultation booked via client portal.'),
        'Active', 'Consultation', NEW.id, NOW(), NOW()
      );
    ELSE
      UPDATE public.cases SET status = 'Active', updated_at = NOW() WHERE id = v_case_id AND status != 'Active';
    END IF;
  ELSIF NEW.status IN ('completed', 'Completed') THEN
    UPDATE public.cases SET status = 'Completed', updated_at = NOW() WHERE linked_appointment_id = NEW.id;
  ELSIF NEW.status IN ('cancelled', 'Cancelled', 'no_show') THEN
    UPDATE public.cases SET status = 'Closed', updated_at = NOW() WHERE linked_appointment_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_consultation_to_case ON public.appointments;
CREATE TRIGGER trg_sync_consultation_to_case
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_consultation_to_case();

-- Backfill missing case records for confirmed/active appointments
INSERT INTO public.cases (client_id, lawyer_id, title, description, status, case_type, linked_appointment_id, created_at, updated_at)
SELECT 
  client_id, lawyer_id,
  COALESCE(consultation_type || ' (' || COALESCE(reason, 'Session') || ')', 'Consultation Matter'),
  COALESCE(notes, reason, 'Consultation booked via client portal.'),
  CASE WHEN status IN ('completed', 'Completed') THEN 'Completed'
       WHEN status IN ('cancelled', 'Cancelled') THEN 'Closed'
       ELSE 'Active' END,
  'Consultation', id, created_at, NOW()
FROM public.appointments
WHERE status IN ('confirmed', 'active', 'Upcoming', 'In Progress', 'completed', 'Completed')
  AND NOT EXISTS (SELECT 1 FROM public.cases WHERE linked_appointment_id = appointments.id);


-- ─── 5. TRANSACTIONAL CONTRACT WORKFLOW RPCS ─────────────────────────────────

-- Client Approves Contract -> sets status Active, locks fee, syncs case & timeline
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_approve_contract' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_approve_contract(p_contract_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cnt public.contracts%ROWTYPE;
BEGIN
  SELECT * INTO v_cnt FROM public.contracts WHERE id = p_contract_id;
  IF v_cnt.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF NOT (public.is_owner(v_cnt.client_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the assigned client can approve this contract';
  END IF;

  UPDATE public.contracts
  SET status = 'Active', fee_locked = TRUE, change_request_note = NULL, updated_at = NOW()
  WHERE id = p_contract_id;

  IF v_cnt.case_id IS NOT NULL THEN
    UPDATE public.cases SET status = 'Active', updated_at = NOW() WHERE id = v_cnt.case_id;
  END IF;

  INSERT INTO public.contract_timeline (contract_id, case_id, author_id, author_role, event_type, title, note)
  VALUES (p_contract_id, v_cnt.case_id, v_cnt.client_id, 'client', 'contract_accepted',
          'Contract Approved by Client', 'Client reviewed and approved the contract agreement. Active representation initialized.');

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (v_cnt.lawyer_id, 'contract_approved', '✅ Contract Approved!',
            'Client approved your contract for "' || COALESCE(v_cnt.title, 'Legal Representation') || '". Retainer/Case initialized.', false, NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true, 'case_id', v_cnt.case_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_approve_contract(UUID) TO authenticated;


-- Client Requests Contract Changes -> sets status Negotiation Requested
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_request_contract_changes' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_request_contract_changes(p_contract_id UUID, p_note TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cnt public.contracts%ROWTYPE;
BEGIN
  SELECT * INTO v_cnt FROM public.contracts WHERE id = p_contract_id;
  IF v_cnt.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF NOT (public.is_owner(v_cnt.client_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the assigned client can request changes';
  END IF;

  UPDATE public.contracts
  SET status = 'Negotiation Requested', change_request_note = p_note, updated_at = NOW()
  WHERE id = p_contract_id;

  INSERT INTO public.contract_timeline (contract_id, case_id, author_id, author_role, event_type, title, note)
  VALUES (p_contract_id, v_cnt.case_id, v_cnt.client_id, 'client', 'revision_request',
          'Contract Changes Requested', p_note);

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (v_cnt.lawyer_id, 'contract_changes', '📝 Contract Negotiation Requested',
            'Client requested changes to "' || COALESCE(v_cnt.title, 'Agreement') || '": ' || p_note, false, NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_request_contract_changes(UUID, TEXT) TO authenticated;


-- Terminate / Decline Contract
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_terminate_contract' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_terminate_contract(p_contract_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cnt public.contracts%ROWTYPE;
  v_actor_role VARCHAR(20);
  v_target_user UUID;
BEGIN
  SELECT * INTO v_cnt FROM public.contracts WHERE id = p_contract_id;
  IF v_cnt.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF NOT (public.is_owner(v_cnt.client_id) OR public.is_owner(v_cnt.lawyer_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Unauthorized to terminate this contract';
  END IF;

  IF public.is_owner(v_cnt.lawyer_id) THEN
    v_actor_role := 'lawyer';
    v_target_user := v_cnt.client_id;
  ELSE
    v_actor_role := 'client';
    v_target_user := v_cnt.lawyer_id;
  END IF;

  UPDATE public.contracts SET status = 'Terminated', updated_at = NOW() WHERE id = p_contract_id;

  IF v_cnt.case_id IS NOT NULL THEN
    UPDATE public.cases SET status = 'Closed', updated_at = NOW() WHERE id = v_cnt.case_id;
  END IF;

  INSERT INTO public.contract_timeline (contract_id, case_id, author_id, author_role, event_type, title, note)
  VALUES (p_contract_id, v_cnt.case_id, auth.uid(), v_actor_role, 'contract_terminated',
          'Contract Terminated / Declined', COALESCE(p_reason, 'Contract agreement was terminated or declined.'));

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (v_target_user, 'contract_terminated', '❌ Contract Terminated / Declined',
            'The contract agreement for "' || COALESCE(v_cnt.title, 'Legal Representation') || '" was terminated/declined.', false, NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_terminate_contract(UUID, TEXT) TO authenticated;


-- ─── 6. TRANSACTIONAL CONSULTATION ACTION RPC ────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_consultation_action' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_consultation_action(
  p_appointment_id UUID,
  p_action TEXT,
  p_custom_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_apt public.appointments%ROWTYPE;
  v_new_status VARCHAR(50);
  v_msg TEXT;
  v_target_user UUID;
BEGIN
  SELECT * INTO v_apt FROM public.appointments WHERE id = p_appointment_id;
  IF v_apt.id IS NULL THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF NOT (public.is_owner(v_apt.lawyer_id) OR public.is_owner(v_apt.client_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Unauthorized to manage this appointment';
  END IF;

  IF public.is_owner(v_apt.lawyer_id) THEN
    v_target_user := v_apt.client_id;
  ELSE
    v_target_user := v_apt.lawyer_id;
  END IF;

  IF p_action IN ('confirm', 'Upcoming', 'confirmed') THEN
    v_new_status := 'confirmed';
    v_msg := COALESCE(p_custom_data->>'message', 'Your consultation session has been confirmed by your lawyer.');
    UPDATE public.appointments SET status = v_new_status WHERE id = p_appointment_id;
  ELSIF p_action IN ('cancel', 'Cancelled', 'cancelled') THEN
    v_new_status := 'cancelled';
    v_msg := COALESCE(p_custom_data->>'message', 'The consultation session was cancelled.');
    UPDATE public.appointments SET status = v_new_status WHERE id = p_appointment_id;
  ELSIF p_action IN ('complete', 'Completed', 'completed') THEN
    v_new_status := 'completed';
    v_msg := COALESCE(p_custom_data->>'message', 'The consultation session has been marked as Completed.');
    UPDATE public.appointments SET status = v_new_status WHERE id = p_appointment_id;
  ELSIF p_action = 'reschedule' THEN
    v_new_status := 'rescheduled';
    v_msg := COALESCE(p_custom_data->>'message', 'The consultation has been rescheduled.');
    UPDATE public.appointments
    SET scheduled_at = (p_custom_data->>'scheduled_at')::timestamptz,
        scheduled_time = (p_custom_data->>'scheduled_at')::timestamptz,
        status = 'confirmed'
    WHERE id = p_appointment_id;
  ELSIF p_action = 'meeting_link' THEN
    UPDATE public.appointments
    SET google_meet_url = p_custom_data->>'url'
    WHERE id = p_appointment_id;
    v_msg := 'Video consultation meeting URL updated: ' || (p_custom_data->>'url');
  ELSE
    RAISE EXCEPTION 'Invalid consultation action: %', p_action;
  END IF;

  -- Log update if table exists
  BEGIN
    INSERT INTO public.consultation_updates (appointment_id, update_type, message, created_by, created_at)
    VALUES (p_appointment_id, p_action, v_msg, auth.uid(), NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Notify other party
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (v_target_user, 'consultation_update', '📅 Consultation Update', v_msg, false, NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true, 'status', COALESCE(v_new_status, v_apt.status));
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_consultation_action(UUID, TEXT, JSONB) TO authenticated;


-- ─── 7. ENHANCED CASE COMPLETION RPC (HANDLES SYNTHETIC OR REAL IDs) ─────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_complete_case' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_complete_case(p_case_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case public.cases%ROWTYPE;
  v_cnt_id UUID;
  v_apt_id UUID;
  v_real_case_id UUID;
BEGIN
  IF p_case_id IS NULL OR p_case_id = '' THEN RAISE EXCEPTION 'Invalid case ID provided'; END IF;

  -- 1. If ID passed as synthetic 'contract_xyz'
  IF p_case_id LIKE 'contract_%' THEN
    BEGIN
      v_cnt_id := SUBSTRING(p_case_id FROM 10)::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid UUID format inside synthetic contract ID';
    END;
    SELECT case_id INTO v_real_case_id FROM public.contracts WHERE id = v_cnt_id;
    IF v_real_case_id IS NOT NULL THEN
      SELECT * INTO v_case FROM public.cases WHERE id = v_real_case_id;
    ELSE
      -- Ensure real case exists
      UPDATE public.contracts SET status = 'COMPLETED', updated_at = NOW() WHERE id = v_cnt_id;
      RETURN jsonb_build_object('success', true, 'synthetic', true);
    END IF;

  -- 2. If ID passed as synthetic 'consultation_abc'
  ELSIF p_case_id LIKE 'consultation_%' THEN
    BEGIN
      v_apt_id := SUBSTRING(p_case_id FROM 14)::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid UUID format inside synthetic consultation ID';
    END;
    SELECT id INTO v_real_case_id FROM public.cases WHERE linked_appointment_id = v_apt_id LIMIT 1;
    IF v_real_case_id IS NOT NULL THEN
      SELECT * INTO v_case FROM public.cases WHERE id = v_real_case_id;
    ELSE
      UPDATE public.appointments SET status = 'completed' WHERE id = v_apt_id;
      RETURN jsonb_build_object('success', true, 'synthetic', true);
    END IF;

  -- 3. Standard real UUID case ID
  ELSE
    BEGIN
      v_real_case_id := p_case_id::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Case ID must be a valid UUID or format contract_UUID / consultation_UUID';
    END;
    SELECT * INTO v_case FROM public.cases WHERE id = v_real_case_id;
  END IF;

  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Target case not found'; END IF;
  IF NOT (public.is_owner(v_case.lawyer_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the assigned lawyer can complete the case';
  END IF;

  -- Mark case and milestones as completed
  UPDATE public.cases SET status = 'Completed', updated_at = NOW() WHERE id = v_case.id;
  UPDATE public.case_milestones SET status = 'completed', completed_at = NOW(), updated_at = NOW()
  WHERE case_id = v_case.id AND status != 'completed';

  -- Update linked contract if exists
  IF v_case.contract_id IS NOT NULL THEN
    UPDATE public.contracts SET status = 'COMPLETED', updated_at = NOW() WHERE id = v_case.contract_id;
  ELSE
    UPDATE public.contracts SET status = 'COMPLETED', updated_at = NOW() WHERE case_id = v_case.id;
  END IF;

  -- Update linked appointment if exists
  IF v_case.linked_appointment_id IS NOT NULL THEN
    UPDATE public.appointments SET status = 'completed' WHERE id = v_case.linked_appointment_id;
  END IF;

  -- Notify client
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (v_case.client_id, 'case_completed', '🎉 Case Completed!',
            'Your case matter "' || COALESCE(v_case.title, 'Legal Matter') || '" has been marked as complete. Please leave a review for your lawyer.',
            false, NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true, 'case_id', v_case.id);
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_complete_case(TEXT) TO authenticated;


-- ─── 8. ENSURE REALTIME ON ALL WORKFLOW TABLES ───────────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lawyers;           EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.users;             EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;         EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;             EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;      EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.deliverables;      EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_timeline; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.case_milestones;   EXCEPTION WHEN OTHERS THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
