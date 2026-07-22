import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LawyerSuiteSidebar from '../LawyerSuite/LawyerSuiteSidebar';

const LawyerSuiteLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Failed to log out', err);
    }
  };

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const mobileNavLinkClass = ({ isActive }) => 
    `flex flex-col items-center gap-1 transition-colors ${
      isActive ? 'text-primary' : 'text-on-surface-variant'
    } active:scale-95`;

  return (
    <div className="bg-background text-on-surface font-body-md overflow-x-hidden min-h-screen selection:bg-secondary-fixed selection:text-on-secondary-fixed">
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
        .gold-glow:focus-within {
            box-shadow: 0 0 0 2px #fed977;
        }
      `}</style>

      {/* The Unified Sidebar Component */}
      <LawyerSuiteSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Top Navigation Bar */}
      <header className="lg:ml-64 w-full lg:w-[calc(100%-16rem)] sticky top-0 z-40 bg-surface-container-lowest border-b border-outline-variant shadow-sm flex justify-between items-center px-4 md:px-8 py-3 h-16">
        <div className="flex items-center gap-4 flex-1">
          {/* Mobile Hamburger Toggle */}
          <button 
            className="lg:hidden text-on-surface-variant hover:text-primary p-1 rounded-md"
            onClick={() => setIsSidebarOpen(true)}
          >
            <span className="material-symbols-outlined text-[28px]">menu</span>
          </button>

          {/* Global Search Bar */}
          <div className="relative group flex-1 max-w-md hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="search">search</span>
            <input 
              className="pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-full w-full focus:ring-2 focus:ring-secondary focus:outline-none transition-all duration-300 font-body-sm text-on-surface" 
              placeholder="Search case files, clients..." 
              type="text"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Quick Links (Center/Right alignment) */}
          <div className="hidden lg:flex items-center gap-8 text-body-sm font-medium">
            <NavLink to="/lawyer-suite/dashboard" className={({isActive}) => isActive ? "text-primary font-bold border-b-2 border-secondary pb-1" : "text-on-surface-variant hover:text-primary transition-colors duration-200"}>Dashboard</NavLink>
          </div>

          <div className="flex items-center gap-4 lg:border-l border-outline-variant lg:pl-6">
            <button className="relative text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors active:scale-95">
              <span className="material-symbols-outlined" data-icon="notifications">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full ring-2 ring-surface-container-lowest"></span>
            </button>
            <button className="text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors active:scale-95 hidden sm:block">
              <span className="material-symbols-outlined" data-icon="settings">settings</span>
            </button>

            {/* User Avatar & Dropdown */}
            <div className="relative">
              <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-3 cursor-pointer group">
                <div className="text-right hidden sm:block">
                  <p className="font-headline-sm text-body-sm leading-tight text-primary font-bold">{user?.full_name || user?.name || 'Lawyer Name'}</p>
                  <p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-tighter">Lawyer</p>
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-surface-container-highest overflow-hidden shadow-sm flex items-center justify-center bg-surface-container-high transition-transform group-active:scale-95">
                  {(user?.profile_picture_url || user?.avatar_url) ? (
                    <img alt="User profile avatar" className="w-full h-full object-cover" src={user?.profile_picture_url || user?.avatar_url}/>
                  ) : (
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">person</span>
                  )}
                </div>
              </div>
              
              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-50 overflow-hidden animate-fadeIn">
                    <button onClick={handleLogout} className="w-full text-left px-4 py-3 flex items-center gap-3 text-on-surface hover:bg-error/10 hover:text-error transition-colors text-body-sm font-bold">
                      <span className="material-symbols-outlined text-[20px]">logout</span>
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="lg:ml-64 w-full lg:w-[calc(100%-16rem)] min-h-[calc(100vh-4rem)] bg-background pb-20 lg:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant flex justify-around py-3 px-2 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <NavLink to="/lawyer-suite/dashboard" className={mobileNavLinkClass}>
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? 'filled-icon' : ''}`}>dashboard</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
            </>
          )}
        </NavLink>
        <NavLink to="/lawyer-suite/portfolio" className={mobileNavLinkClass}>
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? 'filled-icon' : ''}`}>gavel</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Cases</span>
            </>
          )}
        </NavLink>
        <button className="flex flex-col items-center gap-1 text-on-surface-variant active:scale-95">
          <span className="material-symbols-outlined">mail</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">Inbox</span>
        </button>
        <NavLink to="/lawyer-suite/schedule/availability" className={mobileNavLinkClass}>
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? 'filled-icon' : ''}`}>calendar_today</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Events</span>
            </>
          )}
        </NavLink>
        <NavLink to="/lawyer-suite/profile/basic" className={mobileNavLinkClass}>
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? 'filled-icon' : ''}`}>person</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
            </>
          )}
        </NavLink>
      </nav>
    </div>
  );
};

export default LawyerSuiteLayout;
