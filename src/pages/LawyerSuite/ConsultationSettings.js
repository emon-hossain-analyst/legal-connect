import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

// Import Reusable Cards
import AvailabilityCard from '../../components/LawyerConsultationSettings/AvailabilityCard';
import PricingCard from '../../components/LawyerConsultationSettings/PricingCard';
import BookingRulesCard from '../../components/LawyerConsultationSettings/BookingRulesCard';
import CancellationCard from '../../components/LawyerConsultationSettings/CancellationCard';
import CommunicationCard from '../../components/LawyerConsultationSettings/CommunicationCard';
import LanguageSelector from '../../components/LawyerConsultationSettings/LanguageSelector';
import StickySaveBar from '../../components/LawyerConsultationSettings/StickySaveBar';

// Empty memory default when no database settings exist (No hardcoded mock rates)
const emptyDefaultSettings = {
  consultation_mode: 'Both',
  hourly_rate: 0,
  flat_fee: '',
  initial_fee: 0,
  case_review_fee: 0,
  followup_fee: 0,
  emergency_fee: 0,
  session_duration: 60,
  advance_notice: 24,
  booking_window: 90,
  buffer_time: 15,
  offer_free_consultation: false,
  auto_accept: false,
  cancellation_window: 24,
  refund_policy: 'Full',
  late_fee_enabled: false,
  late_fee_percentage: 0,
  communication_methods: ['Video Call', 'Phone Call', 'Platform Chat'],
  preferred_channel: 'Video Call',
  email_confirmation: true,
  sms_reminder: false,
  languages: ['English', 'Bangla'],
  office_address: '',
  meeting_url: '',
};

const ConsultationSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

  // Settings State & Tracking
  const [settings, setSettings] = useState(emptyDefaultSettings);
  const [originalSettings, setOriginalSettings] = useState(emptyDefaultSettings);

  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Step 1: Ensure user / lawyer ID
      const lawyerId = user.id;

      // Step 2: GET lawyer_consultation_settings
      const { data: mainData, error: mainErr } = await supabase
        .from('lawyer_consultation_settings')
        .select('*')
        .eq('lawyer_id', lawyerId)
        .maybeSingle();

      if (mainErr && mainErr.code !== 'PGRST116') {
        console.error('Error fetching lawyer_consultation_settings:', mainErr);
        setError('Unable to load consultation settings.');
        setLoading(false);
        return;
      }

      if (mainData) {
        // Formatted loaded data
        const loaded = {
          ...emptyDefaultSettings,
          ...mainData,
          flat_fee: mainData.flat_fee === null ? '' : mainData.flat_fee,
        };
        setSettings(loaded);
        setOriginalSettings(loaded);
        setIsDefault(false);
      } else {
        // Fallback check: consultation_settings (for backward compatibility if needed)
        const { data: fallbackData } = await supabase
          .from('consultation_settings')
          .select('*')
          .eq('lawyer_id', lawyerId)
          .maybeSingle();

        if (fallbackData) {
          const loadedFallback = {
            ...emptyDefaultSettings,
            consultation_mode: fallbackData.consultation_mode || 'Both',
            hourly_rate: Number(fallbackData.hourly_rate || 0),
            flat_fee: fallbackData.flat_fee === null ? '' : fallbackData.flat_fee,
            initial_fee: Number(fallbackData.fee_initial_consultation || 0),
            case_review_fee: Number(fallbackData.fee_case_review || 0),
            followup_fee: Number(fallbackData.fee_follow_up || 0),
            emergency_fee: Number(fallbackData.fee_emergency || 0),
            session_duration: fallbackData.session_durations?.[0] || 60,
            advance_notice: fallbackData.min_advance_notice || 24,
            booking_window: fallbackData.max_booking_window || 90,
            buffer_time: fallbackData.buffer_time || 15,
            offer_free_consultation: Boolean(fallbackData.offer_free_consultation),
            auto_accept: Boolean(fallbackData.auto_accept_bookings),
            cancellation_window: fallbackData.cancellation_window || 24,
            refund_policy: fallbackData.refund_policy || 'Full',
            late_fee_enabled: Boolean(fallbackData.charge_late_fee),
            preferred_channel: fallbackData.preferred_channel || 'Video Call',
            meeting_url: fallbackData.default_meeting_url || '',
            email_confirmation: fallbackData.email_confirmation !== false,
            sms_reminder: Boolean(fallbackData.sms_reminder),
            languages: fallbackData.consultation_languages || ['English', 'Bangla'],
          };
          setSettings(loadedFallback);
          setOriginalSettings(loadedFallback);
          setIsDefault(false);
        } else {
          // No settings exist anywhere. Create empty object in memory only.
          setSettings(emptyDefaultSettings);
          setOriginalSettings(emptyDefaultSettings);
          setIsDefault(true);
        }
      }
    } catch (err) {
      console.error('Unexpected fetch error:', err);
      setError('Unable to load consultation settings.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = useCallback((field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setSettings(originalSettings);
  }, [originalSettings]);

  const validateForm = () => {
    // 1. Hourly & Fee Validation
    if (Number(settings.hourly_rate) < 0) {
      showToast('error', 'Hourly rate cannot be negative.');
      return false;
    }
    if (
      Number(settings.initial_fee) < 0 ||
      Number(settings.case_review_fee) < 0 ||
      Number(settings.followup_fee) < 0 ||
      Number(settings.emergency_fee) < 0
    ) {
      showToast('error', 'Session specific fees must be zero or greater.');
      return false;
    }

    // 2. Languages validation (Minimum 1)
    if (!settings.languages || settings.languages.length === 0) {
      showToast('error', 'Please select at least one consultation language.');
      return false;
    }

    // 3. Mode validation
    if (!settings.consultation_mode) {
      showToast('error', 'Consultation mode is required.');
      return false;
    }

    // 4. Meeting URL validation if online
    if (
      (settings.consultation_mode === 'Online' || settings.consultation_mode === 'Both') &&
      settings.meeting_url
    ) {
      try {
        new URL(settings.meeting_url);
      } catch {
        showToast('error', 'Please enter a valid video meeting URL (starting with http:// or https://).');
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const lawyerId = user.id;

      const payload = {
        lawyer_id: lawyerId,
        consultation_mode: settings.consultation_mode || 'Both',
        hourly_rate: Number(settings.hourly_rate || 0),
        flat_fee: settings.flat_fee === '' || settings.flat_fee === null ? null : Number(settings.flat_fee),
        initial_fee: Number(settings.initial_fee || 0),
        case_review_fee: Number(settings.case_review_fee || 0),
        followup_fee: Number(settings.followup_fee || 0),
        emergency_fee: Number(settings.emergency_fee || 0),
        session_duration: Number(settings.session_duration || 60),
        advance_notice: Number(settings.advance_notice || 24),
        booking_window: Number(settings.booking_window || 90),
        buffer_time: Number(settings.buffer_time || 15),
        offer_free_consultation: Boolean(settings.offer_free_consultation),
        auto_accept: Boolean(settings.auto_accept),
        cancellation_window: Number(settings.cancellation_window || 24),
        refund_policy: settings.refund_policy || 'Full',
        late_fee_enabled: Boolean(settings.late_fee_enabled),
        late_fee_percentage: Number(settings.late_fee_percentage || 0),
        communication_methods: settings.communication_methods || [],
        preferred_channel: settings.preferred_channel || 'Video Call',
        email_confirmation: Boolean(settings.email_confirmation),
        sms_reminder: Boolean(settings.sms_reminder),
        languages: settings.languages || [],
        office_address: settings.office_address || '',
        meeting_url: settings.meeting_url || '',
        updated_at: new Date().toISOString(),
      };

      let savedToPrimary = false;
      // Step 1: Attempt upsert into new lawyer_consultation_settings table
      const { error: upsertErr } = await supabase
        .from('lawyer_consultation_settings')
        .upsert(payload, { onConflict: 'lawyer_id' });

      if (upsertErr) {
        console.warn('Primary table lawyer_consultation_settings upsert note (table may require migration #54 in Supabase SQL Editor):', upsertErr.message);
      } else {
        savedToPrimary = true;
      }

      // Step 2: Ensure save to active consultation_settings table with smart column compatibility
      const fallbackPayload = {
        lawyer_id: lawyerId,
        consultation_mode: payload.consultation_mode,
        hourly_rate: payload.hourly_rate,
        flat_fee: payload.flat_fee,
        offer_free_consultation: payload.offer_free_consultation,
        free_session_duration: 15,
        session_durations: [payload.session_duration],
        min_advance_notice: payload.advance_notice,
        max_booking_window: payload.booking_window,
        auto_accept_bookings: payload.auto_accept,
        buffer_time: payload.buffer_time,
        cancellation_window: payload.cancellation_window,
        refund_policy: payload.refund_policy,
        charge_late_fee: payload.late_fee_enabled,
        late_fee_amount: (payload.hourly_rate * payload.late_fee_percentage) / 100,
        preferred_channel: payload.preferred_channel,
        default_meeting_url: payload.meeting_url,
        email_confirmation: payload.email_confirmation,
        sms_reminder: payload.sms_reminder,
        consultation_languages: payload.languages,
        fee_initial_consultation: payload.initial_fee,
        fee_case_review: payload.case_review_fee,
        fee_follow_up: payload.followup_fee,
        fee_emergency: payload.emergency_fee,
        updated_at: new Date().toISOString(),
      };

      const { error: fallbackErr } = await supabase
        .from('consultation_settings')
        .upsert(fallbackPayload, { onConflict: 'lawyer_id' });

      if (!savedToPrimary && fallbackErr) {
        if (fallbackErr.message && fallbackErr.message.includes('does not exist')) {
          // Automatic retry with strictly base columns if specific fee columns are missing from existing table schema
          const baseFallbackPayload = {
            lawyer_id: lawyerId,
            consultation_mode: payload.consultation_mode,
            hourly_rate: payload.hourly_rate,
            flat_fee: payload.flat_fee,
            offer_free_consultation: payload.offer_free_consultation,
            free_session_duration: 15,
            session_durations: [payload.session_duration],
            min_advance_notice: payload.advance_notice,
            max_booking_window: payload.booking_window,
            auto_accept_bookings: payload.auto_accept,
            buffer_time: payload.buffer_time,
            cancellation_window: payload.cancellation_window,
            refund_policy: payload.refund_policy,
            charge_late_fee: payload.late_fee_enabled,
            late_fee_amount: (payload.hourly_rate * payload.late_fee_percentage) / 100,
            preferred_channel: payload.preferred_channel,
            default_meeting_url: payload.meeting_url,
            email_confirmation: payload.email_confirmation,
            sms_reminder: payload.sms_reminder,
            consultation_languages: payload.languages,
            updated_at: new Date().toISOString(),
          };
          const { error: retryErr } = await supabase
            .from('consultation_settings')
            .upsert(baseFallbackPayload, { onConflict: 'lawyer_id' });

          if (retryErr) {
            throw new Error(retryErr.message);
          }
        } else {
          throw new Error(fallbackErr.message || upsertErr?.message || 'Failed to save settings');
        }
      }

      setOriginalSettings(settings);
      setIsDefault(false);
      showToast('success', 'Settings saved successfully');
    } catch (err) {
      console.error('Save error:', err);
      const exactMsg = err.message || 'An unknown error occurred';
      showToast('error', `Failed to save: ${exactMsg} (Edits preserved)`);
    } finally {
      setSaving(false);
    }
  };

  // Skeleton Loader State
  if (loading) {
    return (
      <div className="flex-1 bg-[#041635] p-6 sm:p-10 h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-white/10 rounded-xl"></div>
            <div className="h-4 w-96 bg-white/5 rounded-lg"></div>
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white/5 rounded-2xl p-8 border border-white/10 space-y-4">
              <div className="h-6 w-48 bg-white/10 rounded"></div>
              <div className="h-20 w-full bg-white/5 rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex-1 bg-[#041635] p-8 h-full flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center space-y-4 shadow-xl">
          <span className="material-symbols-outlined text-4xl text-rose-400">error</span>
          <h3 className="text-xl font-bold text-white">Unable to load consultation settings.</h3>
          <p className="text-rose-200/80 text-sm">{error}</p>
          <button
            onClick={fetchSettings}
            className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 mx-auto"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#041635] overflow-y-auto custom-scrollbar p-4 sm:p-8 lg:p-10 min-h-screen">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #041635; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a2c50; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #2e4372; }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-bounceIn">
          <div
            className={`px-5 py-3.5 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-rose-600 text-white border-rose-500'
            }`}
          >
            <span className="material-symbols-outlined text-xl">
              {toast.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-8 pb-16">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#0a2351] to-[#132f6a] p-6 sm:p-8 rounded-2xl border border-white/10 shadow-lg">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white flex items-center gap-3">
              <span>Schedule & Consultation Settings</span>
              <span className="text-xs px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/30 font-sans tracking-wide uppercase">
                Lawyer Suite
              </span>
            </h1>
            <p className="text-sm text-gray-300 mt-1">
              Configure your fees, availability modes, scheduling limits, and automated client notifications.
            </p>
          </div>
        </div>

        {/* Empty / Not Yet Configured Banner */}
        {isDefault && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-200 shadow-sm animate-fadeIn">
            <div className="flex items-start sm:items-center gap-3">
              <span className="material-symbols-outlined text-amber-400 text-2xl flex-shrink-0 mt-0.5 sm:mt-0">
                info
              </span>
              <div>
                <h4 className="font-bold text-white text-sm">You haven&apos;t configured your consultation settings yet.</h4>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  Default values are shown below in memory only. Adjust your rates and preferences and click{' '}
                  <strong>Save Settings</strong> to publish.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 1. Consultation Availability Card */}
        <AvailabilityCard settings={settings} onChange={handleChange} />

        {/* 2. Pricing & Fee Structure Card */}
        <PricingCard settings={settings} onChange={handleChange} />

        {/* 3. Booking & Scheduling Rules Card */}
        <BookingRulesCard settings={settings} onChange={handleChange} />

        {/* 4. Cancellation & Refund Policy Card */}
        <CancellationCard settings={settings} onChange={handleChange} />

        {/* 5. Communication & Reminders Card */}
        <CommunicationCard settings={settings} onChange={handleChange} />

        {/* 6. Consultation Languages Selector */}
        <LanguageSelector settings={settings} onChange={handleChange} />

        {/* 7. Sticky Bottom Save Bar */}
        <StickySaveBar
          isDirty={isDirty}
          saving={saving}
          onSave={handleSave}
          onReset={handleReset}
        />
      </div>
    </div>
  );
};

export default ConsultationSettings;
