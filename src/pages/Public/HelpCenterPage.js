import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const HelpCenterPage = () => {
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketEmail, setTicketEmail] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Escrow Dispute');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const supportChannels = [
    {
      icon: 'support_agent',
      title: '24/7 Live Verification Desk',
      desc: 'Get instant answers regarding NID, Bar Council checks, and chamber address verification.',
      actionText: 'Chat with Support Desk',
      link: '/faq'
    },
    {
      icon: 'gavel',
      title: 'Escrow Dispute Arbitration',
      desc: 'Our legal arbitration team mediates disputes over milestone deliverables and refund requests.',
      actionText: 'Submit Arbitration Claim',
      link: '#contact-form'
    },
    {
      icon: 'verified_user',
      title: 'Lawyer Chamber Verification',
      desc: 'Questions about professional credentials boost, verification tags, or annual chamber renewals.',
      actionText: 'View Verification Guide',
      link: '/lawyers/verification-info'
    }
  ];

  const handleTicketSubmit = (e) => {
    e.preventDefault();
    if (!ticketSubject || !ticketEmail || !ticketMessage) {
      toast.error('Please fill in all required support fields.');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      toast.success('Your support request (#LC-8492) has been logged. Our officers will respond within 6 hours.');
      setTicketSubject('');
      setTicketEmail('');
      setTicketMessage('');
      setSubmitting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest py-16 px-4 sm:px-6 lg:px-8">
      {/* Hero Banner */}
      <div className="max-w-4xl mx-auto text-center mb-16 animate-fadeIn">
        <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider mb-4">
          LegalConnect Support Desk
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-[#041635] leading-tight mb-4">
          How Can We Assist Your Legal Journey?
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          From finding the right high court advocate to mediating escrow transactions, our legal operations team is here to protect your rights.
        </p>
      </div>

      {/* Quick Action Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 animate-fadeIn">
        {supportChannels.map((c, idx) => (
          <div key={idx} className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-[#1E6B4A]/10 text-[#1E6B4A] flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-3xl">{c.icon}</span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#041635] mb-3">{c.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">{c.desc}</p>
            </div>
            <Link
              to={c.link}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#1E6B4A] hover:text-[#165138] transition-colors"
            >
              <span>{c.actionText}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>
        ))}
      </div>

      {/* Support Ticket Form Section */}
      <div id="contact-form" className="max-w-4xl mx-auto bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden animate-fadeIn mb-20">
        <div className="bg-[#041635] p-8 sm:p-10 text-white">
          <h2 className="font-serif text-3xl font-bold mb-2">Open an Official Support or Dispute Ticket</h2>
          <p className="text-gray-300 text-sm">
            All inquiries are assigned a unique tracking number (`#LC-XXXX`) and reviewed directly by legal operations officers.
          </p>
        </div>

        <form onSubmit={handleTicketSubmit} className="p-8 sm:p-10 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Your Email Address *</label>
              <input
                type="email"
                required
                value={ticketEmail}
                onChange={(e) => setTicketEmail(e.target.value)}
                placeholder="client.or.lawyer@example.com"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E6B4A] text-sm text-gray-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Support Category *</label>
              <select
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E6B4A] text-sm font-bold text-gray-800"
              >
                <option value="Escrow Dispute">Escrow Milestone Dispute</option>
                <option value="Chamber Verification">Lawyer Chamber & NID Verification</option>
                <option value="Billing & Payouts">Billing & Withdrawal Request</option>
                <option value="Technical Support">Technical Account / Video Consultation Issue</option>
                <option value="General Legal Inquiry">General Platform Guidance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Subject Summary *</label>
            <input
              type="text"
              required
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              placeholder="e.g. Requesting milestone deadline extension or verification badge review..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E6B4A] text-sm text-gray-800 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Detailed Description & Timeline *</label>
            <textarea
              rows="5"
              required
              value={ticketMessage}
              onChange={(e) => setTicketMessage(e.target.value)}
              placeholder="Provide exact case references, contract IDs, or details of the assistance required..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E6B4A] text-sm text-gray-800 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-400">
              Response time: <span className="font-bold text-gray-600">&lt; 6 hours</span> on business days.
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3.5 rounded-xl bg-[#1E6B4A] text-white font-bold text-sm shadow-md hover:bg-[#165138] transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? 'Submitting Ticket...' : 'Submit Support Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HelpCenterPage;
