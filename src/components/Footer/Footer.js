/* eslint-disable jsx-a11y/anchor-is-valid */
import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-[#0D1B2A] text-white pt-16 pb-10 border-t border-[#1b2b4b] font-sans">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        
        {/* 4-Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          
          {/* Column 1: Brand */}
          <div className="flex flex-col">
            <Link to="/" className="flex items-center gap-2.5 group w-fit">
              <div className="w-9 h-9 rounded-xl bg-[#F5C518]/10 border border-[#F5C518]/30 flex items-center justify-center text-[#F5C518] group-hover:bg-[#F5C518] group-hover:text-[#0D1B2A] transition-all duration-300">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>balance</span>
              </div>
              <span className="font-serif text-2xl font-bold text-white tracking-tight">LegalConnect</span>
            </Link>

            <p className="text-[#8A9BB0] text-sm mt-4 leading-relaxed max-w-xs">
              Connecting you with trusted legal professionals across Bangladesh.
            </p>

            {/* Social Media Icons Row */}
            <div className="flex items-center gap-3 mt-6">
              {/* Facebook */}
              <a
                href="#"
                aria-label="Facebook"
                className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-[#8A9BB0] hover:text-[#F5C518] hover:bg-white/10 transition-all duration-200"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>

              {/* LinkedIn */}
              <a
                href="#"
                aria-label="LinkedIn"
                className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-[#8A9BB0] hover:text-[#F5C518] hover:bg-white/10 transition-all duration-200"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>

              {/* Twitter / X */}
              <a
                href="#"
                aria-label="Twitter"
                className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-[#8A9BB0] hover:text-[#F5C518] hover:bg-white/10 transition-all duration-200"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              {/* YouTube */}
              <a
                href="#"
                aria-label="YouTube"
                className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-[#8A9BB0] hover:text-[#F5C518] hover:bg-white/10 transition-all duration-200"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>

            <p className="text-xs text-[#8A9BB0] mt-6">
              © 2026 LegalConnect. All rights reserved.
            </p>
          </div>

          {/* Column 2: Platform */}
          <div>
            <h4 className="text-[#8A9BB0] uppercase text-[11px] font-bold tracking-[0.1em] mb-4">
              PLATFORM
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/find-lawyers" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Find a Lawyer
                </Link>
              </li>
              <li>
                <Link to="/job-board" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Browse Job Board
                </Link>
              </li>
              <li>
                <Link to="/updates" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Legal Updates
                </Link>
              </li>
              <li>
                <Link to="/ai-advisor" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  AI Legal Advisor
                </Link>
              </li>
              <li>
                <a href="/#how-it-works" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  How It Works
                </a>
              </li>
              <li>
                <Link to="/pricing" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: For Lawyers */}
          <div>
            <h4 className="text-[#8A9BB0] uppercase text-[11px] font-bold tracking-[0.1em] mb-4">
              FOR LAWYERS
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/register?role=lawyer" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Join as a Lawyer
                </Link>
              </li>
              <li>
                <Link to="/lawyer-suite/dashboard" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Lawyer Dashboard
                </Link>
              </li>
              <li>
                <Link to="/lawyers/verification-info" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Verification Process
                </Link>
              </li>
              <li>
                <Link to="/faq#lawyers" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Lawyer FAQ
                </Link>
              </li>
              <li>
                <Link to="/lawyers/success-stories" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Success Stories
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Support & Legal */}
          <div>
            <h4 className="text-[#8A9BB0] uppercase text-[11px] font-bold tracking-[0.1em] mb-4">
              SUPPORT
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/contact" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/help" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/contact?type=report" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Report an Issue
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/cookie-policy" className="text-[#8A9BB0] hover:text-white transition-colors duration-200 text-sm block">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-[#F5C518]/20 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <p className="text-xs text-[#8A9BB0] font-medium">
            Made in Bangladesh 🇧🇩 — Empowering legal access for all
          </p>
          <div className="flex items-center gap-1.5 text-xs text-[#8A9BB0] font-medium">
            <span className="material-symbols-outlined text-[#F5C518] text-[16px]">lock</span>
            <span>Secured by Supabase · SSL Encrypted</span>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
