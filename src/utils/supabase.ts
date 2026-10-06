import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Access only safe, public client-side environment variables
const getEnvVar = (name: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    return import.meta.env[name];
  }
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  return '';
};

const getSupabaseUrl = (): string => {
  return getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
};

const getSupabasePublishableKey = (): string => {
  return (
    getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') ||
    getEnvVar('VITE_SUPABASE_ANON_KEY') ||
    getEnvVar('SUPABASE_PUBLISHABLE_KEY')
  );
};

let clientInstance: SupabaseClient | null = null;

/**
 * Returns the client-side Supabase instance.
 * Safe for frontend use: connects ONLY with the public publishable/anon key.
 * Private server administrative keys (service_role) are NEVER used here.
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  if (clientInstance) {
    return clientInstance;
  }

  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (url && key) {
    clientInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return clientInstance;
  }

  return null;
};

/**
 * For testing purposes: allows resetting the client instance.
 */
export const _resetSupabaseClient = (): void => {
  clientInstance = null;
};
