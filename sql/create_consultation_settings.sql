CREATE TABLE IF NOT EXISTS consultation_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    consultation_mode TEXT DEFAULT 'Both',
    hourly_rate NUMERIC DEFAULT 5000,
    flat_fee NUMERIC,
    offer_free_consultation BOOLEAN DEFAULT false,
    free_session_duration INT DEFAULT 15,
    session_durations INT[] DEFAULT '{60}',
    min_advance_notice INT DEFAULT 24,
    max_booking_window INT DEFAULT 90,
    auto_accept_bookings BOOLEAN DEFAULT false,
    buffer_time INT DEFAULT 15,
    cancellation_window INT DEFAULT 24,
    refund_policy TEXT DEFAULT 'Full',
    charge_late_fee BOOLEAN DEFAULT false,
    late_fee_amount NUMERIC DEFAULT 0,
    preferred_channel TEXT DEFAULT 'In-App Video',
    default_meeting_url TEXT,
    email_confirmation BOOLEAN DEFAULT true,
    sms_reminder BOOLEAN DEFAULT false,
    consultation_languages TEXT[] DEFAULT '{English}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE consultation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consultation settings" 
    ON consultation_settings FOR SELECT 
    USING (auth.uid() = lawyer_id);

CREATE POLICY "Users can insert their own consultation settings" 
    ON consultation_settings FOR INSERT 
    WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "Users can update their own consultation settings" 
    ON consultation_settings FOR UPDATE 
    USING (auth.uid() = lawyer_id);
