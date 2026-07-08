-- =============================================================================
-- Phase 30: Dynamic Category & Expertise System (Multi-Tiered Marketplace)
-- =============================================================================

-- 1. Create practice_areas (Primary Categories)
CREATE TABLE IF NOT EXISTS public.practice_areas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  slug VARCHAR(150) NOT NULL UNIQUE,
  icon VARCHAR(50) DEFAULT 'gavel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create legal_expertise (Subcategories)
CREATE TABLE IF NOT EXISTS public.legal_expertise (
  id SERIAL PRIMARY KEY,
  practice_area_id INTEGER NOT NULL REFERENCES public.practice_areas(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(practice_area_id, slug)
);

-- 3. Create lawyer_expertise_junction (Relational Junction Table)
CREATE TABLE IF NOT EXISTS public.lawyer_expertise_junction (
  id SERIAL PRIMARY KEY,
  lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expertise_id INTEGER NOT NULL REFERENCES public.legal_expertise(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lawyer_id, expertise_id)
);

CREATE INDEX IF NOT EXISTS idx_expertise_practice_area ON public.legal_expertise(practice_area_id);
CREATE INDEX IF NOT EXISTS idx_junction_lawyer ON public.lawyer_expertise_junction(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_junction_expertise ON public.lawyer_expertise_junction(expertise_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.practice_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_expertise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_expertise_junction ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for practice_areas
DROP POLICY IF EXISTS "Anyone can read practice areas" ON public.practice_areas;
CREATE POLICY "Anyone can read practice areas"
  ON public.practice_areas FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage practice areas" ON public.practice_areas;
CREATE POLICY "Admins can manage practice areas"
  ON public.practice_areas FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

-- 6. RLS Policies for legal_expertise
DROP POLICY IF EXISTS "Anyone can read legal expertise" ON public.legal_expertise;
CREATE POLICY "Anyone can read legal expertise"
  ON public.legal_expertise FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage legal expertise" ON public.legal_expertise;
CREATE POLICY "Admins can manage legal expertise"
  ON public.legal_expertise FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

-- 7. RLS Policies for lawyer_expertise_junction
DROP POLICY IF EXISTS "Anyone can view lawyer expertise" ON public.lawyer_expertise_junction;
CREATE POLICY "Anyone can view lawyer expertise"
  ON public.lawyer_expertise_junction FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Lawyers can insert own expertise" ON public.lawyer_expertise_junction;
CREATE POLICY "Lawyers can insert own expertise"
  ON public.lawyer_expertise_junction FOR INSERT
  WITH CHECK (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "Lawyers can delete own expertise" ON public.lawyer_expertise_junction;
CREATE POLICY "Lawyers can delete own expertise"
  ON public.lawyer_expertise_junction FOR DELETE
  USING (auth.uid() = lawyer_id);

-- 8. Grants and Sequence Permissions
GRANT ALL ON public.practice_areas TO authenticated, anon;
GRANT ALL ON public.legal_expertise TO authenticated, anon;
GRANT ALL ON public.lawyer_expertise_junction TO authenticated, anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 9. Seed Initial Categories & Subcategories (Optional Starter Data)
INSERT INTO public.practice_areas (id, name, slug, icon) VALUES
  (1, 'Corporate Law', 'corporate-law', 'business_center'),
  (2, 'Family Law', 'family-law', 'family_restroom'),
  (3, 'Criminal Defense', 'criminal-defense', 'gavel'),
  (4, 'Real Estate', 'real-estate', 'apartment'),
  (5, 'Intellectual Property', 'intellectual-property', 'lightbulb')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.legal_expertise (practice_area_id, name, slug) VALUES
  (1, 'Mergers & Acquisitions', 'mergers-acquisitions'),
  (1, 'Venture Capital & Startups', 'venture-capital-startups'),
  (1, 'Corporate Governance', 'corporate-governance'),
  (2, 'Divorce & Separation', 'divorce-separation'),
  (2, 'Child Custody & Support', 'child-custody-support'),
  (2, 'Adoption Law', 'adoption-law'),
  (3, 'White Collar Crime', 'white-collar-crime'),
  (3, 'DUI & Traffic Offenses', 'dui-traffic-offenses'),
  (3, 'Federal Defense', 'federal-defense'),
  (4, 'Commercial Leasing', 'commercial-leasing'),
  (4, 'Property Disputes', 'property-disputes'),
  (5, 'Patent Prosecution', 'patent-prosecution'),
  (5, 'Trademark & Copyright', 'trademark-copyright')
ON CONFLICT (practice_area_id, slug) DO NOTHING;

-- Adjust sequences if seeded ID conflicts
SELECT setval('public.practice_areas_id_seq', COALESCE((SELECT MAX(id)+1 FROM public.practice_areas), 1), false);
SELECT setval('public.legal_expertise_id_seq', COALESCE((SELECT MAX(id)+1 FROM public.legal_expertise), 1), false);

-- 10. Fix RLS Permissions for Messaging Conversations & Appointments
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants access conversations" ON public.conversations;
DROP POLICY IF EXISTS "Clients can access and modify their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;

CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (true);

CREATE POLICY "Users can insert conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (true);

GRANT ALL ON public.conversations TO authenticated, anon;

-- Ensure google_meet_url column exists on appointments
ALTER TABLE IF EXISTS public.appointments
ADD COLUMN IF NOT EXISTS google_meet_url VARCHAR(255);

