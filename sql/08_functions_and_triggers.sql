-- =============================================================================
-- Phase 8: Functions and Triggers
-- =============================================================================

-- Admin Check Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND user_type = 'admin'
  );
END;
$$;

-- updated_at TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply set_updated_at to all relevant tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'lawyers', 'jobs', 'job_proposals', 'contracts', 'contract_milestones', 
    'transactions', 'disputes', 'appointments', 'cases', 'documents', 'feedback', 
    'legal_updates', 'contact_inquiries', 'ai_chat_sessions'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
       CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE PROCEDURE set_updated_at()',
      t, t, t, t
    );
  END LOOP;
END;
$$;

-- Trigger to automatically create a public.users row when an auth.users row is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    COALESCE((new.raw_user_meta_data->>'user_type')::user_role_enum, 'client'::user_role_enum)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger to automatically create a public.lawyers row when a lawyer user is created
CREATE OR REPLACE FUNCTION public.handle_new_lawyer()
RETURNS trigger AS $$
BEGIN
  IF new.user_type = 'lawyer' THEN
    INSERT INTO public.lawyers (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_public_user_created_lawyer ON public.users;
CREATE TRIGGER on_public_user_created_lawyer
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_lawyer();

-- Ensure that a user can only be in the lawyers table if they have the 'lawyer' role.
CREATE OR REPLACE FUNCTION check_lawyer_role() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.user_id AND user_type = 'lawyer') THEN
    RAISE EXCEPTION 'User must have user_type of lawyer to have a lawyer profile';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_lawyer_role ON public.lawyers;
CREATE TRIGGER trg_check_lawyer_role
  BEFORE INSERT OR UPDATE ON public.lawyers
  FOR EACH ROW EXECUTE PROCEDURE check_lawyer_role();

-- Update Lawyer Rating Trigger
CREATE OR REPLACE FUNCTION update_lawyer_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.lawyers
  SET 
    total_reviews = (SELECT COUNT(*) FROM public.feedback WHERE lawyer_id = NEW.lawyer_id),
    avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM public.feedback WHERE lawyer_id = NEW.lawyer_id)
  WHERE user_id = NEW.lawyer_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_lawyer_rating ON public.feedback;
CREATE TRIGGER trg_update_lawyer_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.feedback
  FOR EACH ROW EXECUTE PROCEDURE update_lawyer_rating();
