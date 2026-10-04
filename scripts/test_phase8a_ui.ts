/**
 * Smart College Complaint Portal — Phase 8A UI State & Workflow Regression Suite
 * 
 * Verifies UI state persistence, theme preference storage, multi-role session
 * routing, and UI action data contracts. (Visual rendering is certified via the
 * Phase 8A UI Verification Checklist).
 */

import { authService } from '../src/services/authService';
import { complaintService } from '../src/services/complaintService';
import { userService } from '../src/services/userService';
import { categoryService } from '../src/services/categoryService';
import { settingsService } from '../src/services/settingsService';
import { notificationService } from '../src/services/notificationService';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '../src/utils/storage';

async function runPhase8aTests() {
  console.log('======================================================================');
  console.log('SMART COLLEGE COMPLAINT PORTAL — PHASE 8A UI STATE & WORKFLOW SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ [Passed] ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ [FAILED] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Theme Persistence & Client Preferences
  console.log('--- 1. Theme Configuration & Persistence ---');
  setStorageItem(STORAGE_KEYS.THEME, 'dark');
  assert(getStorageItem(STORAGE_KEYS.THEME, 'light') === 'dark', 'Theme state stores and retrieves dark mode correctly');

  setStorageItem(STORAGE_KEYS.THEME, 'light');
  assert(getStorageItem(STORAGE_KEYS.THEME, 'dark') === 'light', 'Theme state stores and retrieves light mode correctly');

  // 2. Multi-Role Authentication & Route Resolution
  console.log('\n--- 2. Multi-Role Authentication & Routing Verification ---');
  // Student Login
  const student = await authService.login('student@college.edu', 'student123', true);
  assert(student.role === 'student', 'Student authentication returns student role');
  assert(authService.getCurrentUser()?.role === 'student', 'Session correctly set for student account');

  // Student should only see their complaints
  const studentComplaints = await complaintService.getStudentComplaints(student.id);
  assert(Array.isArray(studentComplaints), 'Student complaint list retrieved cleanly');
  assert(studentComplaints.every((c) => c.studentId === student.id), 'Student cannot access other students complaints');

  // Staff Login
  const staff = await authService.login('staff@college.edu', 'staff123', true);
  assert(staff.role === 'staff', 'Staff authentication returns staff role');
  assert(authService.getCurrentUser()?.role === 'staff', 'Session correctly set for staff account');

  // Staff complaint ownership
  const staffComplaints = await complaintService.getStaffComplaints(staff.id);
  assert(Array.isArray(staffComplaints), 'Staff assigned complaints list retrieved cleanly');
  assert(staffComplaints.every((c) => c.assignedTo === staff.id), 'Staff only retrieves tickets assigned to their account ID');

  // Admin Login
  const admin = await authService.login('admin@college.edu', 'admin123', true);
  assert(admin.role === 'admin', 'Admin authentication returns admin role');
  assert(authService.getCurrentUser()?.role === 'admin', 'Session correctly set for admin account');

  const adminComplaints = await complaintService.getComplaints();
  assert(adminComplaints.length >= staffComplaints.length, 'Admin can view all complaints across campus');

  // 3. Status Transitions & Staff Workflows
  console.log('\n--- 3. Staff Ticket Updates & Comment Threading ---');
  // Re-login as staff
  await authService.login('staff@college.edu', 'staff123', true);
  if (staffComplaints.length > 0) {
    const targetTicket = staffComplaints[0];
    const updatedTicket = await complaintService.updateComplaintStatus(
      targetTicket.id,
      'in_progress',
      'Phase 8A UI test: Technician has started diagnostic on site'
    );
    assert(updatedTicket.status === 'in_progress', 'Staff successfully progressed ticket to in_progress');

    // Verify staff public comment
    const updatedWithComment = await complaintService.addComment(
      targetTicket.id,
      'Phase 8A UI test: Work order parts inspected',
      false
    );
    const lastComment = updatedWithComment.comments?.[updatedWithComment.comments.length - 1];
    assert(lastComment?.authorRole === 'staff', 'Comment author recorded with staff role');
    assert(lastComment?.isInternal === false, 'Staff comment is registered on public thread for student tracking');
  }

  // 4. Component Structure & Design System Verification
  console.log('\n--- 4. Component Structure & Design System Verification ---');
  // Check category service
  const categories = await categoryService.getCategories(true);
  assert(categories.length > 0, `Active categories loaded (${categories.length} categories available)`);
  assert(categories.every((c) => c.active), 'Only active categories returned when requested');

  // Check settings service
  const settings = await settingsService.getSettings();
  assert(typeof settings.allowStudentRegistration === 'boolean', 'Settings allowStudentRegistration is valid boolean');
  assert(typeof settings.maintenanceMode === 'boolean', 'Settings maintenanceMode is valid boolean');
  assert(settings.maxAttachmentSizeMB > 0, 'Settings maxAttachmentSizeMB configured properly');

  // Check notification service for current user (staff)
  const notifications = await notificationService.getNotifications(staff.id);
  assert(Array.isArray(notifications), 'Notifications retrieved successfully for user');

  // 5. Clean Demo Reset
  console.log('\n--- 5. Clean Demo Data Reset & Session Cleanup ---');
  await authService.login('admin@college.edu', 'admin123', true);
  await settingsService.resetDemoData();
  assert(authService.getCurrentUser()?.role === 'admin', 'Admin session maintained during demo reset');
  authService.invalidateSession();
  assert(authService.getCurrentUser() === null, 'Session cleanly invalidated after logout');

  console.log('\n======================================================================');
  console.log('PHASE 8A TEST SUITE SUMMARY');
  console.log('======================================================================');
  console.log(`Total Tests Run : ${passed + failed}`);
  console.log(`Passed          : ${passed}`);
  console.log(`Failed          : ${failed}`);
  console.log(`Success Rate    : ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase8aTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
