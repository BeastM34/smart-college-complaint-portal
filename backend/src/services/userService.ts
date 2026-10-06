import { SupabaseClient } from '@supabase/supabase-js';
import { SafeUserProfile, UserFilterQuery, UserRole, UserStatus } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UserService {
  /**
   * Transforms a database profile row into a safe user model with passwords/internals strictly omitted.
   */
  public static toSafeProfile(raw: any): SafeUserProfile {
    return {
      id: raw.id,
      name: raw.name || 'User',
      email: raw.email || '',
      role: (raw.role || 'student') as UserRole,
      student_id: raw.student_id || null,
      department: raw.department || null,
      designation: raw.designation || null,
      year: raw.year || null,
      phone: raw.phone || null,
      bio: raw.bio || null,
      avatar_url: raw.avatar_url || null,
      status: (raw.status || 'active') as UserStatus,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    };
  }

  /**
   * Lists users across campus (Admin-only).
   * Enforced under PostgreSQL Row Level Security (RLS).
   */
  public static async listUsers(
    client: SupabaseClient,
    filters: UserFilterQuery = {}
  ): Promise<{ users: SafeUserProfile[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, parseInt(String(filters.page || 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(filters.limit || 20), 10) || 20));
    const offset = (page - 1) * limit;

    let query = client.from('profiles').select('*', { count: 'exact' });

    if (filters.role && filters.role !== 'all') {
      const cleanRole = String(filters.role).trim().toLowerCase();
      if (['student', 'staff', 'admin'].includes(cleanRole)) {
        query = query.eq('role', cleanRole);
      }
    }

    if (filters.status && filters.status !== 'all') {
      const cleanStatus = String(filters.status).trim().toLowerCase();
      if (['active', 'inactive'].includes(cleanStatus)) {
        query = query.eq('status', cleanStatus);
      }
    }

    if (filters.department && filters.department !== 'all') {
      query = query.eq('department', String(filters.department).trim());
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,student_id.ilike.%${q}%,department.ilike.%${q}%`);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) {
      const err: any = new Error(error.message || 'Failed to list users.');
      err.statusCode = error.code === '42501' ? 403 : 500;
      throw err;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      users: (data || []).map((u) => this.toSafeProfile(u)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retrieves active staff members for assignment dropdowns.
   */
  public static async listStaff(
    client: SupabaseClient,
    activeOnly: boolean = true
  ): Promise<SafeUserProfile[]> {
    let query = client
      .from('profiles')
      .select('*')
      .eq('role', 'staff')
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('status', 'active');
    }

    const { data, error } = await query;
    if (error) {
      const err: any = new Error(error.message || 'Failed to retrieve staff directory.');
      err.statusCode = error.code === '42501' ? 403 : 500;
      throw err;
    }

    return (data || []).map((u) => this.toSafeProfile(u));
  }

  /**
   * Retrieves a single user profile (Admin or Self).
   */
  public static async getUserById(
    client: SupabaseClient,
    userId: string,
    requester: { id: string; role: string }
  ): Promise<SafeUserProfile | null> {
    const cleanId = userId.trim();
    if (!cleanId || !UUID_REGEX.test(cleanId)) {
      return null;
    }

    if (requester.role !== 'admin' && requester.id !== cleanId) {
      const err: any = new Error('Forbidden: You can only view your own profile.');
      err.statusCode = 403;
      throw err;
    }

    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.toSafeProfile(data);
  }

  /**
   * Toggles user account status (Admin-only).
   * Includes safeguards against self-deactivation and deactivating the last active administrator.
   */
  public static async toggleUserStatus(
    client: SupabaseClient,
    userId: string,
    requester: { id: string; role: string }
  ): Promise<SafeUserProfile> {
    const cleanId = userId.trim();
    if (!cleanId || !UUID_REGEX.test(cleanId)) {
      const err: any = new Error('Invalid user ID format.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Guard against self-deactivation
    if (requester.id === cleanId) {
      const err: any = new Error('You cannot deactivate your own account.');
      err.statusCode = 400;
      throw err;
    }

    // 2. Fetch target user
    const { data: targetUser, error: fetchErr } = await client
      .from('profiles')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (fetchErr || !targetUser) {
      const err: any = new Error(`User with ID "${userId}" not found.`);
      err.statusCode = 404;
      throw err;
    }

    const currentStatus = targetUser.status || 'active';
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

    // 3. Guard against deactivating the last active administrator
    if (nextStatus === 'inactive' && targetUser.role === 'admin') {
      const { data: activeAdmins, count } = await client
        .from('profiles')
        .select('id', { count: 'exact' })
        .eq('role', 'admin')
        .eq('status', 'active');

      const adminCount = count || (activeAdmins ? activeAdmins.length : 0);
      if (adminCount <= 1) {
        const err: any = new Error('Cannot deactivate the only remaining active administrator.');
        err.statusCode = 400;
        throw err;
      }
    }

    // 4. Update status
    const { data: updated, error: updateErr } = await client
      .from('profiles')
      .update({ status: nextStatus })
      .eq('id', cleanId)
      .select('*')
      .single();

    if (updateErr || !updated) {
      const err: any = new Error(updateErr?.message || 'Failed to update user status.');
      err.statusCode = updateErr?.code === '42501' ? 403 : 500;
      throw err;
    }

    return this.toSafeProfile(updated);
  }
}
