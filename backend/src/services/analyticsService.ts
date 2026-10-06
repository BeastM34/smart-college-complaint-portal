import { SupabaseClient } from '@supabase/supabase-js';
import {
  ComprehensiveAnalytics,
  AnalyticsFilterQuery,
  DateRangeOption,
  TrendDataPoint,
  CategoryMetric,
  PriorityMetric,
  StatusMetric,
  DepartmentMetric,
  Complaint,
  ComplaintPriority,
  ComplaintStatus,
} from '../types';

const VALID_RANGES: DateRangeOption[] = ['7d', '30d', '3m', '6m', '1y'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES = ['pending', 'assigned', 'in_progress', 'resolved', 'rejected'];

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

export const PRIORITY_LABELS: Record<string, string> = {
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
 * Safely subtracts calendar months while clamping the day to the target month's end.
 */
export function subtractCalendarMonths(baseDate: Date, months: number): Date {
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const day = baseDate.getUTCDate();
  const hours = baseDate.getUTCHours();
  const minutes = baseDate.getUTCMinutes();
  const seconds = baseDate.getUTCSeconds();
  const ms = baseDate.getUTCMilliseconds();

  const totalMonths = year * 12 + month - months;
  const targetYear = Math.floor(totalMonths / 12);
  let targetMonth = totalMonths % 12;
  if (targetMonth < 0) {
    targetMonth += 12;
  }

  const maxDays = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, maxDays);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, ms));
}

/**
 * Calculates start, end, and label for each DateRangeOption.
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

export class AnalyticsService {
  /**
   * Generates comprehensive analytics for campus administrators.
   */
  public static async getComprehensiveAnalytics(
    client: SupabaseClient,
    filters: AnalyticsFilterQuery = {},
    customNow?: Date
  ): Promise<ComprehensiveAnalytics> {
    const now = customNow || new Date();

    // 1. Validate and resolve Date Range
    let range: DateRangeOption = '30d';
    if (filters.range) {
      const cleanRange = String(filters.range).toLowerCase().trim() as DateRangeOption;
      if (!VALID_RANGES.includes(cleanRange)) {
        const err: any = new Error(`Invalid range "${filters.range}". Allowed: 7d, 30d, 3m, 6m, 1y.`);
        err.statusCode = 400;
        throw err;
      }
      range = cleanRange;
    }

    let { start, end, label } = getRangeWindow(range, now);

    // Custom date overrides
    if (filters.startDate) {
      const s = new Date(filters.startDate);
      if (isNaN(s.getTime())) {
        const err: any = new Error(`Invalid startDate format "${filters.startDate}". Must be valid ISO timestamp.`);
        err.statusCode = 400;
        throw err;
      }
      start = s;
    }

    if (filters.endDate) {
      const e = new Date(filters.endDate);
      if (isNaN(e.getTime())) {
        const err: any = new Error(`Invalid endDate format "${filters.endDate}". Must be valid ISO timestamp.`);
        err.statusCode = 400;
        throw err;
      }
      end = e;
    }

    if (start.getTime() > end.getTime()) {
      const err: any = new Error('startDate cannot be after endDate.');
      err.statusCode = 400;
      throw err;
    }

    // 2. Validate optional filters
    if (filters.priority) {
      const pri = String(filters.priority).toLowerCase().trim();
      if (!VALID_PRIORITIES.includes(pri) && pri !== 'all') {
        const err: any = new Error(`Invalid priority filter "${filters.priority}".`);
        err.statusCode = 400;
        throw err;
      }
    }

    if (filters.status) {
      const st = String(filters.status).toLowerCase().trim();
      if (!VALID_STATUSES.includes(st) && st !== 'all') {
        const err: any = new Error(`Invalid status filter "${filters.status}".`);
        err.statusCode = 400;
        throw err;
      }
    }

    // 3. Query complaints under Row Level Security (admin client sees all campus complaints)
    let query = client.from('complaints').select('*');

    if (filters.category && filters.category !== 'all') {
      const cat = String(filters.category).trim().toLowerCase();
      query = query.or(`category_slug.eq.${cat},category_id.eq.${cat}`);
    }

    if (filters.priority && filters.priority !== 'all') {
      query = query.eq('priority', String(filters.priority).trim().toLowerCase());
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', String(filters.status).trim().toLowerCase());
    }

    if (filters.department && filters.department !== 'all') {
      query = query.eq('department', String(filters.department).trim());
    }

    const { data: rawComplaints, error } = await query;
    if (error) {
      const err: any = new Error(error.message || 'Failed to retrieve complaints for analytics.');
      err.statusCode = error.code === '42501' ? 403 : 500;
      throw err;
    }

    const allComplaints = (rawComplaints || []) as Complaint[];

    // 4. Filter complaints created within the reporting window
    const startMs = start.getTime();
    const endMs = end.getTime();

    const filtered = allComplaints.filter((c) => {
      const createdMs = new Date(c.created_at).getTime();
      if (isNaN(createdMs)) return false;
      return createdMs >= startMs && createdMs <= endMs;
    });

    // 5. Calculate Metrics
    const total = filtered.length;
    const pending = filtered.filter((c) => c.status === 'pending').length;
    const assigned = filtered.filter((c) => c.status === 'assigned').length;
    const inProgress = filtered.filter((c) => c.status === 'in_progress').length;
    const resolved = filtered.filter((c) => c.status === 'resolved').length;
    const rejected = filtered.filter((c) => c.status === 'rejected').length;
    const activeQueue = pending + assigned + inProgress;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const resCalc = this.calculateAverageResolutionTime(filtered, now);
    const trendData = this.generateTrendData(allComplaints, range, now, start, end);
    const categoryDistribution = this.calculateCategoryDistribution(filtered, total);
    const priorityDistribution = this.calculatePriorityDistribution(filtered, total);
    const statusDistribution = this.calculateStatusDistribution(filtered, total);
    const departmentPerformance = this.calculateDepartmentPerformance(filtered);

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
   * Computes average resolution time in hours and formatted string for resolved complaints.
   */
  public static calculateAverageResolutionTime(
    complaints: Complaint[],
    referenceNow?: Date
  ): { avgHours: number | null; formatted: string; validCount: number } {
    const validDurationsHours: number[] = [];
    const maxTime = (referenceNow || new Date()).getTime();

    for (const c of complaints) {
      if (c.status !== 'resolved') continue;

      const createdTime = new Date(c.created_at).getTime();
      if (isNaN(createdTime) || createdTime > maxTime) continue;

      if (!c.resolved_at) continue;
      const resolvedTime = new Date(c.resolved_at).getTime();
      if (isNaN(resolvedTime) || resolvedTime < createdTime || resolvedTime > maxTime) continue;

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
   * Generates chronological trend data with contiguous buckets covering the exact date window.
   */
  public static generateTrendData(
    complaints: Complaint[],
    range: DateRangeOption,
    now: Date,
    explicitStart?: Date,
    explicitEnd?: Date
  ): TrendDataPoint[] {
    const { start: defaultStart, end: defaultEnd } = getRangeWindow(range, now);
    const start = explicitStart || defaultStart;
    const end = explicitEnd || defaultEnd;
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
      for (let i = 0; i < 7; i++) {
        const bStart = new Date(startMs + i * 86400000);
        const bEnd = i === 6 ? new Date(endMs) : new Date(startMs + (i + 1) * 86400000);
        const label = bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        buckets.push({ label, startDate: bStart, endDate: bEnd, submitted: 0, resolved: 0 });
      }
    } else if (range === '30d') {
      for (let i = 0; i < 30; i++) {
        const bStart = new Date(startMs + i * 86400000);
        const bEnd = i === 29 ? new Date(endMs) : new Date(startMs + (i + 1) * 86400000);
        const label = bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        buckets.push({ label, startDate: bStart, endDate: bEnd, submitted: 0, resolved: 0 });
      }
    } else if (range === '3m') {
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
      for (let i = 0; i < 6; i++) {
        const bStart = i === 0 ? new Date(startMs) : buckets[i - 1].endDate;
        const bEnd = i === 5 ? new Date(endMs) : subtractCalendarMonths(end, 6 - (i + 1));
        const label = bStart.toLocaleDateString('en-US', { month: 'short' });
        buckets.push({ label, startDate: bStart, endDate: bEnd, submitted: 0, resolved: 0 });
      }
    } else if (range === '1y') {
      for (let i = 0; i < 12; i++) {
        const bStart = i === 0 ? new Date(startMs) : buckets[i - 1].endDate;
        const bEnd = i === 11 ? new Date(endMs) : subtractCalendarMonths(end, 12 - (i + 1));
        const label = bStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        buckets.push({ label, startDate: bStart, endDate: bEnd, submitted: 0, resolved: 0 });
      }
    }

    const placeEvent = (timeMs: number, type: 'submitted' | 'resolved') => {
      if (timeMs < startMs || timeMs > endMs) return;

      for (let i = 0; i < buckets.length; i++) {
        const bStartMs = buckets[i].startDate.getTime();
        const bEndMs = buckets[i].endDate.getTime();
        const isLast = i === buckets.length - 1;

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
      const createdTime = new Date(c.created_at).getTime();
      if (!isNaN(createdTime)) {
        placeEvent(createdTime, 'submitted');
      }

      if (c.resolved_at) {
        const resolvedTime = new Date(c.resolved_at).getTime();
        if (!isNaN(resolvedTime)) {
          placeEvent(resolvedTime, 'resolved');
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
   * Computes category volume distribution.
   */
  public static calculateCategoryDistribution(
    complaints: Complaint[],
    totalComplaints: number
  ): CategoryMetric[] {
    if (complaints.length === 0 || totalComplaints === 0) return [];

    const counts: Record<string, number> = {};
    for (const c of complaints) {
      const cat = (c.category_slug || 'other').trim().toLowerCase() || 'other';
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
   * Computes priority breakdown across low, medium, high, critical, and unknown.
   */
  public static calculatePriorityDistribution(
    complaints: Complaint[],
    totalComplaints: number
  ): PriorityMetric[] {
    const counts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
    };

    for (const c of complaints) {
      const rawPri = (c.priority || '').toString().toLowerCase();
      if (VALID_PRIORITIES.includes(rawPri)) {
        counts[rawPri]++;
      } else {
        counts.unknown++;
      }
    }

    const order = ['critical', 'high', 'medium', 'low', 'unknown'];
    return order.map((pri) => ({
      priority: pri as any,
      label: PRIORITY_LABELS[pri],
      count: counts[pri],
      percentage: totalComplaints > 0 ? Math.round((counts[pri] / totalComplaints) * 100) : 0,
    }));
  }

  /**
   * Computes status breakdown across pending, assigned, in_progress, resolved, rejected.
   */
  public static calculateStatusDistribution(
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
   * Computes department performance metrics.
   */
  public static calculateDepartmentPerformance(complaints: Complaint[]): DepartmentMetric[] {
    const deptMap: Record<
      string,
      { total: number; resolved: number; pending: number; active: number }
    > = {};

    for (const c of complaints) {
      const rawDept = (c.assigned_department || c.department || '').trim();
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

    result.sort((a, b) => b.total - a.total || b.active - a.active || a.department.localeCompare(b.department));
    return result;
  }
}
