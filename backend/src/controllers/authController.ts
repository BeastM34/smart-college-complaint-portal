import { Request, Response } from 'express';
import { AuthService } from '../services/authService';

export class AuthController {
  /**
   * POST /api/auth/signup
   * Student self-registration endpoint.
   * Strictly disallows self-assignment of staff or admin roles.
   */
  public static async signup(req: Request, res: Response): Promise<void> {
    const { email, password, name, studentId, department, year, phone, role } = req.body;

    // Strict security check: non-admins cannot self-assign staff or admin
    if (role && role !== 'student') {
      res.status(400).json({
        success: false,
        message: 'Unauthorized role request: Self-registration is strictly restricted to student accounts. Staff and administrator accounts must be provisioned by an administrator.',
      });
      return;
    }

    if (!email || !password || !name || !studentId || !department) {
      res.status(400).json({
        success: false,
        message: 'Missing required registration fields (email, password, name, studentId, department required).',
      });
      return;
    }

    try {
      const result = await AuthService.signUpStudent({
        email,
        password,
        name,
        studentId,
        department,
        year,
        phone,
      });

      res.status(201).json({
        success: true,
        message: 'Student account registered successfully.',
        data: result,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Registration failed.',
      });
    }
  }

  /**
   * POST /api/auth/login
   * Authenticates user via Supabase Auth and returns active session + profile.
   */
  public static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
      return;
    }

    try {
      const result = await AuthService.signIn({ email, password });

      res.status(200).json({
        success: true,
        message: 'Authenticated successfully.',
        data: result,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 401;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Authentication failed.',
      });
    }
  }

  /**
   * POST /api/auth/logout
   * Invalidates authenticated user session.
   */
  public static async logout(req: Request, res: Response): Promise<void> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : req.token;

    try {
      if (token) {
        await AuthService.signOut(token);
      }

      res.status(200).json({
        success: true,
        message: 'Signed out successfully.',
      });
    } catch (err: any) {
      res.status(200).json({
        success: true,
        message: 'Signed out successfully.',
      });
    }
  }

  /**
   * GET /api/auth/me
   * Returns authenticated user identity and authoritative application profile.
   */
  public static async me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    if (!req.profile) {
      res.status(404).json({
        success: false,
        message: 'User profile not found. Please complete profile registration.',
        data: {
          user: req.user,
          profile: null,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Authenticated profile retrieved successfully.',
      data: {
        user: req.user,
        profile: req.profile,
      },
    });
  }

  /**
   * POST /api/auth/refresh
   * Refreshes active session using Supabase Auth refresh token.
   */
  public static async refresh(req: Request, res: Response): Promise<void> {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({
        success: false,
        message: 'Missing refresh_token parameter.',
      });
      return;
    }

    try {
      const session = await AuthService.refreshSession(refresh_token);

      res.status(200).json({
        success: true,
        message: 'Session refreshed successfully.',
        data: {
          session,
        },
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 401;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to refresh session.',
      });
    }
  }

  /**
   * POST /api/auth/provision
   * Administrator-only endpoint to provision staff or admin accounts.
   */
  public static async provision(req: Request, res: Response): Promise<void> {
    const callerToken = req.token;
    if (!callerToken) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const { email, password, name, role, department, designation, phone } = req.body;

    if (!email || !password || !name || !role) {
      res.status(400).json({
        success: false,
        message: 'Email, password, name, and role are required.',
      });
      return;
    }

    if (role !== 'staff' && role !== 'admin') {
      res.status(400).json({
        success: false,
        message: 'Role must be either "staff" or "admin".',
      });
      return;
    }

    try {
      const profile = await AuthService.provisionStaffOrAdmin(callerToken, {
        email,
        password,
        name,
        role,
        department,
        designation,
        phone,
      });

      res.status(201).json({
        success: true,
        message: `${role.toUpperCase()} account provisioned successfully.`,
        data: {
          profile,
        },
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to provision account.',
      });
    }
  }
}
