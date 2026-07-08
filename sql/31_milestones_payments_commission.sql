-- =============================================================================
-- Migration 31: Case Milestones, Consultation Updates & Payment Commission
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- =============================================
-- SYSTEM 1: Case Milestone Tracking
-- =============================================

-- 1A. case_milestones table
CREATE TABLE IF NOT EXISTS public.case_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL,
  lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'revision_requested')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  client_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_milestones_case ON public.case_milestones(case_id);
CREATE INDEX IF NOT EXISTS idx_case_milestones_lawyer ON public.case_milestones(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_case_milestones_status ON public.case_milestones(status);

-- 1B. milestone_activity_log table (audit trail)
CREATE TABLE IF NOT EXISTS public.milestone_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  milestone_id UUID NOT NULL REFERENCES public.case_milestones(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_role VARCHAR(20) NOT NULL CHECK (actor_role IN ('lawyer', 'client', 'admin')),
  action VARCHAR(50) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestone_activity_milestone ON public.milestone_activity_log(milestone_id);

-- 1C. RLS for case_milestones
ALTER TABLE public.case_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Milestone participants can read" ON public.case_milestones;
CREATE POLICY "Milestone participants can read" ON public.case_milestones
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lawyers can insert milestones on own cases" ON public.case_milestones;
CREATE POLICY "Lawyers can insert milestones on own cases" ON public.case_milestones
  FOR INSERT WITH CHECK (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "Authenticated can update milestones" ON public.case_milestones;
CREATE POLICY "Authenticated can update milestones" ON public.case_milestones
  FOR UPDATE USING (true) WITH CHECK (true);

-- 1D. RLS for milestone_activity_log
ALTER TABLE public.milestone_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activity log readable by all authenticated" ON public.milestone_activity_log;
CREATE POLICY "Activity log readable by all authenticated" ON public.milestone_activity_log
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Activity log insertable by all authenticated" ON public.milestone_activity_log;
CREATE POLICY "Activity log insertable by all authenticated" ON public.milestone_activity_log
  FOR INSERT WITH CHECK (true);


-- =============================================
-- SYSTEM 2: Consultation Updates
-- =============================================

-- 2A. consultation_updates table
CREATE TABLE IF NOT EXISTS public.consultation_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL,
  update_type VARCHAR(30) NOT NULL
    CHECK (update_type IN ('confirmed', 'rescheduled', 'cancelled', 'reminder', 'started', 'completed', 'no_show', 'custom')),
  message TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_updates_apt ON public.consultation_updates(appointment_id);

-- 2B. RLS for consultation_updates
ALTER TABLE public.consultation_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Consultation updates readable by all authenticated" ON public.consultation_updates;
CREATE POLICY "Consultation updates readable by all authenticated" ON public.consultation_updates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Consultation updates insertable by authenticated" ON public.consultation_updates;
CREATE POLICY "Consultation updates insertable by authenticated" ON public.consultation_updates
  FOR INSERT WITH CHECK (auth.uid() = created_by);


-- =============================================
-- SYSTEM 3: Payment Commission System
-- =============================================

-- 3A. platform_commission_config (single-row config)
CREATE TABLE IF NOT EXISTS public.platform_commission_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Seed the default config row
INSERT INTO public.platform_commission_config (id, commission_percentage)
VALUES (1, 10.00)
ON CONFLICT (id) DO NOTHING;

-- 3B. payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  appointment_id UUID,
  case_id UUID,
  amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'simulated',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'refunded', 'disputed')),
  commission_rate NUMERIC(5,2),
  commission_amount NUMERIC(12,2),
  lawyer_payout NUMERIC(12,2),
  reference_number VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_client ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_lawyer ON public.payments(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- 3C. lawyer_payouts table
CREATE TABLE IF NOT EXISTS public.lawyer_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  total_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_payout NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_payout_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lawyer_payouts_lawyer ON public.lawyer_payouts(lawyer_id);

-- 3D. RLS for platform_commission_config
ALTER TABLE public.platform_commission_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Commission config readable by all" ON public.platform_commission_config;
CREATE POLICY "Commission config readable by all" ON public.platform_commission_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Commission config updatable by all authenticated" ON public.platform_commission_config;
CREATE POLICY "Commission config updatable by all authenticated" ON public.platform_commission_config
  FOR UPDATE USING (true) WITH CHECK (true);

-- 3E. RLS for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payments readable by all authenticated" ON public.payments;
CREATE POLICY "Payments readable by all authenticated" ON public.payments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Clients can insert payments" ON public.payments;
CREATE POLICY "Clients can insert payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Payments updatable by all authenticated" ON public.payments;
CREATE POLICY "Payments updatable by all authenticated" ON public.payments
  FOR UPDATE USING (true) WITH CHECK (true);

-- 3F. RLS for lawyer_payouts
ALTER TABLE public.lawyer_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lawyer payouts readable by all authenticated" ON public.lawyer_payouts;
CREATE POLICY "Lawyer payouts readable by all authenticated" ON public.lawyer_payouts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lawyer payouts upsertable by all authenticated" ON public.lawyer_payouts;
CREATE POLICY "Lawyer payouts upsertable by all authenticated" ON public.lawyer_payouts
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Lawyer payouts updatable by all authenticated" ON public.lawyer_payouts;
CREATE POLICY "Lawyer payouts updatable by all authenticated" ON public.lawyer_payouts
  FOR UPDATE USING (true) WITH CHECK (true);


-- =============================================
-- DATABASE FUNCTIONS
-- =============================================

-- Function: Calculate payment commission from config table
CREATE OR REPLACE FUNCTION public.calculate_payment_commission(total_amount NUMERIC)
RETURNS TABLE(commission_rate NUMERIC, commission_amount NUMERIC, lawyer_payout_amount NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  SELECT commission_percentage INTO v_rate
  FROM public.platform_commission_config
  WHERE id = 1;

  IF v_rate IS NULL THEN v_rate := 10.00; END IF;

  commission_rate := v_rate;
  commission_amount := ROUND(total_amount * (v_rate / 100), 2);
  lawyer_payout_amount := ROUND(total_amount - (total_amount * (v_rate / 100)), 2);

  RETURN NEXT;
END;
$$;


-- =============================================
-- DATABASE TRIGGERS
-- =============================================

-- Trigger function: Auto-update lawyer_payouts when payment completed
CREATE OR REPLACE FUNCTION public.handle_payment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only act when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Calculate commission if not already set
    IF NEW.commission_amount IS NULL THEN
      SELECT cc.commission_amount, cc.lawyer_payout_amount, cc.commission_rate
      INTO NEW.commission_amount, NEW.lawyer_payout, NEW.commission_rate
      FROM public.calculate_payment_commission(NEW.amount) cc;
    END IF;

    -- Upsert lawyer_payouts
    INSERT INTO public.lawyer_payouts (lawyer_id, total_earned, pending_payout, updated_at)
    VALUES (NEW.lawyer_id, COALESCE(NEW.lawyer_payout, 0), COALESCE(NEW.lawyer_payout, 0), NOW())
    ON CONFLICT (lawyer_id) DO UPDATE SET
      total_earned = public.lawyer_payouts.total_earned + COALESCE(NEW.lawyer_payout, 0),
      pending_payout = public.lawyer_payouts.pending_payout + COALESCE(NEW.lawyer_payout, 0),
      updated_at = NOW();

    -- Create notification for the lawyer
    INSERT INTO public.notifications (user_id, title, body, type, is_read, created_at)
    VALUES (
      NEW.lawyer_id,
      'Payment Received',
      'You received a payment of BDT ' || NEW.amount || '. Your payout: BDT ' || COALESCE(NEW.lawyer_payout, NEW.amount),
      'payment',
      false,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_completed ON public.payments;
CREATE TRIGGER trg_payment_completed
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_payment_completed();

-- Also handle INSERT with status already 'completed'
CREATE OR REPLACE FUNCTION public.handle_payment_insert_completed()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    -- Calculate commission if not set
    IF NEW.commission_amount IS NULL THEN
      SELECT cc.commission_amount, cc.lawyer_payout_amount, cc.commission_rate
      INTO NEW.commission_amount, NEW.lawyer_payout, NEW.commission_rate
      FROM public.calculate_payment_commission(NEW.amount) cc;
    END IF;

    -- Upsert lawyer_payouts
    INSERT INTO public.lawyer_payouts (lawyer_id, total_earned, pending_payout, updated_at)
    VALUES (NEW.lawyer_id, COALESCE(NEW.lawyer_payout, 0), COALESCE(NEW.lawyer_payout, 0), NOW())
    ON CONFLICT (lawyer_id) DO UPDATE SET
      total_earned = public.lawyer_payouts.total_earned + COALESCE(NEW.lawyer_payout, 0),
      pending_payout = public.lawyer_payouts.pending_payout + COALESCE(NEW.lawyer_payout, 0),
      updated_at = NOW();

    -- Create notification for the lawyer
    INSERT INTO public.notifications (user_id, title, body, type, is_read, created_at)
    VALUES (
      NEW.lawyer_id,
      'Payment Received',
      'You received a payment of BDT ' || NEW.amount || '. Your payout: BDT ' || COALESCE(NEW.lawyer_payout, NEW.amount),
      'payment',
      false,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_insert_completed ON public.payments;
CREATE TRIGGER trg_payment_insert_completed
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_payment_insert_completed();


-- Trigger function: Auto-log milestone status changes + notify counterparty
CREATE OR REPLACE FUNCTION public.handle_milestone_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_case_client_id UUID;
  v_case_title TEXT;
  v_notify_user UUID;
  v_notify_title TEXT;
  v_notify_body TEXT;
BEGIN
  -- Get the case info to find the client
  SELECT c.client_id, c.title INTO v_case_client_id, v_case_title
  FROM public.cases c WHERE c.id::text = NEW.case_id::text
  LIMIT 1;

  -- Determine who to notify
  IF NEW.status IN ('approved', 'rejected', 'revision_requested') THEN
    -- Client took action -> notify the lawyer
    v_notify_user := NEW.lawyer_id;
    IF NEW.status = 'approved' THEN
      v_notify_title := 'Milestone Approved';
      v_notify_body := 'Your milestone "' || NEW.title || '" for case "' || COALESCE(v_case_title, 'Case') || '" has been approved by the client.';
    ELSIF NEW.status = 'rejected' THEN
      v_notify_title := 'Milestone Rejected';
      v_notify_body := 'Your milestone "' || NEW.title || '" has been rejected. Feedback: ' || COALESCE(NEW.client_feedback, 'No feedback provided.');
    ELSE
      v_notify_title := 'Revision Requested';
      v_notify_body := 'Client requested improvements on "' || NEW.title || '". Feedback: ' || COALESCE(NEW.client_feedback, 'No feedback provided.');
    END IF;
  ELSIF NEW.status = 'submitted' THEN
    -- Lawyer submitted -> notify the client
    v_notify_user := v_case_client_id;
    v_notify_title := 'New Milestone Submitted';
    v_notify_body := 'Adv. submitted milestone "' || NEW.title || '" for your case "' || COALESCE(v_case_title, 'Case') || '". Please review.';
  END IF;

  -- Insert notification if we have a target user
  IF v_notify_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, is_read, created_at)
    VALUES (v_notify_user, v_notify_title, v_notify_body, 'milestone', false, NOW());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_milestone_status_notify ON public.case_milestones;
CREATE TRIGGER trg_milestone_status_notify
  AFTER INSERT OR UPDATE OF status ON public.case_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_milestone_status_change();


-- Trigger function: Auto-notify on consultation updates
CREATE OR REPLACE FUNCTION public.handle_consultation_update_notify()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id UUID;
  v_lawyer_id UUID;
  v_notify_user UUID;
BEGIN
  -- Get the appointment participants
  SELECT a.client_id, a.lawyer_id INTO v_client_id, v_lawyer_id
  FROM public.appointments a WHERE a.id::text = NEW.appointment_id::text
  LIMIT 1;

  -- If the update was created by the lawyer, notify the client; vice versa
  IF NEW.created_by = v_lawyer_id THEN
    v_notify_user := v_client_id;
  ELSE
    v_notify_user := v_lawyer_id;
  END IF;

  IF v_notify_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, is_read, created_at)
    VALUES (
      v_notify_user,
      'Consultation Update',
      COALESCE(NEW.message, 'Your consultation status has been updated to: ' || NEW.update_type),
      'consultation_update',
      false,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consultation_update_notify ON public.consultation_updates;
CREATE TRIGGER trg_consultation_update_notify
  AFTER INSERT ON public.consultation_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_consultation_update_notify();


-- =============================================
-- ENABLE SUPABASE REALTIME ON NEW TABLES
-- =============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.case_milestones;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.milestone_activity_log;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_updates;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lawyer_payouts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- =============================================
-- GRANT PERMISSIONS
-- =============================================
GRANT ALL ON public.case_milestones TO authenticated, anon, service_role;
GRANT ALL ON public.milestone_activity_log TO authenticated, anon, service_role;
GRANT ALL ON public.consultation_updates TO authenticated, anon, service_role;
GRANT ALL ON public.platform_commission_config TO authenticated, anon, service_role;
GRANT ALL ON public.payments TO authenticated, anon, service_role;
GRANT ALL ON public.lawyer_payouts TO authenticated, anon, service_role;
