import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const CATEGORIES = [
  'Criminal Law',
  'Family Law',
  'Property Law',
  'Corporate Law',
  'Civil Law',
  'Labor Law',
  'Constitutional Law',
  'Immigration Law',
  'Intellectual Property',
  'Tax Law'
];

const CITIES = [
  'Dhaka',
  'Chittagong',
  'Sylhet',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Rangpur',
  'Mymensingh',
  'Other / Nationwide'
];

const MEDIUMS = [
  { id: 'Video Call', label: 'Video Call (Zoom/Meet)', icon: 'videocam' },
  { id: 'In-Office', label: 'In-Office Consultation', icon: 'business' },
  { id: 'Phone', label: 'Phone Call', icon: 'call' },
  { id: 'Platform Chat', label: 'Platform Secure Chat', icon: 'chat' },
  { id: 'Any', label: 'No Preference / Any', icon: 'all_inclusive' }
];

const PostJob = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Step 1: Case Details
  const [title, setTitle] = useState('');
  const [legalCategory, setLegalCategory] = useState('Property Law');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('normal');

  // Step 2: Location & Budget
  const [city, setCity] = useState('Dhaka');
  const [budgetType, setBudgetType] = useState('fixed');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [preferredMediums, setPreferredMediums] = useState(['Any']);
  const [deadline, setDeadline] = useState('');

  // Step 3: Attachments & Privacy
  const [files, setFiles] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!user) {
      toast.error('Please login to post a legal case.');
      navigate('/login');
    } else if (user.user_type === 'lawyer') {
      toast.error('Lawyers cannot post cases. Please use a client account.');
      navigate('/job-board');
    }
  }, [user, navigate]);

  const handleMediumToggle = (id) => {
    if (id === 'Any') {
      setPreferredMediums(['Any']);
      return;
    }
    let updated = preferredMediums.filter(m => m !== 'Any');
    if (updated.includes(id)) {
      updated = updated.filter(m => m !== id);
    } else {
      updated.push(id);
    }
    if (updated.length === 0) updated = ['Any'];
    setPreferredMediums(updated);
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (files.length + selected.length > 3) {
      toast.error('You can upload a maximum of 3 documents.');
      return;
    }
    const validFiles = selected.filter(file => {
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > 10) {
        toast.error(`File ${file.name} is over 10MB limit.`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async () => {
    if (files.length === 0) return [];
    setUploadingFiles(true);
    const uploadedUrls = [];

    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('job-attachments')
          .upload(fileName, file);

        if (uploadError) {
          console.warn('File upload failed (storage bucket might not exist or RLS issue):', uploadError);
          // Fallback: if storage upload fails, we still allow posting without breaking
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('job-attachments')
          .getPublicUrl(fileName);

        if (publicUrl) uploadedUrls.push(publicUrl);
      }
    } catch (err) {
      console.error('Attachment upload error:', err);
    } finally {
      setUploadingFiles(false);
    }
    return uploadedUrls;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (description.trim().length < 50) {
      toast.error('Please provide a more detailed case description (at least 50 characters).');
      setStep(1);
      return;
    }

    try {
      setSubmitting(true);
      const attachmentUrls = await uploadAttachments();

      const payload = {
        client_id: user.id,
        title: title.trim(),
        description: description.trim(),
        legal_category: legalCategory,
        location: city,
        city: city,
        budget_min: budgetType === 'negotiable' ? null : (budgetMin ? Number(budgetMin) : null),
        budget_max: budgetType === 'negotiable' ? null : (budgetMax ? Number(budgetMax) : null),
        budget_type: budgetType,
        urgency: urgency,
        preferred_consultation_medium: preferredMediums,
        attachments: attachmentUrls,
        status: 'open',
        deadline: deadline || null,
        is_anonymous: isAnonymous
      };

      const { error } = await supabase
        .from('job_posts')
        .insert([payload]);

      if (error) throw error;

      toast.success('Your legal case has been posted publicly!');
      navigate('/client/portal/my-posts');
    } catch (err) {
      console.error('Error posting job:', err);
      toast.error(err.message || 'Failed to post case');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background min-h-screen py-12 px-4 sm:px-6 lg:px-8 selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/job-board" className="inline-flex items-center gap-1 text-xs font-bold text-on-surface-variant hover:text-primary mb-3 transition-colors">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Job Board
          </Link>
          <h1 className="text-3xl font-extrabold text-primary font-display-md">
            Post a Legal Case
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Connect with verified legal experts across Bangladesh. Receive tailored proposals in hours.
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="bg-surface-container-lowest p-4 sm:p-6 rounded-2xl border border-outline-variant shadow-sm mb-8">
          <div className="flex items-center justify-between relative">
            {/* Step 1 */}
            <div className={`flex items-center gap-2.5 z-10 ${step >= 1 ? 'text-primary font-bold' : 'text-gray-400 font-medium'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === 1 ? 'bg-primary text-white ring-4 ring-primary/20' : step > 1 ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step > 1 ? <span className="material-symbols-outlined text-sm">check</span> : '1'}
              </div>
              <span className="text-xs sm:text-sm">1. Case Details</span>
            </div>

            <div className={`flex-1 h-1 mx-2 rounded transition-colors ${step >= 2 ? 'bg-emerald-600' : 'bg-gray-200'}`}></div>

            {/* Step 2 */}
            <div className={`flex items-center gap-2.5 z-10 ${step >= 2 ? 'text-primary font-bold' : 'text-gray-400 font-medium'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === 2 ? 'bg-primary text-white ring-4 ring-primary/20' : step > 2 ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step > 2 ? <span className="material-symbols-outlined text-sm">check</span> : '2'}
              </div>
              <span className="text-xs sm:text-sm">2. Location & Budget</span>
            </div>

            <div className={`flex-1 h-1 mx-2 rounded transition-colors ${step >= 3 ? 'bg-emerald-600' : 'bg-gray-200'}`}></div>

            {/* Step 3 */}
            <div className={`flex items-center gap-2.5 z-10 ${step >= 3 ? 'text-primary font-bold' : 'text-gray-400 font-medium'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === 3 ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-gray-200 text-gray-600'
              }`}>
                3
              </div>
              <span className="text-xs sm:text-sm">3. Privacy & Review</span>
            </div>
          </div>
        </div>

        {/* Form Box */}
        <div className="bg-surface-container-lowest p-6 sm:p-10 rounded-3xl border border-outline-variant shadow-md">
          <form onSubmit={handleSubmit}>
            
            {/* STEP 1: CASE DETAILS */}
            {step === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-xl font-bold text-primary border-b border-outline-variant pb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">gavel</span>
                  Step 1: Explain Your Legal Need
                </h2>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">
                    Case Title / Summary <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Need property dispute lawyer for land inheritance in Dhaka"
                    required
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3.5 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary focus:outline-none transition-all"
                  />
                </div>

                {/* Legal Category */}
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">
                    Practice Area <span className="text-error">*</span>
                  </label>
                  <select
                    value={legalCategory}
                    onChange={(e) => setLegalCategory(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3.5 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary focus:outline-none transition-all"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">
                    Detailed Case Description <span className="text-error">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    placeholder="Describe what happened, any existing documentation, who is involved, and what outcome you are seeking. Do not include sensitive personal identification numbers..."
                    required
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3.5 text-sm text-on-surface focus:ring-2 focus:ring-secondary focus:outline-none transition-all leading-relaxed"
                  ></textarea>
                  <div className="flex justify-between text-xs text-on-surface-variant mt-1">
                    <span>Be as descriptive as possible so lawyers can accurately estimate fees.</span>
                    <span className={description.trim().length < 50 ? 'text-error font-bold' : 'text-emerald-600 font-bold'}>
                      {description.trim().length} / 50+ chars
                    </span>
                  </div>
                </div>

                {/* Urgency */}
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">
                    How urgent is your situation?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'normal', label: 'Normal Priority', desc: 'Can start within 1-2 weeks', icon: 'schedule' },
                      { id: 'urgent', label: 'Urgent Case', desc: 'Need consultation in 2-3 days', icon: 'bolt' },
                      { id: 'emergency', label: 'Emergency / Arrest', desc: 'Immediate legal intervention', icon: 'emergency' }
                    ].map(u => (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => setUrgency(u.id)}
                        className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          urgency === u.id
                            ? u.id === 'emergency' ? 'bg-red-600 text-white border-red-600 shadow-md scale-[1.02]' : 'bg-primary text-white border-primary shadow-md scale-[1.02]'
                            : 'bg-surface-container-low border-outline-variant hover:border-primary/50 text-on-surface'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm">{u.label}</span>
                          <span className={`material-symbols-outlined ${urgency === u.id ? 'text-secondary' : 'text-on-surface-variant'}`}>{u.icon}</span>
                        </div>
                        <span className={`text-[11px] ${urgency === u.id ? 'text-white/80' : 'text-on-surface-variant'}`}>{u.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-outline-variant flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!title.trim() || description.trim().length < 50) {
                        toast.error('Please enter a title and at least 50 characters of description.');
                        return;
                      }
                      setStep(2);
                    }}
                    className="bg-primary text-white font-bold px-8 py-3.5 rounded-xl text-sm hover:bg-primary-fixed hover:text-white transition-all shadow-md flex items-center gap-2"
                  >
                    <span>Next: Location & Budget</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: LOCATION & BUDGET */}
            {step === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-xl font-bold text-primary border-b border-outline-variant pb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">payments</span>
                  Step 2: Location, Budget & Preferences
                </h2>

                {/* City */}
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">
                    City / Jurisdiction <span className="text-error">*</span>
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3.5 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary focus:outline-none transition-all"
                  >
                    {CITIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Budget Type */}
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">
                    Budget Preference
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'fixed', label: 'Fixed Price', desc: 'Total fee for the entire matter' },
                      { id: 'hourly', label: 'Hourly Rate', desc: 'Pay per hour of legal work' },
                      { id: 'negotiable', label: 'Negotiable / Open', desc: 'Let lawyers propose their fee' }
                    ].map(b => (
                      <button
                        type="button"
                        key={b.id}
                        onClick={() => setBudgetType(b.id)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          budgetType === b.id
                            ? 'bg-primary text-white font-bold border-primary shadow'
                            : 'bg-surface-container-low border-outline-variant hover:border-primary/50 text-on-surface'
                        }`}
                      >
                        <div className="text-sm font-bold mb-1">{b.label}</div>
                        <div className={`text-[11px] ${budgetType === b.id ? 'text-white/80' : 'text-on-surface-variant'}`}>{b.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget Range Inputs */}
                {budgetType !== 'negotiable' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/60">
                    <div>
                      <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-1.5">
                        Minimum Budget (BDT)
                      </label>
                      <input
                        type="number"
                        value={budgetMin}
                        onChange={(e) => setBudgetMin(e.target.value)}
                        placeholder="e.g. 10000"
                        min="0"
                        className="w-full bg-white border border-outline-variant rounded-xl p-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-1.5">
                        Maximum Budget (BDT)
                      </label>
                      <input
                        type="number"
                        value={budgetMax}
                        onChange={(e) => setBudgetMax(e.target.value)}
                        placeholder="e.g. 30000"
                        min="0"
                        className="w-full bg-white border border-outline-variant rounded-xl p-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Consultation Mediums */}
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">
                    Preferred Consultation Medium (Select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {MEDIUMS.map(m => {
                      const isSelected = preferredMediums.includes(m.id);
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => handleMediumToggle(m.id)}
                          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center gap-2 ${
                            isSelected
                              ? 'bg-secondary text-primary border-secondary shadow-sm scale-105'
                              : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/50'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">{m.icon}</span>
                          <span>{m.label}</span>
                          {isSelected && <span className="material-symbols-outlined text-sm">check</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Deadline */}
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">
                    Desired Completion / Deadline (Optional)
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full sm:w-1/2 bg-surface-container-low border border-outline-variant rounded-xl p-3.5 text-sm text-on-surface focus:ring-2 focus:ring-secondary focus:outline-none"
                  />
                </div>

                <div className="pt-6 border-t border-outline-variant flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="bg-surface-container-high text-on-surface font-bold px-6 py-3.5 rounded-xl text-sm hover:bg-surface-container-highest transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="bg-primary text-white font-bold px-8 py-3.5 rounded-xl text-sm hover:bg-primary-fixed hover:text-white transition-all shadow-md flex items-center gap-2"
                  >
                    <span>Next: Attachments & Privacy</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: ATTACHMENTS, PRIVACY & REVIEW */}
            {step === 3 && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-xl font-bold text-primary border-b border-outline-variant pb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">verified_user</span>
                  Step 3: Documents, Privacy & Final Review
                </h2>

                {/* File Uploader */}
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">
                    Attach Case Files / Evidence (Optional, max 3 files, 10MB each)
                  </label>
                  <div className="border-2 border-dashed border-outline-variant rounded-2xl p-6 text-center hover:border-secondary transition-colors bg-surface-container-low/50">
                    <input
                      type="file"
                      id="file-upload"
                      multiple
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="hidden"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                      <div className="w-12 h-12 bg-secondary/20 text-primary rounded-full flex items-center justify-center mb-2">
                        <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                      </div>
                      <span className="text-sm font-bold text-primary">Click to attach documents</span>
                      <span className="text-xs text-on-surface-variant mt-1">PDF, DOCX, JPG, or PNG</span>
                    </label>
                  </div>

                  {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {files.map((f, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl border border-outline-variant text-xs font-bold text-primary">
                          <div className="flex items-center gap-2 truncate">
                            <span className="material-symbols-outlined text-blue-600">description</span>
                            <span className="truncate">{f.name}</span>
                            <span className="text-on-surface-variant font-normal">({(f.size / 1024).toFixed(0)} KB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="text-error hover:bg-error/10 p-1 rounded-full"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Anonymous Toggle */}
                <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant">
                  <label className="flex items-start justify-between cursor-pointer gap-4">
                    <div>
                      <span className="text-sm font-extrabold text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-secondary">lock</span>
                        Post Case Anonymously
                      </span>
                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                        When enabled, your name and profile picture will be hidden from the public job board. Lawyers will only see "Anonymous Client". Your identity will remain confidential until you explicitly accept a lawyer's proposal.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary relative shrink-0 mt-0.5"></div>
                  </label>
                </div>

                {/* Review Summary Card */}
                <div className="bg-surface-container-lowest border-2 border-secondary/40 p-6 rounded-2xl space-y-3 text-xs sm:text-sm">
                  <h3 className="font-extrabold text-primary text-base border-b border-outline-variant pb-2 mb-3">
                    Case Summary Preview
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-on-surface-variant block text-[11px] uppercase font-bold">Title:</span>
                      <span className="font-bold text-primary">{title || 'Untitled'}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block text-[11px] uppercase font-bold">Practice Area:</span>
                      <span className="font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded inline-block">{legalCategory}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block text-[11px] uppercase font-bold">Location & Budget:</span>
                      <span className="font-bold text-primary">
                        {city} — {budgetType === 'negotiable' ? 'Negotiable' : `BDT ${budgetMin || 0} to ${budgetMax || 0} (${budgetType})`}
                      </span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block text-[11px] uppercase font-bold">Urgency & Privacy:</span>
                      <span className="font-bold text-primary uppercase">{urgency}</span>
                      {isAnonymous && <span className="ml-2 bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Anonymous</span>}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-outline-variant flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="bg-surface-container-high text-on-surface font-bold px-6 py-3.5 rounded-xl text-sm hover:bg-surface-container-highest transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || uploadingFiles}
                    className="bg-secondary text-primary font-extrabold px-8 py-4 rounded-xl text-sm sm:text-base hover:bg-secondary-fixed hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting || uploadingFiles ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span>{uploadingFiles ? 'Uploading Files...' : 'Posting Case...'}</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xl">publish</span>
                        <span>Confirm & Post Case Publicly</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </form>
        </div>

      </div>
    </div>
  );
};

export default PostJob;
