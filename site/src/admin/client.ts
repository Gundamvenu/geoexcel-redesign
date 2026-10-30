// Admin Supabase client. Uses ONLY the project URL and the publishable key (build-time env).
// What a signed-in user may read or change is decided by Row Level Security in the database (is_admin()),
// never by this UI. The session is kept by supabase-js under its own storage key.
import { createClient } from '@supabase/supabase-js';

export const sb = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'geoexcel-admin-auth' },
});
