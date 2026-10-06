import { testSupabaseConnection } from '../utils/supabaseTest';
import { env } from '../config/env';

async function run(): Promise<void> {
  console.log('================================================================');
  console.log(' SUPABASE DATABASE CONNECTIVITY VERIFICATION');
  console.log('================================================================');
  console.log(` Target Environment : ${env.NODE_ENV}`);
  console.log(` Loaded .env Path   : ${env._envFilePath || '(None found)'}`);
  console.log('----------------------------------------------------------------');
  console.log(` SUPABASE_URL             : ${env.SUPABASE_URL ? 'PRESENT' : 'MISSING'}`);
  console.log(` SUPABASE_PUBLISHABLE_KEY : ${env.SUPABASE_PUBLISHABLE_KEY ? 'PRESENT' : 'MISSING'}`);
  console.log(` SUPABASE_SECRET_KEY      : ${env.SUPABASE_SECRET_KEY ? 'PRESENT' : 'MISSING'}`);
  console.log(` SUPABASE_JWKS_URL        : ${env.SUPABASE_JWKS_URL ? 'PRESENT' : 'MISSING'}`);
  console.log('----------------------------------------------------------------');

  const status = await testSupabaseConnection();

  console.log(` [STATUS] Configured : ${status.configured}`);
  console.log(` [STATUS] Connected  : ${status.connected}`);
  console.log(` [MESSAGE] ${status.message}`);
  if (status.error) {
    console.log(` [ERROR] ${status.error}`);
  }

  process.exit(status.connected ? 0 : status.configured ? 1 : 0);
}

run();
