import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

export function useLawyerProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('lawyer_profiles')
          .select('*')
          .eq('id', user.auth_id || user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        setProfile(data || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const updateProfile = async (updates) => {
    if (!user) return;
    try {
      const { error } = await Promise.race([
        supabase
          .from('lawyer_profiles')
          .upsert({ id: user.auth_id || user.id, ...updates, updated_at: new Date() }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please check your internet connection or reload the page.')), 10000))
      ]);
      if (error) throw error;
      setProfile(prev => ({ ...prev, ...updates }));
    } catch (err) {
      console.error('Failed to update profile:', err);
      throw err;
    }
  };

  return { profile, loading, error, updateProfile };
}
