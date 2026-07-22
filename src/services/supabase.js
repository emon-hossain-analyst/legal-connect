import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase configuration: set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY in your environment (.env).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * True when a Supabase error indicates a database RPC / Edge Function that the
 * client called doesn't exist yet (PostgREST can't find it in the schema cache,
 * or Postgres reports an undefined function). Used to let the frontend fall
 * back to a legacy code path during the window between a frontend deploy and
 * the matching SQL migration being applied — so a phased rollout never breaks
 * a feature that worked before.
 */
export const isMissingFunctionError = (error) => {
  if (!error) return false;
  const code = error.code || '';
  const message = (error.message || '').toLowerCase();
  return (
    code === 'PGRST202' || // PostgREST: function not found in schema cache
    code === '42883' ||    // Postgres: undefined_function
    message.includes('could not find the function') ||
    message.includes('does not exist')
  );
};
