-- =============================================================================
-- Migration 36: Synchronize Contracts Schema & Financial Columns
-- Run this script in your Supabase SQL Editor to refresh schema cache
-- =============================================================================

-- 1. Ensure public.contracts has all frontend financial columns
ALTER TABLE IF EXISTS public.contracts
  ADD COLUMN IF NOT EXISTS agreed_fee NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS agreed_amount NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS terms TEXT DEFAULT 'Standard legal representation terms.',
  ADD COLUMN IF NOT EXISTS fee_structure VARCHAR(50) DEFAULT 'Fixed Fee',
  ADD COLUMN IF NOT EXISTS payment_schedule VARCHAR(50) DEFAULT '100% Upfront',
  ADD COLUMN IF NOT EXISTS retainer_amount NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_paid NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS fee_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'BDT';

-- 2. Synchronize existing contract values
UPDATE public.contracts 
SET 
  agreed_fee = COALESCE(NULLIF(agreed_fee, 0), NULLIF(agreed_amount, 0), NULLIF(amount, 0), 0.00),
  agreed_amount = COALESCE(NULLIF(agreed_amount, 0), NULLIF(agreed_fee, 0), NULLIF(amount, 0), 0.00),
  amount = COALESCE(NULLIF(amount, 0), NULLIF(agreed_fee, 0), NULLIF(agreed_amount, 0), 0.00);

-- 3. Create trigger function to keep amount, agreed_fee, and agreed_amount automatically synchronized
CREATE OR REPLACE FUNCTION public.fn_sync_contract_fees()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount := COALESCE(NULLIF(NEW.amount, 0), NULLIF(NEW.agreed_fee, 0), NULLIF(NEW.agreed_amount, 0), 0.00);
  NEW.agreed_fee := NEW.amount;
  NEW.agreed_amount := NEW.amount;
  IF NEW.outstanding_balance IS NULL OR NEW.outstanding_balance = 0 THEN
    NEW.outstanding_balance := NEW.amount - COALESCE(NEW.total_paid, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_contract_fees ON public.contracts;
CREATE TRIGGER trg_sync_contract_fees
  BEFORE INSERT OR UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_contract_fees();

-- 4. Notify Supabase PostgREST server to reload the schema cache immediately
NOTIFY pgrst, 'reload schema';
