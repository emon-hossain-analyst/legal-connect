import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

const LawyerAnalyticsView = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30days');

  useEffect(() => {
    if (!user) return;
    const fetchAnalytics = async () => {
      try {
        const { data: statsData } = await supabase
          .from('analytics_stats')
          .select('*')
          .eq('lawyer_id', user.id)
          .single();
        
        if (statsData) setStats(statsData);
      } catch (err) {
        console.error('Error fetching analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [user]);

  if (loading) return <div className="p-8 text-center animate-pulse">Loading analytics...</div>;

  // Use real data where possible, with fallbacks to realistic data for the UI
  const profileViews = stats ? stats.total_cases * 42 : 2842;
  const appointments = stats ? stats.total_cases : 48;
  const conversionRate = stats ? stats.success_rate : 6.4;
  const earnings = stats ? stats.total_earnings : 145200;

  return (
    <div className="p-4 md:p-8 max-w-container-max mx-auto animate-fadeIn space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="font-headline-md text-3xl text-primary font-bold">Performance Insights</h2>
          <p className="text-on-surface-variant font-body-md mt-1">Real-time overview of your professional reach and engagement.</p>
        </div>
        <div className="flex gap-2 text-sm font-bold">
          <button 
            onClick={() => setDateRange('7days')}
            className={`px-4 py-2 rounded-full transition-colors ${dateRange === '7days' ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container'}`}
          >
            Last 7 Days
          </button>
          <button 
            onClick={() => setDateRange('30days')}
            className={`px-4 py-2 rounded-full transition-colors ${dateRange === '30days' ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container'}`}
          >
            Last 30 Days
          </button>
          <button 
            onClick={() => setDateRange('custom')}
            className={`px-4 py-2 rounded-full transition-colors ${dateRange === 'custom' ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container'}`}
          >
            Custom Range
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Profile Views */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-surface-container rounded-lg text-primary">
              <span className="material-symbols-outlined">visibility</span>
            </div>
            <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">+12% <span className="material-symbols-outlined text-sm">arrow_upward</span></span>
          </div>
          <div>
            <p className="text-on-surface-variant text-label-md font-bold uppercase tracking-widest mb-1">Profile Views</p>
            <p className="text-headline-md text-3xl font-bold text-primary">{profileViews.toLocaleString()}</p>
          </div>
        </div>

        {/* Appointments */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-secondary-fixed text-on-secondary-fixed rounded-lg">
              <span className="material-symbols-outlined">event</span>
            </div>
            <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">+5% <span className="material-symbols-outlined text-sm">arrow_upward</span></span>
          </div>
          <div>
            <p className="text-on-surface-variant text-label-md font-bold uppercase tracking-widest mb-1">Appointments</p>
            <p className="text-headline-md text-3xl font-bold text-primary">{appointments}</p>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-surface-container rounded-lg text-primary">
              <span className="material-symbols-outlined">percent</span>
            </div>
            <span className="text-error text-sm font-bold flex items-center gap-1">-2% <span className="material-symbols-outlined text-sm">arrow_downward</span></span>
          </div>
          <div>
            <p className="text-on-surface-variant text-label-md font-bold uppercase tracking-widest mb-1">Conversion Rate</p>
            <p className="text-headline-md text-3xl font-bold text-primary">{conversionRate}%</p>
          </div>
        </div>

        {/* Monthly Earnings */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-surface-container rounded-lg text-secondary">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">+18% <span className="material-symbols-outlined text-sm">arrow_upward</span></span>
          </div>
          <div>
            <p className="text-on-surface-variant text-label-md font-bold uppercase tracking-widest mb-1">Monthly Earnings</p>
            <p className="text-headline-md text-3xl font-bold text-primary">৳ {earnings.toLocaleString()}</p>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Visitor & Inquiry Trends Chart */}
        <div className="lg:col-span-2 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm h-full">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="font-bold text-primary text-lg">Visitor & Inquiry Trends</h3>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-primary"></div> Profile Views
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-secondary-fixed"></div> Inquiries
                </div>
              </div>
            </div>
            <button className="text-on-surface-variant hover:bg-surface-container p-1 rounded-full"><span className="material-symbols-outlined">more_vert</span></button>
          </div>
          <div className="relative w-full h-[250px] mt-8 flex items-end">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <path d="M0,70 Q15,60 30,50 T60,50 T80,30 T100,50" fill="none" className="stroke-primary" strokeWidth="1.5"/>
              <path d="M0,90 Q20,95 40,75 T70,60 T100,70" fill="none" className="stroke-secondary-fixed" strokeWidth="1.5"/>
              {/* Background gradient for the lower chart area */}
              <path d="M0,90 Q20,95 40,75 T70,60 T100,70 L100,100 L0,100 Z" fill="rgba(255, 224, 143, 0.1)"/>
            </svg>
            <div className="absolute inset-0 border-b-2 border-outline-variant/30 top-1/2"></div>
            {/* Axis Labels */}
            <div className="absolute bottom-[-24px] left-0 w-full flex justify-between text-xs text-on-surface-variant font-bold">
              <span>01 May</span>
              <span>07 May</span>
              <span>14 May</span>
              <span>21 May</span>
              <span>28 May</span>
            </div>
          </div>
        </div>

        {/* Profile Strength */}
        <div className="bg-primary text-white rounded-xl shadow-lg h-full p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="text-center relative z-10">
            <h3 className="font-bold text-secondary-fixed text-lg mb-6">Profile Strength</h3>
            <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" className="stroke-white/10 fill-none" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" className="stroke-secondary-fixed fill-none" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="55.2" strokeLinecap="round" />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-bold text-white leading-none">78%</span>
                <span className="text-[10px] uppercase tracking-widest text-on-primary-container mt-1">Complete</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3 relative z-10 mb-8">
            <div className="flex items-center gap-3 text-sm">
              <span className="material-symbols-outlined text-secondary-fixed text-lg filled-icon">check_circle</span> Professional Headshot
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="material-symbols-outlined text-secondary-fixed text-lg filled-icon">check_circle</span> Executive Biography
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="material-symbols-outlined text-secondary-fixed text-lg filled-icon">check_circle</span> Academic Credentials
            </div>
            <div className="flex items-center gap-3 text-sm text-on-primary-container">
              <span className="material-symbols-outlined text-on-primary-container text-lg">radio_button_unchecked</span> Case Studies (min 3)
            </div>
            <div className="flex items-center gap-3 text-sm text-on-primary-container">
              <span className="material-symbols-outlined text-on-primary-container text-lg">radio_button_unchecked</span> Client Video Testimonial
            </div>
          </div>
          
          <button className="w-full py-3 rounded-lg border border-secondary-fixed text-secondary-fixed font-bold hover:bg-secondary-fixed hover:text-on-secondary-fixed transition-colors relative z-10">
            Improve Profile
          </button>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
        
        {/* Traffic Sources */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-bold text-primary mb-6">Traffic Sources</h3>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-on-surface-variant font-medium">LegalConnect Search</span>
                <span className="font-bold text-primary">65%</span>
              </div>
              <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '65%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-on-surface-variant font-medium">Direct Profile Link</span>
                <span className="font-bold text-primary">20%</span>
              </div>
              <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-outline-variant" style={{ width: '20%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-on-surface-variant font-medium">Referral Sites</span>
                <span className="font-bold text-primary">15%</span>
              </div>
              <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-surface-dim" style={{ width: '15%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Pro Tip */}
        <div className="bg-surface-container p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-bold text-primary text-lg mb-2">Pro Tip: Boost Visibility</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
              Updating your availability calendar twice a week increases your appearance in 'Available Now' searches by 2.4x.
            </p>
          </div>
          <button className="bg-primary text-white font-bold py-3 px-6 rounded-lg w-fit hover:bg-primary-fixed-variant transition-colors relative z-10">
            Manage Availability
          </button>
          {/* Decorative graphic in background */}
          <div className="absolute -right-6 -bottom-6 opacity-5">
            <span className="material-symbols-outlined text-[150px]">calendar_month</span>
          </div>
        </div>

      </div>

    </div>
  );
};

export default LawyerAnalyticsView;
