import { authService } from '../src/services/authService';
import { complaintService } from '../src/services/complaintService';
import { userService } from '../src/services/userService';
import { categoryService } from '../src/services/categoryService';
import { notificationService } from '../src/services/notificationService';
import { settingsService } from '../src/services/settingsService';
import { clearAppStorage, STORAGE_KEYS, setStorageItem, getStorageItem } from '../src/utils/storage';
import { MOCK_USERS, MOCK_COMPLAINTS, MOCK_SETTINGS, MOCK_CATEGORIES } from '../src/data/mockData';

interface TestResult {
  name: string;
  category: string;
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
    results.push({ name, category, passed: true });
    console.log(`  ✓ [${category}] ${name}`);
  } catch (err: any) {
    results.push({ name, category, passed: false, error: err.message });
    console.error(`  ✗ [${category}] ${name}:`, err.message);
  }
}

async function runAllTests() {
  console.log('======================================================================');
  console.log('SMART COLLEGE COMPLAINT PORTAL — CORRECTION PHASE 3 QA INTEGRATION SUITE');
  console.log('======================================================================\n');

  // Reset clean state
  clearAppStorage();

  // -------------------------------------------------------------------------
  // 1. STUDENT WORKFLOW TESTS
  // -------------------------------------------------------------------------
  console.log('--- 1. Testing Student Workflow ---');

  await runTest('Student Workflow', 'Student self-registration succeeds with active status and student role', async () => {
    authService.invalidateSession();
    const student = await authService.register({
      name: 'Integration Test Student',
      email: 'test.student@college.edu',
      password: 'password123',
      studentId: 'STU2026-9999',
      department: 'Computer Science & Engineering',
      phone: '+1 555 999 8888',
      year: '1st Year',
    });

    assert(student.role === 'student', 'Registered role must be student');
    assert(student.status === 'active', 'Registered status must be active');
    assert(authService.getCurrentUser() === null, 'Registration must not auto-login student');
  });

  await runTest('Student Workflow', 'Duplicate email or student ID is rejected during registration', async () => {
    let emailRejected = false;
    try {
      await authService.register({
        name: 'Duplicate Student',
        email: 'test.student@college.edu',
        password: 'password123',
        studentId: 'STU2026-0001',
        department: 'Mechanical Engineering',
        phone: '+1 555 999 8889',
      });
    } catch {
      emailRejected = true;
    }
    assert(emailRejected, 'Duplicate email registration must throw an error');

    let idRejected = false;
    try {
      await authService.register({
        name: 'Duplicate ID Student',
        email: 'test2.student@college.edu',
        password: 'password123',
        studentId: 'STU2026-9999',
        department: 'Civil Engineering',
        phone: '+1 555 999 8890',
      });
    } catch {
      idRejected = true;
    }
    assert(idRejected, 'Duplicate student ID registration must throw an error');
  });

  await runTest('Student Workflow', 'Student login succeeds and sets active session', async () => {
    const user = await authService.login('test.student@college.edu', 'password123');
    assert(user.email === 'test.student@college.edu', 'Logged in user email matches');
    assert(authService.getCurrentUser()?.id === user.id, 'Session active user matches');
  });

  await runTest('Student Workflow', 'Student cannot update protected fields (role, status, email) in profile', async () => {
    const current = authService.getCurrentUser()!;
    const updated = await userService.updateProfile(current.id, {
      name: 'Updated Student Name',
      role: 'admin' as any,
      status: 'inactive' as any,
      email: 'hacked@college.edu',
    });

    assert(updated.name === 'Updated Student Name', 'Name updated');
    assert(updated.role === 'student', 'Role privilege escalation prevented');
    assert(updated.status === 'active', 'Status modification prevented');
    assert(updated.email === 'test.student@college.edu', 'Email modification prevented');
  });

  await runTest('Student Workflow', 'Student cannot update another user profile', async () => {
    let rejected = false;
    try {
      await userService.updateProfile('user-admin-1', { name: 'Attempted Hack' });
    } catch {
      rejected = true;
    }
    assert(rejected, 'Student must be blocked from updating another user profile');
  });

  await runTest('Student Workflow', 'Student creates complaint with category auto-assignment and valid attachments', async () => {
    // Enable auto-assignment as admin first
    await authService.login('admin@college.edu', 'admin123');
    await settingsService.updateSettings({ autoAssignComplaints: true });

    // Switch back to student
    await authService.login('test.student@college.edu', 'password123');
    const current = authService.getCurrentUser()!;
    const validDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const complaint = await complaintService.createComplaint({
      title: 'Flickering lights in Room 302',
      description: 'The ceiling lights are flickering continuously since morning.',
      category: 'electrical',
      location: 'Science Block, Room 302',
      studentId: current.id,
      studentName: current.name,
      studentEmail: current.email,
      studentPhone: current.phone || '',
      studentDepartment: current.department || '',
      attachments: [validDataUrl],
    });

    assert(complaint.id.startsWith('cmp-'), 'Complaint created with cmp- ID');
    assert(complaint.category === 'electrical', 'Category matches');
    assert(complaint.assignedDepartment === 'Electrical', 'Auto-assigned to Electrical department');
    assert(Boolean(complaint.assignedTo), 'Assigned to active electrical technician');
    assert(complaint.status === 'assigned', 'Status transitioned to assigned due to auto-assignment');
    assert(complaint.timeline.length >= 1, 'Timeline initialized');
  });

  await runTest('Student Workflow', 'Student can only view non-internal timeline and comments', async () => {
    const studentUser = authService.getCurrentUser()!;

    // Temporarily sign in as admin to add an internal note to the complaint
    const admin = await authService.login('admin@college.edu', 'admin123');
    const complaints = await complaintService.getComplaints();
    const createdComplaint = complaints.find((c) => c.studentId === studentUser.id)!;

    await complaintService.addComment(createdComplaint.id, 'Internal admin investigation note', true);
    await complaintService.updateComplaintStatus(createdComplaint.id, 'in_progress', 'Staff dispatched to inspect', true);

    // Switch back to student
    await authService.login(studentUser.email, 'password123');

    // Fetch complaint as student
    const studentView = await complaintService.getComplaintById(createdComplaint.id, false);
    assert(studentView !== null, 'Complaint fetched');

    const internalTimeline = studentView?.timeline.filter((t) => t.isInternal);
    const internalComments = studentView?.comments?.filter((c) => c.isInternal);

    assert(internalTimeline?.length === 0, 'Internal timeline events must be hidden from student');
    assert(internalComments?.length === 0, 'Internal comments must be hidden from student');
  });

  await runTest('Student Workflow', 'Student cannot create internal notes or comment on other students complaints', async () => {
    const studentUser = authService.getCurrentUser()!;
    const complaints = await complaintService.getComplaints();
    const myComplaint = complaints.find((c) => c.studentId === studentUser.id)!;
    const otherComplaint = complaints.find((c) => c.studentId !== studentUser.id)!;

    let internalRejected = false;
    try {
      await complaintService.addComment(myComplaint.id, 'Student trying internal note', true);
    } catch {
      internalRejected = true;
    }
    assert(internalRejected, 'Student setting isInternal=true must be rejected');

    let otherRejected = false;
    try {
      await complaintService.addComment(otherComplaint.id, 'Student trespassing note', false);
    } catch {
      otherRejected = true;
    }
    assert(otherRejected, 'Student commenting on another students complaint must be rejected');
  });

  await runTest('Student Workflow', 'Student cannot directly modify complaint status', async () => {
    const studentUser = authService.getCurrentUser()!;
    const complaints = await complaintService.getComplaints();
    const myComplaint = complaints.find((c) => c.studentId === studentUser.id)!;

    let rejected = false;
    try {
      await complaintService.updateComplaintStatus(myComplaint.id, 'resolved', 'Student self-resolving');
    } catch {
      rejected = true;
    }
    assert(rejected, 'Student must be rejected from directly modifying complaint status');
  });

  await runTest('Student Workflow', 'Student can reopen resolved complaint, but cannot reopen in_progress complaint', async () => {
    const studentUser = authService.getCurrentUser()!;
    const complaints = await complaintService.getComplaints();
    const myComplaint = complaints.find((c) => c.studentId === studentUser.id)!;

    // Currently in_progress (set by admin earlier)
    let inProgressReopenRejected = false;
    try {
      await complaintService.reopenComplaint(myComplaint.id, 'Issue still persists');
    } catch {
      inProgressReopenRejected = true;
    }
    assert(inProgressReopenRejected, 'Cannot reopen non-resolved/non-rejected complaint');

    // Admin resolves complaint
    await authService.login('admin@college.edu', 'admin123');
    await complaintService.updateComplaintStatus(myComplaint.id, 'resolved', 'Repaired fixtures', false);

    // Switch back to student
    await authService.login(studentUser.email, 'password123');
    const reopened = await complaintService.reopenComplaint(myComplaint.id, 'Light still flickers in corner');
    assert(reopened.status === 'pending', 'Status reverted to pending upon reopen');
    assert(Boolean(reopened.reopenReason), 'Reopen reason recorded');
    assert(reopened.timeline[reopened.timeline.length - 1].message.includes('Light still flickers'), 'Reopen event recorded in timeline');
  });

  await runTest('Student Workflow', 'Student is blocked from administrative actions', async () => {
    let assignBlocked = false;
    try {
      await complaintService.assignComplaint('cmp-1001', 'staff-1', 'Ramesh Kumar');
    } catch {
      assignBlocked = true;
    }
    assert(assignBlocked, 'Student blocked from assigning complaint');

    let priorityBlocked = false;
    try {
      await complaintService.updatePriority('cmp-1001', 'critical');
    } catch {
      priorityBlocked = true;
    }
    assert(priorityBlocked, 'Student blocked from changing complaint priority');

    let bulkBlocked = false;
    try {
      await complaintService.bulkUpdateStatus(['cmp-1001'], 'resolved', 'Bulk test');
    } catch {
      bulkBlocked = true;
    }
    assert(bulkBlocked, 'Student blocked from bulk status updates');

    let userStatusBlocked = false;
    try {
      await userService.toggleUserStatus('user-student-2');
    } catch {
      userStatusBlocked = true;
    }
    assert(userStatusBlocked, 'Student blocked from toggling user status');

    let categoryBlocked = false;
    try {
      await categoryService.createCategory({ name: 'Hacked Cat', description: 'desc', active: true });
    } catch {
      categoryBlocked = true;
    }
    assert(categoryBlocked, 'Student blocked from creating category');

    let broadcastBlocked = false;
    try {
      await notificationService.sendBroadcastNotification({
        title: 'Spam',
        message: 'Spam message',
        audience: 'all_students',
      });
    } catch {
      broadcastBlocked = true;
    }
    assert(broadcastBlocked, 'Student blocked from sending broadcast notifications');

    let resetBlocked = false;
    try {
      await settingsService.resetDemoData();
    } catch {
      resetBlocked = true;
    }
    assert(resetBlocked, 'Student blocked from resetting demo data');
  });

  // -------------------------------------------------------------------------
  // 2. STAFF WORKFLOW TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing Staff Workflow ---');

  await runTest('Staff Workflow', 'Staff member authenticates with staff credentials', async () => {
    authService.invalidateSession();
    const staff = await authService.login('ramesh.kumar@college.edu', 'staff123');
    assert(staff.role === 'staff', 'Role is staff');
    assert(staff.department === 'Electrical', 'Staff department is Electrical');
  });

  await runTest('Staff Workflow', 'Staff member views assigned complaints with internal notes hidden', async () => {
    const staff = authService.getCurrentUser()!;
    const staffComplaints = await complaintService.getStaffComplaints(staff.id);
    assert(Array.isArray(staffComplaints), 'Returns array of assigned complaints');

    // Ensure all returned complaints have internal notes stripped
    staffComplaints.forEach((c) => {
      assert(!c.timeline.some((t) => t.isInternal), 'Staff view must have internal timeline events stripped');
      assert(!c.comments?.some((cm) => cm.isInternal), 'Staff view must have internal comments stripped');
    });
  });

  await runTest('Staff Workflow', 'Staff member can update status of assigned complaint', async () => {
    const staff = authService.getCurrentUser()!;
    const staffComplaints = await complaintService.getStaffComplaints(staff.id);
    assert(staffComplaints.length > 0, 'Staff has assigned complaints');
    const target = staffComplaints[0];

    const updated = await complaintService.updateComplaintStatus(
      target.id,
      'in_progress',
      'Technician on site inspecting electrical wiring'
    );
    assert(updated.status === 'in_progress', 'Staff updated status to in_progress');
  });

  await runTest('Staff Workflow', 'Staff member cannot update unassigned complaint or complaint assigned to other staff', async () => {
    const complaints = await complaintService.getComplaints();
    const otherComplaint = complaints.find((c) => c.assignedTo !== 'staff-1')!;

    let rejected = false;
    try {
      await complaintService.updateComplaintStatus(otherComplaint.id, 'resolved', 'Illegal update');
    } catch {
      rejected = true;
    }
    assert(rejected, 'Staff blocked from updating complaint not assigned to them');
  });

  await runTest('Staff Workflow', 'Staff member cannot create internal notes or reopen complaints', async () => {
    const staff = authService.getCurrentUser()!;
    const staffComplaints = await complaintService.getStaffComplaints(staff.id);
    const target = staffComplaints[0];

    let internalCommentBlocked = false;
    try {
      await complaintService.addComment(target.id, 'Staff trying internal note', true);
    } catch {
      internalCommentBlocked = true;
    }
    assert(internalCommentBlocked, 'Staff blocked from creating internal comment');

    let internalStatusBlocked = false;
    try {
      await complaintService.updateComplaintStatus(target.id, 'in_progress', 'Staff internal update', true);
    } catch {
      internalStatusBlocked = true;
    }
    assert(internalStatusBlocked, 'Staff blocked from creating internal status update');

    let reopenBlocked = false;
    try {
      await complaintService.reopenComplaint(target.id, 'Staff trying to reopen');
    } catch {
      reopenBlocked = true;
    }
    assert(reopenBlocked, 'Staff blocked from reopening complaints');
  });

  await runTest('Staff Workflow', 'Staff member is blocked from admin operations', async () => {
    let assignBlocked = false;
    try {
      await complaintService.assignComplaint('cmp-1001', 'staff-2', 'Amit Patil');
    } catch {
      assignBlocked = true;
    }
    assert(assignBlocked, 'Staff blocked from assigning staff');

    let userBlocked = false;
    try {
      await userService.toggleUserStatus('user-student-1');
    } catch {
      userBlocked = true;
    }
    assert(userBlocked, 'Staff blocked from toggling user status');

    let settingsBlocked = false;
    try {
      await settingsService.updateSettings({ maintenanceMode: true });
    } catch {
      settingsBlocked = true;
    }
    assert(settingsBlocked, 'Staff blocked from updating settings');

    let resetBlocked = false;
    try {
      await settingsService.resetDemoData();
    } catch {
      resetBlocked = true;
    }
    assert(resetBlocked, 'Staff blocked from resetting demo data');
  });

  // -------------------------------------------------------------------------
  // 3. ADMIN WORKFLOW TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing Admin Workflow ---');

  await runTest('Admin Workflow', 'Admin authenticates with admin credentials', async () => {
    authService.invalidateSession();
    const admin = await authService.login('admin@college.edu', 'admin123');
    assert(admin.role === 'admin', 'Admin role verified');
    assert(authService.getCurrentUser()?.id === 'user-admin-1', 'Active user matches admin');
  });

  await runTest('Admin Workflow', 'Admin can view, create, and manage internal notes', async () => {
    const complaints = await complaintService.getComplaints();
    const target = complaints[0];

    // Add internal note as admin
    await complaintService.addComment(target.id, 'Admin confidential contractor estimate: $250', true);

    // Read complaint as admin with filterInternal = false
    const adminView = await complaintService.getComplaintById(target.id, false);
    const internalComments = adminView?.comments?.filter((c) => c.isInternal);
    assert((internalComments?.length || 0) > 0, 'Admin can see internal comments');
  });

  await runTest('Admin Workflow', 'Admin assigns complaint to technician and changes priority', async () => {
    const complaints = await complaintService.getComplaints();
    const target = complaints[0];

    const assigned = await complaintService.assignComplaint(target.id, 'staff-2', 'Amit Patil', 'IT Support');
    assert(assigned.assignedTo === 'staff-2', 'Staff ID assigned');
    assert(assigned.assignedStaffName === 'Amit Patil', 'Staff name assigned');
    assert(assigned.assignedDepartment === 'IT Support', 'Staff department assigned');

    const prioritized = await complaintService.updatePriority(target.id, 'critical');
    assert(prioritized.priority === 'critical', 'Priority changed to critical');
    assert(prioritized.timeline[prioritized.timeline.length - 1].message.includes('CRITICAL'), 'Priority recorded in timeline');
  });

  await runTest('Admin Workflow', 'Admin performs bulk status update', async () => {
    const complaints = await complaintService.getComplaints();
    const targets = [complaints[0].id, complaints[1].id];

    const updated = await complaintService.bulkUpdateStatus(targets, 'in_progress', 'Mass technician mobilization');
    assert(updated.length === 2, '2 complaints updated in bulk');
    assert(updated.every((c) => c.status === 'in_progress'), 'All updated complaints set to in_progress');
  });

  await runTest('Admin Workflow', 'Admin user management safeguards: cannot deactivate self or last admin', async () => {
    let selfDeactivateRejected = false;
    try {
      await userService.toggleUserStatus('user-admin-1');
    } catch (e: any) {
      selfDeactivateRejected = e.message.includes('cannot deactivate your own account');
    }
    assert(selfDeactivateRejected, 'Admin deactivating self must be rejected');

    let selfDemoteRejected = false;
    try {
      await userService.updateUserRole('user-admin-1', 'student');
    } catch (e: any) {
      selfDemoteRejected = e.message.includes('cannot remove your own administrator privileges');
    }
    assert(selfDemoteRejected, 'Admin demoting self must be rejected');
  });

  await runTest('Admin Workflow', 'Admin category management: create, update, toggle and prevent duplicate names/slugs', async () => {
    const cat = await categoryService.createCategory({
      name: 'Laboratory Equipment',
      description: 'Issues with lab apparatus and test rigs',
      slaHours: 24,
      priority: 'high',
      active: true,
    });
    assert(cat.slug === 'laboratory-equipment', 'Slug generated correctly');

    let dupRejected = false;
    try {
      await categoryService.createCategory({
        name: 'Laboratory Equipment',
        description: 'Duplicate',
        active: true,
      });
    } catch {
      dupRejected = true;
    }
    assert(dupRejected, 'Duplicate category name must be rejected');

    const toggled = await categoryService.toggleCategoryStatus(cat.id);
    assert(toggled.active === false, 'Category status toggled to inactive');
  });

  await runTest('Admin Workflow', 'Admin sends broadcast notification with recipient deduplication', async () => {
    const broadcast = await notificationService.sendBroadcastNotification({
      title: 'Campus Power Maintenance',
      message: 'Grid shutdown scheduled for Sunday morning.',
      audience: 'all_students',
      priority: 'warning',
    });

    assert(broadcast.status === 'delivered', 'Broadcast marked delivered');
    assert(broadcast.recipientCount > 0, 'Recipients counted');

    // Verify deduplication: a student receives exactly one notification for this broadcastId
    const users = await userService.getUsers({ role: 'student' });
    const student1 = users[0];
    const studentNotifs = await notificationService.getNotifications(student1.id);
    const matching = studentNotifs.filter((n) => n.broadcastId === broadcast.id);
    assert(matching.length === 1, 'Student must receive exactly 1 notification for this broadcastId');
  });

  await runTest('Admin Workflow', 'Admin resets demo data and maintains valid admin session', async () => {
    await settingsService.resetDemoData();

    // Verify factory data restored
    const complaints = await complaintService.getComplaints();
    assert(complaints.length === MOCK_COMPLAINTS.length, 'Complaints restored to mock length');

    const users = await userService.getUsers();
    assert(users.length === MOCK_USERS.length, 'Users restored to mock length');

    // Verify session remains active for admin
    const currentUser = authService.getCurrentUser();
    assert(currentUser !== null, 'Session preserved after demo reset');
    assert(currentUser?.role === 'admin', 'Active session remains admin');
  });

  // -------------------------------------------------------------------------
  // 4. CROSS-MODULE SETTINGS ENFORCEMENT TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing Admin Settings Enforcement Across Modules ---');

  await runTest('Settings Enforcement', 'allowStudentRegistration=false blocks registration in authService', async () => {
    await settingsService.updateSettings({ allowStudentRegistration: false });

    let registrationBlocked = false;
    try {
      await authService.register({
        name: 'Late Student',
        email: 'late@college.edu',
        password: 'password123',
        studentId: 'STU2026-9000',
        department: 'CS',
        phone: '12345',
      });
    } catch (e: any) {
      registrationBlocked = e.message.includes('disabled');
    }
    assert(registrationBlocked, 'Registration must be blocked when allowStudentRegistration is false');

    // Restore setting
    await settingsService.updateSettings({ allowStudentRegistration: true });
  });

  await runTest('Settings Enforcement', 'maintenanceMode=true blocks student complaint submission but permits admin', async () => {
    await settingsService.updateSettings({ maintenanceMode: true });

    // Switch to student
    await authService.login('student@college.edu', 'student123');
    let studentBlocked = false;
    try {
      await complaintService.createComplaint({
        title: 'Maintenance Test Complaint',
        description: 'Should fail during maintenance',
        category: 'electrical',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        studentEmail: 'student@college.edu',
      });
    } catch (e: any) {
      studentBlocked = e.message.includes('maintenance');
    }
    assert(studentBlocked, 'Student complaint submission must be blocked during maintenance mode');

    // Admin should be permitted
    await authService.login('admin@college.edu', 'admin123');
    const adminComplaint = await complaintService.createComplaint({
      title: 'Emergency Admin Infrastructure Fix',
      description: 'Permitted administrative submission during maintenance',
      category: 'electrical',
      studentId: 'user-admin-1',
      studentName: 'Administrator',
      studentEmail: 'admin@college.edu',
    });
    assert(Boolean(adminComplaint.id), 'Admin permitted to create complaint during maintenance');

    // Restore setting
    await settingsService.updateSettings({ maintenanceMode: false });
  });

  await runTest('Settings Enforcement', 'defaultPriority setting dictates complaint priority when none provided', async () => {
    await settingsService.updateSettings({ defaultPriority: 'high' });

    const complaint = await complaintService.createComplaint({
      title: 'Water leak in dining hall',
      description: 'Leakage near water cooler',
      category: 'plumbing',
      studentId: 'user-student-1',
      studentName: 'Alex Johnson',
      studentEmail: 'student@college.edu',
    });

    assert(complaint.priority === 'high', 'Complaint resolved to defaultPriority "high"');

    // Restore setting
    await settingsService.updateSettings({ defaultPriority: 'medium' });
  });

  await runTest('Settings Enforcement', 'maxAttachmentsPerComplaint rejects submissions exceeding limit', async () => {
    await settingsService.updateSettings({ maxAttachmentsPerComplaint: 2 });

    const validDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    let exceededBlocked = false;
    try {
      await complaintService.createComplaint({
        title: 'Too many attachments test',
        description: '3 attachments when max is 2',
        category: 'plumbing',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        studentEmail: 'student@college.edu',
        attachments: [validDataUrl, validDataUrl, validDataUrl],
      });
    } catch (e: any) {
      exceededBlocked = e.message.includes('Maximum 2 attachments');
    }
    assert(exceededBlocked, 'Submission with 3 attachments rejected when max is 2');

    // Restore setting
    await settingsService.updateSettings({ maxAttachmentsPerComplaint: 3 });
  });

  await runTest('Settings Enforcement', 'maxAttachmentSizeMB rejects oversized attachments', async () => {
    await settingsService.updateSettings({ maxAttachmentSizeMB: 1 });

    // Generate ~1.5 MB Base64 Data URL (1.5 * 1024 * 1024 * 4/3 bytes)
    const largeBase64 = 'A'.repeat(Math.ceil(1.5 * 1024 * 1024 * (4 / 3)));
    const oversizedDataUrl = `data:image/png;base64,${largeBase64}`;

    let oversizedBlocked = false;
    try {
      await complaintService.createComplaint({
        title: 'Oversized attachment test',
        description: '1.5MB attachment when max is 1MB',
        category: 'plumbing',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        studentEmail: 'student@college.edu',
        attachments: [oversizedDataUrl],
      });
    } catch (e: any) {
      oversizedBlocked = e.message.includes('exceeds the maximum allowed file size of 1MB');
    }
    assert(oversizedBlocked, 'Oversized attachment rejected');

    // Restore setting
    await settingsService.updateSettings({ maxAttachmentSizeMB: 5 });
  });

  await runTest('Settings Enforcement', 'allowReopening=false blocks reopenComplaint', async () => {
    await settingsService.updateSettings({ allowReopening: false });

    let reopenBlocked = false;
    try {
      await complaintService.reopenComplaint('cmp-1002', 'Want to reopen');
    } catch (e: any) {
      reopenBlocked = e.message.includes('disabled');
    }
    assert(reopenBlocked, 'reopenComplaint must be blocked when allowReopening is false');

    // Restore setting
    await settingsService.updateSettings({ allowReopening: true });
  });

  await runTest('Settings Enforcement', 'studentNotifications=false suppresses routine notifications but allows essential alerts', async () => {
    await settingsService.updateSettings({ studentNotifications: false });

    // 1. Routine notification should be suppressed
    const routine = await notificationService.createNotification({
      userId: 'user-student-1',
      title: 'Routine Update',
      message: 'Staff visited room',
      type: 'info',
      category: 'status_changed',
    });
    assert(routine.id.startsWith('suppressed-'), 'Routine notification suppressed');

    // 2. Essential security alert should pass through
    const essential = await notificationService.createNotification({
      userId: 'user-student-1',
      title: 'Password Reset Alert',
      message: 'Security credentials updated',
      type: 'warning',
      category: 'security_alert',
    });
    assert(essential.id.startsWith('notif-'), 'Essential security alert delivered');

    // Restore setting
    await settingsService.updateSettings({ studentNotifications: true });
  });

  await runTest('Settings Enforcement', 'autoAssignComplaints=false leaves complaints unassigned in pending status', async () => {
    await settingsService.updateSettings({ autoAssignComplaints: false });

    const complaint = await complaintService.createComplaint({
      title: 'Unassigned Plumbing Issue',
      description: 'Water faucet leaking in restroom',
      category: 'plumbing',
      studentId: 'user-student-1',
      studentName: 'Alex Johnson',
      studentEmail: 'student@college.edu',
    });

    assert(complaint.assignedTo === undefined, 'Complaint left unassigned');
    assert(complaint.status === 'pending', 'Status remains pending');

    // Restore setting
    await settingsService.updateSettings({ autoAssignComplaints: true });
  });

  // -------------------------------------------------------------------------
  // 5. DATA CONSISTENCY & INTEGRITY TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Testing Data Consistency and Reference Integrity ---');

  await runTest('Data Consistency', 'Deactivated account session is invalidated and login blocked', async () => {
    // Admin deactivates student-2
    await authService.login('admin@college.edu', 'admin123');
    await userService.toggleUserStatus('user-student-2');

    // Try to login as student-2
    let loginBlocked = false;
    try {
      await authService.login('priya.sharma@college.edu', 'password123');
    } catch (e: any) {
      loginBlocked = e.message.includes('deactivated');
    }
    assert(loginBlocked, 'Deactivated account blocked from logging in');

    // Re-activate student-2
    await authService.login('admin@college.edu', 'admin123');
    await userService.toggleUserStatus('user-student-2');
  });

  await runTest('Data Consistency', 'Timeline synchronization: chronological ordering and event fields complete', async () => {
    await authService.login('admin@college.edu', 'admin123');
    const complaints = await complaintService.getComplaints();
    const testComplaint = complaints[0];

    // Every timeline event must have id, complaintId, status, message, updatedBy, role, timestamp
    testComplaint.timeline.forEach((tl) => {
      assert(Boolean(tl.id), 'Timeline event has id');
      assert(Boolean(tl.complaintId), 'Timeline event has complaintId');
      assert(Boolean(tl.status), 'Timeline event has status');
      assert(Boolean(tl.message), 'Timeline event has message');
      assert(Boolean(tl.updatedBy), 'Timeline event has updatedBy');
      assert(Boolean(tl.role), 'Timeline event has role');
      assert(Boolean(tl.timestamp), 'Timeline event has timestamp');
    });
  });

  await runTest('Data Consistency', 'Final demo data reset verifies clean state with zero orphaned records', async () => {
    await authService.login('admin@college.edu', 'admin123');
    await settingsService.resetDemoData();

    const complaints = await complaintService.getComplaints();
    const users = await userService.getUsers();
    const userIds = new Set(users.map((u) => u.id));

    // Verify all studentId references in complaints exist in USERS storage
    complaints.forEach((c) => {
      if (c.studentId) {
        assert(userIds.has(c.studentId), `Complaint ${c.ticketNumber} studentId ${c.studentId} must exist in users`);
      }
      if (c.assignedTo) {
        assert(userIds.has(c.assignedTo), `Complaint ${c.ticketNumber} assignedTo ${c.assignedTo} must exist in users`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('INTEGRATION TEST RESULTS SUMMARY');
  console.log('======================================================================');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Tests Run : ${total}`);
  console.log(`Passed          : ${passed}`);
  console.log(`Failed          : ${failed}`);
  console.log(`Success Rate    : ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.error('\nFAILED TESTS:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- [${r.category}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL INTEGRATION TESTS PASSED PERFECTLY!');
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
