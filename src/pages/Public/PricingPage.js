import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const PricingPage = () => {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'

  const plans = [
    {
      name: 'Client Standard',
      badge: 'For Individuals & Families',
      priceMonthly: 0,
      priceAnnual: 0,
      description: 'Free access to find verified lawyers, post legal jobs, and book secure consultations.',
      features: [
        'Browse 500+ Verified Bangladesh Lawyers',
        'Post up to 5 Public Legal Jobs / month',
        'Direct Messaging & Video Consultations',
        'Secure Escrow Milestone Payments',
        'Standard Email & Chat Support'
      ],
      ctaText: 'Find a Lawyer Now',
      ctaLink: '/lawyers',
      highlighted: false
    },
    {
      name: 'Lawyer Professional Suite',
      badge: 'Most Popular for Advocates',
      priceMonthly: 2500,
      priceAnnual: 2000,
      description: 'Complete practice management suite for solo advocates and legal consultants.',
      features: [
        'Verified Advocate Profile Badge & Boosted Search',
        'Unlimited Direct Client Consultations & Proposals',
        'Built-in Case & Milestone Management Workflow',
        'Dedicated Client Portal & Shared Document Cloud',
        'Automated Invoicing & Direct Bank Payouts (0% extra commission)',
        'Priority 24/7 Phone & Email Verification Support'
      ],
      ctaText: 'Start 30-Day Free Trial',
      ctaLink: '/register?role=lawyer',
      highlighted: true
    },
    {
      name: 'Corporate & Law Firm Enterprise',
      badge: 'For Law Firms & Businesses',
      priceMonthly: 8500,
      priceAnnual: 7000,
      description: 'Multi-lawyer firm collaboration, custom contract review templates, and dedicated account manager.',
      features: [
        'Everything in Professional Suite for up to 10 Lawyers',
        'Firm-wide Unified Case & Client Document Repository',
        'Custom Legal Retainer & Multi-currency Escrow Workflows',
        'Advanced Analytics & Revenue Forecasting Dashboard',
        'Dedicated Account Manager & Legal Compliance Audit'
      ],
      ctaText: 'Contact Enterprise Sales',
      ctaLink: '/help',
      highlighted: false
    }
  ];

  return (
    <div className="min-h-screen bg-surface-container-lowest py-16 px-4 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <div className="max-w-4xl mx-auto text-center mb-16 animate-fadeIn">
        <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider mb-4">
          Transparent Legal Fees & Subscriptions
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-[#041635] leading-tight mb-6">
          Invest in Premium Legal Practice & Representation
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Whether you are a client seeking trusted advocates or a legal professional scaling your practice across Bangladesh, our transparent pricing ensures total confidence.
        </p>

        {/* Billing Toggle */}
        <div className="mt-10 inline-flex items-center bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
              billingCycle === 'monthly'
                ? 'bg-white text-[#041635] shadow-sm'
                : 'text-gray-600 hover:text-[#041635]'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 ${
              billingCycle === 'annual'
                ? 'bg-[#1E6B4A] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#041635]'
            }`}
          >
            <span>Annual Billing</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-[#041635] text-[10px] font-extrabold uppercase">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-20 animate-fadeIn">
        {plans.map((plan, i) => (
          <div
            key={plan.name}
            className={`rounded-3xl p-8 sm:p-10 flex flex-col justify-between transition-all duration-300 relative ${
              plan.highlighted
                ? 'bg-[#041635] text-white shadow-2xl scale-105 border-2 border-amber-400/40 z-10'
                : 'bg-white text-gray-900 border border-gray-200 shadow-md hover:shadow-xl'
            }`}
          >
            {plan.highlighted && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-[#041635] text-xs font-extrabold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md">
                Recommended Choice
              </div>
            )}

            <div>
              <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${plan.highlighted ? 'text-amber-400' : 'text-[#1E6B4A]'}`}>
                {plan.badge}
              </div>
              <h3 className="font-serif text-2xl sm:text-3xl font-bold mb-4">{plan.name}</h3>
              <p className={`text-sm leading-relaxed mb-6 ${plan.highlighted ? 'text-gray-300' : 'text-gray-600'}`}>
                {plan.description}
              </p>

              {/* Price Display */}
              <div className="mb-8 border-b border-gray-200/20 pb-6">
                <span className="font-serif text-4xl sm:text-5xl font-extrabold">
                  {plan.priceMonthly === 0
                    ? 'Free'
                    : `BDT ${(billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly).toLocaleString()}`}
                </span>
                {plan.priceMonthly > 0 && (
                  <span className={`text-sm font-medium ml-2 ${plan.highlighted ? 'text-gray-300' : 'text-gray-500'}`}>
                    / month {billingCycle === 'annual' && '(billed annually)'}
                  </span>
                )}
              </div>

              {/* Features List */}
              <ul className="space-y-3.5 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm">
                    <span className={`material-symbols-outlined text-[20px] shrink-0 ${plan.highlighted ? 'text-amber-400' : 'text-[#1E6B4A]'}`}>
                      check_circle
                    </span>
                    <span className={plan.highlighted ? 'text-gray-200' : 'text-gray-700'}>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              to={plan.ctaLink}
              className={`w-full py-4 rounded-xl font-bold text-center transition-all shadow-md flex items-center justify-center gap-2 ${
                plan.highlighted
                  ? 'bg-amber-400 text-[#041635] hover:bg-amber-300 active:scale-95'
                  : 'bg-[#1E6B4A] text-white hover:bg-[#165138] active:scale-95'
              }`}
            >
              <span>{plan.ctaText}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>
        ))}
      </div>

      {/* Trust & Escrow Guarantee */}
      <div className="max-w-5xl mx-auto bg-primary/5 rounded-3xl p-8 sm:p-12 border border-primary/20 flex flex-col md:flex-row items-center gap-8 animate-fadeIn">
        <div className="p-4 bg-white rounded-2xl shadow-sm text-[#1E6B4A] shrink-0">
          <span className="material-symbols-outlined text-5xl">shield_locked</span>
        </div>
        <div>
          <h3 className="font-serif text-2xl font-bold text-[#041635] mb-2">100% Secure Milestone & Escrow Protection</h3>
          <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
            All consultation fees and case retainers are held safely in LegalConnect Escrow. Payments are only released to advocates when agreed milestones and deliverables are completed and approved. We guarantee total financial transparency and dispute protection under Bangladesh Contract Laws.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
