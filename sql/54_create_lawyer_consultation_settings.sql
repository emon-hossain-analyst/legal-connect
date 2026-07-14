-- Migration: 54_create_lawyer_consultation_settings.sql
-- Description: Create lawyer_consultation_settings table with full schema and Row Level Security policies

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS lawyer_consultation_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    consultation_mode TEXT DEFAULT 'Both',
    hourly_rate NUMERIC DEFAULT 0,
    flat_fee NUMERIC DEFAULT null,
    initial_fee NUMERIC DEFAULT 0,
    case_review_fee NUMERIC DEFAULT 0,
    followup_fee NUMERIC DEFAULT 0,
    emergency_fee NUMERIC DEFAULT 0,
    session_duration INTEGER DEFAULT 60,
    advance_notice INTEGER DEFAULT 24,
    booking_window INTEGER DEFAULT 90,
    buffer_time INTEGER DEFAULT 15,
    offer_free_consultation BOOLEAN DEFAULT false,
    auto_accept BOOLEAN DEFAULT false,
    cancellation_window INTEGER DEFAULT 24,
    refund_policy TEXT DEFAULT 'Full',
    late_fee_enabled BOOLEAN DEFAULT false,
    late_fee_percentage NUMERIC DEFAULT 0,
    communication_methods TEXT[] DEFAULT '{}',
    preferred_channel TEXT DEFAULT 'Video Call',
    email_confirmation BOOLEAN DEFAULT true,
    sms_reminder BOOLEAN DEFAULT false,
    languages TEXT[] DEFAULT '{}',
    office_address TEXT DEFAULT '',
    meeting_url TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lawyer_consultation_settings ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Lawyers can view own consultation settings" ON lawyer_consultation_settings;
DROP POLICY IF EXISTS "Lawyers can insert own consultation settings" ON lawyer_consultation_settings;
DROP POLICY IF EXISTS "Lawyers can update own consultation settings" ON lawyer_consultation_settings;
DROP POLICY IF EXISTS "Public can read lawyer consultation settings" ON lawyer_consultation_settings;

-- Create policies
CREATE POLICY "Public can read lawyer consultation settings"
    ON lawyer_consultation_settings FOR SELECT
    USING (true);

CREATE POLICY "Lawyers can insert own consultation settings"
    ON lawyer_consultation_settings FOR INSERT
    WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "Lawyers can update own consultation settings"
    ON lawyer_consultation_settings FOR UPDATE
    USING (auth.uid() = lawyer_id);
