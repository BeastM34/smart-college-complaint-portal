import { getSupabaseAdmin, getSupabaseClient, createUserScopedSupabaseClient } from '../config/supabase';
import { UserProfile, UserRole, AuthSession, AuthResponseData } from '../types';

export interface RegisterStudentInput {
  email: string;
  password: string;
  name: string;
  studentId: string;
  department: string;
  year?: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ProvisionUserInput {
  email: string;
  password: string;
  name: string;
  role: 'staff' | 'admin';
  department?: string;
  designation?: string;
  phone?: string;
}

export class AuthService {
  /**
   * Registers a new student via Supabase Auth and establishes their initial student profile.
   * Strictly enforces role = 'student' and status = 'active'.
   */
  public static async signUpStudent(input: RegisterStudentInput): Promise<AuthResponseData> {
    const { email, password, name, studentId, department, year, phone } = input;

    // 1. Validation
    if (!email || !email.trim()) {
      throw new Error('Email address is required.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    if (!name || !name.trim()) {
      throw new Error('Full name is required.');
    }
    if (!studentId || !studentId.trim()) {
      throw new Error('Student ID is required.');
    }
    if (!department || !department.trim()) {
      throw new Error('Department is required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanStudentId = studentId.trim();

    // 2. Check for duplicate student_id in profiles before signup
    const supabaseAdmin = getSupabaseAdmin();
    const { data: existingStudentId } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('student_id', cleanStudentId)
      .limit(1)
      .maybeSingle();

    if (existingStudentId) {
      const err: any = new Error('A student profile with this Student ID is already registered.');
      err.statusCode = 409;
      throw err;
    }

    // 3. Register user with Supabase Auth (strictly assigning role = 'student' in metadata)
    const supabaseClient = getSupabaseClient();
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: name.trim(),
          student_id: cleanStudentId,
          department: department.trim(),
          role: 'student',
        },
      },
    });

    if (authError || !authData.user) {
      const status = authError?.message.includes('already registered') || authError?.status === 422 ? 409 : 400;
      const err: any = new Error(authError?.message || 'Failed to register account with Supabase Auth.');
      err.statusCode = status;
      throw err;
    }

    const authUser = authData.user;

    // 4. Create profile in public.profiles
    // If a session with access_token was returned, we use the user-scoped client to insert under RLS.
    // Otherwise (e.g. if email confirmation is required), fallback to admin client.
    const profilePayload = {
      id: authUser.id,
      name: name.trim(),
      email: cleanEmail,
      role: 'student' as UserRole, // Strictly student
      student_id: cleanStudentId,
      department: department.trim(),
      year: year?.trim() || '1st Year',
      phone: phone?.trim() || null,
      status: 'active' as const,
    };

    let profile: UserProfile | null = null;

    if (authData.session?.access_token) {
      try {
        const userClient = createUserScopedSupabaseClient(authData.session.access_token);
        const { data: insertedProfile, error: insertError } = await userClient
          .from('profiles')
          .insert(profilePayload)
          .select('*')
          .single();

        if (insertError) {
          // If insert fails with user client, fallback to admin client
          const { data: adminProfile } = await supabaseAdmin
            .from('profiles')
            .upsert(profilePayload, { onConflict: 'id' })
            .select('*')
            .single();
          profile = adminProfile;
        } else {
          profile = insertedProfile;
        }
      } catch {
        const { data: adminProfile } = await supabaseAdmin
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' })
          .select('*')
          .single();
        profile = adminProfile;
      }
    } else {
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' })
        .select('*')
        .single();
      profile = adminProfile;
    }

    let session: AuthSession | null = null;
    if (authData.session) {
      session = {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in,
        expires_at: authData.session.expires_at,
        token_type: authData.session.token_type,
      };
    }

    return {
      user: {
        id: authUser.id,
        email: authUser.email,
        user_metadata: authUser.user_metadata,
      },
      profile,
      session,
    };
  }

  /**
   * Authenticates user via Supabase Auth and retrieves their authoritative profile from public.profiles.
   */
  public static async signIn(input: LoginInput): Promise<AuthResponseData> {
    const { email, password } = input;

    if (!email || !email.trim()) {
      const err: any = new Error('Please enter your email address.');
      err.statusCode = 400;
      throw err;
    }

    if (!password || !password.trim()) {
      const err: any = new Error('Password is required.');
      err.statusCode = 400;
      throw err;
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabaseClient = getSupabaseClient();

    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      const err: any = new Error('Invalid email or password. Please verify your credentials.');
      err.statusCode = 401;
      throw err;
    }

    const authUser = authData.user;
    const session = authData.session;

    // Fetch authoritative profile using user-scoped client under RLS
    const userClient = createUserScopedSupabaseClient(session.access_token);
    let { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    // If not found via user client, query with admin as safe fallback
    if (!profile) {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();
      profile = adminProfile;
    }

    // Check account status: inactive accounts cannot login
    if (profile && profile.status === 'inactive') {
      try {
        await userClient.auth.signOut();
      } catch {
        // ignore signout errors
      }
      const err: any = new Error('Your account has been deactivated. Please contact an administrator.');
      err.statusCode = 403;
      throw err;
    }

    return {
      user: {
        id: authUser.id,
        email: authUser.email,
        user_metadata: authUser.user_metadata,
      },
      profile: profile || null,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
      },
    };
  }

  /**
   * Signs out user session.
   */
  public static async signOut(accessToken?: string): Promise<void> {
    if (!accessToken) return;
    try {
      const userClient = createUserScopedSupabaseClient(accessToken);
      await userClient.auth.signOut();
    } catch {
      // safe fallback
    }
  }

  /**
   * Validates access token and returns authenticated Supabase user.
   */
  public static async getAuthenticatedUser(accessToken: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data?.user) {
      return null;
    }
    return data.user;
  }

  /**
   * Retrieves profile by user ID.
   */
  public static async getUserProfile(userId: string, accessToken?: string): Promise<UserProfile | null> {
    if (accessToken) {
      try {
        const userClient = createUserScopedSupabaseClient(accessToken);
        const { data } = await userClient
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (data) return data;
      } catch {
        // fallback to admin query below
      }
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    return data || null;
  }

  /**
   * Refreshes an existing Supabase Auth session using a refresh token.
   */
  public static async refreshSession(refreshToken: string): Promise<AuthSession> {
    if (!refreshToken) {
      const err: any = new Error('Refresh token is required.');
      err.statusCode = 400;
      throw err;
    }

    const supabaseClient = getSupabaseClient();
    const { data, error } = await supabaseClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      const err: any = new Error(error?.message || 'Failed to refresh session.');
      err.statusCode = 401;
      throw err;
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at,
      token_type: data.session.token_type,
    };
  }

  /**
   * Privileged administrator helper to provision staff or administrator accounts.
   * Executes via server-side service_role (SUPABASE_SECRET_KEY).
   */
  public static async provisionStaffOrAdmin(
    callerToken: string,
    input: ProvisionUserInput
  ): Promise<UserProfile> {
    // 1. Verify caller is an administrator
    const caller = await this.getAuthenticatedUser(callerToken);
    if (!caller) {
      const err: any = new Error('Unauthorized: Invalid or expired administrator session.');
      err.statusCode = 401;
      throw err;
    }

    const callerProfile = await this.getUserProfile(caller.id, callerToken);
    if (!callerProfile || callerProfile.role !== 'admin') {
      const err: any = new Error('Forbidden: Only administrators can provision staff or administrator accounts.');
      err.statusCode = 403;
      throw err;
    }

    // 2. Validate input role
    if (input.role !== 'staff' && input.role !== 'admin') {
      const err: any = new Error('Invalid role specified. Role must be either "staff" or "admin".');
      err.statusCode = 400;
      throw err;
    }

    if (!input.email || !input.password || !input.name) {
      const err: any = new Error('Email, password, and name are required.');
      err.statusCode = 400;
      throw err;
    }

    const cleanEmail = input.email.trim().toLowerCase();
    const supabaseAdmin = getSupabaseAdmin();

    // 3. Create confirmed user in Supabase Auth via Admin API
    const { data: createdAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        name: input.name.trim(),
        role: input.role,
        department: input.department?.trim(),
      },
    });

    if (createError || !createdAuth.user) {
      const err: any = new Error(createError?.message || 'Failed to provision user in Supabase Auth.');
      err.statusCode = createError?.status === 422 ? 409 : 400;
      throw err;
    }

    const newUserId = createdAuth.user.id;

    // 4. Create profile with requested elevated role
    const profilePayload = {
      id: newUserId,
      name: input.name.trim(),
      email: cleanEmail,
      role: input.role,
      department: input.department?.trim() || null,
      designation: input.designation?.trim() || null,
      phone: input.phone?.trim() || null,
      status: 'active' as const,
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('*')
      .single();

    if (profileError || !profile) {
      const err: any = new Error(`Failed to create ${input.role} profile: ${profileError?.message}`);
      err.statusCode = 500;
      throw err;
    }

    return profile;
  }
}
