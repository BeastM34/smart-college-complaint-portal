import { Request, Response } from 'express';
import { UserService } from '../services/userService';
import { UserFilterQuery } from '../types';

export class UserController {
  /**
   * GET /api/users
   * User directory across campus (Admin-only)
   */
  public static async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const filters: UserFilterQuery = {
        role: typeof req.query.role === 'string' ? req.query.role : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        department: typeof req.query.department === 'string' ? req.query.department : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        page: typeof req.query.page === 'string' ? req.query.page : undefined,
        limit: typeof req.query.limit === 'string' ? req.query.limit : undefined,
      };

      const result = await UserService.listUsers(req.supabase!, filters);

      res.status(200).json({
        success: true,
        message: 'Users retrieved successfully.',
        data: result.users,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve users.',
        error: err.message,
      });
    }
  }

  /**
   * GET /api/users/staff
   * List active staff members for assignment dropdowns (Staff & Admin)
   */
  public static async getStaff(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.activeOnly !== 'false';
      const staff = await UserService.listStaff(req.supabase!, activeOnly);

      res.status(200).json({
        success: true,
        message: 'Staff directory retrieved successfully.',
        data: staff,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve staff directory.',
        error: err.message,
      });
    }
  }

  /**
   * GET /api/users/:id
   * Retrieve user profile (Admin or Self)
   */
  public static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const requester = {
        id: req.user!.id,
        role: req.profile?.role || 'student',
      };

      const user = await UserService.getUserById(req.supabase!, id, requester);

      if (!user) {
        res.status(404).json({
          success: false,
          message: `User with ID "${id}" not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User profile retrieved successfully.',
        data: user,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve user profile.',
        error: err.message,
      });
    }
  }

  /**
   * PATCH /api/users/:id/status
   * Toggle user account status (Admin-only)
   */
  public static async toggleUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const requester = {
        id: req.user!.id,
        role: req.profile?.role || 'student',
      };

      const updated = await UserService.toggleUserStatus(req.supabase!, id, requester);

      res.status(200).json({
        success: true,
        message: `User account is now ${updated.status}.`,
        data: updated,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to update user status.',
        error: err.message,
      });
    }
  }
}
