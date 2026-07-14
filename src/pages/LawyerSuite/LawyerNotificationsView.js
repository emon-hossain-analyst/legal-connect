import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const TYPE_CONFIG = {
  contract_accepted:  { icon: 'handshake',        color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  contract_approved:  { icon: 'verified',          color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  contract_sent:      { icon: 'description',       color: 'text-blue-600 bg-blue-50 border-blue-200' },
  contract_changes:   { icon: 'edit_note',         color: 'text-amber-600 bg-amber-50 border-amber-200' },
  progress_update:    { icon: 'update',            color: 'text-blue-600 bg-blue-50 border-blue-200' },
  ready_for_review:   { icon: 'rate_review',       color: 'text-purple-600 bg-purple-50 border-purple-200' },
  revision_requested: { icon: 'replay',            color: 'text-orange-600 bg-orange-50 border-orange-200' },
  case_completed:     { icon: 'task_alt',          color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  case_update:        { icon: 'folder_open',       color: 'text-blue-600 bg-blue-50 border-blue-200' },
  new_review:         { icon: 'star',              color: 'text-amber-600 bg-amber-50 border-amber-200' },
  counter_offer:      { icon: 'swap_horiz',        color: 'text-purple-600 bg-purple-50 border-purple-200' },
  proposal:           { icon: 'assignment_ind',    color: 'text-blue-600 bg-blue-50 border-blue-200' },
  appointment:        { icon: 'event',             color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  default:            { icon: 'notifications',     color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

const LawyerNotificationsView = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | unread | read
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const userIds = [...new Set([user.id, user.auth_id].filter(Boolean))];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Notifications fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.auth_id]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`lawyer_notifications_rt_${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
        toast(payload.new.title || 'New notification', { icon: '🔔' });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const markAsRead = async (id) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    setMarkingAll(true);
    try {
      const userIds = [...new Set([user.id, user.auth_id].filter(Boolean))];
      await supabase.from('notifications').update({ is_read: true })
        .in('user_id', userIds).eq('is_read', false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Delete notification error:', err);
    }
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'read') return n.is_read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getRelativeTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'Just now';
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return rtf.format(-mins, 'minute');
    const hours = Math.floor(mins / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    return rtf.format(-Math.floor(hours / 24), 'day');
  };

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar bg-surface-container-lowest">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fadeIn">
        <div>
          <h2 className="font-serif text-[32px] font-bold text-[#041635] mb-1">Notifications</h2>
          <p className="text-gray-600 text-[15px]">
            Stay updated on your cases, contracts, and client activity.
            {unreadCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="px-4 py-2 bg-[#041635] text-white text-xs font-bold rounded-lg hover:bg-[#1b2b4b] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">done_all</span>
            {markingAll ? 'Marking...' : 'Mark All Read'}
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3">
        {[
          { id: 'all', label: 'All', count: notifications.length },
          { id: 'unread', label: 'Unread', count: unreadCount },
          { id: 'read', label: 'Read', count: notifications.length - unreadCount },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
              filter === tab.id ? 'bg-[#041635] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              filter === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-200 text-center shadow-sm animate-fadeIn">
          <span className="material-symbols-outlined text-5xl text-gray-300 mb-4 block">notifications_off</span>
          <h3 className="text-xl font-bold text-gray-700 mb-2">
            {filter === 'unread' ? 'You\'re all caught up!' : 'No notifications'}
          </h3>
          <p className="text-gray-500 text-sm">
            {filter === 'unread'
              ? 'No unread notifications at this time.'
              : 'Notifications from cases, contracts, and client activity will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-fadeIn">
          {filtered.map(notif => {
            const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.default;
            return (
              <div
                key={notif.id}
                onClick={() => !notif.is_read && markAsRead(notif.id)}
                className={`bg-white rounded-xl border p-5 transition-all cursor-pointer hover:shadow-md group ${
                  !notif.is_read ? 'border-l-4 border-l-[#041635] border-gray-200' : 'border-gray-200 opacity-80'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${cfg.color}`}>
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {cfg.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm font-bold leading-snug ${!notif.is_read ? 'text-[#041635]' : 'text-gray-600'}`}>
                        {notif.title}
                      </h4>
                      <div className="flex items-center gap-2 shrink-0">
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-[#041635] shrink-0" />
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    </div>
                    {notif.body && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{notif.body}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-2 font-medium">
                      {getRelativeTime(notif.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LawyerNotificationsView;
