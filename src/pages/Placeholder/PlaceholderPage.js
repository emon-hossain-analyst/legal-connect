import React from 'react';
import { Link } from 'react-router-dom';

const PlaceholderPage = ({ title = "Page Under Construction", subtitle = "Content coming soon" }) => {
  return (
    <div className="min-h-[70vh] bg-surface flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 shadow-sm border border-primary/20">
        <span className="material-symbols-outlined text-3xl">construction</span>
      </div>
      <h1 className="font-headline-sm text-3xl md:text-4xl font-bold text-primary mb-3">
        {title}
      </h1>
      <p className="font-body-md text-on-surface-variant max-w-md mb-8 text-base leading-relaxed">
        {subtitle}. Our legal and technical teams are currently preparing comprehensive resources and guidelines for this section.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          to="/"
          className="px-6 py-3 bg-primary text-white hover:bg-secondary font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">home</span>
          Return Home
        </Link>
        <Link
          to="/contact"
          className="px-6 py-3 bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">support_agent</span>
          Contact Support
        </Link>
      </div>
    </div>
  );
};

export default PlaceholderPage;
