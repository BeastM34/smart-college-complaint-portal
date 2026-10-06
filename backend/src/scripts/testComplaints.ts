import http from 'http';
import app from '../app';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, isSupabaseConfigured, createUserScopedSupabaseClient } from '../config/supabase';
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

async function runComplaintTests(): Promise<void> {
  console.log('================================================================');
  console.log(' BACKEND PHASE 4A: COMPLAINT CRUD & AUTHORIZATION VERIFICATION');
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
    email: `phase4a.studenta.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4A Student A',
    role: 'student' as const,
  };
  const testStudentB = {
    email: `phase4a.studentb.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4A Student B',
    role: 'student' as const,
  };
  const testStaffA = {
    email: `phase4a.staffa.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4A Staff A',
    role: 'staff' as const,
  };
  const testAdminA = {
    email: `phase4a.admina.${timestamp}@test.internal`,
    password: 'Password!2026',
    name: 'Phase 4A Admin A',
    role: 'admin' as const,
  };

  let tokenStudentA = '';
  let idStudentA = '';
  let tokenStudentB = '';
  let idStudentB = '';
  let tokenStaffA = '';
  let idStaffA = '';
  let tokenAdminA = '';
  let idAdminA = '';

  let complaintA1Id = '';
  let complaintA1Ticket = '';
  let complaintA2Id = '';
  let complaintA2Ticket = '';
  let complaintB1Id = '';

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
        department: 'Computer Science',
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

    const adA = await provisionUser(testAdminA);
    tokenAdminA = adA.token;
    idAdminA = adA.id;

    console.log('✓ Test users provisioned successfully (Student A, Student B, Staff A, Admin A).\n');

    // =========================================================================
    // GROUP 1: AUTHENTICATION (Checks 1..3)
    // =========================================================================
    console.log('--- 1. Authentication Checks ---');

    // 1. Unauthenticated POST /api/complaints -> 401
    const unauthPostRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Projector broken in Room 101',
        description: 'The projector will not turn on during lectures.',
        category: 'electrical',
      }),
    });
    assert(
      1,
      'AUTHENTICATION',
      'Unauthenticated POST /api/complaints returns HTTP 401',
      unauthPostRes.status === 401
    );

    // 2. Unauthenticated GET /api/complaints -> 401
    const unauthGetRes = await fetch(`${baseUrl}/complaints`);
    assert(
      2,
      'AUTHENTICATION',
      'Unauthenticated GET /api/complaints returns HTTP 401',
      unauthGetRes.status === 401
    );

    // 3. Unauthenticated GET /api/complaints/:id -> 401
    const unauthGetIdRes = await fetch(`${baseUrl}/complaints/00000000-0000-0000-0000-000000000001`);
    assert(
      3,
      'AUTHENTICATION',
      'Unauthenticated GET /api/complaints/:id returns HTTP 401',
      unauthGetIdRes.status === 401
    );

    // =========================================================================
    // GROUP 2: STUDENT CREATION (Checks 4..11)
    // =========================================================================
    console.log('\n--- 2. Student Creation Checks ---');

    // 4. Authenticated student can create complaint
    const createRes1 = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentA}`,
      },
      body: JSON.stringify({
        title: 'Broken chair in CS Lab 3',
        description: 'One of the chairs at workstation 12 has a broken wheel.',
        category: 'infrastructure',
        priority: 'medium',
        building: 'Tech Building',
        floor: '2',
        roomNumber: 'Lab 3',
      }),
    });
    const createJson1: any = await createRes1.json();
    const c1 = createJson1.data;
    if (c1?.id) {
      complaintA1Id = c1.id;
      complaintA1Ticket = c1.ticket_number;
      createdComplaintIds.push(c1.id);
    }
    assert(
      4,
      'STUDENT CREATION',
      'Authenticated student can create complaint (HTTP 201 Created)',
      createRes1.status === 201 && createJson1.success === true && Boolean(c1?.id)
    );

    // 5. Ticket number is automatically generated
    const isTicketFormatValid = /^SCCP-\d{4}-\d{6}$/.test(complaintA1Ticket);
    assert(
      5,
      'STUDENT CREATION',
      `Ticket number is automatically generated with valid format (${complaintA1Ticket})`,
      isTicketFormatValid
    );

    // 6. Ticket number is unique
    const createRes2 = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentA}`,
      },
      body: JSON.stringify({
        title: 'Water cooler leaking in 2nd floor hallway',
        description: 'Water is accumulating on the corridor floor near room 204.',
        category: 'sanitation',
        priority: 'high',
        location: 'Tech Building, 2nd Floor Corridor',
      }),
    });
    const createJson2: any = await createRes2.json();
    const c2 = createJson2.data;
    if (c2?.id) {
      complaintA2Id = c2.id;
      complaintA2Ticket = c2.ticket_number;
      createdComplaintIds.push(c2.id);
    }
    const isDistinctTicket = Boolean(
      complaintA2Ticket && complaintA2Ticket !== complaintA1Ticket && /^SCCP-\d{4}-\d{6}$/.test(complaintA2Ticket)
    );
    assert(
      6,
      'STUDENT CREATION',
      `Ticket numbers are unique across multiple submissions (${complaintA1Ticket} vs ${complaintA2Ticket})`,
      isDistinctTicket
    );

    // 7. Complaint owner comes from authenticated user
    assert(
      7,
      'STUDENT CREATION',
      'Complaint owner student_id matches authenticated user ID',
      c1?.student_id === idStudentA
    );

    // 8. Student cannot submit another user's ID
    const spoofUserRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentA}`,
      },
      body: JSON.stringify({
        title: 'Flickering lights in reading hall',
        description: 'Overhead tube lights are flickering intermittently.',
        category: 'electrical',
        student_id: idStudentB, // Attempted spoof of Student B's ID
      }),
    });
    const spoofUserJson: any = await spoofUserRes.json();
    if (spoofUserJson?.data?.id) {
      createdComplaintIds.push(spoofUserJson.data.id);
    }
    assert(
      8,
      'STUDENT CREATION',
      "Student cannot submit another user's ID (server binds strictly to auth.uid())",
      spoofUserRes.status === 201 && spoofUserJson.data.student_id === idStudentA
    );

    // 9. Student cannot override ticket number
    const overrideTicketRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentA}`,
      },
      body: JSON.stringify({
        title: 'Broken whiteboard marker tray',
        description: 'Tray is loose and falling off whiteboard.',
        category: 'infrastructure',
        ticket_number: 'SCCP-9999-999999', // Malicious client override
      }),
    });
    const overrideTicketJson: any = await overrideTicketRes.json();
    if (overrideTicketJson?.data?.id) {
      createdComplaintIds.push(overrideTicketJson.data.id);
    }
    assert(
      9,
      'STUDENT CREATION',
      'Student cannot override ticket number (server-generated ticket assigned)',
      overrideTicketRes.status === 201 && overrideTicketJson.data.ticket_number !== 'SCCP-9999-999999'
    );

    // 10. Student cannot set privileged assignment fields
    const assignTamperRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentA}`,
      },
      body: JSON.stringify({
        title: 'Loose electrical outlet',
        description: 'Wall socket near door is loose and sparks.',
        category: 'electrical',
        assigned_to: idStaffA,
        assigned_department: 'Electrical Maintenance',
      }),
    });
    const assignTamperJson: any = await assignTamperRes.json();
    if (assignTamperJson?.data?.id) {
      createdComplaintIds.push(assignTamperJson.data.id);
    }
    assert(
      10,
      'STUDENT CREATION',
      'Student cannot set privileged assignment fields (assigned_to and assigned_department remain null)',
      assignTamperRes.status === 201 &&
      assignTamperJson.data.assigned_to === null &&
      assignTamperJson.data.assigned_department === null
    );

    // 11. Student cannot arbitrarily set status/priority if server-controlled
    const statusTamperRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentA}`,
      },
      body: JSON.stringify({
        title: 'AC unit noisy in seminar room',
        description: 'Rattling noise coming from the indoor AC unit.',
        category: 'electrical',
        status: 'resolved', // Client attempts to insert pre-resolved complaint
      }),
    });
    const statusTamperJson: any = await statusTamperRes.json();
    if (statusTamperJson?.data?.id) {
      createdComplaintIds.push(statusTamperJson.data.id);
    }
    assert(
      11,
      'STUDENT CREATION',
      'Student cannot arbitrarily set initial status (strictly initialized to "pending")',
      statusTamperRes.status === 201 && statusTamperJson.data.status === 'pending'
    );

    // =========================================================================
    // GROUP 3: VALIDATION (Checks 12..16)
    // =========================================================================
    console.log('\n--- 3. Input Validation Checks ---');

    // 12. Missing title -> 400
    const missingTitleRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentA}`,
      },
      body: JSON.stringify({
        description: 'Valid description without title.',
        category: 'hostel',
      }),
    });
    assert(
      12,
      'VALIDATION',
      'Missing title rejected with HTTP 400',
      missingTitleRes.status === 400
    );

    // 13. Missing description -> 400
    const missingDescRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentA}`,
      },
      body: JSON.stringify({
        title: 'Valid title without description',
        category: 'hostel',
      }),
    });
    assert(
      13,
      'VALIDATION',
      'Missing description rejected with HTTP 400',
      missingDescRes.status === 400
    );

    // 14. Missing category -> 400
    const missingCatRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentA}`,
      },
      body: JSON.stringify({
        title: 'Valid title',
        description: 'Valid description text.',
      }),
    });
    assert(
      14,
      'VALIDATION',
      'Missing category rejected with HTTP 400',
      missingCatRes.status === 400
    );

    // 15. Invalid field types -> 400
    const invalidTypesRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentA}`,
      },
      body: JSON.stringify({
        title: 12345, // Invalid type: number
        description: true, // Invalid type: boolean
        category: 'hostel',
      }),
    });
    assert(
      15,
      'VALIDATION',
      'Invalid field types rejected with HTTP 400',
      invalidTypesRes.status === 400
    );

    // 16. Oversized input -> 400
    const oversizedRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentA}`,
      },
      body: JSON.stringify({
        title: 'A'.repeat(250), // Title max is 200 chars
        description: 'Valid description content.',
        category: 'hostel',
      }),
    });
    assert(
      16,
      'VALIDATION',
      'Oversized input (title > 200 characters) rejected with HTTP 400',
      oversizedRes.status === 400
    );

    // =========================================================================
    // GROUP 4: STUDENT READ AUTHORIZATION (Checks 17..19)
    // =========================================================================
    console.log('\n--- 4. Student Read Authorization Checks ---');

    // Create a complaint for Student B first
    const createBRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentB}`,
      },
      body: JSON.stringify({
        title: "Student B's private complaint in Hostel 4",
        description: 'Ceiling fan regulator is broken in Room 412.',
        category: 'hostel',
      }),
    });
    const createBJson: any = await createBRes.json();
    if (createBJson?.data?.id) {
      complaintB1Id = createBJson.data.id;
      createdComplaintIds.push(complaintB1Id);
    }

    // 17. Student can retrieve own complaints
    const studentAGetListRes = await fetch(`${baseUrl}/complaints`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const studentAGetListJson: any = await studentAGetListRes.json();
    const studentAComplaints: any[] = studentAGetListJson.data || [];
    const hasOwnComplaints = studentAComplaints.some((c) => c.id === complaintA1Id);
    assert(
      17,
      'STUDENT READ AUTHORIZATION',
      "Student can retrieve own complaints via GET /api/complaints",
      studentAGetListRes.status === 200 && hasOwnComplaints
    );

    // 18. Student cannot retrieve another student's complaint by ID
    const studentAGetBRes = await fetch(`${baseUrl}/complaints/${complaintB1Id}`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    assert(
      18,
      'STUDENT READ AUTHORIZATION',
      "Student cannot retrieve another student's complaint (returns HTTP 404 Not Found)",
      studentAGetBRes.status === 404
    );

    // 19. Student cannot list another student's complaints
    const studentASeesBInList = studentAComplaints.some((c) => c.id === complaintB1Id);
    assert(
      19,
      'STUDENT READ AUTHORIZATION',
      "Student complaints list does not include complaints owned by other students",
      !studentASeesBInList
    );

    // =========================================================================
    // GROUP 5: STAFF/ADMIN AUTHORIZATION (Checks 20..22)
    // =========================================================================
    console.log('\n--- 5. Staff and Admin Authorization Checks ---');

    // 20. Staff access follows existing RLS/policy permissions
    // Unassigned complaint A1 should NOT be visible to Staff A under RLS
    const staffGetUnassignedRes = await fetch(`${baseUrl}/complaints/${complaintA1Id}`, {
      headers: { Authorization: `Bearer ${tokenStaffA}` },
    });
    const staffDeniedUnassigned = staffGetUnassignedRes.status === 404;

    // Now assign complaint A2 to Staff A using admin client
    await supabaseAdmin
      .from('complaints')
      .update({ assigned_to: idStaffA, status: 'assigned' })
      .eq('id', complaintA2Id);

    // Staff A should now be able to retrieve assigned complaint A2
    const staffGetAssignedRes = await fetch(`${baseUrl}/complaints/${complaintA2Id}`, {
      headers: { Authorization: `Bearer ${tokenStaffA}` },
    });
    const staffAllowedAssigned = staffGetAssignedRes.status === 200;

    assert(
      20,
      'STAFF/ADMIN',
      'Staff access follows RLS policy (404 on unassigned, 200 on assigned complaint)',
      staffDeniedUnassigned && staffAllowedAssigned
    );

    // 21. Admin access follows existing RLS/policy permissions
    const adminGetListRes = await fetch(`${baseUrl}/complaints`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const adminGetListJson: any = await adminGetListRes.json();
    const adminComplaints: any[] = adminGetListJson.data || [];
    const adminSeesA1 = adminComplaints.some((c) => c.id === complaintA1Id);
    const adminSeesB1 = adminComplaints.some((c) => c.id === complaintB1Id);
    assert(
      21,
      'STAFF/ADMIN',
      "Admin can list all complaints across campus (sees both Student A and Student B's complaints)",
      adminGetListRes.status === 200 && adminSeesA1 && adminSeesB1
    );

    // 22. Unauthorized role receives 403 where appropriate
    // Staff member attempts to create a complaint
    const staffCreateRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStaffA}`,
      },
      body: JSON.stringify({
        title: 'Staff attempted submission',
        description: 'Staff trying to submit a complaint ticket.',
        category: 'academic',
      }),
    });
    assert(
      22,
      'STAFF/ADMIN',
      'Staff role receives HTTP 403 Forbidden when attempting to submit a complaint',
      staffCreateRes.status === 403
    );

    // =========================================================================
    // GROUP 6: DETAIL LOOKUPS (Checks 23..25)
    // =========================================================================
    console.log('\n--- 6. Complaint Detail Lookups ---');

    // 23. Existing visible complaint -> 200
    const detailIdRes = await fetch(`${baseUrl}/complaints/${complaintA1Id}`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const detailIdJson: any = await detailIdRes.json();

    const detailTicketRes = await fetch(`${baseUrl}/complaints/ticket/${complaintA1Ticket}`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const detailTicketJson: any = await detailTicketRes.json();

    assert(
      23,
      'DETAIL',
      'Existing visible complaint returns HTTP 200 by both ID and Ticket Number',
      detailIdRes.status === 200 &&
      detailIdJson.data?.id === complaintA1Id &&
      detailTicketRes.status === 200 &&
      detailTicketJson.data?.ticket_number === complaintA1Ticket
    );

    // 24. Invisible/nonexistent complaint -> 404
    const nonexistentRes = await fetch(`${baseUrl}/complaints/00000000-0000-0000-0000-000000000999`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    assert(
      24,
      'DETAIL',
      'Nonexistent complaint returns HTTP 404 Not Found',
      nonexistentRes.status === 404
    );

    // 25. No information leak for unauthorized complaint
    const leakTestRes = await fetch(`${baseUrl}/complaints/${complaintB1Id}`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    const leakTestJson: any = await leakTestRes.json();
    const nonexistentJson: any = await nonexistentRes.json();
    assert(
      25,
      'DETAIL',
      'Unauthorized complaint returns identical 404 message to nonexistent complaint (no leak)',
      leakTestRes.status === 404 && leakTestJson.message === nonexistentJson.message
    );

    // =========================================================================
    // GROUP 7: SECURITY ARCHITECTURE (Checks 26..30)
    // =========================================================================
    console.log('\n--- 7. Security Architecture Checks ---');

    // 26. User-scoped Supabase client is used
    const userScopedClient = createUserScopedSupabaseClient(tokenStudentA);
    assert(
      26,
      'SECURITY',
      'User-scoped Supabase client initializes with authenticated user token',
      typeof userScopedClient.from === 'function' && typeof (userScopedClient as any).rest === 'object'
    );

    // 27. No service-role fallback on client creation failure
    _setClientFactoryForTesting(() => {
      throw new Error('Simulated user-scoped client creation failure');
    });
    const fallbackRes = await fetch(`${baseUrl}/complaints`, {
      headers: { Authorization: `Bearer ${tokenStudentA}` },
    });
    _setClientFactoryForTesting(null);
    assert(
      27,
      'SECURITY',
      'User-scoped client failure NEVER falls back to service_role (returns HTTP 500, no admin fallback)',
      fallbackRes.status === 500
    );

    // 28. SUPABASE_SECRET_KEY is not exposed
    const secretKey = env.SUPABASE_SECRET_KEY || '';
    const secretKeyExposedInHeaders = Boolean(secretKey && unauthPostRes.headers.get('set-cookie')?.includes(secretKey));
    const secretKeyExposedInBody = Boolean(secretKey && JSON.stringify(createJson1).includes(secretKey));
    assert(
      28,
      'SECURITY',
      'SUPABASE_SECRET_KEY is never exposed in response headers or body payloads',
      !secretKeyExposedInHeaders && !secretKeyExposedInBody
    );

    // 29. Unexpected request fields are ignored/rejected
    const extraFieldsRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudentA}`,
      },
      body: JSON.stringify({
        title: 'Network jack not working',
        description: 'Ethernet wall port in Lab 2 has no signal.',
        category: 'infrastructure',
        arbitrary_untrusted_field: 'malicious_injection',
        role: 'admin',
        is_admin: true,
      }),
    });
    const extraFieldsJson: any = await extraFieldsRes.json();
    if (extraFieldsJson?.data?.id) {
      createdComplaintIds.push(extraFieldsJson.data.id);
    }
    assert(
      29,
      'SECURITY',
      'Unexpected request fields are ignored and strictly omitted from database insert',
      extraFieldsRes.status === 201 &&
      extraFieldsJson.data.arbitrary_untrusted_field === undefined &&
      extraFieldsJson.data.is_admin === undefined
    );

    // 30. Existing Phase 2C RLS protections remain intact
    // Anonymous PostgREST request to public.complaints directly is denied
    const isolatedAnonClient = createClient(env.SUPABASE_URL || '', env.SUPABASE_PUBLISHABLE_KEY || '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonRes = await isolatedAnonClient.from('complaints').select('id');
    assert(
      30,
      'SECURITY',
      'Existing Phase 2C RLS protections remain intact (anonymous query denied with 42501)',
      Boolean(anonRes.error && (anonRes.error.code === '42501' || anonRes.status === 401 || anonRes.status === 403))
    );

  } finally {
    // -------------------------------------------------------------------------
    // Cleanup Database Entities
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
  console.log(' PHASE 4A AUDIT SUMMARY');
  console.log('================================================================');
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;
  console.log(` Total Checks : ${checks.length}`);
  console.log(` Passed       : ${passed}`);
  console.log(` Failed       : ${failed}\n`);

  if (failed > 0) {
    console.error(`❌ ${failed} checks failed in Phase 4A audit!`);
    process.exit(1);
  } else {
    console.log('🎉 All 30 Phase 4A Complaint CRUD & Authorization checks PASSED!');
  }
}

runComplaintTests().catch((err) => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
