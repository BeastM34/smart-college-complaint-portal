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
import { authService } from './authService';
import { apiClient } from './apiClient';

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

export const PRIORITY_LABELS: Record<Priority | 'unknown', string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  unknown: 'Unknown',
};

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

/**
 * Safely subtracts calendar months from a date while clamping the day to the last valid
 * day of the target month (e.g. May 31 minus 3 months -> Feb 28/29, Oct 31 minus 6 months -> Apr 30),
 * strictly preserving the original time of day without mutating the input date.
 */
export function subtractCalendarMonths(
  baseDate: Date,
  months: number,
  useUTC: boolean = true
): Date {
  const year = useUTC ? baseDate.getUTCFullYear() : baseDate.getFullYear();
  const month = useUTC ? baseDate.getUTCMonth() : baseDate.getMonth();
  const day = useUTC ? baseDate.getUTCDate() : baseDate.getDate();
  const hours = useUTC ? baseDate.getUTCHours() : baseDate.getHours();
  const minutes = useUTC ? baseDate.getUTCMinutes() : baseDate.getMinutes();
  const seconds = useUTC ? baseDate.getUTCSeconds() : baseDate.getSeconds();
  const ms = useUTC ? baseDate.getUTCMilliseconds() : baseDate.getMilliseconds();

  const totalMonths = year * 12 + month - months;
  const targetYear = Math.floor(totalMonths / 12);
  let targetMonth = totalMonths % 12;
  if (targetMonth < 0) {
    targetMonth += 12;
  }

  // Days in target month (day 0 of targetMonth + 1 gives the last day of targetMonth)
  const maxDays = useUTC
    ? new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
    : new Date(targetYear, targetMonth + 1, 0).getDate();

  const targetDay = Math.min(day, maxDays);

  return useUTC
    ? new Date(Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, ms))
    : new Date(targetYear, targetMonth, targetDay, hours, minutes, seconds, ms);
}

/**
 * Calculates start, end, and label for each DateRangeOption.
 * Reliably clamps month-end dates and strictly preserves exact time of day.
 */
export function getRangeWindow(
  range: DateRangeOption,
  now: Date
): { start: Date; end: Date; label: string } {
  const end = new Date(now.getTime());
  let start: Date;

  switch (range) {
    case '7d':
      start = new Date(now.getTime() - 7 * 86400000);
      return { start, end, label: 'Last 7 Days' };
    case '30d':
      start = new Date(now.getTime() - 30 * 86400000);
      return { start, end, label: 'Last 30 Days' };
    case '3m':
      start = subtractCalendarMonths(now, 3);
      return { start, end, label: 'Last 3 Months' };
    case '6m':
      start = subtractCalendarMonths(now, 6);
      return { start, end, label: 'Last 6 Months' };
    case '1y':
      start = subtractCalendarMonths(now, 12);
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
 * Computes average resolution time in hours and formatted string for valid resolved complaints.
 * Strictly excludes future resolution timestamps, resolutions preceding creation, and unresolvable timestamps.
 */
export function calculateAverageResolutionTime(
  complaints: Complaint[],
  referenceNow?: Date
): {
  avgHours: number | null;
  formatted: string;
  validCount: number;
} {
  const validDurationsHours: number[] = [];
  const maxTime = (referenceNow || new Date()).getTime();

  for (const c of complaints) {
    if (c.status !== 'resolved') continue;

    const createdTime = new Date(c.createdAt).getTime();
    if (isNaN(createdTime)) continue;
    // Exclude records created in the future relative to the reference timestamp
    if (createdTime > maxTime) continue;

    const resolvedTime = getResolutionTimestamp(c);
    if (resolvedTime === null || isNaN(resolvedTime)) continue;

    // Exclude invalid records where resolution timestamp precedes creation timestamp
    if (resolvedTime < createdTime) continue;

    // Exclude future resolution timestamps relative to reference timestamp
    if (resolvedTime > maxTime) continue;

    const durationMs = resolvedTime - createdTime;
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
 * Computes chronological trend buckets for submission and resolution events.
 * The buckets strictly and contiguously span from range start to end with zero gaps and zero overlaps.
 * Only events within [startDate, endDate] are counted, and each event is counted exactly once.
 */
export function generateTrendData(
  complaints: Complaint[],
  range: DateRangeOption,
  now: Date
): TrendDataPoint[] {
  const { start, end } = getRangeWindow(range, now);
  const startMs = start.getTime();
  const endMs = end.getTime();

  const buckets: {
    label: string;
    startDate: Date;
    endDate: Date;
    submitted: number;
    resolved: number;
  }[] = [];

  if (range === '7d') {
    // 7 daily contiguous intervals from start to end
    for (let i = 0; i < 7; i++) {
      const bStart = new Date(startMs + i * 86400000);
      const bEnd = i === 6 ? new Date(endMs) : new Date(startMs + (i + 1) * 86400000);
      const label = bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      buckets.push({ label, startDate: bStart, endDate: bEnd, submitted: 0, resolved: 0 });
    }
  } else if (range === '30d') {
    // 30 daily contiguous intervals from start to end
    for (let i = 0; i < 30; i++) {
      const bStart = new Date(startMs + i * 86400000);
      const bEnd = i === 29 ? new Date(endMs) : new Date(startMs + (i + 1) * 86400000);
      const label = bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      buckets.push({ label, startDate: bStart, endDate: bEnd, submitted: 0, resolved: 0 });
    }
  } else if (range === '3m') {
    // Weekly contiguous intervals covering exactly from start to end (with partial last week)
    let curMs = startMs;
    const oneWeekMs = 7 * 86400000;
    while (curMs < endMs) {
      const nextMs = Math.min(curMs + oneWeekMs, endMs);
      const bStart = new Date(curMs);
      const bEnd = new Date(nextMs);
      const label = bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      buckets.push({ label, startDate: bStart, endDate: bEnd, submitted: 0, resolved: 0 });
      curMs = nextMs;
    }
  } else if (range === '6m') {
    // 6 monthly contiguous intervals covering exactly from start to end
    for (let i = 0; i < 6; i++) {
      const bStart = i === 0 ? new Date(startMs) : buckets[i - 1].endDate;
      const bEnd = i === 5 ? new Date(endMs) : subtractCalendarMonths(end, 6 - (i + 1));
      const label = bStart.toLocaleDateString('en-US', { month: 'short' });
      buckets.push({ label, startDate: bStart, endDate: bEnd, submitted: 0, resolved: 0 });
    }
  } else if (range === '1y') {
    // 12 monthly contiguous intervals covering exactly from start to end
    for (let i = 0; i < 12; i++) {
      const bStart = i === 0 ? new Date(startMs) : buckets[i - 1].endDate;
      const bEnd = i === 11 ? new Date(endMs) : subtractCalendarMonths(end, 12 - (i + 1));
      const label = bStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      buckets.push({ label, startDate: bStart, endDate: bEnd, submitted: 0, resolved: 0 });
    }
  }

  // Populate events into buckets
  const placeEvent = (timeMs: number, type: 'submitted' | 'resolved') => {
    // Strictly exclude events outside authoritative [startMs, endMs] boundary
    if (timeMs < startMs || timeMs > endMs) return;

    for (let i = 0; i < buckets.length; i++) {
      const bStartMs = buckets[i].startDate.getTime();
      const bEndMs = buckets[i].endDate.getTime();
      const isLast = i === buckets.length - 1;

      // Adjacent buckets do not overlap: [start, end) for all except the last bucket [start, end]
      const matches = isLast
        ? timeMs >= bStartMs && timeMs <= bEndMs
        : timeMs >= bStartMs && timeMs < bEndMs;

      if (matches) {
        if (type === 'submitted') {
          buckets[i].submitted++;
        } else {
          buckets[i].resolved++;
        }
        break;
      }
    }
  };

  for (const c of complaints) {
    const createdTime = new Date(c.createdAt).getTime();
    if (!isNaN(createdTime)) {
      placeEvent(createdTime, 'submitted');
    }

    const resolvedTime = getResolutionTimestamp(c);
    if (resolvedTime !== null && !isNaN(resolvedTime)) {
      placeEvent(resolvedTime, 'resolved');
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
 * Computes priority distribution across low, medium, high, critical, and unknown
 */
export function calculatePriorityDistribution(
  complaints: Complaint[],
  totalComplaints: number
): PriorityMetric[] {
  const counts: Record<Priority | 'unknown', number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
  };

  for (const c of complaints) {
    const rawPri = (c.priority || '').toString().toLowerCase();
    if (rawPri === 'critical' || rawPri === 'high' || rawPri === 'medium' || rawPri === 'low') {
      counts[rawPri as Priority]++;
    } else {
      counts.unknown++;
    }
  }

  const order: (Priority | 'unknown')[] = ['critical', 'high', 'medium', 'low', 'unknown'];
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
 * Computes department metrics and resolution rates.
 * Assigns complaints with missing or empty departments to 'Unassigned'.
 */
export function calculateDepartmentPerformance(complaints: Complaint[]): DepartmentMetric[] {
  const deptMap: Record<
    string,
    { total: number; resolved: number; pending: number; active: number }
  > = {};

  for (const c of complaints) {
    const rawDept = (c.assignedDepartment || c.department || '').trim();
    const dept = rawDept.length > 0 ? rawDept : 'Unassigned';

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
    options?: {
      customNow?: Date;
      category?: string;
      priority?: string;
      status?: string;
      department?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<ComprehensiveAnalytics> {
    this.ensureAdmin();

    // Query live backend endpoint when online and not executing deterministic customNow unit tests
    if (!options?.customNow) {
      try {
        const params = new URLSearchParams();
        if (range) params.append('range', range);
        if (options?.category) params.append('category', options.category);
        if (options?.priority) params.append('priority', options.priority);
        if (options?.status) params.append('status', options.status);
        if (options?.department) params.append('department', options.department);
        if (options?.startDate) params.append('startDate', options.startDate);
        if (options?.endDate) params.append('endDate', options.endDate);

        const qs = params.toString() ? `?${params.toString()}` : '';
        const res = await apiClient.get<ComprehensiveAnalytics>(`/analytics${qs}`);
        if (res && res.success && res.data) {
          return res.data;
        }
      } catch (err: any) {
        if (err?.status === 400 || err?.status === 401 || err?.status === 403) {
          throw new Error(err.message || 'Failed to retrieve analytics.');
        }
        // Offline fallback for headless tests
      }
    }

    const rawComplaints = getStorageItem<unknown>(STORAGE_KEYS.COMPLAINTS, []);
    const allComplaints: Complaint[] = Array.isArray(rawComplaints) ? rawComplaints : [];
    const now = options?.customNow || new Date();
    const { start, end, label } = getRangeWindow(range, now);
    const startMs = start.getTime();
    const endMs = end.getTime();

    // Filter complaints created within the authoritative reporting period
    const filtered = allComplaints.filter((c) => {
      const createdMs = new Date(c.createdAt).getTime();
      if (isNaN(createdMs)) return false;
      return createdMs >= startMs && createdMs <= endMs;
    });

    const total = filtered.length;
    const pending = filtered.filter((c) => c.status === 'pending').length;
    const assigned = filtered.filter((c) => c.status === 'assigned').length;
    const inProgress = filtered.filter((c) => c.status === 'in_progress').length;
    const resolved = filtered.filter((c) => c.status === 'resolved').length;
    const rejected = filtered.filter((c) => c.status === 'rejected').length;
    const activeQueue = pending + assigned + inProgress;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const resCalc = calculateAverageResolutionTime(filtered, now);
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

    const rawComplaints = getStorageItem<unknown>(STORAGE_KEYS.COMPLAINTS, []);
    const complaints: Complaint[] = Array.isArray(rawComplaints) ? rawComplaints : [];

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
    const resCalc = calculateAverageResolutionTime(complaints, now);

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
