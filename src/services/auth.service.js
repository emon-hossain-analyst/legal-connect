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

/**
 * Log in an existing user using Supabase Auth.
 * @returns {{ data: { user } }}
 */
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  
  if (data?.user) {
    const { data: publicUser } = await supabase.from('users').select('id, auth_id, user_type').eq('auth_id', data.user.id).maybeSingle();
    if (publicUser) {
      data.user = { ...data.user, ...data.user.user_metadata, ...publicUser };
    } else {
      data.user = { ...data.user, ...data.user.user_metadata, auth_id: data.user.id };
    }
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
