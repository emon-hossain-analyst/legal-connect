-- =============================================================================
-- Script: 38_drop_all_users_except_admin.sql
-- Description: Safely deletes all registered users (clients, lawyers, test accounts)
--              from both public.users and auth.users while preserving admin accounts.
--              Due to ON DELETE CASCADE constraints, this will also wipe related
--              lawyer profiles, appointments, cases, contracts, messages, etc.
-- =============================================================================

BEGIN;

-- 1. Delete from public.users where the user is NOT an admin.
--    This removes all client and lawyer profiles, triggering ON DELETE CASCADE
--    to wipe related domain records (appointments, cases, contracts, messages, reviews).
DELETE FROM public.users 
WHERE user_type != 'admin' 
  AND LOWER(email) NOT IN ('tashin123@gmail.com', 'tashin123@gmail.com')
  AND LOWER(email) NOT LIKE 'admin@%';

-- 2. Delete from Supabase auth.users where the user ID is not an admin in public.users
--    and the email does not belong to an admin account.
--    This ensures complete cleanup of authentication credentials so emails can be re-registered cleanly.
DELETE FROM auth.users 
WHERE id NOT IN (
    SELECT id FROM public.users WHERE user_type = 'admin'
)
AND LOWER(email) NOT IN ('tashin123@gmail.com', 'tashin123@gmail.com')
AND LOWER(email) NOT LIKE 'admin@%';

COMMIT;

-- Verify remaining users (Should only list admin accounts)
SELECT id, email, user_type, is_active, created_at 
FROM public.users;
