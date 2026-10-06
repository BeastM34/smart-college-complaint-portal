-- ==============================================================================
-- Smart College Complaint Portal - Phase 2A Initial Relational Schema
-- Database: Supabase PostgreSQL
-- ==============================================================================

-- Enable UUID extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Helper Functions & Triggers
-- ------------------------------------------------------------------------------

-- Generic updated_at timestamp refresher
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sequential Ticket Number Generator Sequence
CREATE SEQUENCE IF NOT EXISTS complaint_ticket_seq START WITH 1001;

-- Automatic ticket number generator: TKT-YYYY-XXXX (e.g. TKT-2026-1001)
CREATE OR REPLACE FUNCTION generate_complaint_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR TRIM(NEW.ticket_number) = '' THEN
    NEW.ticket_number := 'TKT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('complaint_ticket_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. Profiles (Application Users)
-- Corresponds to Supabase auth.users.id
-- No passwords or credential hashes stored here (Supabase Auth owns authentication).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('student', 'staff', 'admin')),
  student_id TEXT,
  department TEXT,
  designation TEXT,
  year TEXT,
  phone TEXT,
  bio TEXT,
  avatar_url TEXT,
  preferences JSONB NOT NULL DEFAULT '{"theme": "system", "emailAlerts": true, "statusChangeAlerts": true, "assignmentAlerts": true, "digestSummary": false}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_profiles_auth_users FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_student_id ON profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 3. Categories (Complaint Categories & SLA Policies)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  sla_hours INTEGER NOT NULL DEFAULT 48 CHECK (sla_hours > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);

CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 4. Complaints (Primary Grievance Entity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  category_slug TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'rejected')),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department TEXT,
  building TEXT,
  floor TEXT,
  room_number TEXT,
  location TEXT,
  additional_details TEXT,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_department TEXT,
  estimated_resolution_date TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  satisfaction_rating TEXT CHECK (satisfaction_rating IS NULL OR satisfaction_rating IN ('satisfied', 'not_satisfied')),
  satisfaction_feedback TEXT,
  satisfaction_submitted_at TIMESTAMPTZ,
  reopen_reason TEXT,
  reopened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_ticket_number ON complaints(ticket_number);
CREATE INDEX IF NOT EXISTS idx_complaints_student_id ON complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_to ON complaints(assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaints_category_id ON complaints(category_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at);

-- Attach automatic ticket number generation trigger
CREATE TRIGGER trg_complaints_ticket_number
BEFORE INSERT ON complaints
FOR EACH ROW EXECUTE FUNCTION generate_complaint_ticket_number();

CREATE TRIGGER trg_complaints_updated_at
BEFORE UPDATE ON complaints
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 5. Complaint Comments (Public Dialogue & Internal Administrative Notes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaint_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_comments_complaint_id ON complaint_comments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_comments_author_id ON complaint_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_complaint_comments_created_at ON complaint_comments(created_at);

-- ------------------------------------------------------------------------------
-- 6. Complaint Timeline (Chronological Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaint_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'rejected')),
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  updated_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_timeline_complaint_id ON complaint_timeline(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_timeline_created_at ON complaint_timeline(created_at);

-- ------------------------------------------------------------------------------
-- 7. Complaint Attachments (File Metadata for Supabase Storage in Phase 2B)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaint_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_attachments_complaint_id ON complaint_attachments(complaint_id);

-- ------------------------------------------------------------------------------
-- 8. Notifications (User In-Portal Alerts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  category TEXT,
  complaint_id UUID REFERENCES complaints(id) ON DELETE SET NULL,
  broadcast_id UUID,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ------------------------------------------------------------------------------
-- 9. Broadcast Notifications (Administrative Campus Announcements)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('all_students', 'department', 'student')),
  target_department TEXT,
  target_student_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'info' CHECK (priority IN ('info', 'warning', 'error')),
  sent_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('delivered', 'failed')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_notifications_sent_at ON broadcast_notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_broadcast_notifications_audience ON broadcast_notifications(audience);

-- ------------------------------------------------------------------------------
-- 10. System Settings (Singleton Configuration Table)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  portal_name TEXT NOT NULL DEFAULT 'Smart College Complaint Portal',
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  allow_student_registration BOOLEAN NOT NULL DEFAULT TRUE,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  sms_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  student_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  auto_assign_complaints BOOLEAN NOT NULL DEFAULT FALSE,
  default_priority TEXT NOT NULL DEFAULT 'medium' CHECK (default_priority IN ('low', 'medium', 'high', 'critical')),
  allow_reopening BOOLEAN NOT NULL DEFAULT TRUE,
  allow_anonymous_complaints BOOLEAN NOT NULL DEFAULT FALSE,
  max_attachments_per_complaint INTEGER NOT NULL DEFAULT 3 CHECK (max_attachments_per_complaint >= 1 AND max_attachments_per_complaint <= 10),
  max_attachment_size_mb NUMERIC(4, 1) NOT NULL DEFAULT 5.0 CHECK (max_attachment_size_mb > 0 AND max_attachment_size_mb <= 50),
  support_email TEXT NOT NULL DEFAULT 'helpdesk@college.edu',
  support_phone TEXT NOT NULL DEFAULT '+1 (800) 555-CAMPUS',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 11. Schema Permissions for PostgREST (service_role only before Phase 2C RLS)
-- ------------------------------------------------------------------------------
-- Grants schema privileges exclusively to service_role for backend operations.
-- Broad access to anon/authenticated is deliberately omitted until Phase 2C RLS.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;


