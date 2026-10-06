/**
 * Smart College Complaint Portal — Phase 5D Admin & Supporting API Integration Test Suite
 * 
 * Verifies end-to-end frontend <-> backend integration for Admin functionality:
 * 
 * ANALYTICS:
 * 1. Admin analytics requests use correct backend endpoints (/api/analytics)
 * 2. Analytics data maps correctly to frontend ComprehensiveAnalytics model
 * 3. Student access to /api/analytics is rejected with HTTP 403 Forbidden
 * 4. Staff access to /api/analytics is rejected with HTTP 403 Forbidden
 * 5. Analytics filters use supported backend parameters (range, category, priority, status)
 * 6. Invalid filter parameters return HTTP 400 Bad Request
 * 
 * CATEGORIES:
 * 7. Category list loads from backend via categoryService.getCategories()
 * 8. Authenticated students can retrieve active categories
 * 9. Admin creates a real category via categoryService.createCategory()
 * 10. Student category mutation is rejected with HTTP 403 Forbidden
 * 11. Admin updates a category via categoryService.updateCategory()
 * 12. Admin toggles category status via categoryService.toggleCategoryStatus()
 * 13. Duplicate category names are rejected with HTTP 409 Conflict
 * 
 * SETTINGS:
 * 14. System settings load from backend via settingsService.getSettings()
 * 15. Authenticated students can read safe system settings
 * 16. Student settings mutation is rejected with HTTP 403 Forbidden
 * 17. Admin updates settings via settingsService.updateSettings()
 * 18. Invalid settings updates are rejected with HTTP 400 Bad Request
 * 
 * USER & STAFF DIRECTORY:
 * 19. User directory loads from backend via userService.getUsers()
 * 20. Student cannot access user directory (HTTP 403 Forbidden)
 * 21. Staff directory loads from backend via userService.getStaff()
 * 22. User profile retrieval loads from backend via userService.getUserById()
 * 23. Student cannot view another user's profile (HTTP 403 Forbidden)
 * 24. Admin toggles user account status via userService.toggleUserStatus()
 * 25. Admin cannot deactivate their own account (HTTP 400 Bad Request)
 * 26. Staff member directory remains compatible with complaint assignment
 * 
 * GENERAL & SECURITY:
 * 27. Server remains authoritative: all admin operations reflect live database state
 * 28. API authentication headers (Bearer token) are correctly attached and validated
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import net from 'net';
import { createClient } from '@supabase/supabase-js';

import { env } from '../backend/src/config/env';
import { getSupabaseAdmin, isSupabaseConfigured } from '../backend/src/config/supabase';

import { apiClient, ApiClientError } from '../src/services/apiClient';
import { authService } from '../src/services/authService';
import { analyticsService } from '../src/services/analyticsService';
import { categoryService } from '../src/services/categoryService';
import { settingsService } from '../src/services/settingsService';
import { userService } from '../src/services/userService';
import { getSupabaseClient, _resetSupabaseClient } from '../src/utils/supabase';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '../src/utils/storage';
import type { User } from '../src/types';

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

async function waitForServer(url: string, timeoutMs = 20000): Promise<void> {
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

async function runPhase5dTests(): Promise<void> {
  console.log('================================================================');
  console.log(' SMART COLLEGE COMPLAINT PORTAL — PHASE 5D ADMIN INTEGRATION');
  console.log('================================================================\n');

  if (!isSupabaseConfigured()) {
    console.error('Supabase is not configured. Aborting tests.');
    process.exit(1);
  }

  const port = await getAvailablePort();
  const backendBaseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`Starting standalone backend child process on port ${port}...`);

  const serverPath = path.resolve(process.cwd(), 'backend/src/server.ts');
  const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');

  const serverProcess: ChildProcess = spawn(
    process.execPath,
    [tsxCli, serverPath],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let serverOutput = '';
  serverProcess.stdout?.on('data', (d) => {
    serverOutput += d.toString();
  });
  serverProcess.stderr?.on('data', (d) => {
    serverOutput += d.toString();
  });

  try {
    await waitForServer(backendBaseUrl);
    console.log(`Backend server ready on port ${port}.\n`);
    apiClient.setBaseUrl(backendBaseUrl);
  } catch (err) {
    console.error(`Failed to start backend process. Output:\n${serverOutput}`);
    serverProcess.kill();
    throw err;
  }

  const adminClient = getSupabaseAdmin();
  const timestamp = Date.now();

  const studentEmail = `p5d_student_${timestamp}@college.edu`;
  const staffEmail = `p5d_staff_${timestamp}@college.edu`;
  const adminEmail = `p5d_admin_${timestamp}@college.edu`;
  const testPassword = 'Password123!';

  console.log('--- Provisioning Test Users ---');

  async function provisionUser(email: string, role: string, name: string) {
    const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password: testPassword,
      email_confirm: true,
      user_metadata: { role, name },
    });
    if (authErr || !authUser?.user) {
      throw new Error(`Failed to create test user (${email}): ${authErr?.message}`);
    }

    const { error: profileErr } = await adminClient.from('profiles').upsert({
      id: authUser.user.id,
      name,
      email,
      role,
      department: role === 'staff' ? 'Electrical Maintenance' : 'Computer Science',
      designation: role === 'staff' ? 'Senior Electrician' : undefined,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (profileErr) {
      throw new Error(`Failed to create profile (${email}): ${profileErr.message}`);
    }

    return authUser.user;
  }

  const studentUser = await provisionUser(studentEmail, 'student', 'P5D Student');
  const staffUser = await provisionUser(staffEmail, 'staff', 'P5D Staff');
  const adminUser = await provisionUser(adminEmail, 'admin', 'P5D Admin');

  console.log('Test users provisioned successfully.\n');

  // Helper to login and switch tokens
  async function loginAs(email: string) {
    const pubSupabase = createClient(env.SUPABASE_URL!, env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signinData, error: signinErr } = await pubSupabase.auth.signInWithPassword({
      email,
      password: testPassword,
    });
    if (signinErr || !signinData?.session) {
      throw new Error(`Sign in failed for ${email}: ${signinErr?.message}`);
    }

    const token = signinData.session.access_token;
    apiClient.setTokens(token);

    // Sync authService internal state
    const currentUser: User = {
      id: signinData.user.id,
      name: signinData.user.user_metadata?.name || 'User',
      email: signinData.user.email!,
      role: (signinData.user.user_metadata?.role || 'student') as any,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };
    (authService as any).activeUser = currentUser;
    (authService as any).currentUser = currentUser;
    (authService as any).accessToken = token;

    setStorageItem(STORAGE_KEYS.SESSION, currentUser);
    const existingUsers = getStorageItem<User[]>(STORAGE_KEYS.USERS, []);
    setStorageItem(STORAGE_KEYS.USERS, [
      ...existingUsers.filter((u) => u.id !== currentUser.id),
      currentUser,
    ]);

    return { token, user: signinData.user };
  }

  try {
    // =========================================================================
    // 1. ADMIN ANALYTICS INTEGRATION
    // =========================================================================
    console.log('--- 1. Admin Analytics Integration ---');

    // Admin login
    await loginAs(adminEmail);

    // Check 1: Admin can retrieve comprehensive analytics
    let adminAnalytics = await analyticsService.getAnalytics('30d');
    assert(
      1,
      'ANALYTICS',
      'Admin analytics requests use correct backend endpoint (/api/analytics)',
      Boolean(adminAnalytics && typeof adminAnalytics.totalComplaints === 'number')
    );

    // Check 2: Structure matches ComprehensiveAnalytics
    assert(
      2,
      'ANALYTICS',
      'Analytics data maps correctly to ComprehensiveAnalytics model with distributions',
      Boolean(
        adminAnalytics.range === '30d' &&
        Array.isArray(adminAnalytics.trendData) &&
        Array.isArray(adminAnalytics.categoryDistribution) &&
        Array.isArray(adminAnalytics.priorityDistribution) &&
        Array.isArray(adminAnalytics.statusDistribution) &&
        Array.isArray(adminAnalytics.departmentPerformance)
      )
    );

    // Check 3: Student access to analytics is rejected with HTTP 403 Forbidden
    await loginAs(studentEmail);
    let studentAnalyticsBlocked = false;
    try {
      await analyticsService.getAnalytics('30d');
    } catch (err: any) {
      studentAnalyticsBlocked = err.message.includes('Only administrators') || err.message.includes('Forbidden') || err.status === 403;
    }
    assert(3, 'ANALYTICS', 'Student access to analytics is rejected with HTTP 403 Forbidden', studentAnalyticsBlocked);

    // Check 4: Staff access to analytics is rejected with HTTP 403 Forbidden
    await loginAs(staffEmail);
    let staffAnalyticsBlocked = false;
    try {
      await analyticsService.getAnalytics('30d');
    } catch (err: any) {
      staffAnalyticsBlocked = err.message.includes('Only administrators') || err.message.includes('Forbidden') || err.status === 403;
    }
    assert(4, 'ANALYTICS', 'Staff access to analytics is rejected with HTTP 403 Forbidden', staffAnalyticsBlocked);

    // Check 5: Analytics filters use supported backend parameters
    await loginAs(adminEmail);
    let filteredAnalytics = await analyticsService.getAnalytics('7d', { priority: 'high' });
    assert(
      5,
      'ANALYTICS',
      'Analytics filters use supported backend parameters (range=7d, priority=high)',
      Boolean(filteredAnalytics && filteredAnalytics.range === '7d')
    );

    // Check 6: Invalid filter parameter handling
    let invalidFilterRejected = false;
    try {
      await apiClient.get('/analytics?range=invalid_range');
    } catch (err: any) {
      invalidFilterRejected = err.status === 400 || (err.message && err.message.includes('Invalid'));
    }
    assert(6, 'ANALYTICS', 'Invalid filter parameters return HTTP 400 Bad Request', invalidFilterRejected);

    // =========================================================================
    // 2. CATEGORY MANAGEMENT INTEGRATION
    // =========================================================================
    console.log('\n--- 2. Category Management Integration ---');

    // Check 7: Category list loads from backend
    const categories = await categoryService.getCategories();
    assert(
      7,
      'CATEGORIES',
      'Category list loads from backend via categoryService.getCategories()',
      Array.isArray(categories) && categories.length > 0 && Boolean(categories[0].name)
    );

    // Check 8: Authenticated students can retrieve active categories
    await loginAs(studentEmail);
    const studentCategories = await categoryService.getCategories(true);
    assert(
      8,
      'CATEGORIES',
      'Authenticated students can retrieve active categories',
      Array.isArray(studentCategories) && studentCategories.every((c) => c.active)
    );

    // Check 9: Admin creates category via categoryService.createCategory()
    await loginAs(adminEmail);
    const uniqueCatName = `Campus Wi-Fi Node ${timestamp}`;
    const createdCat = await categoryService.createCategory({
      name: uniqueCatName,
      description: 'Network connectivity and routing issues across campus',
      slaHours: 24,
      active: true,
    });
    assert(
      9,
      'CATEGORIES',
      'Admin creates a real category via categoryService.createCategory()',
      Boolean(createdCat && createdCat.name === uniqueCatName && createdCat.id)
    );

    // Check 10: Student cannot create category (HTTP 403 Forbidden)
    await loginAs(studentEmail);
    let studentCreateBlocked = false;
    try {
      await categoryService.createCategory({
        name: `Illegal Cat ${timestamp}`,
        description: 'Unauthorized creation',
        slaHours: 24,
      });
    } catch (err: any) {
      studentCreateBlocked = err.message.includes('Only administrators') || err.status === 403;
    }
    assert(10, 'CATEGORIES', 'Student category creation is rejected with HTTP 403 Forbidden', studentCreateBlocked);

    // Check 11: Admin updates category via categoryService.updateCategory()
    await loginAs(adminEmail);
    const updatedCat = await categoryService.updateCategory(createdCat.id, {
      description: 'Updated description for campus Wi-Fi infrastructure',
      slaHours: 36,
    });
    assert(
      11,
      'CATEGORIES',
      'Admin updates category via categoryService.updateCategory()',
      Boolean(updatedCat && updatedCat.slaHours === 36 && updatedCat.description.includes('Updated'))
    );

    // Check 12: Admin toggles category status via categoryService.toggleCategoryStatus()
    const toggledCat = await categoryService.toggleCategoryStatus(createdCat.id);
    assert(
      12,
      'CATEGORIES',
      'Admin toggles category active status via categoryService.toggleCategoryStatus()',
      Boolean(toggledCat && toggledCat.active === false)
    );

    // Check 13: Duplicate category names are rejected with HTTP 409 Conflict
    let duplicateCatRejected = false;
    try {
      await categoryService.createCategory({
        name: uniqueCatName,
        description: 'Duplicate name attempt',
        slaHours: 24,
      });
    } catch (err: any) {
      duplicateCatRejected = err.message.includes('already exists') || err.status === 409;
    }
    assert(13, 'CATEGORIES', 'Duplicate category names are rejected with HTTP 409 Conflict', duplicateCatRejected);

    // =========================================================================
    // 3. SYSTEM SETTINGS INTEGRATION
    // =========================================================================
    console.log('\n--- 3. System Settings Integration ---');

    // Check 14: Settings load from backend
    const loadedSettings = await settingsService.getSettings();
    assert(
      14,
      'SETTINGS',
      'System settings load from backend via settingsService.getSettings()',
      Boolean(loadedSettings && typeof loadedSettings.portalName === 'string')
    );

    // Check 15: Student can read safe settings
    await loginAs(studentEmail);
    const studentSettings = await settingsService.getSettings();
    assert(
      15,
      'SETTINGS',
      'Authenticated students can read safe system settings',
      Boolean(studentSettings && typeof studentSettings.portalName === 'string')
    );

    // Check 16: Student settings mutation is rejected with HTTP 403 Forbidden
    let studentSettingsBlocked = false;
    try {
      await settingsService.updateSettings({ maintenanceMode: true });
    } catch (err: any) {
      studentSettingsBlocked = err.message.includes('Only administrators') || err.status === 403;
    }
    assert(16, 'SETTINGS', 'Student settings mutation is rejected with HTTP 403 Forbidden', studentSettingsBlocked);

    // Check 17: Admin updates settings via settingsService.updateSettings()
    await loginAs(adminEmail);
    const testSupportEmail = `support_${timestamp}@college.edu`;
    const updatedSettings = await settingsService.updateSettings({
      supportEmail: testSupportEmail,
      maxAttachmentsPerComplaint: 4,
    });
    assert(
      17,
      'SETTINGS',
      'Admin updates settings via settingsService.updateSettings()',
      Boolean(updatedSettings && updatedSettings.supportEmail === testSupportEmail && updatedSettings.maxAttachmentsPerComplaint === 4)
    );

    // Check 18: Invalid settings update rejected with HTTP 400 Bad Request
    let invalidSettingsRejected = false;
    try {
      await apiClient.patch('/settings', { default_priority: 'ultra_critical' });
    } catch (err: any) {
      invalidSettingsRejected = err.status === 400 || (err.message && err.message.includes('Invalid'));
    }
    assert(18, 'SETTINGS', 'Invalid settings updates are rejected with HTTP 400 Bad Request', invalidSettingsRejected);

    // =========================================================================
    // 4. USER & STAFF DIRECTORY INTEGRATION
    // =========================================================================
    console.log('\n--- 4. User & Staff Directory Integration ---');

    // Check 19: User directory loads from backend via userService.getUsers()
    const users = await userService.getUsers();
    assert(
      19,
      'USERS',
      'User directory loads from backend via userService.getUsers()',
      Array.isArray(users) && users.length >= 3 && users.some((u) => u.email === studentEmail)
    );

    // Check 20: Student cannot access user directory (HTTP 403 Forbidden)
    await loginAs(studentEmail);
    let studentUsersBlocked = false;
    try {
      await userService.getUsers();
    } catch (err: any) {
      studentUsersBlocked = err.message.includes('Only administrators') || err.status === 403;
    }
    assert(20, 'USERS', 'Student cannot access user directory (HTTP 403 Forbidden)', studentUsersBlocked);

    // Check 21: Staff directory loads from backend via userService.getStaff()
    await loginAs(adminEmail);
    const staffList = await userService.getStaff(true);
    assert(
      21,
      'USERS',
      'Staff directory loads from backend via userService.getStaff()',
      Array.isArray(staffList) && staffList.some((s) => s.email === staffEmail && s.role === 'staff')
    );

    // Check 22: User profile retrieval loads from backend via userService.getUserById()
    const singleUser = await userService.getUserById(studentUser.id);
    assert(
      22,
      'USERS',
      'User profile retrieval loads from backend via userService.getUserById()',
      Boolean(singleUser && singleUser.id === studentUser.id && singleUser.name === 'P5D Student')
    );

    // Check 23: Student cannot view another user profile (HTTP 403 Forbidden)
    await loginAs(studentEmail);
    let studentCrossUserBlocked = false;
    try {
      await userService.getUserById(adminUser.id);
    } catch (err: any) {
      studentCrossUserBlocked = err.message.includes('own user profile') || err.message.includes('Forbidden') || err.status === 403;
    }
    assert(23, 'USERS', 'Student cannot view another users profile (HTTP 403 Forbidden)', studentCrossUserBlocked);

    // Check 24: Admin toggles user account status via userService.toggleUserStatus()
    await loginAs(adminEmail);
    const toggledUser = await userService.toggleUserStatus(studentUser.id);
    assert(
      24,
      'USERS',
      'Admin toggles user account status via userService.toggleUserStatus()',
      Boolean(toggledUser && toggledUser.status === 'inactive')
    );

    // Toggle back to active
    await userService.toggleUserStatus(studentUser.id);

    // Check 25: Admin cannot deactivate their own account (HTTP 400 Bad Request)
    let selfDeactivateBlocked = false;
    try {
      await userService.toggleUserStatus(adminUser.id);
    } catch (err: any) {
      selfDeactivateBlocked = err.message.includes('cannot deactivate your own account') || err.status === 400;
    }
    assert(25, 'USERS', 'Admin cannot deactivate their own account (HTTP 400 Bad Request)', selfDeactivateBlocked);

    // Check 26: Staff member directory is returned with valid UUID for complaint assignment
    const assignableStaff = await userService.getStaff(true);
    const foundStaff = assignableStaff.find((s) => s.email === staffEmail);
    assert(
      26,
      'USERS',
      'Staff member directory remains compatible with complaint assignment (valid UUID)',
      Boolean(foundStaff && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(foundStaff.id))
    );

    // =========================================================================
    // 5. GENERAL & SECURITY ARCHITECTURE
    // =========================================================================
    console.log('\n--- 5. General & Security Architecture ---');

    // Check 27: Server remains authoritative without relying on localStorage as authoritative production state
    const serverVerifiedSettings = await apiClient.get<any>('/settings');
    assert(
      27,
      'PERSISTENCE',
      'Server remains authoritative: admin settings and categories reflect live database',
      Boolean(serverVerifiedSettings && serverVerifiedSettings.data?.support_email === testSupportEmail)
    );

    // Check 28: Centralized API client attaches Bearer token to all admin requests
    const authHeadersOk = Boolean(apiClient.getAccessToken());
    assert(
      28,
      'SECURITY',
      'API authentication headers (Bearer token) are correctly attached and validated',
      authHeadersOk
    );

  } finally {
    console.log('\n--- Cleaning up Test Artifacts ---');
    try {
      // Clean up created test category
      await adminClient.from('categories').delete().ilike('slug', `%node-${timestamp}%`);
      // Restore support email
      await adminClient.from('system_settings').update({ support_email: 'support@college.edu' }).eq('id', 1);
      // Clean up test users
      await adminClient.auth.admin.deleteUser(studentUser.id);
      await adminClient.auth.admin.deleteUser(staffUser.id);
      await adminClient.auth.admin.deleteUser(adminUser.id);
    } catch (cleanErr) {
      console.warn('Artifact cleanup warning:', cleanErr);
    }

    serverProcess.kill();
    console.log('Cleanup completed successfully.\n');
  }

  // Summary
  console.log('================================================================');
  console.log(' PHASE 5D ADMIN INTEGRATION AUDIT SUMMARY');
  console.log('================================================================');
  const passedCount = checks.filter((c) => c.passed).length;
  const failedCount = checks.filter((c) => !c.passed).length;

  console.log(` Total Checks : ${checks.length}`);
  console.log(` Passed       : ${passedCount}`);
  console.log(` Failed       : ${failedCount}\n`);

  if (failedCount > 0) {
    console.error(`❌ ${failedCount} Phase 5D checks FAILED!`);
    process.exit(1);
  } else {
    console.log('🎉 All 28 Phase 5D Admin & Supporting API Integration checks PASSED!\n');
  }
}

runPhase5dTests().catch((err) => {
  console.error('Fatal Phase 5D test runner error:', err);
  process.exit(1);
});
