import React from 'react';

const LawyerDashboardStatic = () => {
  return (
    <div className="bg-background text-on-surface font-body-md selection:bg-secondary-fixed selection:text-on-secondary-fixed overflow-x-hidden">
      <style>{`
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .filled-icon {
            font-variation-settings: 'FILL' 1;
        }
        ::-webkit-scrollbar {
            width: 6px;
        }
        ::-webkit-scrollbar-track {
            background: #f1f1f1;
        }
        ::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
        }
      `}</style>

      {/* Sidebar Component */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-primary dark:bg-primary border-r border-primary-container shadow-lg flex flex-col py-6 z-40 hidden lg:flex">
        <div className="px-6 mb-8">
          <h1 className="font-display-lg text-display-lg text-secondary-fixed">LegalConnect</h1>
          <p className="font-label-md text-label-md text-on-primary-container uppercase tracking-widest mt-1">Professional Suite</p>
        </div>
        <nav className="flex-1 space-y-1">
          {/* Active Tab: Dashboard */}
          <a className="text-white border-l-4 border-secondary-fixed bg-primary-container px-6 py-4 flex items-center gap-3 transition-transform active:translate-x-1" href="#/">
            <span className="material-symbols-outlined filled-icon" data-icon="dashboard">dashboard</span>
            <span className="font-label-md text-label-md uppercase tracking-wider">Dashboard</span>
          </a>
          <a className="text-on-primary-container hover:text-white hover:bg-primary-container/50 px-6 py-4 flex items-center gap-3 transition-all duration-200" href="#/">
            <span className="material-symbols-outlined" data-icon="gavel">gavel</span>
            <span className="font-label-md text-label-md uppercase tracking-wider">Active Cases</span>
          </a>
          <Link to="/lawyer/communication" className="text-on-primary-container hover:text-white hover:bg-primary-container/50 px-6 py-4 flex items-center gap-3 transition-all duration-200">
            <span className="material-symbols-outlined" data-icon="mail">mail</span>
            <span className="font-label-md text-[13px] uppercase tracking-wider">Messages</span>
          </Link>
          <a className="text-on-primary-container hover:text-white hover:bg-primary-container/50 px-6 py-4 flex items-center gap-3 transition-all duration-200" href="#/">
            <span className="material-symbols-outlined" data-icon="calendar_today">calendar_today</span>
            <span className="font-label-md text-label-md uppercase tracking-wider">Calendar</span>
          </a>
          <a className="text-on-primary-container hover:text-white hover:bg-primary-container/50 px-6 py-4 flex items-center gap-3 transition-all duration-200" href="#/">
            <span className="material-symbols-outlined" data-icon="settings">settings</span>
            <span className="font-label-md text-label-md uppercase tracking-wider">Settings</span>
          </a>
        </nav>
        <div className="mt-auto px-6 pt-6 border-t border-primary-container">
          <button className="w-full bg-secondary-fixed text-on-secondary-fixed font-label-md uppercase tracking-widest py-3 rounded-lg flex items-center justify-center gap-2 mb-6 active:scale-95 transition-transform">
            <span className="material-symbols-outlined" data-icon="add">add</span>
            New Case
          </button>
          <div className="space-y-4">
            <a className="text-on-primary-container hover:text-white flex items-center gap-2 font-label-md" href="#/">
              <span className="material-symbols-outlined text-[20px]" data-icon="help">help</span>
              Support
            </a>
            <a className="text-on-primary-container hover:text-white flex items-center gap-2 font-label-md" href="#/">
              <span className="material-symbols-outlined text-[20px]" data-icon="logout">logout</span>
              Sign Out
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="lg:ml-64 min-h-screen">
        {/* Top Navigation Bar */}
        <header className="w-full top-0 sticky z-30 bg-surface-container-lowest border-b border-outline-variant shadow-sm flex justify-between items-center px-8 py-4 max-w-container-max mx-auto">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-primary">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="search">search</span>
              <input className="pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-full w-64 md:w-96 focus:ring-2 focus:ring-secondary focus:outline-none transition-all duration-300 font-body-sm" placeholder="Search case files, clients..." type="text"/>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex gap-8">
              <a className="text-primary font-bold border-b-2 border-secondary pb-1 font-body-md" href="#/">Browse Lawyers</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors duration-200 font-body-md" href="#/">Job Board</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors duration-200 font-body-md" href="#/">Resources</a>
            </div>
            <div className="flex items-center gap-4 border-l border-outline-variant pl-6">
              <button className="relative text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors active:scale-95">
                <span className="material-symbols-outlined" data-icon="notifications">notifications</span>
                <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
              </button>
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="text-right hidden sm:block">
                  <p className="font-headline-sm text-body-sm leading-tight text-primary">Alexander Sterling, Esq.</p>
                  <p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-tighter">Senior Litigation Partner</p>
                </div>
                <img alt="User profile avatar" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfU82_k6ICBAl2r6Sh7M6aDuBU7OFvlkFz3DwdjkeGuKgSqLR7NDIYRflJL2Pn_CnJY4lYXhsYq9D855qgauu-bDkoGIRu0XMVSCAjIN0KaD66r9F3aWnbkIDS_Szw-SmWOx5Fw4zAkmYaSgb0EvXk_g26NQvYPJZuFSoShATavaUFsTFB4ifgLo7Ve2esG8SgV45VhKj6Iu9FPMg3aGbCgdLoF9MF9atgcg1Y_gbB9HlBOnuZFE_HhbwIWEutFuPI9eh5cCs8ynYM"/>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-8 max-w-container-max mx-auto space-y-8">
          {/* Statistics Bar (5 Cards) */}
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary-container text-white rounded-lg">
                  <span className="material-symbols-outlined" data-icon="event_note">event_note</span>
                </div>
                <span className="text-error text-xs font-bold">+2 today</span>
              </div>
              <p className="text-display-lg font-display-lg text-primary">12</p>
              <p className="text-on-surface-variant text-body-sm font-medium">Active Appointments</p>
            </div>
            
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-secondary text-white rounded-lg">
                  <span className="material-symbols-outlined" data-icon="folder_shared">folder_shared</span>
                </div>
                <span className="text-on-secondary-container text-xs font-bold">87% Progress</span>
              </div>
              <p className="text-display-lg font-display-lg text-primary">48</p>
              <p className="text-on-surface-variant text-body-sm font-medium">Open Cases</p>
            </div>
            
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-on-tertiary-container text-white rounded-lg">
                  <span className="material-symbols-outlined" data-icon="contract_edit">contract_edit</span>
                </div>
              </div>
              <p className="text-display-lg font-display-lg text-primary">07</p>
              <p className="text-on-surface-variant text-body-sm font-medium">Pending Proposals</p>
            </div>
            
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary text-white rounded-lg">
                  <span className="material-symbols-outlined" data-icon="chat_bubble">chat_bubble</span>
                </div>
                <span className="bg-error text-white text-[10px] px-2 py-0.5 rounded-full font-bold">NEW</span>
              </div>
              <p className="text-display-lg font-display-lg text-primary">23</p>
              <p className="text-on-surface-variant text-body-sm font-medium">Unread Messages</p>
            </div>
            
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-secondary-container text-on-secondary-container rounded-lg">
                  <span className="material-symbols-outlined filled-icon" data-icon="star">star</span>
                </div>
                <span className="text-on-surface-variant text-xs font-bold">124 Reviews</span>
              </div>
              <p className="text-display-lg font-display-lg text-primary">4.9</p>
              <p className="text-on-surface-variant text-body-sm font-medium">Avg Rating</p>
            </div>
          </section>

          {/* Three-Column Main Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Column 1: Today's Schedule */}
            <div className="lg:col-span-4 bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
                <h3 className="font-headline-md text-headline-md text-primary">Today's Schedule</h3>
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Oct 24, 2024</span>
              </div>
              <div className="p-0 overflow-y-auto max-h-[600px]">
                {/* Time Slot 1 */}
                <div className="flex gap-4 p-6 border-b border-outline-variant/50 hover:bg-surface-container-low/20 transition-colors">
                  <div className="flex flex-col items-center w-16">
                    <span className="font-bold text-primary text-body-md">09:00</span>
                    <span className="text-[10px] uppercase font-bold text-outline">AM</span>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <img alt="Client Avatar" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5un5oFby-DgkuhnQVHeHkT5UZ9cvi5-RUGp_gA7aVfw9rwqd4sr7EFE-00SNeTE8acmKLFEKfPk4U9Wxf4viWmr2ZpGrJHqJ1zkO_CCBMDvzXt0kt0HUCLBhUkjs6WdcQMD7cobeP_aEf8kxbgBGnv0ykuVTel-7CuMsYgqjZEHSzd0CnPy20GZIB1_JdTCaYOFWQk4fXtnZJl8S-4-5nGCQyFomcOleiExM_lhgc9PQjVDNqMV_flaFekNqxIgRr1ewaa0ug3eMz"/>
                      <div>
                        <h4 className="font-headline-sm text-body-md text-primary">Elena Rodriguez</h4>
                        <p className="text-xs text-on-surface-variant">Consultation: Real Estate Trust</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 py-1.5 bg-primary text-white text-[11px] font-bold uppercase tracking-widest rounded transition-colors hover:bg-secondary">Confirm</button>
                      <button className="flex-1 py-1.5 border border-primary text-primary text-[11px] font-bold uppercase tracking-widest rounded hover:bg-surface-container transition-colors">Reschedule</button>
                    </div>
                  </div>
                </div>

                {/* Time Slot 2 */}
                <div className="flex gap-4 p-6 border-b border-outline-variant/50 hover:bg-surface-container-low/20 transition-colors bg-secondary-fixed/5">
                  <div className="flex flex-col items-center w-16">
                    <span className="font-bold text-primary text-body-md">11:30</span>
                    <span className="text-[10px] uppercase font-bold text-outline">AM</span>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <img alt="Client Avatar" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAx-Pd2tMAVxzFP6nHOJV-0tIbS1Wg0pkDjq9p8nKdnq25wi5HshvlF4CZ4oP-hXTBtuq-F3GEwDAh2zzUVZZbnAzEjbF1LVo0uMK1mUtDl7U0paBzjq57Td83-b-eTBntEdoVWcCP57xWRLg_kVekqDGw7GHtTKCnzFCpZGg3aDZa79An0-IdnPjHc6n_PfyoscGsCFkIXIDKR9fy_whg1lKzTJDK6ZE89Ly_GRvIP_W9RSlMxAXhXvVqVgq_YjiN8f_M_dVX921w5"/>
                      <div>
                        <h4 className="font-headline-sm text-body-md text-primary">Marcus Vane</h4>
                        <p className="text-xs text-on-surface-variant">Review: Corporate Merger</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 py-1.5 bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold uppercase tracking-widest rounded transition-transform active:scale-95">Complete</button>
                      <button className="p-2 border border-outline text-outline rounded hover:bg-white transition-colors">
                        <span className="material-symbols-outlined text-[16px]" data-icon="videocam">videocam</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Time Slot 3 */}
                <div className="flex gap-4 p-6 border-b border-outline-variant/50 hover:bg-surface-container-low/20 transition-colors opacity-60">
                  <div className="flex flex-col items-center w-16">
                    <span className="font-bold text-primary text-body-md">02:45</span>
                    <span className="text-[10px] uppercase font-bold text-outline">PM</span>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <img alt="Client Avatar" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBwUQxtli5QagmXO0WI23G4g4Lw0XVT8_gFcYU-u9fJ9UsEqbty3gxp0PSrk2VbA-nsMol8JZd3UR-voVL3XB2V8N-etGy3hoYzX13yHg--XV-DbQKMu5KoJjl2uqALNuYr7jq_HjLJxaF35tX-4FBjlTQY3bKhHUlgIncC4k7QPvyTIwkuZA1P9_0J1TrD3iP2na-BO4lJJt3KWusQkI0KEYYqywLYffj-u3ExDftg7SIbcBvb1vHm4n8Ou3UmPL-vjhWZnRojveMo"/>
                      <div>
                        <h4 className="font-headline-sm text-body-md text-primary">Julian Thorne</h4>
                        <p className="text-xs text-on-surface-variant">Drafting: Commercial Lease</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Active Cases */}
            <div className="lg:col-span-5 bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm">
              <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
                <h3 className="font-headline-md text-headline-md text-primary">Active Case Progress</h3>
                <div className="flex gap-2">
                  <button className="p-1 text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">filter_list</span></button>
                  <button className="p-1 text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">sort</span></button>
                </div>
              </div>
              <div className="p-6 space-y-8">
                {/* Case item 1 */}
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-headline-sm text-body-md text-primary">Acme Corp vs. OmniDynamics</h4>
                      <p className="text-xs text-on-surface-variant font-medium">Lead: Marcus Vane | Case ID: #4492-B</p>
                    </div>
                    <span className="bg-success/15 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-green-700/20">IN PROGRESS</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-bold text-on-surface-variant">
                      <span>Milestone: Discovery Phase</span>
                      <span>75%</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div className="bg-secondary h-2 rounded-full" style={{width: '75%'}}></div>
                    </div>
                  </div>
                  <button className="w-full py-2 border border-outline text-primary font-bold text-xs uppercase tracking-widest rounded hover:bg-secondary-fixed transition-colors">Update Milestone</button>
                </div>

                {/* Case item 2 */}
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-headline-sm text-body-md text-primary">Thorne Family Trust Settlement</h4>
                      <p className="text-xs text-on-surface-variant font-medium">Lead: Julian Thorne | Case ID: #5501-A</p>
                    </div>
                    <span className="bg-warning/15 text-secondary text-[10px] px-2 py-0.5 rounded-full font-bold border border-secondary/20">AT RISK</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-bold text-on-surface-variant">
                      <span>Milestone: Asset Valuation</span>
                      <span>32%</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div className="bg-error h-2 rounded-full" style={{width: '32%'}}></div>
                    </div>
                  </div>
                  <button className="w-full py-2 border border-outline text-primary font-bold text-xs uppercase tracking-widest rounded hover:bg-secondary-fixed transition-colors">Update Milestone</button>
                </div>

                {/* Case item 3 */}
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-headline-sm text-body-md text-primary">Rodriguez Property Litigation</h4>
                      <p className="text-xs text-on-surface-variant font-medium">Lead: Elena Rodriguez | Case ID: #2281-Z</p>
                    </div>
                    <span className="bg-primary-container/10 text-primary-container text-[10px] px-2 py-0.5 rounded-full font-bold border border-primary-container/20">REVIEW</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-bold text-on-surface-variant">
                      <span>Milestone: Initial Filing</span>
                      <span>95%</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div className="bg-secondary h-2 rounded-full" style={{width: '95%'}}></div>
                    </div>
                  </div>
                  <button className="w-full py-2 border border-outline text-primary font-bold text-xs uppercase tracking-widest rounded hover:bg-secondary-fixed transition-colors">Update Milestone</button>
                </div>
              </div>
            </div>

            {/* Column 3: Stacked Widgets */}
            <div className="lg:col-span-3 space-y-8 h-full">
              {/* Widget: Pending Proposals */}
              <div className="bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm">
                <div className="p-4 border-b border-outline-variant bg-surface-container-low/30">
                  <h3 className="font-headline-sm text-body-md text-primary">Pending Proposals</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="p-3 bg-surface-container-low rounded border-l-4 border-secondary-fixed">
                    <h5 className="text-[13px] font-bold text-primary">Solaris Tech IP Audit</h5>
                    <p className="text-[11px] text-on-surface-variant mt-1">Expiring in 2 days</p>
                    <div className="mt-2 flex justify-end">
                      <button className="text-[11px] font-bold text-secondary uppercase">Remind Client</button>
                    </div>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded border-l-4 border-secondary-fixed">
                    <h5 className="text-[13px] font-bold text-primary">WestSide Estate Plan</h5>
                    <p className="text-[11px] text-on-surface-variant mt-1">Sent 3h ago</p>
                  </div>
                </div>
              </div>

              {/* Widget: Recent Notifications */}
              <div className="bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm">
                <div className="p-4 border-b border-outline-variant bg-surface-container-low/30 flex justify-between items-center">
                  <h3 className="font-headline-sm text-body-md text-primary">Notifications</h3>
                  <a className="text-[10px] font-bold text-on-surface-variant hover:text-primary" href="#/">CLEAR ALL</a>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-error-container/20 text-error flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">priority_high</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-primary">Missed Document Filing</p>
                      <p className="text-[11px] text-on-surface-variant">The court rejected exhibit B-12 for Thorne Case.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-secondary-fixed/20 text-secondary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">payments</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-primary">Payment Received</p>
                      <p className="text-[11px] text-on-surface-variant">Invoice #8821 paid by Acme Corp (BDT 4,250.00)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Promo Card */}
              <div className="relative bg-primary overflow-hidden rounded-lg p-6 group cursor-pointer">
                <div className="relative z-10 text-white">
                  <h4 className="font-headline-sm text-headline-sm mb-2 text-secondary-fixed">Pro Insights</h4>
                  <p className="text-xs text-on-primary-container leading-relaxed">Your billable efficiency is up 14% this month. See how you compare to peers.</p>
                  <button className="mt-4 text-xs font-bold uppercase tracking-widest border-b border-secondary-fixed text-secondary-fixed pb-0.5">Explore Analytics</button>
                </div>
              </div>
            </div>
          </section>

          {/* Earnings Summary Full-Width Bar */}
          <section className="bg-primary-container text-white p-8 rounded-lg shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
              <div className="space-y-2 text-center md:text-left">
                <h3 className="font-headline-md text-headline-md text-secondary-fixed">Earnings Summary</h3>
                <p className="text-on-primary-container text-body-sm">Rolling 6-month performance review</p>
                <div className="pt-4">
                  <span className="text-display-lg font-display-lg">BDT 142,850</span>
                  <span className="ml-2 text-green-400 text-sm font-bold flex items-center inline-flex">
                    <span className="material-symbols-outlined text-sm">arrow_upward</span> 12.5%
                  </span>
                </div>
              </div>

              {/* CSS Bar Chart */}
              <div className="flex items-end gap-3 md:gap-6 h-32 flex-1 max-w-lg">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-white/10 rounded-t-sm relative group">
                    <div className="bg-secondary-fixed w-full rounded-t-sm transition-all duration-1000 ease-out" style={{height: '40%'}}></div>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-primary text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">BDT 12k</div>
                  </div>
                  <span className="text-[10px] font-bold text-on-primary-container uppercase">May</span>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-white/10 rounded-t-sm relative group">
                    <div className="bg-secondary-fixed w-full rounded-t-sm transition-all duration-1000 ease-out" style={{height: '55%'}}></div>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-primary text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">BDT 18k</div>
                  </div>
                  <span className="text-[10px] font-bold text-on-primary-container uppercase">Jun</span>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-white/10 rounded-t-sm relative group">
                    <div className="bg-secondary-fixed w-full rounded-t-sm transition-all duration-1000 ease-out" style={{height: '70%'}}></div>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-primary text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">BDT 22k</div>
                  </div>
                  <span className="text-[10px] font-bold text-on-primary-container uppercase">Jul</span>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-white/10 rounded-t-sm relative group">
                    <div className="bg-secondary-fixed w-full rounded-t-sm transition-all duration-1000 ease-out" style={{height: '65%'}}></div>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-primary text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">BDT 21k</div>
                  </div>
                  <span className="text-[10px] font-bold text-on-primary-container uppercase">Aug</span>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-white/10 rounded-t-sm relative group">
                    <div className="bg-secondary-fixed w-full rounded-t-sm transition-all duration-1000 ease-out" style={{height: '85%'}}></div>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-primary text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">BDT 28k</div>
                  </div>
                  <span className="text-[10px] font-bold text-on-primary-container uppercase">Sep</span>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-white/10 rounded-t-sm relative group">
                    <div className="bg-white w-full rounded-t-sm transition-all duration-1000 ease-out" style={{height: '100%'}}></div>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-primary text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">BDT 34k</div>
                  </div>
                  <span className="text-[10px] font-bold text-white uppercase">Oct</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Component */}
        <footer className="w-full py-8 mt-section-margin bg-surface-container-low border-t border-outline-variant">
          <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-container-max mx-auto gap-4">
            <div className="flex flex-col items-center md:items-start gap-1">
              <span className="font-headline-sm text-headline-sm text-primary">LegalConnect</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">© 2024 LegalConnect. All rights reserved.</p>
            </div>
            <div className="flex gap-8">
              <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary hover:underline underline-offset-4 transition-opacity" href="#/">Privacy</a>
              <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary hover:underline underline-offset-4 transition-opacity" href="#/">Terms</a>
              <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary hover:underline underline-offset-4 transition-opacity" href="#/">Support</a>
            </div>
          </div>
        </footer>
      </main>

      {/* Mobile Bottom Navigation (Visible on mobile only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant flex justify-around py-3 px-2 z-50">
        <button className="flex flex-col items-center gap-1 text-primary">
          <span className="material-symbols-outlined filled-icon">dashboard</span>
          <span className="text-[10px] font-bold uppercase">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined">gavel</span>
          <span className="text-[10px] font-bold uppercase">Cases</span>
        </button>
        <Link to="/lawyer/communication" className="flex flex-col items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined">mail</span>
          <span className="text-[10px] font-bold uppercase">Inbox</span>
        </Link>
        <button className="flex flex-col items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined">calendar_today</span>
          <span className="text-[10px] font-bold uppercase">Events</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px] font-bold uppercase">Profile</span>
        </button>
      </nav>
    </div>
  );
};

export default LawyerDashboardStatic;
