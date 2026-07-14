import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const LawyerSuiteSidebar = ({ isOpen, setIsOpen }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active state styling function
  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-r-lg transition-all duration-300 font-medium ${
      isActive
        ? 'text-white font-bold border-l-4 border-secondary bg-primary-fixed/20 translate-x-1'
        : 'text-on-primary-container/70 hover:bg-primary-fixed/10 hover:text-white'
    } active:scale-95`;

  const NavGroupHeader = ({ children }) => (
    <h3 className="text-[10px] text-on-primary-container/50 font-bold uppercase tracking-wider mt-6 mb-2 px-4">
      {children}
    </h3>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`fixed left-0 top-0 h-screen bg-primary w-64 shadow-xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-6 flex items-center justify-between border-b border-primary-container/10">
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight font-display-md">LegalConnect</h1>
            <p className="text-secondary text-xs mt-1 uppercase tracking-widest font-bold">Lawyer Dashboard</p>
          </div>
          {/* Mobile Close Button */}
          <button 
            className="lg:hidden text-on-primary-container/70 hover:text-white p-1 rounded-full hover:bg-white/10"
            onClick={() => setIsOpen(false)}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        
        {/* Scrollable Navigation Area */}
        <nav className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          
          <NavGroupHeader>Dashboard & Analytics</NavGroupHeader>
          <div className="space-y-1 pr-4">
            <NavLink to="/lawyer-suite/dashboard" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/lawyer-suite/analytics" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="analytics">analytics</span>
              <span>Analytics</span>
            </NavLink>
            <NavLink to="/lawyer-suite/reviews" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="star">star</span>
              <span>Client Reviews</span>
            </NavLink>
          </div>

          <NavGroupHeader>Job Marketplace</NavGroupHeader>
          <div className="space-y-1 pr-4">
            <NavLink to="/job-board" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="work">work</span>
              <span>Browse Job Board</span>
            </NavLink>
            <NavLink to="/lawyer-suite/proposals" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="assignment_ind">assignment_ind</span>
              <span>My Proposals</span>
            </NavLink>
          </div>

          <NavGroupHeader>Profile & Settings</NavGroupHeader>
          <div className="space-y-1 pr-4">
            <NavLink to="/lawyer-suite/profile/basic" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="person">person</span>
              <span>Basic Info</span>
            </NavLink>
            <NavLink to="/lawyer-suite/profile/credentials" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="verified_user">verified_user</span>
              <span>Credentials</span>
            </NavLink>
            <NavLink to="/lawyer-suite/profile/verifications" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="check_circle">check_circle</span>
              <span>Verifications</span>
            </NavLink>
            <NavLink to="/lawyer-suite/schedule/availability" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="calendar_month">calendar_month</span>
              <span>Availability</span>
            </NavLink>
            <NavLink to="/lawyer-suite/schedule/settings" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="settings_accessibility">settings_accessibility</span>
              <span>Consultation Settings</span>
            </NavLink>
            <NavLink to="/lawyer-suite/portfolio" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="folder_shared">folder_shared</span>
              <span>Portfolio</span>
            </NavLink>
          </div>

          <NavGroupHeader>Management & Records</NavGroupHeader>
          <div className="space-y-1 pr-4">
            <NavLink to="/lawyer-suite/cases" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="gavel">gavel</span>
              <span>Cases</span>
            </NavLink>
            <NavLink to="/lawyer-suite/appointments" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="event">event</span>
              <span>Appointments</span>
            </NavLink>
            <NavLink to="/lawyer-suite/contracts" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="description">description</span>
              <span>Contracts</span>
            </NavLink>
            <NavLink to="/lawyer-suite/billing" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="receipt_long">receipt_long</span>
              <span>Billing</span>
            </NavLink>
            <NavLink to="/lawyer-suite/notifications" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="notifications">notifications</span>
              <span>Notifications</span>
            </NavLink>
            <NavLink to="/lawyer-suite/communication" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="forum">forum</span>
              <span>Messages</span>
            </NavLink>
            <NavLink to="/lawyer-suite/privacy" className={navLinkClass} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined" data-icon="privacy_tip">privacy_tip</span>
              <span>Privacy</span>
            </NavLink>
          </div>

        </nav>
        
        {/* Footer Area */}
        <div className="p-4 border-t border-primary-container/10">
          <button 
            onClick={() => {
              navigate(`/lawyers/${user?.id}`);
              setIsOpen(false);
            }} 
            className="w-full py-2.5 px-4 bg-secondary text-primary font-bold rounded-lg hover:bg-secondary-fixed transition-colors text-sm active:scale-95 shadow-sm"
          >
            View Public Profile
          </button>
        </div>
      </aside>
    </>
  );
};

export default LawyerSuiteSidebar;
