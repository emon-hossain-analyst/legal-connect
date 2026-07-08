-- =============================================================================
-- Phase 12: Fix Signup Error
-- Resolves "Database error saving new user" by removing overly aggressive 
-- check triggers and ensuring schema paths for ENUM types.
-- =============================================================================

-- 1. Drop the check_lawyer_role trigger.
-- It can cause row visibility issues during the initial nested transaction 
-- when the user is created by Supabase Auth.
DROP TRIGGER IF EXISTS trg_check_lawyer_role ON public.lawyers;
DROP FUNCTION IF EXISTS public.check_lawyer_role();

-- 2. Recreate handle_new_user with SET search_path = public
-- This ensures that the user_role_enum is always correctly resolved
-- regardless of the context Supabase Auth uses to call the trigger.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_user_type public.user_role_enum;
  v_parsed_type text;
BEGIN
  -- Safely extract and format the user_type from meta data
  v_parsed_type := TRIM(LOWER(new.raw_user_meta_data->>'user_type'));
  
  -- Check if it matches our enum, otherwise default to client
  IF v_parsed_type IN ('client', 'lawyer', 'admin') THEN
    v_user_type := v_parsed_type::public.user_role_enum;
  ELSE
    v_user_type := 'client'::public.user_role_enum;
  END IF;

  INSERT INTO public.users (id, email, name, user_type)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    v_user_type
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Recreate handle_new_lawyer with SET search_path = public
CREATE OR REPLACE FUNCTION public.handle_new_lawyer()
RETURNS trigger AS $$
BEGIN
  -- Explicitly cast the string to the public enum type
  IF new.user_type = 'lawyer'::public.user_role_enum THEN
    INSERT INTO public.lawyers (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
