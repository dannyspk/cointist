import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // Don't throw at import-time in case some tooling loads this file without env configured,
  // but provide a clear helper function that will throw when used.
}

const getSupabaseServer = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use Supabase server client');
  return createClient(url, key);
};

export default getSupabaseServer;
