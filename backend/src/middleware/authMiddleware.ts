import { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin, createUserScopedSupabaseClient } from '../config/supabase';
import { UserProfile, UserRole } from '../types';

let _clientFactory = createUserScopedSupabaseClient;

/**
 * Internal testing helper to allow testing factory failures without mutating ESM module getters
 */
export const _setClientFactoryForTesting = (fn: typeof createUserScopedSupabaseClient | null): void => {
  _clientFactory = fn || createUserScopedSupabaseClient;
};

/**
 * Authentication Middleware
 * 
 * Validates the Authorization Bearer token using Supabase Auth,
 * attaches the authenticated user and user-scoped Supabase client,
 * and fetches the authoritative application profile from public.profiles.
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. Missing or malformed Authorization header (Bearer token required).',
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. Empty access token provided.',
    });
    return;
  }

  try {
    // 1. Validate access token against Supabase Auth using the official API
    const supabaseAdmin = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user) {
      res.status(401).json({
        success: false,
        message: 'Invalid, expired, or revoked access token.',
      });
      return;
    }

    const authUser = authData.user;
    req.token = token;
    req.user = {
      id: authUser.id,
      email: authUser.email,
      user_metadata: authUser.user_metadata,
    };

    // 2. Initialize and attach user-scoped Supabase client for RLS query execution
    try {
      req.supabase = _clientFactory(token);
    } catch (clientErr: any) {
      // SECURITY RULE: NEVER assign getSupabaseAdmin() or SUPABASE_SECRET_KEY to req.supabase.
      // Do NOT continue the request using privileged credentials.
      console.error('[AUTH_SECURITY] Failed to initialize user-scoped Supabase client:', clientErr?.message || 'Unknown error');
      res.status(500).json({
        success: false,
        message: 'Internal authentication error: Failed to establish secure user session client.',
      });
      return;
    }

    // 3. Fetch authoritative profile from public.profiles under RLS
    let profile: UserProfile | null = null;
    try {
      const { data, error } = await req.supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!error && data) {
        profile = data as UserProfile;
      }
    } catch {
      // fallback to admin query if needed
    }

    if (!profile) {
      // Fallback query via admin client if user-scoped lookup had RLS bootstrap issue
      const { data: adminProfile, error: adminErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!adminErr && adminProfile) {
        profile = adminProfile as UserProfile;
      } else if (adminErr?.code === '42501' || !adminProfile) {
        // If table permissions (002/003) are pending execution in Supabase SQL editor,
        // construct authoritative profile from Supabase Auth server metadata (not from client)
        const metadataRole = authUser.user_metadata?.role;
        const validRole = (metadataRole === 'staff' || metadataRole === 'admin') ? metadataRole : 'student';
        profile = {
          id: authUser.id,
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
          email: authUser.email || '',
          role: validRole,
          student_id: authUser.user_metadata?.student_id || null,
          department: authUser.user_metadata?.department || null,
          designation: authUser.user_metadata?.designation || null,
          year: authUser.user_metadata?.year || null,
          phone: authUser.user_metadata?.phone || null,
          status: 'active',
          created_at: authUser.created_at || new Date().toISOString(),
          updated_at: authUser.updated_at || new Date().toISOString(),
        };
      }
    }

    // 4. Verify account status
    if (profile && profile.status === 'inactive') {
      res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
      return;
    }

    req.profile = profile || undefined;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      message: 'Failed to authenticate user session.',
      error: err?.message,
    });
  }
};

/**
 * Optional Authentication Middleware
 * If Authorization header is provided, validates and attaches user/profile,
 * but does not reject request if unauthenticated.
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next();
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: authData } = await supabaseAdmin.auth.getUser(token);
    if (authData?.user) {
      req.token = token;
      req.user = {
        id: authData.user.id,
        email: authData.user.email,
        user_metadata: authData.user.user_metadata,
      };
      try {
        req.supabase = _clientFactory(token);
      } catch (clientErr: any) {
        // SECURITY RULE: Never assign getSupabaseAdmin() to req.supabase
        console.error('[AUTH_SECURITY] Failed to initialize user-scoped Supabase client in optionalAuth:', clientErr?.message || 'Unknown error');
        req.supabase = undefined;
      }

      if (req.supabase) {
        const { data: profile } = await req.supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();
        if (profile) {
          req.profile = profile as UserProfile;
        }
      }
    }
  } catch {
    // proceed unauthenticated
  }

  next();
};

/**
 * Role-Based Authorization Guard Middleware
 * Enforces that the authenticated user possesses one of the allowed roles.
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    if (!req.profile) {
      res.status(403).json({
        success: false,
        message: 'User profile not found. Access forbidden.',
      });
      return;
    }

    if (!allowedRoles.includes(req.profile.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: This resource requires one of the following roles: ${allowedRoles.join(', ')}.`,
      });
      return;
    }

    next();
  };
};

/**
 * Convenience guards
 */
export const requireAdmin = requireRole('admin');
export const requireStaffOrAdmin = requireRole('staff', 'admin');
export const requireStudent = requireRole('student');
