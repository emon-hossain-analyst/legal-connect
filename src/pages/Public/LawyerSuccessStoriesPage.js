import React from 'react';
import { Link } from 'react-router-dom';

const LawyerSuccessStoriesPage = () => {
  const stories = [
    {
      name: 'Advocate Barrister Rashedul Islam',
      chamber: 'Supreme Court of Bangladesh & Supreme Law Chamber, Dhaka',
      practice: 'Corporate & Commercial Law',
      quote: 'LegalConnect transformed how our chamber acquires corporate clients across Dhaka and Chattogram. By utilizing the structured milestone contracts and escrow protection, we secured over 45 high-value corporate retainers in our first six months with zero fee disputes.',
      stats: { cases: '120+ Cases Managed', earnings: '350% Retainer Growth' },
      badge: 'Supreme Court Bar Association'
    },
    {
      name: 'Advocate Farhana Yeasmin',
      chamber: 'District & Sessions Judge Court, Chattogram',
      practice: 'Family & Property Law',
      quote: 'As a solo female practitioner specializing in family dispute resolution, LegalConnect gave me the digital visibility and secure video consultation portal I needed. Clients appreciate the transparent fee structure, and I can manage my entire caseload right from my tablet.',
      stats: { cases: '210+ Consultations', earnings: '100% On-Time Payouts' },
      badge: 'Chattogram Bar Association'
    },
    {
      name: 'Advocate Kazi Tanvir Ahmed',
      chamber: 'Sylhet Judge Court & Tanvir Associates',
      practice: 'Immigration & Land Litigation',
      quote: 'Many of our expatriate Bangladeshi clients (Probashi) reside in the UK and Middle East. LegalConnect allowed us to share legal documents securely and receive direct international payments through the platform escrow without the friction of traditional bank delays.',
      stats: { cases: '85+ Expatriate Clients', earnings: 'Zero Payment Delay' },
      badge: 'Sylhet District Bar Association'
    }
  ];

  return (
    <div className="min-h-screen bg-surface-container-lowest py-16 px-4 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <div className="max-w-4xl mx-auto text-center mb-16 animate-fadeIn">
        <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider mb-4">
          Verified Advocate Impact Reports
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-[#041635] leading-tight mb-6">
          Empowering Bangladesh's Leading Advocates
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Discover how verified high court and district court advocates use LegalConnect to streamline practice management, guarantee secure payments, and serve clients nationwide.
        </p>
      </div>

      {/* Stories Grid */}
      <div className="max-w-6xl mx-auto space-y-12 mb-20 animate-fadeIn">
        {stories.map((s, idx) => (
          <div key={idx} className="bg-white rounded-3xl p-8 sm:p-12 border border-gray-200 shadow-sm hover:shadow-xl transition-all grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-[#1E6B4A] border border-green-200 rounded-full text-xs font-bold uppercase">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                {s.badge}
              </div>
              <blockquote className="font-serif text-xl sm:text-2xl text-gray-800 leading-relaxed italic">
                "{s.quote}"
              </blockquote>
              <div>
                <h3 className="font-bold text-lg text-[#041635]">{s.name}</h3>
                <p className="text-sm text-gray-500 font-medium">{s.chamber}</p>
                <div className="text-xs font-bold text-[#1E6B4A] mt-1">Practice Area: {s.practice}</div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 sm:p-8 rounded-2xl border border-gray-200 flex flex-col justify-center space-y-6 text-center">
              <div>
                <div className="font-serif text-2xl font-bold text-[#041635]">{s.stats.cases}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Volume Processed</div>
              </div>
              <div className="border-t border-gray-200 pt-6">
                <div className="font-serif text-2xl font-bold text-[#1E6B4A]">{s.stats.earnings}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Practice Efficiency</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA Footer */}
      <div className="max-w-4xl mx-auto bg-[#041635] text-white rounded-3xl p-10 sm:p-14 text-center shadow-2xl animate-fadeIn">
        <span className="material-symbols-outlined text-amber-400 text-5xl mb-4">balance</span>
        <h3 className="font-serif text-3xl sm:text-4xl font-bold mb-4">Start Your LegalConnect Success Story</h3>
        <p className="text-gray-300 max-w-xl mx-auto mb-8 text-sm sm:text-base">
          Apply today to complete your Bar Council verification and join the premier digital legal marketplace across Bangladesh.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/register?role=lawyer"
            className="px-8 py-4 rounded-xl bg-amber-400 text-[#041635] font-bold text-sm shadow-lg hover:bg-amber-300 transition-all active:scale-95"
          >
            Register as an Advocate
          </Link>
          <Link
            to="/lawyers/verification-info"
            className="px-8 py-4 rounded-xl bg-white/10 text-white border border-white/20 font-bold text-sm hover:bg-white/20 transition-all"
          >
            View Verification Checklist
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LawyerSuccessStoriesPage;
