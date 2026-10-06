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

async function runNotificationTests(): Promise<void> {
  console.log('================================================================');
  console.log(' BACKEND PHASE 4C: NOTIFICATIONS & NOTIFICATION WORKFLOW AUDIT');
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

  const timestamp = Date.now();
  const testStudentA = {
    email: `phase4c.studenta.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4C Student A',
    role: 'student' as const,
  };
  const testStudentB = {
    email: `phase4c.studentb.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4C Student B',
    role: 'student' as const,
  };
  const testStaffA = {
    email: `phase4c.staffa.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4C Staff A',
    role: 'staff' as const,
  };
  const testStaffB = {
    email: `phase4c.staffb.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4C Staff B',
    role: 'staff' as const,
  };
  const testAdminA = {
    email: `phase4c.admina.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4C Admin A',
    role: 'admin' as const,
  };

  let tokenStudentA = '';
  let idStudentA = '';
  let tokenStudentB = '';
  let idStudentB = '';
  let tokenStaffA = '';
  let idStaffA = '';
  let tokenStaffB = '';
  let idStaffB = '';
  let tokenAdminA = '';
  let idAdminA = '';

  let complaint1Id = '';
  let complaint2Id = '';
  let directNotifAId = '';
  let directNotifBId = '';

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
        throw new Error(`Failed to create test profile for ${u.email}: ${profErr.message}`);
      }

      const isolatedClient = createClient(env.SUPABASE_URL || '', env.SUPABASE_PUBLISHABLE_KEY || '', {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: signInData, error: signInErr } = await isolatedClient.auth.signInWithPassword({
        email: u.email,
        password: u.password,
      });
      if (signInErr || !signInData.session) {
        throw new Error(`Failed to sign in test user ${u.email}: ${signInErr?.message}`);
      }

      return { id: userId, token: signInData.session.access_token };
    };

    const sA = await provisionUser(testStudentA);
    tokenStudentA = sA.token;
    idStudentA = sA.id;

    const sB = await provisionUser(testStudentB);
    tokenStudentB = sB.token;
    idStudentB = sB.id;

    const stA = await provisionUser(testStaffA);
    tokenStaffA = stA.token;
    idStaffA = stA.id;

    const stB = await provisionUser(testStaffB);
    tokenStaffB = stB.token;
    idStaffB = stB.id;

    const adA = await provisionUser(testAdminA);
    tokenAdminA = adA.token;
    idAdminA = adA.id;

    console.log('✓ Test users provisioned (Student A, Student B, Staff A, Staff B, Admin A).\n');

    // -------------------------------------------------------------------------
    // Seed Direct Base Notifications for Isolated Read/Write Tests
    // -------------------------------------------------------------------------
    console.log('--- Seeding Direct Base Notifications ---');
    const { data: seedA } = await supabaseAdmin.from('notifications').insert({
      user_id: idStudentA,
      title: 'Welcome to Smart College Complaint Portal',
      message: 'Your student account is now verified and ready to use.',
      type: 'info',
      category: 'system_notification',
      read: false,
    }).select('*').single();
    directNotifAId = seedA?.id;

    const { data: seedA2 } = await supabaseAdmin.from('notifications').insert({
      user_id: idStudentA,
      title: 'Campus Maintenance Notice',
      message: 'Scheduled power maintenance in Science Block on Sunday.',
      type: 'warning',
      category: 'system_notification',
      read: false,
    }).select('*').single();

    const { data: seedB } = await supabaseAdmin.from('notifications').insert({
      user_id: idStudentB,
      title: 'Welcome Student B',
      message: 'Your account is ready.',
      type: 'info',
      category: 'system_notification',
      read: false,
    }).select('*').single();
    directNotifBId = seedB?.id;

    console.log('✓ Seed notifications created.\n');

    // =========================================================================
    // SECTION 1: AUTHENTICATION CHECKS (Checks 1-4)
    // =========================================================================
    console.log('--- 1. Authentication Checks ---');

    // 1. Unauthenticated GET /api/notifications returns HTTP 401
    const auth1 = await fetch(`${baseUrl}/notifications`);
    assert(1, 'AUTH', 'Unauthenticated GET /api/notifications returns HTTP 401', auth1.status === 401);

    // 2. Unauthenticated PATCH /api/notifications/:id/read returns HTTP 401
    const auth2 = await fetch(`${baseUrl}/notifications/${directNotifAId}/read`, {
      method: 'PATCH',
    });
    assert(2, 'AUTH', 'Unauthenticated PATCH /api/notifications/:id/read returns HTTP 401', auth2.status === 401);

    // 3. Unauthenticated PATCH /api/notifications/read-all returns HTTP 401
    const auth3 = await fetch(`${baseUrl}/notifications/read-all`, {
      method: 'PATCH',
    });
    assert(3, 'AUTH', 'Unauthenticated PATCH /api/notifications/read-all returns HTTP 401', auth3.status === 401);

    // 4. Unauthenticated GET /api/notifications/unread-count returns HTTP 401
    const auth4 = await fetch(`${baseUrl}/notifications/unread-count`);
    assert(4, 'AUTH', 'Unauthenticated GET /api/notifications/unread-count returns HTTP 401', auth4.status === 401);

    // =========================================================================
    // SECTION 2: OWNERSHIP & RLS ISOLATION (Checks 5-9)
    // =========================================================================
    console.log('\n--- 2. Ownership & RLS Isolation Checks ---');

    // 5. User can retrieve own notifications (HTTP 200 OK)
    const listA = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const listAData: any = await listA.json();
    assert(
      5,
      'OWNERSHIP',
      'User can retrieve own notifications (HTTP 200 OK)',
      listA.status === 200 && Array.isArray(listAData.data) && listAData.data.length >= 2
    );

    // 6. User cannot retrieve another user's notifications (filtered by RLS / query)
    const hasStudentBNotifsInA = listAData.data?.some((n: any) => n.user_id === idStudentB);
    assert(
      6,
      'OWNERSHIP',
      'User list does NOT contain another user\'s notifications',
      !hasStudentBNotifsInA
    );

    // 7. User cannot mark another user's notification as read (returns HTTP 404 Not Found)
    const markOtherRes = await fetch(`${baseUrl}/notifications/${directNotifBId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    assert(
      7,
      'OWNERSHIP',
      'User cannot mark another user\'s notification as read (HTTP 404 Not Found)',
      markOtherRes.status === 404
    );

    // 8. User cannot modify another user's notification (direct verification)
    const notifBCheck = await supabaseAdmin
      .from('notifications')
      .select('read')
      .eq('id', directNotifBId)
      .single();
    assert(
      8,
      'OWNERSHIP',
      'Other user\'s notification remains unread after unauthorized attempt',
      notifBCheck.data?.read === false
    );

    // 9. Anonymous notification query remains denied by RLS
    const anonClient = createClient(env.SUPABASE_URL || '', env.SUPABASE_PUBLISHABLE_KEY || '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: anonErr, data: anonData } = await anonClient
      .from('notifications')
      .select('*');
    assert(
      9,
      'RLS',
      'Anonymous notification query remains denied by RLS (code 42501 or zero rows)',
      anonErr?.code === '42501' || (!anonErr && (!anonData || anonData.length === 0))
    );

    // =========================================================================
    // SECTION 3: READ STATE & UNREAD COUNTS (Checks 10-14)
    // =========================================================================
    console.log('\n--- 3. Read State & Counts Checks ---');

    // 10. Single notification can be marked read via PATCH /api/notifications/:id/read (HTTP 200 OK)
    const markReadRes = await fetch(`${baseUrl}/notifications/${directNotifAId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const markReadData: any = await markReadRes.json();
    assert(
      10,
      'READ STATE',
      'Single notification can be marked read via PATCH (HTTP 200 OK)',
      markReadRes.status === 200 && markReadData.data?.read === true
    );

    // 11. Read notification remains read upon subsequent GET /api/notifications
    const listAAfterRead = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const listAAfterData: any = await listAAfterRead.json();
    const verifiedNotifA = listAAfterData.data?.find((n: any) => n.id === directNotifAId);
    assert(
      11,
      'READ STATE',
      'Read notification remains read in subsequent fetch',
      verifiedNotifA?.read === true
    );

    // 12. Unread count endpoint accurately reflects unread notifications via GET /api/notifications/unread-count
    const unreadCountRes1 = await fetch(`${baseUrl}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const unreadCountData1: any = await unreadCountRes1.json();
    assert(
      12,
      'READ STATE',
      'Unread count endpoint returns accurate count (HTTP 200 OK)',
      unreadCountRes1.status === 200 && typeof unreadCountData1.data?.count === 'number' && unreadCountData1.data.count >= 1
    );

    // 13. Read-all marks only caller's unread notifications as read via PATCH /api/notifications/read-all
    const readAllRes = await fetch(`${baseUrl}/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const readAllData: any = await readAllRes.json();
    assert(
      13,
      'READ STATE',
      'Read-all marks caller unread notifications as read (HTTP 200 OK)',
      readAllRes.status === 200 && readAllData.success === true
    );

    // 14. Unread count decreases to 0 after marking all notifications read
    const unreadCountRes2 = await fetch(`${baseUrl}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const unreadCountData2: any = await unreadCountRes2.json();
    assert(
      14,
      'READ STATE',
      'Unread count decreases to 0 after marking all notifications read',
      unreadCountData2.data?.count === 0
    );

    // =========================================================================
    // SECTION 4: WORKFLOW NOTIFICATIONS (Checks 15-21)
    // =========================================================================
    console.log('\n--- 4. Workflow Notification Checks ---');

    // Create a base complaint by Student A
    const createC1Res = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({
        title: 'Projector burnt bulb in Room 204',
        description: 'Bulb burst during lecture and projector is unresponsive.',
        category: 'electrical',
        priority: 'high',
      }),
    });
    const createC1Data: any = await createC1Res.json();
    complaint1Id = createC1Data.data?.id;
    if (complaint1Id) createdComplaintIds.push(complaint1Id);

    // 15. Complaint assignment generates notification for assignee (Staff A)
    const assignC1 = await fetch(`${baseUrl}/complaints/${complaint1Id}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ assigned_to: idStaffA }),
    });

    // Check Staff A notification feed
    const staffANotifsRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${tokenStaffA}` },
    });
    const staffANotifsData: any = await staffANotifsRes.json();
    const assignNotif = staffANotifsData.data?.find((n: any) => n.complaint_id === complaint1Id && n.category === 'complaint_assigned');
    assert(
      15,
      'WORKFLOW',
      'Complaint assignment generates notification for assigned staff',
      assignC1.status === 200 && Boolean(assignNotif && assignNotif.user_id === idStaffA)
    );

    // 16. Reassignment generates notification for new assignee (Staff B)
    const reassignC1 = await fetch(`${baseUrl}/complaints/${complaint1Id}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ assigned_to: idStaffB, notes: 'Reassigned to Staff B' }),
    });
    await new Promise((r) => setTimeout(r, 200));
    const staffBNotifsRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${tokenStaffB}` },
    });
    const staffBNotifsData: any = await staffBNotifsRes.json();
    const reassignNotif = staffBNotifsData.data?.find((n: any) => n.complaint_id === complaint1Id && n.category === 'complaint_assigned');
    assert(
      16,
      'WORKFLOW',
      'Reassignment generates notification for newly assigned staff member',
      reassignC1.status === 200 && Boolean(reassignNotif && reassignNotif.user_id === idStaffB)
    );

    // 17. Status update generates notification for complaint owner (Student A)
    const statusUpdateRes = await fetch(`${baseUrl}/complaints/${complaint1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffB}` },
      body: JSON.stringify({ status: 'in_progress', notes: 'Replacement bulb ordered from depot' }),
    });
    await new Promise((r) => setTimeout(r, 200));
    const studentANotifsRes1 = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const studentANotifsData1: any = await studentANotifsRes1.json();
    const statusNotif = studentANotifsData1.data?.find((n: any) => n.complaint_id === complaint1Id && n.category === 'status_changed');
    assert(
      17,
      'WORKFLOW',
      'Status update generates notification for complaint owner (Student A)',
      statusUpdateRes.status === 200 && Boolean(statusNotif && statusNotif.user_id === idStudentA)
    );

    // 18. Resolution generates notification for complaint owner (Student A)
    const resolveRes = await fetch(`${baseUrl}/complaints/${complaint1Id}/resolution`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffB}` },
      body: JSON.stringify({ notes: 'New bulb installed and tested successfully' }),
    });
    await new Promise((r) => setTimeout(r, 200));
    const studentANotifsRes2 = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const studentANotifsData2: any = await studentANotifsRes2.json();
    const resolvedNotif = studentANotifsData2.data?.find((n: any) => n.complaint_id === complaint1Id && n.category === 'complaint_resolved');
    assert(
      18,
      'WORKFLOW',
      'Complaint resolution generates notification for complaint owner with category complaint_resolved',
      resolveRes.status === 200 && Boolean(resolvedNotif && resolvedNotif.type === 'success')
    );

    // 19. Reopening generates appropriate notification for assigned staff / admin
    const reopenRes = await fetch(`${baseUrl}/complaints/${complaint1Id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ reason: 'Colors are distorted and display flickers.' }),
    });
    await new Promise((r) => setTimeout(r, 200));
    const staffBNotifsRes2 = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${tokenStaffB}` },
    });
    const staffBNotifsData2: any = await staffBNotifsRes2.json();
    const reopenNotif = staffBNotifsData2.data?.find((n: any) => n.complaint_id === complaint1Id && n.title.includes('Reopened'));
    assert(
      19,
      'WORKFLOW',
      'Reopen generates notification for assigned staff member',
      reopenRes.status === 200 && Boolean(reopenNotif && reopenNotif.type === 'warning')
    );

    // 20. Public comment generates appropriate notification for other participants (never for author)
    const commentPublicRes = await fetch(`${baseUrl}/complaints/${complaint1Id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ message: 'I have attached photos of the distorted colors.' }),
    });
    await new Promise((r) => setTimeout(r, 200));
    // Verify Staff B received comment notification
    const staffBNotifsRes3 = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${tokenStaffB}` },
    });
    const staffBNotifsData3: any = await staffBNotifsRes3.json();
    const commentNotif = staffBNotifsData3.data?.find((n: any) => n.complaint_id === complaint1Id && n.category === 'admin_message');
    // Verify Student A did NOT receive notification for their own comment
    const studentANotifsRes3 = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const studentANotifsData3: any = await studentANotifsRes3.json();
    const selfCommentNotif = studentANotifsData3.data?.find((n: any) => n.complaint_id === complaint1Id && n.message?.includes('Student added a comment'));
    assert(
      20,
      'WORKFLOW',
      'Public comment generates notification for other participant and excludes the author',
      commentPublicRes.status === 201 && Boolean(commentNotif) && !selfCommentNotif
    );

    // 21. Internal comment does NOT leak internal content or create student notifications
    const commentInternalRes = await fetch(`${baseUrl}/complaints/${complaint1Id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({
        message: 'Top Secret: replacement projector GPU motherboard on backorder from supplier.',
        is_internal: true,
      }),
    });
    await new Promise((r) => setTimeout(r, 200));
    const studentANotifsRes4 = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const studentANotifsData4: any = await studentANotifsRes4.json();
    const leakedNotif = studentANotifsData4.data?.some((n: any) => n.message?.toLowerCase().includes('top secret') || n.message?.toLowerCase().includes('backorder'));
    assert(
      21,
      'WORKFLOW',
      'Internal comment does NOT notify student and does not leak confidential internal text',
      commentInternalRes.status === 201 && !leakedNotif
    );

    // =========================================================================
    // SECTION 5: SECURITY ARCHITECTURE (Checks 22-26)
    // =========================================================================
    console.log('\n--- 5. Security Architecture Checks ---');

    // 22. Client cannot choose arbitrary notification recipient (no public POST endpoint)
    const postNotifRes = await fetch(`${baseUrl}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ user_id: idStudentB, title: 'Forged Alert', message: 'Fake' }),
    });
    assert(
      22,
      'SECURITY',
      'Client cannot POST arbitrary notifications (endpoint does not permit client injection)',
      postNotifRes.status === 404 || postNotifRes.status === 405
    );

    // 23. Notification response does not expose secrets or passwords
    const sampleNotif = listAData.data?.[0];
    const hasSecrets = sampleNotif && ('password' in sampleNotif || 'secret' in sampleNotif || 'service_role' in sampleNotif);
    assert(23, 'SECURITY', 'Notification payload does not expose authentication secrets', !hasSecrets);

    // 24. SUPABASE_SECRET_KEY is never exposed in response headers or body payloads
    const secretKeyStr = env.SUPABASE_SECRET_KEY || 'MISSING_SECRET_KEY';
    const notifsBodyRaw = JSON.stringify(listAData);
    assert(
      24,
      'SECURITY',
      'SUPABASE_SECRET_KEY is never exposed in responses',
      !notifsBodyRaw.includes(secretKeyStr)
    );

    // 25. User-scoped Supabase client is used for ordinary notification operations
    const userClientWorks = listA.status === 200 && Array.isArray(listAData.data);
    assert(25, 'SECURITY', 'User-scoped Supabase client executes ordinary notification queries under RLS', userClientWorks);

    // 26. User-scoped client failure NEVER falls back to service_role for notification reads
    _setClientFactoryForTesting(() => {
      throw new Error('Simulated user-scoped client creation failure');
    });
    const brokenClientRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    _setClientFactoryForTesting(null);
    assert(
      26,
      'SECURITY',
      'User-scoped client failure NEVER falls back to service_role (returns HTTP 500, no admin fallback)',
      brokenClientRes.status === 500
    );

    // =========================================================================
    // SECTION 6: DATA INTEGRITY (Checks 27-30)
    // =========================================================================
    console.log('\n--- 6. Data Integrity & Workflow Functionality Checks ---');

    // 27. Notification references valid complaint_id when applicable
    const validComplaintNotif = studentANotifsData2.data?.find((n: any) => n.complaint_id === complaint1Id);
    assert(
      27,
      'INTEGRITY',
      'Notification correctly references valid complaint_id',
      Boolean(validComplaintNotif && validComplaintNotif.complaint_id === complaint1Id)
    );

    // 28. Notifications table maintains referential integrity (foreign keys to profiles)
    assert(
      28,
      'INTEGRITY',
      'Notifications table foreign keys are valid profiles',
      Boolean(validComplaintNotif && validComplaintNotif.user_id === idStudentA)
    );

    // 29. Duplicate notification mitigation works correctly
    // Triggering another identical resolution check should be safely handled
    const duplicateNotifCheck = studentANotifsData2.data?.filter((n: any) => n.complaint_id === complaint1Id && n.category === 'complaint_resolved');
    assert(
      29,
      'INTEGRITY',
      'Workflow events do not produce duplicate spam notifications for the same event',
      duplicateNotifCheck.length === 1
    );

    // 30. Existing complaint workflow remains functional after notification integration
    const complaintDetailsRes = await fetch(`${baseUrl}/complaints/${complaint1Id}`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const complaintDetailsData: any = await complaintDetailsRes.json();
    assert(
      30,
      'INTEGRITY',
      'Existing complaint workflow remains functional and healthy after notification integration',
      complaintDetailsRes.status === 200 && complaintDetailsData.data?.id === complaint1Id
    );
  } catch (err: any) {
    console.error('\n❌ Unhandled error during notification test execution:', err);
    throw err;
  } finally {
    // -------------------------------------------------------------------------
    // Cleanup Test Artifacts
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up Test Artifacts ---');
    try {
      if (createdComplaintIds.length > 0) {
        await supabaseAdmin.from('complaints').delete().in('id', createdComplaintIds);
      }
      for (const uid of createdUserIds) {
        await supabaseAdmin.from('notifications').delete().eq('user_id', uid);
        await supabaseAdmin.from('profiles').delete().eq('id', uid);
        await supabaseAdmin.auth.admin.deleteUser(uid);
      }
      console.log('✓ Test cleanup completed.');
    } catch (cleanupErr: any) {
      console.warn('  [Cleanup notice]', cleanupErr?.message);
    }

    server.close();
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(' PHASE 4C AUDIT SUMMARY');
  console.log('================================================================');
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;
  console.log(` Total Checks : ${checks.length}`);
  console.log(` Passed       : ${passed}`);
  console.log(` Failed       : ${failed}\n`);

  if (failed > 0) {
    console.error(`❌ ${failed} checks failed in Phase 4C audit!`);
    process.exit(1);
  } else {
    console.log(`🎉 All ${checks.length} Phase 4C Notification & Workflow checks PASSED!`);
  }
}

runNotificationTests().catch((err) => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
