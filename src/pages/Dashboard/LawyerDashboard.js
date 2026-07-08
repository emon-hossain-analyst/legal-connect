import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { SkeletonDashboard } from '../../components/Skeleton/Skeleton';

const LawyerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [cases, setCases] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [earnings, setEarnings] = useState({ total: 0, completed: 0, months: [] });

  useEffect(() => { 
    if (user?.id) fetchDashboardData(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchDashboardData = async () => {
    try {
      const userId = user.id;

      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from('lawyers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profileData) {
        navigate('/lawyer/profile');
        return;
      }
      setProfile(profileData);

      // 2. Fetch Appointments safely
      const { data: aptsData } = await supabase
        .from('appointments')
        .select('*')
        .eq('lawyer_id', userId)
        .order('scheduled_time', { ascending: true })
        .limit(10);

      setAppointments(aptsData || []);

      // 3. Fetch Active Cases safely
      const { data: casesData } = await supabase
        .from('contracts')
        .select('*')
        .eq('lawyer_id', userId)
        .order('created_at', { ascending: false })
        .limit(4);

      setCases(casesData || []);

      // 4. Fetch Pending Proposals
      const { data: proposalsData } = await supabase
        .from('proposals')
        .select('*, job:jobs(title, budget_min, budget_max, currency)')
        .eq('lawyer_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      setProposals(proposalsData || []);

      // 5. Fetch Notifications
      const { data: notifsData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      setNotifications(notifsData || []);

      // 6. Fetch Completed Contracts for Earnings
      const { data: completedContracts } = await supabase
        .from('contracts')
        .select('agreed_fee, completed_at')
        .eq('lawyer_id', userId)
        .eq('status', 'completed');
        
      if (completedContracts) {
        const total = completedContracts.reduce((sum, c) => sum + Number(c.agreed_fee || 0), 0);
        
        // Dynamic 6-month breakdown
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const now = new Date();
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          last6Months.push({
            monthIndex: d.getMonth(),
            year: d.getFullYear(),
            label: monthNames[d.getMonth()],
            value: 0
          });
        }

        completedContracts.forEach(c => {
          if (c.completed_at) {
            const date = new Date(c.completed_at);
            const found = last6Months.find(m => m.monthIndex === date.getMonth() && m.year === date.getFullYear());
            if (found) found.value += Number(c.agreed_fee || 0);
          }
        });
        
        setEarnings({
          total,
          completed: completedContracts.length,
          months: last6Months.map(m => ({ label: m.label, value: m.value }))
        });
      }

      // 7. Fetch Real Feedback for average rating calculation
      const { data: feedbackData } = await supabase
        .from('feedback')
        .select('*')
        .eq('lawyer_id', userId)
        .order('created_at', { ascending: false });

      setReviews(feedbackData || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error.message, error.code, error);
      setAppointments([]);
      setCases([]);
      setProposals([]);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAppointment = async (id, status) => {
    try {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;
      toast.success(`Appointment ${status}`);
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to update appointment');
    }
  };

  if (loading) {
    return <div className="h-screen bg-background p-8"><SkeletonDashboard /></div>;
  }

  // Calculate stats
  const activeApts = appointments.filter(a => a.status === 'upcoming' || a.status === 'pending').length;
  const activeCasesCount = cases.length;
  const pendingPropsCount = proposals.filter(p => p.status === 'pending').length;
  const unreadMessages = notifications.filter(n => !n.is_read).length; 
  
  const realAvgRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : profile?.rating ? profile.rating.toFixed(1) : '0.0';

  const userProfilePic = profile?.profile_picture_url || user?.user_metadata?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.user_metadata?.name || 'Lawyer')}&background=041635&color=fff`;

  return (
    <div className="bg-background text-on-surface font-body-md selection:bg-secondary-fixed selection:text-on-secondary-fixed overflow-x-hidden min-h-screen">
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
      `}</style>
      
      {/* Sidebar Component */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-primary dark:bg-primary border-r border-primary-container shadow-lg flex-col py-6 z-40 hidden lg:flex">
        <div className="px-6 mb-8">
          <h1 className="font-display-lg text-[32px] font-bold text-secondary-fixed">LegalConnect</h1>
          <p className="font-label-md text-[13px] font-medium text-on-primary-container uppercase tracking-widest mt-1">Professional Suite</p>
        </div>
        <nav className="flex-1 space-y-1">
          {/* Active Tab: Dashboard */}
          <Link to="/lawyer-dashboard" className="text-white border-l-4 border-secondary-fixed bg-primary-container px-6 py-4 flex items-center gap-3 transition-transform active:translate-x-1">
            <span className="material-symbols-outlined filled-icon">dashboard</span>
            <span className="font-label-md text-[13px] uppercase tracking-wider">Dashboard</span>
          </Link>
          <Link to="/workspace" className="text-on-primary-container hover:text-white hover:bg-primary-container/50 px-6 py-4 flex items-center gap-3 transition-all duration-200">
            <span className="material-symbols-outlined">gavel</span>
            <span className="font-label-md text-[13px] uppercase tracking-wider">Active Cases</span>
          </Link>
          <Link to="/lawyer/communication" className="text-on-primary-container hover:text-white hover:bg-primary-container/50 px-6 py-4 flex items-center gap-3 transition-all duration-200">
            <span className="material-symbols-outlined">mail</span>
            <span className="font-label-md text-[13px] uppercase tracking-wider">Messages</span>
          </Link>
          <Link to="/lawyer/appointments" className="text-on-primary-container hover:text-white hover:bg-primary-container/50 px-6 py-4 flex items-center gap-3 transition-all duration-200">
            <span className="material-symbols-outlined">calendar_today</span>
            <span className="font-label-md text-[13px] uppercase tracking-wider">Calendar</span>
          </Link>
          <Link to="/lawyer/profile" className="text-on-primary-container hover:text-white hover:bg-primary-container/50 px-6 py-4 flex items-center gap-3 transition-all duration-200">
            <span className="material-symbols-outlined">settings</span>
            <span className="font-label-md text-[13px] uppercase tracking-wider">Settings</span>
          </Link>
        </nav>
        <div className="mt-auto px-6 pt-6 border-t border-primary-container">
          <button onClick={() => navigate('/jobs')} className="w-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-[13px] uppercase tracking-widest py-3 rounded-lg flex items-center justify-center gap-2 mb-6 active:scale-95 transition-transform">
            <span className="material-symbols-outlined">search</span>
            Find Jobs
          </button>
          <div className="space-y-4">
            <Link to="/support" className="text-on-primary-container hover:text-white flex items-center gap-2 font-label-md text-[13px]">
              <span className="material-symbols-outlined text-[20px]">help</span>
              Support
            </Link>
            <button onClick={() => navigate('/login')} className="w-full text-left text-on-primary-container hover:text-white flex items-center gap-2 font-label-md text-[13px]">
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="lg:ml-64 min-h-screen">
        {/* Top Navigation Bar */}
        <header className="w-full top-0 sticky z-30 bg-surface-container-lowest border-b border-outline-variant shadow-sm flex justify-between items-center px-8 py-4 max-w-container-max mx-auto">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-primary">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="relative group hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
              <input className="pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-full w-64 md:w-96 focus:ring-2 focus:ring-secondary focus:outline-none transition-all duration-300 font-body-sm text-[14px]" placeholder="Search case files, clients..." type="text"/>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex gap-8">
              <Link to="/lawyers" className="text-primary font-bold border-b-2 border-secondary pb-1 font-body-md text-[15px]">Browse Lawyers</Link>
              <Link to="/jobs" className="text-on-surface-variant hover:text-primary transition-colors duration-200 font-body-md text-[15px]">Job Board</Link>
            </div>
            <div className="flex items-center gap-4 border-l border-outline-variant pl-6">
              <button className="relative text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors active:scale-95">
                <span className="material-symbols-outlined">notifications</span>
                {unreadMessages > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>}
              </button>
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/lawyer/profile')}>
                <div className="text-right hidden sm:block">
                  <p className="font-headline-sm text-body-sm leading-tight text-primary font-bold">{user?.user_metadata?.name || 'Lawyer'}</p>
                  <p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-tighter">Legal Partner</p>
                </div>
                <img alt="User profile avatar" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" src={userProfilePic} />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-8 max-w-container-max mx-auto space-y-8 pb-20 md:pb-8">
          
          {/* Statistics Bar (5 Cards) */}
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {/* Stat Card 1 */}
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary-container text-white rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined">event_note</span>
                </div>
                {appointments.length > 0 && <span className="text-error text-xs font-bold">+{appointments.length} today</span>}
              </div>
              <p className="text-display-lg font-display-lg text-[32px] font-bold text-primary">{activeApts.toString().padStart(2, '0')}</p>
              <p className="text-on-surface-variant text-body-sm text-[14px] font-medium">Active Appointments</p>
            </div>
            {/* Stat Card 2 */}
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-secondary text-white rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined">folder_shared</span>
                </div>
              </div>
              <p className="text-display-lg font-display-lg text-[32px] font-bold text-primary">{activeCasesCount.toString().padStart(2, '0')}</p>
              <p className="text-on-surface-variant text-body-sm text-[14px] font-medium">Open Cases</p>
            </div>
            {/* Stat Card 3 */}
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-on-tertiary-container text-white rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined">contract_edit</span>
                </div>
              </div>
              <p className="text-display-lg font-display-lg text-[32px] font-bold text-primary">{pendingPropsCount.toString().padStart(2, '0')}</p>
              <p className="text-on-surface-variant text-body-sm text-[14px] font-medium">Pending Proposals</p>
            </div>
            {/* Stat Card 4 */}
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary text-white rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined">chat_bubble</span>
                </div>
                {unreadMessages > 0 && <span className="bg-error text-white text-[10px] px-2 py-0.5 rounded-full font-bold">NEW</span>}
              </div>
              <p className="text-display-lg font-display-lg text-[32px] font-bold text-primary">{unreadMessages.toString().padStart(2, '0')}</p>
              <p className="text-on-surface-variant text-body-sm text-[14px] font-medium">Unread Messages</p>
            </div>
            {/* Stat Card 5 */}
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-secondary-container text-on-secondary-container rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined filled-icon">star</span>
                </div>
                <span className="text-on-surface-variant text-xs font-bold">{reviews.length} Reviews</span>
              </div>
              <p className="text-display-lg font-display-lg text-[32px] font-bold text-primary">{realAvgRating}</p>
              <p className="text-on-surface-variant text-body-sm text-[14px] font-medium">Avg Rating</p>
            </div>
          </section>

          {/* Three-Column Main Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Column 1: Today's Schedule */}
            <div className="lg:col-span-4 bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
                <h3 className="font-headline-md text-[22px] font-bold text-primary">Today's Schedule</h3>
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="p-0 overflow-y-auto max-h-[600px]">
                {appointments.length === 0 ? (
                  <div className="p-6 text-center text-on-surface-variant">No appointments scheduled today.</div>
                ) : (
                  appointments.map((apt, index) => {
                    const timeParts = apt.time.split(':');
                    let hours = parseInt(timeParts[0], 10);
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    hours = hours % 12;
                    hours = hours ? hours : 12; 
                    const formattedTime = `${hours.toString().padStart(2, '0')}:${timeParts[1]}`;
                    
                    const isCompleted = apt.status === 'completed';
                    const isPending = apt.status === 'pending';
                    
                    return (
                      <div key={apt.id} className={`flex gap-4 p-6 border-b border-outline-variant/50 hover:bg-surface-container-low/20 transition-colors ${isCompleted ? 'opacity-60' : ''} ${isPending ? 'bg-secondary-fixed/5' : ''}`}>
                        <div className="flex flex-col items-center w-16">
                          <span className="font-bold text-primary text-body-md text-[15px]">{formattedTime}</span>
                          <span className="text-[10px] uppercase font-bold text-outline">{ampm}</span>
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center gap-3">
                            <img 
                              alt="Client Avatar" 
                              className="w-10 h-10 rounded-full object-cover" 
                              src={apt.client?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(apt.client?.name || 'Client')}&background=e2e9f5&color=041635`} 
                            />
                            <div>
                              <h4 className="font-headline-sm text-body-md text-[15px] font-bold text-primary">{apt.client?.name || 'Client'}</h4>
                              <p className="text-xs text-on-surface-variant">{apt.reason || 'Consultation'}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {isPending && (
                              <button onClick={() => handleUpdateAppointment(apt.id, 'upcoming')} className="flex-1 py-1.5 bg-primary text-white text-[11px] font-bold uppercase tracking-widest rounded transition-colors hover:bg-secondary">Confirm</button>
                            )}
                            {!isCompleted && !isPending && (
                              <button onClick={() => handleUpdateAppointment(apt.id, 'completed')} className="flex-1 py-1.5 bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold uppercase tracking-widest rounded transition-transform active:scale-95">Complete</button>
                            )}
                            <button onClick={() => navigate(`/lawyer-suite/communication?clientId=${apt.client_id}`)} className="p-2 border border-outline text-outline rounded hover:bg-white transition-colors flex items-center justify-center">
                              <span className="material-symbols-outlined text-[16px]">chat</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Column 2: Active Cases */}
            <div className="lg:col-span-5 bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm">
              <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
                <h3 className="font-headline-md text-[22px] font-bold text-primary">Active Case Progress</h3>
                <div className="flex gap-2">
                  <button className="p-1 text-on-surface-variant hover:text-primary flex"><span className="material-symbols-outlined">filter_list</span></button>
                  <button className="p-1 text-on-surface-variant hover:text-primary flex"><span className="material-symbols-outlined">sort</span></button>
                </div>
              </div>
              <div className="p-6 space-y-8">
                {cases.length === 0 ? (
                  <div className="text-center text-on-surface-variant">No active cases.</div>
                ) : (
                  cases.map((c, index) => {
                    const milestones = c.contract_milestones || [];
                    const latestMs = milestones.length > 0 ? milestones[milestones.length - 1].title : 'Initialization';
                    
                    // Generate random progress for UI demo if not stored, or calculate based on milestones
                    const completedMilestones = milestones.filter(m => m.status === 'completed').length;
                    const totalMilestones = milestones.length || 1;
                    const percent = Math.max(10, Math.round((completedMilestones / totalMilestones) * 100));
                    
                    // Assign a status color based on index for variety as in HTML
                    const statusClass = index % 3 === 0 ? 'bg-success/15 text-green-700 border border-green-700/20' : 
                                        index % 3 === 1 ? 'bg-warning/15 text-secondary border border-secondary/20' : 
                                        'bg-primary-container/10 text-primary-container border border-primary-container/20';
                    const statusText = index % 3 === 0 ? 'IN PROGRESS' : index % 3 === 1 ? 'AT RISK' : 'REVIEW';
                    const barColor = index % 3 === 1 ? 'bg-error' : 'bg-secondary';

                    return (
                      <div key={c.id} className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-headline-sm text-[15px] font-bold text-primary line-clamp-1">{c.job?.title || 'Legal Case'}</h4>
                            <p className="text-xs text-on-surface-variant font-medium">Lead: {c.client?.name || 'Client'} | Case ID: #{c.id.substring(0,6).toUpperCase()}</p>
                          </div>
                          <span className={`${statusClass} text-[10px] px-2 py-0.5 rounded-full font-bold`}>{statusText}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold text-on-surface-variant">
                            <span>Milestone: {latestMs}</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full bg-surface-container rounded-full h-2">
                            <div className={`${barColor} h-2 rounded-full`} style={{ width: `${percent}%` }}></div>
                          </div>
                        </div>
                        <button onClick={() => navigate(`/workspace/${c.id}`)} className="w-full py-2 border border-outline text-primary font-bold text-xs uppercase tracking-widest rounded hover:bg-secondary-fixed transition-colors">Update Milestone</button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Column 3: Stacked Widgets */}
            <div className="lg:col-span-3 space-y-8 h-full">
              
              {/* Widget: Pending Proposals */}
              <div className="bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm">
                <div className="p-4 border-b border-outline-variant bg-surface-container-low/30">
                  <h3 className="font-headline-sm text-body-md text-[15px] font-bold text-primary">Pending Proposals</h3>
                </div>
                <div className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
                  {proposals.length === 0 ? (
                    <div className="text-[13px] text-on-surface-variant text-center">No proposals found</div>
                  ) : (
                    proposals.map(p => {
                      const isPending = p.status === 'pending';
                      const borderColor = isPending ? 'border-secondary-fixed' : p.status === 'accepted' ? 'border-green-500' : 'border-red-500';
                      return (
                        <div key={p.id} className={`p-3 bg-surface-container-low rounded border-l-4 ${borderColor}`}>
                          <h5 className="text-[13px] font-bold text-primary truncate" title={p.job?.title}>{p.job?.title || 'Job Application'}</h5>
                          <p className="text-[11px] text-on-surface-variant mt-1">Status: {p.status}</p>
                          {isPending && (
                            <div className="mt-2 flex justify-end">
                              <button onClick={() => navigate(`/jobs/${p.job_id}`)} className="text-[11px] font-bold text-secondary uppercase">View Job</button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Widget: Recent Notifications */}
              <div className="bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm">
                <div className="p-4 border-b border-outline-variant bg-surface-container-low/30 flex justify-between items-center">
                  <h3 className="font-headline-sm text-body-md text-[15px] font-bold text-primary">Notifications</h3>
                  <button className="text-[10px] font-bold text-on-surface-variant hover:text-primary uppercase">Clear All</button>
                </div>
                <div className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-[13px] text-on-surface-variant text-center">No recent notifications</div>
                  ) : (
                    notifications.map((n, i) => {
                      // alternate icons
                      const icon = i % 2 === 0 ? 'priority_high' : 'info';
                      const iconBg = i % 2 === 0 ? 'bg-error-container/20 text-error' : 'bg-secondary-fixed/20 text-secondary';
                      return (
                        <div key={n.id} className="flex gap-3 items-start">
                          <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
                            <span className="material-symbols-outlined text-[18px]">{icon}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-primary">{n.is_read ? 'Read' : 'New Alert'}</p>
                            <p className="text-[11px] text-on-surface-variant line-clamp-2">{n.body}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Promo Card */}
              <div className="relative bg-primary overflow-hidden rounded-lg p-6 group cursor-pointer" onClick={() => navigate('/workspace')}>
                <div className="relative z-10 text-white">
                  <h4 className="font-headline-sm text-[18px] font-bold mb-2 text-secondary-fixed">Pro Insights</h4>
                  <p className="text-xs text-on-primary-container leading-relaxed">Your billable efficiency is up 14% this month. See how you compare to peers.</p>
                  <button className="mt-4 text-xs font-bold uppercase tracking-widest border-b border-secondary-fixed text-secondary-fixed pb-0.5">Explore Analytics</button>
                </div>
              </div>

            </div>
          </section>

          {/* Earnings Summary Full-Width Bar */}
          <section className="bg-primary-container text-white p-8 rounded-lg shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
              <div className="space-y-2 text-center md:text-left">
                <h3 className="font-headline-md text-[22px] font-bold text-secondary-fixed">Earnings Summary</h3>
                <p className="text-on-primary-container text-body-sm text-[14px]">Rolling 6-month performance review</p>
                <div className="pt-4">
                  <span className="text-display-lg text-[32px] font-bold">BDT {earnings.total.toLocaleString()}</span>
                  <span className="ml-2 text-green-400 text-sm font-bold flex items-center inline-flex">
                    <span className="material-symbols-outlined text-sm">arrow_upward</span> 12.5%
                  </span>
                </div>
              </div>
              
              {/* CSS Bar Chart */}
              <div className="flex items-end gap-3 md:gap-6 h-32 flex-1 max-w-lg w-full">
                {earnings.months.map((m, i) => {
                  const maxVal = Math.max(...earnings.months.map(x => x.value)) || 1;
                  const heightPct = Math.max((m.value / maxVal) * 100, 15); // min 15% height for visibility
                  const isLatest = i === earnings.months.length - 1;
                  
                  return (
                    <div key={i} className="flex flex-col items-center gap-2 flex-1">
                      <div className="w-full bg-white/10 rounded-t-sm relative group h-full flex flex-col justify-end">
                        <div className={`${isLatest ? 'bg-white' : 'bg-secondary-fixed'} w-full rounded-t-sm transition-all duration-1000 ease-out`} style={{ height: `${heightPct}%` }}></div>
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-primary text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                          BDT {(m.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase ${isLatest ? 'text-white' : 'text-on-primary-container'}`}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

        </div>

        {/* Footer Component */}
        <footer className="w-full py-8 mt-8 md:mt-16 bg-surface-container-low border-t border-outline-variant">
          <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-container-max mx-auto gap-4">
            <div className="flex flex-col items-center md:items-start gap-1">
              <span className="font-headline-sm text-[18px] font-bold text-primary">LegalConnect</span>
              <p className="font-body-sm text-[14px] text-on-surface-variant">© 2024 LegalConnect. All rights reserved.</p>
            </div>
            <div className="flex gap-8">
              <Link to="/privacy" className="font-body-sm text-[14px] text-on-surface-variant hover:text-primary hover:underline underline-offset-4 transition-opacity">Privacy</Link>
              <Link to="/terms" className="font-body-sm text-[14px] text-on-surface-variant hover:text-primary hover:underline underline-offset-4 transition-opacity">Terms</Link>
              <Link to="/support" className="font-body-sm text-[14px] text-on-surface-variant hover:text-primary hover:underline underline-offset-4 transition-opacity">Support</Link>
            </div>
          </div>
        </footer>
      </main>

      {/* Mobile Bottom Navigation (Visible on mobile only) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant flex justify-around py-3 px-2 z-50">
        <Link to="/lawyer-dashboard" className="flex flex-col items-center gap-1 text-primary">
          <span className="material-symbols-outlined filled-icon">dashboard</span>
          <span className="text-[10px] font-bold uppercase">Home</span>
        </Link>
        <Link to="/workspace" className="flex flex-col items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined">gavel</span>
          <span className="text-[10px] font-bold uppercase">Cases</span>
        </Link>
        <Link to="/lawyer/communication" className="flex flex-col items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined">mail</span>
          <span className="text-[10px] font-bold uppercase">Inbox</span>
        </Link>
        <Link to="/lawyer/appointments" className="flex flex-col items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined">calendar_today</span>
          <span className="text-[10px] font-bold uppercase">Events</span>
        </Link>
        <Link to="/lawyer/profile" className="flex flex-col items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px] font-bold uppercase">Profile</span>
        </Link>
      </nav>
      
    </div>
  );
};

export default LawyerDashboard;
