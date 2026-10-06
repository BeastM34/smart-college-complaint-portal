import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { AnalyticsFilterQuery } from '../types';

export class AnalyticsController {
  /**
   * Helper to extract validated filters from query string
   */
  private static extractFilters(req: Request): AnalyticsFilterQuery {
    return {
      range: typeof req.query.range === 'string' ? req.query.range : undefined,
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      department: typeof req.query.department === 'string' ? req.query.department : undefined,
    };
  }

  /**
   * GET /api/analytics
   * Comprehensive analytics payload
   */
  public static async getComprehensive(req: Request, res: Response): Promise<void> {
    try {
      const filters = AnalyticsController.extractFilters(req);
      const data = await AnalyticsService.getComprehensiveAnalytics(req.supabase!, filters);

      res.status(200).json({
        success: true,
        message: 'Comprehensive analytics retrieved successfully.',
        data,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve analytics.',
        error: err.message,
      });
    }
  }

  /**
   * GET /api/analytics/overview
   * High-level KPI overview
   */
  public static async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const filters = AnalyticsController.extractFilters(req);
      const full = await AnalyticsService.getComprehensiveAnalytics(req.supabase!, filters);

      const overview = {
        range: full.range,
        periodLabel: full.periodLabel,
        startDate: full.startDate,
        endDate: full.endDate,
        totalComplaints: full.totalComplaints,
        pendingComplaints: full.pendingComplaints,
        assignedComplaints: full.assignedComplaints,
        inProgressComplaints: full.inProgressComplaints,
        resolvedComplaints: full.resolvedComplaints,
        rejectedComplaints: full.rejectedComplaints,
        activeQueue: full.activeQueue,
        resolutionRate: full.resolutionRate,
        avgResolutionTimeHours: full.avgResolutionTimeHours,
        avgResolutionTimeFormatted: full.avgResolutionTimeFormatted,
      };

      res.status(200).json({
        success: true,
        message: 'Analytics overview retrieved successfully.',
        data: overview,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve analytics overview.',
        error: err.message,
      });
    }
  }

  /**
   * GET /api/analytics/complaints
   * Complaint breakdown across statuses and priorities
   */
  public static async getComplaints(req: Request, res: Response): Promise<void> {
    try {
      const filters = AnalyticsController.extractFilters(req);
      const full = await AnalyticsService.getComprehensiveAnalytics(req.supabase!, filters);

      res.status(200).json({
        success: true,
        message: 'Complaint metrics retrieved successfully.',
        data: {
          totalComplaints: full.totalComplaints,
          statusDistribution: full.statusDistribution,
          priorityDistribution: full.priorityDistribution,
        },
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve complaint metrics.',
        error: err.message,
      });
    }
  }

  /**
   * GET /api/analytics/trends
   * Chronological complaint submission and resolution trends
   */
  public static async getTrends(req: Request, res: Response): Promise<void> {
    try {
      const filters = AnalyticsController.extractFilters(req);
      const full = await AnalyticsService.getComprehensiveAnalytics(req.supabase!, filters);

      res.status(200).json({
        success: true,
        message: 'Trend analytics retrieved successfully.',
        data: {
          range: full.range,
          periodLabel: full.periodLabel,
          startDate: full.startDate,
          endDate: full.endDate,
          trendData: full.trendData,
        },
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve trend analytics.',
        error: err.message,
      });
    }
  }

  /**
   * GET /api/analytics/categories
   * Category breakdown and volume distributions
   */
  public static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const filters = AnalyticsController.extractFilters(req);
      const full = await AnalyticsService.getComprehensiveAnalytics(req.supabase!, filters);

      res.status(200).json({
        success: true,
        message: 'Category analytics retrieved successfully.',
        data: {
          totalComplaints: full.totalComplaints,
          categoryDistribution: full.categoryDistribution,
        },
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve category analytics.',
        error: err.message,
      });
    }
  }

  /**
   * GET /api/analytics/performance
   * Department performance metrics
   */
  public static async getPerformance(req: Request, res: Response): Promise<void> {
    try {
      const filters = AnalyticsController.extractFilters(req);
      const full = await AnalyticsService.getComprehensiveAnalytics(req.supabase!, filters);

      res.status(200).json({
        success: true,
        message: 'Department performance analytics retrieved successfully.',
        data: {
          departmentPerformance: full.departmentPerformance,
          avgResolutionTimeHours: full.avgResolutionTimeHours,
          avgResolutionTimeFormatted: full.avgResolutionTimeFormatted,
        },
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve performance analytics.',
        error: err.message,
      });
    }
  }
}
