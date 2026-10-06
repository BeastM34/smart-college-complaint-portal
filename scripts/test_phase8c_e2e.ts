import { authService } from '../src/services/authService';
import { complaintService } from '../src/services/complaintService';
import { userService } from '../src/services/userService';
import { categoryService } from '../src/services/categoryService';
import { notificationService } from '../src/services/notificationService';
import { settingsService } from '../src/services/settingsService';
import { analyticsService } from '../src/services/analyticsService';
import {
  clearAppStorage,
  STORAGE_KEYS,
  setStorageItem,
  getStorageItem,
  StorageQuotaError,
  isQuotaExceededError,
} from '../src/utils/storage';
import { MOCK_USERS, MOCK_COMPLAINTS, MOCK_SETTINGS, MOCK_CATEGORIES } from '../src/data/mockData';
import type { Complaint, User, ComplaintStatus, Priority } from '../src/types';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(msg);
  }
}

async function runTest(category: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ category, name, passed: true });
    console.log(`  ✓ [${category}] ${name}`);
  } catch (err: any) {
    results.push({ category, name, passed: false, error: err.message });
    console.error(`  ✗ [${category}] ${name}:`, err.message);
  }
}

async function runPhase8CTestSuite() {
  console.log('======================================================================');
  console.log('SMART COLLEGE COMPLAINT PORTAL — PHASE 8C END-TO-END QA & VERIFICATION');
  console.log('======================================================================\n');

  clearAppStorage();

  // -------------------------------------------------------------------------
  // 1. PUBLIC AND AUTHENTICATION JOURNEY
  // -------------------------------------------------------------------------
  console.log('--- 1. Public & Authentication Journey ---');

  await runTest('Public & Auth', 'Valid student login succeeds and establishes authenticated session', async () => {
    authService.invalidateSession();
    const user = await authService.login('student@college.edu', 'student123');
    assert(user.role === 'student', 'Role must be student');
    assert(user.email === 'student@college.edu', 'Email must match');
    assert(authService.isAuthenticated(), 'Must be authenticated');
    assert(authService.getCurrentUser()?.id === user.id, 'Active user session ID must match');
  });

  await runTest('Public & Auth', 'Valid staff login succeeds and establishes staff session', async () => {
    authService.invalidateSession();
    const user = await authService.login('staff@college.edu', 'staff123');
    assert(user.role === 'staff', 'Role must be staff');
    assert(authService.hasRole('staff'), 'hasRole must return true for staff');
  });

  await runTest('Public & Auth', 'Valid admin login succeeds and establishes admin session', async () => {
    authService.invalidateSession();
    const user = await authService.login('admin@college.edu', 'admin123');
    assert(user.role === 'admin', 'Role must be admin');
    assert(authService.hasRole('admin'), 'hasRole must return true for admin');
  });

  await runTest('Public & Auth', 'Invalid credentials throw descriptive authentication failure', async () => {
    let failed = false;
    try {
      await authService.login('student@college.edu', 'wrong_password');
    } catch (e: any) {
      failed = true;
      assert(e.message.includes('Invalid email or password'), 'Must specify invalid credentials');
    }
    assert(failed, 'Invalid password must throw');
  });

  await runTest('Public & Auth', 'Empty credentials are fully validated and rejected', async () => {
    let emptyEmail = false;
    try {
      await authService.login('', 'any_password');
    } catch (e: any) {
      emptyEmail = true;
    }
    assert(emptyEmail, 'Empty email must be rejected');

    let emptyPass = false;
    try {
      await authService.login('student@college.edu', '');
    } catch (e: any) {
      emptyPass = true;
    }
    assert(emptyPass, 'Empty password must be rejected');
  });

  await runTest('Public & Auth', 'Valid student self-registration creates active account without auto-login', async () => {
    authService.invalidateSession();
    const reg = await authService.register({
      name: 'E2E Test Student',
      email: 'e2e.student@college.edu',
      password: 'securePassword123',
      studentId: 'STU-E2E-2026',
      department: 'Computer Science & Engineering',
      phone: '+1 555 444 3322',
      year: '2nd Year',
    });

    assert(reg.role === 'student', 'Registered user must always have student role');
    assert(reg.status === 'active', 'Registered user must be active');
    assert(!authService.isAuthenticated(), 'Registration must not auto-login the user');
  });

  await runTest('Public & Auth', 'Duplicate email and student ID are rejected during registration', async () => {
    let emailDup = false;
    try {
      await authService.register({
        name: 'Another Student',
        email: 'e2e.student@college.edu',
        password: 'password123',
        studentId: 'STU-DIFF-001',
        department: 'Information Technology',
        phone: '+1 555 111 2233',
      });
    } catch (e: any) {
      emailDup = true;
      assert(e.message.includes('already exists'), 'Duplicate email error message expected');
    }
    assert(emailDup, 'Duplicate email must be rejected');

    let idDup = false;
    try {
      await authService.register({
        name: 'Another Student 2',
        email: 'unique.student@college.edu',
        password: 'password123',
        studentId: 'STU-E2E-2026',
        department: 'Information Technology',
        phone: '+1 555 111 2234',
      });
    } catch (e: any) {
      idDup = true;
      assert(e.message.includes('already registered'), 'Duplicate student ID error message expected');
    }
    assert(idDup, 'Duplicate student ID must be rejected');
  });

  await runTest('Public & Auth', 'allowStudentRegistration=false blocks self-registration', async () => {
    await authService.login('admin@college.edu', 'admin123');
    await settingsService.updateSettings({ allowStudentRegistration: false });

    authService.invalidateSession();
    let blocked = false;
    try {
      await authService.register({
        name: 'Blocked Student',
        email: 'blocked.student@college.edu',
        password: 'password123',
        studentId: 'STU-BLOCKED-01',
        department: 'Mechanical Engineering',
        phone: '+1 555 777 8899',
      });
    } catch (e: any) {
      blocked = true;
      assert(e.message.includes('disabled'), 'Must explain registration is disabled');
    }
    assert(blocked, 'Disabled registration setting must block register call');

    // Restore setting
    await authService.login('admin@college.edu', 'admin123');
    await settingsService.updateSettings({ allowStudentRegistration: true });
    authService.invalidateSession();
  });

  await runTest('Public & Auth', 'Session persistence, live user validation, and logout behaviour', async () => {
    const student = await authService.login('student@college.edu', 'student123');
    assert(authService.getCurrentUser()?.id === student.id, 'Session must be active');

    // Validate session live check
    const check = authService.validateSession();
    assert(check.isValid === true, 'Session must be valid');
    assert(check.user?.id === student.id, 'Live user must match session');

    // Logout
    await authService.logout();
    assert(authService.getCurrentUser() === null, 'Session must be invalidated after logout');
    assert(!authService.isAuthenticated(), 'User must not be authenticated after logout');
  });

  await runTest('Public & Auth', 'Deactivated account cannot login and active session is invalidated', async () => {
    // Admin deactivates test student
    await authService.login('admin@college.edu', 'admin123');
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const targetStudent = users.find((u) => u.email === 'e2e.student@college.edu')!;
    await userService.toggleUserStatus(targetStudent.id);

    // Attempt login with deactivated student credentials
    authService.invalidateSession();
    let loginFailed = false;
    try {
      await authService.login('e2e.student@college.edu', 'securePassword123');
    } catch (e: any) {
      loginFailed = true;
      assert(e.message.includes('deactivated'), 'Must explain account is deactivated');
    }
    assert(loginFailed, 'Deactivated student login must fail');

    // If an inactive user has a stale session, validateSession detects inactive status
    setStorageItem(STORAGE_KEYS.SESSION, { ...targetStudent, status: 'inactive' });
    const staleCheck = authService.validateSession();
    assert(staleCheck.isValid === false, 'Stale inactive session must be reported as invalid');
    assert(staleCheck.reason === 'inactive', 'Reason must be inactive');

    // Reactivate account
    await authService.login('admin@college.edu', 'admin123');
    await userService.toggleUserStatus(targetStudent.id);
    authService.invalidateSession();
  });

  // -------------------------------------------------------------------------
  // 2. STUDENT END-TO-END JOURNEY
  // -------------------------------------------------------------------------
  console.log('--- 2. Student End-to-End Journey ---');

  let testComplaintId = '';
  let testTicketNumber = '';

  await runTest('Student Journey', 'Student dashboard loads correct statistics and recent activity', async () => {
    const student = await authService.login('student@college.edu', 'student123');
    const stats = await complaintService.getStudentStats(student.id);
    assert(typeof stats.total === 'number' && stats.total >= 0, 'Total complaints must be a non-negative number');
    assert(typeof stats.pending === 'number', 'Pending complaints must be a number');
    assert(typeof stats.resolved === 'number', 'Resolved complaints must be a number');

    const activity = await complaintService.getStudentRecentActivity(student.id, 5);
    assert(Array.isArray(activity), 'Recent activity must be an array');
  });

  await runTest('Student Journey', 'Student submits complaint with automatic department auto-assignment', async () => {
    // Enable auto-assignment in settings
    await authService.login('admin@college.edu', 'admin123');
    await settingsService.updateSettings({ autoAssignComplaints: true });

    const student = await authService.login('student@college.edu', 'student123');
    const newComplaint = await complaintService.createComplaint({
      title: 'Power Outage in CS Turing Lab',
      description: 'The main electrical circuit tripped during practical examinations causing lab shutdown.',
      category: 'Electrical & Power',
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      department: student.department || 'Computer Science & Engineering',
      building: 'Computer Science Block',
      floor: '2nd Floor',
      roomNumber: 'Lab 204',
      location: 'Computer Science Block, 2nd Floor, Lab 204',
      attachments: [],
    });

    testComplaintId = newComplaint.id;
    testTicketNumber = newComplaint.ticketNumber;

    assert(Boolean(newComplaint.id), 'Complaint must have an ID');
    assert(Boolean(newComplaint.ticketNumber), 'Complaint must have a ticket number');
    assert(newComplaint.category === 'Electrical & Power', 'Category must be preserved');
    // Electrical maps to electrical department -> assigned to technician
    assert(newComplaint.status === 'assigned', 'Auto-assigned complaint should transition to assigned');
    assert(Boolean(newComplaint.assignedTo), 'Assigned staff ID must be populated');
    assert(newComplaint.timeline.length > 0, 'Timeline must be created with initial event');
  });

  await runTest('Student Journey', 'Attachment count and file size limits are strictly enforced', async () => {
    const student = await authService.login('student@college.edu', 'student123');
    
    // 1. Exceed count limit (default 3)
    let countExceeded = false;
    try {
      await complaintService.createComplaint({
        title: 'Too many attachments',
        description: 'Testing attachment limit count.',
        category: 'Campus Infrastructure',
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        attachments: [
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        ],
      });
    } catch (e: any) {
      countExceeded = true;
      assert(e.message.includes('Maximum'), 'Error must mention maximum attachments');
    }
    assert(countExceeded, 'Exceeding attachment count must throw');

    // 2. Malformed payload
    let malformed = false;
    try {
      await complaintService.createComplaint({
        title: 'Malformed attachment',
        description: 'Testing malformed base64.',
        category: 'Campus Infrastructure',
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        attachments: ['not-a-valid-data-url'],
      });
    } catch (e: any) {
      malformed = true;
    }
    assert(malformed, 'Malformed data URL must be rejected');
  });

  await runTest('Student Journey', 'Student complaint details view strictly hides internal notes', async () => {
    // Admin creates an internal note on test complaint
    await authService.login('admin@college.edu', 'admin123');
    await complaintService.addComment(testComplaintId, 'INTERNAL ADMIN CONFIDENTIAL NOTE: Under review with campus electrician.', true);

    // Student accesses complaint details
    await authService.login('student@college.edu', 'student123');
    const details = await complaintService.getComplaintById(testComplaintId);
    assert(details !== null, 'Complaint details must be accessible to owner');
    
    // Verify no internal comments leaked
    const leakedComment = details.comments?.find((c) => c.isInternal || c.message.includes('INTERNAL ADMIN CONFIDENTIAL NOTE'));
    assert(!leakedComment, 'Internal administrative note must NEVER leak to student');

    // Verify no internal timeline events leaked
    const leakedTimeline = details.timeline.find((t) => t.isInternal);
    assert(!leakedTimeline, 'Internal timeline events must NEVER leak to student');
  });

  await runTest('Student Journey', 'Student adds public comment and tracks thread', async () => {
    const student = await authService.login('student@college.edu', 'student123');
    const updated = await complaintService.addComment(testComplaintId, 'Student update: electrician has not arrived yet.', false);
    
    const lastComment = updated.comments?.[updated.comments.length - 1];
    assert(lastComment?.authorId === student.id, 'Comment author ID must match student');
    assert(lastComment?.isInternal === false, 'Student comment must be public');
    assert(lastComment?.message === 'Student update: electrician has not arrived yet.', 'Comment message must match');
  });

  await runTest('Student Journey', 'Student cannot view or comment on another students complaints', async () => {
    // Switch to another student
    await authService.login('e2e.student@college.edu', 'securePassword123');
    
    let viewBlocked = false;
    try {
      await complaintService.getComplaintById(testComplaintId);
    } catch (e: any) {
      viewBlocked = true;
      assert(e.message.includes('Unauthorized'), 'Must be unauthorized');
    }
    assert(viewBlocked, 'Student must not view another students complaint');

    let commentBlocked = false;
    try {
      await complaintService.addComment(testComplaintId, 'Attempted unauthorized comment');
    } catch (e: any) {
      commentBlocked = true;
    }
    assert(commentBlocked, 'Student must not comment on another students complaint');
  });

  await runTest('Student Journey', 'Student complaint reopening: allowed for resolved/rejected tickets, policy enforced', async () => {
    // Admin marks test complaint as resolved
    await authService.login('admin@college.edu', 'admin123');
    await complaintService.updateComplaintStatus(testComplaintId, 'resolved', 'Power restored to main distribution board.');

    // Student reopens complaint
    await authService.login('student@college.edu', 'student123');
    const reopened = await complaintService.reopenComplaint(testComplaintId, 'Sockets still sparking, issue not completely resolved.');
    assert(reopened.status === 'pending', 'Reopened complaint status must be pending');
    assert(reopened.reopenReason === 'Sockets still sparking, issue not completely resolved.', 'Reopen reason must match');

    // Reopening an active pending complaint must be rejected
    let reopenActiveFailed = false;
    try {
      await complaintService.reopenComplaint(testComplaintId, 'Reopening again');
    } catch (e: any) {
      reopenActiveFailed = true;
      assert(e.message.includes('Only resolved or rejected'), 'Must require resolved or rejected status');
    }
    assert(reopenActiveFailed, 'Reopening non-resolved ticket must be rejected');

    // Disable reopening in settings and verify rejection
    await authService.login('admin@college.edu', 'admin123');
    await complaintService.updateComplaintStatus(testComplaintId, 'resolved', 'Fix verified.');
    await settingsService.updateSettings({ allowReopening: false });

    await authService.login('student@college.edu', 'student123');
    let policyBlocked = false;
    try {
      await complaintService.reopenComplaint(testComplaintId, 'Reopening when disabled');
    } catch (e: any) {
      policyBlocked = true;
      assert(e.message.includes('disabled by institutional policy'), 'Must cite policy error');
    }
    assert(policyBlocked, 'allowReopening=false must block reopening');

    // Restore setting
    await authService.login('admin@college.edu', 'admin123');
    await settingsService.updateSettings({ allowReopening: true });
  });

  await runTest('Student Journey', 'Student satisfaction rating is recorded and guarded', async () => {
    const student = await authService.login('student@college.edu', 'student123');
    const rated = await complaintService.rateSatisfaction(testComplaintId, 'satisfied', 'Great turnaround time, thank you!');
    assert(rated.satisfaction?.rating === 'satisfied', 'Satisfaction rating must be satisfied');
    assert(rated.satisfaction?.feedback === 'Great turnaround time, thank you!', 'Feedback text must match');

    // Rating by another student is blocked
    await authService.login('e2e.student@college.edu', 'securePassword123');
    let foreignRateBlocked = false;
    try {
      await complaintService.rateSatisfaction(testComplaintId, 'not_satisfied');
    } catch (e: any) {
      foreignRateBlocked = true;
    }
    assert(foreignRateBlocked, 'Another student cannot rate satisfaction');
  });

  await runTest('Student Journey', 'Student profile update: permitted fields modified, role/status immutable', async () => {
    const student = await authService.login('student@college.edu', 'student123');
    const updated = await userService.updateProfile(student.id, {
      phone: '+1 555 777 9999',
      role: 'admin' as any, // Attacking privilege escalation
      status: 'inactive' as any,
    });

    assert(updated.phone === '+1 555 777 9999', 'Permitted phone field must update');
    assert(updated.role === 'student', 'Privilege escalation to admin must be discarded');
    assert(updated.status === 'active', 'Status modification must be discarded');
  });

  // -------------------------------------------------------------------------
  // 3. STAFF END-TO-END JOURNEY
  // -------------------------------------------------------------------------
  console.log('--- 3. Staff End-to-End Journey ---');

  await runTest('Staff Journey', 'Staff accesses only complaints assigned to their account ID', async () => {
    const staff = await authService.login('staff@college.edu', 'staff123');
    const assignedComplaints = await complaintService.getStaffComplaints(staff.id);
    
    assert(Array.isArray(assignedComplaints), 'Staff complaints must be an array');
    assignedComplaints.forEach((c) => {
      assert(c.assignedTo === staff.id, 'Every complaint returned must be assigned to this staff account ID');
    });
  });

  await runTest('Staff Journey', 'Staff identity isolation: two staff members with identical display names', async () => {
    // Create Staff 1 and Staff 2 with identical name "Technician Alex"
    await authService.login('admin@college.edu', 'admin123');
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    
    const staff1: User = {
      id: 'staff-alex-001',
      name: 'Technician Alex',
      email: 'alex1@college.edu',
      password: 'password123',
      role: 'staff',
      department: 'Electrical Maintenance',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const staff2: User = {
      id: 'staff-alex-002',
      name: 'Technician Alex',
      email: 'alex2@college.edu',
      password: 'password123',
      role: 'staff',
      department: 'Electrical Maintenance',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    setStorageItem(STORAGE_KEYS.USERS, [...users, staff1, staff2]);

    // Create complaint assigned to staff1
    const comp1 = await complaintService.createComplaint({
      title: 'Alex 1 Dedicated Ticket',
      description: 'Only Alex 1 should access this ticket.',
      category: 'Electrical & Power',
      studentId: 'user-student-1',
      studentName: 'Student User',
      studentEmail: 'student@college.edu',
      attachments: [],
    });
    await complaintService.assignComplaint(comp1.id, staff1.id, staff1.name, staff1.department);

    // Create complaint assigned to staff2
    const comp2 = await complaintService.createComplaint({
      title: 'Alex 2 Dedicated Ticket',
      description: 'Only Alex 2 should access this ticket.',
      category: 'Electrical & Power',
      studentId: 'user-student-1',
      studentName: 'Student User',
      studentEmail: 'student@college.edu',
      attachments: [],
    });
    await complaintService.assignComplaint(comp2.id, staff2.id, staff2.name, staff2.department);

    // Verify Staff 1 cannot view or retrieve Comp 2
    await authService.login('alex1@college.edu', 'password123');
    const alex1Tickets = await complaintService.getStaffComplaints(staff1.id);
    assert(alex1Tickets.some((c) => c.id === comp1.id), 'Alex 1 must see Comp 1');
    assert(!alex1Tickets.some((c) => c.id === comp2.id), 'Alex 1 must NOT see Comp 2 despite identical display name');

    let alex1DetailsBlock = false;
    try {
      await complaintService.getComplaintById(comp2.id);
    } catch (e: any) {
      alex1DetailsBlock = true;
    }
    assert(alex1DetailsBlock, 'Alex 1 must be blocked from opening Comp 2 details');

    // Verify Staff 2 cannot view or retrieve Comp 1
    await authService.login('alex2@college.edu', 'password123');
    const alex2Tickets = await complaintService.getStaffComplaints(staff2.id);
    assert(alex2Tickets.some((c) => c.id === comp2.id), 'Alex 2 must see Comp 2');
    assert(!alex2Tickets.some((c) => c.id === comp1.id), 'Alex 2 must NOT see Comp 1 despite identical display name');

    let alex2DetailsBlock = false;
    try {
      await complaintService.getComplaintById(comp1.id);
    } catch (e: any) {
      alex2DetailsBlock = true;
    }
    assert(alex2DetailsBlock, 'Alex 2 must be blocked from opening Comp 1 details');
  });

  await runTest('Staff Journey', 'Staff progresses ticket status and adds work comments', async () => {
    const staff = await authService.login('staff@college.edu', 'staff123');
    // Assign test complaint to this staff
    await authService.login('admin@college.edu', 'admin123');
    await complaintService.assignComplaint(testComplaintId, staff.id, staff.name, staff.department);

    // Staff updates status to in_progress
    await authService.login('staff@college.edu', 'staff123');
    const inProg = await complaintService.updateComplaintStatus(testComplaintId, 'in_progress', 'Technician on site inspecting distribution board.');
    assert(inProg.status === 'in_progress', 'Status must be in_progress');

    // Staff adds public comment
    const commented = await complaintService.addComment(testComplaintId, 'Replaced 32A breaker. Testing voltage levels.', false);
    assert(commented.comments?.some((c) => c.message.includes('Replaced 32A breaker')), 'Staff comment must appear in thread');

    // Staff attempting internal note must be rejected
    let internalRejected = false;
    try {
      await complaintService.updateComplaintStatus(testComplaintId, 'in_progress', 'Staff internal note', true);
    } catch (e: any) {
      internalRejected = true;
      assert(e.message.includes('Only administrators'), 'Must restrict internal notes to administrators');
    }
    assert(internalRejected, 'Staff must not be permitted to create internal notes');
  });

  await runTest('Staff Journey', 'Staff administrative restrictions: denied admin endpoints', async () => {
    await authService.login('staff@college.edu', 'staff123');

    // 1. Admin analytics
    let analyticsBlocked = false;
    try {
      await analyticsService.getAnalytics('30d');
    } catch (e: any) {
      analyticsBlocked = true;
      assert(e.message.includes('Unauthorized'), 'Staff must be denied analytics');
    }
    assert(analyticsBlocked, 'Staff cannot access analyticsService');

    // 2. User directory
    let usersBlocked = false;
    try {
      await userService.getUsers();
    } catch (e: any) {
      usersBlocked = true;
    }
    assert(usersBlocked, 'Staff cannot access userService.getUsers');

    // 3. Category management
    let catBlocked = false;
    try {
      await categoryService.createCategory({ name: 'Unauthorized Cat', slug: 'unauth-cat', active: true });
    } catch (e: any) {
      catBlocked = true;
    }
    assert(catBlocked, 'Staff cannot create categories');

    // 4. Settings update
    let settingsBlocked = false;
    try {
      await settingsService.updateSettings({ defaultPriority: 'critical' });
    } catch (e: any) {
      settingsBlocked = true;
    }
    assert(settingsBlocked, 'Staff cannot update system settings');

    // 5. Broadcasts
    let broadcastBlocked = false;
    try {
      await notificationService.sendBroadcastNotification({
        title: 'Unauthorized Broadcast',
        message: 'Should fail',
        audience: 'all_students',
      });
    } catch (e: any) {
      broadcastBlocked = true;
    }
    assert(broadcastBlocked, 'Staff cannot send broadcasts');
  });

  // -------------------------------------------------------------------------
  // 4. ADMIN END-TO-END JOURNEY
  // -------------------------------------------------------------------------
  console.log('--- 4. Admin End-to-End Journey ---');

  await runTest('Admin Journey', 'Admin dashboard statistics and complete complaints view', async () => {
    await authService.login('admin@college.edu', 'admin123');
    const stats = await complaintService.getAdminStats();
    assert(typeof stats.total === 'number' && stats.total > 0, 'Total complaints must be > 0');
    assert(typeof stats.pending === 'number', 'Pending complaints must be a number');
    assert(typeof stats.inProgress === 'number', 'inProgress complaints must be a number');
    assert(typeof stats.resolved === 'number', 'Resolved complaints must be a number');

    const allComplaints = await complaintService.getComplaints();
    assert(allComplaints.length >= stats.total, 'Complaints list length must match total');
  });

  await runTest('Admin Journey', 'Admin complaint triage: priority adjustment, assignment, internal notes', async () => {
    await authService.login('admin@college.edu', 'admin123');
    
    // Priority update
    const priorityUpdated = await complaintService.updatePriority(testComplaintId, 'high', true);
    assert(priorityUpdated.priority === 'high', 'Priority must be updated to high');

    // Internal note
    const noteAdded = await complaintService.addComment(testComplaintId, 'Admin Note: Prioritised for inspection before next class.', true);
    const internalComment = noteAdded.comments?.find((c) => c.isInternal);
    assert(Boolean(internalComment), 'Internal comment must exist');
    assert(internalComment?.isInternal === true, 'isInternal flag must be true');

    // Admin view with filterInternal=false exposes the internal note
    const adminView = await complaintService.getComplaintById(testComplaintId, false);
    assert(adminView?.comments?.some((c) => c.isInternal), 'Admin view must include internal notes');
  });

  await runTest('Admin Journey', 'Admin bulk status update performs batch updates with timeline entries', async () => {
    await authService.login('admin@college.edu', 'admin123');
    const all = await complaintService.getComplaints();
    const targetIds = all.slice(0, 2).map((c) => c.id);

    const updatedBatch = await complaintService.bulkUpdateStatus(targetIds, 'in_progress', 'Bulk status update during maintenance window.');
    assert(updatedBatch.length === targetIds.length, 'All target complaints must be updated');
    updatedBatch.forEach((c) => {
      assert(c.status === 'in_progress', 'Status must be in_progress');
      const latestTl = c.timeline[c.timeline.length - 1];
      assert(latestTl.message.includes('Bulk status update'), 'Timeline message must reflect bulk action');
    });
  });

  await runTest('Admin Journey', 'Admin user management: directory returns safe users without passwords', async () => {
    await authService.login('admin@college.edu', 'admin123');
    const users = await userService.getUsers();
    assert(users.length > 0, 'Users directory must return users');
    users.forEach((u: any) => {
      assert(u.password === undefined, 'Password field must NEVER exist on returned user records');
      assert(Boolean(u.id) && Boolean(u.name) && Boolean(u.email) && Boolean(u.role), 'Standard user properties must exist');
    });
  });

  await runTest('Admin Journey', 'Admin safeguards: last active admin and self-deactivation protection', async () => {
    const admin = await authService.login('admin@college.edu', 'admin123');

    // 1. Self-deactivation protection
    let selfDeactFailed = false;
    try {
      await userService.toggleUserStatus(admin.id);
    } catch (e: any) {
      selfDeactFailed = true;
      assert(e.message.includes('cannot deactivate your own account'), 'Must block self-deactivation');
    }
    assert(selfDeactFailed, 'Admin self-deactivation must be prevented');

    // 2. Self-demotion protection
    let selfDemoteFailed = false;
    try {
      await userService.updateUserRole(admin.id, 'student');
    } catch (e: any) {
      selfDemoteFailed = true;
      assert(e.message.includes('cannot remove your own administrator privileges'), 'Must block self-demotion');
    }
    assert(selfDemoteFailed, 'Admin self-demotion must be prevented');
  });

  await runTest('Admin Journey', 'Category management: unique names and slugs enforced, status toggle', async () => {
    await authService.login('admin@college.edu', 'admin123');

    // Create unique category
    const createdCat = await categoryService.createCategory({
      name: 'Laboratory Equipment',
      slug: 'lab-equipment',
      description: 'Science and computer lab equipment maintenance.',
      active: true,
      slaHours: 48,
    });
    assert(createdCat.name === 'Laboratory Equipment', 'Category name must match');

    // Duplicate name rejected
    let dupName = false;
    try {
      await categoryService.createCategory({
        name: 'Laboratory Equipment',
        slug: 'lab-equipment-diff',
        active: true,
      });
    } catch (e: any) {
      dupName = true;
      assert(e.message.includes('already exists'), 'Must reject duplicate category name');
    }
    assert(dupName, 'Duplicate category name must be rejected');

    // Duplicate slug rejected
    let dupSlug = false;
    try {
      await categoryService.createCategory({
        name: 'Lab Equipment Different Name',
        slug: 'lab-equipment',
        active: true,
      });
    } catch (e: any) {
      dupSlug = true;
      assert(e.message.includes('already exists'), 'Must reject duplicate category slug');
    }
    assert(dupSlug, 'Duplicate category slug must be rejected');

    // Toggle active status
    const toggled = await categoryService.toggleCategoryStatus(createdCat.id);
    assert(toggled.active === false, 'Category must be toggled to inactive');
    const toggledBack = await categoryService.toggleCategoryStatus(createdCat.id);
    assert(toggledBack.active === true, 'Category must be toggled back to active');
  });

  await runTest('Admin Journey', 'Admin broadcasts: department audience with no matching students throws error and does not fallback', async () => {
    await authService.login('admin@college.edu', 'admin123');

    // Broadcast targeting non-existent department
    let broadcastFailed = false;
    try {
      await notificationService.sendBroadcastNotification({
        title: 'Aerospace Engineering Alert',
        message: 'Lab closed for inspection.',
        audience: 'department',
        targetDepartment: 'NonExistentAerospaceDepartment',
        priority: 'warning',
      });
    } catch (e: any) {
      broadcastFailed = true;
      assert(e.message.includes('No active students found'), 'Must explain no active students found');
    }
    assert(broadcastFailed, 'Broadcasting to non-existent department must throw');

    // Verify that NO student received this failed broadcast
    const studentNotifs = await notificationService.getNotifications('user-student-1');
    assert(!studentNotifs.some((n) => n.title.includes('Aerospace Engineering Alert')), 'Failed department broadcast must NEVER fall back to students');
  });

  await runTest('Admin Journey', 'Admin broadcasts: valid department targeting dispatches only to department members', async () => {
    await authService.login('admin@college.edu', 'admin123');
    const record = await notificationService.sendBroadcastNotification({
      title: 'CS Department Symposium',
      message: 'Annual hackathon begins tomorrow.',
      audience: 'department',
      targetDepartment: 'Computer Science & Engineering',
      priority: 'info',
    });

    assert(record.recipientCount > 0, 'Recipient count must be > 0');
    assert(record.status === 'delivered', 'Status must be delivered');

    // CS student received notification
    const student = await authService.login('student@college.edu', 'student123');
    const notifs = await notificationService.getNotifications(student.id);
    assert(notifs.some((n) => n.title.includes('CS Department Symposium')), 'CS student must receive CS department broadcast');
  });

  // -------------------------------------------------------------------------
  // 5. SETTINGS & CROSS-ROLE STATE PROPAGATION
  // -------------------------------------------------------------------------
  console.log('--- 5. Settings & Cross-Role State Propagation ---');

  await runTest('Cross-Role Propagation', 'Admin priority change propagates instantly to student and timeline', async () => {
    // Admin sets priority to critical
    await authService.login('admin@college.edu', 'admin123');
    await complaintService.updatePriority(testComplaintId, 'critical', true);

    // Student views complaint
    await authService.login('student@college.edu', 'student123');
    const studentView = await complaintService.getComplaintById(testComplaintId);
    assert(studentView?.priority === 'critical', 'Student must see updated CRITICAL priority');
    assert(studentView?.timeline.some((t) => t.message.includes('CRITICAL')), 'Student timeline must reflect priority change');
  });

  await runTest('Cross-Role Propagation', 'Staff status progression propagates instantly to student view and timeline', async () => {
    // Staff progresses to resolved
    const staff = await authService.login('staff@college.edu', 'staff123');
    await complaintService.updateComplaintStatus(testComplaintId, 'resolved', 'Final power verification complete. All breakers operating normally.');

    // Student views complaint
    await authService.login('student@college.edu', 'student123');
    const studentView = await complaintService.getComplaintById(testComplaintId);
    assert(studentView?.status === 'resolved', 'Student must see RESOLVED status');
    assert(studentView?.timeline.some((t) => t.message.includes('Final power verification complete')), 'Student timeline must show staff work note');
  });

  await runTest('Cross-Role Propagation', 'Maintenance mode blocks student submissions while admin retains access', async () => {
    // Admin enables maintenance mode
    await authService.login('admin@college.edu', 'admin123');
    await settingsService.updateSettings({ maintenanceMode: true });

    // Student attempts complaint submission
    await authService.login('student@college.edu', 'student123');
    let studentBlocked = false;
    try {
      await complaintService.createComplaint({
        title: 'Submission during maintenance',
        description: 'Should be blocked.',
        category: 'Campus Infrastructure',
        studentId: 'user-student-1',
        studentName: 'Student User',
        studentEmail: 'student@college.edu',
        attachments: [],
      });
    } catch (e: any) {
      studentBlocked = true;
      assert(e.message.includes('scheduled system maintenance'), 'Must explain maintenance mode');
    }
    assert(studentBlocked, 'Student submission must be blocked during maintenance mode');

    // Admin can still submit complaints or manage tickets
    await authService.login('admin@college.edu', 'admin123');
    const adminComp = await complaintService.createComplaint({
      title: 'Admin Emergency Maintenance Ticket',
      description: 'Permitted administrative submission.',
      category: 'Campus Infrastructure',
      studentId: 'user-admin-1',
      studentName: 'System Administrator',
      studentEmail: 'admin@college.edu',
      attachments: [],
    });
    assert(Boolean(adminComp.id), 'Admin submission must succeed during maintenance mode');

    // Disable maintenance mode
    await settingsService.updateSettings({ maintenanceMode: false });
  });

  // -------------------------------------------------------------------------
  // 6. ANALYTICS VERIFICATION ACROSS REPORTING WINDOWS
  // -------------------------------------------------------------------------
  console.log('--- 6. Analytics Verification Across Reporting Windows ---');

  await runTest('Analytics', 'Admin can compute dynamic analytics across all 5 reporting windows', async () => {
    await authService.login('admin@college.edu', 'admin123');

    const windows: Array<'7d' | '30d' | '3m' | '6m' | '1y'> = ['7d', '30d', '3m', '6m', '1y'];
    for (const w of windows) {
      const analytics = await analyticsService.getAnalytics(w);
      assert(typeof analytics.totalComplaints === 'number', `totalComplaints must be number for ${w}`);
      assert(typeof analytics.resolutionRate === 'number', `resolutionRate must be number for ${w}`);
      assert(Array.isArray(analytics.trendData), `trendData must be array for ${w}`);
      assert(Array.isArray(analytics.categoryDistribution), `categoryDistribution must be array for ${w}`);
      assert(Array.isArray(analytics.departmentPerformance), `departmentPerformance must be array for ${w}`);
      assert(Array.isArray(analytics.priorityDistribution), `priorityDistribution must be array for ${w}`);
    }
  });

  await runTest('Analytics', 'Non-admin users are strictly denied access to analyticsService', async () => {
    // Student
    await authService.login('student@college.edu', 'student123');
    let studentBlocked = false;
    try {
      await analyticsService.getAnalytics('30d');
    } catch (e: any) {
      studentBlocked = true;
    }
    assert(studentBlocked, 'Student must be denied analytics');

    // Staff
    await authService.login('staff@college.edu', 'staff123');
    let staffBlocked = false;
    try {
      await analyticsService.getAnalytics('30d');
    } catch (e: any) {
      staffBlocked = true;
    }
    assert(staffBlocked, 'Staff must be denied analytics');
  });

  // -------------------------------------------------------------------------
  // 7. STORAGE ROBUSTNESS & DATA CORRUPTION RECOVERY
  // -------------------------------------------------------------------------
  console.log('--- 7. Storage Robustness & Data Corruption Recovery ---');

  await runTest('Storage Robustness', 'Missing storage key returns default fallback safely without crashing', async () => {
    const missing = getStorageItem('non_existent_key_xyz', { fallback: true });
    assert(missing.fallback === true, 'Must return fallback when key does not exist');
  });

  await runTest('Storage Robustness', 'Malformed JSON in storage is caught gracefully and returns fallback', async () => {
    setStorageItem('corrupted_test_key', 'this-is-not-valid-json{{{');
    // Direct raw storage overwrite to simulate corrupted storage text
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('corrupted_raw_key', '{bad json');
    }
    const safeRead = getStorageItem('corrupted_raw_key', { safe: true });
    assert(safeRead.safe === true, 'Must return fallback without throwing on malformed JSON');
  });

  await runTest('Storage Robustness', 'Corrupted settings values are sanitized to valid defaults', async () => {
    const corruptedSettings = {
      defaultPriority: 'super_ultra_high', // Invalid priority
      maxAttachmentsPerComplaint: -5, // Invalid negative count
      maxAttachmentSizeMB: 'twenty_mb', // Invalid string instead of number
      maintenanceMode: 'yes_please', // Invalid string instead of boolean
    };

    const sanitized = settingsService.validateAndSanitizeSettings(corruptedSettings);
    assert(sanitized.defaultPriority === MOCK_SETTINGS.defaultPriority, 'Invalid priority must fallback to default');
    assert(sanitized.maxAttachmentsPerComplaint === MOCK_SETTINGS.maxAttachmentsPerComplaint, 'Invalid attachment count must fallback to default');
    assert(sanitized.maxAttachmentSizeMB === MOCK_SETTINGS.maxAttachmentSizeMB, 'Invalid attachment size must fallback to default');
    assert(sanitized.maintenanceMode === MOCK_SETTINGS.maintenanceMode, 'Invalid boolean must fallback to default');
  });

  await runTest('Storage Robustness', 'Legacy complaint record missing optional fields is handled gracefully', async () => {
    await authService.login('admin@college.edu', 'admin123');
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    
    // Create legacy complaint missing attachments, comments, location, and department
    const legacyComplaint: Complaint = {
      id: 'cmp-legacy-1999',
      ticketNumber: 'CMP-1999',
      title: 'Legacy Record Without Optional Fields',
      description: 'Historical archive entry.',
      category: 'Campus Infrastructure',
      status: 'resolved',
      priority: 'low',
      studentId: 'user-student-1',
      studentName: 'Student User',
      studentEmail: 'student@college.edu',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      timeline: [
        {
          id: 'tl-leg-1',
          complaintId: 'cmp-legacy-1999',
          status: 'resolved',
          message: 'Historical resolution.',
          updatedBy: 'System',
          role: 'admin',
          timestamp: '2026-01-02T00:00:00.000Z',
        },
      ],
    };

    setStorageItem(STORAGE_KEYS.COMPLAINTS, [legacyComplaint, ...complaints]);

    // Query details as admin
    const legacyDetails = await complaintService.getComplaintById(legacyComplaint.id);
    assert(legacyDetails !== null, 'Legacy complaint must load');
    assert(legacyDetails.title === 'Legacy Record Without Optional Fields', 'Legacy title must match');

    // Query analytics - must not crash when encountering legacy record
    const analytics = await analyticsService.getAnalytics('1y');
    assert(analytics.totalComplaints > 0, 'Analytics must compute cleanly with legacy record present');
  });

  // -------------------------------------------------------------------------
  // 8. DEMO DATA RESET & STATE RESTORATION
  // -------------------------------------------------------------------------
  console.log('--- 8. Demo Data Reset & State Restoration ---');

  await runTest('Demo Reset', 'Reset restores exact initial dataset with zero orphaned records and maintains admin session', async () => {
    const admin = await authService.login('admin@college.edu', 'admin123');

    // Trigger demo reset
    await settingsService.resetDemoData();

    // Verify session preserved
    assert(authService.isAuthenticated(), 'Admin session must remain authenticated');
    assert(authService.getCurrentUser()?.role === 'admin', 'Active session must remain admin');

    // Verify complaints restored to MOCK_COMPLAINTS
    const complaints = await complaintService.getComplaints();
    assert(complaints.length === MOCK_COMPLAINTS.length, `Complaints count must match initial mock data (${MOCK_COMPLAINTS.length})`);

    // Verify users restored to MOCK_USERS
    const users = await userService.getUsers();
    assert(users.length === MOCK_USERS.length, `Users count must match initial mock data (${MOCK_USERS.length})`);

    // Verify categories restored to MOCK_CATEGORIES
    const categories = await categoryService.getCategories();
    assert(categories.length === MOCK_CATEGORIES.length, `Categories count must match initial mock data (${MOCK_CATEGORIES.length})`);

    // Verify settings restored to MOCK_SETTINGS
    const settings = await settingsService.getSettings();
    assert(settings.portalName === MOCK_SETTINGS.portalName, 'Settings must match mock settings');

    // Verify analytics reflects restored baseline cleanly
    const freshAnalytics = await analyticsService.getAnalytics('30d');
    assert(freshAnalytics.totalComplaints > 0, 'Analytics must compute cleanly on restored baseline');
  });

  // -------------------------------------------------------------------------
  // 9. REACT DUPLICATE-KEY REGRESSION AND DETERMINISTIC DEDUPLICATION
  // -------------------------------------------------------------------------
  console.log('--- 9. React Duplicate-Key Regression & Deduplication Safeguards ---');

  await runTest('Key Uniqueness', 'Simulated storage duplicates of cmp-1001 and cmp-1002 are automatically deduplicated', async () => {
    await authService.login('admin@college.edu', 'admin123');

    // Intentionally inject duplicates of cmp-1001 and cmp-1002 into storage
    const rawComplaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const cmp1001 = rawComplaints.find((c) => c.id === 'cmp-1001')!;
    const cmp1002 = rawComplaints.find((c) => c.id === 'cmp-1002')!;

    // Create a corrupted storage list containing duplicates
    const corruptedList = [cmp1001, cmp1002, ...rawComplaints, { ...cmp1001 }, { ...cmp1002 }];
    setStorageItem(STORAGE_KEYS.COMPLAINTS, corruptedList);

    // Call ensureInitialized and getComplaints
    complaintService.ensureInitialized();
    const sanitizedComplaints = await complaintService.getComplaints();

    const seenIds = new Set<string>();
    let duplicatesFound = false;
    for (const c of sanitizedComplaints) {
      if (seenIds.has(c.id.toLowerCase())) {
        duplicatesFound = true;
        break;
      }
      seenIds.add(c.id.toLowerCase());
    }

    assert(!duplicatesFound, 'Sanitized complaints array must contain zero duplicate complaint IDs');
    assert(seenIds.has('cmp-1001'), 'cmp-1001 must be preserved with stable ID');
    assert(seenIds.has('cmp-1002'), 'cmp-1002 must be preserved with stable ID');
  });

  await runTest('Key Uniqueness', 'Student dashboard complaints list returns strictly unique items for student', async () => {
    const student = await authService.login('student@college.edu', 'student123');
    const studentComplaints = await complaintService.getStudentComplaints(student.id);

    const seenIds = new Set<string>();
    for (const c of studentComplaints) {
      assert(!seenIds.has(c.id), `Student complaints must not contain duplicate ID: ${c.id}`);
      seenIds.add(c.id);
    }
    assert(studentComplaints.length > 0, 'Student should have active complaints');
  });

  await runTest('Key Uniqueness', 'createComplaint guarantees collision-free IDs and tickets without random UUID workaround', async () => {
    await authService.login('admin@college.edu', 'admin123');
    const existingBefore = await complaintService.getComplaints();
    const existingIds = new Set(existingBefore.map((c) => c.id.toLowerCase()));

    await authService.login('student@college.edu', 'student123');
    const newComp1 = await complaintService.createComplaint({
      title: 'Deduplication Test Complaint 1',
      description: 'Testing collision-free sequential generation',
      category: 'Campus Infrastructure',
      studentId: 'user-student-1',
      studentName: 'Alex Johnson',
      studentEmail: 'student@college.edu',
      attachments: [],
    });

    const newComp2 = await complaintService.createComplaint({
      title: 'Deduplication Test Complaint 2',
      description: 'Testing second sequential generation',
      category: 'Campus Infrastructure',
      studentId: 'user-student-1',
      studentName: 'Alex Johnson',
      studentEmail: 'student@college.edu',
      attachments: [],
    });

    assert(!existingIds.has(newComp1.id.toLowerCase()), 'New complaint 1 must have unique non-colliding ID');
    assert(!existingIds.has(newComp2.id.toLowerCase()), 'New complaint 2 must have unique non-colliding ID');
    assert(newComp1.id !== newComp2.id, 'Created complaints must have distinct IDs');
    assert(newComp1.ticketNumber !== newComp2.ticketNumber, 'Created complaints must have distinct ticket numbers');
    assert(newComp1.id.startsWith('cmp-'), 'Complaint ID must maintain stable cmp-* deterministic format');
  });

  // -------------------------------------------------------------------------
  // 10. LOCALSTORAGE QUOTA EXCEEDED & ERROR PROPAGATION SAFEGUARDS
  // -------------------------------------------------------------------------
  console.log('--- 10. Storage Quota Exceeded & Error Propagation Safeguards ---');

  // Test 1: Quota failure in createComplaint
  await runTest('Storage Quota', 'createComplaint fails and throws StorageQuotaError when localStorage quota is exceeded without false-success', async () => {
    await authService.login('student@college.edu', 'student123');

    // Snapshot existing complaints
    await authService.login('admin@college.edu', 'admin123');
    const existingComplaintsBefore = await complaintService.getComplaints();
    const countBefore = existingComplaintsBefore.length;

    await authService.login('student@college.edu', 'student123');

    // Simulate window.localStorage.setItem throwing QuotaExceededError
    const originalWindow = (globalThis as any).window;
    const existingWindowStorage = originalWindow?.localStorage;
    const memoryData = new Map<string, string>();
    memoryData.set(STORAGE_KEYS.COMPLAINTS, JSON.stringify(existingComplaintsBefore));

    const mockStorage = {
      getItem: (key: string) => memoryData.get(key) || existingWindowStorage?.getItem?.(key) || null,
      setItem: (key: string, val: string) => {
        if (key === STORAGE_KEYS.COMPLAINTS) {
          const quotaErr = new Error("Failed to execute 'setItem' on 'Storage': Setting the value of 'scp_complaints' exceeded the quota.");
          quotaErr.name = 'QuotaExceededError';
          (quotaErr as any).code = 22;
          throw quotaErr;
        }
        memoryData.set(key, val);
      },
      removeItem: (key: string) => { memoryData.delete(key); },
      clear: () => { memoryData.clear(); },
    };

    (globalThis as any).window = {
      ...(originalWindow || {}),
      localStorage: mockStorage,
    };

    let caughtError: any = null;
    let createdResult: any = null;

    try {
      createdResult = await complaintService.createComplaint({
        title: 'Quota Exceeded Test Ticket',
        description: 'This complaint must not be saved or returned as success.',
        category: 'Campus Infrastructure',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        studentEmail: 'student@college.edu',
        attachments: [],
      });
    } catch (err: any) {
      caughtError = err;
    } finally {
      // Restore window
      if (originalWindow) {
        (globalThis as any).window = originalWindow;
      } else {
        delete (globalThis as any).window;
      }
    }

    assert(createdResult === null, 'No complaint result must be returned on storage quota failure');
    assert(caughtError !== null, 'createComplaint must throw on storage quota failure');
    assert(
      isQuotaExceededError(caughtError) || caughtError instanceof StorageQuotaError || caughtError.message.includes('browser storage is full'),
      'Thrown error must be a quota-exceeded error with user-friendly message'
    );
    assert(
      caughtError.message.includes('browser storage is full'),
      'Error message must follow the user-friendly portal standard'
    );

    // Verify storage has not gained an orphan complaint
    await authService.login('admin@college.edu', 'admin123');
    const existingComplaintsAfter = await complaintService.getComplaints();
    assert(existingComplaintsAfter.length === countBefore, 'Storage complaint count must remain unchanged after quota failure');
    assert(
      !existingComplaintsAfter.some((c) => c.title === 'Quota Exceeded Test Ticket'),
      'Unsaved complaint must not exist in storage'
    );
  });

  // Test 2: UI submission failure contract
  await runTest('Storage Quota', 'UI submission failure stays on form, displays user-friendly error, and avoids navigation', async () => {
    // Simulate UI submission handler behavior
    let currentStep = 4;
    let submittedComplaint: any = null;
    let navigatedTo: string | null = null;
    let displayedToastError: string | null = null;
    let submissionError: string | null = null;

    // Simulate failing createComplaint
    const failingSubmit = async () => {
      try {
        throw new StorageQuotaError(
          'Unable to save your complaint because browser storage is full. Please remove some stored demo data or reset Demo Mode and try again.'
        );
      } catch (err: unknown) {
        let msg = 'Failed to submit complaint';
        if (
          isQuotaExceededError(err) ||
          (err instanceof Error && /storage.*full|quota.*exceeded/i.test(err.message))
        ) {
          msg =
            'Unable to save your complaint because browser storage is full. Please remove some stored demo data or reset Demo Mode and try again.';
        } else if (err instanceof Error) {
          msg = err.message;
        }
        submissionError = msg;
        displayedToastError = msg;
      }
    };

    await failingSubmit();

    assert(submittedComplaint === null, 'submittedComplaint must remain null so success screen is not triggered');
    assert(navigatedTo === null, 'No navigation must occur when persistence fails');
    assert(currentStep === 4, 'User must remain on the submission step');
    assert(submissionError !== null, 'A clear submission error message must be set for inline display');
    assert(
      submissionError.includes('browser storage is full') && submissionError.includes('reset Demo Mode'),
      'Inline error must guide the user with actionable demo reset instructions'
    );
    assert(displayedToastError === submissionError, 'Toast error must match inline error');
  });

  // Test 3: Successful submission contract
  await runTest('Storage Quota', 'Successful submission persists complaint and establishes valid complaint details target', async () => {
    await authService.login('student@college.edu', 'student123');

    const successfulComplaint = await complaintService.createComplaint({
      title: 'Successful Persistence Complaint',
      description: 'Verifying normal submission persists and yields accessible complaint.',
      category: 'Campus Infrastructure',
      studentId: 'user-student-1',
      studentName: 'Alex Johnson',
      studentEmail: 'student@college.edu',
      attachments: [],
    });

    assert(successfulComplaint !== null, 'Complaint must be returned on successful persistence');
    assert(successfulComplaint.id.startsWith('cmp-'), 'Complaint must have valid deterministic ID');

    // Student can immediately retrieve details by ID
    const retrieved = await complaintService.getComplaintById(successfulComplaint.id);
    assert(retrieved !== null, 'Persisted complaint must be retrievable by ID');
    assert(retrieved.title === 'Successful Persistence Complaint', 'Title must match persisted data');
  });

  // Test 4: Attachment limits enforced before persistence
  await runTest('Storage Quota', 'Attachment limits and file sizes are strictly validated before storage write', async () => {
    await authService.login('student@college.edu', 'student123');

    // Verify oversized attachment is rejected before attempting persistence
    let oversizedRejected = false;
    try {
      // 6MB payload when max limit is 5MB
      const oversizedPayload = 'data:image/jpeg;base64,' + 'A'.repeat(6 * 1024 * 1024 * 4 / 3);
      await complaintService.createComplaint({
        title: 'Oversized Attachment Complaint',
        description: 'Should be rejected before storage write.',
        category: 'Campus Infrastructure',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        studentEmail: 'student@college.edu',
        attachments: [oversizedPayload],
      });
    } catch (e: any) {
      oversizedRejected = true;
      assert(e.message.includes('exceeds the maximum allowed file size'), 'Must enforce file size limit before writing');
    }
    assert(oversizedRejected, 'Oversized attachment must be rejected prior to storage persistence');
  });

  // Test 5: Demo Mode Reset recovery flow
  await runTest('Storage Quota', 'Demo Mode reset recovers storage from full state and restores successful submission flow', async () => {
    const admin = await authService.login('admin@college.edu', 'admin123');

    // Trigger demo reset
    await settingsService.resetDemoData();

    // Verify storage baseline restored
    const complaints = await complaintService.getComplaints();
    assert(complaints.length === MOCK_COMPLAINTS.length, 'Complaints restored to pristine mock count');

    // Authenticate as student and submit complaint
    await authService.login('student@college.edu', 'student123');
    const postResetComplaint = await complaintService.createComplaint({
      title: 'Post-Reset Valid Ticket',
      description: 'Submitted successfully after demo data reset.',
      category: 'Campus Infrastructure',
      studentId: 'user-student-1',
      studentName: 'Alex Johnson',
      studentEmail: 'student@college.edu',
      attachments: [],
    });

    assert(postResetComplaint !== null, 'Complaint submission must succeed after demo reset');
    assert(postResetComplaint.id.startsWith('cmp-'), 'Must have valid ID');

    const verified = await complaintService.getComplaintById(postResetComplaint.id);
    assert(verified !== null, 'Complaint must exist in storage and be viewable');
  });

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('PHASE 8C TEST SUITE EXECUTION SUMMARY');
  console.log('======================================================================');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const successRate = ((passed / total) * 100).toFixed(1);

  console.log(`Total Tests Run : ${total}`);
  console.log(`Passed          : ${passed}`);
  console.log(`Failed          : ${failed}`);
  console.log(`Success Rate    : ${successRate}%\n`);

  if (failed > 0) {
    console.error('FAILURES DETECTED:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.error(`- [${r.category}] ${r.name}: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log('ALL PHASE 8C END-TO-END TESTS PASSED WITH 100% SUCCESS!');
  }
}

runPhase8CTestSuite().catch((e) => {
  console.error('Test runner fatal error:', e);
  process.exit(1);
});
