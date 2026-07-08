-- =============================================================================
-- Migration 32: Fee-Setting, Negotiation, Contract & Consultation Payment Flow
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- =============================================
-- 1. UPDATE CONSULTATION SETTINGS TABLE
-- =============================================
ALTER TABLE IF EXISTS public.consultation_settings
  ADD COLUMN IF NOT EXISTS fee_initial_consultation NUMERIC(12,2) DEFAULT 3000.00,
  ADD COLUMN IF NOT EXISTS fee_case_review NUMERIC(12,2) DEFAULT 5000.00,
  ADD COLUMN IF NOT EXISTS fee_follow_up NUMERIC(12,2) DEFAULT 2000.00,
  ADD COLUMN IF NOT EXISTS fee_emergency NUMERIC(12,2) DEFAULT 8000.00;

-- Ensure public/client read access on consultation_settings so clients can fetch lawyer rates
ALTER TABLE public.consultation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Consultation settings readable by all" ON public.consultation_settings;
CREATE POLICY "Consultation settings readable by all" ON public.consultation_settings
  FOR SELECT USING (true);


-- =============================================
-- 2. UPDATE APPOINTMENTS TABLE
-- =============================================
ALTER TABLE IF EXISTS public.appointments
  ADD COLUMN IF NOT EXISTS session_type VARCHAR(50) DEFAULT 'Initial Consultation',
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2) DEFAULT 3000.00,
  ADD COLUMN IF NOT EXISTS agreed_fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS proposed_fee_client NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS proposed_fee_lawyer NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS negotiation_note TEXT,
  ADD COLUMN IF NOT EXISTS negotiation_round INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negotiation_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fee_locked BOOLEAN DEFAULT false;

-- Add enum values safely
ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'pending_negotiation';
ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'Upcoming';
ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'In Progress';

ALTER TYPE contract_status_enum ADD VALUE IF NOT EXISTS 'Pending Review';
ALTER TYPE contract_status_enum ADD VALUE IF NOT EXISTS 'Active';
ALTER TYPE contract_status_enum ADD VALUE IF NOT EXISTS 'Terminated';
ALTER TYPE contract_status_enum ADD VALUE IF NOT EXISTS 'Negotiation Requested';



-- =============================================
-- 3. UPDATE CONTRACTS TABLE
-- =============================================
ALTER TABLE IF EXISTS public.contracts
  ADD COLUMN IF NOT EXISTS agreed_amount NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS proposed_amount_client NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS proposed_amount_lawyer NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fee_structure VARCHAR(50) DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS estimated_hours INTEGER,
  ADD COLUMN IF NOT EXISTS payment_schedule VARCHAR(50) DEFAULT 'upfront',
  ADD COLUMN IF NOT EXISTS retainer_amount NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS retainer_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS retainer_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS negotiation_round INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negotiation_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fee_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS late_payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS total_paid NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(12,2) DEFAULT 0.00;

-- Drop check constraints on contracts.status if present to allow 'under_negotiation', 'sent', 'active', etc.
DO $$ 
BEGIN
  ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Update RLS on contracts to ensure both parties can read and update
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Contracts readable by participants" ON public.contracts;
CREATE POLICY "Contracts readable by participants" ON public.contracts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Contracts updatable by participants" ON public.contracts;
CREATE POLICY "Contracts updatable by participants" ON public.contracts
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Contracts insertable by participants" ON public.contracts;
CREATE POLICY "Contracts insertable by participants" ON public.contracts
  FOR INSERT WITH CHECK (true);


-- =============================================
-- 4. UPDATE CASE MILESTONES TABLE
-- =============================================
ALTER TABLE IF EXISTS public.case_milestones
  ADD COLUMN IF NOT EXISTS milestone_fee NUMERIC(12,2) DEFAULT 0.00;


-- =============================================
-- 5. UPDATE PAYMENTS TABLE
-- =============================================
ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS contract_id TEXT,
  ADD COLUMN IF NOT EXISTS milestone_id TEXT;


-- =============================================
-- 6. FUNCTIONS & TRIGGERS
-- =============================================

-- 6A. Trigger to enforce fee_locked on contracts
CREATE OR REPLACE FUNCTION public.fn_enforce_contract_fee_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.fee_locked = true THEN
    IF NEW.agreed_amount IS DISTINCT FROM OLD.agreed_amount OR
       NEW.fee_structure IS DISTINCT FROM OLD.fee_structure OR
       NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate OR
       NEW.payment_schedule IS DISTINCT FROM OLD.payment_schedule OR
       NEW.retainer_amount IS DISTINCT FROM OLD.retainer_amount THEN
      RAISE EXCEPTION 'Cannot modify fee terms after agreement has been locked (fee_locked = true).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_contract_fee_lock ON public.contracts;
CREATE TRIGGER trg_enforce_contract_fee_lock
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_contract_fee_lock();

-- 6B. Trigger to enforce fee_locked on appointments
CREATE OR REPLACE FUNCTION public.fn_enforce_appointment_fee_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.fee_locked = true THEN
    IF NEW.agreed_fee IS DISTINCT FROM OLD.agreed_fee OR
       NEW.fee_amount IS DISTINCT FROM OLD.fee_amount THEN
      RAISE EXCEPTION 'Cannot modify fee amount after consultation fee has been locked.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_appointment_fee_lock ON public.appointments;
CREATE TRIGGER trg_enforce_appointment_fee_lock
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_appointment_fee_lock();

-- 6C. Trigger to update contract balance when payment is recorded
CREATE OR REPLACE FUNCTION public.fn_update_contract_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id TEXT;
  v_total_paid NUMERIC(12,2);
  v_agreed_amount NUMERIC(12,2);
  v_retainer_amount NUMERIC(12,2);
BEGIN
  v_contract_id := COALESCE(NEW.contract_id, OLD.contract_id);
  IF v_contract_id IS NOT NULL THEN
    -- Calculate sum of completed payments for this contract
    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid
    FROM public.payments
    WHERE contract_id = v_contract_id AND status IN ('completed', 'released', 'paid');

    -- Get agreed_amount and retainer_amount from contract
    UPDATE public.contracts
    SET total_paid = v_total_paid,
        outstanding_balance = GREATEST(0.00, COALESCE(agreed_amount, 0.00) - v_total_paid),
        retainer_paid = CASE 
          WHEN COALESCE(retainer_amount, 0.00) > 0 AND v_total_paid >= COALESCE(retainer_amount, 0.00) THEN true 
          ELSE retainer_paid 
        END,
        retainer_paid_at = CASE 
          WHEN COALESCE(retainer_amount, 0.00) > 0 AND v_total_paid >= COALESCE(retainer_amount, 0.00) AND retainer_paid_at IS NULL THEN NOW() 
          ELSE retainer_paid_at 
        END,
        updated_at = NOW()
    WHERE id::text = v_contract_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_contract_balance ON public.payments;
CREATE TRIGGER trg_update_contract_balance
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_contract_balance();

-- 6D. Trigger to automatically create payment when milestone is approved
CREATE OR REPLACE FUNCTION public.fn_milestone_approval_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' AND COALESCE(NEW.milestone_fee, 0.00) > 0 THEN
    -- Get client_id from case
    SELECT client_id INTO v_client_id FROM public.cases WHERE id = NEW.case_id;
    
    IF v_client_id IS NOT NULL THEN
      INSERT INTO public.payments (
        client_id,
        lawyer_id,
        case_id,
        milestone_id,
        amount,
        payment_method,
        status,
        reference_number
      ) VALUES (
        v_client_id,
        NEW.lawyer_id,
        NEW.case_id,
        NEW.id::text,
        NEW.milestone_fee,
        'simulated_milestone_trigger',
        'completed',
        'MS-' || SUBSTRING(NEW.id::text, 1, 8)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_milestone_approval_payment ON public.case_milestones;
CREATE TRIGGER trg_milestone_approval_payment
  AFTER UPDATE ON public.case_milestones
  FOR EACH ROW EXECUTE FUNCTION public.fn_milestone_approval_payment();
