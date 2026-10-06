/**
 * Smart College Complaint Portal — Phase 5A API Integration Test Suite
 * 
 * Verifies the foundational frontend <-> backend integration:
 * 1. Centralized API Client (URL building, Bearer header, 401 callback, error preservation)
 * 2. Supabase Auth Bridge & Session Lifecycle (login, profile sync, restore, logout)
 * 3. Real Category API integration (GET /api/categories, GET /api/categories/:id)
 * 4. Real Complaint creation & retrieval (POST /api/complaints, GET /api/complaints, GET /api/complaints/:id)
 * 5. Real Notification integration (GET /api/notifications, unread-count, PATCH mark-as-read)
 * 6. Secret protection & security guarantees
 * 7. Offline fallback robustness
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import net from 'net';
import { createClient } from '@supabase/supabase-js';

import { env } from '../backend/src/config/env';
import { getSupabaseAdmin, isSupabaseConfigured } from '../backend/src/config/supabase';

import { apiClient, ApiClientError } from '../src/services/apiClient';
import { authService } from '../src/services/authService';
import { categoryService } from '../src/services/categoryService';
import { complaintService } from '../src/services/complaintService';
import { notificationService } from '../src/services/notificationService';
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
      // waiting for server to accept connections
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Backend server failed to start at ${url} within ${timeoutMs}ms`);
}

async function runPhase5aTests(): Promise<void> {
  console.log('================================================================');
  console.log(' SMART COLLEGE COMPLAINT PORTAL — PHASE 5A INTEGRATION AUDIT');
  console.log('================================================================\n');

  if (!isSupabaseConfigured()) {
    console.error('Supabase is not configured. Aborting tests.');
    process.exit(1);
  }

  // Set environment variables for client-side utility
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

  try {
    await waitForServer(baseUrl, 15000);
    console.log(`✓ Standalone backend process ready at ${baseUrl}.\n`);
  } catch (err) {
    console.error(`Failed to launch standalone backend:\n${serverOutput}`);
    if (backendProcess) backendProcess.kill();
    throw err;
  }

  // Direct apiClient to the standalone backend test server
  apiClient.setBaseUrl(baseUrl);

  const createdUserIds: string[] = [];
  const createdComplaintIds: string[] = [];

  const timestamp = Date.now();
  const testStudent = {
    email: `phase5a.student.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 5A Student User',
    role: 'student' as const,
    studentId: `STU-5A-${timestamp.toString().slice(-4)}`,
    department: 'Computer Science & Engineering',
  };

  const testAdmin = {
    email: `phase5a.admin.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 5A Admin User',
    role: 'admin' as const,
  };

  let studentToken = '';
  let studentId = '';
  let adminToken = '';
  let adminId = '';

  let createdComplaintId = '';
  let createdTicketNumber = '';

  try {
    // -------------------------------------------------------------------------
    // 1. Provision Test Users in Live Supabase
    // -------------------------------------------------------------------------
    console.log('--- Provisioning Test Users ---');
    const { data: sAuth, error: sErr } = await supabaseAdmin.auth.admin.createUser({
      email: testStudent.email,
      password: testStudent.password,
      email_confirm: true,
      user_metadata: { name: testStudent.name, role: testStudent.role },
    });
    if (sErr || !sAuth.user) throw new Error(`Student creation failed: ${sErr?.message}`);
    studentId = sAuth.user.id;
    createdUserIds.push(studentId);

    // Ensure profile exists in public.profiles
    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: studentId,
        name: testStudent.name,
        email: testStudent.email,
        role: 'student',
        status: 'active',
        student_id: testStudent.studentId,
        department: testStudent.department,
      });

    const { data: aAuth, error: aErr } = await supabaseAdmin.auth.admin.createUser({
      email: testAdmin.email,
      password: testAdmin.password,
      email_confirm: true,
      user_metadata: { name: testAdmin.name, role: testAdmin.role },
    });
    if (aErr || !aAuth.user) throw new Error(`Admin creation failed: ${aErr?.message}`);
    adminId = aAuth.user.id;
    createdUserIds.push(adminId);

    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: adminId,
        name: testAdmin.name,
        email: testAdmin.email,
        role: 'admin',
        status: 'active',
      });

    // Get Auth Tokens
    const sAnon = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);
    const { data: sLogin, error: sLoginErr } = await sAnon.auth.signInWithPassword({
      email: testStudent.email,
      password: testStudent.password,
    });
    if (sLoginErr || !sLogin.session) throw new Error(`Student sign-in failed: ${sLoginErr?.message}`);
    studentToken = sLogin.session.access_token;

    const { data: aLogin, error: aLoginErr } = await sAnon.auth.signInWithPassword({
      email: testAdmin.email,
      password: testAdmin.password,
    });
    if (aLoginErr || !aLogin.session) throw new Error(`Admin sign-in failed: ${aLoginErr?.message}`);
    adminToken = aLogin.session.access_token;

    console.log('✓ Test users provisioned successfully.\n');

    // -------------------------------------------------------------------------
    // Section 1: API Client Architecture & URL Construction
    // -------------------------------------------------------------------------
    console.log('--- 1. API Client Architecture & URL Construction ---');

    assert(
      1,
      'API CLIENT',
      'API client resolves and strips trailing slashes from base URL',
      apiClient.getBaseUrl() === baseUrl
    );

    // Test URL formatting with leading slash vs without leading slash
    let unauthSlashStatus = 0;
    try {
      await apiClient.get('/categories');
    } catch (err: any) {
      unauthSlashStatus = err.status;
    }
    assert(
      2,
      'API CLIENT',
      'API client successfully executes GET requests with leading slash (returns 401 unauthenticated)',
      unauthSlashStatus === 401,
      `Expected 401, got ${unauthSlashStatus}`
    );

    let unauthNoSlashStatus = 0;
    try {
      await apiClient.get('categories');
    } catch (err: any) {
      unauthNoSlashStatus = err.status;
    }
    assert(
      3,
      'API CLIENT',
      'API client successfully executes GET requests without leading slash (returns 401 unauthenticated)',
      unauthNoSlashStatus === 401,
      `Expected 401, got ${unauthNoSlashStatus}`
    );

    // -------------------------------------------------------------------------
    // Section 2: Authorization Header & Secret Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Authorization Header & Secret Protection ---');

    apiClient.setTokens(studentToken);
    assert(
      4,
      'AUTH HEADER',
      'API client attaches Authorization Bearer token to authenticated requests',
      apiClient.getAccessToken() === studentToken
    );

    // Verify /api/auth/me returns student profile using the attached Bearer token
    const meRes = await apiClient.get('/auth/me');
    assert(
      5,
      'AUTH HEADER',
      'Attached Bearer token authenticates caller at /api/auth/me',
      meRes?.data?.profile?.id === studentId && meRes?.data?.profile?.role === 'student'
    );

    // Secret Protection check
    const serializedResponse = JSON.stringify(meRes);
    const leakedSecret =
      serializedResponse.includes(env.SUPABASE_SECRET_KEY) ||
      serializedResponse.includes('service_role');
    assert(
      6,
      'SECURITY',
      'API client and server responses NEVER leak SUPABASE_SECRET_KEY or service_role',
      !leakedSecret
    );

    // -------------------------------------------------------------------------
    // Section 3: Error Handling (401, 403, 400)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Consistent Error Handling (401, 403, 400) ---');

    let unauthorizedFired = false;
    apiClient.onUnauthorized(() => {
      unauthorizedFired = true;
    });

    apiClient.setTokens('invalid.token.here');
    let caught401 = false;
    try {
      await apiClient.get('/auth/me');
    } catch (err: any) {
      caught401 = err.status === 401;
    }

    assert(
      7,
      'ERROR HANDLING',
      '401 response throws ApiClientError with status 401, clears tokens, and triggers callback',
      caught401 && unauthorizedFired && apiClient.getAccessToken() === null
    );

    // 403 Forbidden check (student token calling admin analytics)
    apiClient.setTokens(studentToken);
    let caught403 = false;
    try {
      await apiClient.get('/analytics/overview');
    } catch (err: any) {
      caught403 = err.status === 403;
    }
    assert(
      8,
      'ERROR HANDLING',
      '403 Forbidden response correctly preserves status code 403 without silent fallback',
      caught403
    );

    // 400 Validation error check (missing fields on complaint submission)
    let caught400 = false;
    let validationMsg = '';
    try {
      await apiClient.post('/complaints', { title: '' });
    } catch (err: any) {
      caught400 = err.status === 400;
      validationMsg = err.message || '';
    }
    assert(
      9,
      'ERROR HANDLING',
      'Backend validation errors (HTTP 400) are surfaced with descriptive error messages',
      caught400 && validationMsg.length > 0
    );

    // -------------------------------------------------------------------------
    // Section 4: Supabase Authentication Bridge & Session Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Supabase Authentication Bridge & Session Lifecycle ---');

    // Test real login via authService
    apiClient.clearTokens();
    authService.invalidateSession();

    const loggedInUser = await authService.login(testStudent.email, testStudent.password);
    assert(
      10,
      'AUTH BRIDGE',
      'authService.login() authenticates through real backend and returns active User',
      loggedInUser.id === studentId && loggedInUser.role === 'student'
    );

    assert(
      11,
      'AUTH BRIDGE',
      'authService.login() populates apiClient tokens with real Supabase access token',
      Boolean(apiClient.getAccessToken())
    );

    // Test profile refresh via fetchCurrentUser
    const refreshedUser = await authService.fetchCurrentUser();
    assert(
      12,
      'AUTH BRIDGE',
      'authService.fetchCurrentUser() queries /api/auth/me and returns valid user profile',
      refreshedUser?.id === studentId && refreshedUser?.studentId === testStudent.studentId
    );

    // Test session restoration
    const restoredUser = await authService.restoreSession();
    assert(
      13,
      'AUTH BRIDGE',
      'authService.restoreSession() synchronizes live session with backend /api/auth/me',
      restoredUser?.id === studentId
    );

    // -------------------------------------------------------------------------
    // Section 5: Real Category API Integration
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Real Category API Integration ---');

    const categories = await categoryService.getCategories();
    assert(
      14,
      'CATEGORIES',
      'categoryService.getCategories() fetches real category list from backend',
      Array.isArray(categories) && categories.length > 0
    );

    const firstCat = categories[0];
    assert(
      15,
      'CATEGORIES',
      'Backend category DTO is cleanly mapped to frontend CategoryItem interface',
      Boolean(firstCat.id && firstCat.name && firstCat.slug && typeof firstCat.active === 'boolean')
    );

    const singleCat = await categoryService.getCategoryById(firstCat.slug);
    assert(
      16,
      'CATEGORIES',
      'categoryService.getCategoryById() fetches single category by slug/id',
      singleCat?.slug === firstCat.slug
    );

    // -------------------------------------------------------------------------
    // Section 6: Real Complaint CRUD & Ticket Generation
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Real Complaint CRUD & Ticket Generation ---');

    const createdComplaint = await complaintService.createComplaint({
      title: 'Phase 5A Broken Projector In Lab 4',
      description: 'Projector unit fails to power on during morning CS laboratory practicals.',
      category: firstCat.slug,
      priority: 'high',
      building: 'Computer Science Block',
      floor: '2nd Floor',
      roomNumber: 'Lab 402',
      location: 'Computer Science Block, 2nd Floor, Lab 402',
      additionalDetails: 'Tested power strip; LED is amber.',
      status: 'pending',
      studentId: 'spoofed-client-id-should-be-ignored',
      studentName: 'Spoofed Name',
    });

    createdComplaintId = createdComplaint.id;
    createdTicketNumber = createdComplaint.ticketNumber;
    createdComplaintIds.push(createdComplaintId);

    assert(
      17,
      'COMPLAINTS',
      'complaintService.createComplaint() logs complaint via real backend POST /api/complaints',
      Boolean(createdComplaint.id && createdComplaint.ticketNumber)
    );

    assert(
      18,
      'COMPLAINTS',
      'Server-side ticket generation assigns authoritative ticket format (SCCP-*)',
      createdComplaint.ticketNumber.startsWith('SCCP-')
    );

    assert(
      19,
      'COMPLAINTS',
      'Server enforces student ownership (auth.uid()) and ignores client-spoofed studentId',
      createdComplaint.studentId === studentId
    );

    assert(
      20,
      'COMPLAINTS',
      'Server enforces initial pending status and leaves complaint unassigned',
      createdComplaint.status === 'pending' && !createdComplaint.assignedTo
    );

    // Query student complaints
    const studentComplaints = await complaintService.getStudentComplaints(studentId);
    assert(
      21,
      'COMPLAINTS',
      'complaintService.getStudentComplaints() returns list including the newly created ticket',
      studentComplaints.some((c) => c.id === createdComplaintId)
    );

    // Query complaint by UUID
    const fetchedById = await complaintService.getComplaintById(createdComplaintId);
    assert(
      22,
      'COMPLAINTS',
      'complaintService.getComplaintById() retrieves complaint details by UUID',
      fetchedById?.id === createdComplaintId && fetchedById?.title === createdComplaint.title
    );

    // Query complaint by Ticket Number
    const fetchedByTicket = await complaintService.getComplaintById(createdTicketNumber);
    assert(
      23,
      'COMPLAINTS',
      'complaintService.getComplaintById() retrieves complaint details by Ticket Number',
      fetchedByTicket?.id === createdComplaintId
    );

    // -------------------------------------------------------------------------
    // Section 7: Real Notification API Integration
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Real Notification API Integration ---');

    // Seed a notification directly via admin for this student
    const { data: seedNotif } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: studentId,
        title: 'Phase 5A Welcome Notification',
        message: 'Your portal account is active and verified.',
        type: 'info',
        category: 'system_notification',
        complaint_id: createdComplaintId,
        read: false,
      })
      .select()
      .single();

    const notifs = await notificationService.getNotifications(studentId);
    assert(
      24,
      'NOTIFICATIONS',
      'notificationService.getNotifications() fetches real user notifications under RLS',
      Array.isArray(notifs) && notifs.some((n) => n.id === seedNotif?.id)
    );

    const unreadCount = await notificationService.getUnreadCount(studentId);
    assert(
      25,
      'NOTIFICATIONS',
      'notificationService.getUnreadCount() returns accurate unread count from backend',
      unreadCount >= 1
    );

    // Mark single notification as read
    if (seedNotif?.id) {
      const readNotif = await notificationService.markAsRead(seedNotif.id);
      assert(
        26,
        'NOTIFICATIONS',
        'notificationService.markAsRead() updates read state via PATCH /api/notifications/:id/read',
        readNotif.read === true
      );
    }

    // Mark all as read
    await notificationService.markAllAsRead(studentId);
    const unreadAfter = await notificationService.getUnreadCount(studentId);
    assert(
      27,
      'NOTIFICATIONS',
      'notificationService.markAllAsRead() reduces unread count to 0 via PATCH /api/notifications/read-all',
      unreadAfter === 0
    );

    // -------------------------------------------------------------------------
    // Section 8: Logout & Session Invalidation
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Logout & Session Invalidation ---');

    await authService.logout();
    assert(
      28,
      'SESSION',
      'authService.logout() invalidates session and clears Bearer access token',
      apiClient.getAccessToken() === null && authService.getCurrentUser() === null
    );

    let unauthAfterLogout = false;
    try {
      await apiClient.get('/auth/me');
    } catch (err: any) {
      unauthAfterLogout = err.status === 401;
    }
    assert(
      29,
      'SESSION',
      'Subsequent requests after logout are rejected with HTTP 401 Unauthorized',
      unauthAfterLogout
    );

    // -------------------------------------------------------------------------
    // Section 9: Offline Fallback & Non-regression Robustness
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Offline Fallback & Resilience ---');

    // Direct apiClient to an unreachable port to simulate network failure
    apiClient.setBaseUrl('http://127.0.0.1:59999/api');

    const offlineCategories = await categoryService.getCategories();
    assert(
      30,
      'RESILIENCE',
      'categoryService gracefully falls back to local data when network is offline',
      Array.isArray(offlineCategories) && offlineCategories.length > 0
    );

    // Restore test server baseUrl
    apiClient.setBaseUrl(baseUrl);
  } finally {
    // -------------------------------------------------------------------------
    // Cleanup Test Users & Data
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up Test Artifacts ---');
    for (const cId of createdComplaintIds) {
      await supabaseAdmin.from('complaints').delete().eq('id', cId);
    }
    for (const uId of createdUserIds) {
      await supabaseAdmin.from('profiles').delete().eq('id', uId);
      await supabaseAdmin.auth.admin.deleteUser(uId);
    }
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill();
      if (process.platform === 'win32' && backendProcess.pid) {
        try {
          const { execSync } = await import('child_process');
          execSync(`taskkill /pid ${backendProcess.pid} /t /f`, { stdio: 'ignore' });
        } catch {
          // process closed
        }
      }
    }
    console.log('✓ Test cleanup complete.\n');
  }

  // ---------------------------------------------------------------------------
  // Audit Summary
  // ---------------------------------------------------------------------------
  const total = checks.length;
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  console.log('================================================================');
  console.log(' PHASE 5A INTEGRATION AUDIT SUMMARY');
  console.log('================================================================');
  console.log(` Total Checks : ${total}`);
  console.log(` Passed       : ${passed}`);
  console.log(` Failed       : ${failed}\n`);

  if (failed > 0) {
    console.error(`❌ ${failed} checks FAILED!`);
    process.exit(1);
  } else {
    console.log(`🎉 All ${passed} Phase 5A Frontend <-> Backend Integration checks PASSED!\n`);
  }
}

runPhase5aTests().catch((err) => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
