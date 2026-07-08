-- =============================================================================
-- Database Seed Script for Lawyer Dashboard Testing
-- This script safely inserts mock data by using existing clients and lawyers 
-- in your database.
-- =============================================================================

DO $$
DECLARE
  v_client_id UUID;
  v_client2_id UUID;
  v_lawyer_id UUID;
  v_case1_id INTEGER;
  v_case2_id INTEGER;
  v_contract1_id INTEGER;
  v_contract2_id INTEGER;
BEGIN
  -- 1. Grab some existing users to use for seeding
  SELECT id INTO v_client_id FROM public.users WHERE user_type = 'client' LIMIT 1;
  SELECT id INTO v_client2_id FROM public.users WHERE user_type = 'client' OFFSET 1 LIMIT 1;
  SELECT id INTO v_lawyer_id FROM public.users WHERE user_type = 'lawyer' LIMIT 1;

  -- If we don't have enough users, fallback to using the same client
  IF v_client2_id IS NULL THEN
    v_client2_id := v_client_id;
  END IF;

  IF v_client_id IS NOT NULL AND v_lawyer_id IS NOT NULL THEN
    
    -- =========================================================
    -- APPOINTMENTS
    -- =========================================================
    INSERT INTO public.appointments (client_id, lawyer_id, date, time, reason, status)
    VALUES 
      (v_client_id, v_lawyer_id, CURRENT_DATE + INTERVAL '1 day', '10:00:00', 'Initial Consultation', 'confirmed'),
      (v_client2_id, v_lawyer_id, CURRENT_DATE + INTERVAL '2 days', '14:30:00', 'Contract Review', 'pending'),
      (v_client_id, v_lawyer_id, CURRENT_DATE - INTERVAL '5 days', '09:00:00', 'Property Dispute Advice', 'completed'),
      (v_client2_id, v_lawyer_id, CURRENT_DATE + INTERVAL '5 days', '11:00:00', 'Follow up meeting', 'cancelled');

    -- =========================================================
    -- CASES
    -- =========================================================
    INSERT INTO public.cases (client_id, lawyer_id, title, description, status)
    VALUES 
      (v_client_id, v_lawyer_id, 'Property Dispute - Plot 12A', 'Client is facing a land dispute with neighbors over boundary lines.', 'active')
    RETURNING id INTO v_case1_id;

    INSERT INTO public.cases (client_id, lawyer_id, title, description, status)
    VALUES 
      (v_client2_id, v_lawyer_id, 'Corporate Merger Agreement', 'Drafting and reviewing merger documents for TechCorp.', 'active')
    RETURNING id INTO v_case2_id;

    -- Case Progress (Milestones)
    INSERT INTO public.case_progress (case_id, title, description, progress_date)
    VALUES
      (v_case1_id, 'Initial Filing', 'Filed the initial complaint at the local court.', CURRENT_DATE - INTERVAL '10 days'),
      (v_case1_id, 'Defendant Response', 'Received response from the defendant.', CURRENT_DATE - INTERVAL '2 days'),
      (v_case2_id, 'Drafting Phase 1', 'Completed the first draft of the merger contract.', CURRENT_DATE - INTERVAL '1 day');

    -- =========================================================
    -- CONTRACTS
    -- =========================================================
    INSERT INTO public.contracts (lawyer_id, client_id, agreed_fee, status)
    VALUES (v_lawyer_id, v_client_id, 50000.00, 'active')
    RETURNING id INTO v_contract1_id;

    INSERT INTO public.contracts (lawyer_id, client_id, agreed_fee, status)
    VALUES (v_lawyer_id, v_client2_id, 100000.00, 'completed')
    RETURNING id INTO v_contract2_id;

    -- =========================================================
    -- TRANSACTIONS
    -- =========================================================
    INSERT INTO public.transactions (contract_id, client_id, lawyer_id, amount, status)
    VALUES 
      (v_contract1_id, v_client_id, v_lawyer_id, 25000.00, 'released'),
      (v_contract2_id, v_client2_id, v_lawyer_id, 100000.00, 'pending');

    -- =========================================================
    -- ANALYTICS STATS
    -- =========================================================
    INSERT INTO public.analytics_stats (lawyer_id, total_earnings, active_cases, total_cases, cases_won)
    VALUES (v_lawyer_id, 125000.00, 2, 17, 15)
    ON CONFLICT (lawyer_id) 
    DO UPDATE SET 
      total_earnings = 125000.00,
      active_cases = 2,
      total_cases = 17,
      cases_won = 15;

    RAISE NOTICE 'Seed completed successfully for Lawyer ID: %', v_lawyer_id;
  ELSE
    RAISE NOTICE 'Skipping seed. Missing either a client or lawyer user in the database.';
  END IF;

END $$;
