import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

const ConsultationSettings = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDefault, setIsDefault] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
    
    // Form state
    const [settings, setSettings] = useState({
        consultation_mode: 'Both',
        hourly_rate: 5000,
        flat_fee: '',
        offer_free_consultation: false,
        free_session_duration: 15,
        session_durations: [60],
        min_advance_notice: 24,
        max_booking_window: 90,
        auto_accept_bookings: false,
        buffer_time: 15,
        cancellation_window: 24,
        refund_policy: 'Full',
        charge_late_fee: false,
        late_fee_amount: 0,
        preferred_channel: 'In-App Video',
        default_meeting_url: '',
        email_confirmation: true,
        sms_reminder: false,
        consultation_languages: ['English', 'Bangla'],
        supported_mediums: ['video_call', 'platform_chat', 'phone_call', 'in_office'],
        fee_initial_consultation: 3000,
        fee_case_review: 5000,
        fee_follow_up: 2000,
        fee_emergency: 8000
    });

    const [newLang, setNewLang] = useState('');
    const [showLangInput, setShowLangInput] = useState(false);

    useEffect(() => {
        if (!user) return;
        
        const fetchSettings = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data, error: fetchErr } = await supabase
                    .from('consultation_settings')
                    .select('*')
                    .eq('lawyer_id', user.id)
                    .maybeSingle();
                    
                if (fetchErr && fetchErr.code !== 'PGRST116') {
                    console.error("Error fetching settings:", fetchErr);
                    setError("Failed to load consultation settings. Please try again.");
                } else if (data) {
                    setSettings(prev => ({ ...prev, ...data }));
                    setIsDefault(false);
                } else {
                    setIsDefault(true);
                }
            } catch (err) {
                console.error("Fetch error:", err);
                setError("An unexpected error occurred while loading settings.");
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [user]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: existing } = await supabase
                .from('consultation_settings')
                .select('id')
                .eq('lawyer_id', user.id)
                .maybeSingle();

            const payload = {
                ...settings,
                flat_fee: settings.flat_fee === '' ? null : Number(settings.flat_fee),
                hourly_rate: Number(settings.hourly_rate),
                late_fee_amount: Number(settings.late_fee_amount),
                fee_initial_consultation: Number(settings.fee_initial_consultation || 3000),
                fee_case_review: Number(settings.fee_case_review || 5000),
                fee_follow_up: Number(settings.fee_follow_up || 2000),
                fee_emergency: Number(settings.fee_emergency || 8000)
            };

            if (existing) {
                await supabase.from('consultation_settings').update({
                    ...payload,
                    updated_at: new Date().toISOString()
                }).eq('lawyer_id', user.id);
            } else {
                await supabase.from('consultation_settings').insert({
                    lawyer_id: user.id,
                    ...payload
                });
            }
            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 3000);
        } catch (err) {
            console.error("Error saving", err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(null), 3000);
        } finally {
            setSaving(false);
        }
    };

    const updateField = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const toggleArray = (field, value) => {
        setSettings(prev => {
            const arr = prev[field] || [];
            if (arr.includes(value)) {
                return { ...prev, [field]: arr.filter(v => v !== value) };
            } else {
                return { ...prev, [field]: [...arr, value] };
            }
        });
    };

    const addLanguage = () => {
        if (newLang.trim() && !settings.consultation_languages.includes(newLang.trim())) {
            updateField('consultation_languages', [...settings.consultation_languages, newLang.trim()]);
            setNewLang('');
            setShowLangInput(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 bg-[#041635] p-8 h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-[#fed977] border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-white font-medium">Loading consultation settings...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 bg-[#041635] p-8 h-full flex items-center justify-center">
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center space-y-4">
                    <span className="material-symbols-outlined text-4xl text-red-400">error_outline</span>
                    <h3 className="text-xl font-bold text-white">Failed to Load Settings</h3>
                    <p className="text-red-200 text-sm">{error}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg transition active:scale-95"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-[#041635] overflow-y-auto custom-scrollbar p-8 h-full">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #041635; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #374668; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4f5e81; }
            `}</style>
            
            <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-fadeIn">
                <div className="mb-8">
                    <h2 className="font-headline-md text-white text-3xl mb-2">Consultation Settings</h2>
                    <p className="text-on-primary-container font-body-md">Configure how clients interact and book sessions with your legal practice.</p>
                </div>

                {isDefault && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center gap-3 text-blue-200 text-sm">
                        <span className="material-symbols-outlined text-blue-400">info</span>
                        <span>You have not customized your consultation settings yet. Default values are loaded below. Click <strong>Save Settings</strong> to apply your preferences.</span>
                    </div>
                )}

                {/* 1. Consultation Mode */}
                <section className="bg-primary-container p-6 rounded-lg border border-white/10 shadow-lg">
                    <h3 className="font-headline-sm text-white font-bold mb-1">Consultation Mode</h3>
                    <p className="text-on-primary-container text-body-sm mb-6 text-opacity-80">Choose your preferred method for meeting clients.</p>
                    <div className="inline-flex p-1 bg-[#020d20] rounded-lg border border-white/5">
                        {['Online', 'In-Person', 'Both'].map(mode => (
                            <button 
                                key={mode}
                                onClick={() => updateField('consultation_mode', mode)}
                                className={`px-8 py-2.5 rounded-md font-label-md transition-all ${settings.consultation_mode === mode ? 'bg-secondary-fixed text-on-secondary-fixed shadow-md' : 'text-on-primary-container hover:text-white'}`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </section>

                {/* 2. Consultation Fee Settings */}
                <section className="bg-primary-container p-6 rounded-lg border border-white/10 shadow-lg">
                    <h3 className="font-headline-sm text-white font-bold mb-1">Consultation Fee Settings</h3>
                    <p className="text-on-primary-container text-body-sm mb-6 text-opacity-80">Manage your rates and initial session offers.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="block text-white font-label-md mb-2">Hourly Rate</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-primary-container font-bold">BDT</span>
                                <input 
                                    className="w-full pl-16 bg-[#020d20] border-white/10 rounded-lg text-white font-body-md focus:border-secondary-fixed focus:ring-0" 
                                    type="number" 
                                    value={settings.hourly_rate}
                                    onChange={e => updateField('hourly_rate', e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-white font-label-md mb-2">Per-session Flat Fee</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-primary-container font-bold">BDT</span>
                                <input 
                                    className="w-full pl-16 bg-[#020d20] border-white/10 rounded-lg text-white font-body-md focus:ring-0" 
                                    placeholder="Enter amount" 
                                    type="number"
                                    value={settings.flat_fee || ''}
                                    onChange={e => updateField('flat_fee', e.target.value)}
                                />
                            </div>
                            <p className="text-on-primary-container text-xs mt-1 font-label-md">Optional field</p>
                        </div>
                    </div>

                    <div className="border-t border-white/5 pt-6 mb-8">
                        <h4 className="font-headline-sm text-white font-bold text-lg mb-2">Session Type Specific Fees (starting rates shown to clients)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-white font-label-md mb-2">Initial Consultation Fee</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-primary-container font-bold">BDT</span>
                                    <input 
                                        className="w-full pl-16 bg-[#020d20] border-white/10 rounded-lg text-white font-body-md focus:border-secondary-fixed focus:ring-0" 
                                        type="number" 
                                        value={settings.fee_initial_consultation || 3000}
                                        onChange={e => updateField('fee_initial_consultation', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-white font-label-md mb-2">Case Review Fee</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-primary-container font-bold">BDT</span>
                                    <input 
                                        className="w-full pl-16 bg-[#020d20] border-white/10 rounded-lg text-white font-body-md focus:border-secondary-fixed focus:ring-0" 
                                        type="number" 
                                        value={settings.fee_case_review || 5000}
                                        onChange={e => updateField('fee_case_review', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-white font-label-md mb-2">Follow-up Session Fee</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-primary-container font-bold">BDT</span>
                                    <input 
                                        className="w-full pl-16 bg-[#020d20] border-white/10 rounded-lg text-white font-body-md focus:border-secondary-fixed focus:ring-0" 
                                        type="number" 
                                        value={settings.fee_follow_up || 2000}
                                        onChange={e => updateField('fee_follow_up', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-white font-label-md mb-2">Emergency Consultation Fee</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-primary-container font-bold">BDT</span>
                                    <input 
                                        className="w-full pl-16 bg-[#020d20] border-white/10 rounded-lg text-white font-body-md focus:border-secondary-fixed focus:ring-0" 
                                        type="number" 
                                        value={settings.fee_emergency || 8000}
                                        onChange={e => updateField('fee_emergency', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-6 pt-6 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-bold font-body-md">Offer free initial consultation</p>
                                <p className="text-on-primary-container text-xs">Allow new clients to book a short introductory session at no cost.</p>
                            </div>
                            <button 
                                onClick={() => updateField('offer_free_consultation', !settings.offer_free_consultation)}
                                className={`w-12 h-6 rounded-full relative transition-colors ${settings.offer_free_consultation ? 'bg-secondary-fixed' : 'bg-white/10'}`}
                            >
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.offer_free_consultation ? 'right-1' : 'left-1 bg-on-primary-container'}`}></span>
                            </button>
                        </div>
                        
                        {settings.offer_free_consultation && (
                            <div className="pl-4 border-l-2 border-secondary-fixed">
                                <label className="block text-white font-label-md mb-3 text-opacity-90">Free Session Duration</label>
                                <div className="flex gap-3">
                                    {[15, 30].map(duration => (
                                        <button 
                                            key={duration}
                                            onClick={() => updateField('free_session_duration', duration)}
                                            className={`px-6 py-2 rounded-full font-label-md transition-all ${settings.free_session_duration === duration ? 'bg-secondary-fixed text-on-secondary-fixed shadow-md' : 'border border-white/10 text-on-primary-container hover:border-white/30'}`}
                                        >
                                            {duration} min
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* 3. Session Duration */}
                <section className="bg-primary-container p-6 rounded-lg border border-white/10 shadow-lg">
                    <h3 className="font-headline-sm text-white font-bold mb-1">Session Duration</h3>
                    <p className="text-on-primary-container text-body-sm mb-6 text-opacity-80">Select which session lengths you provide.</p>
                    <div className="flex flex-wrap gap-3">
                        {[30, 60, 90].map(duration => {
                            const isSelected = settings.session_durations.includes(duration);
                            return (
                                <button 
                                    key={duration}
                                    onClick={() => toggleArray('session_durations', duration)}
                                    className={`px-6 py-3 rounded-xl font-label-md flex items-center gap-2 transition-all ${isSelected ? 'bg-secondary-fixed text-on-secondary-fixed' : 'border border-white/10 text-on-primary-container hover:border-white/40'}`}
                                >
                                    {isSelected && <span className="material-symbols-outlined fill-icon text-lg" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>}
                                    {duration} min
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* 4. Booking Rules */}
                <section className="bg-primary-container p-6 rounded-lg border border-white/10 shadow-lg">
                    <h3 className="font-headline-sm text-white font-bold mb-1">Booking Rules</h3>
                    <p className="text-on-primary-container text-body-sm mb-6 text-opacity-80">Define limitations for scheduling appointments.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div>
                            <label className="block text-white font-label-md mb-2">Min. advance notice</label>
                            <select 
                                value={settings.min_advance_notice}
                                onChange={e => updateField('min_advance_notice', Number(e.target.value))}
                                className="w-full bg-[#020d20] border-white/10 rounded-lg text-white font-body-md focus:border-secondary-fixed focus:ring-0"
                            >
                                <option value={12}>12 hrs</option>
                                <option value={24}>24 hrs</option>
                                <option value={48}>48 hrs</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-white font-label-md mb-2">Max. booking window</label>
                            <select 
                                value={settings.max_booking_window}
                                onChange={e => updateField('max_booking_window', Number(e.target.value))}
                                className="w-full bg-[#020d20] border-white/10 rounded-lg text-white font-body-md focus:border-secondary-fixed focus:ring-0"
                            >
                                <option value={30}>30 days</option>
                                <option value={60}>60 days</option>
                                <option value={90}>90 days</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between md:pt-4">
                            <div>
                                <p className="text-white font-bold font-body-md">Auto-accept bookings</p>
                                <p className="text-on-primary-container text-xs">Skip manual review for new bookings.</p>
                            </div>
                            <button 
                                onClick={() => updateField('auto_accept_bookings', !settings.auto_accept_bookings)}
                                className={`w-12 h-6 rounded-full relative transition-colors ${settings.auto_accept_bookings ? 'bg-secondary-fixed' : 'bg-white/10'}`}
                            >
                                <span className={`absolute top-1 w-4 h-4 rounded-full transition-all ${settings.auto_accept_bookings ? 'right-1 bg-white' : 'left-1 bg-on-primary-container'}`}></span>
                            </button>
                        </div>
                        <div>
                            <label className="block text-white font-label-md mb-2">Buffer time between sessions</label>
                            <select 
                                value={settings.buffer_time}
                                onChange={e => updateField('buffer_time', Number(e.target.value))}
                                className="w-full bg-[#020d20] border-white/10 rounded-lg text-white font-body-md focus:border-secondary-fixed focus:ring-0"
                            >
                                <option value={0}>0 min</option>
                                <option value={15}>15 min</option>
                                <option value={30}>30 min</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* 5. Cancellation & Refund Policy */}
                <section className="bg-primary-container p-6 rounded-lg border border-white/10 shadow-lg">
                    <h3 className="font-headline-sm text-white font-bold mb-1">Cancellation & Refund Policy</h3>
                    <p className="text-on-primary-container text-body-sm mb-6 text-opacity-80">Establish terms for missed or canceled appointments.</p>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-white font-label-md mb-2">Cancellation window</label>
                            <select 
                                value={settings.cancellation_window}
                                onChange={e => updateField('cancellation_window', Number(e.target.value))}
                                className="w-full max-w-xs bg-[#020d20] border-white/10 rounded-lg text-white font-body-md focus:border-secondary-fixed focus:ring-0"
                            >
                                <option value={24}>24 hrs before session</option>
                                <option value={48}>48 hrs before session</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="block text-white font-label-md">Refund policy</label>
                            <div className="flex gap-6">
                                {['Full', 'Partial', 'No Refund'].map(policy => (
                                    <label key={policy} className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${settings.refund_policy === policy ? 'border-secondary-fixed' : 'border-on-primary-container group-hover:border-white'}`}>
                                            <div className={`w-2.5 h-2.5 rounded-full ${settings.refund_policy === policy ? 'bg-secondary-fixed' : 'bg-transparent'}`}></div>
                                        </div>
                                        <span className={`transition-colors ${settings.refund_policy === policy ? 'text-white' : 'text-on-primary-container group-hover:text-white'}`}>{policy}</span>
                                        <input 
                                            type="radio" 
                                            className="hidden" 
                                            checked={settings.refund_policy === policy}
                                            onChange={() => updateField('refund_policy', policy)} 
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                        
                        <div className="pt-6 border-t border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-white font-bold font-body-md">Charge late cancellation fee</p>
                                <button 
                                    onClick={() => updateField('charge_late_fee', !settings.charge_late_fee)}
                                    className={`w-12 h-6 rounded-full relative transition-colors ${settings.charge_late_fee ? 'bg-secondary-fixed' : 'bg-white/10'}`}
                                >
                                    <span className={`absolute top-1 w-4 h-4 rounded-full transition-all ${settings.charge_late_fee ? 'right-1 bg-white' : 'left-1 bg-on-primary-container'}`}></span>
                                </button>
                            </div>
                            
                            {settings.charge_late_fee && (
                                <div className="pl-4 border-l-2 border-secondary-fixed">
                                    <label className="block text-white font-label-md mb-2 text-opacity-90">Late Fee Amount</label>
                                    <div className="relative max-w-xs">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-primary-container font-bold">BDT</span>
                                        <input 
                                            className="w-full pl-16 bg-[#020d20] border-white/10 rounded-lg text-white font-body-md focus:border-secondary-fixed focus:ring-0" 
                                            type="number" 
                                            value={settings.late_fee_amount}
                                            onChange={e => updateField('late_fee_amount', e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* 6. Communication Preferences */}
                <section className="bg-primary-container p-6 rounded-lg border border-white/10 shadow-lg">
                    <h3 className="font-headline-sm text-white font-bold mb-1">Communication Preferences</h3>
                    <p className="text-on-primary-container text-body-sm mb-6 text-opacity-80">Choose how you wish to communicate with your clients.</p>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-white font-label-md mb-3">Preferred channel</label>
                            <div className="inline-flex p-1 bg-[#020d20] rounded-lg border border-white/5">
                                {['In-App Video', 'Phone', 'Chat'].map(chan => (
                                    <button 
                                        key={chan}
                                        onClick={() => updateField('preferred_channel', chan)}
                                        className={`px-6 py-2.5 rounded-md font-label-md transition-all ${settings.preferred_channel === chan ? 'bg-secondary-fixed text-on-secondary-fixed shadow-md' : 'text-on-primary-container hover:text-white'}`}
                                    >
                                        {chan}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-white font-label-md mb-2">Supported Consultation Mediums</label>
                            <p className="text-on-primary-container text-xs mb-3">Select options clients can book for consultations.</p>
                            <div className="flex flex-wrap gap-3">
                                {[
                                    { id: 'video_call', label: 'Video Call' },
                                    { id: 'platform_chat', label: 'Platform Chat' },
                                    { id: 'phone_call', label: 'Phone Call' },
                                    { id: 'in_office', label: 'In-Office' }
                                ].map(med => {
                                    const isSupported = (settings.supported_mediums || []).includes(med.id);
                                    return (
                                        <button
                                            key={med.id}
                                            type="button"
                                            onClick={() => toggleArray('supported_mediums', med.id)}
                                            className={`px-5 py-2.5 rounded-xl font-label-md flex items-center gap-2 transition-all ${isSupported ? 'bg-secondary-fixed text-on-secondary-fixed font-bold' : 'border border-white/10 text-on-primary-container hover:border-white/40'}`}
                                        >
                                            {isSupported && <span>✓</span>}
                                            {med.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <label className="block text-white font-label-md mb-2">Default Video Meeting URL</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-primary-container">link</span>
                                <input 
                                    className="w-full pl-12 bg-[#020d20] border-white/10 rounded-lg text-white font-body-md focus:border-secondary-fixed focus:ring-0" 
                                    placeholder="https://meet.google.com/xyz-abc-123" 
                                    type="text"
                                    value={settings.default_meeting_url}
                                    onChange={e => updateField('default_meeting_url', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                            <div className="flex items-center justify-between p-4 bg-[#020d20] rounded-xl border border-white/5">
                                <span className="text-white font-body-md">Email confirmation</span>
                                <button 
                                    onClick={() => updateField('email_confirmation', !settings.email_confirmation)}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${settings.email_confirmation ? 'bg-secondary-fixed' : 'bg-white/10'}`}
                                >
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full shadow-sm transition-all ${settings.email_confirmation ? 'right-1 bg-white' : 'left-1 bg-on-primary-container'}`}></span>
                                </button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-[#020d20] rounded-xl border border-white/5">
                                <span className="text-white font-body-md">SMS reminder</span>
                                <button 
                                    onClick={() => updateField('sms_reminder', !settings.sms_reminder)}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${settings.sms_reminder ? 'bg-secondary-fixed' : 'bg-white/10'}`}
                                >
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full shadow-sm transition-all ${settings.sms_reminder ? 'right-1 bg-white' : 'left-1 bg-on-primary-container'}`}></span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 7. Consultation Languages */}
                <section className="bg-primary-container p-6 rounded-lg border border-white/10 shadow-lg">
                    <h3 className="font-headline-sm text-white font-bold mb-1">Consultation Languages</h3>
                    <p className="text-on-primary-container text-body-sm mb-6 text-opacity-80">Select languages you are comfortable consulting in.</p>
                    <div className="flex flex-wrap gap-3 items-center">
                        {settings.consultation_languages.map(lang => (
                            <button 
                                key={lang}
                                onClick={() => toggleArray('consultation_languages', lang)}
                                className="px-6 py-3 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md flex items-center gap-2 hover:brightness-95 transition-all"
                            >
                                {lang}
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        ))}
                        
                        {!showLangInput ? (
                            <button 
                                onClick={() => setShowLangInput(true)}
                                className="px-6 py-3 rounded-full border border-dashed border-white/20 text-on-primary-container font-label-md hover:border-white/40 transition-colors flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">add</span>
                                Add Language
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 bg-[#020d20] p-1 rounded-full border border-white/20">
                                <input 
                                    type="text" 
                                    autoFocus
                                    className="bg-transparent border-none text-white px-4 py-1.5 focus:ring-0 text-sm w-32"
                                    value={newLang}
                                    onChange={e => setNewLang(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addLanguage()}
                                />
                                <button onClick={addLanguage} className="bg-secondary-fixed text-on-secondary-fixed p-1.5 rounded-full hover:brightness-110">
                                    <span className="material-symbols-outlined text-sm block">check</span>
                                </button>
                                <button onClick={() => setShowLangInput(false)} className="text-on-primary-container p-1.5 hover:text-white">
                                    <span className="material-symbols-outlined text-sm block">close</span>
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* Save CTA */}
                <div className="flex flex-col items-end pt-8">
                    {saveStatus === 'success' && (
                        <div className="mb-4 bg-emerald-500/10 border border-emerald-500 text-emerald-500 px-4 py-3 rounded-lg flex items-center gap-2 animate-fadeIn w-full md:w-auto">
                            <span className="material-symbols-outlined text-lg">check_circle</span>
                            <span className="font-bold font-body-md">Settings saved successfully!</span>
                        </div>
                    )}
                    {saveStatus === 'error' && (
                        <div className="mb-4 bg-error/10 border border-error text-error px-4 py-3 rounded-lg flex items-center gap-2 animate-fadeIn w-full md:w-auto">
                            <span className="material-symbols-outlined text-lg">error</span>
                            <span className="font-bold font-body-md">Failed to save settings. Please try again.</span>
                        </div>
                    )}
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-secondary-fixed text-on-secondary-fixed font-headline-sm py-4 px-12 rounded-lg shadow-2xl hover:brightness-110 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:active:scale-100"
                    >
                        {saving ? 'Saving...' : 'Save Consultation Settings'}
                        <span className="material-symbols-outlined">save</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConsultationSettings;
