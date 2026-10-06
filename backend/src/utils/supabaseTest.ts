import { getSupabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { env } from '../config/env';

export interface SupabaseConnectionStatus {
  configured: boolean;
  connected: boolean;
  message: string;
  error?: string;
}

/**
 * Tests backend connectivity to the configured Supabase project.
 * Does NOT expose API keys or credentials.
 */
export const testSupabaseConnection = async (): Promise<SupabaseConnectionStatus> => {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      message: 'Supabase credentials are not configured in backend/.env (SUPABASE_URL and SUPABASE_SECRET_KEY required).',
    };
  }

  try {
    const supabase = getSupabaseAdmin();

    // Query categories table or check Supabase PostgREST endpoint
    const { data, error, status, statusText } = await supabase
      .from('categories')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('relation "public.categories" does not exist')) {
        return {
          configured: true,
          connected: true,
          message: 'Connected to Supabase project, but migration 001_initial_schema.sql has not been executed yet.',
        };
      }

      if (error.code === '42501' || error.message.includes('permission denied')) {
        return {
          configured: true,
          connected: true,
          message: 'Connected to Supabase project successfully! (Permissions grant needed for service_role in schema public: GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;)',
        };
      }

      return {
        configured: true,
        connected: false,
        message: 'Failed to query Supabase database.',
        error: `HTTP ${status} (${statusText || 'no status text'}) - ${error.message || 'empty message'} - Details: ${JSON.stringify(error)}`,
      };
    }

    return {
      configured: true,
      connected: true,
      message: 'Successfully connected to Supabase PostgreSQL database.',
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      message: 'Unexpected error while connecting to Supabase.',
      error: err?.message || 'Connection failed',
    };
  }
};
