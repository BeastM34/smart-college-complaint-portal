import type {
  Complaint,
  AnalyticsSummary,
  ComprehensiveAnalytics,
  DateRangeOption,
  TrendDataPoint,
  CategoryMetric,
  PriorityMetric,
  StatusMetric,
  DepartmentMetric,
  Priority,
  ComplaintStatus,
} from '@/types';
import { STORAGE_KEYS, getStorageItem } from '@/utils/storage';
import { MOCK_COMPLAINTS } from '@/data/mockData';
import { authService } from './authService';

/**
 * Known human-friendly category display labels
 */
export const CATEGORY_LABELS: Record<string, string> = {
  hostel: 'Hostel Maintenance',
  electrical: 'Electrical',
  infrastructure: 'Infrastructure',
  sanitation: 'Sanitation',
  academic: 'Academic & Labs',
  library: 'Library',
  canteen: 'Canteen',
  transport: 'Campus Transport',
  plumbing: 'Plumbing',
  wifi_internet: 'Wi-Fi / Internet',
  classroom: 'Classroom',
  furniture: 'Furniture',
  cleanliness: 'Cleanliness',
  washroom: 'Washroom',
  water_supply: 'Water Supply',
  security: 'Security',
  other: 'Other',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

/**
 * Calculates start, end, and label for each DateRangeOption
 */
export function getRangeWindow(
  range: DateRangeOption,
  now: Date
): { start: Date; end: Date; label: string } {
  const end = new Date(now.getTime());
  const start = new Date(now.getTime());

  switch (range) {
    case '7d':
      start.setDate(start.getDate() - 7);
      return { start, end, label: 'Last 7 Days' };
    case '30d':
      start.setDate(start.getDate() - 30);
      return { start, end, label: 'Last 30 Days' };
    case '3m':
      start.setMonth(start.getMonth() - 3);
      return { start, end, label: 'Last 3 Months' };
    case '6m':
      start.setMonth(start.getMonth() - 6);
      return { start, end, label: 'Last 6 Months' };
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      return { start, end, label: 'Last 1 Year' };
  }
}

/**
 * Safely extracts resolution timestamp from complaint.resolvedAt or timeline events
 */
export function getResolutionTimestamp(c: Complaint): number | null {
  if (c.resolvedAt) {
    const t = new Date(c.resolvedAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (Array.isArray(c.timeline)) {
    // Find the latest valid resolved event in the timeline
    const resolvedEvents = c.timeline.filter(
      (e) => e.status === 'resolved' && e.timestamp && !isNaN(new Date(e.timestamp).getTime())
    );
    if (resolvedEvents.length > 0) {
      const latest = resolvedEvents[resolvedEvents.length - 1];
      return new Date(latest.timestamp).getTime();
    }
  }
  return null;
}

/**
 * Computes average resolution time in hours and formatted string for valid resolved complaints
 */
export function calculateAverageResolutionTime(complaints: Complaint[]): {
  avgHours: number | null;
  formatted: string;
  validCount: number;
} {
  const validDurationsHours: number[] = [];

  for (const c of complaints) {
    if (c.status !== 'resolved') continue;

    const createdTime = new Date(c.createdAt).getTime();
    if (isNaN(createdTime)) continue;

    const resolvedTime = getResolutionTimestamp(c);
    if (resolvedTime === null || isNaN(resolvedTime)) continue;

    const durationMs = resolvedTime - createdTime;
    // Exclude invalid records where resolution timestamp precedes creation timestamp
    if (durationMs < 0) continue;

    const hours = durationMs / (1000 * 60 * 60);
    validDurationsHours.push(hours);
  }

  if (validDurationsHours.length === 0) {
    return { avgHours: null, formatted: 'N/A', validCount: 0 };
  }

  const sum = validDurationsHours.reduce((acc, h) => acc + h, 0);
  const avgHours = sum / validDurationsHours.length;

  let formatted = '';
  if (avgHours < 1) {
    const mins = Math.max(1, Math.round(avgHours * 60));
    formatted = `${mins} min${mins === 1 ? '' : 's'}`;
  } else if (avgHours < 24) {
    formatted = `${avgHours.toFixed(1)} hours`;
  } else {
    const days = (avgHours / 24).toFixed(1);
    formatted = `${days} days`;
  }

  return { avgHours, formatted, validCount: validDurationsHours.length };
}

/**
 * Computes chronological trend buckets for submission and resolution events
 */
export function generateTrendData(
  complaints: Complaint[],
  range: DateRangeOption,
  now: Date
): TrendDataPoint[] {
  const buckets: {
    label: string;
    startDate: Date;
    endDate: Date;
    submitted: number;
    resolved: number;
  }[] = [];

  const nowMs = now.getTime();

  if (range === '7d') {
    // 7 daily buckets from 6 days ago up to today
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      buckets.push({ label, startDate: start, endDate: end, submitted: 0, resolved: 0 });
    }
  } else if (range === '30d') {
    // 30 daily buckets
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      buckets.push({ label, startDate: start, endDate: end, submitted: 0, resolved: 0 });
    }
  } else if (range === '3m') {
    // 12 weekly intervals leading up to now
    for (let i = 11; i >= 0; i--) {
      const weekEnd = new Date(nowMs - i * 7 * 86400000);
      const weekStart = new Date(nowMs - (i + 1) * 7 * 86400000 + 1);
      const label = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      buckets.push({ label, startDate: weekStart, endDate: weekEnd, submitted: 0, resolved: 0 });
    }
  } else if (range === '6m') {
    // 6 calendar month buckets
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      buckets.push({ label, startDate: start, endDate: end, submitted: 0, resolved: 0 });
    }
  } else if (range === '1y') {
    // 12 calendar month buckets
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      buckets.push({ label, startDate: start, endDate: end, submitted: 0, resolved: 0 });
    }
  }

  // Populate events into buckets
  for (const c of complaints) {
    const createdTime = new Date(c.createdAt).getTime();
    if (!isNaN(createdTime) && createdTime <= nowMs) {
      for (const bucket of buckets) {
        if (createdTime >= bucket.startDate.getTime() && createdTime <= bucket.endDate.getTime()) {
          bucket.submitted++;
          break;
        }
      }
    }

    const resolvedTime = getResolutionTimestamp(c);
    if (resolvedTime !== null && !isNaN(resolvedTime) && resolvedTime <= nowMs) {
      for (const bucket of buckets) {
        if (resolvedTime >= bucket.startDate.getTime() && resolvedTime <= bucket.endDate.getTime()) {
          bucket.resolved++;
          break;
        }
      }
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    startDate: b.startDate.toISOString(),
    endDate: b.endDate.toISOString(),
    submitted: b.submitted,
    resolved: b.resolved,
  }));
}

/**
 * Computes category distribution sorted descending by volume
 */
export function calculateCategoryDistribution(
  complaints: Complaint[],
  totalComplaints: number
): CategoryMetric[] {
  if (complaints.length === 0 || totalComplaints === 0) return [];

  const counts: Record<string, number> = {};
  for (const c of complaints) {
    const rawCat = (c.category || 'other').trim().toLowerCase();
    const cat = rawCat || 'other';
    counts[cat] = (counts[cat] || 0) + 1;
  }

  const result: CategoryMetric[] = Object.entries(counts).map(([cat, count]) => {
    const label =
      CATEGORY_LABELS[cat] ||
      (cat
        ? cat
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
        : 'Uncategorized');
    return {
      category: cat,
      label,
      count,
      percentage: totalComplaints > 0 ? Math.round((count / totalComplaints) * 100) : 0,
    };
  });

  result.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return result;
}

/**
 * Computes priority distribution across low, medium, high, critical
 */
export function calculatePriorityDistribution(
  complaints: Complaint[],
  totalComplaints: number
): PriorityMetric[] {
  const counts: Record<Priority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const c of complaints) {
    if (c.priority && counts[c.priority] !== undefined) {
      counts[c.priority]++;
    } else {
      counts.medium++;
    }
  }

  const order: Priority[] = ['critical', 'high', 'medium', 'low'];
  return order.map((pri) => ({
    priority: pri,
    label: PRIORITY_LABELS[pri],
    count: counts[pri],
    percentage: totalComplaints > 0 ? Math.round((counts[pri] / totalComplaints) * 100) : 0,
  }));
}

/**
 * Computes status distribution across all 5 workflow states
 */
export function calculateStatusDistribution(
  complaints: Complaint[],
  totalComplaints: number
): StatusMetric[] {
  const counts: Record<ComplaintStatus, number> = {
    pending: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
    rejected: 0,
  };

  for (const c of complaints) {
    if (c.status && counts[c.status] !== undefined) {
      counts[c.status]++;
    }
  }

  const order: ComplaintStatus[] = ['pending', 'assigned', 'in_progress', 'resolved', 'rejected'];
  return order.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: counts[status],
    percentage: totalComplaints > 0 ? Math.round((counts[status] / totalComplaints) * 100) : 0,
  }));
}

/**
 * Computes department metrics and resolution rates
 */
export function calculateDepartmentPerformance(complaints: Complaint[]): DepartmentMetric[] {
  const deptMap: Record<
    string,
    { total: number; resolved: number; pending: number; active: number }
  > = {};

  for (const c of complaints) {
    const rawDept = (c.assignedDepartment || c.department || '').trim();
    const dept = rawDept.length > 0 ? rawDept : 'General Facilities';

    if (!deptMap[dept]) {
      deptMap[dept] = { total: 0, resolved: 0, pending: 0, active: 0 };
    }

    deptMap[dept].total++;
    if (c.status === 'resolved') {
      deptMap[dept].resolved++;
    } else if (c.status === 'pending') {
      deptMap[dept].pending++;
    }

    if (c.status === 'pending' || c.status === 'assigned' || c.status === 'in_progress') {
      deptMap[dept].active++;
    }
  }

  const result: DepartmentMetric[] = Object.entries(deptMap).map(([dept, counts]) => ({
    department: dept,
    total: counts.total,
    resolved: counts.resolved,
    pending: counts.pending,
    active: counts.active,
    resolutionRate: counts.total > 0 ? Math.round((counts.resolved / counts.total) * 100) : 0,
  }));

  // Sort descending by total volume, then by active queue
  result.sort((a, b) => b.total - a.total || b.active - a.active || a.department.localeCompare(b.department));
  return result;
}

/**
 * Analytics Service
 * Admin-only service computing real-time metrics dynamically from stored complaint records.
 */
class AnalyticsService {
  private ensureAdmin(): void {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to retrieve analytics.');
    }
  }

  /**
   * Retrieves comprehensive analytics calculated dynamically for the specified date range.
   */
  public async getAnalytics(
    range: DateRangeOption = '30d',
    options?: { customNow?: Date }
  ): Promise<ComprehensiveAnalytics> {
    this.ensureAdmin();

    const allComplaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS) || [];
    const now = options?.customNow || new Date();
    const { start, end, label } = getRangeWindow(range, now);
    const startMs = start.getTime();
    const endMs = end.getTime();

    // Filter complaints created within the reporting period
    const filtered = allComplaints.filter((c) => {
      const createdMs = new Date(c.createdAt).getTime();
      if (isNaN(createdMs)) return false;
      if (createdMs > endMs) return false; // future dates excluded
      return createdMs >= startMs;
    });

    const total = filtered.length;
    const pending = filtered.filter((c) => c.status === 'pending').length;
    const assigned = filtered.filter((c) => c.status === 'assigned').length;
    const inProgress = filtered.filter((c) => c.status === 'in_progress').length;
    const resolved = filtered.filter((c) => c.status === 'resolved').length;
    const rejected = filtered.filter((c) => c.status === 'rejected').length;
    const activeQueue = pending + assigned + inProgress;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const resCalc = calculateAverageResolutionTime(filtered);
    const trendData = generateTrendData(allComplaints, range, now);
    const categoryDistribution = calculateCategoryDistribution(filtered, total);
    const priorityDistribution = calculatePriorityDistribution(filtered, total);
    const statusDistribution = calculateStatusDistribution(filtered, total);
    const departmentPerformance = calculateDepartmentPerformance(filtered);

    return {
      range,
      periodLabel: label,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalComplaints: total,
      pendingComplaints: pending,
      assignedComplaints: assigned,
      inProgressComplaints: inProgress,
      resolvedComplaints: resolved,
      rejectedComplaints: rejected,
      activeQueue,
      resolutionRate,
      avgResolutionTimeHours: resCalc.avgHours,
      avgResolutionTimeFormatted: resCalc.formatted,
      trendData,
      categoryDistribution,
      priorityDistribution,
      statusDistribution,
      departmentPerformance,
    };
  }

  /**
   * Backward-compatible summary method required by test suites and dashboards.
   * Computes dynamic metrics directly from stored complaint records without mock fallback.
   */
  public async getSummary(options?: { customNow?: Date }): Promise<AnalyticsSummary> {
    this.ensureAdmin();

    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS) || [];

    if (complaints.length === 0) {
      return {
        totalComplaints: 0,
        pendingComplaints: 0,
        assignedComplaints: 0,
        inProgressComplaints: 0,
        resolvedComplaints: 0,
        rejectedComplaints: 0,
        avgResolutionTimeHours: 0,
        complaintsByCategory: {},
        complaintsByPriority: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        },
        monthlyTrends: [],
      };
    }

    const now = options?.customNow || new Date();
    const resCalc = calculateAverageResolutionTime(complaints);

    const byCategory: Record<string, number> = {};
    complaints.forEach((c) => {
      const cat = c.category || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    const trend6m = generateTrendData(complaints, '6m', now);
    const monthlyTrends = trend6m.map((t) => ({
      month: t.label,
      submitted: t.submitted,
      resolved: t.resolved,
    }));

    return {
      totalComplaints: complaints.length,
      pendingComplaints: complaints.filter((c) => c.status === 'pending').length,
      assignedComplaints: complaints.filter((c) => c.status === 'assigned').length,
      inProgressComplaints: complaints.filter((c) => c.status === 'in_progress').length,
      resolvedComplaints: complaints.filter((c) => c.status === 'resolved').length,
      rejectedComplaints: complaints.filter((c) => c.status === 'rejected').length,
      avgResolutionTimeHours: resCalc.avgHours !== null ? Math.round(resCalc.avgHours * 10) / 10 : 0,
      complaintsByCategory: byCategory,
      complaintsByPriority: {
        low: complaints.filter((c) => c.priority === 'low').length,
        medium: complaints.filter((c) => c.priority === 'medium').length,
        high: complaints.filter((c) => c.priority === 'high').length,
        critical: complaints.filter((c) => c.priority === 'critical').length,
      },
      monthlyTrends,
    };
  }
}

export const analyticsService = new AnalyticsService();
