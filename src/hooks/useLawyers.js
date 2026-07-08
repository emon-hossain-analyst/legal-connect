import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '../services/supabase';

// Create a context so we can cache the lawyers data globally if needed
const LawyerContext = createContext(null);

export const LawyerProvider = ({ children }) => {
  const [cache, setCache] = useState({ lawyers: null, timestamp: null });

  return (
    <LawyerContext.Provider value={{ cache, setCache }}>
      {children}
    </LawyerContext.Provider>
  );
};

export const useLawyers = (filters = {}) => {
  const [data, setData] = useState({ lawyers: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Optional context for caching
  const context = useContext(LawyerContext);

  const fetchLawyers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first if no specific filters (or based on your caching strategy)
      const noFilters = Object.keys(filters).length === 0 || (Object.keys(filters).length === 1 && filters.limit);
      if (noFilters && context?.cache?.lawyers) {
        // Use cached data if it's less than 5 minutes old
        const now = new Date().getTime();
        if (now - context.cache.timestamp < 5 * 60 * 1000) {
          setData(context.cache.lawyers);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from('lawyers')
        .select(`
          *,
          users!inner (
            id,
            name,
            profile_picture_url,
            is_active
          )
        `, { count: 'exact' })
        .eq('users.is_active', true); // only active users

      // Apply filters
      if (filters.specialization) {
        // Depending on your schema, if 'specialization' is a string
        query = query.ilike('specialization', `%${filters.specialization}%`);
      }
      
      if (filters.rating) {
        query = query.gte('avg_rating', filters.rating);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.sort === 'rating') {
        query = query.order('avg_rating', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data: lawyersData, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      const result = { lawyers: lawyersData || [], total: count || 0 };
      setData(result);

      // Cache the result if applicable
      if (noFilters && context) {
        context.setCache({ lawyers: result, timestamp: new Date().getTime() });
      }

    } catch (err) {
      console.error('Error fetching lawyers:', err);
      setError(err.message || 'Failed to fetch lawyers');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), context]);

  useEffect(() => {
    fetchLawyers();
  }, [fetchLawyers]);

  return { ...data, loading, error, refetch: fetchLawyers };
};

export const fetchSingleLawyer = async (idOrSlug) => {
  // Can pass either an ID (number/string) or a slug
  const isId = !isNaN(parseInt(idOrSlug));
  
  let query = supabase
    .from('lawyers')
    .select(`
      *,
      users!inner (
        id,
        name,
        email,
        profile_picture_url,
        is_active
      )
    `);

  if (isId) {
    query = query.eq('id', idOrSlug);
  } else {
    query = query.eq('slug', idOrSlug);
  }

  const { data, error } = await query.single();
  if (error) throw error;
  return data;
};
