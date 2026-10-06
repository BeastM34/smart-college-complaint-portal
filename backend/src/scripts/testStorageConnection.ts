import { getSupabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { env } from '../config/env';
import { ensureBucketExists, ATTACHMENTS_BUCKET } from '../services/storageService';

async function run(): Promise<void> {
  console.log('================================================================');
  console.log(' SUPABASE STORAGE VERIFICATION');
  console.log('================================================================');
  console.log(` Target Environment : ${env.NODE_ENV}`);
  console.log(` Configured          : ${isSupabaseConfigured()}`);
  
  if (!isSupabaseConfigured()) {
    console.error(' Supabase credentials are not configured.');
    process.exit(1);
  }

  try {
    console.log(` Ensuring bucket "${ATTACHMENTS_BUCKET}" exists...`);
    await ensureBucketExists();

    const supabase = getSupabaseAdmin();
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error(' [ERROR listing buckets]:', listError.message);
      process.exit(1);
    }

    console.log(' [SUCCESS] Successfully connected to Supabase Storage!');
    console.log(' Buckets list:', buckets?.map(b => ({ name: b.name, public: b.public })) || []);
  } catch (err: any) {
    console.error(' [ERROR]:', err?.message || err);
    process.exit(1);
  }
}

run();
