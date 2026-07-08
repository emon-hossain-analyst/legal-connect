import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kyjjwfvfoncohkziqsae.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_04SEMh_AWugT7XivqH_7Wg_2EqqkuzK';

export const supabase = createClient(supabaseUrl, supabaseKey);
