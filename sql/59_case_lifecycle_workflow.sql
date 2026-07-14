-- =============================================================================
-- Migration 59: Complete Case Lifecycle Workflow
-- Contract creation, approval, progress updates, case completion, reviews
-- Run AFTER migration 58.
-- =============================================================================

-- 1. Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.users(id),
  reviewee_id UUID NOT NULL REFERENCES public.users(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_case_reviewer ON public.reviews(case_id, reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Review participants" ON public.reviews;
CREATE POLICY "Review participants" ON public.reviews
  FOR ALL TO authenticated
  USING (public.is_owner(reviewer_id) OR public.is_owner(reviewee_id) OR public.is_admin())
  WITH CHECK (public.is_owner(reviewer_id));

GRANT SELECT, INSERT ON TABLE public.reviews TO authenticated;

-- 2. Add missing columns to contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS job_post_id        INT REFERENCES public.job_posts(id);
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS case_id            UUID REFERENCES public.cases(id);
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS terms              TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS change_request_note TEXT;

-- 3. Unique constraint on contracts.case_id — MUST exist before fn_create_contract
DO $$ BEGIN
  ALTER TABLE public.contracts ADD CONSTRAINT contracts_case_id_unique UNIQUE (case_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- 4. fn_create_contract — lawyer creates/updates contract for a case
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_create_contract' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_create_contract(
  p_case_id   UUID,
  p_title     TEXT,
  p_terms     TEXT,
  p_amount    NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case        public.cases%ROWTYPE;
  v_contract_id UUID;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT (public.is_owner(v_case.lawyer_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the assigned lawyer can create a contract';
  END IF;

  INSERT INTO public.contracts (
    client_id, lawyer_id, case_id, title, terms, amount, agreed_fee, agreed_amount,
    status, currency, created_at, updated_at
  )
  VALUES (
    v_case.client_id, v_case.lawyer_id, p_case_id,
    p_title, p_terms, p_amount, p_amount, p_amount,
    'Pending Review', 'BDT', NOW(), NOW()
  )
  ON CONFLICT (case_id) DO UPDATE
    SET title      = EXCLUDED.title,
        terms      = EXCLUDED.terms,
        amount     = EXCLUDED.amount,
        agreed_fee = EXCLUDED.amount,
        status     = 'Pending Review',
        updated_at = NOW()
  RETURNING id INTO v_contract_id;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (
      v_case.client_id, 'contract_sent', '📄 Contract Ready for Review',
      'Your lawyer has sent a contract for "' || p_title || '". Please review and approve.',
      false, NOW()
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  UPDATE public.cases SET updated_at = NOW() WHERE id = p_case_id;

  RETURN jsonb_build_object('success', true, 'contract_id', v_contract_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_create_contract(UUID, TEXT, TEXT, NUMERIC) TO authenticated;

-- 5. fn_approve_contract — client approves contract
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_approve_contract' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_approve_contract(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnt public.contracts%ROWTYPE;
BEGIN
  SELECT * INTO v_cnt FROM public.contracts WHERE id = p_contract_id;
  IF v_cnt.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF NOT (public.is_owner(v_cnt.client_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the client can approve this contract';
  END IF;

  UPDATE public.contracts
  SET status = 'Active', change_request_note = NULL, updated_at = NOW()
  WHERE id = p_contract_id;

  IF v_cnt.case_id IS NOT NULL THEN
    UPDATE public.cases SET status = 'Active', updated_at = NOW() WHERE id = v_cnt.case_id;
  END IF;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (
      v_cnt.lawyer_id, 'contract_approved', '✅ Contract Approved',
      'The client approved "' || v_cnt.title || '". You can now begin work.',
      false, NOW()
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_approve_contract(UUID) TO authenticated;

-- 6. fn_request_contract_changes — client requests changes
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_request_contract_changes' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_request_contract_changes(p_contract_id UUID, p_note TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnt public.contracts%ROWTYPE;
BEGIN
  SELECT * INTO v_cnt FROM public.contracts WHERE id = p_contract_id;
  IF v_cnt.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF NOT (public.is_owner(v_cnt.client_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the client can request changes';
  END IF;

  UPDATE public.contracts
  SET status = 'Negotiation Requested', change_request_note = p_note, updated_at = NOW()
  WHERE id = p_contract_id;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (
      v_cnt.lawyer_id, 'contract_changes', '📝 Contract Changes Requested',
      'Client requested changes to "' || v_cnt.title || '": ' || p_note,
      false, NOW()
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_request_contract_changes(UUID, TEXT) TO authenticated;

-- 7. fn_complete_case — lawyer marks case as completed
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_complete_case' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_complete_case(p_case_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.cases%ROWTYPE;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT (public.is_owner(v_case.lawyer_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the assigned lawyer can complete the case';
  END IF;

  UPDATE public.cases SET status = 'Completed', updated_at = NOW() WHERE id = p_case_id;

  UPDATE public.case_milestones
  SET status = 'completed', completed_at = NOW(), updated_at = NOW()
  WHERE case_id = p_case_id AND status != 'completed';

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (
      v_case.client_id, 'case_completed', '🎉 Case Completed!',
      'Your case "' || v_case.title || '" is complete. Please leave a review.',
      false, NOW()
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_complete_case(UUID) TO authenticated;

-- 8. fn_leave_review — client leaves review after case completion
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT oid::regprocedure AS fn_sig FROM pg_proc
    WHERE proname = 'fn_leave_review' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_leave_review(
  p_case_id   UUID,
  p_rating    SMALLINT,
  p_comment   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case      public.cases%ROWTYPE;
  v_review_id UUID;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT public.is_owner(v_case.client_id) THEN
    RAISE EXCEPTION 'Only the client can leave a review';
  END IF;
  IF LOWER(v_case.status::TEXT) NOT IN ('completed', 'closed') THEN
    RAISE EXCEPTION 'Can only review completed cases';
  END IF;

  INSERT INTO public.reviews (case_id, reviewer_id, reviewee_id, rating, comment)
  VALUES (p_case_id, v_case.client_id, v_case.lawyer_id, p_rating, p_comment)
  ON CONFLICT (case_id, reviewer_id) DO UPDATE
    SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
  RETURNING id INTO v_review_id;

  BEGIN
    UPDATE public.lawyers
    SET rating = (
      SELECT ROUND(AVG(r.rating)::numeric, 1)
      FROM public.reviews r
      JOIN public.cases c ON c.id = r.case_id
      WHERE c.lawyer_id = v_case.lawyer_id
    )
    WHERE user_id = v_case.lawyer_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (
      v_case.lawyer_id, 'new_review', '⭐ New Review Received',
      'You received a ' || p_rating || '-star review for "' || v_case.title || '".',
      false, NOW()
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true, 'review_id', v_review_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_leave_review(UUID, SMALLINT, TEXT) TO authenticated;

-- 9. Enable realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;   EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts; EXCEPTION WHEN OTHERS THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
