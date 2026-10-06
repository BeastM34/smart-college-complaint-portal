import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Checks whether Supabase URL and Secret Key are configured in the environment.
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY);
};

let _supabaseAdmin: SupabaseClient | null = null;

/**
 * Returns the Supabase Admin client initialized with the SERVER-ONLY Secret Key (Service Role).
 * Used exclusively for server-side trusted operations, migrations verification, and database management.
 * 
 * Throws a descriptive error if environment variables are not yet configured.
 */
export const getSupabaseAdmin = (): SupabaseClient => {
  if (_supabaseAdmin) {
    return _supabaseAdmin;
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error(
      'Supabase credentials are not configured. Please set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env'
    );
  }

  _supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _supabaseAdmin;
};

/**
 * Factory helper for user-scoped Supabase operations (Phase 3+).
 * Passes the caller's JWT access token so PostgreSQL Row Level Security (RLS) policies apply.
 */
export const createUserScopedSupabaseClient = (accessToken: string): SupabaseClient => {
  if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
    throw new Error('Valid access token is required to initialize user-scoped Supabase client.');
  }

  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  if (!env.SUPABASE_URL || !publishableKey) {
    throw new Error(
      'Supabase credentials are not configured. Please set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in backend/.env'
    );
  }

  return createClient(env.SUPABASE_URL, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    },
  });
};

let _supabaseClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client initialized with the PUBLISHABLE Key.
 * Used for public user authentication operations (signInWithPassword, signUp).
 */
export const getSupabaseClient = (): SupabaseClient => {
  if (_supabaseClient) {
    return _supabaseClient;
  }

  const key = env.SUPABASE_PUBLISHABLE_KEY;
  if (!env.SUPABASE_URL || !key) {
    throw new Error(
      'Supabase credentials are not configured. Please set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in backend/.env'
    );
  }

  _supabaseClient = createClient(env.SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _supabaseClient;
};

