-- 13_lawyer_dashboard_schema.sql

-- 1. Lawyer Profiles
CREATE TABLE IF NOT EXISTS public.lawyer_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    years_experience INT DEFAULT 0,
    bio TEXT,
    primary_location TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    consultation_formats JSONB DEFAULT '{"inPerson": false, "online": false, "phone": false, "video": false}'::jsonb,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Credentials (Education & Certifications)
CREATE TABLE IF NOT EXISTS public.credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL CHECK (credential_type IN ('education', 'certification')),
    title TEXT NOT NULL,
    institution TEXT NOT NULL,
    year_issued INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Verifications (Bar Registrations & Court Admissions)
CREATE TABLE IF NOT EXISTS public.verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    verification_type TEXT NOT NULL CHECK (verification_type IN ('bar_registration', 'court_admission')),
    authority_name TEXT NOT NULL,
    license_number TEXT,
    issue_date DATE,
    expiry_date DATE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Availability Rules
CREATE TABLE IF NOT EXISTS public.availability_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Analytics Stats
CREATE TABLE IF NOT EXISTS public.analytics_stats (
    lawyer_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    cases_won INT DEFAULT 0,
    total_cases INT DEFAULT 0,
    active_cases INT DEFAULT 0,
    total_earnings NUMERIC(12,2) DEFAULT 0.00,
    success_rate NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE WHEN total_cases > 0 THEN (cases_won::NUMERIC / total_cases) * 100 ELSE 0 END
    ) STORED,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Portfolio Cases
CREATE TABLE IF NOT EXISTS public.portfolio_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    practice_area TEXT,
    year_completed INT,
    outcome TEXT CHECK (outcome IN ('won', 'settled', 'lost', 'other')),
    is_landmark BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS POLICIES
ALTER TABLE public.lawyer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_stats ENABLE ROW LEVEL SECURITY;

-- Profiles: Public can read, Owner can update
CREATE POLICY "Public profiles are viewable by everyone" ON public.lawyer_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.lawyer_profiles FOR ALL USING (auth.uid() = id);

-- Credentials & Verifications: Public can read, Owner can manage
CREATE POLICY "Public credentials are viewable by everyone" ON public.credentials FOR SELECT USING (true);
CREATE POLICY "Users can manage own credentials" ON public.credentials FOR ALL USING (auth.uid() = lawyer_id);

CREATE POLICY "Public verifications are viewable by everyone" ON public.verifications FOR SELECT USING (true);
CREATE POLICY "Users can manage own verifications" ON public.verifications FOR ALL USING (auth.uid() = lawyer_id);

-- Availability & Analytics: Public can read, Owner can manage
CREATE POLICY "Public availability is viewable by everyone" ON public.availability_rules FOR SELECT USING (true);
CREATE POLICY "Users can manage own availability" ON public.availability_rules FOR ALL USING (auth.uid() = lawyer_id);

CREATE POLICY "Public analytics are viewable by everyone" ON public.analytics_stats FOR SELECT USING (true);
CREATE POLICY "System can manage analytics" ON public.analytics_stats FOR ALL USING (auth.uid() = lawyer_id);

ALTER TABLE public.portfolio_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public portfolio cases are viewable by everyone" ON public.portfolio_cases FOR SELECT USING (true);
CREATE POLICY "Users can manage own portfolio cases" ON public.portfolio_cases FOR ALL USING (auth.uid() = lawyer_id);

-- SEED DATA
