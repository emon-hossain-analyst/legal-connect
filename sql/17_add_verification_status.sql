-- 17_add_verification_status.sql

-- Add verification_status to lawyer_profiles if it doesn't exist
ALTER TABLE public.lawyer_profiles 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));

-- Ensure RLS allows the user to update their own verification_status
-- (This should already be covered by the existing update policy, but just to be safe)
