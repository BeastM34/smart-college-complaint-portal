/**
 * Smart College Complaint Portal — Phase 8B Analytics Verification Suite
 * 
 * Tests all 30 analytical conditions with deterministic fixtures and timestamps:
 * 1. Admin successfully retrieves analytics
 * 2. Student is denied analytics access
 * 3. Staff is denied analytics access
 * 4. Empty storage returns zero metrics (no mock fallback)
 * 5. Total complaint count is correct
 * 6. Pending count is correct
 * 7. Assigned count is correct
 * 8. In-progress count is correct
 * 9. Resolved count is correct
 * 10. Rejected count is correct
 * 11. Active queue calculation is correct
 * 12. Resolution rate is correct
 * 13. Average resolution time is correct
 * 14. Invalid resolution timestamps are excluded
 * 15. Missing resolution timestamps are excluded
 * 16. Category distribution is correct
 * 17. Priority distribution is correct
 * 18. Status distribution is correct
 * 19. Department performance is correct
 * 20. Last 7 days filter is correct
 * 21. Last 30 days filter is correct
 * 22. Last 3 months filter is correct
 * 23. Last 6 months filter is correct
 * 24. Last 1 year filter is correct
 * 25. Records outside selected date range are excluded
 * 26. Time-series grouping is correct
 * 27. Complaints with unknown categories handled safely
 * 28. Complaints without departments handled safely
 * 29. Zero resolved complaints do not cause division errors
 * 30. Multiple complaints with identical timestamps handled correctly
 */

import { authService } from '../src/services/authService';
import { analyticsService } from '../src/services/analyticsService';
import { STORAGE_KEYS, setStorageItem, getStorageItem } from '../src/utils/storage';
import { MOCK_COMPLAINTS } from '../src/data/mockData';
import type { Complaint } from '../src/types';

async function runPhase8bTests() {
  console.log('======================================================================');
  console.log('SMART COLLEGE COMPLAINT PORTAL — PHASE 8B ANALYTICS TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testNum: number, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ [Test ${testNum}] ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ [Test ${testNum} FAILED] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // Backup existing complaints from storage
  const originalComplaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);

  // Deterministic reference timestamp: 2026-10-04T12:00:00.000Z
  const fixedNow = new Date('2026-10-04T12:00:00.000Z');

  try {
    // -------------------------------------------------------------------------
    // SECTION A: Authorization Checks
    // -------------------------------------------------------------------------
    console.log('--- 1. Security & Service-Layer Authorization ---');

    // 1. Admin access
    await authService.login('admin@college.edu', 'admin123', true);
    let adminSuccess = false;
    try {
      const res = await analyticsService.getAnalytics('30d', { customNow: fixedNow });
      adminSuccess = Boolean(res && typeof res.totalComplaints === 'number');
    } catch {
      adminSuccess = false;
    }
    assert(adminSuccess, 1, 'Admin successfully retrieves analytics');

    // 2. Student denied access
    await authService.login('student@college.edu', 'student123', true);
    let studentDenied = false;
    try {
      await analyticsService.getAnalytics('30d', { customNow: fixedNow });
    } catch (err: unknown) {
      studentDenied = err instanceof Error && err.message.includes('Unauthorized');
    }
    assert(studentDenied, 2, 'Student is denied analytics access');

    // 3. Staff denied access
    await authService.login('staff@college.edu', 'staff123', true);
    let staffDenied = false;
    try {
      await analyticsService.getAnalytics('30d', { customNow: fixedNow });
    } catch (err: unknown) {
      staffDenied = err instanceof Error && err.message.includes('Unauthorized');
    }
    assert(staffDenied, 3, 'Staff is denied analytics access');

    // Re-login as Admin for subsequent data tests
    await authService.login('admin@college.edu', 'admin123', true);

    // -------------------------------------------------------------------------
    // SECTION B: Empty Storage Behavior
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Empty Storage Verification ---');

    // 4. Empty storage returns zero metrics (never mock data)
    setStorageItem(STORAGE_KEYS.COMPLAINTS, []);
    const emptyResult = await analyticsService.getAnalytics('30d', { customNow: fixedNow });
    const emptySummary = await analyticsService.getSummary({ customNow: fixedNow });

    const isEmptyCorrect =
      emptyResult.totalComplaints === 0 &&
      emptyResult.pendingComplaints === 0 &&
      emptyResult.assignedComplaints === 0 &&
      emptyResult.inProgressComplaints === 0 &&
      emptyResult.resolvedComplaints === 0 &&
      emptyResult.rejectedComplaints === 0 &&
      emptyResult.activeQueue === 0 &&
      emptyResult.resolutionRate === 0 &&
      emptyResult.avgResolutionTimeHours === null &&
      emptyResult.avgResolutionTimeFormatted === 'N/A' &&
      emptyResult.categoryDistribution.length === 0 &&
      emptyResult.departmentPerformance.length === 0 &&
      emptySummary.totalComplaints === 0 &&
      emptySummary.avgResolutionTimeHours === 0 &&
      emptySummary.monthlyTrends.length === 0;

    assert(
      isEmptyCorrect,
      4,
      'Empty storage returns zero metrics without mock fallback',
      `got total=${emptyResult.totalComplaints}, avgTime=${emptyResult.avgResolutionTimeFormatted}`
    );

    // -------------------------------------------------------------------------
    // SECTION C: Controlled Fixture Testing
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Controlled Fixture Calculations ---');

    // Setup 14 controlled complaint records with known timestamps and values:
    const testFixtures: Complaint[] = [
      // 1. Resolved (Electrical, 4 hours duration, created within 7d)
      {
        id: 't-1',
        ticketNumber: 'TEST-001',
        title: 'Flickering lights in Room 101',
        description: 'Fluorescent tube ballasts buzzing and flickering.',
        category: 'electrical',
        priority: 'high',
        status: 'resolved',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        assignedDepartment: 'Electrical Maintenance',
        createdAt: '2026-10-02T10:00:00Z',
        resolvedAt: '2026-10-02T14:00:00Z', // 4.0 hours duration
        updatedAt: '2026-10-02T14:00:00Z',
        timeline: [],
      },
      // 2. Resolved (Plumbing, 8 hours duration, created within 7d)
      {
        id: 't-2',
        ticketNumber: 'TEST-002',
        title: 'Leaking tap in chemistry lab',
        description: 'Water tap leaking continuously.',
        category: 'plumbing',
        priority: 'critical',
        status: 'resolved',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        assignedDepartment: 'Plumbing & Water',
        createdAt: '2026-10-01T08:00:00Z',
        resolvedAt: '2026-10-01T16:00:00Z', // 8.0 hours duration
        updatedAt: '2026-10-01T16:00:00Z',
        timeline: [],
      },
      // 3. In Progress (Electrical, created within 7d)
      {
        id: 't-3',
        ticketNumber: 'TEST-003',
        title: 'Projector power socket dead',
        description: 'No AC power to ceiling mount projector.',
        category: 'electrical',
        priority: 'medium',
        status: 'in_progress',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        assignedDepartment: 'Electrical Maintenance',
        createdAt: '2026-09-30T10:00:00Z',
        updatedAt: '2026-09-30T10:00:00Z',
        timeline: [],
      },
      // 4. Assigned (Furniture, created within 7d, uses department fallback)
      {
        id: 't-4',
        ticketNumber: 'TEST-004',
        title: 'Broken desk leg in Hall B',
        description: 'Lecture desk is unstable.',
        category: 'furniture',
        priority: 'low',
        status: 'assigned',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        department: 'Estate Office', // test assignedDepartment fallback to department
        createdAt: '2026-09-29T10:00:00Z',
        updatedAt: '2026-09-29T10:00:00Z',
        timeline: [],
      },
      // 5. Pending (Unknown category, missing all departments -> General Facilities fallback)
      {
        id: 't-5',
        ticketNumber: 'TEST-005',
        title: 'Special facility request',
        description: 'Uncategorized request without department.',
        category: 'special_service' as any,
        priority: 'medium',
        status: 'pending',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        createdAt: '2026-09-28T10:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
        timeline: [],
      },
      // 6. Multiple complaint with identical timestamp to t-1 (Oct 2 10:00:00Z)
      {
        id: 't-6',
        ticketNumber: 'TEST-006',
        title: 'Second issue at identical timestamp',
        description: 'Verify identical timestamp handling.',
        category: 'electrical',
        priority: 'medium',
        status: 'pending',
        studentId: 'user-student-2',
        studentName: 'Casey Miller',
        assignedDepartment: 'Electrical Maintenance',
        createdAt: '2026-10-02T10:00:00Z', // identical timestamp to t-1
        updatedAt: '2026-10-02T10:00:00Z',
        timeline: [],
      },
      // 7. Rejected (Sanitation, created 14 days ago -> outside 7d, inside 30d)
      {
        id: 't-7',
        ticketNumber: 'TEST-007',
        title: 'Duplicate dustbin report',
        description: 'Already logged earlier.',
        category: 'sanitation',
        priority: 'low',
        status: 'rejected',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        assignedDepartment: 'Sanitation',
        createdAt: '2026-09-20T10:00:00Z',
        updatedAt: '2026-09-20T10:00:00Z',
        timeline: [],
      },
      // 8. Resolved with INVALID resolution timestamp (should be excluded from avg resolution time)
      {
        id: 't-8',
        ticketNumber: 'TEST-008',
        title: 'Resolved with invalid resolution string',
        description: 'Timestamp is corrupted or not a date.',
        category: 'electrical',
        priority: 'high',
        status: 'resolved',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        assignedDepartment: 'Electrical Maintenance',
        createdAt: '2026-09-15T10:00:00Z', // inside 30d
        resolvedAt: 'not-a-valid-timestamp',
        updatedAt: '2026-09-15T10:00:00Z',
        timeline: [],
      },
      // 9. Resolved with MISSING resolution timestamp (should be excluded from avg resolution time)
      {
        id: 't-9',
        ticketNumber: 'TEST-009',
        title: 'Resolved without resolution timestamp',
        description: 'No resolvedAt field and empty timeline.',
        category: 'academic',
        priority: 'medium',
        status: 'resolved',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        assignedDepartment: 'Academic Affairs',
        createdAt: '2026-09-12T10:00:00Z', // inside 30d
        updatedAt: '2026-09-12T10:00:00Z',
        timeline: [],
      },
      // 10. Resolved with timestamp BEFORE creation (should be excluded as invalid)
      {
        id: 't-10',
        ticketNumber: 'TEST-010',
        title: 'Resolved before creation invalid record',
        description: 'Impossible negative duration.',
        category: 'hostel',
        priority: 'high',
        status: 'resolved',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        assignedDepartment: 'Hostel Administration',
        createdAt: '2026-09-10T10:00:00Z', // inside 30d
        resolvedAt: '2026-09-08T10:00:00Z', // 2 days BEFORE creation!
        updatedAt: '2026-09-10T10:00:00Z',
        timeline: [],
      },
      // 11. Created 64 days ago (outside 30d, inside 3m)
      {
        id: 't-11',
        ticketNumber: 'TEST-011',
        title: 'Quarterly pipeline check',
        description: 'Medium term ticket.',
        category: 'hostel',
        priority: 'high',
        status: 'resolved',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        assignedDepartment: 'Hostel Administration',
        createdAt: '2026-08-01T10:00:00Z',
        resolvedAt: '2026-08-02T10:00:00Z',
        updatedAt: '2026-08-02T10:00:00Z',
        timeline: [],
      },
      // 12. Created 125 days ago (outside 3m, inside 6m)
      {
        id: 't-12',
        ticketNumber: 'TEST-012',
        title: 'Biannual structural paint',
        description: 'Civil works maintenance.',
        category: 'infrastructure',
        priority: 'critical',
        status: 'pending',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        assignedDepartment: 'Civil Works',
        createdAt: '2026-06-01T10:00:00Z',
        updatedAt: '2026-06-01T10:00:00Z',
        timeline: [],
      },
      // 13. Created 307 days ago (outside 6m, inside 1y)
      {
        id: 't-13',
        ticketNumber: 'TEST-013',
        title: 'Annual fleet service',
        description: 'Campus shuttle check.',
        category: 'transport',
        priority: 'low',
        status: 'in_progress',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        assignedDepartment: 'Transport',
        createdAt: '2025-12-01T10:00:00Z',
        updatedAt: '2025-12-01T10:00:00Z',
        timeline: [],
      },
      // 14. Created > 2 years ago (outside 1y completely)
      {
        id: 't-14',
        ticketNumber: 'TEST-014',
        title: 'Ancient library archive ticket',
        description: 'Historical archive record.',
        category: 'library',
        priority: 'medium',
        status: 'resolved',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        assignedDepartment: 'Library',
        createdAt: '2024-01-01T10:00:00Z',
        resolvedAt: '2024-01-02T10:00:00Z',
        updatedAt: '2024-01-02T10:00:00Z',
        timeline: [],
      },
    ];

    setStorageItem(STORAGE_KEYS.COMPLAINTS, testFixtures);

    // Compute metrics for Last 7 Days (range = '7d')
    // Within 7 days (Sep 27 12:00:00Z to Oct 4 12:00:00Z):
    // Complaints: t-1 (Oct 2), t-2 (Oct 1), t-3 (Sep 30), t-4 (Sep 29), t-5 (Sep 28), t-6 (Oct 2)
    // Total = 6 complaints.
    const res7d = await analyticsService.getAnalytics('7d', { customNow: fixedNow });

    // 5. Total count is correct
    assert(res7d.totalComplaints === 6, 5, 'Total complaint count is correct in 7d window', `expected 6, got ${res7d.totalComplaints}`);

    // 6. Pending count is correct: t-5, t-6 = 2
    assert(res7d.pendingComplaints === 2, 6, 'Pending count is correct', `expected 2, got ${res7d.pendingComplaints}`);

    // 7. Assigned count is correct: t-4 = 1
    assert(res7d.assignedComplaints === 1, 7, 'Assigned count is correct', `expected 1, got ${res7d.assignedComplaints}`);

    // 8. In-progress count is correct: t-3 = 1
    assert(res7d.inProgressComplaints === 1, 8, 'In-progress count is correct', `expected 1, got ${res7d.inProgressComplaints}`);

    // 9. Resolved count is correct: t-1, t-2 = 2
    assert(res7d.resolvedComplaints === 2, 9, 'Resolved count is correct', `expected 2, got ${res7d.resolvedComplaints}`);

    // 10. Rejected count is correct: none in 7d = 0
    assert(res7d.rejectedComplaints === 0, 10, 'Rejected count is correct', `expected 0, got ${res7d.rejectedComplaints}`);

    // 11. Active queue calculation is correct: pending (2) + assigned (1) + in_progress (1) = 4
    assert(res7d.activeQueue === 4, 11, 'Active queue calculation is correct (pending + assigned + in_progress)', `expected 4, got ${res7d.activeQueue}`);

    // 12. Resolution rate is correct: 2 / 6 * 100 = 33%
    assert(res7d.resolutionRate === 33, 12, 'Resolution rate is correct (2/6 = 33%)', `expected 33, got ${res7d.resolutionRate}`);

    // 13. Average resolution time is correct: (t-1: 4.0h, t-2: 8.0h) -> avg = 6.0 hours
    assert(
      res7d.avgResolutionTimeHours === 6.0 && res7d.avgResolutionTimeFormatted === '6.0 hours',
      13,
      'Average resolution time is correct (6.0 hours)',
      `expected 6.0 hours, got ${res7d.avgResolutionTimeFormatted}`
    );

    // 14. Invalid resolution timestamps are excluded (tested via 30d window where t-8 is present)
    const res30d = await analyticsService.getAnalytics('30d', { customNow: fixedNow });
    // In 30d window:
    // Resolved complaints: t-1 (4h), t-2 (8h), t-8 (invalid resolvedAt), t-9 (missing resolvedAt), t-10 (resolved before created)
    // Only t-1 (4h) and t-2 (8h) have valid resolution timestamps!
    assert(
      res30d.avgResolutionTimeHours === 6.0 && res30d.avgResolutionTimeFormatted === '6.0 hours',
      14,
      'Invalid resolution timestamps are excluded from average resolution time',
      `got avgResolutionTimeHours=${res30d.avgResolutionTimeHours}`
    );

    // 15. Missing resolution timestamps are excluded
    // Verified because t-9 has no resolution timestamp and was not counted as 0 hours
    assert(
      res30d.avgResolutionTimeHours !== null && res30d.avgResolutionTimeHours > 0,
      15,
      'Missing resolution timestamps are excluded without distorting average'
    );

    // 16. Category distribution is correct in 7d (electrical: 3, plumbing: 1, furniture: 1, special_service: 1)
    const electricalCat = res7d.categoryDistribution.find((c) => c.category === 'electrical');
    assert(
      electricalCat?.count === 3 && electricalCat?.percentage === 50,
      16,
      'Category distribution is correct (electrical = 3, 50%)',
      `got count=${electricalCat?.count}, pct=${electricalCat?.percentage}`
    );

    // 17. Priority distribution is correct in 7d (critical: 1, high: 1, medium: 3, low: 1)
    const critPri = res7d.priorityDistribution.find((p) => p.priority === 'critical');
    const medPri = res7d.priorityDistribution.find((p) => p.priority === 'medium');
    assert(
      critPri?.count === 1 && medPri?.count === 3,
      17,
      'Priority distribution is correct (critical=1, medium=3)',
      `got crit=${critPri?.count}, med=${medPri?.count}`
    );

    // 18. Status distribution is correct in 7d (pending: 2, assigned: 1, in_progress: 1, resolved: 2, rejected: 0)
    const pendingStatus = res7d.statusDistribution.find((s) => s.status === 'pending');
    const resolvedStatus = res7d.statusDistribution.find((s) => s.status === 'resolved');
    assert(
      pendingStatus?.count === 2 && resolvedStatus?.count === 2,
      18,
      'Status distribution is correct (pending=2, resolved=2)',
      `got pending=${pendingStatus?.count}, resolved=${resolvedStatus?.count}`
    );

    // 19. Department performance is correct (Electrical Maintenance: total=3, resolved=1, active=2)
    const elecDept = res7d.departmentPerformance.find((d) => d.department === 'Electrical Maintenance');
    assert(
      elecDept?.total === 3 && elecDept?.resolved === 1 && elecDept?.active === 2 && elecDept?.resolutionRate === 33,
      19,
      'Department performance is correct (Electrical: total=3, resolved=1, active=2, rate=33%)',
      `got total=${elecDept?.total}, active=${elecDept?.active}, rate=${elecDept?.resolutionRate}`
    );

    // -------------------------------------------------------------------------
    // SECTION D: Date Range Filters & Boundary Testing
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Date Range Filtering & Grouping Intervals ---');

    // 20. Last 7 days filter is correct (total = 6)
    assert(res7d.totalComplaints === 6, 20, 'Last 7 days filter is correct (6 complaints)');

    // 21. Last 30 days filter is correct: t-1 through t-10 = 10 complaints
    assert(res30d.totalComplaints === 10, 21, 'Last 30 days filter is correct (10 complaints)', `expected 10, got ${res30d.totalComplaints}`);

    // 22. Last 3 months filter is correct: t-1 through t-11 = 11 complaints
    const res3m = await analyticsService.getAnalytics('3m', { customNow: fixedNow });
    assert(res3m.totalComplaints === 11, 22, 'Last 3 months filter is correct (11 complaints)', `expected 11, got ${res3m.totalComplaints}`);

    // 23. Last 6 months filter is correct: t-1 through t-12 = 12 complaints
    const res6m = await analyticsService.getAnalytics('6m', { customNow: fixedNow });
    assert(res6m.totalComplaints === 12, 23, 'Last 6 months filter is correct (12 complaints)', `expected 12, got ${res6m.totalComplaints}`);

    // 24. Last 1 year filter is correct: t-1 through t-13 = 13 complaints
    const res1y = await analyticsService.getAnalytics('1y', { customNow: fixedNow });
    assert(res1y.totalComplaints === 13, 24, 'Last 1 year filter is correct (13 complaints)', `expected 13, got ${res1y.totalComplaints}`);

    // 25. Records outside the selected date range are excluded (t-14 is >2 years old and never in 1y)
    assert(res1y.totalComplaints === 13 && testFixtures.length === 14, 25, 'Records outside the selected date range are strictly excluded');

    // 26. Time-series grouping is correct (7d has 7 buckets, 6m has 6 buckets, 1y has 12 buckets)
    assert(
      res7d.trendData.length === 7 && res6m.trendData.length === 6 && res1y.trendData.length === 12,
      26,
      'Time-series grouping intervals are correct (7d: 7 daily, 6m: 6 monthly, 1y: 12 monthly)',
      `got 7d=${res7d.trendData.length}, 6m=${res6m.trendData.length}, 1y=${res1y.trendData.length}`
    );

    // 27. Complaints with unknown categories are handled safely
    const unknownCat = res7d.categoryDistribution.find((c) => c.category === 'special_service');
    assert(
      Boolean(unknownCat && unknownCat.label.includes('Special Service')),
      27,
      'Complaints with unknown categories are handled safely and human-labeled'
    );

    // 28. Complaints without departments are handled safely (assigned to General Facilities)
    const generalDept = res7d.departmentPerformance.find((d) => d.department === 'General Facilities');
    assert(
      Boolean(generalDept && generalDept.total === 1),
      28,
      'Complaints without departments are grouped into General Facilities'
    );

    // 29. Zero resolved complaints do not cause division errors
    // Create a mini dataset with only pending/in_progress tickets
    setStorageItem(STORAGE_KEYS.COMPLAINTS, [
      {
        id: 'no-res-1',
        ticketNumber: 'NR-1',
        title: 'Only pending ticket',
        description: 'Test division by zero',
        category: 'electrical',
        priority: 'low',
        status: 'pending',
        studentId: 'user-student-1',
        studentName: 'Alex Johnson',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-02T10:00:00Z',
        timeline: [],
      },
    ]);
    const zeroResResult = await analyticsService.getAnalytics('7d', { customNow: fixedNow });
    assert(
      zeroResResult.resolutionRate === 0 &&
        zeroResResult.avgResolutionTimeHours === null &&
        zeroResResult.avgResolutionTimeFormatted === 'N/A',
      29,
      'Zero resolved complaints do not cause division errors and report rate=0%, avgTime=N/A'
    );

    // 30. Multiple complaints with identical timestamps are handled correctly
    // In our testFixtures, t-1 and t-6 have identical createdAt '2026-10-02T10:00:00Z'
    // Both were included in 7d total (total = 6)
    setStorageItem(STORAGE_KEYS.COMPLAINTS, testFixtures);
    const identicalRes = await analyticsService.getAnalytics('7d', { customNow: fixedNow });
    assert(
      identicalRes.totalComplaints === 6,
      30,
      'Multiple complaints with identical timestamps are handled and counted correctly'
    );
  } finally {
    // Restore original complaints in storage
    setStorageItem(STORAGE_KEYS.COMPLAINTS, originalComplaints);
  }

  console.log('\n======================================================================');
  console.log('PHASE 8B ANALYTICS TEST SUMMARY');
  console.log('======================================================================');
  console.log(`Total Tests Run : ${passed + failed}`);
  console.log(`Passed          : ${passed}`);
  console.log(`Failed          : ${failed}`);
  console.log(`Success Rate    : ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase8bTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
