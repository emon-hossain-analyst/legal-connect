import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import styles from './NotificationBell.module.css';

const TYPE_ROUTES = {
  appointment: '/client/dashboard',
  case: '/cases',
  chat: '/chat',
  proposal: '/lawyer/dashboard',
  contract: '/client/dashboard',
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const recentNotifications = notifications.filter(
    (n) => Date.now() - new Date(n.created_at).getTime() < THIRTY_DAYS_MS
  );

  const unreadCount = recentNotifications.filter((n) => !n.is_read).length;

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!error && data) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Real-time: new notification pushed from Supabase
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          toast.success(payload.new.title || 'New Notification');
          setNotifications((prev) => [payload.new, ...prev].slice(0, 30));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markOne = async (notif) => {
    // Mark as read BEFORE navigating
    if (!notif.is_read) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
      } catch { /* continue even if mark fails */ }
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }
    setOpen(false);
    navigate(TYPE_ROUTES[notif.type] || '/');
  };

  const markAll = async () => {
    if (!user) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    } catch { /* continue */ }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className={styles.wrapper} ref={panelRef}>
      <button className={styles.bell} onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button className={styles.markAll} onClick={markAll}>Mark all read</button>
            )}
          </div>

          {recentNotifications.length === 0 ? (
            <div className={styles.emptyState}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔔</div>
              <p className={styles.empty}>No notifications</p>
              <p style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
                You're all caught up!
              </p>
            </div>
          ) : (
            <ul className={styles.list}>
              {recentNotifications.map((n) => (
                <li
                  key={n.id}
                  className={`${styles.item} ${!n.is_read ? styles.unread : ''}`}
                  onClick={() => markOne(n)}
                >
                  <div className={styles.itemDot} />
                  <div className={styles.itemBody}>
                    <p className={styles.itemTitle}>{n.title}</p>
                    {n.body && <p className={styles.itemDesc}>{n.body}</p>}
                    <span className={styles.itemTime}>{timeAgo(n.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
