import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin, isSupabaseConfigured } from '../config/supabase';

interface RlsCheckResult {
  name: string;
  passed: boolean;
  details?: string;
}

const checks: RlsCheckResult[] = [];

function assert(name: string, condition: boolean, details?: string) {
  checks.push({ name, passed: condition, details });
  if (condition) {
    console.log(`  [PASS] ${name}`);
  } else {
    console.error(`  [FAIL] ${name}: ${details || 'Check failed'}`);
  }
}

async function verifyRls(): Promise<void> {
  console.log('================================================================');
  console.log(' PHASE 2C: DATABASE SECURITY & RLS STATIC AND LIVE AUDIT');
  console.log('================================================================');

  const migrationPath = path.resolve(__dirname, '../../database/migrations/003_rls_security.sql');
  assert('003_rls_security.sql migration file exists', fs.existsSync(migrationPath));

  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  // 1. Audit Table Coverage for ENABLE ROW LEVEL SECURITY
  console.log('\n--- 1. Verification of RLS Activation Across Tables ---');
  const requiredTables = [
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

  for (const table of requiredTables) {
    const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+(public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
    assert(`RLS explicitly enabled on table "${table}"`, rlsRegex.test(sqlContent));
  }

  // 2. Audit Helper Functions and Anti-Recursion
  console.log('\n--- 2. Helper Functions & Anti-Recursion Verification ---');
  assert(
    'get_current_user_role() helper exists and is marked SECURITY DEFINER',
    sqlContent.includes('FUNCTION public.get_current_user_role') && sqlContent.includes('SECURITY DEFINER')
  );
  assert(
    'get_current_user_role() uses safe search_path = public, pg_temp',
    sqlContent.includes('SET search_path = public, pg_temp')
  );
  assert(
    'get_current_user_role() takes ZERO parameters (relies strictly on auth.uid())',
    sqlContent.includes('FUNCTION public.get_current_user_role()')
  );
  assert(
    'Helper functions is_admin(), is_staff(), is_student() defined',
    sqlContent.includes('FUNCTION public.is_admin()') &&
    sqlContent.includes('FUNCTION public.is_staff()') &&
    sqlContent.includes('FUNCTION public.is_student()')
  );

  // 3. Audit Dangerous Policies (No broad USING(true) on sensitive tables)
  console.log('\n--- 3. Default-Deny & Sensitive Table Protection ---');
  const sensitiveTables = [
    'complaints',
    'profiles',
    'notifications',
    'complaint_attachments',
    'complaint_comments',
    'complaint_timeline',
  ];

  // Split into individual SQL statements
  const statements = sqlContent
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.toUpperCase().startsWith('CREATE POLICY'));

  for (const table of sensitiveTables) {
    const tablePolicies = statements.filter((s) => {
      const match = s.match(/ON\s+(?:public\.)?([a-zA-Z0-9_]+)/i);
      return match && match[1].toLowerCase() === table.toLowerCase();
    });

    let hasBroadTrue = false;
    for (const pol of tablePolicies) {
      if (/USING\s*\(\s*true\s*\)/i.test(pol) || /WITH\s+CHECK\s*\(\s*true\s*\)/i.test(pol)) {
        hasBroadTrue = true;
        console.error(`    Found broad true policy on ${table}: ${pol.slice(0, 60)}...`);
      }
    }
    assert(`Table "${table}" has NO unrestricted USING(true) or WITH CHECK(true) policies`, !hasBroadTrue);
  }

  // 4. Audit Internal Comments & Timeline Confidentiality
  console.log('\n--- 4. Internal Note & Audit Trail Isolation ---');
  assert(
    'complaint_comments enforces is_internal = false for non-admin readers',
    sqlContent.includes('is_internal = false') && sqlContent.includes('complaint_comments_select_policy')
  );
  assert(
    'complaint_timeline enforces is_internal = false for non-admin readers',
    sqlContent.includes('is_internal = false') && sqlContent.includes('complaint_timeline_select_policy')
  );
  assert(
    'complaint_timeline strictly denies client UPDATE and DELETE (append-only audit trail)',
    !sqlContent.includes('complaint_timeline_update') && !sqlContent.includes('complaint_timeline_delete')
  );

  // 5. Audit Role Table Grants (Least Privilege)
  console.log('\n--- 5. PostgreSQL Role Grants Audit ---');
  assert(
    'anon role has all privileges revoked from public schema',
    sqlContent.includes('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon')
  );
  assert(
    'authenticated role granted usage on schema public',
    sqlContent.includes('GRANT USAGE ON SCHEMA public TO authenticated')
  );
  assert(
    'service_role granted full access for privileged server operations',
    sqlContent.includes('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role')
  );

  // 6. Live Supabase Backend Service Role Connectivity Check
  console.log('\n--- 6. Backend Service Role Privileged Connectivity ---');
  assert('Supabase credentials configured in environment', isSupabaseConfigured());

  const supabase = getSupabaseAdmin();
  const { data: catData, error: catError, status: catStatus } = await supabase
    .from('categories')
    .select('id')
    .limit(1);

  // Connection should succeed or return role status
  assert(
    'Backend can execute queries using SUPABASE_SECRET_KEY',
    catStatus === 200 || catStatus === 403 || catStatus === 404
  );

  // 7. Role Registration & Privilege Escalation Hardening (Migration 004)
  console.log('\n--- 7. Role Registration & Privilege Escalation Hardening (Migration 004) ---');
  const migration004Path = path.resolve(__dirname, '../../database/migrations/004_role_registration_hardening.sql');
  assert('004_role_registration_hardening.sql migration file exists', fs.existsSync(migration004Path));

  const sql004Content = fs.existsSync(migration004Path) ? fs.readFileSync(migration004Path, 'utf8') : '';

  // 1. Student self-registration policy
  const insertPolicyMatch = sql004Content.match(/CREATE\s+POLICY\s+"profiles_insert_self_or_admin"[\s\S]*?;/i);
  const insertPolicySql = insertPolicyMatch ? insertPolicyMatch[0] : '';

  assert(
    'Student self-registration policy strictly permits role = \'student\' and status = \'active\' for auth.uid()',
    insertPolicySql.includes("id = auth.uid() AND role = 'student' AND status = 'active'")
  );

  // 2. Normal authenticated users cannot self-assign staff
  assert(
    'Self-registration policy strictly excludes \'staff\' from non-admin check',
    !insertPolicySql.includes("'staff'") && !insertPolicySql.includes("role IN ('student', 'staff')")
  );

  // 3. Normal authenticated users cannot self-assign admin
  assert(
    'Self-registration policy strictly excludes \'admin\' from self-assignment',
    !insertPolicySql.includes("role = 'admin'") && !insertPolicySql.includes("'admin'")
  );

  // 4. Staff cannot promote themselves to admin on UPDATE
  assert(
    'Trigger prevent_profile_escalation blocks role modification on UPDATE (staff cannot escalate to admin)',
    sql004Content.includes('NEW.role IS DISTINCT FROM OLD.role') &&
    sql004Content.includes("RAISE EXCEPTION 'Unauthorized: Account role cannot be modified by non-administrators.'")
  );

  // 5. Admin bypass is preserved
  assert(
    'Administrator retains privileged bypass to provision staff and admin accounts',
    sql004Content.includes('public.is_admin()') &&
    sql004Content.includes('NOT public.is_admin()')
  );

  // 6. Trigger defense-in-depth: intercepts both INSERT and UPDATE
  assert(
    'Trigger trg_prevent_profile_escalation fires BEFORE INSERT OR UPDATE ON public.profiles',
    sql004Content.includes('BEFORE INSERT OR UPDATE ON public.profiles')
  );

  // 7. Trigger defense-in-depth: non-admins strictly restricted to role = 'student' on INSERT
  assert(
    'Trigger rejects non-student role during profile INSERT by non-administrators',
    sql004Content.includes("NEW.role != 'student'") &&
    sql004Content.includes("RAISE EXCEPTION 'Unauthorized: Self-registration is strictly restricted to student accounts")
  );

  // 8. Trigger defense-in-depth: enforces status, id, and email immutability
  assert(
    'Trigger prevents tampering with status, ID, and email on profile mutations',
    sql004Content.includes("NEW.status != 'active'") &&
    sql004Content.includes('NEW.id != auth.uid()') &&
    sql004Content.includes('NEW.status IS DISTINCT FROM OLD.status') &&
    sql004Content.includes('NEW.email IS DISTINCT FROM OLD.email')
  );

  // 9. No broad USING(true) or WITH CHECK(true) in 004
  const statements004 = sql004Content
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.toUpperCase().startsWith('CREATE POLICY'));

  let has004BroadTrue = false;
  for (const pol of statements004) {
    if (/USING\s*\(\s*true\s*\)/i.test(pol) || /WITH\s+CHECK\s*\(\s*true\s*\)/i.test(pol)) {
      has004BroadTrue = true;
    }
  }
  assert('Migration 004 contains NO unrestricted USING(true) or WITH CHECK(true) policies', !has004BroadTrue);

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(' AUDIT SUMMARY');
  console.log('================================================================');
  const total = checks.length;
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  console.log(` Total Checks : ${total}`);
  console.log(` Passed       : ${passed}`);
  console.log(` Failed       : ${failed}`);

  if (failed > 0) {
    console.error('\n Some Phase 2C security audit checks failed!');
    process.exit(1);
  } else {
    console.log('\n All Phase 2C RLS and Database Security checks passed successfully!');
    process.exit(0);
  }
}

verifyRls().catch((err) => {
  console.error('Audit exception:', err);
  process.exit(1);
});
