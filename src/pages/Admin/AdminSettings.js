import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Platform Settings persisted in localStorage
  const [platformSettings, setPlatformSettings] = useState(() => {
    const saved = localStorage.getItem('admin_platform_settings');
    return saved ? JSON.parse(saved) : {
      maintenanceMode: false,
      registrationsOpen: true,
      lawyerVerificationRequired: true
    };
  });

  // Departments
  const [departments, setDepartments] = useState([]);
  
  // Contact Inquiries
  const [inquiries, setInquiries] = useState([]);
  const [expandedInquiry, setExpandedInquiry] = useState(null);

  useEffect(() => {
    fetchSettingsData();
  }, []);

  const fetchSettingsData = async () => {
    try {
      setLoading(true);
      const [
        { data: deptsData, error: deptsError },
        { data: inqData, error: inqError }
      ] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('contact_inquiries').select('*').order('created_at', { ascending: false }).limit(20)
      ]);

      if (deptsError) throw deptsError;
      if (inqError) throw inqError;

      setDepartments(deptsData || []);
      setInquiries(inqData || []);
    } catch (err) {
      console.error('Error fetching settings data:', err);
      setError('Failed to load settings data. Please check your network connection.');
      toast.error('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSetting = (key) => {
    setPlatformSettings(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('admin_platform_settings', JSON.stringify(updated));
      return updated;
    });
    toast.success('Setting updated successfully');
  };

  const handleToggleDepartment = async (dept) => {
    try {
      const newStatus = !dept.is_active;
      const { error } = await supabase
        .from('departments')
        .update({ is_active: newStatus })
        .eq('id', dept.id);

      if (error) throw error;
      
      setDepartments(prev => prev.map(d => d.id === dept.id ? { ...d, is_active: newStatus } : d));
      toast.success(`Department ${newStatus ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('Error toggling department:', err);
      toast.error('Failed to update department');
    }
  };

  const handleMarkInquiryReplied = async (id) => {
    try {
      const { error } = await supabase
        .from('contact_inquiries')
        .update({ status: 'replied' })
        .eq('id', id);

      if (error) throw error;
      
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: 'replied' } : i));
      toast.success('Inquiry marked as replied');
    } catch (err) {
      console.error('Error updating inquiry:', err);
      toast.error('Failed to update inquiry status');
    }
  };

  const ToggleSwitch = ({ checked, onChange, label, description }) => (
    <div className="flex items-center justify-between py-4">
      <div>
        <div className="font-semibold text-text-dark">{label}</div>
        <div className="text-sm text-text-muted">{description}</div>
      </div>
      <button 
        className={`relative w-12 h-6 rounded-full transition-colors ${checked ? 'bg-success-green' : 'bg-gray-300'}`}
        onClick={onChange}
      >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-7' : 'left-1'}`}></div>
      </button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <h1 className="text-3xl font-serif font-bold text-navy-primary mb-8">Platform Settings</h1>

      {loading ? (
        <div className="flex justify-center items-center h-64 min-h-[400px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-primary"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-4 my-4">
          <span className="material-symbols-outlined text-5xl text-red-500">error_outline</span>
          <h3 className="text-xl font-bold text-navy-primary">Failed to Load Settings</h3>
          <p className="text-gray-600 text-sm">{error}</p>
          <button 
            onClick={() => { setLoading(true); setError(null); fetchSettingsData(); }}
            className="px-6 py-2.5 bg-navy-primary hover:bg-navy-primary/90 text-white font-bold rounded-xl shadow transition active:scale-95"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          
          {/* SECTION 1: Platform Settings */}
          <section className="bg-surface-white rounded-lg border border-border-subtle shadow-sm p-6">
            <h2 className="text-xl font-bold text-navy-primary mb-4 pb-2 border-b border-border-subtle">General Configuration</h2>
            <div className="flex flex-col divide-y divide-border-subtle">
              <ToggleSwitch 
                checked={platformSettings.maintenanceMode} 
                onChange={() => handleToggleSetting('maintenanceMode')} 
                label="Maintenance Mode" 
                description="Disable public access and show a maintenance page."
              />
              <ToggleSwitch 
                checked={platformSettings.registrationsOpen} 
                onChange={() => handleToggleSetting('registrationsOpen')} 
                label="Open Registrations" 
                description="Allow new users to create accounts."
              />
              <ToggleSwitch 
                checked={platformSettings.lawyerVerificationRequired} 
                onChange={() => handleToggleSetting('lawyerVerificationRequired')} 
                label="Require Lawyer Verification" 
                description="Lawyers must be manually approved before accepting jobs."
              />
            </div>
          </section>

          {/* SECTION 2: Department Management */}
          <section className="bg-surface-white rounded-lg border border-border-subtle shadow-sm p-6">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-navy-primary">Department Management</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-light text-text-muted text-sm border-b border-border-subtle">
                    <th className="px-4 py-3 font-semibold">Icon</th>
                    <th className="px-4 py-3 font-semibold">Department Name</th>
                    <th className="px-4 py-3 font-semibold">Slug</th>
                    <th className="px-4 py-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map(dept => (
                    <tr key={dept.id} className={`border-b border-border-subtle/50 hover:bg-bg-light/50 transition-colors ${!dept.is_active ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-2xl">{dept.icon || '📁'}</td>
                      <td className="px-4 py-3 font-bold text-text-dark">{dept.name}</td>
                      <td className="px-4 py-3 text-text-muted text-sm font-mono">{dept.slug}</td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => handleToggleDepartment(dept)}
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                            dept.is_active 
                              ? 'bg-green-100 text-success-green hover:bg-red-100 hover:text-danger-red hover:after:content-[\'Disable\']' 
                              : 'bg-red-100 text-danger-red hover:bg-green-100 hover:text-success-green hover:after:content-[\'Enable\']'
                          }`}
                        >
                          <span className="hover:hidden">{dept.is_active ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {departments.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-4 py-12 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="material-symbols-outlined text-4xl text-gray-300">folder_off</span>
                          <p className="font-bold text-gray-600">No Departments Configured</p>
                          <p className="text-xs text-gray-400">Add practice departments to categorize legal jobs and lawyers.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION 3: Contact Inquiries */}
          <section className="bg-surface-white rounded-lg border border-border-subtle shadow-sm p-6">
            <h2 className="text-xl font-bold text-navy-primary mb-4 pb-2 border-b border-border-subtle">Recent Contact Inquiries</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-light text-text-muted text-sm border-b border-border-subtle">
                    <th className="px-4 py-3 font-semibold">Sender</th>
                    <th className="px-4 py-3 font-semibold">Subject & Message</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map(inquiry => (
                    <React.Fragment key={inquiry.id}>
                      <tr className="border-b border-border-subtle/50 hover:bg-bg-light/50 transition-colors">
                        <td className="px-4 py-4 align-top">
                          <div className="font-semibold text-text-dark">{inquiry.name}</div>
                          <div className="text-xs text-text-muted">{inquiry.email}</div>
                          <div className="text-xs text-text-muted mt-1">{new Date(inquiry.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="px-4 py-4 align-top max-w-sm">
                          <div className="font-semibold text-text-dark mb-1">{inquiry.subject || 'No Subject'}</div>
                          <div className="text-sm text-text-muted truncate">
                            {inquiry.message.substring(0, 100)}{inquiry.message.length > 100 ? '...' : ''}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className={`px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider ${
                            inquiry.status === 'replied' ? 'bg-green-100 text-success-green' : 'bg-amber-100 text-amber-600'
                          }`}>
                            {inquiry.status || 'unread'}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-right">
                          <div className="flex flex-col gap-2 items-end">
                            <button 
                              onClick={() => setExpandedInquiry(expandedInquiry === inquiry.id ? null : inquiry.id)}
                              className="text-sm font-semibold text-navy-primary hover:text-accent-gold transition-colors"
                            >
                              {expandedInquiry === inquiry.id ? 'Hide Message' : 'View Full Message'}
                            </button>
                            {inquiry.status !== 'replied' && (
                              <button 
                                onClick={() => handleMarkInquiryReplied(inquiry.id)}
                                className="text-xs font-semibold text-text-muted hover:text-success-green transition-colors"
                              >
                                Mark Replied
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedInquiry === inquiry.id && (
                        <tr className="bg-bg-light/30 border-b border-border-subtle">
                          <td colSpan="4" className="px-6 py-4">
                            <div className="bg-white p-4 rounded border border-border-subtle shadow-inner">
                              <div className="font-bold text-navy-primary mb-2">Message Content:</div>
                              <p className="text-text-dark text-sm whitespace-pre-wrap">{inquiry.message}</p>
                              <div className="mt-4 pt-4 border-t border-border-subtle flex gap-4">
                                <a 
                                  href={`mailto:${inquiry.email}?subject=Re: ${inquiry.subject}`}
                                  className="px-4 py-2 bg-navy-primary text-white rounded text-sm font-semibold hover:bg-navy-primary/90 transition-colors"
                                >
                                  Reply via Email
                                </a>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {inquiries.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-4 py-12 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="material-symbols-outlined text-4xl text-gray-300">inbox</span>
                          <p className="font-bold text-gray-600">No Contact Inquiries Found</p>
                          <p className="text-xs text-gray-400">Messages sent through the contact form will appear here.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      )}
    </div>
  );
};

export default AdminSettings;
