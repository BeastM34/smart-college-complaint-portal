import { getSupabaseAdmin, getSupabaseClient, isSupabaseConfigured } from '../config/supabase';
import { env } from '../config/env';

async function inspectLive(): Promise<void> {
  console.log('================================================================');
  console.log(' INSPECTING LIVE SUPABASE DATABASE');
  console.log('================================================================');
  console.log('Supabase URL configured:', Boolean(env.SUPABASE_URL));
  console.log('Supabase Secret Key configured:', Boolean(env.SUPABASE_SECRET_KEY));
  console.log('Supabase Publishable Key configured:', Boolean(env.SUPABASE_PUBLISHABLE_KEY));

  const admin = getSupabaseAdmin();
  const client = getSupabaseClient();

  const tables = [
    'profiles',
    'categories',
    'complaints',
    'complaint_comments',
    'complaint_timeline',
    'complaint_attachments',
    'notifications',
    'broadcast_notifications',
    'system_settings',
  ];

  console.log('\n--- 1. Testing Admin Client (service_role) against all 9 tables ---');
  for (const table of tables) {
    try {
      const res = await admin.from(table).select('*').limit(1);
      if (res.error) {
        console.log(`  Table [${table}]: status=${res.status} error=${JSON.stringify(res.error)}`);
      } else {
        console.log(`  Table [${table}]: OK status=${res.status} rows=${res.data?.length}`);
      }
    } catch (err: any) {
      console.log(`  Table [${table}]: EXCEPTION ${err.message}`);
    }
  }

  console.log('\n--- 2. Testing Anon Client against all 9 tables ---');
  for (const table of tables) {
    try {
      const res = await client.from(table).select('*').limit(1);
      if (res.error) {
        console.log(`  Table [${table}]: status=${res.status} error=${JSON.stringify(res.error)}`);
      } else {
        console.log(`  Table [${table}]: OK status=${res.status} rows=${res.data?.length}`);
      }
    } catch (err: any) {
      console.log(`  Table [${table}]: EXCEPTION ${err.message}`);
    }
  }

  console.log('\n--- 3. Testing RPC Helper Functions in PostgREST Schema Cache ---');
  let functionsFound = 0;
  try {
    const { data: rpcData, error: rpcErr } = await admin.rpc('get_current_user_role');
    if (!rpcErr) {
      console.log('  RPC get_current_user_role: OK (found in schema cache)');
      functionsFound++;
    } else {
      console.log(`  RPC get_current_user_role: code=${rpcErr.code} message=${rpcErr.message}`);
    }
  } catch (err: any) {
    console.log('  RPC get_current_user_role exception:', err.message);
  }

  try {
    const { data: adminFnData, error: adminFnErr } = await admin.rpc('is_admin');
    if (!adminFnErr) {
      console.log('  RPC is_admin: OK (found in schema cache)');
      functionsFound++;
    } else {
      console.log(`  RPC is_admin: code=${adminFnErr.code} message=${adminFnErr.message}`);
    }
  } catch (err: any) {
    console.log('  RPC is_admin exception:', err.message);
  }

  console.log('\n--- 4. Testing Supabase Storage Bucket Privacy ---');
  try {
    const { data: buckets, error: bucketErr } = await admin.storage.listBuckets();
    if (bucketErr) {
      console.log('  Storage bucket list error:', bucketErr.message);
    } else {
      const attachBucket = buckets?.find((b) => b.name === 'complaint-attachments');
      if (attachBucket) {
        console.log(`  Bucket [complaint-attachments]: EXISTS | public=${attachBucket.public} (PRIVATE=${!attachBucket.public})`);
      } else {
        console.log('  Bucket [complaint-attachments]: NOT FOUND');
      }
    }
  } catch (err: any) {
    console.log('  Storage check exception:', err.message);
  }

  console.log('\n================================================================');
  console.log(' LIVE DATABASE INSPECTION COMPLETE');
  console.log('================================================================');
}

inspectLive()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Inspection failed:', err);
    process.exit(1);
  });
