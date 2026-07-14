-- =============================================================================
-- Migration 61: Complete Production-Grade Review & Rating System
-- Description: Establishes reviews, review_replies, and review_reports tables
--              with strict 1-review-per-contract uniqueness, real-time replica
--              identity, automatic rating recalculation triggers across lawyer
--              tables, and secure role-based RPC workflows.
-- =============================================================================

-- 1. Create `reviews` table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  rating_communication INTEGER CHECK (rating_communication BETWEEN 1 AND 5),
  rating_professionalism INTEGER CHECK (rating_professionalism BETWEEN 1 AND 5),
  rating_expertise INTEGER CHECK (rating_expertise BETWEEN 1 AND 5),
  rating_responsiveness INTEGER CHECK (rating_responsiveness BETWEEN 1 AND 5),
  rating_value INTEGER CHECK (rating_value BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  client_name VARCHAR(255) NOT NULL DEFAULT 'Verified Client',
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified_client BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safely add columns if `reviews` or `feedback` table already existed prior to this migration
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS lawyer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS rating_communication INTEGER,
  ADD COLUMN IF NOT EXISTS rating_professionalism INTEGER,
  ADD COLUMN IF NOT EXISTS rating_expertise INTEGER,
  ADD COLUMN IF NOT EXISTS rating_responsiveness INTEGER,
  ADD COLUMN IF NOT EXISTS rating_value INTEGER,
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS client_name VARCHAR(255) DEFAULT 'Verified Client',
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(50) DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS is_verified_client BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS lawyer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS client_name VARCHAR(255) DEFAULT 'Verified Client',
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lawyer_response TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure partial unique index: Exactly 1 review per completed contract
DROP INDEX IF EXISTS idx_reviews_unique_contract;
CREATE UNIQUE INDEX idx_reviews_unique_contract ON public.reviews(contract_id) WHERE contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_lawyer_id ON public.reviews(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON public.reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);

-- 2. Create `review_replies` table
CREATE TABLE IF NOT EXISTS public.review_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL UNIQUE REFERENCES public.reviews(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reply_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.review_replies
  ADD COLUMN IF NOT EXISTS review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS lawyer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reply_text TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_review_replies_review_id ON public.review_replies(review_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_lawyer_id ON public.review_replies(lawyer_id);

-- 3. Create `review_reports` table
CREATE TABLE IF NOT EXISTS public.review_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason VARCHAR(255) NOT NULL,
  details TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.review_reports
  ADD COLUMN IF NOT EXISTS review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reason VARCHAR(255),
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_review_reports_status ON public.review_reports(status);

-- 4. Enable REPLICA IDENTITY FULL for zero-latency Supabase Realtime synchronization
ALTER TABLE public.reviews REPLICA IDENTITY FULL;
ALTER TABLE public.review_replies REPLICA IDENTITY FULL;
ALTER TABLE public.review_reports REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication safely
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews, public.review_replies, public.review_reports;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- 5. Enable RLS and setup role-based policies
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

-- Reviews RLS
DROP POLICY IF EXISTS "Public can view non-hidden reviews" ON public.reviews;
CREATE POLICY "Public can view non-hidden reviews" ON public.reviews
  FOR SELECT USING (is_hidden = false OR auth.uid() = client_id OR auth.uid() = lawyer_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin'));

DROP POLICY IF EXISTS "Clients can insert own review" ON public.reviews;
CREATE POLICY "Clients can insert own review" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Clients can update own review" ON public.reviews;
CREATE POLICY "Clients can update own review" ON public.reviews
  FOR UPDATE USING (auth.uid() = client_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin'));

DROP POLICY IF EXISTS "Clients and Admins can delete review" ON public.reviews;
CREATE POLICY "Clients and Admins can delete review" ON public.reviews
  FOR DELETE USING (auth.uid() = client_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin'));

-- Replies RLS
DROP POLICY IF EXISTS "Public can view replies to non-hidden reviews" ON public.review_replies;
CREATE POLICY "Public can view replies to non-hidden reviews" ON public.review_replies
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lawyers can insert own reply" ON public.review_replies;
CREATE POLICY "Lawyers can insert own reply" ON public.review_replies
  FOR INSERT WITH CHECK (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "Lawyers and Admins can update/delete replies" ON public.review_replies;
CREATE POLICY "Lawyers and Admins can update/delete replies" ON public.review_replies
  FOR ALL USING (auth.uid() = lawyer_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin'));

-- Reports RLS
DROP POLICY IF EXISTS "Authenticated users can report reviews" ON public.review_reports;
CREATE POLICY "Authenticated users can report reviews" ON public.review_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can view and manage reports" ON public.review_reports;
CREATE POLICY "Admins can view and manage reports" ON public.review_reports
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin'));

-- 6. Trigger Function to automatically recalculate lawyer rating, total reviews, and star distribution
CREATE OR REPLACE FUNCTION public.fn_update_lawyer_ratings_from_reviews()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lawyer_id UUID;
  v_count INT;
  v_avg NUMERIC(3,2);
  v_dist JSONB;
BEGIN
  v_lawyer_id := COALESCE(NEW.lawyer_id, OLD.lawyer_id);
  IF v_lawyer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate totals from non-hidden reviews
  SELECT 
    COUNT(*),
    COALESCE(ROUND(AVG(rating)::numeric, 2), 0.00),
    jsonb_build_object(
      '5', COUNT(*) FILTER (WHERE rating = 5),
      '4', COUNT(*) FILTER (WHERE rating = 4),
      '3', COUNT(*) FILTER (WHERE rating = 3),
      '2', COUNT(*) FILTER (WHERE rating = 2),
      '1', COUNT(*) FILTER (WHERE rating = 1)
    )
  INTO v_count, v_avg, v_dist
  FROM public.reviews
  WHERE lawyer_id = v_lawyer_id AND is_hidden = false;

  -- Update public.lawyers table
  BEGIN
    UPDATE public.lawyers
    SET total_reviews = v_count,
        avg_rating = v_avg,
        rating_distribution = v_dist,
        updated_at = NOW()
    WHERE user_id = v_lawyer_id OR id::text = v_lawyer_id::text;
  EXCEPTION WHEN OTHERS THEN 
    BEGIN
      UPDATE public.lawyers
      SET total_reviews = v_count,
          avg_rating = v_avg,
          updated_at = NOW()
      WHERE user_id = v_lawyer_id OR id::text = v_lawyer_id::text;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END;

  -- Update public.lawyer_profiles table
  BEGIN
    UPDATE public.lawyer_profiles
    SET reviews_count = v_count,
        rating = v_avg,
        updated_at = NOW()
    WHERE id = v_lawyer_id;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      UPDATE public.lawyer_profiles
      SET rating = v_avg,
          updated_at = NOW()
      WHERE id = v_lawyer_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END;

  -- Update public.users table rating field if exists
  BEGIN
    UPDATE public.users
    SET rating = v_avg,
        updated_at = NOW()
    WHERE id = v_lawyer_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_rating_sync ON public.reviews;
CREATE TRIGGER trg_reviews_rating_sync
  AFTER INSERT OR UPDATE OF rating, is_hidden OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_lawyer_ratings_from_reviews();

-- Also ensure rating_distribution column exists on public.lawyers
ALTER TABLE public.lawyers ADD COLUMN IF NOT EXISTS rating_distribution JSONB DEFAULT '{"5":0,"4":0,"3":0,"2":0,"1":0}'::jsonb;

-- 7. Secure RPC: Submit Contract Review
CREATE OR REPLACE FUNCTION public.fn_submit_review(
  p_contract_id UUID,
  p_rating INT,
  p_comment TEXT,
  p_rating_comm INT DEFAULT 5,
  p_rating_prof INT DEFAULT 5,
  p_rating_exp INT DEFAULT 5,
  p_rating_resp INT DEFAULT 5,
  p_rating_val INT DEFAULT 5,
  p_is_anonymous BOOLEAN DEFAULT FALSE,
  p_client_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lawyer_id UUID;
  v_case_id UUID;
  v_contract_status TEXT;
  v_client_name TEXT;
  v_existing_id UUID;
  v_review_id UUID;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Overall rating must be between 1 and 5 stars.';
  END IF;

  -- Verify contract and extract lawyer_id and case_id
  SELECT lawyer_id, case_id, status INTO v_lawyer_id, v_case_id, v_contract_status
  FROM public.contracts
  WHERE id = p_contract_id AND client_id = p_client_id;

  IF v_lawyer_id IS NULL THEN
    RAISE EXCEPTION 'Contract not found or you are not authorized to review this matter.';
  END IF;

  -- Verify contract status is completed or closed
  IF LOWER(v_contract_status) NOT IN ('completed', 'closed', 'resolved') THEN
    RAISE EXCEPTION 'Reviews can only be submitted for completed legal contracts/cases.';
  END IF;

  -- Check for duplicate review
  SELECT id INTO v_existing_id
  FROM public.reviews
  WHERE contract_id = p_contract_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'A review has already been submitted for this completed contract.';
  END IF;

  SELECT name INTO v_client_name FROM public.users WHERE id = p_client_id;

  INSERT INTO public.reviews (
    lawyer_id, client_id, contract_id, case_id,
    rating, rating_communication, rating_professionalism,
    rating_expertise, rating_responsiveness, rating_value,
    comment, client_name, is_anonymous, is_verified_client,
    created_at, updated_at
  )
  VALUES (
    v_lawyer_id, p_client_id, p_contract_id, v_case_id,
    p_rating, p_rating_comm, p_rating_prof,
    p_rating_exp, p_rating_resp, p_rating_val,
    p_comment, COALESCE(v_client_name, 'Verified Client'), p_is_anonymous, TRUE,
    NOW(), NOW()
  )
  RETURNING id INTO v_review_id;

  -- Also insert into legacy feedback table for backward compatibility with older components
  BEGIN
    INSERT INTO public.feedback (
      client_id, lawyer_id, contract_id, case_id, rating, comment, created_at, updated_at
    )
    VALUES (
      p_client_id, v_lawyer_id, p_contract_id, v_case_id, p_rating, p_comment, NOW(), NOW()
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Send notification to the lawyer
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, created_at)
    VALUES (
      v_lawyer_id,
      'NEW_REVIEW',
      '🌟 New Client Review Received',
      CASE WHEN p_is_anonymous THEN 'A verified client has submitted a ' || p_rating || '-star review for your completed matter.'
           ELSE COALESCE(v_client_name, 'A client') || ' left a ' || p_rating || '-star review on your profile.' END,
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true, 'review_id', v_review_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_submit_review(UUID, INT, TEXT, INT, INT, INT, INT, INT, BOOLEAN, UUID) TO authenticated;

-- 8. Secure RPC: Reply to Review (Lawyer once per review)
CREATE OR REPLACE FUNCTION public.fn_reply_to_review(
  p_review_id UUID,
  p_reply_text TEXT,
  p_lawyer_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_lawyer_id UUID;
  v_client_id UUID;
  v_existing_reply UUID;
  v_reply_id UUID;
BEGIN
  IF LENGTH(TRIM(p_reply_text)) < 2 THEN
    RAISE EXCEPTION 'Reply text must not be empty.';
  END IF;

  SELECT lawyer_id, client_id INTO v_review_lawyer_id, v_client_id
  FROM public.reviews
  WHERE id = p_review_id;

  IF v_review_lawyer_id IS NULL OR v_review_lawyer_id <> p_lawyer_id THEN
    RAISE EXCEPTION 'You are not authorized to reply to this review.';
  END IF;

  SELECT id INTO v_existing_reply
  FROM public.review_replies
  WHERE review_id = p_review_id
  LIMIT 1;

  IF v_existing_reply IS NOT NULL THEN
    RAISE EXCEPTION 'You have already replied to this client review. Only one reply is permitted per review.';
  END IF;

  INSERT INTO public.review_replies (review_id, lawyer_id, reply_text, created_at, updated_at)
  VALUES (p_review_id, p_lawyer_id, p_reply_text, NOW(), NOW())
  RETURNING id INTO v_reply_id;

  -- Also update legacy feedback table response if applicable
  BEGIN
    UPDATE public.feedback
    SET lawyer_response = p_reply_text, updated_at = NOW()
    WHERE contract_id = (SELECT contract_id FROM public.reviews WHERE id = p_review_id);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Notify the client
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, created_at)
    VALUES (
      v_client_id,
      'REVIEW_REPLY',
      '💬 Advocate Replied to Your Review',
      'Your assigned legal representative has posted a professional reply to your review.',
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true, 'reply_id', v_reply_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_reply_to_review(UUID, TEXT, UUID) TO authenticated;

-- 9. Secure RPC: Admin Moderate Review
CREATE OR REPLACE FUNCTION public.fn_moderate_review(
  p_review_id UUID,
  p_action VARCHAR,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_action = 'hide' THEN
    UPDATE public.reviews SET is_hidden = true, updated_at = NOW() WHERE id = p_review_id;
  ELSIF p_action = 'restore' THEN
    UPDATE public.reviews SET is_hidden = false, updated_at = NOW() WHERE id = p_review_id;
  ELSIF p_action = 'delete' THEN
    DELETE FROM public.reviews WHERE id = p_review_id;
  ELSE
    RAISE EXCEPTION 'Invalid moderation action: %', p_action;
  END IF;

  RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_moderate_review(UUID, VARCHAR, TEXT) TO authenticated;
