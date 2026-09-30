import type { AnalyticsSummary } from '@/types';
import { STORAGE_KEYS, getStorageItem } from '@/utils/storage';
import { MOCK_ANALYTICS, MOCK_COMPLAINTS } from '@/data/mockData';
import type { Complaint } from '@/types';

/**
 * Analytics Service
 * Computes summaries, metrics, and KPI data from complaints.
 */
class AnalyticsService {
  public async getSummary(): Promise<AnalyticsSummary> {
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);

    // Compute live metrics if complaints exist
    if (complaints && complaints.length > 0) {
      const summary: AnalyticsSummary = {
        totalComplaints: complaints.length,
        pendingComplaints: complaints.filter((c) => c.status === 'pending').length,
        assignedComplaints: complaints.filter((c) => c.status === 'assigned').length,
        inProgressComplaints: complaints.filter((c) => c.status === 'in_progress').length,
        resolvedComplaints: complaints.filter((c) => c.status === 'resolved').length,
        rejectedComplaints: complaints.filter((c) => c.status === 'rejected').length,
        avgResolutionTimeHours: MOCK_ANALYTICS.avgResolutionTimeHours,
        complaintsByCategory: {},
        complaintsByPriority: {
          low: complaints.filter((c) => c.priority === 'low').length,
          medium: complaints.filter((c) => c.priority === 'medium').length,
          high: complaints.filter((c) => c.priority === 'high').length,
          critical: complaints.filter((c) => c.priority === 'critical').length,
        },
        monthlyTrends: MOCK_ANALYTICS.monthlyTrends,
      };

      complaints.forEach((c) => {
        summary.complaintsByCategory[c.category] =
          (summary.complaintsByCategory[c.category] || 0) + 1;
      });

      return summary;
    }

    return MOCK_ANALYTICS;
  }
}

export const analyticsService = new AnalyticsService();
