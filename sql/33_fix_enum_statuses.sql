-- =============================================================================
-- Migration 33: Fix Status Enums for Appointments & Contracts
-- Run this script in your Supabase SQL Editor to resolve "invalid input value for enum"
-- =============================================================================

-- 1. Add all required status values to appointment_status_enum
ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'pending_negotiation';
ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'Upcoming';
ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'In Progress';
ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'cancelled';

-- 2. Add all required status values to contract_status_enum
ALTER TYPE contract_status_enum ADD VALUE IF NOT EXISTS 'Pending Review';
ALTER TYPE contract_status_enum ADD VALUE IF NOT EXISTS 'Active';
ALTER TYPE contract_status_enum ADD VALUE IF NOT EXISTS 'Terminated';
ALTER TYPE contract_status_enum ADD VALUE IF NOT EXISTS 'Negotiation Requested';
ALTER TYPE contract_status_enum ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE contract_status_enum ADD VALUE IF NOT EXISTS 'completed';

-- 3. Drop any check constraints on appointments or contracts if present
DO $$ 
BEGIN
  ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
