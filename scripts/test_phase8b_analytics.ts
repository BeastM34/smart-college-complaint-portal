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
import {
  analyticsService,
  getRangeWindow,
  generateTrendData,
  calculateAverageResolutionTime,
} from '../src/services/analyticsService';
import {
  STORAGE_KEYS,
  setStorageItem,
  getStorageItem,
  removeStorageItem,
} from '../src/utils/storage';
import { MOCK_COMPLAINTS } from '../src/data/mockData';
import type { Complaint, DateRangeOption } from '../src/types';

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

    // 28. Complaints without departments are handled safely (assigned to Unassigned)
    const unassignedDept = res7d.departmentPerformance.find((d) => d.department === 'Unassigned');
    assert(
      Boolean(unassignedDept && unassignedDept.total === 1),
      28,
      'Complaints without departments are grouped into Unassigned'
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

    // -------------------------------------------------------------------------
    // SECTION E: Empty Storage Robustness & Absence Checks
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Empty Storage Robustness & Absence Checks ---');

    // 31. Storage key completely absent (removeStorageItem) returns zero metrics without mock fallback
    removeStorageItem(STORAGE_KEYS.COMPLAINTS);
    const absentResult = await analyticsService.getAnalytics('30d', { customNow: fixedNow });
    const absentSummary = await analyticsService.getSummary({ customNow: fixedNow });
    assert(
      absentResult.totalComplaints === 0 &&
        absentResult.avgResolutionTimeHours === null &&
        absentResult.categoryDistribution.length === 0 &&
        absentSummary.totalComplaints === 0 &&
        absentSummary.monthlyTrends.length === 0,
      31,
      'Absent storage key returns zero metrics without substituting mock data'
    );

    // 32. Malformed non-array storage data safely produces zero metrics
    setStorageItem(STORAGE_KEYS.COMPLAINTS, { corrupt: 'not_an_array' } as any);
    const corruptResult = await analyticsService.getAnalytics('30d', { customNow: fixedNow });
    assert(
      corruptResult.totalComplaints === 0 &&
        corruptResult.categoryDistribution.length === 0 &&
        corruptResult.departmentPerformance.length === 0,
      32,
      'Malformed non-array storage data is safely handled as empty array without throwing'
    );

    // 33. Complaint storage with valid records produces correct metrics
    setStorageItem(STORAGE_KEYS.COMPLAINTS, testFixtures);
    const validResult = await analyticsService.getAnalytics('7d', { customNow: fixedNow });
    assert(
      validResult.totalComplaints === 6 && validResult.resolvedComplaints === 2,
      33,
      'Valid stored records correctly populate analytics KPIs'
    );

    // -------------------------------------------------------------------------
    // SECTION F: Priority Classification & Unknown Handling
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Priority Classification & Unknown Handling ---');

    // 34. Missing priority is grouped into Unknown and not counted as Medium
    const priorityFixtures: Complaint[] = [
      {
        id: 'pri-none',
        ticketNumber: 'PN-1',
        title: 'Missing priority ticket',
        description: 'No priority field',
        category: 'electrical',
        status: 'pending',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-02T10:00:00Z',
        timeline: [],
      } as any,
      {
        id: 'pri-med',
        ticketNumber: 'PM-1',
        title: 'Real medium ticket',
        description: 'Medium priority',
        category: 'electrical',
        priority: 'medium',
        status: 'pending',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-02T10:00:00Z',
        timeline: [],
      },
    ];
    setStorageItem(STORAGE_KEYS.COMPLAINTS, priorityFixtures);
    const priMissingRes = await analyticsService.getAnalytics('7d', { customNow: fixedNow });
    const unknownPriMetric = priMissingRes.priorityDistribution.find((p) => p.priority === 'unknown');
    const medPriMetric = priMissingRes.priorityDistribution.find((p) => p.priority === 'medium');
    assert(
      unknownPriMetric?.count === 1 && medPriMetric?.count === 1,
      34,
      'Missing priority is grouped into Unknown and does NOT inflate Medium count',
      `unknown=${unknownPriMetric?.count}, med=${medPriMetric?.count}`
    );

    // 35. Invalid priority string is grouped into Unknown and not counted as Medium
    const invalidPriFixtures: Complaint[] = [
      {
        id: 'pri-invalid-1',
        ticketNumber: 'PI-1',
        title: 'Invalid priority ticket',
        description: 'Unknown string priority',
        category: 'plumbing',
        priority: 'catastrophic' as any,
        status: 'pending',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-02T10:00:00Z',
        timeline: [],
      },
    ];
    setStorageItem(STORAGE_KEYS.COMPLAINTS, invalidPriFixtures);
    const priInvalidRes = await analyticsService.getAnalytics('7d', { customNow: fixedNow });
    const unknownInvalidMetric = priInvalidRes.priorityDistribution.find((p) => p.priority === 'unknown');
    const medInvalidMetric = priInvalidRes.priorityDistribution.find((p) => p.priority === 'medium');
    assert(
      unknownInvalidMetric?.count === 1 && medInvalidMetric?.count === 0,
      35,
      'Invalid priority string is categorized as Unknown with Medium remaining 0',
      `unknown=${unknownInvalidMetric?.count}, med=${medInvalidMetric?.count}`
    );

    // 36. Correct Medium count when Unknown records exist and total distribution matches
    const mixedPriFixtures: Complaint[] = [
      { ...priorityFixtures[0] }, // missing priority (unknown)
      { ...invalidPriFixtures[0] }, // invalid priority (unknown)
      { ...priorityFixtures[1] }, // medium (medium)
      {
        id: 'pri-high',
        ticketNumber: 'PH-1',
        title: 'High priority',
        description: 'High',
        category: 'electrical',
        priority: 'high',
        status: 'pending',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-02T10:00:00Z',
        timeline: [],
      },
    ];
    setStorageItem(STORAGE_KEYS.COMPLAINTS, mixedPriFixtures);
    const mixedPriRes = await analyticsService.getAnalytics('7d', { customNow: fixedNow });
    const uCount = mixedPriRes.priorityDistribution.find((p) => p.priority === 'unknown')?.count;
    const mCount = mixedPriRes.priorityDistribution.find((p) => p.priority === 'medium')?.count;
    const hCount = mixedPriRes.priorityDistribution.find((p) => p.priority === 'high')?.count;
    const totalCount = mixedPriRes.totalComplaints;
    assert(
      uCount === 2 && mCount === 1 && hCount === 1 && totalCount === 4,
      36,
      'Total priority distribution is accurate (unknown=2, medium=1, high=1, total=4)',
      `got unknown=${uCount}, med=${mCount}, high=${hCount}, total=${totalCount}`
    );

    // -------------------------------------------------------------------------
    // SECTION G: Department Classification & Unassigned Fallback
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Department Classification & Unassigned Fallback ---');

    // 37. Empty department strings are treated as Unassigned
    const emptyDeptFixtures: Complaint[] = [
      {
        id: 'dept-empty-1',
        ticketNumber: 'DE-1',
        title: 'Empty department string',
        description: 'Blank department',
        category: 'hostel',
        priority: 'low',
        status: 'pending',
        assignedDepartment: '',
        department: '   ',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-02T10:00:00Z',
        timeline: [],
      },
    ];
    setStorageItem(STORAGE_KEYS.COMPLAINTS, emptyDeptFixtures);
    const emptyDeptRes = await analyticsService.getAnalytics('7d', { customNow: fixedNow });
    const unassignedItem = emptyDeptRes.departmentPerformance.find((d) => d.department === 'Unassigned');
    assert(
      Boolean(unassignedItem && unassignedItem.total === 1),
      37,
      'Empty and whitespace department strings are classified into Unassigned',
      `departments=${JSON.stringify(emptyDeptRes.departmentPerformance.map((d) => d.department))}`
    );

    // 38. Complaints with department values remain correctly grouped
    const deptGroupFixtures: Complaint[] = [
      {
        id: 'dg-1',
        ticketNumber: 'DG-1',
        title: 'Assigned dept test',
        description: 'Explicit assigned department',
        category: 'electrical',
        priority: 'low',
        status: 'resolved',
        assignedDepartment: 'IT Support',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: '2026-10-02T10:00:00Z',
        resolvedAt: '2026-10-02T12:00:00Z',
        updatedAt: '2026-10-02T12:00:00Z',
        timeline: [],
      },
      {
        id: 'dg-2',
        ticketNumber: 'DG-2',
        title: 'Fallback dept test',
        description: 'Explicit fallback department',
        category: 'electrical',
        priority: 'low',
        status: 'pending',
        department: 'Estate Management',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-02T10:00:00Z',
        timeline: [],
      },
    ];
    setStorageItem(STORAGE_KEYS.COMPLAINTS, deptGroupFixtures);
    const deptGroupRes = await analyticsService.getAnalytics('7d', { customNow: fixedNow });
    const itDept = deptGroupRes.departmentPerformance.find((d) => d.department === 'IT Support');
    const estateDept = deptGroupRes.departmentPerformance.find((d) => d.department === 'Estate Management');
    assert(
      itDept?.total === 1 && itDept?.resolved === 1 && estateDept?.total === 1 && estateDept?.pending === 1,
      38,
      'Complaints with explicit assignedDepartment or department are grouped under exact department names'
    );

    // -------------------------------------------------------------------------
    // SECTION H: Future Resolution Timestamps & Average Resolution Time
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Future Resolution Timestamps & Average Resolution Time ---');

    // 39. Future resolvedAt relative to reference now is excluded from average resolution time
    const futureResolvedFixtures: Complaint[] = [
      {
        id: 'fut-1',
        ticketNumber: 'FUT-1',
        title: 'Resolved in future',
        description: 'Timestamp is after fixedNow',
        category: 'electrical',
        priority: 'low',
        status: 'resolved',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: '2026-10-02T10:00:00Z',
        resolvedAt: '2026-10-06T10:00:00Z', // 2 days in future from 2026-10-04T12:00:00Z!
        updatedAt: '2026-10-06T10:00:00Z',
        timeline: [],
      },
      {
        id: 'past-1',
        ticketNumber: 'PST-1',
        title: 'Resolved in past',
        description: 'Valid 2 hour resolution',
        category: 'electrical',
        priority: 'low',
        status: 'resolved',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: '2026-10-02T10:00:00Z',
        resolvedAt: '2026-10-02T12:00:00Z', // exactly 2.0 hours
        updatedAt: '2026-10-02T12:00:00Z',
        timeline: [],
      },
    ];
    setStorageItem(STORAGE_KEYS.COMPLAINTS, futureResolvedFixtures);
    const futureRes = await analyticsService.getAnalytics('7d', { customNow: fixedNow });
    assert(
      futureRes.avgResolutionTimeHours === 2.0,
      39,
      'Future resolvedAt is excluded from average resolution time calculation',
      `expected 2.0 hours, got ${futureRes.avgResolutionTimeHours}`
    );

    // 40. Future timeline resolution event relative to reference now is excluded from average resolution time
    const futureTimelineFixtures: Complaint[] = [
      {
        id: 'fut-timeline-1',
        ticketNumber: 'FT-1',
        title: 'Future timeline resolution',
        description: 'Timeline timestamp is after fixedNow',
        category: 'electrical',
        priority: 'low',
        status: 'resolved',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-02T10:00:00Z',
        timeline: [
          {
            id: 'tl-1',
            complaintId: 'fut-timeline-1',
            status: 'resolved',
            message: 'Fixed later in future',
            timestamp: '2026-10-10T10:00:00Z', // 6 days in future!
            actorName: 'Tech',
            actorRole: 'staff',
            isInternal: false,
          },
        ],
      },
      {
        id: 'past-2',
        ticketNumber: 'PST-2',
        title: 'Resolved in past via timeline',
        description: 'Valid 3 hour resolution via timeline',
        category: 'electrical',
        priority: 'low',
        status: 'resolved',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-02T13:00:00Z',
        timeline: [
          {
            id: 'tl-2',
            complaintId: 'past-2',
            status: 'resolved',
            message: 'Fixed in 3 hours',
            timestamp: '2026-10-02T13:00:00Z', // 3 hours duration
            actorName: 'Tech',
            actorRole: 'staff',
            isInternal: false,
          },
        ],
      },
    ];
    setStorageItem(STORAGE_KEYS.COMPLAINTS, futureTimelineFixtures);
    const futTimelineRes = await analyticsService.getAnalytics('7d', { customNow: fixedNow });
    assert(
      futTimelineRes.avgResolutionTimeHours === 3.0,
      40,
      'Future timeline resolution timestamp is excluded from average resolution time',
      `expected 3.0 hours, got ${futTimelineRes.avgResolutionTimeHours}`
    );

    // 41. Resolution timestamp preceding createdAt is excluded without replacing with zero
    const negDurationFixtures: Complaint[] = [
      {
        id: 'neg-1',
        ticketNumber: 'NEG-1',
        title: 'Negative duration resolution',
        description: 'resolved before created',
        category: 'electrical',
        priority: 'low',
        status: 'resolved',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: '2026-10-02T10:00:00Z',
        resolvedAt: '2026-10-01T10:00:00Z', // resolved 24h BEFORE creation
        updatedAt: '2026-10-02T10:00:00Z',
        timeline: [],
      },
    ];
    setStorageItem(STORAGE_KEYS.COMPLAINTS, negDurationFixtures);
    const negRes = await analyticsService.getAnalytics('7d', { customNow: fixedNow });
    assert(
      negRes.avgResolutionTimeHours === null && negRes.avgResolutionTimeFormatted === 'N/A',
      41,
      'Resolution preceding creation is excluded and does not default to 0 hours'
    );

    // -------------------------------------------------------------------------
    // SECTION I: Date Filter & Trend Chart Boundaries (Gaps, Overlaps, Exact Limits)
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Date Filter & Trend Chart Boundaries Verification ---');

    const ranges: DateRangeOption[] = ['7d', '30d', '3m', '6m', '1y'];

    let allFirstMatch = true;
    let allLastMatch = true;
    let allZeroGaps = true;
    let allZeroOverlaps = true;

    for (const r of ranges) {
      const window = getRangeWindow(r, fixedNow);
      const trend = generateTrendData([], r, fixedNow);

      if (trend.length === 0) {
        allFirstMatch = false;
        allLastMatch = false;
        break;
      }

      // Exact first boundary
      if (trend[0].startDate !== window.start.toISOString()) {
        allFirstMatch = false;
      }

      // Exact last boundary
      if (trend[trend.length - 1].endDate !== window.end.toISOString()) {
        allLastMatch = false;
      }

      // Contiguity: adjacent end == start
      for (let i = 0; i < trend.length - 1; i++) {
        if (trend[i].endDate !== trend[i + 1].startDate) {
          allZeroGaps = false;
          allZeroOverlaps = false;
        }
        const endI = new Date(trend[i].endDate).getTime();
        const startNext = new Date(trend[i + 1].startDate).getTime();
        if (endI < startNext) allZeroGaps = false;
        if (endI > startNext) allZeroOverlaps = false;
      }
    }

    assert(allFirstMatch, 42, 'Exact first bucket boundary begins at range start for all 5 date ranges');
    assert(allLastMatch, 43, 'Exact last bucket boundary ends at range end for all 5 date ranges');
    assert(allZeroGaps, 44, 'Zero gaps between adjacent trend buckets across all 5 date ranges');
    assert(allZeroOverlaps, 45, 'Zero overlapping intervals between adjacent trend buckets across all 5 date ranges');

    // -------------------------------------------------------------------------
    // SECTION J: Boundary Event Precision Testing
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Boundary Event Precision Testing ---');

    const win7d = getRangeWindow('7d', fixedNow);
    const startMs = win7d.start.getTime();
    const endMs = win7d.end.getTime();

    const boundaryFixtures: Complaint[] = [
      // Exact start boundary (t = startMs)
      {
        id: 'b-exact-start',
        ticketNumber: 'BS-1',
        title: 'Exact start boundary',
        description: 'At startMs',
        category: 'electrical',
        priority: 'low',
        status: 'pending',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: new Date(startMs).toISOString(),
        updatedAt: new Date(startMs).toISOString(),
        timeline: [],
      },
      // Just before start boundary (t = startMs - 1ms)
      {
        id: 'b-before-start',
        ticketNumber: 'BBS-1',
        title: 'Just before start boundary',
        description: 'At startMs - 1ms',
        category: 'electrical',
        priority: 'low',
        status: 'pending',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: new Date(startMs - 1).toISOString(),
        updatedAt: new Date(startMs - 1).toISOString(),
        timeline: [],
      },
      // Exact end boundary (t = endMs)
      {
        id: 'b-exact-end',
        ticketNumber: 'BE-1',
        title: 'Exact end boundary',
        description: 'At endMs',
        category: 'electrical',
        priority: 'low',
        status: 'pending',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: new Date(endMs).toISOString(),
        updatedAt: new Date(endMs).toISOString(),
        timeline: [],
      },
      // Just after end boundary (t = endMs + 1ms)
      {
        id: 'b-after-end',
        ticketNumber: 'BAE-1',
        title: 'Just after end boundary',
        description: 'At endMs + 1ms',
        category: 'electrical',
        priority: 'low',
        status: 'pending',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: new Date(endMs + 1).toISOString(),
        updatedAt: new Date(endMs + 1).toISOString(),
        timeline: [],
      },
    ];

    setStorageItem(STORAGE_KEYS.COMPLAINTS, boundaryFixtures);
    const bRes = await analyticsService.getAnalytics('7d', { customNow: fixedNow });

    // Test 46: Exact start included
    const b0Submitted = bRes.trendData[0].submitted;
    assert(
      b0Submitted === 1,
      46,
      'Event exactly on range start boundary (t = startMs) is included in first bucket',
      `got bucket0 submitted=${b0Submitted}`
    );

    // Test 47: Just before start excluded
    // Only 2 complaints should be counted in total (exact start and exact end)
    assert(
      bRes.totalComplaints === 2,
      47,
      'Event just before start boundary (t = startMs - 1ms) is strictly excluded'
    );

    // Test 48: Exact end included
    const bLastSubmitted = bRes.trendData[bRes.trendData.length - 1].submitted;
    assert(
      bLastSubmitted === 1,
      48,
      'Event exactly on range end boundary (t = endMs) is included in last bucket',
      `got last bucket submitted=${bLastSubmitted}`
    );

    // Test 49: Just after end excluded
    assert(
      !bRes.trendData.some((t) => t.submitted > 1) && bRes.totalComplaints === 2,
      49,
      'Event just after end boundary (t = endMs + 1ms) is strictly excluded'
    );

    // 50. Resolution events within range from complaints created before the range
    const crossWindowFixtures: Complaint[] = [
      // Created 5 days before startMs (outside 7d), but resolved 2 days after startMs (inside 7d)
      {
        id: 'cw-1',
        ticketNumber: 'CW-1',
        title: 'Cross window ticket',
        description: 'Created before 7d window, resolved inside 7d window',
        category: 'plumbing',
        priority: 'high',
        status: 'resolved',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: new Date(startMs - 5 * 86400000).toISOString(),
        resolvedAt: new Date(startMs + 2 * 86400000).toISOString(),
        updatedAt: new Date(startMs + 2 * 86400000).toISOString(),
        timeline: [],
      },
      // Created inside 7d and resolved inside 7d
      {
        id: 'cw-2',
        ticketNumber: 'CW-2',
        title: 'Inside window ticket',
        description: 'Created and resolved inside 7d',
        category: 'plumbing',
        priority: 'low',
        status: 'resolved',
        studentId: 's-1',
        studentName: 'Student One',
        createdAt: new Date(startMs + 1 * 86400000).toISOString(),
        resolvedAt: new Date(startMs + 3 * 86400000).toISOString(),
        updatedAt: new Date(startMs + 3 * 86400000).toISOString(),
        timeline: [],
      },
    ];
    setStorageItem(STORAGE_KEYS.COMPLAINTS, crossWindowFixtures);
    const cwRes = await analyticsService.getAnalytics('7d', { customNow: fixedNow });
    const totalTrendResolved = cwRes.trendData.reduce((acc, t) => acc + t.resolved, 0);
    const totalTrendSubmitted = cwRes.trendData.reduce((acc, t) => acc + t.submitted, 0);

    assert(
      totalTrendResolved === 2 && totalTrendSubmitted === 1 && cwRes.totalComplaints === 1,
      50,
      'Resolutions inside range for tickets created before range are counted in resolution trends, and trend submissions match KPI total exactly',
      `resolvedCount=${totalTrendResolved}, submittedCount=${totalTrendSubmitted}, kpiTotal=${cwRes.totalComplaints}`
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
