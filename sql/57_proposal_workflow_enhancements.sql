-- =============================================================================
-- Migration 57: Proposal Workflow Enhancements
-- Adds: extended proposal statuses, counter_offers table, search_jobs RPC,
--       proposal_history audit table, realtime publication for counter_offers
-- =============================================================================

-- 1. Extend job_proposals status CHECK constraint to include all production states
ALTER TABLE public.job_proposals
  DROP CONSTRAINT IF EXISTS job_proposals_status_check;

ALTER TABLE public.job_proposals
  ADD CONSTRAINT job_proposals_status_check
  CHECK (status IN (
    'draft', 'pending', 'shortlisted', 'counter_offer',
    'accepted', 'rejected', 'withdrawn', 'expired', 'cancelled'
  ));

-- 2. Counter-offers table (negotiation history per proposal)
CREATE TABLE IF NOT EXISTS public.proposal_counter_offers (
  id           SERIAL PRIMARY KEY,
  proposal_id  INTEGER NOT NULL REFERENCES public.job_proposals(id) ON DELETE CASCADE,
  offered_by   UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL,
  note         TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counter_offers_proposal ON public.proposal_counter_offers(proposal_id);

ALTER TABLE public.proposal_counter_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Proposal participants access counter offers" ON public.proposal_counter_offers;
CREATE POLICY "Proposal participants access counter offers" ON public.proposal_counter_offers
  FOR ALL TO authenticated
  USING (
    public.is_owner(offered_by)
    OR EXISTS (
      SELECT 1 FROM public.job_proposals p
      JOIN public.job_posts j ON j.id = p.job_post_id
      WHERE p.id = proposal_counter_offers.proposal_id
        AND (public.is_owner(p.lawyer_id) OR public.is_owner(j.client_id))
    )
    OR public.is_admin()
  )
  WITH CHECK (
    public.is_owner(offered_by)
    OR public.is_admin()
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.proposal_counter_offers TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.proposal_counter_offers_id_seq TO authenticated;

-- 3. search_jobs RPC (used by JobBoard as primary fetch path)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS fn_sig
    FROM pg_proc
    WHERE proname = 'search_jobs' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE;';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.search_jobs(
  p_query    TEXT    DEFAULT NULL,
  p_category TEXT    DEFAULT NULL,
  p_status   TEXT    DEFAULT 'open',
  p_limit    INT     DEFAULT 50,
  p_offset   INT     DEFAULT 0
)
RETURNS TABLE (
  id                           INT,
  client_id                    UUID,
  title                        VARCHAR,
  description                  TEXT,
  legal_category               VARCHAR,
  location                     VARCHAR,
  city                         VARCHAR,
  budget_min                   NUMERIC,
  budget_max                   NUMERIC,
  budget_type                  VARCHAR,
  urgency                      VARCHAR,
  preferred_consultation_medium TEXT[],
  attachments                  TEXT[],
  status                       VARCHAR,
  proposals_count              INT,
  selected_lawyer_id           UUID,
  deadline                     DATE,
  is_anonymous                 BOOLEAN,
  created_at                   TIMESTAMPTZ,
  updated_at                   TIMESTAMPTZ,
  client_name                  TEXT,
  client_avatar                TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id, j.client_id, j.title, j.description, j.legal_category,
    j.location, j.city, j.budget_min, j.budget_max, j.budget_type,
    j.urgency, j.preferred_consultation_medium, j.attachments,
    j.status, j.proposals_count, j.selected_lawyer_id, j.deadline,
    j.is_anonymous, j.created_at, j.updated_at,
    CASE WHEN j.is_anonymous THEN NULL ELSE u.name END::TEXT AS client_name,
    CASE WHEN j.is_anonymous THEN NULL ELSE u.profile_picture_url END::TEXT AS client_avatar
  FROM public.job_posts j
  LEFT JOIN public.users u ON u.id = j.client_id
  WHERE
    (p_status IS NULL OR j.status = p_status)
    AND (p_category IS NULL OR j.legal_category = p_category)
    AND (
      p_query IS NULL
      OR j.title ILIKE '%' || p_query || '%'
      OR j.description ILIKE '%' || p_query || '%'
      OR j.city ILIKE '%' || p_query || '%'
      OR j.legal_category ILIKE '%' || p_query || '%'
    )
  ORDER BY j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_jobs(TEXT, TEXT, TEXT, INT, INT) TO authenticated, anon;

-- 4. fn_send_counter_offer — atomic counter-offer with notification
CREATE OR REPLACE FUNCTION public.fn_send_counter_offer(
  p_proposal_id  INT,
  p_amount       NUMERIC,
  p_note         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lawyer_id  UUID;
  v_client_id  UUID;
  v_job_title  TEXT;
  v_offer_id   INT;
  v_caller     UUID := auth.uid();
BEGIN
  SELECT p.lawyer_id, j.client_id, j.title
  INTO v_lawyer_id, v_client_id, v_job_title
  FROM public.job_proposals p
  JOIN public.job_posts j ON j.id = p.job_post_id
  WHERE p.id = p_proposal_id;

  IF v_lawyer_id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  -- Only the client who owns the job OR the lawyer can send a counter-offer
  IF NOT (public.is_owner(v_client_id) OR public.is_owner(v_lawyer_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.proposal_counter_offers (proposal_id, offered_by, amount, note)
  VALUES (p_proposal_id, v_caller, p_amount, p_note)
  RETURNING id INTO v_offer_id;

  -- Move proposal to counter_offer status
  UPDATE public.job_proposals
  SET status = 'counter_offer', updated_at = NOW()
  WHERE id = p_proposal_id;

  -- Notify the other party
  DECLARE
    v_notify_id UUID := CASE WHEN public.is_owner(v_client_id) THEN v_lawyer_id ELSE v_client_id END;
    v_sender_name TEXT;
  BEGIN
    SELECT name INTO v_sender_name FROM public.users WHERE id = v_caller;
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (
      v_notify_id, 'counter_offer',
      'Counter Offer Received',
      COALESCE(v_sender_name, 'Someone') || ' sent a counter offer of BDT ' || p_amount || ' for "' || v_job_title || '"',
      false, NOW()
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'counter_offer_id', v_offer_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_send_counter_offer(INT, NUMERIC, TEXT) TO authenticated;

-- 5. fn_respond_counter_offer — accept or reject a counter-offer
CREATE OR REPLACE FUNCTION public.fn_respond_counter_offer(
  p_offer_id  INT,
  p_accept    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal_id INT;
  v_amount      NUMERIC;
BEGIN
  SELECT proposal_id, amount INTO v_proposal_id, v_amount
  FROM public.proposal_counter_offers WHERE id = p_offer_id;

  IF v_proposal_id IS NULL THEN
    RAISE EXCEPTION 'Counter offer not found';
  END IF;

  UPDATE public.proposal_counter_offers
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END
  WHERE id = p_offer_id;

  IF p_accept THEN
    -- Update proposal fee and accept it
    UPDATE public.job_proposals
    SET proposed_fee = v_amount, status = 'accepted', updated_at = NOW()
    WHERE id = v_proposal_id;
  ELSE
    -- Revert to pending so lawyer can re-negotiate
    UPDATE public.job_proposals
    SET status = 'pending', updated_at = NOW()
    WHERE id = v_proposal_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'accepted', p_accept);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_respond_counter_offer(INT, BOOLEAN) TO authenticated;

-- 6. fn_shortlist_proposal — client shortlists a proposal
CREATE OR REPLACE FUNCTION public.fn_shortlist_proposal(p_proposal_id INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lawyer_id UUID;
  v_job_title TEXT;
BEGIN
  SELECT p.lawyer_id, j.title INTO v_lawyer_id, v_job_title
  FROM public.job_proposals p
  JOIN public.job_posts j ON j.id = p.job_post_id
  WHERE p.id = p_proposal_id AND p.status = 'pending';

  IF v_lawyer_id IS NULL THEN RAISE EXCEPTION 'Proposal not found or not pending'; END IF;

  UPDATE public.job_proposals SET status = 'shortlisted', updated_at = NOW() WHERE id = p_proposal_id;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, is_read, created_at)
    VALUES (v_lawyer_id, 'proposal', 'Proposal Shortlisted ⭐',
      'Your proposal for "' || v_job_title || '" has been shortlisted by the client.',
      false, NOW());
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_shortlist_proposal(INT) TO authenticated;

-- 7. Enable realtime for counter_offers
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_counter_offers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 8. Reload schema cache
NOTIFY pgrst, 'reload schema';
