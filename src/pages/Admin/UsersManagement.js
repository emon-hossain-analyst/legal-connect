import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const rowsPerPage = 20;

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, roleFilter, statusFilter, searchTerm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' });

      if (roleFilter !== 'All') {
        query = query.eq('user_type', roleFilter.toLowerCase());
      }
      
      if (statusFilter !== 'All') {
        query = query.eq('is_active', statusFilter === 'Active');
      }

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      // Pagination
      const from = (currentPage - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;
      
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      setUsers(data || []);
      setTotalPages(Math.ceil((count || 0) / rowsPerPage));
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users. Please check your network connection.');
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateToggle = async (user) => {
    const newStatus = !user.is_active;
    const actionText = newStatus ? 'activate' : 'deactivate';
    
    if (!window.confirm(`Are you sure you want to ${actionText} ${user.name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: newStatus })
        .eq('id', user.id);

      if (error) throw error;
      
      toast.success(`User ${actionText}d successfully`);
      setUsers(users.map(u => u.id === user.id ? { ...u, is_active: newStatus } : u));
    } catch (err) {
      console.error(err);
      toast.error(`Failed to ${actionText} user`);
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Email', 'Role', 'Status', 'Join Date'];
    const csvData = users.map(u => [
      u.id,
      u.name,
      u.email,
      u.user_type,
      u.is_active ? 'Active' : 'Inactive',
      new Date(u.created_at).toLocaleDateString()
    ].join(','));
    
    const csvContent = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'legalconnect_users.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <h1 className="text-3xl font-serif font-bold text-navy-primary mb-8">Users Management</h1>

      {/* Toolbar */}
      <div className="bg-surface-white rounded-t-lg border border-border-subtle border-b-0 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            className="px-4 py-2 border border-border-subtle rounded-md focus:outline-none focus:border-accent-gold min-w-[250px]"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
          <select 
            className="px-4 py-2 border border-border-subtle rounded-md bg-white focus:outline-none focus:border-accent-gold"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="All">All Roles</option>
            <option value="Client">Client</option>
            <option value="Lawyer">Lawyer</option>
            <option value="Admin">Admin</option>
          </select>
          <select 
            className="px-4 py-2 border border-border-subtle rounded-md bg-white focus:outline-none focus:border-accent-gold"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <button 
          onClick={exportCSV}
          className="bg-navy-primary text-white px-4 py-2 rounded-md hover:bg-navy-primary/90 transition-colors flex items-center gap-2 font-semibold text-sm whitespace-nowrap"
        >
          <span>📥</span> Export CSV
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-surface-white rounded-b-lg border border-border-subtle shadow-sm overflow-hidden relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-primary"></div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-light text-text-muted text-sm border-b border-border-subtle">
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Avatar & Name</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Join Date</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className={`border-b border-border-subtle/50 hover:bg-bg-light/50 transition-colors ${!user.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-navy-primary text-white flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                        {user.profile_picture_url ? (
                          <img src={user.profile_picture_url} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          user.name[0]
                        )}
                      </div>
                      <div className="font-semibold text-text-dark">{user.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-text-muted text-sm">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      user.user_type === 'admin' ? 'bg-purple-100 text-purple-700' :
                      user.user_type === 'lawyer' ? 'bg-navy-primary/10 text-navy-primary' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {user.user_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      user.is_active ? 'bg-green-100 text-success-green' : 'bg-red-100 text-danger-red'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-muted text-sm whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleDeactivateToggle(user)}
                        title={user.is_active ? "Deactivate User" : "Activate User"}
                        className="p-2 text-text-muted hover:text-navy-primary transition-colors"
                      >
                        {user.is_active ? '🔒' : '🔓'}
                      </button>
                      <a 
                        href={`/lawyers/${user.id}`} // Or public profile link if applicable
                        title="View Profile"
                        className="p-2 text-text-muted hover:text-accent-gold transition-colors"
                      >
                        👁️
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {error && (
                <tr>
                  <td colSpan="6" className="px-6 py-8">
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-4 max-w-md mx-auto">
                      <span className="material-symbols-outlined text-5xl text-red-500">error_outline</span>
                      <h3 className="text-xl font-bold text-navy-primary">Failed to Load Users</h3>
                      <p className="text-gray-600 text-sm">{error}</p>
                      <button 
                        onClick={() => { setLoading(true); setError(null); fetchUsers(); }}
                        className="px-6 py-2.5 bg-navy-primary hover:bg-navy-primary/90 text-white font-bold rounded-xl shadow transition active:scale-95"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && !error && users.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="material-symbols-outlined text-5xl text-gray-300">person_off</span>
                      <p className="font-bold text-gray-600 text-lg">No Users Found</p>
                      <p className="text-sm text-gray-400">No client, lawyer, or admin accounts match your search or filter criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white border-t border-border-subtle p-4 flex items-center justify-between">
            <div className="text-sm text-text-muted">
              Showing page <span className="font-semibold text-text-dark">{currentPage}</span> of <span className="font-semibold text-text-dark">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-3 py-1 border border-border-subtle rounded-md text-sm font-medium hover:bg-bg-light disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1 border border-border-subtle rounded-md text-sm font-medium hover:bg-bg-light disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersManagement;
