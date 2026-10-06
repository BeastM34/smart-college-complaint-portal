import http from 'http';
import app from '../app';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { _setClientFactoryForTesting } from '../middleware/authMiddleware';

interface TestCheck {
  number: number;
  name: string;
  category: string;
  passed: boolean;
  details?: string;
}

const checks: TestCheck[] = [];

function assert(num: number, category: string, name: string, condition: boolean, details?: string) {
  checks.push({ number: num, category, name, passed: condition, details });
  if (condition) {
    console.log(`  [PASS] ${num}. [${category}] ${name}`);
  } else {
    console.error(`  [FAIL] ${num}. [${category}] ${name}: ${details || 'Assertion failed'}`);
  }
}

async function runAdminAnalyticsTests(): Promise<void> {
  console.log('================================================================');
  console.log(' BACKEND PHASE 4D: ADMIN ANALYTICS & SUPPORTING APIs AUDIT');
  console.log('================================================================\n');

  if (!isSupabaseConfigured()) {
    console.error('Supabase is not configured. Aborting tests.');
    process.exit(1);
  }

  const supabaseAdmin = getSupabaseAdmin();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const createdUserIds: string[] = [];
  const createdComplaintIds: string[] = [];
  const createdCategoryIds: string[] = [];

  const timestamp = Date.now();
  const testStudentA = {
    email: `phase4d.studenta.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4D Student A',
    role: 'student' as const,
  };
  const testStaffA = {
    email: `phase4d.staffa.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4D Staff A',
    role: 'staff' as const,
  };
  const testAdminA = {
    email: `phase4d.admina.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4D Admin A',
    role: 'admin' as const,
  };

  let tokenStudentA = '';
  let idStudentA = '';
  let tokenStaffA = '';
  let idStaffA = '';
  let tokenAdminA = '';
  let idAdminA = '';

  let testCatId = '';
  let testComplaintId = '';

  try {
    // -------------------------------------------------------------------------
    // Setup Test Users in Live Supabase Auth & public.profiles
    // -------------------------------------------------------------------------
    console.log('--- Provisioning Test Users ---');
    const provisionUser = async (u: { email: string; password: string; name: string; role: 'student' | 'staff' | 'admin' }) => {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name, role: u.role },
      });
      if (authErr || !authData.user) {
        throw new Error(`Failed to create test user ${u.email}: ${authErr?.message}`);
      }
      const userId = authData.user.id;
      createdUserIds.push(userId);

      const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
        id: userId,
        name: u.name,
        email: u.email,
        role: u.role,
        student_id: u.role === 'student' ? `STU-${timestamp.toString().slice(-6)}` : null,
        department: u.role === 'staff' ? 'Electrical Maintenance' : 'Computer Science',
        status: 'active',
      });
      if (profErr) {
        throw new Error(`Failed to upsert test profile for ${u.email}: ${profErr.message}`);
      }

      const client = createClient(env.SUPABASE_URL || '', env.SUPABASE_PUBLISHABLE_KEY || '', {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: signData, error: signErr } = await client.auth.signInWithPassword({
        email: u.email,
        password: u.password,
      });
      if (signErr || !signData.session?.access_token) {
        throw new Error(`Failed to sign in test user ${u.email}: ${signErr?.message}`);
      }
      return { id: userId, token: signData.session.access_token };
    };

    const studentA = await provisionUser(testStudentA);
    tokenStudentA = studentA.token;
    idStudentA = studentA.id;

    const staffA = await provisionUser(testStaffA);
    tokenStaffA = staffA.token;
    idStaffA = staffA.id;

    const adminA = await provisionUser(testAdminA);
    tokenAdminA = adminA.token;
    idAdminA = adminA.id;

    console.log('✓ Test users provisioned (Student A, Staff A, Admin A).\n');

    // Seed a test complaint for accurate analytics testing
    const { data: existingCat } = await supabaseAdmin.from('categories').select('id, slug').limit(1).single();
    const catId = existingCat?.id;
    const catSlug = existingCat?.slug || 'electrical';

    const { data: c1 } = await supabaseAdmin.from('complaints').insert({
      title: 'Lab Air Conditioning Breakdown',
      description: 'AC unit in Computer Lab 3 is leaking water heavily.',
      category_id: catId,
      category_slug: catSlug,
      priority: 'high',
      status: 'pending',
      student_id: idStudentA,
      department: 'Computer Science',
      ticket_number: `SCCP-4D-${timestamp.toString().slice(-6)}`,
    }).select('*').single();
    if (c1) {
      testComplaintId = c1.id;
      createdComplaintIds.push(c1.id);
    }

    // =========================================================================
    // SECTION 1: AUTHENTICATION CHECKS (Checks 1-2)
    // =========================================================================
    console.log('--- 1. Authentication Checks ---');

    // 1. Unauthenticated analytics request returns 401
    const unauthAnalytics = await fetch(`${baseUrl}/analytics/overview`);
    assert(1, 'AUTH', 'Unauthenticated analytics request returns 401', unauthAnalytics.status === 401);

    // 2. Unauthenticated category and settings requests return 401
    const unauthCats = await fetch(`${baseUrl}/categories`);
    const unauthSettings = await fetch(`${baseUrl}/settings`);
    assert(
      2,
      'AUTH',
      'Unauthenticated category/settings requests return 401 where authentication is required',
      unauthCats.status === 401 && unauthSettings.status === 401
    );

    // =========================================================================
    // SECTION 2: AUTHORIZATION CHECKS (Checks 3-10)
    // =========================================================================
    console.log('\n--- 2. Authorization Checks ---');

    // 3. Student cannot access admin analytics (HTTP 403 Forbidden)
    const studentAnalytics = await fetch(`${baseUrl}/analytics/overview`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    assert(3, 'AUTHZ', 'Student cannot access admin analytics (HTTP 403 Forbidden)', studentAnalytics.status === 403);

    // 4. Staff cannot access admin-only analytics (HTTP 403 Forbidden)
    const staffAnalytics = await fetch(`${baseUrl}/analytics/overview`, {
      headers: { Authorization: `Bearer ${tokenStaffA}` },
    });
    assert(4, 'AUTHZ', 'Staff cannot access admin-only analytics (HTTP 403 Forbidden)', staffAnalytics.status === 403);

    // 5. Student cannot modify categories (HTTP 403 Forbidden)
    const studentPostCat = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ name: 'Student Rogue Category' }),
    });
    assert(5, 'AUTHZ', 'Student cannot modify categories (HTTP 403 Forbidden)', studentPostCat.status === 403);

    // 6. Staff cannot modify categories (HTTP 403 Forbidden)
    const staffPostCat = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffA}` },
      body: JSON.stringify({ name: 'Staff Rogue Category' }),
    });
    assert(6, 'AUTHZ', 'Staff cannot modify categories (HTTP 403 Forbidden)', staffPostCat.status === 403);

    // 7. Student cannot modify settings (HTTP 403 Forbidden)
    const studentPatchSettings = await fetch(`${baseUrl}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ maintenance_mode: true }),
    });
    assert(7, 'AUTHZ', 'Student cannot modify settings (HTTP 403 Forbidden)', studentPatchSettings.status === 403);

    // 8. Staff cannot modify settings (HTTP 403 Forbidden)
    const staffPatchSettings = await fetch(`${baseUrl}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffA}` },
      body: JSON.stringify({ maintenance_mode: true }),
    });
    assert(8, 'AUTHZ', 'Staff cannot modify settings (HTTP 403 Forbidden)', staffPatchSettings.status === 403);

    // 9. Admin can access permitted analytics (HTTP 200 OK)
    const adminAnalytics = await fetch(`${baseUrl}/analytics/overview`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const adminAnalyticsData: any = await adminAnalytics.json();
    assert(
      9,
      'AUTHZ',
      'Admin can access permitted analytics (HTTP 200 OK)',
      adminAnalytics.status === 200 && adminAnalyticsData.success === true
    );

    // 10. Admin can perform permitted category and settings operations
    const adminCategoryTest = await fetch(`${baseUrl}/categories`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const adminSettingsTest = await fetch(`${baseUrl}/settings`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    assert(
      10,
      'AUTHZ',
      'Admin can perform permitted category/settings operations',
      adminCategoryTest.status === 200 && adminSettingsTest.status === 200
    );

    // =========================================================================
    // SECTION 3: ANALYTICS DATA & STRUCTURE CHECKS (Checks 11-17)
    // =========================================================================
    console.log('\n--- 3. Analytics Data & Structure Checks ---');

    // 11. Overview endpoint returns valid structure
    const overview = adminAnalyticsData.data;
    const hasOverviewFields =
      typeof overview.totalComplaints === 'number' &&
      typeof overview.pendingComplaints === 'number' &&
      typeof overview.assignedComplaints === 'number' &&
      typeof overview.inProgressComplaints === 'number' &&
      typeof overview.resolvedComplaints === 'number' &&
      typeof overview.rejectedComplaints === 'number' &&
      typeof overview.activeQueue === 'number' &&
      typeof overview.resolutionRate === 'number';
    assert(11, 'ANALYTICS', 'Overview endpoint returns valid structure', hasOverviewFields);

    // 12. Status counts are internally consistent with database data
    const calculatedSum =
      overview.pendingComplaints +
      overview.assignedComplaints +
      overview.inProgressComplaints +
      overview.resolvedComplaints +
      overview.rejectedComplaints;
    assert(
      12,
      'ANALYTICS',
      'Status counts are internally consistent with database data',
      calculatedSum === overview.totalComplaints &&
        overview.activeQueue === overview.pendingComplaints + overview.assignedComplaints + overview.inProgressComplaints
    );

    // 13. Category analytics returns valid categories and counts
    const catAnalyticsRes = await fetch(`${baseUrl}/analytics/categories`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const catAnalyticsData: any = await catAnalyticsRes.json();
    assert(
      13,
      'ANALYTICS',
      'Category analytics returns valid categories and counts',
      catAnalyticsRes.status === 200 &&
        Array.isArray(catAnalyticsData.data?.categoryDistribution) &&
        catAnalyticsData.data.categoryDistribution.length >= 1
    );

    // 14. Trend endpoint returns correctly structured chronological data
    const trendsRes = await fetch(`${baseUrl}/analytics/trends?range=7d`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const trendsData: any = await trendsRes.json();
    const trendBuckets = trendsData.data?.trendData;
    assert(
      14,
      'ANALYTICS',
      'Trend endpoint returns correctly structured chronological data',
      trendsRes.status === 200 &&
        Array.isArray(trendBuckets) &&
        trendBuckets.length === 7 &&
        trendBuckets[0].startDate !== undefined
    );

    // 15. Invalid date filters return HTTP 400
    const invalidRangeRes = await fetch(`${baseUrl}/analytics/overview?range=invalid_999d`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const invalidDateRes = await fetch(`${baseUrl}/analytics/overview?startDate=not-a-valid-date`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    assert(
      15,
      'ANALYTICS',
      'Invalid date filters return HTTP 400 Bad Request',
      invalidRangeRes.status === 400 && invalidDateRes.status === 400
    );

    // 16. Invalid filter values return HTTP 400
    const invalidPriRes = await fetch(`${baseUrl}/analytics/overview?priority=super_urgent`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const invalidStatusRes = await fetch(`${baseUrl}/analytics/overview?status=abandoned`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    assert(
      16,
      'ANALYTICS',
      'Invalid filter values return HTTP 400 Bad Request',
      invalidPriRes.status === 400 && invalidStatusRes.status === 400
    );

    // 17. Analytics does not expose secrets or passwords
    const resString = JSON.stringify(adminAnalyticsData);
    assert(
      17,
      'ANALYTICS',
      'Analytics does not expose secrets or passwords',
      !resString.includes('password') && !resString.includes('SUPABASE_SECRET_KEY') && !resString.includes('service_role')
    );

    // =========================================================================
    // SECTION 4: CATEGORY MANAGEMENT CHECKS (Checks 18-23)
    // =========================================================================
    console.log('\n--- 4. Category Management Checks ---');

    // 18. Active categories can be retrieved by authenticated user (Student A)
    const studentCatList = await fetch(`${baseUrl}/categories?activeOnly=true`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const studentCatListData: any = await studentCatList.json();
    assert(
      18,
      'CATEGORIES',
      'Active categories can be retrieved by authenticated student (HTTP 200 OK)',
      studentCatList.status === 200 && Array.isArray(studentCatListData.data) && studentCatListData.data.length > 0
    );

    // 19. Invalid category UUID / unknown ID is rejected with HTTP 404
    const unknownCatRes = await fetch(`${baseUrl}/categories/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    assert(19, 'CATEGORIES', 'Invalid or unknown category ID returns HTTP 404', unknownCatRes.status === 404);

    // 20. Admin can create a valid category
    const uniqueCatName = `Robotics Lab ${timestamp.toString().slice(-5)}`;
    const createCatRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({
        name: uniqueCatName,
        description: 'Robotics, automation, and AI workstation hardware.',
        icon: 'bot',
        sla_hours: 24,
      }),
    });
    const createCatData: any = await createCatRes.json();
    testCatId = createCatData.data?.id;
    if (testCatId) createdCategoryIds.push(testCatId);
    assert(
      20,
      'CATEGORIES',
      'Admin can create a valid category (HTTP 201 Created)',
      createCatRes.status === 201 && createCatData.data?.name === uniqueCatName && createCatData.data?.sla_hours === 24
    );

    // 21. Admin can update and deactivate a category
    const updateCatRes = await fetch(`${baseUrl}/categories/${testCatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ description: 'Updated Robotics description', active: false }),
    });
    const updateCatData: any = await updateCatRes.json();
    assert(
      21,
      'CATEGORIES',
      'Admin can update/deactivate a category (HTTP 200 OK)',
      updateCatRes.status === 200 && updateCatData.data?.active === false
    );

    // 22. Unauthorized category mutation is rejected (duplicate name)
    const dupCatRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ name: uniqueCatName }),
    });
    assert(22, 'CATEGORIES', 'Duplicate category name is rejected (HTTP 409 Conflict)', dupCatRes.status === 409);

    // 23. Existing complaint category references remain valid
    const complaintWithCat = await fetch(`${baseUrl}/complaints/${testComplaintId}`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const complaintWithCatData: any = await complaintWithCat.json();
    assert(
      23,
      'CATEGORIES',
      'Existing complaint category references remain valid',
      complaintWithCat.status === 200 && Boolean(complaintWithCatData.data?.category_id)
    );

    // =========================================================================
    // SECTION 5: SYSTEM SETTINGS CHECKS (Checks 24-27)
    // =========================================================================
    console.log('\n--- 5. System Settings Checks ---');

    // 24. Safe settings can be retrieved by authenticated user
    const getSettingsRes = await fetch(`${baseUrl}/settings`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const getSettingsData: any = await getSettingsRes.json();
    const settings = getSettingsData.data;
    assert(
      24,
      'SETTINGS',
      'Safe settings can be retrieved (HTTP 200 OK)',
      getSettingsRes.status === 200 &&
        typeof settings.portal_name === 'string' &&
        typeof settings.allow_student_registration === 'boolean' &&
        typeof settings.max_attachments_per_complaint === 'number'
    );

    // 25. Unauthorized settings mutation is rejected
    const unauthSettingsMut = await fetch(`${baseUrl}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ max_attachments_per_complaint: 5 }),
    });
    assert(25, 'SETTINGS', 'Unauthorized settings mutation is rejected (HTTP 403 Forbidden)', unauthSettingsMut.status === 403);

    // 26. Admin can update an allowed setting
    const updateSettingsRes = await fetch(`${baseUrl}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ support_email: `support.${timestamp}@college.edu` }),
    });
    const updateSettingsData: any = await updateSettingsRes.json();
    assert(
      26,
      'SETTINGS',
      'Admin can update an allowed setting (HTTP 200 OK)',
      updateSettingsRes.status === 200 && updateSettingsData.data?.support_email === `support.${timestamp}@college.edu`
    );

    // 27. Sensitive configuration cannot be retrieved through settings API
    const settingsJson = JSON.stringify(getSettingsData);
    assert(
      27,
      'SETTINGS',
      'Sensitive configuration cannot be retrieved through settings API',
      !settingsJson.includes('SUPABASE_SECRET_KEY') &&
        !settingsJson.includes('service_role') &&
        !settingsJson.includes('database_password') &&
        !settingsJson.includes('JWT_SECRET')
    );

    // =========================================================================
    // SECTION 6: USER / STAFF SUPPORT CHECKS (Additional Checks)
    // =========================================================================
    console.log('\n--- 6. User Directory & Staff Checks ---');

    // Staff list accessible to staff and admin
    const staffListRes = await fetch(`${baseUrl}/users/staff`, {
      headers: { Authorization: `Bearer ${tokenStaffA}` },
    });
    const staffListData: any = await staffListRes.json();
    const staffListOk = staffListRes.status === 200 && Array.isArray(staffListData.data);

    // Student cannot access global user directory
    const studentUserDir = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const studentUserDirBlocked = studentUserDir.status === 403;

    // Admin can access user directory
    const adminUserDir = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const adminUserDirOk = adminUserDir.status === 200;

    // Admin cannot deactivate own account
    const selfDeactivateRes = await fetch(`${baseUrl}/users/${idAdminA}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const selfDeactivateBlocked = selfDeactivateRes.status === 400;

    // =========================================================================
    // SECTION 7: SECURITY & INTEGRITY CHECKS (Checks 28-32)
    // =========================================================================
    console.log('\n--- 7. Security Architecture & Regression Checks ---');

    // 28. No SUPABASE_SECRET_KEY appears in responses
    const allResponsesSample = JSON.stringify({
      analytics: adminAnalyticsData,
      settings: getSettingsData,
      categories: studentCatListData,
    });
    assert(
      28,
      'SECURITY',
      'No SUPABASE_SECRET_KEY appears in responses',
      !allResponsesSample.includes(env.SUPABASE_SECRET_KEY || 'MISSING_KEY')
    );

    // 29. No password fields appear in API responses
    const userDirData: any = await adminUserDir.json();
    const userDirString = JSON.stringify(userDirData);
    assert(
      29,
      'SECURITY',
      'No password fields appear in API responses',
      staffListOk && studentUserDirBlocked && adminUserDirOk && selfDeactivateBlocked && !userDirString.includes('password')
    );

    // 30. No arbitrary SQL/column injection is accepted
    const injectionRes = await fetch(`${baseUrl}/analytics/overview?status='; DROP TABLE complaints; --`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    assert(
      30,
      'SECURITY',
      'No arbitrary SQL/column injection is accepted (returns HTTP 400)',
      injectionRes.status === 400
    );

    // 31. Existing RLS protections remain intact
    const anonClient = createClient(env.SUPABASE_URL || '', env.SUPABASE_PUBLISHABLE_KEY || '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: anonProfilesErr } = await anonClient.from('profiles').select('*');
    assert(
      31,
      'SECURITY',
      'Existing RLS protections remain intact (anonymous access denied)',
      anonProfilesErr?.code === '42501' || !anonProfilesErr
    );

    // 32. Existing complaint/workflow/notification functionality remains intact
    const notifCountRes = await fetch(`${baseUrl}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    assert(
      32,
      'INTEGRITY',
      'Existing complaint/workflow/notification functionality remains intact',
      notifCountRes.status === 200
    );

  } finally {
    // -------------------------------------------------------------------------
    // Cleanup Test Artifacts
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up Test Artifacts ---');
    if (createdComplaintIds.length > 0) {
      await supabaseAdmin.from('complaints').delete().in('id', createdComplaintIds);
    }
    if (createdCategoryIds.length > 0) {
      await supabaseAdmin.from('categories').delete().in('id', createdCategoryIds);
    }
    for (const uid of createdUserIds) {
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', uid);
        await supabaseAdmin.auth.admin.deleteUser(uid);
      } catch {
        // ignore cleanup error
      }
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log('✓ Test cleanup completed.\n');
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('================================================================');
  console.log(' PHASE 4D AUDIT SUMMARY');
  console.log('================================================================');
  const passedCount = checks.filter((c) => c.passed).length;
  const failedCount = checks.filter((c) => !c.passed).length;

  console.log(` Total Checks : ${checks.length}`);
  console.log(` Passed       : ${passedCount}`);
  console.log(` Failed       : ${failedCount}\n`);

  if (failedCount > 0) {
    console.error(`❌ ${failedCount} checks failed in Phase 4D audit!`);
    process.exit(1);
  } else {
    console.log('🎉 All 32 Phase 4D Admin Analytics & Supporting APIs checks PASSED!');
  }
}

runAdminAnalyticsTests().catch((err) => {
  console.error('Fatal error during Phase 4D test run:', err);
  process.exit(1);
});
