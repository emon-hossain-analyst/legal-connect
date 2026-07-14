import React from 'react';
import { Link } from 'react-router-dom';

const LawyerVerificationInfoPage = () => {
  const steps = [
    {
      number: '01',
      title: 'Bar Council Enrollment & License Verification',
      desc: 'We cross-reference every applicant’s Enrollment Number directly against official records maintained by the Bangladesh Bar Council and respective High Court/District Court Bar Associations.'
    },
    {
      number: '02',
      title: 'National Identity Card (NID) & Biometric Check',
      desc: 'Advocates must submit a high-resolution color copy of their government-issued National ID Card (`NID`) along with a live biometric headshot to guarantee authentic identity match.'
    },
    {
      number: '03',
      title: 'Chamber Address & Chamber Registration Validation',
      desc: 'Our verification officers verify the active chamber location and office address where the advocate practices, ensuring clients can safely conduct in-person consultations when required.'
    },
    {
      number: '04',
      title: 'Academic & Professional Credentials Audit',
      desc: 'We verify LL.B / LL.M academic certificates and review ongoing practice milestones. Only advocates meeting high ethical standards receive the coveted "Verified Advocate" badge.'
    }
  ];

  const benefits = [
    {
      title: 'Verified Profile Shield Badge',
      desc: 'Instantly build trust with prospective clients through our prominent green shield badge displayed across search results and your profile.'
    },
    {
      title: 'Priority Search Visibility Boost',
      desc: 'Verified advocates receive top tier ranking in practice area searches across all 64 districts in Bangladesh.'
    },
    {
      title: 'Direct Escrow & 0% Payout Commission',
      desc: 'Gain full access to LegalConnect Escrow retainers and direct bank withdrawal processing with zero hidden platform transaction markups.'
    }
  ];

  return (
    <div className="min-h-screen bg-surface-container-lowest py-16 px-4 sm:px-6 lg:px-8">
      {/* Hero Banner */}
      <div className="max-w-4xl mx-auto text-center mb-16 animate-fadeIn">
        <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider mb-4">
          Strict Security & Credibility Standards
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-[#041635] leading-tight mb-6">
          The LegalConnect Verification Process
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          How we ensure that every advocate listed on our marketplace is a legitimate, licensed, and highly ethical member of the Bangladesh Bar Council.
        </p>
      </div>

      {/* 4-Step Process Timeline */}
      <div className="max-w-5xl mx-auto mb-20 animate-fadeIn">
        <h2 className="font-serif text-3xl font-bold text-[#041635] text-center mb-12">Our 4-Stage Verification Protocol</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
              <div className="absolute top-4 right-6 text-6xl font-serif font-extrabold text-[#1E6B4A]/10 select-none">
                {step.number}
              </div>
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#1E6B4A] text-white font-bold text-lg flex items-center justify-center mb-6 shadow-md">
                  {step.number}
                </div>
                <h3 className="font-serif text-2xl font-bold text-[#041635] mb-3">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Why Get Verified Benefits */}
      <div className="max-w-6xl mx-auto bg-[#041635] text-white rounded-3xl p-8 sm:p-12 mb-20 shadow-xl animate-fadeIn">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <span className="text-amber-400 font-bold text-xs uppercase tracking-widest">Advocate Growth Advantage</span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold mt-2">Why Top Bangladesh Advocates Get Verified</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {benefits.map((b, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10">
              <span className="material-symbols-outlined text-amber-400 text-3xl mb-4">verified</span>
              <h3 className="font-bold text-xl mb-2">{b.title}</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto text-center animate-fadeIn">
        <h3 className="font-serif text-3xl font-bold text-[#041635] mb-4">Ready to Submit Your Verification Documents?</h3>
        <p className="text-gray-600 max-w-xl mx-auto mb-8">
          Join hundreds of top tier verified advocates expanding their digital practice across Dhaka, Chattogram, Sylhet, and beyond.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/register?role=lawyer"
            className="px-8 py-4 rounded-xl bg-[#1E6B4A] text-white font-bold text-sm shadow-lg hover:bg-[#165138] transition-all active:scale-95"
          >
            Apply for Verification Now
          </Link>
          <Link
            to="/faq"
            className="px-8 py-4 rounded-xl bg-gray-100 text-[#041635] font-bold text-sm hover:bg-gray-200 transition-all"
          >
            Read Verification FAQ
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LawyerVerificationInfoPage;
