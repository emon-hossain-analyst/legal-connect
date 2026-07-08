import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { SkeletonDashboard } from '../../components/Skeleton/Skeleton';

const LawyerProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);

  // Form State
  const [profilePic, setProfilePic] = useState(null);
  const [profilePicFile, setProfilePicFile] = useState(null);
  const fileInputRef = useRef(null);

  const [basicInfo, setBasicInfo] = useState({
    name: '',
    bio: '',
    location: '',
    hourly_rate: '',
    experience_years: '',
    languages: [],
    languageInput: ''
  });

  const [credentials, setCredentials] = useState({
    bar_number: '',
    education: [],
    verification_status: 'unverified'
  });

  const [availability, setAvailability] = useState({
    monday: { active: true, start: '09:00', end: '17:00' },
    tuesday: { active: true, start: '09:00', end: '17:00' },
    wednesday: { active: true, start: '09:00', end: '17:00' },
    thursday: { active: true, start: '09:00', end: '17:00' },
    friday: { active: true, start: '09:00', end: '17:00' },
    saturday: { active: false, start: '09:00', end: '17:00' },
    sunday: { active: false, start: '09:00', end: '17:00' }
  });

  const [slug, setSlug] = useState('');

  // Fetch Data
  useEffect(() => {
    if (user?.id) fetchProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchProfile = async () => {
    try {
      const authId = user.auth_id || user.id;
      
      const { data: publicUser } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authId)
        .maybeSingle();

      if (publicUser) {
        setBasicInfo(prev => ({ ...prev, name: publicUser.name }));
        setProfilePic(publicUser.profile_picture_url);

        const { data: lawyerData } = await supabase
          .from('lawyers')
          .select('*')
          .eq('user_id', publicUser.id)
          .maybeSingle();

        if (lawyerData) {
          const d = lawyerData;
          setSlug(d.slug || '');
          setBasicInfo(prev => ({
            ...prev,
            bio: d.bio || '',
            location: d.location || '',
            hourly_rate: d.hourly_rate || '',
            experience_years: d.experience_years || '',
            languages: d.languages || []
          }));
          
          setCredentials(prev => ({
            ...prev,
            bar_number: d.bar_number || '',
            education: d.education || [],
            verification_status: d.verification_status || 'unverified'
          }));

          if (d.availability && Object.keys(d.availability).length > 0) {
            setAvailability(d.availability);
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---
  const handleBasicInfoChange = (e) => {
    const { name, value } = e.target;
    setBasicInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleLanguageKeyDown = (e) => {
    if (e.key === 'Enter' && basicInfo.languageInput.trim()) {
      e.preventDefault();
      if (!basicInfo.languages.includes(basicInfo.languageInput.trim())) {
        setBasicInfo(prev => ({
          ...prev,
          languages: [...prev.languages, prev.languageInput.trim()],
          languageInput: ''
        }));
      }
    }
  };

  const removeLanguage = (lang) => {
    setBasicInfo(prev => ({
      ...prev,
      languages: prev.languages.filter(l => l !== lang)
    }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePicFile(file);
      setProfilePic(URL.createObjectURL(file));
    }
  };

  const handleAddEducation = () => {
    setCredentials(prev => ({
      ...prev,
      education: [...prev.education, { institution: '', degree: '', graduation_year: '' }]
    }));
  };

  const updateEducation = (index, field, value) => {
    const newEd = [...credentials.education];
    newEd[index][field] = value;
    setCredentials(prev => ({ ...prev, education: newEd }));
  };

  const removeEducation = (index) => {
    const newEd = [...credentials.education];
    newEd.splice(index, 1);
    setCredentials(prev => ({ ...prev, education: newEd }));
  };

  const toggleDay = (day) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], active: !prev[day].active }
    }));
  };

  const updateTime = (day, field, value) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      let finalPicUrl = profilePic;
      if (profilePicFile) {
        const fileExt = profilePicFile.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('avatars')
          .upload(fileName, profilePicFile, { upsert: true });
          
        if (!uploadError && data) {
          const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          finalPicUrl = publicUrlData.publicUrl;
        }
      }

      const authId = user.auth_id || user.id;
      let publicUserRes = await supabase.from('users').select('id').eq('auth_id', authId).maybeSingle();
      
      let publicUserId;
      if (publicUserRes.data) {
        publicUserId = publicUserRes.data.id;
      } else {
        const { data: newUser, error: insErr } = await supabase.from('users').insert({
          auth_id: authId,
          email: user.email,
          name: basicInfo.name,
          user_type: 'lawyer',
          password_hash: ''
        }).select('id').single();
        if (insErr) throw insErr;
        publicUserId = newUser.id;
      }

      const { error: userError } = await supabase
        .from('users')
        .update({
          name: basicInfo.name,
          profile_picture_url: finalPicUrl
        })
        .eq('id', publicUserId);
      
      if (userError) throw userError;

      const { data: existingLawyer, error: existError } = await supabase.from('lawyers').select('id').eq('user_id', publicUserId).maybeSingle();
      if (existError && existError.code !== 'PGRST116') {
        throw existError;
      }
      
      const lawyerPayload = {
        user_id: publicUserId,
        bio: basicInfo.bio,
        location: basicInfo.location,
        hourly_rate: parseFloat(basicInfo.hourly_rate) || 0,
        experience_years: parseInt(basicInfo.experience_years) || 0,
        languages: basicInfo.languages,
        bar_number: credentials.bar_number || null,
        education: credentials.education,
        availability: availability
      };

      let lawyerError;
      if (existingLawyer) {
        const { error } = await supabase.from('lawyers').update(lawyerPayload).eq('user_id', publicUserId);
        lawyerError = error;
      } else {
        const { error } = await supabase.from('lawyers').insert(lawyerPayload);
        lawyerError = error;
      }

      if (lawyerError) throw lawyerError;

      toast.success('Profile saved successfully!');
      await fetchProfile();
    } catch (err) {
      console.error('Save profile error:', err);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-screen bg-[#F4F6F9] p-8"><SkeletonDashboard /></div>;
  }

  const navItems = [
    { id: 'basic', icon: 'person', label: 'Basic Info' },
    { id: 'credentials', icon: 'verified_user', label: 'Credentials' },
    { id: 'verifications', icon: 'check_circle', label: 'Verifications' },
    { id: 'availability', icon: 'calendar_month', label: 'Availability' },
    { id: 'preview', icon: 'visibility', label: 'Profile Preview' }
  ];

  const userProfilePic = profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(basicInfo.name || 'Lawyer')}&background=041635&color=fff`;

  return (
    <div className="bg-[#F4F6F9] text-on-surface font-body-md overflow-x-hidden min-h-screen flex">
      <style>{`
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .fill-icon { font-variation-settings: 'FILL' 1; }
        .serif-text { font-family: 'Source Serif 4', Georgia, serif; }
        .gold-glow:focus-within { box-shadow: 0 0 0 2px #fed977; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #1b2b4b; border-radius: 10px; }
      `}</style>
      
      {/* SideNavBar Shell */}
      <aside className="flex flex-col h-screen fixed left-0 top-0 bg-primary-container docked w-64 border-r border-outline-variant shadow-sm z-50">
        <div className="p-6 py-8">
          <h1 className="font-headline-md text-[22px] font-bold text-secondary-container">LegalConnect</h1>
          <p className="text-on-primary-container opacity-80 text-[14px] mt-1">Lawyer Dashboard</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-r-lg transition-all ${
                activeTab === item.id 
                  ? 'text-surface-container-lowest font-bold border-l-4 border-secondary-container bg-primary/20 translate-x-1'
                  : 'text-on-primary-container opacity-80 hover:bg-primary hover:text-secondary-container'
              }`}
            >
              <span className={`material-symbols-outlined ${activeTab === item.id ? 'fill-icon' : ''}`}>{item.icon}</span>
              <span className="font-body-md text-[15px]">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-6 mt-auto">
          <button onClick={() => navigate('/lawyer-dashboard')} className="w-full bg-secondary-container text-primary font-bold py-2.5 px-4 rounded-lg hover:bg-secondary-fixed transition-all text-[13px]">
            Back to Dashboard
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        
        {/* TopNavBar Shell */}
        <header className="flex justify-between items-center w-full px-8 py-3 h-16 bg-surface border-b border-outline-variant sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <h2 className="font-headline-sm text-[18px] font-bold text-primary">Lawyer Profile Suite</h2>
            <div className="hidden lg:flex items-center gap-4 border-l border-outline-variant pl-6">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-primary">Profile Strength:</span>
                <div className="w-32 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="bg-secondary h-full" style={{ width: credentials.verification_status === 'verified' ? '100%' : '78%' }}></div>
                </div>
                <span className="text-[14px] text-secondary font-bold">{credentials.verification_status === 'verified' ? '100% "Verified"' : '78% "Professional"'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-full transition-all">
                <span className="material-symbols-outlined">notifications</span>
              </button>
            </div>
            <div className="h-8 w-px bg-outline-variant mx-2"></div>
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/lawyer/profile')}>
              <div className="w-10 h-10 rounded-full border border-outline-variant overflow-hidden">
                <img alt="Lawyer Account" className="w-full h-full object-cover" src={userProfilePic} />
              </div>
              <span className="font-label-md text-[13px] font-medium text-on-surface-variant group-hover:text-primary">{basicInfo.name || 'Lawyer'}</span>
            </div>
          </div>
        </header>

        {/* Main Content Canvas */}
        <main className="p-8 flex-1">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {activeTab !== 'preview' && (
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-display-lg text-[32px] font-bold text-primary">
                    {activeTab === 'basic' ? 'Basic Information' : 
                     activeTab === 'credentials' ? 'Professional Credentials' : 
                     activeTab === 'verifications' ? 'Verification Center' : 'Availability Settings'}
                  </h3>
                  <p className="text-on-surface-variant font-body-md text-[15px]">
                    {activeTab === 'basic' ? 'Update your professional identity and contact details.' : 
                     activeTab === 'credentials' ? "Manage your legal licensing, educational background, and court admissions to maintain your professional profile's integrity." : 
                     activeTab === 'verifications' ? 'Submit and track the status of your professional credentials.' : 'Set your weekly consultation hours.'}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => fetchProfile()} className="px-6 py-2 border border-primary text-primary rounded-lg font-label-md text-[13px] font-medium hover:bg-surface-container-low transition-colors">Discard</button>
                  <button onClick={saveProfile} disabled={saving} className="px-6 py-2 bg-primary text-white rounded-lg font-label-md text-[13px] font-medium hover:bg-secondary transition-colors shadow-sm">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* TAB: BASIC INFO */}
            {activeTab === 'basic' && (
              <div className="grid grid-cols-12 gap-8">
                {/* Left Column: Avatar */}
                <div className="col-span-12 md:col-span-4 space-y-6">
                  <div className="bg-white p-8 rounded-xl border border-outline-variant shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col items-center">
                    <div className="relative group">
                      <div className="w-48 h-48 rounded-full border-4 border-surface-container overflow-hidden">
                        <img alt="Profile Avatar" className="w-full h-full object-cover" src={userProfilePic} />
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                      <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-2 right-2 p-3 bg-secondary-container text-primary rounded-full shadow-lg hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined">photo_camera</span>
                      </button>
                    </div>
                    <div className="mt-6 flex flex-col items-center gap-2">
                      {credentials.verification_status === 'verified' ? (
                        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#4CAF50]/15 text-[#4CAF50] rounded-full">
                          <span className="material-symbols-outlined text-[18px] fill-icon">verified</span>
                          <span className="font-label-md text-[13px] font-bold uppercase tracking-wider">Verified Professional</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-warning-amber/15 text-warning-amber rounded-full">
                          <span className="material-symbols-outlined text-[18px] fill-icon">pending</span>
                          <span className="font-label-md text-[13px] font-bold uppercase tracking-wider">Unverified</span>
                        </div>
                      )}
                      <p className="text-[14px] text-on-surface-variant text-center px-4 mt-2">
                        Member since {new Date().getFullYear()}<br/>
                        Bar Admission: {basicInfo.location || 'Pending'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-primary p-6 rounded-xl text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                      <h4 className="font-headline-sm text-[18px] font-bold mb-2">Need assistance?</h4>
                      <p className="text-[14px] opacity-80 mb-4">Our dedicated account managers are available for premium profile optimization.</p>
                      <button onClick={() => navigate('/contact')} className="w-full py-2 bg-secondary-container text-primary font-bold rounded-lg hover:bg-white transition-colors">Contact Support</button>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                      <span className="material-symbols-outlined text-[120px]">gavel</span>
                    </div>
                  </div>
                </div>
                
                {/* Right Column: Form */}
                <div className="col-span-12 md:col-span-8 space-y-8">
                  <div className="bg-white p-6 rounded-xl border border-outline-variant shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                    <h4 className="font-headline-sm text-[18px] font-bold text-primary mb-6 border-b border-outline-variant pb-4">Professional Details</h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2 md:col-span-1 space-y-2">
                        <label className="font-label-md text-[13px] font-medium text-on-surface-variant">Full Name</label>
                        <div className="gold-glow">
                          <input name="name" value={basicInfo.name} onChange={handleBasicInfoChange} className="w-full px-4 py-3 border border-outline rounded-lg focus:outline-none focus:border-primary font-body-md text-[15px]" type="text" />
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-1 space-y-2">
                        <label className="font-label-md text-[13px] font-medium text-on-surface-variant">Years of Experience</label>
                        <div className="gold-glow">
                          <input name="experience_years" value={basicInfo.experience_years} onChange={handleBasicInfoChange} className="w-full px-4 py-3 border border-outline rounded-lg focus:outline-none focus:border-primary font-body-md text-[15px]" type="number" />
                        </div>
                      </div>
                      <div className="col-span-2 space-y-2">
                        <label className="font-label-md text-[13px] font-medium text-on-surface-variant">Professional Bio</label>
                        <div className="gold-glow">
                          <textarea name="bio" value={basicInfo.bio} onChange={handleBasicInfoChange} className="serif-text w-full px-4 py-3 border border-outline rounded-lg focus:outline-none focus:border-primary text-[16px]" rows="4" placeholder="Describe your practice..."></textarea>
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-1 space-y-2">
                        <label className="font-label-md text-[13px] font-medium text-on-surface-variant">Location</label>
                        <div className="gold-glow">
                          <input name="location" value={basicInfo.location} onChange={handleBasicInfoChange} className="w-full px-4 py-3 border border-outline rounded-lg focus:outline-none focus:border-primary font-body-md text-[15px]" type="text" placeholder="e.g. Dhaka" />
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-1 space-y-2">
                        <label className="font-label-md text-[13px] font-medium text-on-surface-variant">Hourly Rate (BDT)</label>
                        <div className="gold-glow">
                          <input name="hourly_rate" value={basicInfo.hourly_rate} onChange={handleBasicInfoChange} className="w-full px-4 py-3 border border-outline rounded-lg focus:outline-none focus:border-primary font-body-md text-[15px]" type="number" />
                        </div>
                      </div>
                      
                      <div className="col-span-2 space-y-2">
                        <label className="font-label-md text-[13px] font-medium text-on-surface-variant">Languages (Press Enter to Add)</label>
                        <div className="w-full px-4 py-3 border border-outline rounded-lg focus-within:border-primary flex flex-wrap gap-2 items-center bg-white gold-glow transition-all">
                          {basicInfo.languages.map((lang, idx) => (
                            <span key={idx} className="bg-surface-container-high text-primary px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                              {lang}
                              <button type="button" onClick={() => removeLanguage(lang)} className="text-on-surface-variant hover:text-error">×</button>
                            </span>
                          ))}
                          <input 
                            type="text" 
                            name="languageInput" 
                            value={basicInfo.languageInput} 
                            onChange={handleBasicInfoChange} 
                            onKeyDown={handleLanguageKeyDown}
                            className="flex-1 min-w-[120px] outline-none text-[15px]" 
                            placeholder="e.g. Bengali, English" 
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CREDENTIALS */}
            {activeTab === 'credentials' && (
              <div className="space-y-8">
                {/* Bar Registration Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-headline-md text-[22px] font-bold text-primary">Bar Registration</h3>
                      <span className="material-symbols-outlined text-green-600 fill-icon">verified</span>
                    </div>
                    <div className="space-y-4">
                      <div className="group">
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Registration Number</label>
                        <div className="relative">
                          <input 
                            value={credentials.bar_number} 
                            onChange={e => setCredentials({...credentials, bar_number: e.target.value})} 
                            className="w-full bg-surface-container-low border border-outline focus:border-primary focus:ring-1 focus:ring-secondary-container rounded p-3 text-primary font-mono outline-none" 
                            type="text" 
                            placeholder="e.g. BAR-12345" 
                          />
                        </div>
                      </div>
                      <p className="text-[14px] text-on-surface-variant italic">Enter your official bar council registration number.</p>
                    </div>
                  </div>
                  
                  {/* Education Overview Card */}
                  <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                    <h3 className="font-headline-md text-[22px] font-bold text-primary mb-4">License Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Verification Status</label>
                        <p className="text-[15px] font-semibold text-primary capitalize">{credentials.verification_status}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Account Type</label>
                        <p className="text-[15px] font-semibold text-primary">Legal Professional</p>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Joined Date</label>
                        <div className="flex items-center gap-2 text-primary">
                          <span className="material-symbols-outlined text-sm">calendar_today</span>
                          <span className="text-[15px]">2024</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Education Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline-md text-[22px] font-bold text-primary">Education</h3>
                    <button onClick={handleAddEducation} className="flex items-center gap-2 bg-secondary-container text-primary font-bold px-4 py-2 rounded-lg hover:bg-secondary-fixed-dim transition-all text-sm shadow-sm">
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add Education
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {credentials.education.length === 0 ? (
                      <div className="col-span-full p-6 text-center text-on-surface-variant border border-dashed border-outline rounded-xl bg-surface-container-lowest">
                        No education history added. Add your law degrees here.
                      </div>
                    ) : (
                      credentials.education.map((ed, i) => (
                        <div key={i} className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl flex flex-col gap-3 hover:shadow-md transition-shadow relative">
                          <button type="button" onClick={() => removeEducation(i)} className="absolute top-4 right-4 p-1.5 text-outline hover:text-error hover:bg-error-container transition-colors rounded">
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                          
                          <div className="flex gap-4">
                            <div className="w-12 h-12 bg-primary/5 rounded flex items-center justify-center text-primary shrink-0">
                              <span className="material-symbols-outlined">school</span>
                            </div>
                            <div className="flex-1 space-y-2 w-full pr-8">
                              <div>
                                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Institution</label>
                                <input type="text" value={ed.institution} onChange={e => updateEducation(i, 'institution', e.target.value)} className="w-full bg-surface border border-outline-variant rounded p-2 text-[15px] outline-none focus:border-primary" placeholder="e.g. Dhaka University" />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Degree</label>
                                <input type="text" value={ed.degree} onChange={e => updateEducation(i, 'degree', e.target.value)} className="w-full bg-surface border border-outline-variant rounded p-2 text-[15px] outline-none focus:border-primary" placeholder="e.g. LLB (Hons)" />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Graduation Year</label>
                                <input type="number" value={ed.graduation_year} onChange={e => updateEducation(i, 'graduation_year', e.target.value)} className="w-full bg-surface border border-outline-variant rounded p-2 text-[15px] outline-none focus:border-primary" placeholder="e.g. 2015" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: VERIFICATIONS */}
            {activeTab === 'verifications' && (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-sm">
                <h3 className="font-headline-md text-[22px] font-bold text-primary mb-6">Verification Status</h3>
                
                <div className="flex items-center gap-6 mb-8">
                  <span className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider ${
                    credentials.verification_status === 'verified' ? 'bg-[#4CAF50]/15 text-[#4CAF50]' :
                    credentials.verification_status === 'pending' ? 'bg-warning-amber/15 text-warning-amber' :
                    'bg-error-container text-error'
                  }`}>
                    {credentials.verification_status}
                  </span>
                  
                  {credentials.verification_status !== 'verified' && (
                    <button className="px-6 py-2 bg-primary text-white rounded-lg font-label-md text-[13px] font-medium hover:bg-secondary transition-colors shadow-sm">
                      Submit for Verification
                    </button>
                  )}
                </div>

                <div className="space-y-6 max-w-2xl">
                  <div className="flex gap-4 p-4 border border-outline-variant rounded-xl bg-surface">
                    <span className="material-symbols-outlined text-secondary">admin_panel_settings</span>
                    <div>
                      <h4 className="font-bold text-primary mb-1">Identity Verification</h4>
                      <p className="text-[14px] text-on-surface-variant">Upload a government-issued ID (NID or Passport) to verify your identity.</p>
                      <button className="mt-3 text-[13px] font-bold text-primary border border-outline px-4 py-1.5 rounded hover:bg-surface-container-low transition-colors">Upload ID</button>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 border border-outline-variant rounded-xl bg-surface">
                    <span className="material-symbols-outlined text-secondary">card_membership</span>
                    <div>
                      <h4 className="font-bold text-primary mb-1">Bar Council Certificate</h4>
                      <p className="text-[14px] text-on-surface-variant">Provide a scanned copy of your Bar Council Registration Certificate.</p>
                      <button className="mt-3 text-[13px] font-bold text-primary border border-outline px-4 py-1.5 rounded hover:bg-surface-container-low transition-colors">Upload Certificate</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: AVAILABILITY */}
            {activeTab === 'availability' && (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(availability).map(([day, config]) => (
                    <div key={day} className={`flex flex-col border rounded-xl overflow-hidden transition-colors ${config.active ? 'border-secondary-container shadow-sm' : 'border-outline-variant'}`}>
                      <div className={`p-4 flex items-center justify-between gap-2 ${config.active ? 'bg-secondary-container/10' : 'bg-surface'}`}>
                        <span className={`font-bold capitalize ${config.active ? 'text-primary' : 'text-on-surface-variant'}`}>{day.substring(0,3)}</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={config.active} onChange={() => toggleDay(day)} />
                          <div className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                        </label>
                      </div>
                      
                      {config.active && (
                        <div className="p-4 flex flex-col gap-4 bg-white animate-fadeIn border-t border-outline-variant">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Start Time</span>
                            <input type="time" value={config.start} onChange={e => updateTime(day, 'start', e.target.value)} className="text-[15px] p-2 border border-outline-variant rounded outline-none focus:border-primary text-primary font-mono bg-surface" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">End Time</span>
                            <input type="time" value={config.end} onChange={e => updateTime(day, 'end', e.target.value)} className="text-[15px] p-2 border border-outline-variant rounded outline-none focus:border-primary text-primary font-mono bg-surface" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: PREVIEW */}
            {activeTab === 'preview' && (
              <div className="flex flex-col items-center gap-6">
                <div className="w-full max-w-5xl border-8 border-gray-800 rounded-[20px] overflow-hidden bg-bg-light shadow-2xl relative h-[700px]">
                  {/* Mock browser header */}
                  <div className="bg-gray-800 h-8 w-full flex items-center px-4 gap-2">
                    <div className="w-3 h-3 rounded-full bg-error"></div>
                    <div className="w-3 h-3 rounded-full bg-warning-amber"></div>
                    <div className="w-3 h-3 rounded-full bg-[#4CAF50]"></div>
                  </div>
                  {slug ? (
                    <iframe src={`/lawyers/${slug}`} className="w-full h-[calc(100%-2rem)] border-none bg-white" title="Profile Preview" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-white">
                      <p className="text-on-surface-variant font-medium">Save your profile to generate a preview.</p>
                    </div>
                  )}
                </div>
                {slug && (
                  <button onClick={() => window.open(`/lawyers/${slug}`, '_blank')} className="px-6 py-2 border border-primary text-primary rounded-lg font-label-md text-[13px] font-medium hover:bg-surface-container-low transition-colors shadow-sm flex items-center gap-2">
                    Visit Public Profile <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  </button>
                )}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
};

export default LawyerProfile;
