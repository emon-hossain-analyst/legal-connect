import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';

const LegalDocumentsPage = ({ initialTab = 'privacy' }) => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (location.pathname.includes('terms')) setActiveTab('terms');
    else if (location.pathname.includes('cookie')) setActiveTab('cookie');
    else if (location.pathname.includes('privacy')) setActiveTab('privacy');
  }, [location.pathname]);

  const documents = {
    privacy: {
      title: 'Privacy Policy & Data Governance',
      updatedAt: 'July 1, 2026',
      subtitle: 'Committed to total client-lawyer privilege and compliance with Bangladesh Information and Communication Technology (ICT) Act.',
      sections: [
        {
          heading: '1. Information Collection & Verification Data',
          content: 'LegalConnect collects personal identification information (such as National ID cards, Bar Council Enrollment certificates, chamber addresses, and professional history) exclusively for authenticating legal practitioners and maintaining a safe marketplace for clients across Bangladesh.'
        },
        {
          heading: '2. Attorney-Client Confidentiality & Cloud Encryption',
          content: 'All case summaries, legal contracts, consultation recordings, and evidentiary files stored in our secure storage buckets (`case-documents` and `documents`) are protected with strict row-level encryption. Access is strictly limited to the verified client and their formally retained advocate.'
        },
        {
          heading: '3. Financial Transaction Logging & Escrow Security',
          content: 'All financial transactions, consultation fees, and milestone escrow retainers are logged with full audit trails. We do not store raw credit card numbers on our servers; payments are processed securely through regulated payment gateways (bKash, Nagad, Visa/Mastercard).'
        },
        {
          heading: '4. Third-Party Sharing Restrictions',
          content: 'We never sell, rent, or trade client personal data or case details to third parties, advertising networks, or unauthorized agencies under any circumstances.'
        }
      ]
    },
    terms: {
      title: 'Terms of Service & Marketplace Rules',
      updatedAt: 'July 1, 2026',
      subtitle: 'Standard operating framework governing client-advocate engagements, dispute resolution, and escrow milestones.',
      sections: [
        {
          heading: '1. Role of LegalConnect as an Intermediary Platform',
          content: 'LegalConnect provides a digital technology platform enabling verified Bangladesh High Court and District Court advocates to connect with prospective clients. LegalConnect does not itself provide direct legal representation or act as a law firm.'
        },
        {
          heading: '2. Escrow Milestone Obligations & Deliverable Acceptance',
          content: 'When a client funds a legal contract milestone, the funds are held securely in LegalConnect Escrow. Lawyers are obligated to complete deliverables within the agreed timeline. Once deliverables are submitted, clients have 7 business days to inspect and approve the work or request modifications.'
        },
        {
          heading: '3. Professional Conduct Standards & Bar Council Ethics',
          content: 'All participating advocates must strictly adhere to the professional conduct and ethical canons established by the Bangladesh Bar Council. Any lawyer found soliciting illegal activities or engaging in fraudulent representation will face immediate permanent expulsion and legal reporting.'
        },
        {
          heading: '4. Dispute Arbitration & Escrow Release Rules',
          content: 'In the event of an unresolved dispute between client and advocate, either party may invoke LegalConnect Dispute Arbitration via our Help Center (`/help`). Our administrative board will examine the timeline, contract deliverables, and communication logs to issue a binding financial allocation.'
        }
      ]
    },
    cookie: {
      title: 'Cookie Policy & Storage Preferences',
      updatedAt: 'July 1, 2026',
      subtitle: 'How we utilize essential browser cookies and local tokens to secure your authentication sessions and enhance user experience.',
      sections: [
        {
          heading: '1. Essential Authentication & Session Tokens',
          content: 'LegalConnect uses essential secure JWT tokens (`sb-access-token`, `sb-refresh-token`) issued by Supabase to maintain encrypted user login sessions across our client and lawyer portals. These cookies are strictly necessary for platform operation and cannot be disabled.'
        },
        {
          heading: '2. Performance & Realtime Channel Metrics',
          content: 'We utilize anonymous local storage flags to optimize Supabase WebSocket reconnection speeds and cache your dashboard preferences (`drawerTab`, `activeFilter`) so your practice workflow feels instantaneous across page reloads.'
        },
        {
          heading: '3. Zero Third-Party Advertising Cookies',
          content: 'LegalConnect does not deploy third-party tracking pixels, cross-site behavioral retargeting cookies, or social media advertising trackers.'
        }
      ]
    }
  };

  const currentDoc = documents[activeTab] || documents.privacy;

  return (
    <div className="min-h-screen bg-surface-container-lowest py-16 px-4 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="max-w-4xl mx-auto text-center mb-12 animate-fadeIn">
        <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider mb-4">
          Legal Compliance & Governance
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#041635] leading-tight mb-4">
          {currentDoc.title}
        </h1>
        <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto mb-3">
          {currentDoc.subtitle}
        </p>
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Last Updated: {currentDoc.updatedAt}
        </div>

        {/* Document Switcher Tabs */}
        <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-2 bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'privacy' ? 'bg-white text-[#041635] shadow-sm' : 'text-gray-600 hover:text-[#041635]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">privacy_tip</span>
            Privacy Policy
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'terms' ? 'bg-white text-[#041635] shadow-sm' : 'text-gray-600 hover:text-[#041635]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">gavel</span>
            Terms of Service
          </button>
          <button
            onClick={() => setActiveTab('cookie')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'cookie' ? 'bg-white text-[#041635] shadow-sm' : 'text-gray-600 hover:text-[#041635]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">cookie</span>
            Cookie Policy
          </button>
        </div>
      </div>

      {/* Document Content */}
      <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-gray-200 shadow-sm p-8 sm:p-12 mb-20 animate-fadeIn space-y-10">
        {currentDoc.sections.map((sec, index) => (
          <div key={index} className="border-b border-gray-100 pb-8 last:border-b-0 last:pb-0">
            <h3 className="font-serif text-2xl font-bold text-[#041635] mb-3">
              {sec.heading}
            </h3>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              {sec.content}
            </p>
          </div>
        ))}
      </div>

      {/* Footer Support Notice */}
      <div className="max-w-3xl mx-auto text-center bg-gray-50 rounded-2xl p-6 border border-gray-200 text-sm text-gray-600 animate-fadeIn">
        Have specific questions about our data governance or attorney escrow agreements? Contact our compliance officers via the <Link to="/help" className="font-bold text-[#1E6B4A] underline">Help Center</Link>.
      </div>
    </div>
  );
};

export default LegalDocumentsPage;
