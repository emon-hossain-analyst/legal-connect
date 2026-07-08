-- =============================================================================
-- Phase 37: Auto-Confirm Users in Development
-- =============================================================================
-- Run this script in your Supabase SQL Editor if you turned off email confirmation
-- in the dashboard and need to allow previously registered (unconfirmed) users
-- to log in without receiving "Invalid credentials or email not confirmed".
-- =============================================================================

UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;
