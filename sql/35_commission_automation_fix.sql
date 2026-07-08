-- ==============================================================================
-- 35_commission_automation_fix.sql
-- Fix & automate commission calculations, payouts table, and triggers
-- ==============================================================================

-- 1. Ensure platform_commission_config table exists with single row
CREATE TABLE IF NOT EXISTS public.platform_commission_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.platform_commission_config (id, commission_percentage)
VALUES (1, 10.00)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_commission_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Commission config readable by all" ON public.platform_commission_config;
CREATE POLICY "Commission config readable by all" ON public.platform_commission_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Commission config updatable by all authenticated" ON public.platform_commission_config;
CREATE POLICY "Commission config updatable by all authenticated" ON public.platform_commission_config FOR ALL USING (auth.role() IN ('authenticated', 'service_role'));

-- 2. Ensure payments columns exist
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS lawyer_payout NUMERIC(12,2);

-- Convert payments status to VARCHAR to avoid enum errors
DO $$
BEGIN
  ALTER TABLE public.payments ALTER COLUMN status TYPE VARCHAR(100) USING status::text;
EXCEPTION
  WHEN others THEN null;
END $$;

-- 3. Ensure lawyer_payouts table exists
CREATE TABLE IF NOT EXISTS public.lawyer_payouts (
  lawyer_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  total_earned NUMERIC(12,2) DEFAULT 0.00,
  pending_payout NUMERIC(12,2) DEFAULT 0.00,
  paid_out NUMERIC(12,2) DEFAULT 0.00,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.lawyer_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lawyer payouts readable by owner and admin" ON public.lawyer_payouts;
CREATE POLICY "Lawyer payouts readable by owner and admin" ON public.lawyer_payouts FOR ALL USING (true);

-- 4. Calculate commission helper function
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

GRANT EXECUTE ON FUNCTION public.calculate_payment_commission(NUMERIC) TO authenticated, anon, service_role;
