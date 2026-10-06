import { Request, Response } from 'express';
import { NotificationService } from '../services/notificationService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class NotificationController {
  /**
   * GET /api/notifications
   * Retrieves paginated notifications belonging to the authenticated user under RLS.
   */
  public static async getNotifications(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    const { read, type, page, limit } = req.query;

    try {
      const result = await NotificationService.listNotifications(
        req.supabase,
        req.user.id,
        {
          read: typeof read === 'string' ? read : undefined,
          type: typeof type === 'string' ? type : undefined,
          page: typeof page === 'string' || typeof page === 'number' ? page : undefined,
          limit: typeof limit === 'string' || typeof limit === 'number' ? limit : undefined,
        }
      );

      res.status(200).json({
        success: true,
        data: result.notifications,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to retrieve notifications.',
      });
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Marks a single notification as read if it belongs to the authenticated user.
   */
  public static async markAsRead(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
      return;
    }

    try {
      const updated = await NotificationService.markAsRead(req.supabase, id, req.user.id);

      if (!updated) {
        res.status(404).json({
          success: false,
          message: 'Notification not found.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Notification marked as read.',
        data: updated,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to mark notification as read.',
      });
    }
  }

  /**
   * PATCH /api/notifications/read-all
   * Marks all unread notifications belonging to the authenticated user as read.
   */
  public static async markAllAsRead(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    try {
      const result = await NotificationService.markAllAsRead(req.supabase, req.user.id);

      res.status(200).json({
        success: true,
        message: 'All unread notifications marked as read.',
        data: {
          updatedCount: result.updatedCount,
        },
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to mark all notifications as read.',
      });
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Retrieves the count of unread notifications belonging to the caller.
   */
  public static async getUnreadCount(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    try {
      const count = await NotificationService.getUnreadCount(req.supabase, req.user.id);

      res.status(200).json({
        success: true,
        data: {
          count,
        },
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to retrieve unread notification count.',
      });
    }
  }
}
