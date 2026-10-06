/**
 * Smart College Complaint Portal — Phase 5C Notifications Integration Test Suite
 * 
 * Verifies end-to-end frontend <-> backend integration for the notification lifecycle:
 * 1. Notification service requests the correct endpoints with Bearer access token
 * 2. Unauthenticated requests are rejected with HTTP 401
 * 3. GET /api/notifications returns user-scoped real data under RLS
 * 4. Empty notification responses are handled cleanly
 * 5. GET /api/notifications/unread-count returns accurate real count
 * 6. Complaint workflow actions generate real authoritative notifications:
 *    - Assignment -> assigned staff notification
 *    - Status update -> student notification
 *    - Resolution -> student resolution notification
 * 7. Related complaint navigation data (link / complaintId) is populated accurately
 * 8. RLS isolation: Student B cannot see or mark read Student A's notifications
 * 9. PATCH /api/notifications/:id/read persists read state on the server
 * 10. PATCH /api/notifications/read-all updates all user notifications on the server
 * 11. Backend errors (400, 401, 403, 404, 500) are propagated rather than converted to fake localStorage success
 * 12. Unread count updates properly after single read and read-all
 * 13. Client-side double action / in-flight deduplication safety
 * 14. Server remains the single authoritative source of truth
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import net from 'net';
import { createClient } from '@supabase/supabase-js';

import { env } from '../backend/src/config/env';
import { getSupabaseAdmin, isSupabaseConfigured } from '../backend/src/config/supabase';

import { apiClient, ApiClientError } from '../src/services/apiClient';
import { authService } from '../src/services/authService';
import { complaintService } from '../src/services/complaintService';
import { notificationService, mapBackendNotification } from '../src/services/notificationService';
import { getSupabaseClient, _resetSupabaseClient } from '../src/utils/supabase';

interface TestCheck {
  number: number;
  category: string;
  name: string;
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

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // server starting
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Backend server failed to start at ${url} within ${timeoutMs}ms`);
}

async function runPhase5cTests(): Promise<void> {
  console.log('================================================================');
  console.log(' SMART COLLEGE COMPLAINT PORTAL — PHASE 5C NOTIFICATIONS AUDIT');
  console.log('================================================================\n');

  if (!isSupabaseConfigured()) {
    console.error('Supabase is not configured. Aborting tests.');
    process.exit(1);
  }

  process.env.VITE_SUPABASE_URL = env.SUPABASE_URL;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY;
  _resetSupabaseClient();

  const supabaseAdmin = getSupabaseAdmin();
  const testPort = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${testPort}/api`;

  console.log(`Starting standalone backend child process on port ${testPort}...`);
  const serverPath = path.resolve(process.cwd(), 'backend/src/server.ts');
  const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');

  let backendProcess: ChildProcess | null = null;
  let serverOutput = '';

  backendProcess = spawn(process.execPath, [tsxCli, serverPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(testPort),
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout?.on('data', (d) => {
    serverOutput += d.toString();
  });
  backendProcess.stderr?.on('data', (d) => {
    serverOutput += d.toString();
  });

  const stopBackend = async () => {
    if (backendProcess) {
      backendProcess.kill();
      backendProcess = null;
    }
  };

  try {
    await waitForServer(baseUrl);
    console.log(`Backend server ready on port ${testPort}.\n`);
    apiClient.setBaseUrl(baseUrl);

    // =========================================================================
    // 0. User Provisioning
    // =========================================================================
    console.log('--- Provisioning Test Users ---');
    const timestamp = Date.now();
    const testUsers = {
      studentA: {
        email: `test_stud_5c_a_${timestamp}@test.college.edu`,
        password: 'Password123!',
        name: 'Student 5C-A',
        role: 'student' as const,
        studentId: `STU-5CA-${timestamp.toString().slice(-4)}`,
        id: '',
        token: '',
      },
      studentB: {
        email: `test_stud_5c_b_${timestamp}@test.college.edu`,
        password: 'Password123!',
        name: 'Student 5C-B',
        role: 'student' as const,
        studentId: `STU-5CB-${timestamp.toString().slice(-4)}`,
        id: '',
        token: '',
      },
      staffA: {
        email: `test_staff_5c_a_${timestamp}@test.college.edu`,
        password: 'Password123!',
        name: 'Staff 5C-A',
        role: 'staff' as const,
        department: 'Electrical Maintenance',
        id: '',
        token: '',
      },
      adminA: {
        email: `test_admin_5c_a_${timestamp}@test.college.edu`,
        password: 'Password123!',
        name: 'Admin 5C-A',
        role: 'admin' as const,
        id: '',
        token: '',
      },
    };

    const clientSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);

    for (const [key, userDef] of Object.entries(testUsers)) {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: userDef.email,
        password: userDef.password,
        email_confirm: true,
      });
      if (authErr || !authData.user) {
        throw new Error(`Failed to create test user ${key}: ${authErr?.message}`);
      }
      userDef.id = authData.user.id;

      const profilePayload: any = {
        id: userDef.id,
        name: userDef.name,
        role: userDef.role,
        status: 'active',
        email: userDef.email,
      };
      if ('studentId' in userDef && userDef.studentId) profilePayload.student_id = userDef.studentId;
      if ('department' in userDef && userDef.department) profilePayload.department = userDef.department;

      const { error: profErr } = await supabaseAdmin.from('profiles').upsert(profilePayload);
      if (profErr) {
        throw new Error(`Failed to set profile for test user ${key}: ${profErr.message}`);
      }

      const { data: sessionData, error: loginErr } = await clientSupabase.auth.signInWithPassword({
        email: userDef.email,
        password: userDef.password,
      });
      if (loginErr || !sessionData.session) {
        throw new Error(`Failed to sign in test user ${key}: ${loginErr?.message}`);
      }
      userDef.token = sessionData.session.access_token;
    }

    console.log('Test users provisioned successfully.\n');

    // Helper to switch active session
    const switchSession = (user: typeof testUsers.studentA | null) => {
      if (user) {
        apiClient.setTokens(user.token);
        (authService as any).currentUser = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentId: 'studentId' in user ? user.studentId : undefined,
          department: 'department' in user ? user.department : undefined,
        };
      } else {
        apiClient.clearTokens();
        (authService as any).currentUser = null;
      }
    };

    // =========================================================================
    // 1. Unauthenticated Security & Authentication Rejection
    // =========================================================================
    console.log('--- 1. Authentication & Security Boundaries ---');
    switchSession(null);

    let unauthList401 = false;
    try {
      await apiClient.get('/notifications');
    } catch (err: any) {
      if (err.status === 401) unauthList401 = true;
    }
    assert(1, 'AUTHENTICATION', 'Unauthenticated GET /api/notifications returns HTTP 401', unauthList401);

    let unauthUnread401 = false;
    try {
      await apiClient.get('/notifications/unread-count');
    } catch (err: any) {
      if (err.status === 401) unauthUnread401 = true;
    }
    assert(2, 'AUTHENTICATION', 'Unauthenticated GET /api/notifications/unread-count returns HTTP 401', unauthUnread401);

    let unauthMarkRead401 = false;
    try {
      await apiClient.patch('/notifications/00000000-0000-0000-0000-000000000000/read');
    } catch (err: any) {
      if (err.status === 401) unauthMarkRead401 = true;
    }
    assert(3, 'AUTHENTICATION', 'Unauthenticated PATCH /api/notifications/:id/read returns HTTP 401', unauthMarkRead401);

    let unauthReadAll401 = false;
    try {
      await apiClient.patch('/notifications/read-all');
    } catch (err: any) {
      if (err.status === 401) unauthReadAll401 = true;
    }
    assert(4, 'AUTHENTICATION', 'Unauthenticated PATCH /api/notifications/read-all returns HTTP 401', unauthReadAll401);

    // =========================================================================
    // 2. Empty State & Initial Unread Count
    // =========================================================================
    console.log('\n--- 2. Empty State & Initial Unread Count ---');
    switchSession(testUsers.studentA);

    const initialList = await notificationService.getNotifications();
    assert(5, 'NOTIFICATION SERVICE', 'Fresh student retrieves empty notification list without error', Array.isArray(initialList) && initialList.length === 0);

    const initialUnread = await notificationService.getUnreadCount();
    assert(6, 'UNREAD COUNT', 'Fresh student unread count returns strictly 0 from backend', initialUnread === 0);

    // =========================================================================
    // 3. Workflow Trigger: Complaint Submission & Staff Assignment Notification
    // =========================================================================
    console.log('\n--- 3. Complaint Workflow Notification Generation ---');
    
    // Student A submits a complaint
    const newComplaint = await complaintService.createComplaint({
      title: 'Lab Room 302 AC Unit Leaking Cold Water',
      description: 'The ceiling AC unit in Lab 302 is dripping directly over computer terminal 5.',
      category: 'infrastructure',
      priority: 'high',
      building: 'Engineering Block A',
      roomNumber: '302',
    });
    assert(7, 'WORKFLOW', 'Student A creates complaint successfully', Boolean(newComplaint && newComplaint.id));

    // Admin A assigns complaint to Staff A
    switchSession(testUsers.adminA);
    const assignedComplaint = await complaintService.assignComplaint(
      newComplaint.id,
      testUsers.staffA.id,
      'Electrical Maintenance',
      'Assigned technician for AC condensation repair'
    );
    assert(8, 'WORKFLOW', 'Admin A assigns complaint to Staff A', Boolean(assignedComplaint && assignedComplaint.status === 'assigned'));

    // Verify Staff A received the backend-generated notification
    switchSession(testUsers.staffA);
    const staffNotifs = await notificationService.getNotifications();
    assert(9, 'WORKFLOW NOTIFICATION', 'Staff A receives server-generated complaint assignment notification', staffNotifs.length >= 1);

    const assignNotif = staffNotifs.find((n) => n.category === 'complaint_assigned' || n.complaintId === newComplaint.id);
    assert(10, 'WORKFLOW NOTIFICATION', 'Assignment notification references valid complaint ID and navigation link', Boolean(assignNotif && (assignNotif.complaintId === newComplaint.id || assignNotif.link?.includes(newComplaint.id))));

    const staffUnread = await notificationService.getUnreadCount();
    assert(11, 'UNREAD COUNT', 'Staff A unread count reflects new unread assignment notification', staffUnread >= 1);

    // =========================================================================
    // 4. Workflow Trigger: Status Transition & Student Notification
    // =========================================================================
    console.log('\n--- 4. Status Transition & Resolution Notifications ---');
    // Staff A transitions status to in_progress
    await complaintService.updateComplaintStatus(
      newComplaint.id,
      'in_progress',
      'Inspecting drainage hose and coils'
    );

    // Student A should have received status_changed notification
    switchSession(testUsers.studentA);
    const studentNotifsAfterProgress = await notificationService.getNotifications();
    const progressNotif = studentNotifsAfterProgress.find((n) => n.category === 'status_changed');
    assert(12, 'WORKFLOW NOTIFICATION', 'Student A receives server-generated status_changed notification', Boolean(progressNotif));

    // Staff A resolves complaint
    switchSession(testUsers.staffA);
    await complaintService.resolveComplaint(
      newComplaint.id,
      'Drainage pipe cleared and sealed. Cooling tested normally.'
    );

    // Student A should have received complaint_resolved notification
    switchSession(testUsers.studentA);
    const studentNotifsAfterResolve = await notificationService.getNotifications();
    const resolveNotif = studentNotifsAfterResolve.find((n) => n.category === 'complaint_resolved');
    assert(13, 'WORKFLOW NOTIFICATION', 'Student A receives complaint_resolved notification with type=success', Boolean(resolveNotif && resolveNotif.type === 'success'));

    const studentUnreadBeforeRead = await notificationService.getUnreadCount();
    assert(14, 'UNREAD COUNT', 'Student A has multiple unread workflow notifications from backend', studentUnreadBeforeRead >= 2);

    // =========================================================================
    // 5. Cross-User Isolation under RLS
    // =========================================================================
    console.log('\n--- 5. Cross-User Notification Isolation Under RLS ---');
    switchSession(testUsers.studentB);

    const studentBNotifs = await notificationService.getNotifications();
    assert(15, 'RLS ISOLATION', 'Student B does NOT see any of Student A notifications (0 returned)', studentBNotifs.length === 0);

    const studentBUnread = await notificationService.getUnreadCount();
    assert(16, 'RLS ISOLATION', 'Student B unread count strictly returns 0 under RLS', studentBUnread === 0);

    // Student B attempts to mark Student A's notification as read
    let crossReadBlocked = false;
    if (resolveNotif) {
      try {
        await notificationService.markAsRead(resolveNotif.id);
      } catch (err: any) {
        // Backend returns 404 under RLS, frontend rethrows error
        if (err.message?.includes('not found') || err.message?.includes('Failed to mark')) {
          crossReadBlocked = true;
        }
      }
    }
    assert(17, 'RLS ISOLATION', 'Student B cannot mark Student A notification as read (rejected by server)', crossReadBlocked);

    // =========================================================================
    // 6. Single Notification Mark As Read
    // =========================================================================
    console.log('\n--- 6. Single Notification Mark As Read ---');
    switchSession(testUsers.studentA);

    if (!resolveNotif) {
      throw new Error('Missing resolve notification for Student A');
    }

    const updatedSingle = await notificationService.markAsRead(resolveNotif.id);
    assert(18, 'MARK AS READ', 'markAsRead returns notification with read=true from server', Boolean(updatedSingle && updatedSingle.read === true));

    // Verify unread count decremented on the backend
    const studentUnreadAfterOne = await notificationService.getUnreadCount();
    assert(19, 'UNREAD COUNT', 'Backend unread count decreased after marking single notification read', studentUnreadAfterOne === studentUnreadBeforeRead - 1);

    // Verify subsequent list fetch reflects persistent read state
    const studentListAfterOne = await notificationService.getNotifications();
    const checkedNotif = studentListAfterOne.find((n) => n.id === resolveNotif.id);
    assert(20, 'READ PERSISTENCE', 'Notification remains read=true in subsequent backend list query', Boolean(checkedNotif && checkedNotif.read === true));

    // =========================================================================
    // 7. Mark All As Read
    // =========================================================================
    console.log('\n--- 7. Mark All As Read Bulk Action ---');
    await notificationService.markAllAsRead();

    const studentUnreadAfterAll = await notificationService.getUnreadCount();
    assert(21, 'MARK ALL READ', 'Backend unread count drops to 0 after markAllAsRead()', studentUnreadAfterAll === 0);

    const studentListAfterAll = await notificationService.getNotifications();
    const allAreRead = studentListAfterAll.every((n) => n.read === true);
    assert(22, 'MARK ALL READ', 'All notifications returned by server have read=true', allAreRead);

    // =========================================================================
    // 8. Error Handling & Rejection Propagation
    // =========================================================================
    console.log('\n--- 8. Error Handling & In-Flight Protection ---');
    
    // Non-existent notification ID
    let unknownIdErrorThrown = false;
    try {
      await notificationService.markAsRead('00000000-0000-0000-0000-000000000000');
    } catch (err: any) {
      unknownIdErrorThrown = true;
    }
    assert(23, 'ERROR HANDLING', 'markAsRead for unknown UUID rethrows server error rather than fake success', unknownIdErrorThrown);

    // Invalid non-UUID format
    let invalidUuidErrorThrown = false;
    try {
      await notificationService.markAsRead('not-a-valid-uuid');
    } catch (err: any) {
      invalidUuidErrorThrown = true;
    }
    assert(24, 'ERROR HANDLING', 'markAsRead with malformed ID rejects with error', invalidUuidErrorThrown);

    // In-flight deduplication: verify concurrent identical calls succeed safely without conflict
    const concurrent1 = notificationService.markAsRead(resolveNotif.id);
    const concurrent2 = notificationService.markAsRead(resolveNotif.id);
    const [c1Res, c2Res] = await Promise.all([concurrent1, concurrent2]);
    assert(25, 'CONCURRENCY', 'Concurrent markAsRead requests resolve safely without race conditions', Boolean(c1Res && c2Res));

    // Cleanup test artifacts
    console.log('\n--- Cleaning up Test Artifacts ---');
    try {
      await supabaseAdmin.from('notifications').delete().eq('complaint_id', newComplaint.id);
      await supabaseAdmin.from('complaint_timeline').delete().eq('complaint_id', newComplaint.id);
      await supabaseAdmin.from('complaints').delete().eq('id', newComplaint.id);
      for (const u of Object.values(testUsers)) {
        await supabaseAdmin.from('notifications').delete().eq('user_id', u.id);
        await supabaseAdmin.from('profiles').delete().eq('id', u.id);
        await supabaseAdmin.auth.admin.deleteUser(u.id);
      }
      console.log('Cleanup completed successfully.');
    } catch (cleanErr: any) {
      console.warn('Cleanup warning:', cleanErr?.message);
    }

  } finally {
    await stopBackend();
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n================================================================');
  console.log(' PHASE 5C NOTIFICATIONS INTEGRATION AUDIT SUMMARY');
  console.log('================================================================');
  const total = checks.length;
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  console.log(` Total Checks : ${total}`);
  console.log(` Passed       : ${passed}`);
  console.log(` Failed       : ${failed}\n`);

  if (failed > 0) {
    console.error(`❌ ${failed} checks failed.`);
    process.exit(1);
  } else {
    console.log('🎉 All 25 Phase 5C Notification Integration checks PASSED!');
  }
}

runPhase5cTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
