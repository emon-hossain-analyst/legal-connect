import { supabase } from './supabase';

/**
 * Register a new user (client or lawyer) using Supabase Auth.
 * @returns {{ data: { user } }}
 */
export async function signUp({ email, password, name, user_type }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        name,
        user_type,
      },
    },
  });
  if (error) throw error;
  
  if (data?.user && data?.session) {
    let publicUser = null;
    // Retry mechanism to wait for the trigger to insert the user into public.users
    for (let i = 0; i < 5; i++) {
      const { data: userRes, error } = await supabase.from('users').select('id, auth_id, user_type').eq('auth_id', data.user.id).maybeSingle();
      if (userRes) {
        publicUser = userRes;
        break;
      }
      if (error && error.code !== 'PGRST116') {
        console.warn(`AuthService: fetch public user error (attempt ${i+1}):`, error);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (publicUser) {
      data.user = { ...data.user, ...data.user.user_metadata, ...publicUser };
    } else {
      data.user = { ...data.user, ...data.user.user_metadata, auth_id: data.user.id };
    }
  } else if (data?.user) {
    data.user = { ...data.user, ...data.user.user_metadata, auth_id: data.user.id };
  }
  
  return { data };
}

const withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), ms))
  ]);
};

/**
 * Log in an existing user using Supabase Auth.
 *
 * Audit #8: Login.js used to duplicate this logic inline (with a timeout
 * guard and an email-fallback lookup that this function lacked), which meant
 * the two entry points hydrated the user object differently. This now does
 * the full hydration so Login.js can just call signIn().
 *
 * @returns {{ data: { user } }}
 */
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;

  if (data?.user) {
    const u = data.user;
    let publicUser = null;
    try {
      const res = await withTimeout(
        supabase.from('users').select('*').eq('id', u.id).maybeSingle(),
        5000
      );
      publicUser = res.data;
    } catch (err) {
      console.warn('AuthService: profile lookup timed out or failed, proceeding with graceful fallback:', err);
    }

    const userRole = publicUser?.user_type || u.user_metadata?.role || u.user_metadata?.user_type || 'client';
    const userName = publicUser?.name || u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0];
    const avatarUrl = publicUser?.profile_picture_url || u.user_metadata?.avatar_url || u.user_metadata?.profile_picture_url;

    data.user = {
      ...u,
      ...u.user_metadata,
      ...publicUser,
      id: publicUser?.id || u.id,
      auth_id: u.id,
      user_type: userRole,
      role: userRole,
      full_name: userName,
      name: userName,
      profile_picture_url: avatarUrl
    };
  }

  return { data };
}

/**
 * Log out from Supabase Auth.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Refresh the access token using Supabase Auth.
 * Supabase handles token refresh automatically, but we can explicitly refresh it if needed.
 */
export async function refreshToken() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return { data: { user: { ...data.user, ...data.user?.user_metadata } } };
}

/**
 * Fetch the currently authenticated user's profile from Supabase.
 * @returns {{ data: { user } } | null}
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { data: { user: { ...user, ...user.user_metadata } } };
  } catch {
    return null;
  }
}
