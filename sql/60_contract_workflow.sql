-- =============================================================================
-- Migration 60: Complete Contract Workflow
-- Statuses: PENDING_CONTRACT → ACTIVE → UNDER_CLIENT_REVIEW →
--           REVISION_REQUESTED → UNDER_CLIENT_REVIEW → COMPLETED → ARCHIVED
-- =============================================================================

-- 1. Extend contracts status to support full workflow
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_status_check CHECK (
    status IN (
      'Draft','Pending_Signature','Active','Completed','Terminated',   -- legacy
      'Pending Review','Negotiation Requested','Signed',               -- legacy
      'PENDING_CONTRACT','ACTIVE','UNDER_CLIENT_REVIEW',
      'REVISION_REQUESTED','COMPLETED','ARCHIVED'
    )
  );

-- 2. Deliverables table (files lawyer uploads as work product)
CREATE TABLE IF NOT EXISTS public.deliverables (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  case_id      UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  uploader_id  UUID NOT NULL REFERENCES public.users(id),
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  file_url     TEXT NOT NULL,
  file_type    VARCHAR(50),
  file_size    BIGINT,
  is_final     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliverables_contract ON public.deliverables(contract_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_case     ON public.deliverables(case_id);

ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Contract participants access deliverables" ON public.deliverables;
CREATE POLICY "Contract participants access deliverables" ON public.deliverables
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = deliverables.contract_id
        AND (public.is_owner(c.lawyer_id) OR public.is_owner(c.client_id) OR public.is_admin())
    )
  )
  WITH CHECK (public.is_owner(uploader_id));

GRANT SELECT, INSERT ON TABLE public.deliverables TO authenticated;

-- 3. Contract timeline updates (lawyer progress notes)
CREATE TABLE IF NOT EXISTS public.contract_timeline (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  case_id      UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES public.users(id),
  author_role  VARCHAR(20) NOT NULL CHECK (author_role IN ('lawyer','client','system')),
  event_type   VARCHAR(50) NOT NULL,  -- progress_update|revision_request|approval|contract_accepted|ready_for_review|completed
  title        VARCHAR(255) NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_timeline_contract ON public.contract_timeline(contract_id);

ALTER TABLE public.contract_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Contract participants access timeline" ON public.contract_timeline;
CREATE POLICY "Contract participants access timeline" ON public.contract_timeline
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_timeline.contract_id
        AND (public.is_owner(c.lawyer_id) OR public.is_owner(c.client_id) OR public.is_admin())
    )
  )
  WITH CHECK (public.is_owner(author_id));

GRANT SELECT, INSERT ON TABLE public.contract_timeline TO authenticated;

-- 4. fn_lawyer_accept_contract — lawyer accepts PENDING_CONTRACT → ACTIVE
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_lawyer_accept_contract' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_lawyer_accept_contract(p_contract_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cnt public.contracts%ROWTYPE;
BEGIN
  SELECT * INTO v_cnt FROM public.contracts WHERE id = p_contract_id;
  IF v_cnt.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF NOT (public.is_owner(v_cnt.lawyer_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the assigned lawyer can accept this contract';
  END IF;

  UPDATE public.contracts SET status = 'ACTIVE', updated_at = NOW() WHERE id = p_contract_id;

  IF v_cnt.case_id IS NOT NULL THEN
    UPDATE public.cases SET status = 'Active', updated_at = NOW() WHERE id = v_cnt.case_id;
  END IF;

  INSERT INTO public.contract_timeline
    (contract_id, case_id, author_id, author_role, event_type, title, note)
  VALUES
    (p_contract_id, v_cnt.case_id, v_cnt.lawyer_id, 'lawyer', 'contract_accepted',
     'Contract Accepted', 'Lawyer accepted the contract. Work has begun.');

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (v_cnt.client_id, 'contract_accepted', '✅ Lawyer Accepted Contract',
      'Your lawyer has accepted the contract and work has begun.', false, NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_lawyer_accept_contract(UUID) TO authenticated;

-- 5. fn_add_progress_update — lawyer adds a timeline progress note
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_add_progress_update' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_add_progress_update(
  p_contract_id UUID, p_title TEXT, p_note TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cnt public.contracts%ROWTYPE;
BEGIN
  SELECT * INTO v_cnt FROM public.contracts WHERE id = p_contract_id;
  IF v_cnt.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF NOT (public.is_owner(v_cnt.lawyer_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the assigned lawyer can add progress updates';
  END IF;

  INSERT INTO public.contract_timeline
    (contract_id, case_id, author_id, author_role, event_type, title, note)
  VALUES
    (p_contract_id, v_cnt.case_id, v_cnt.lawyer_id, 'lawyer', 'progress_update', p_title, p_note);

  UPDATE public.contracts SET updated_at = NOW() WHERE id = p_contract_id;
  IF v_cnt.case_id IS NOT NULL THEN
    UPDATE public.cases SET updated_at = NOW() WHERE id = v_cnt.case_id;
  END IF;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (v_cnt.client_id, 'progress_update', '📋 Progress Update',
      p_title || ': ' || COALESCE(p_note, ''), false, NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_add_progress_update(UUID, TEXT, TEXT) TO authenticated;

-- 6. fn_mark_ready_for_review — lawyer marks work ready → UNDER_CLIENT_REVIEW
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_mark_ready_for_review' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_mark_ready_for_review(p_contract_id UUID, p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cnt public.contracts%ROWTYPE;
BEGIN
  SELECT * INTO v_cnt FROM public.contracts WHERE id = p_contract_id;
  IF v_cnt.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF NOT (public.is_owner(v_cnt.lawyer_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the assigned lawyer can submit work for review';
  END IF;

  UPDATE public.contracts SET status = 'UNDER_CLIENT_REVIEW', updated_at = NOW() WHERE id = p_contract_id;

  INSERT INTO public.contract_timeline
    (contract_id, case_id, author_id, author_role, event_type, title, note)
  VALUES
    (p_contract_id, v_cnt.case_id, v_cnt.lawyer_id, 'lawyer', 'ready_for_review',
     'Work Submitted for Client Review', COALESCE(p_note, 'All deliverables uploaded. Awaiting client approval.'));

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (v_cnt.client_id, 'ready_for_review', '👀 Work Ready for Your Review',
      'Your lawyer has submitted deliverables for "' || v_cnt.title || '". Please review and approve or request revisions.',
      false, NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_mark_ready_for_review(UUID, TEXT) TO authenticated;

-- 7. fn_client_request_revision — client requests revision → REVISION_REQUESTED
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_client_request_revision' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_client_request_revision(p_contract_id UUID, p_note TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cnt public.contracts%ROWTYPE;
BEGIN
  SELECT * INTO v_cnt FROM public.contracts WHERE id = p_contract_id;
  IF v_cnt.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF NOT (public.is_owner(v_cnt.client_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the client can request revisions';
  END IF;

  UPDATE public.contracts
  SET status = 'REVISION_REQUESTED', change_request_note = p_note, updated_at = NOW()
  WHERE id = p_contract_id;

  INSERT INTO public.contract_timeline
    (contract_id, case_id, author_id, author_role, event_type, title, note)
  VALUES
    (p_contract_id, v_cnt.case_id, v_cnt.client_id, 'client', 'revision_request',
     'Revision Requested', p_note);

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (v_cnt.lawyer_id, 'revision_requested', '🔄 Revision Requested',
      'Client requested revisions: ' || p_note, false, NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Lawyer must resubmit → set back to ACTIVE so they can work
  UPDATE public.contracts SET status = 'ACTIVE', updated_at = NOW() WHERE id = p_contract_id;

  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_client_request_revision(UUID, TEXT) TO authenticated;

-- 8. fn_client_approve_delivery — client approves → COMPLETED → payment released → ARCHIVED
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_client_approve_delivery' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_client_approve_delivery(p_contract_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cnt     public.contracts%ROWTYPE;
  v_payment_id UUID;
BEGIN
  SELECT * INTO v_cnt FROM public.contracts WHERE id = p_contract_id;
  IF v_cnt.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF NOT (public.is_owner(v_cnt.client_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the client can approve delivery';
  END IF;

  -- Mark contract COMPLETED
  UPDATE public.contracts SET status = 'COMPLETED', updated_at = NOW() WHERE id = p_contract_id;

  -- Mark case Completed
  IF v_cnt.case_id IS NOT NULL THEN
    UPDATE public.cases SET status = 'Completed', updated_at = NOW() WHERE id = v_cnt.case_id;
    -- Mark all milestones completed
    UPDATE public.case_milestones
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE case_id = v_cnt.case_id AND status != 'completed';
  END IF;

  -- Release payment (create completed payment record)
  BEGIN
    INSERT INTO public.payments (
      client_id, lawyer_id, case_id, amount, status, payment_method, created_at, updated_at
    )
    VALUES (
      v_cnt.client_id, v_cnt.lawyer_id, v_cnt.case_id,
      COALESCE(v_cnt.amount, v_cnt.agreed_fee, v_cnt.agreed_amount, 0),
      'completed', 'escrow_release', NOW(), NOW()
    )
    RETURNING id INTO v_payment_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Archive contract
  UPDATE public.contracts SET status = 'ARCHIVED', updated_at = NOW() WHERE id = p_contract_id;

  -- Timeline entry
  INSERT INTO public.contract_timeline
    (contract_id, case_id, author_id, author_role, event_type, title, note)
  VALUES
    (p_contract_id, v_cnt.case_id, v_cnt.client_id, 'client', 'approval',
     'Work Approved & Case Completed',
     'Client approved all deliverables. Payment released. Contract archived.');

  -- Notify lawyer
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (v_cnt.lawyer_id, 'case_completed', '🎉 Work Approved & Payment Released',
      'Client approved your work on "' || v_cnt.title || '". Payment has been released.',
      false, NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Notify client
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (v_cnt.client_id, 'case_completed', '✅ Case Completed',
      'Your case "' || v_cnt.title || '" is complete. Please leave a review for your lawyer.',
      false, NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'case_id', v_cnt.case_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_client_approve_delivery(UUID) TO authenticated;

-- 9. Enable realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.deliverables;       EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_timeline;  EXCEPTION WHEN OTHERS THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
