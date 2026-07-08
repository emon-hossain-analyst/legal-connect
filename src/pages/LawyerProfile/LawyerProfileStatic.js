import React from 'react';

const LawyerProfileStatic = () => {
  return (
    <div className="bg-[#F4F6F9] text-on-surface font-body-md overflow-x-hidden min-h-screen">
      <style>{`
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .serif-text {
            font-family: 'Source Serif 4', Georgia, serif;
        }
        .gold-glow:focus-within {
            box-shadow: 0 0 0 2px #fed977;
        }
      `}</style>

      {/* SideNavBar */}
      <aside className="flex flex-col h-screen fixed left-0 top-0 bg-primary-container dark:bg-primary docked w-64 border-r border-outline-variant shadow-sm z-50">
        <div className="px-6 py-8">
          <h1 className="font-headline-md text-headline-md font-bold text-secondary-container">LegalConnect</h1>
          <p className="text-on-primary-container opacity-80 text-body-sm font-body-sm mt-1">Lawyer Dashboard</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {/* Active Tab: Basic Info */}
          <a className="flex items-center gap-3 px-4 py-3 text-surface-container-lowest font-bold border-l-4 border-secondary-container translate-x-1 transition-transform bg-primary/20 rounded-r-lg" href="#/">
            <span className="material-symbols-outlined" data-icon="person">person</span>
            <span>Basic Info</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-on-primary-container opacity-80 hover:bg-primary hover:text-secondary-container transition-colors rounded-r-lg" href="#/">
            <span className="material-symbols-outlined" data-icon="verified_user">verified_user</span>
            <span>Credentials</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-on-primary-container opacity-80 hover:bg-primary hover:text-secondary-container transition-colors rounded-r-lg" href="#/">
            <span className="material-symbols-outlined" data-icon="check_circle">check_circle</span>
            <span>Verifications</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-on-primary-container opacity-80 hover:bg-primary hover:text-secondary-container transition-colors rounded-r-lg" href="#/">
            <span className="material-symbols-outlined" data-icon="calendar_month">calendar_month</span>
            <span>Availability</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-on-primary-container opacity-80 hover:bg-primary hover:text-secondary-container transition-colors rounded-r-lg" href="#/">
            <span className="material-symbols-outlined" data-icon="settings_accessibility">settings_accessibility</span>
            <span>Consultation Settings</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-on-primary-container opacity-80 hover:bg-primary hover:text-secondary-container transition-colors rounded-r-lg" href="#/">
            <span className="material-symbols-outlined" data-icon="folder_shared">folder_shared</span>
            <span>Portfolio</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-on-primary-container opacity-80 hover:bg-primary hover:text-secondary-container transition-colors rounded-r-lg" href="#/">
            <span className="material-symbols-outlined" data-icon="analytics">analytics</span>
            <span>Analytics</span>
          </a>
        </nav>
        <div className="p-6 mt-auto">
          <button className="w-full py-2.5 px-4 bg-secondary-container text-primary font-bold rounded-lg hover:bg-secondary-fixed transition-all text-label-md">
            Switch to Public View
          </button>
        </div>
      </aside>

      {/* TopNavBar */}
      <header className="flex justify-between items-center w-full px-8 py-3 h-16 ml-64 max-w-[calc(100%-16rem)] border-b border-outline-variant bg-surface sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <h2 className="font-headline-sm text-headline-sm font-bold text-primary">Lawyer Profile Suite</h2>
          <div className="hidden lg:flex items-center gap-4 border-l border-outline-variant pl-6">
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-semibold text-primary">Profile Strength:</span>
              <div className="w-32 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="bg-secondary h-full" style={{width: '78%'}}></div>
              </div>
              <span className="text-body-sm text-secondary font-bold">78% "Professional"</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-full transition-all">
              <span className="material-symbols-outlined" data-icon="notifications">notifications</span>
            </button>
            <button className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-full transition-all">
              <span className="material-symbols-outlined" data-icon="settings">settings</span>
            </button>
          </div>
          <div className="h-8 w-px bg-outline-variant mx-2"></div>
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-full border border-outline-variant overflow-hidden">
              <img alt="Lawyer Account" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDqSNejMelMxYUPKpVtfmj6j8r7dSTRyiAjwQIGORXbMryLJWbUsRq-fbpXcOaQZ4tEfabxIPS98w4R3Jm0CIkmGKUmlh0vqGSt-RpZNT3QpCV49uuwszs27Tx9_EvSK2sfxfvSfxwI-dq3lwVq0P6KBCUSMJZXozVEPpLYd4zp9RxOsvCcMD9l3DkeNTq0skPl1yYH1zqFYLyrpaDe5J6lGw_ibYntlUNrGm7oviSnP7ay4-YfVWgINXKb5PqFAKztdgSzbWG96XAk"/>
            </div>
            <span className="font-label-md text-label-md text-on-surface-variant group-hover:text-primary">Jonathon Sterling</span>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="ml-64 p-8 max-w-[calc(100%-16rem)]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-display-lg text-display-lg text-primary">Basic Information</h3>
              <p className="text-on-surface-variant font-body-md">Update your professional identity and contact details.</p>
            </div>
            <div className="flex gap-3">
              <button className="px-6 py-2 border border-primary text-primary rounded-lg font-label-md hover:bg-surface-container-low transition-colors">Discard</button>
              <button className="px-6 py-2 bg-primary text-white rounded-lg font-label-md hover:bg-secondary transition-colors shadow-sm">Save Changes</button>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-8">
            {/* Left Column: Avatar */}
            <div className="col-span-12 md:col-span-4 space-y-6">
              <div className="bg-white p-8 rounded-xl border border-outline-variant shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col items-center">
                <div className="relative group">
                  <div className="w-48 h-48 rounded-full border-4 border-surface-container overflow-hidden">
                    <img alt="Profile Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBL-PFZpGY-WFldGMdEHrx7C9YfHy3q_tDSbEtwPxK2uQ6Vtu9DB4p33GzOysq7o9v2pwXZ1KA0XP5Du07qdm5KJLXCZ3Q61KyvBpoYrx4DVwqGTxnoX8cPJN5HxxDHGC6fkg08DI8lA3SlCZMfGJrgSV7KnM-lWXHJ80V9ewQetbsznXx7L6Tq6xXIkdwMJ8J0ON9lWSGKyM6YFHYYrdwxMUR8Vt9P0Kfsh5N6jShLm9xklMEP7s3VZ0-6jgCUtAhObCPpgqSpAHIQ"/>
                  </div>
                  <button className="absolute bottom-2 right-2 p-3 bg-secondary-container text-primary rounded-full shadow-lg hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined" data-icon="photo_camera">photo_camera</span>
                  </button>
                </div>
                <div className="mt-6 flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#4CAF50]/15 text-[#4CAF50] rounded-full">
                    <span className="material-symbols-outlined text-[18px]" data-icon="verified" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>
                    <span className="font-label-md text-label-md font-bold uppercase tracking-wider">Verified Professional</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant text-center px-4 mt-2">
                    Member since Jan 2021<br/>
                    Bar Admission: New York State
                  </p>
                </div>
              </div>
              <div className="bg-primary p-6 rounded-xl text-white shadow-lg overflow-hidden relative">
                <div className="relative z-10">
                  <h4 className="font-headline-sm text-headline-sm mb-2">Need assistance?</h4>
                  <p className="text-body-sm opacity-80 mb-4">Our dedicated account managers are available for premium profile optimization.</p>
                  <button className="w-full py-2 bg-secondary-container text-primary font-bold rounded-lg hover:bg-white transition-colors">Contact Support</button>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-10">
                  <span className="material-symbols-outlined text-[120px]" data-icon="gavel">gavel</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LawyerProfileStatic;
