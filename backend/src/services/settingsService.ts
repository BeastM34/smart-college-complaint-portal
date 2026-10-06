import { SupabaseClient } from '@supabase/supabase-js';
import { SystemSettings, UpdateSystemSettingsInput, ComplaintPriority } from '../types';
import { getSupabaseAdmin } from '../config/supabase';

const VALID_PRIORITIES: ComplaintPriority[] = ['low', 'medium', 'high', 'critical'];

const SAFE_SETTING_KEYS: (keyof SystemSettings)[] = [
  'portal_name',
  'academic_year',
  'allow_student_registration',
  'email_notifications',
  'sms_notifications',
  'push_notifications',
  'student_notifications',
  'maintenance_mode',
  'auto_assign_complaints',
  'default_priority',
  'allow_reopening',
  'allow_anonymous_complaints',
  'max_attachments_per_complaint',
  'max_attachment_size_mb',
  'support_email',
  'support_phone',
];

export class SettingsService {
  /**
   * Retrieves singleton system settings under Row Level Security.
   * Exposes only safe, whitelisted configuration keys.
   */
  public static async getSettings(client: SupabaseClient): Promise<SystemSettings> {
    const { data, error } = await client
      .from('system_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      const err: any = new Error(error.message || 'Failed to retrieve system settings.');
      err.statusCode = error.code === '42501' ? 403 : 500;
      throw err;
    }

    if (!data) {
      // Initialize default settings singleton if missing
      const admin = getSupabaseAdmin();
      const defaultSettings = {
        id: 1,
        portal_name: 'Smart College Complaint Portal',
        academic_year: '2026-2027',
        allow_student_registration: true,
        email_notifications: true,
        sms_notifications: false,
        push_notifications: true,
        student_notifications: true,
        maintenance_mode: false,
        auto_assign_complaints: false,
        default_priority: 'medium',
        allow_reopening: true,
        allow_anonymous_complaints: false,
        max_attachments_per_complaint: 3,
        max_attachment_size_mb: 5.0,
        support_email: 'helpdesk@college.edu',
        support_phone: '+1 (800) 555-CAMPUS',
      };

      const { data: created, error: createErr } = await admin
        .from('system_settings')
        .upsert(defaultSettings)
        .select('*')
        .single();

      if (createErr || !created) {
        throw new Error('System settings table is uninitialized.');
      }
      return this.sanitizeSettings(created);
    }

    return this.sanitizeSettings(data);
  }

  /**
   * Retrieves a single whitelisted setting by key.
   */
  public static async getSettingByKey(
    client: SupabaseClient,
    key: string
  ): Promise<{ key: string; value: any }> {
    const canonicalKey = this.normalizeKey(key);
    if (!canonicalKey || !SAFE_SETTING_KEYS.includes(canonicalKey as keyof SystemSettings)) {
      const err: any = new Error(`Setting key "${key}" not found or access is restricted.`);
      err.statusCode = 404;
      throw err;
    }

    const settings = await this.getSettings(client);
    return {
      key: canonicalKey,
      value: (settings as any)[canonicalKey],
    };
  }

  /**
   * Updates system settings (Admin-only).
   * Validates values strictly and protects against unauthorized configuration tampering.
   */
  public static async updateSettings(
    client: SupabaseClient,
    input: UpdateSystemSettingsInput
  ): Promise<SystemSettings> {
    const cleanPayload: Record<string, any> = {};

    if (input.portal_name !== undefined) {
      const val = String(input.portal_name).trim();
      if (!val) throw this.badRequest('Portal name cannot be empty.');
      if (val.length > 150) throw this.badRequest('Portal name cannot exceed 150 characters.');
      cleanPayload.portal_name = val;
    }

    if (input.academic_year !== undefined) {
      const val = String(input.academic_year).trim();
      if (!val) throw this.badRequest('Academic year cannot be empty.');
      cleanPayload.academic_year = val;
    }

    if (input.support_email !== undefined) {
      const val = String(input.support_email).trim();
      if (!val || !val.includes('@')) throw this.badRequest('Valid support email address is required.');
      cleanPayload.support_email = val;
    }

    if (input.support_phone !== undefined) {
      cleanPayload.support_phone = String(input.support_phone).trim();
    }

    if (input.default_priority !== undefined) {
      const val = String(input.default_priority).toLowerCase() as ComplaintPriority;
      if (!VALID_PRIORITIES.includes(val)) {
        throw this.badRequest(`Invalid default priority "${input.default_priority}". Allowed: low, medium, high, critical.`);
      }
      cleanPayload.default_priority = val;
    }

    if (input.max_attachments_per_complaint !== undefined) {
      const val = Number(input.max_attachments_per_complaint);
      if (isNaN(val) || !Number.isInteger(val) || val < 1 || val > 10) {
        throw this.badRequest('Maximum attachments per complaint must be an integer between 1 and 10.');
      }
      cleanPayload.max_attachments_per_complaint = val;
    }

    if (input.max_attachment_size_mb !== undefined) {
      const val = Number(input.max_attachment_size_mb);
      if (isNaN(val) || !Number.isFinite(val) || val <= 0 || val > 50) {
        throw this.badRequest('Maximum attachment size must be a number between 0.1 MB and 50 MB.');
      }
      cleanPayload.max_attachment_size_mb = Math.min(Math.round(val * 10) / 10, 50);
    }

    // Boolean settings
    const booleanKeys: (keyof SystemSettings)[] = [
      'allow_student_registration',
      'email_notifications',
      'sms_notifications',
      'push_notifications',
      'student_notifications',
      'maintenance_mode',
      'auto_assign_complaints',
      'allow_reopening',
      'allow_anonymous_complaints',
    ];

    for (const bKey of booleanKeys) {
      const val = (input as any)[bKey];
      if (val !== undefined) {
        if (typeof val !== 'boolean') {
          throw this.badRequest(`Setting "${bKey}" must be a boolean.`);
        }
        cleanPayload[bKey] = val;
      }
    }

    if (Object.keys(cleanPayload).length === 0) {
      return this.getSettings(client);
    }

    const { data: updated, error } = await client
      .from('system_settings')
      .update(cleanPayload)
      .eq('id', 1)
      .select('*')
      .single();

    if (error || !updated) {
      const err: any = new Error(error?.message || 'Failed to update system settings.');
      err.statusCode = error?.code === '42501' ? 403 : 500;
      throw err;
    }

    return this.sanitizeSettings(updated);
  }

  /**
   * Updates a single setting by key (Admin-only).
   */
  public static async updateSettingByKey(
    client: SupabaseClient,
    key: string,
    value: any
  ): Promise<{ key: string; value: any; settings: SystemSettings }> {
    const canonicalKey = this.normalizeKey(key);
    if (!canonicalKey || !SAFE_SETTING_KEYS.includes(canonicalKey as keyof SystemSettings)) {
      const err: any = new Error(`Setting key "${key}" is invalid or restricted.`);
      err.statusCode = 400;
      throw err;
    }

    const payload: UpdateSystemSettingsInput = {
      [canonicalKey]: value,
    };

    const updated = await this.updateSettings(client, payload);
    return {
      key: canonicalKey,
      value: (updated as any)[canonicalKey],
      settings: updated,
    };
  }

  /**
   * Normalizes keys from camelCase to snake_case if necessary
   */
  private static normalizeKey(key: string): string {
    const clean = key.trim();
    const mapping: Record<string, string> = {
      portalName: 'portal_name',
      academicYear: 'academic_year',
      allowStudentRegistration: 'allow_student_registration',
      emailNotifications: 'email_notifications',
      smsNotifications: 'sms_notifications',
      pushNotifications: 'push_notifications',
      studentNotifications: 'student_notifications',
      maintenanceMode: 'maintenance_mode',
      autoAssignComplaints: 'auto_assign_complaints',
      defaultPriority: 'default_priority',
      allowReopening: 'allow_reopening',
      allowAnonymousComplaints: 'allow_anonymous_complaints',
      maxAttachmentsPerComplaint: 'max_attachments_per_complaint',
      maxAttachmentSizeMB: 'max_attachment_size_mb',
      maxAttachmentSizeMb: 'max_attachment_size_mb',
      supportEmail: 'support_email',
      supportPhone: 'support_phone',
    };
    return mapping[clean] || clean;
  }

  /**
   * Strict whitelist filter ensuring no server credentials or internal state can ever leak
   */
  private static sanitizeSettings(raw: any): SystemSettings {
    return {
      id: 1,
      portal_name: String(raw.portal_name || 'Smart College Complaint Portal'),
      academic_year: String(raw.academic_year || '2026-2027'),
      allow_student_registration: Boolean(raw.allow_student_registration),
      email_notifications: Boolean(raw.email_notifications),
      sms_notifications: Boolean(raw.sms_notifications),
      push_notifications: Boolean(raw.push_notifications),
      student_notifications: Boolean(raw.student_notifications),
      maintenance_mode: Boolean(raw.maintenance_mode),
      auto_assign_complaints: Boolean(raw.auto_assign_complaints),
      default_priority: (raw.default_priority || 'medium') as ComplaintPriority,
      allow_reopening: Boolean(raw.allow_reopening),
      allow_anonymous_complaints: Boolean(raw.allow_anonymous_complaints),
      max_attachments_per_complaint: Number(raw.max_attachments_per_complaint || 3),
      max_attachment_size_mb: Number(raw.max_attachment_size_mb || 5.0),
      support_email: String(raw.support_email || 'helpdesk@college.edu'),
      support_phone: String(raw.support_phone || '+1 (800) 555-CAMPUS'),
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    };
  }

  private static badRequest(message: string): Error {
    const err: any = new Error(message);
    err.statusCode = 400;
    return err;
  }
}
