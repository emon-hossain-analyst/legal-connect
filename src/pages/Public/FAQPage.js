import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const FAQPage = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [openIndex, setOpenIndex] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const categories = ['All', 'Clients & Consultations', 'Lawyers & Verification', 'Escrow & Payments', 'Security & Privacy'];

  const faqs = [
    {
      category: 'Clients & Consultations',
      question: 'How do I verify that a lawyer on LegalConnect is authentic and licensed?',
      answer: 'Every lawyer listed with a "Verified Advocate" badge on LegalConnect has undergone rigorous background verification by our administrative team. We verify their Bar Council Registration Number, National ID (NID), Academic Credentials, and active status before granting verified status on the platform.'
    },
    {
      category: 'Clients & Consultations',
      question: 'Can I book a consultation online and speak directly via video or chat?',
      answer: 'Yes! You can book secure 30-minute or 60-minute legal consultations directly from a verified lawyer’s profile. Once booked and confirmed, you can use our built-in encrypted messaging and video communication portal (`/lawyer-suite/communication`) without needing third-party software.'
    },
    {
      category: 'Escrow & Payments',
      question: 'How does LegalConnect Escrow protect my consultation fees and retainers?',
      answer: 'When you pay for a legal job or milestone, your funds are securely deposited into LegalConnect Escrow. The lawyer begins work with full assurance that the budget is secured. Funds are only released when the agreed milestones (such as document drafting or court representation checks) are approved by you.'
    },
    {
      category: 'Escrow & Payments',
      question: 'What payment methods are supported for depositing or withdrawing funds?',
      answer: 'Clients can deposit funds using standard debit/credit cards (Visa, Mastercard) and popular Bangladeshi mobile financial services like bKash, Nagad, and Rocket. Lawyers can withdraw their net earnings directly via verified Bank Transfers (AC/IBAN) or Mobile Wallets.'
    },
    {
      category: 'Lawyers & Verification',
      question: 'What is required for lawyers to apply and complete verification?',
      answer: 'To apply as a lawyer (`/register?role=lawyer`), you must provide your full legal name, Bangladesh Bar Council Enrollment number, active Chamber address, a clear NID copy, and professional headshot. Verification is usually completed within 24 to 48 business hours.'
    },
    {
      category: 'Lawyers & Verification',
      question: 'How does the Lawyer Professional Suite help manage active cases?',
      answer: 'Our Lawyer Suite (`/lawyer-suite`) provides a dedicated practice management hub. You can track contracts, break down complex litigation into clear milestones (`CaseMilestones`), upload secure deliverables, schedule appointments, and manage billing seamlessly.'
    },
    {
      category: 'Security & Privacy',
      question: 'Are my confidential legal documents and messages encrypted?',
      answer: 'Yes. All documents uploaded to our cloud storage (`case-documents`, `documents`) are protected with strict Supabase Row-Level Security (RLS) policies. Only the authorized client and the specific assigned lawyer can view or download sensitive legal case files.'
    },
    {
      category: 'Security & Privacy',
      question: 'Can I request a refund if a lawyer cancels or fails to deliver?',
      answer: 'In the rare event that a lawyer is unable to fulfill a scheduled consultation or contract milestone, you can open a dispute via our Help Center (`/help`). Our arbitration team reviews the timeline and escrow logs to process full or partial refunds promptly.'
    }
  ];

  const filteredFaqs = faqs.filter(faq => {
    const matchesCat = activeCategory === 'All' || faq.category === activeCategory;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || faq.question.toLowerCase().includes(searchLower) || faq.answer.toLowerCase().includes(searchLower);
    return matchesCat && matchesSearch;
  });

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest py-16 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-16 animate-fadeIn">
        <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider mb-4">
          Knowledge Base & Support
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#041635] leading-tight mb-4">
          Frequently Asked Questions
        </h1>
        <p className="text-gray-600 text-lg max-w-xl mx-auto">
          Find instant answers to common questions about finding advocates, escrow payments, legal consultations, and account verification.
        </p>

        {/* Search Input */}
        <div className="mt-8 max-w-2xl mx-auto relative">
          <span className="material-symbols-outlined absolute left-4 top-3.5 text-gray-400 text-2xl">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search questions (e.g. escrow, verification, NID, refunds)..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-300 rounded-2xl shadow-sm text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#1E6B4A] transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setOpenIndex(null); }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeCategory === cat
                  ? 'bg-[#041635] text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Accordion List */}
      <div className="max-w-3xl mx-auto space-y-4 mb-20 animate-fadeIn">
        {filteredFaqs.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-500 shadow-sm">
            <span className="material-symbols-outlined text-5xl mb-3 text-gray-300">help_outline</span>
            <h3 className="text-xl font-bold text-gray-700 mb-1">No Matching Questions Found</h3>
            <p className="text-sm">We couldn't find any questions matching your search criteria. Try a different keyword or contact support directly.</p>
          </div>
        ) : (
          filteredFaqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                  isOpen ? 'border-[#1E6B4A] shadow-md' : 'border-gray-200 hover:border-gray-300 shadow-2xs'
                }`}
              >
                <button
                  onClick={() => toggleAccordion(index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 focus:outline-none"
                >
                  <span className="font-serif font-bold text-lg text-[#041635] leading-snug">
                    {faq.question}
                  </span>
                  <span
                    className={`material-symbols-outlined text-2xl transition-transform duration-300 shrink-0 ${
                      isOpen ? 'rotate-180 text-[#1E6B4A]' : 'text-gray-400'
                    }`}
                  >
                    expand_more
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-gray-600 text-sm sm:text-base leading-relaxed border-t border-gray-100 animate-fadeIn">
                    <p>{faq.answer}</p>
                    <div className="mt-3 text-xs font-bold text-[#1E6B4A] uppercase tracking-wider">
                      Category: {faq.category}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Need More Help CTA */}
      <div className="max-w-4xl mx-auto bg-secondary-container/30 rounded-3xl p-8 sm:p-12 border border-secondary/20 text-center animate-fadeIn">
        <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#041635] mb-3">Still Have Questions?</h3>
        <p className="text-gray-600 max-w-xl mx-auto mb-6 text-sm sm:text-base">
          Our dedicated legal support and verification officers are available to assist you via email, live chat, or phone.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/help"
            className="px-6 py-3.5 rounded-xl bg-[#041635] text-white font-bold text-sm shadow-md hover:bg-[#0a2351] transition-all active:scale-95"
          >
            Visit Help Center
          </Link>
          <Link
            to="/lawyers"
            className="px-6 py-3.5 rounded-xl bg-white text-[#1E6B4A] border border-[#1E6B4A] font-bold text-sm hover:bg-green-50 transition-all"
          >
            Find a Verified Lawyer
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FAQPage;
