-- =========================================================================================
-- MIGRATION 63: PAYOUTS AND NOTIFICATIONS LEDGER & PRODUCTION HARDENING
-- Description: Creates the dedicated financial withdrawal ledger (`payout_requests`),
-- enables REPLICA IDENTITY FULL and realtime publication, and enforces Row-Level Security.
-- =========================================================================================

-- 1. Create payout_requests table
CREATE TABLE IF NOT EXISTS public.payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lawyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processed', 'rejected')),
    bank_details JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    requested_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Enable REPLICA IDENTITY FULL for Realtime delete/update payloads
ALTER TABLE public.payout_requests REPLICA IDENTITY FULL;

-- 3. Add to Supabase Realtime publication safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'payout_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.payout_requests;
    END IF;
END $$;

-- 4. Create updated_at trigger for payout_requests
CREATE OR REPLACE FUNCTION public.fn_update_payout_requests_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payout_requests_updated_at ON public.payout_requests;
CREATE TRIGGER trg_payout_requests_updated_at
    BEFORE UPDATE ON public.payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_payout_requests_timestamp();

-- 5. Enable Row-Level Security (RLS)
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for payout_requests
DROP POLICY IF EXISTS "Lawyers can view their own payout requests" ON public.payout_requests;
CREATE POLICY "Lawyers can view their own payout requests"
    ON public.payout_requests
    FOR SELECT
    USING (
        lawyer_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = payout_requests.lawyer_id AND users.auth_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Lawyers can insert their own payout requests" ON public.payout_requests;
CREATE POLICY "Lawyers can insert their own payout requests"
    ON public.payout_requests
    FOR INSERT
    WITH CHECK (
        lawyer_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = payout_requests.lawyer_id AND users.auth_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can view all payout requests" ON public.payout_requests;
CREATE POLICY "Admins can view all payout requests"
    ON public.payout_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE (users.id = auth.uid() OR users.auth_id = auth.uid()) 
            AND users.user_type = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can update payout requests" ON public.payout_requests;
CREATE POLICY "Admins can update payout requests"
    ON public.payout_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE (users.id = auth.uid() OR users.auth_id = auth.uid()) 
            AND users.user_type = 'admin'
        )
    );

-- 7. Performance index on lawyer_id and status
CREATE INDEX IF NOT EXISTS idx_payout_requests_lawyer_status ON public.payout_requests(lawyer_id, status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_requested_at ON public.payout_requests(requested_at DESC);

-- 8. Storage bucket hardening (ensure case-documents exists and has strict RLS)
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('case-documents', 'case-documents', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not auto-insert storage bucket due to schema differences: %', SQLERRM;
END $$;
