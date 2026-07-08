-- ==============================================================================
-- Migration: 005_financial_triggers_and_rpc.sql
-- Description: Establishes server-side triggers for payment commission calculation
--              and atomic RPC functions for financial metrics and escrow release.
-- ==============================================================================

-- 1. Ensure commission_transactions table exists with unique constraint on payment_id for UPSERT
CREATE TABLE IF NOT EXISTS public.commission_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  contract_id UUID,
  lawyer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_transactions_lawyer ON public.commission_transactions(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_commission_transactions_payment ON public.commission_transactions(payment_id);

-- 2. Server-Side Payment Commission Trigger Function
CREATE OR REPLACE FUNCTION public.fn_process_payment_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate DECIMAL(5,2);
  v_comm DECIMAL(12,2);
  v_net DECIMAL(12,2);
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed' OR NEW.commission_amount IS NULL) THEN
    SELECT COALESCE(commission_percentage, 10.00) INTO v_rate
    FROM public.platform_commission_config
    WHERE id = 1
    LIMIT 1;
    
    IF v_rate IS NULL THEN
      v_rate := 10.00;
    END IF;

    v_comm := ROUND((NEW.amount * (v_rate / 100.0))::numeric, 2);
    v_net := NEW.amount - v_comm;

    NEW.commission_rate := v_rate;
    NEW.commission_amount := v_comm;
    NEW.lawyer_payout := v_net;

    -- Update lawyer_payouts table atomically
    INSERT INTO public.lawyer_payouts (lawyer_id, total_earned, pending_payout, updated_at)
    VALUES (NEW.lawyer_id, v_net, v_net, NOW())
    ON CONFLICT (lawyer_id) DO UPDATE SET
      total_earned = public.lawyer_payouts.total_earned + EXCLUDED.total_earned,
      pending_payout = public.lawyer_payouts.pending_payout + EXCLUDED.pending_payout,
      updated_at = NOW();

    -- Insert or update commission_transactions if table exists
    BEGIN
      INSERT INTO public.commission_transactions (
        payment_id, contract_id, lawyer_id, gross_amount, 
        commission_rate, commission_amount, net_amount, status
      ) VALUES (
        NEW.id, NEW.case_id, NEW.lawyer_id, NEW.amount, 
        v_rate, v_comm, v_net, 'completed'
      )
      ON CONFLICT (payment_id) DO UPDATE SET
        gross_amount = EXCLUDED.gross_amount,
        commission_rate = EXCLUDED.commission_rate,
        commission_amount = EXCLUDED.commission_amount,
        net_amount = EXCLUDED.net_amount,
        status = EXCLUDED.status,
        updated_at = NOW();
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_payment_commission ON public.payments;
CREATE TRIGGER trg_process_payment_commission
BEFORE INSERT OR UPDATE OF status, amount ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.fn_process_payment_commission();

-- 3. Atomic Milestone Approval & Escrow Release RPC
CREATE OR REPLACE FUNCTION public.fn_approve_milestone_and_release_funds(p_milestone_id UUID, p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id UUID;
  v_case_id UUID;
  v_amount NUMERIC(12,2) := 0;
BEGIN
  -- Check contract_milestones first
  BEGIN
    SELECT contract_id, COALESCE(amount, 0) INTO v_contract_id, v_amount
    FROM public.contract_milestones
    WHERE id = p_milestone_id;

    IF v_contract_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.contracts WHERE id = v_contract_id AND (client_id = p_client_id OR public.is_admin())) THEN
        RAISE EXCEPTION 'Unauthorized: You do not own this contract milestone';
      END IF;

      UPDATE public.contract_milestones
      SET status = 'completed', updated_at = NOW()
      WHERE id = p_milestone_id;

      UPDATE public.contracts
      SET released_amount = COALESCE(released_amount, 0) + v_amount,
          updated_at = NOW()
      WHERE id = v_contract_id;

      RETURN true;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- Check case_milestones
  BEGIN
    SELECT case_id INTO v_case_id
    FROM public.case_milestones
    WHERE id = p_milestone_id;

    IF v_case_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.cases WHERE id = v_case_id AND (client_id = p_client_id OR public.is_admin())) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: You do not own this case milestone';
      END IF;

      UPDATE public.case_milestones
      SET status = 'approved', reviewed_at = NOW()
      WHERE id = p_milestone_id;

      RETURN true;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RAISE EXCEPTION 'Milestone not found or access denied';
END;
$$;

-- 4. Server-Side Admin Financial Summary RPC
CREATE OR REPLACE FUNCTION public.fn_get_admin_financial_summary()
RETURNS TABLE(
  total_fee_volume NUMERIC,
  total_platform_revenue NUMERIC,
  total_commission_from_payments NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH contract_vol AS (
    SELECT COALESCE(SUM(COALESCE(agreed_fee, amount, agreed_amount, 0)), 0) AS c_vol
    FROM public.contracts
  ),
  apt_vol AS (
    SELECT COALESCE(SUM(COALESCE(agreed_fee, fee_amount, proposed_fee_client, 0)), 0) AS a_vol
    FROM public.appointments
  ),
  comm_config AS (
    SELECT COALESCE(commission_percentage, 10.00) AS cfg_rate
    FROM public.platform_commission_config
    WHERE id = 1
    LIMIT 1
  ),
  pay_comm AS (
    SELECT COALESCE(SUM(COALESCE(commission_amount, 0)), 0) AS p_comm
    FROM public.payments
  )
  SELECT 
    (contract_vol.c_vol + apt_vol.a_vol) AS total_fee_volume,
    ROUND(((contract_vol.c_vol + apt_vol.a_vol) * (comm_config.cfg_rate / 100.0)) + pay_comm.p_comm, 2) AS total_platform_revenue,
    pay_comm.p_comm AS total_commission_from_payments
  FROM contract_vol, apt_vol, comm_config, pay_comm;
$$;

-- 5. Server-Side Booking Fee Calculation RPC
CREATE OR REPLACE FUNCTION public.fn_calculate_booking_fee(
  p_lawyer_id UUID,
  p_fee_type TEXT,
  p_custom_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_fee NUMERIC(12,2);
  v_comm_rate NUMERIC(5,2);
  v_platform_fee NUMERIC(12,2);
  v_total_fee NUMERIC(12,2);
  v_settings RECORD;
BEGIN
  BEGIN
    SELECT * INTO v_settings
    FROM public.consultation_settings
    WHERE lawyer_id = p_lawyer_id
    LIMIT 1;
  EXCEPTION WHEN undefined_table THEN
    v_settings := NULL;
  END;

  IF p_custom_amount IS NOT NULL AND p_custom_amount > 0 THEN
    v_base_fee := p_custom_amount;
  ELSIF p_fee_type = 'Initial Consultation' OR p_fee_type = 'initial_consultation' THEN
    v_base_fee := COALESCE(v_settings.fee_initial_consultation, 3000);
  ELSIF p_fee_type = 'Case Review' OR p_fee_type = 'case_review' THEN
    v_base_fee := COALESCE(v_settings.fee_case_review, 5000);
  ELSIF p_fee_type = 'Follow-up' OR p_fee_type = 'follow_up' THEN
    v_base_fee := COALESCE(v_settings.fee_follow_up, 2000);
  ELSIF p_fee_type = 'Emergency' OR p_fee_type = 'emergency' THEN
    v_base_fee := COALESCE(v_settings.fee_emergency, 8000);
  ELSE
    v_base_fee := 3000;
  END IF;

  SELECT COALESCE(commission_percentage, 10.00) INTO v_comm_rate
  FROM public.platform_commission_config
  WHERE id = 1
  LIMIT 1;

  IF v_comm_rate IS NULL THEN v_comm_rate := 10.00; END IF;

  v_platform_fee := ROUND((v_base_fee * (v_comm_rate / 100.0))::numeric, 2);
  v_total_fee := v_base_fee + v_platform_fee;

  RETURN jsonb_build_object(
    'base_fee', v_base_fee,
    'platform_fee', v_platform_fee,
    'commission_rate', v_comm_rate,
    'total_fee', v_total_fee,
    'currency', 'BDT'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_approve_milestone_and_release_funds(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_admin_financial_summary() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_calculate_booking_fee(UUID, TEXT, NUMERIC) TO authenticated, anon;
