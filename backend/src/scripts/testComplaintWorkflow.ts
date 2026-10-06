import http from 'http';
import app from '../app';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../config/supabase';

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

async function runWorkflowTests(): Promise<void> {
  console.log('================================================================');
  console.log(' BACKEND PHASE 4B: WORKFLOW, ASSIGNMENT, STATUS & HISTORY AUDIT');
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
    email: `phase4b.studenta.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4B Student A',
    role: 'student' as const,
  };
  const testStudentB = {
    email: `phase4b.studentb.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4B Student B',
    role: 'student' as const,
  };
  const testStaffA = {
    email: `phase4b.staffa.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4B Staff A',
    role: 'staff' as const,
  };
  const testStaffB = {
    email: `phase4b.staffb.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4B Staff B',
    role: 'staff' as const,
  };
  const testAdminA = {
    email: `phase4b.admina.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4B Admin A',
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
  let complaint3Id = '';

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
        department: u.role === 'staff' ? 'Facilities & Maintenance' : 'Computer Science',
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
    // Provision Base Test Complaints
    // -------------------------------------------------------------------------
    console.log('--- Provisioning Base Test Complaints ---');
    const createRes1 = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({
        title: 'Broken AC in Lab 301',
        description: 'The air conditioner in lab 301 is leaking water and not cooling.',
        category: 'electrical',
        priority: 'high',
        building: 'Science Block',
        room_number: '301',
      }),
    });
    const createData1: any = await createRes1.json();
    complaint1Id = createData1.data?.id;
    if (complaint1Id) createdComplaintIds.push(complaint1Id);

    const createRes2 = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({
        title: 'Faulty projector in Hall B',
        description: 'Projector display is flickering intermittently.',
        category: 'infrastructure',
        priority: 'medium',
      }),
    });
    const createData2: any = await createRes2.json();
    complaint2Id = createData2.data?.id;
    if (complaint2Id) createdComplaintIds.push(complaint2Id);

    const createRes3 = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentB}` },
      body: JSON.stringify({
        title: 'Water dispenser empty in Library 2nd floor',
        description: 'Dispenser has been empty since yesterday morning.',
        category: 'sanitation',
        priority: 'low',
      }),
    });
    const createData3: any = await createRes3.json();
    complaint3Id = createData3.data?.id;
    if (complaint3Id) createdComplaintIds.push(complaint3Id);

    if (!complaint1Id || !complaint2Id || !complaint3Id) {
      throw new Error('Failed to create base test complaints.');
    }
    console.log(`✓ Complaints created: C1 (${complaint1Id}), C2 (${complaint2Id}), C3 (${complaint3Id}).\n`);

    // =========================================================================
    // SECTION 1: AUTHENTICATION CHECKS (Checks 1-7)
    // =========================================================================
    console.log('--- 1. Authentication Checks ---');

    // 1. Unauthenticated PATCH /api/complaints/:id/assignment
    const auth1 = await fetch(`${baseUrl}/complaints/${complaint1Id}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: idStaffA }),
    });
    assert(1, 'AUTH', 'Unauthenticated PATCH assignment returns HTTP 401', auth1.status === 401);

    // 2. Unauthenticated PATCH /api/complaints/:id/status
    const auth2 = await fetch(`${baseUrl}/complaints/${complaint1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    assert(2, 'AUTH', 'Unauthenticated PATCH status returns HTTP 401', auth2.status === 401);

    // 3. Unauthenticated PATCH /api/complaints/:id/resolution
    const auth3 = await fetch(`${baseUrl}/complaints/${complaint1Id}/resolution`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Fixed by technician' }),
    });
    assert(3, 'AUTH', 'Unauthenticated PATCH resolution returns HTTP 401', auth3.status === 401);

    // 4. Unauthenticated POST /api/complaints/:id/reopen
    const auth4 = await fetch(`${baseUrl}/complaints/${complaint1Id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Issue persists after repair' }),
    });
    assert(4, 'AUTH', 'Unauthenticated POST reopen returns HTTP 401', auth4.status === 401);

    // 5. Unauthenticated POST /api/complaints/:id/comments
    const auth5 = await fetch(`${baseUrl}/complaints/${complaint1Id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Any updates?' }),
    });
    assert(5, 'AUTH', 'Unauthenticated POST comments returns HTTP 401', auth5.status === 401);

    // 6. Unauthenticated GET /api/complaints/:id/comments
    const auth6 = await fetch(`${baseUrl}/complaints/${complaint1Id}/comments`);
    assert(6, 'AUTH', 'Unauthenticated GET comments returns HTTP 401', auth6.status === 401);

    // 7. Unauthenticated GET /api/complaints/:id/timeline
    const auth7 = await fetch(`${baseUrl}/complaints/${complaint1Id}/timeline`);
    assert(7, 'AUTH', 'Unauthenticated GET timeline returns HTTP 401', auth7.status === 401);

    // =========================================================================
    // SECTION 2: COMPLAINT ASSIGNMENT (Checks 8-16)
    // =========================================================================
    console.log('\n--- 2. Complaint Assignment Checks ---');

    // 8. Student cannot assign complaint (HTTP 403 Forbidden)
    const assignStudent = await fetch(`${baseUrl}/complaints/${complaint1Id}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ assigned_to: idStaffA }),
    });
    assert(8, 'ASSIGNMENT', 'Student cannot assign complaint (HTTP 403 Forbidden)', assignStudent.status === 403);

    // 9. Staff cannot assign complaint (HTTP 403 Forbidden)
    const assignStaff = await fetch(`${baseUrl}/complaints/${complaint1Id}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffA}` },
      body: JSON.stringify({ assigned_to: idStaffA }),
    });
    assert(9, 'ASSIGNMENT', 'Staff cannot assign complaint (HTTP 403 Forbidden)', assignStaff.status === 403);

    // 10. Admin cannot assign to nonexistent profile UUID (HTTP 400 Bad Request)
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const assignNonexistent = await fetch(`${baseUrl}/complaints/${complaint1Id}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ assigned_to: fakeUuid }),
    });
    assert(10, 'ASSIGNMENT', 'Admin cannot assign to nonexistent profile UUID (HTTP 400 Bad Request)', assignNonexistent.status === 400);

    // 11. Admin cannot assign to user with role != staff (e.g. Student B, HTTP 400 Bad Request)
    const assignStudentTarget = await fetch(`${baseUrl}/complaints/${complaint1Id}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ assigned_to: idStudentB }),
    });
    assert(11, 'ASSIGNMENT', 'Admin cannot assign to non-staff user (HTTP 400 Bad Request)', assignStudentTarget.status === 400);

    // 12. Admin cannot assign with invalid UUID format (HTTP 400 Bad Request)
    const assignInvalidUuid = await fetch(`${baseUrl}/complaints/${complaint1Id}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ assigned_to: 'not-a-valid-uuid' }),
    });
    assert(12, 'ASSIGNMENT', 'Admin cannot assign with invalid UUID format (HTTP 400 Bad Request)', assignInvalidUuid.status === 400);

    // 13. Admin successfully assigns Complaint 1 to Staff A (HTTP 200 OK)
    const assignSuccess = await fetch(`${baseUrl}/complaints/${complaint1Id}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({
        assigned_to: idStaffA,
        assigned_department: 'Electrical Maintenance',
        notes: 'Assigned to senior electrician',
      }),
    });
    const assignData: any = await assignSuccess.json();
    assert(
      13,
      'ASSIGNMENT',
      'Admin successfully assigns Complaint 1 to Staff A (HTTP 200 OK)',
      assignSuccess.status === 200 && assignData.data?.assigned_to === idStaffA
    );

    // 14. Assignment auto-transitions complaint status from 'pending' to 'assigned'
    assert(
      14,
      'ASSIGNMENT',
      'Assignment auto-transitions complaint status from pending to assigned',
      assignData.data?.status === 'assigned'
    );

    // 15. Assignment creates audit timeline entry with action 'assigned' and staff details
    const timelineRes1 = await fetch(`${baseUrl}/complaints/${complaint1Id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const timelineData1: any = await timelineRes1.json();
    const assignEvent = timelineData1.data?.find((t: any) => t.action === 'assigned');
    assert(
      15,
      'ASSIGNMENT',
      'Assignment creates audit timeline entry with action assigned',
      Boolean(assignEvent && assignEvent.updated_by === idAdminA && assignEvent.status === 'assigned')
    );

    // 16. Admin reassigns Complaint 1 to Staff B (HTTP 200 OK, action 'reassigned' in timeline)
    const reassignSuccess = await fetch(`${baseUrl}/complaints/${complaint1Id}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({
        assigned_to: idStaffB,
        notes: 'Reassigned to Staff B due to shift change',
      }),
    });
    const reassignData: any = await reassignSuccess.json();
    const timelineRes2 = await fetch(`${baseUrl}/complaints/${complaint1Id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const timelineData2: any = await timelineRes2.json();
    const reassignEvent = timelineData2.data?.find((t: any) => t.action === 'reassigned');
    assert(
      16,
      'ASSIGNMENT',
      'Admin reassigns Complaint 1 to Staff B (HTTP 200 OK, action reassigned recorded)',
      reassignSuccess.status === 200 &&
        reassignData.data?.assigned_to === idStaffB &&
        Boolean(reassignEvent)
    );

    // =========================================================================
    // SECTION 3: STATUS TRANSITIONS & STATE MACHINE (Checks 17-27)
    // =========================================================================
    console.log('\n--- 3. Status Transition State Machine Checks ---');

    // 17. Student cannot update status directly via PATCH /api/complaints/:id/status (HTTP 403 Forbidden)
    const statusStudent = await fetch(`${baseUrl}/complaints/${complaint1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    assert(17, 'STATUS', 'Student cannot update status directly via PATCH status (HTTP 403 Forbidden)', statusStudent.status === 403);

    // 18. Staff A cannot update status of Complaint 1 (assigned to Staff B, HTTP 403 or 404)
    const statusOtherStaff = await fetch(`${baseUrl}/complaints/${complaint1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffA}` },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    assert(
      18,
      'STATUS',
      'Staff A cannot update status of complaint assigned to Staff B (HTTP 403/404)',
      statusOtherStaff.status === 403 || statusOtherStaff.status === 404
    );

    // 19. Invalid status string rejected with HTTP 400 Bad Request
    const statusInvalid = await fetch(`${baseUrl}/complaints/${complaint1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffB}` },
      body: JSON.stringify({ status: 'arbitrary_status' }),
    });
    assert(19, 'STATUS', 'Invalid status string rejected with HTTP 400 Bad Request', statusInvalid.status === 400);

    // 20. Redundant transition to current status rejected with HTTP 400 Bad Request
    const statusSame = await fetch(`${baseUrl}/complaints/${complaint1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffB}` },
      body: JSON.stringify({ status: 'assigned' }),
    });
    assert(20, 'STATUS', 'Redundant transition to current status rejected with HTTP 400 Bad Request', statusSame.status === 400);

    // 21. Illegal transition (assigned directly to resolved without in_progress) rejected with HTTP 400 Bad Request
    const statusIllegal = await fetch(`${baseUrl}/complaints/${complaint1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffB}` },
      body: JSON.stringify({ status: 'resolved' }),
    });
    assert(21, 'STATUS', 'Illegal transition (assigned directly to resolved) rejected with HTTP 400 Bad Request', statusIllegal.status === 400);

    // 22. Assigned Staff B transitions Complaint 1 from 'assigned' to 'in_progress' (HTTP 200 OK)
    const statusInProgress = await fetch(`${baseUrl}/complaints/${complaint1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffB}` },
      body: JSON.stringify({
        status: 'in_progress',
        notes: 'Technician has arrived on site and started diagnosis.',
      }),
    });
    const inProgressData: any = await statusInProgress.json();
    assert(
      22,
      'STATUS',
      'Assigned Staff B transitions Complaint 1 from assigned to in_progress (HTTP 200 OK)',
      statusInProgress.status === 200 && inProgressData.data?.status === 'in_progress'
    );

    // 23. Transition to 'in_progress' creates timeline entry with action 'in_progress'
    const timelineRes3 = await fetch(`${baseUrl}/complaints/${complaint1Id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenStaffB}` },
    });
    const timelineData3: any = await timelineRes3.json();
    const inProgEvent = timelineData3.data?.find((t: any) => t.action === 'in_progress' || t.status === 'in_progress');
    assert(
      23,
      'STATUS',
      'Transition to in_progress creates timeline entry',
      Boolean(inProgEvent && inProgEvent.updated_by === idStaffB)
    );

    // 24. Assigned Staff B transitions Complaint 1 from 'in_progress' to 'resolved' (HTTP 200 OK)
    const statusResolved = await fetch(`${baseUrl}/complaints/${complaint1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffB}` },
      body: JSON.stringify({
        status: 'resolved',
        notes: 'AC compressor was replaced and unit is fully operational.',
      }),
    });
    const resolvedData: any = await statusResolved.json();
    assert(
      24,
      'STATUS',
      'Assigned Staff B transitions Complaint 1 from in_progress to resolved (HTTP 200 OK)',
      statusResolved.status === 200 && resolvedData.data?.status === 'resolved'
    );

    // 25. Resolving complaint server-sets valid 'resolved_at' timestamp
    assert(
      25,
      'STATUS',
      'Resolving complaint server-sets valid resolved_at timestamp',
      Boolean(resolvedData.data?.resolved_at && !isNaN(Date.parse(resolvedData.data.resolved_at)))
    );

    // 26. Resolving complaint creates timeline entry with action 'resolved'
    const timelineRes4 = await fetch(`${baseUrl}/complaints/${complaint1Id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenStaffB}` },
    });
    const timelineData4: any = await timelineRes4.json();
    const resolvedEvent = timelineData4.data?.find((t: any) => t.action === 'resolved');
    assert(
      26,
      'STATUS',
      'Resolving complaint creates timeline entry with action resolved',
      Boolean(resolvedEvent && resolvedEvent.updated_by === idStaffB && resolvedEvent.status === 'resolved')
    );

    // 27. Admin can transition Complaint 2 directly from 'pending' to 'rejected' (HTTP 200 OK)
    const rejectRes = await fetch(`${baseUrl}/complaints/${complaint2Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({
        status: 'rejected',
        notes: 'Duplicate request already addressed under maintenance ticket SCCP-2026-099881.',
      }),
    });
    const rejectData: any = await rejectRes.json();
    assert(
      27,
      'STATUS',
      'Admin can transition complaint from pending to rejected (HTTP 200 OK)',
      rejectRes.status === 200 && rejectData.data?.status === 'rejected'
    );

    // =========================================================================
    // SECTION 4: DEDICATED RESOLUTION ENDPOINT (Checks 28-30)
    // =========================================================================
    console.log('\n--- 4. Dedicated Resolution Endpoint Checks ---');

    // Setup Complaint 3: Assign to Staff A and move to in_progress
    await fetch(`${baseUrl}/complaints/${complaint3Id}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ assigned_to: idStaffA }),
    });
    await fetch(`${baseUrl}/complaints/${complaint3Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffA}` },
      body: JSON.stringify({ status: 'in_progress', notes: 'Restocking water bottles' }),
    });

    // 28. Student cannot call PATCH /api/complaints/:id/resolution (HTTP 403 Forbidden)
    const resStudent = await fetch(`${baseUrl}/complaints/${complaint3Id}/resolution`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentB}` },
      body: JSON.stringify({ notes: 'I fixed it myself' }),
    });
    assert(28, 'RESOLUTION', 'Student cannot call PATCH resolution (HTTP 403 Forbidden)', resStudent.status === 403);

    // 29. Unassigned Staff B cannot resolve Complaint 3 (HTTP 403/404)
    const resOtherStaff = await fetch(`${baseUrl}/complaints/${complaint3Id}/resolution`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffB}` },
      body: JSON.stringify({ notes: 'Resolved by other staff' }),
    });
    assert(29, 'RESOLUTION', 'Staff cannot resolve unassigned complaint (HTTP 403/404)', resOtherStaff.status === 403 || resOtherStaff.status === 404);

    // 30. Staff A can resolve complaint via PATCH /api/complaints/:id/resolution (HTTP 200 OK)
    const resSuccess = await fetch(`${baseUrl}/complaints/${complaint3Id}/resolution`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffA}` },
      body: JSON.stringify({
        notes: 'Dispenser refilled with 20L fresh filtered water container.',
      }),
    });
    const resData: any = await resSuccess.json();
    assert(
      30,
      'RESOLUTION',
      'Assigned staff can resolve complaint via PATCH resolution (HTTP 200 OK)',
      resSuccess.status === 200 && resData.data?.status === 'resolved' && Boolean(resData.data?.resolved_at)
    );

    // =========================================================================
    // SECTION 5: COMPLAINT REOPENING (Checks 31-36)
    // =========================================================================
    console.log('\n--- 5. Complaint Reopening Checks ---');

    // 31. Staff cannot reopen complaint (HTTP 403 Forbidden)
    const reopenStaff = await fetch(`${baseUrl}/complaints/${complaint1Id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStaffB}` },
      body: JSON.stringify({ reason: 'Reopened by staff' }),
    });
    assert(31, 'REOPEN', 'Staff cannot reopen complaint (HTTP 403 Forbidden)', reopenStaff.status === 403);

    // 32. Student cannot reopen a complaint that is not resolved/rejected (HTTP 400 Bad Request)
    // Create a new pending complaint to test
    const createRes4 = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({
        title: 'Broken chair in Room 104',
        description: 'Chair leg is completely detached.',
        category: 'infrastructure',
      }),
    });
    const createData4: any = await createRes4.json();
    const complaint4Id = createData4.data?.id;
    if (complaint4Id) createdComplaintIds.push(complaint4Id);

    const reopenPending = await fetch(`${baseUrl}/complaints/${complaint4Id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ reason: 'Need faster response' }),
    });
    assert(32, 'REOPEN', 'Student cannot reopen a pending complaint (HTTP 400 Bad Request)', reopenPending.status === 400);

    // 33. Reopen with missing or short reason (< 5 characters) rejected with HTTP 400 Bad Request
    const reopenShortReason = await fetch(`${baseUrl}/complaints/${complaint1Id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ reason: 'No' }),
    });
    assert(33, 'REOPEN', 'Reopen with short reason (< 5 chars) rejected with HTTP 400 Bad Request', reopenShortReason.status === 400);

    // 34. Student A reopens own resolved Complaint 1 with valid reason (HTTP 200 OK)
    const reopenSuccess = await fetch(`${baseUrl}/complaints/${complaint1Id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({
        reason: 'The AC started leaking water again after 2 hours of running.',
      }),
    });
    const reopenData: any = await reopenSuccess.json();
    assert(
      34,
      'REOPEN',
      'Student A reopens own resolved Complaint 1 (HTTP 200 OK)',
      reopenSuccess.status === 200 && reopenData.data?.status === 'pending'
    );

    // 35. Reopening resets status to 'pending', clears 'resolved_at', records 'reopen_reason' and 'reopened_at'
    assert(
      35,
      'REOPEN',
      'Reopening resets status to pending, clears resolved_at, records reopen metadata',
      reopenData.data?.status === 'pending' &&
        reopenData.data?.resolved_at === null &&
        reopenData.data?.reopen_reason === 'The AC started leaking water again after 2 hours of running.' &&
        Boolean(reopenData.data?.reopened_at)
    );

    // 36. Student B cannot reopen Student A's complaint (HTTP 404 Not Found)
    const reopenUnauthorized = await fetch(`${baseUrl}/complaints/${complaint2Id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentB}` },
      body: JSON.stringify({ reason: 'Student B trying to reopen Student A ticket' }),
    });
    assert(36, 'REOPEN', 'Student B cannot reopen Student A complaint (HTTP 404 Not Found)', reopenUnauthorized.status === 404);

    // =========================================================================
    // SECTION 6: COMPLAINT COMMENTS (Checks 37-44)
    // =========================================================================
    console.log('\n--- 6. Complaint Comments Checks ---');

    // 37. Empty or whitespace comment message rejected with HTTP 400 Bad Request
    const commentEmpty = await fetch(`${baseUrl}/complaints/${complaint1Id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ message: '   ' }),
    });
    assert(37, 'COMMENTS', 'Empty comment message rejected with HTTP 400 Bad Request', commentEmpty.status === 400);

    // 38. Oversized comment message (> 2000 chars) rejected with HTTP 400 Bad Request
    const oversizedComment = 'x'.repeat(2001);
    const commentOversized = await fetch(`${baseUrl}/complaints/${complaint1Id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ message: oversizedComment }),
    });
    assert(38, 'COMMENTS', 'Oversized comment message (> 2000 chars) rejected with HTTP 400 Bad Request', commentOversized.status === 400);

    // 39. Student A posts public comment on Complaint 1 (HTTP 201 Created)
    const commentStudent = await fetch(`${baseUrl}/complaints/${complaint1Id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ message: 'I have attached photos of the ongoing leak to this complaint.' }),
    });
    const commentStudentData: any = await commentStudent.json();
    assert(
      39,
      'COMMENTS',
      'Student A posts public comment on Complaint 1 (HTTP 201 Created)',
      commentStudent.status === 201 &&
        commentStudentData.data?.author_id === idStudentA &&
        commentStudentData.data?.is_internal === false
    );

    // 40. Student A cannot post internal comment (is_internal: true rejected with HTTP 403 Forbidden)
    const commentStudentInternal = await fetch(`${baseUrl}/complaints/${complaint1Id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentA}` },
      body: JSON.stringify({ message: 'Secret internal note', is_internal: true }),
    });
    assert(
      40,
      'COMMENTS',
      'Student cannot post internal comment (is_internal: true rejected with HTTP 403 Forbidden)',
      commentStudentInternal.status === 403
    );

    // 41. Admin posts internal comment on Complaint 1 (HTTP 201 Created, is_internal: true)
    const commentAdminInternal = await fetch(`${baseUrl}/complaints/${complaint1Id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({
        message: 'Internal administrative note: replacement unit requested under warranty from vendor.',
        is_internal: true,
      }),
    });
    const commentAdminData: any = await commentAdminInternal.json();
    assert(
      41,
      'COMMENTS',
      'Admin posts internal comment on Complaint 1 (HTTP 201 Created, is_internal: true)',
      commentAdminInternal.status === 201 && commentAdminData.data?.is_internal === true
    );

    // 42. Student A retrieves comments and does NOT see admin internal comment (filtered by RLS)
    const getCommentsStudent = await fetch(`${baseUrl}/complaints/${complaint1Id}/comments`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const studentCommentsData: any = await getCommentsStudent.json();
    const studentComments = studentCommentsData.data || [];
    const hasInternalInStudent = studentComments.some((c: any) => c.is_internal === true);
    assert(
      42,
      'COMMENTS',
      'Student retrieves comments and does NOT see internal comments (filtered by RLS)',
      getCommentsStudent.status === 200 && !hasInternalInStudent && studentComments.length > 0
    );

    // 43. Admin retrieves comments and sees both public and internal comments
    const getCommentsAdmin = await fetch(`${baseUrl}/complaints/${complaint1Id}/comments`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const adminCommentsData: any = await getCommentsAdmin.json();
    const adminComments = adminCommentsData.data || [];
    const hasInternalInAdmin = adminComments.some((c: any) => c.is_internal === true);
    assert(
      43,
      'COMMENTS',
      'Admin retrieves comments and sees both public and internal comments',
      getCommentsAdmin.status === 200 && hasInternalInAdmin && adminComments.length >= 2
    );

    // 44. Student B cannot access comments on Student A's complaint (HTTP 404 Not Found)
    const getCommentsOtherStudent = await fetch(`${baseUrl}/complaints/${complaint1Id}/comments`, {
      headers: { Authorization: `Bearer ${tokenStudentB}` },
    });
    assert(
      44,
      'COMMENTS',
      'Student B cannot access comments on Student A complaint (HTTP 404 Not Found)',
      getCommentsOtherStudent.status === 404
    );

    // =========================================================================
    // SECTION 7: TIMELINE AUDIT & ACCESS CONTROL (Checks 45-50)
    // =========================================================================
    console.log('\n--- 7. Timeline Audit & Access Control Checks ---');

    // 45. Student A can view chronological timeline of own complaint (HTTP 200 OK)
    const getTimelineStudentA = await fetch(`${baseUrl}/complaints/${complaint1Id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const timelineStudentAData: any = await getTimelineStudentA.json();
    const timelineStudentA = timelineStudentAData.data || [];
    assert(
      45,
      'TIMELINE',
      'Student A can view chronological timeline of own complaint (HTTP 200 OK)',
      getTimelineStudentA.status === 200 && Array.isArray(timelineStudentA) && timelineStudentA.length >= 3
    );

    // 46. Timeline events are chronologically sorted (ascending created_at)
    let isChronological = true;
    for (let i = 1; i < timelineStudentA.length; i++) {
      const prevDate = new Date(timelineStudentA[i - 1].created_at).getTime();
      const currDate = new Date(timelineStudentA[i].created_at).getTime();
      if (currDate < prevDate) {
        isChronological = false;
        break;
      }
    }
    assert(46, 'TIMELINE', 'Timeline events are chronologically sorted (ascending created_at)', isChronological);

    // 47. Student B cannot view timeline of Student A's complaint (HTTP 404 Not Found)
    const getTimelineStudentB = await fetch(`${baseUrl}/complaints/${complaint1Id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenStudentB}` },
    });
    assert(
      47,
      'TIMELINE',
      'Student B cannot view timeline of Student A complaint (HTTP 404 Not Found)',
      getTimelineStudentB.status === 404
    );

    // 48. Staff B can view timeline of assigned Complaint 1 (HTTP 200 OK)
    const getTimelineStaffB = await fetch(`${baseUrl}/complaints/${complaint1Id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenStaffB}` },
    });
    assert(
      48,
      'TIMELINE',
      'Staff B can view timeline of assigned Complaint 1 (HTTP 200 OK)',
      getTimelineStaffB.status === 200
    );

    // 49. Staff A cannot view timeline of unrelated Complaint 2 (HTTP 404 Not Found)
    const getTimelineStaffA = await fetch(`${baseUrl}/complaints/${complaint2Id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenStaffA}` },
    });
    assert(
      49,
      'TIMELINE',
      'Staff A cannot view timeline of unrelated unassigned Complaint 2 (HTTP 404 Not Found)',
      getTimelineStaffA.status === 404
    );

    // 50. Admin can view full timeline of all complaints across campus (HTTP 200 OK)
    const getTimelineAdmin = await fetch(`${baseUrl}/complaints/${complaint1Id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    assert(
      50,
      'TIMELINE',
      'Admin can view full timeline of complaints across campus (HTTP 200 OK)',
      getTimelineAdmin.status === 200
    );
  } catch (err: any) {
    console.error('\n❌ Unhandled error during test suite execution:', err);
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
  console.log(' PHASE 4B AUDIT SUMMARY');
  console.log('================================================================');
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;
  console.log(` Total Checks : ${checks.length}`);
  console.log(` Passed       : ${passed}`);
  console.log(` Failed       : ${failed}\n`);

  if (failed > 0) {
    console.error(`❌ ${failed} checks failed in Phase 4B audit!`);
    process.exit(1);
  } else {
    console.log(`🎉 All ${checks.length} Phase 4B Complaint Workflow & History checks PASSED!`);
  }
}

runWorkflowTests().catch((err) => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
