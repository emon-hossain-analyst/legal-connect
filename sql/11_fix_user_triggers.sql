-- =============================================================================
-- Phase 11: Fix User Triggers & Casts
-- =============================================================================

-- 1. Safely handle new user insertion with robust enum casting
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_user_type user_role_enum;
  v_parsed_type text;
BEGIN
  -- Safely extract and format the user_type from meta data
  v_parsed_type := TRIM(LOWER(new.raw_user_meta_data->>'user_type'));
  
  -- Check if it matches our enum, otherwise default to client
  IF v_parsed_type IN ('client', 'lawyer', 'admin') THEN
    v_user_type := v_parsed_type::user_role_enum;
  ELSE
    v_user_type := 'client'::user_role_enum;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Safely handle new lawyer creation with explicit enum cast
CREATE OR REPLACE FUNCTION public.handle_new_lawyer()
RETURNS trigger AS $$
BEGIN
  IF new.user_type = 'lawyer'::user_role_enum THEN
    INSERT INTO public.lawyers (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Safely check lawyer role with explicit enum cast
CREATE OR REPLACE FUNCTION check_lawyer_role() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.user_id AND user_type = 'lawyer'::user_role_enum) THEN
    RAISE EXCEPTION 'User must have user_type of lawyer to have a lawyer profile';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
