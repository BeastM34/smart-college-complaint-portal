-- ==============================================================================
-- Smart College Complaint Portal - Phase 2A Seed Data
-- Safe initial non-sensitive seed data (Categories & Default Settings)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Initial Categories
-- ------------------------------------------------------------------------------
INSERT INTO categories (name, slug, description, icon, sla_hours, active)
VALUES
  (
    'Hostel Maintenance',
    'hostel',
    'Issues with plumbing, room furniture, water supply, and washrooms in student dorms.',
    'Building',
    24,
    TRUE
  ),
  (
    'Electrical & Power',
    'electrical',
    'Power outages, broken switches, fan repairs, and lighting failures.',
    'Zap',
    12,
    TRUE
  ),
  (
    'Campus Infrastructure',
    'infrastructure',
    'Classroom benches, projectors, damaged pathways, elevator malfunctions.',
    'Wrench',
    48,
    TRUE
  ),
  (
    'Sanitation & Hygiene',
    'sanitation',
    'Trash collection, restroom cleaning, pest control, and common area hygiene.',
    'Trash2',
    12,
    TRUE
  ),
  (
    'Academic Facilities & Labs',
    'academic',
    'Lab computers, laboratory equipment, chemistry bench gas/water lines.',
    'GraduationCap',
    36,
    TRUE
  ),
  (
    'Library & Reading Rooms',
    'library',
    'Air conditioning, noise issues, digital terminal access, seat reservation.',
    'BookOpen',
    24,
    TRUE
  ),
  (
    'Canteen & Food Services',
    'canteen',
    'Food hygiene, billing issues, cafeteria seating, water dispensers.',
    'Utensils',
    24,
    TRUE
  ),
  (
    'Campus Transport',
    'transport',
    'Shuttle bus scheduling, campus bicycle stands, parking facilities.',
    'Bus',
    48,
    TRUE
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sla_hours = EXCLUDED.sla_hours,
  active = EXCLUDED.active,
  updated_at = NOW();

-- ------------------------------------------------------------------------------
-- 2. Initial System Settings Singleton
-- ------------------------------------------------------------------------------
INSERT INTO system_settings (
  id,
  portal_name,
  academic_year,
  allow_student_registration,
  email_notifications,
  sms_notifications,
  push_notifications,
  student_notifications,
  maintenance_mode,
  auto_assign_complaints,
  default_priority,
  allow_reopening,
  allow_anonymous_complaints,
  max_attachments_per_complaint,
  max_attachment_size_mb,
  support_email,
  support_phone
)
VALUES (
  1,
  'Smart College Complaint Portal',
  '2026-2027',
  TRUE,
  TRUE,
  FALSE,
  TRUE,
  TRUE,
  FALSE,
  FALSE,
  'medium',
  TRUE,
  FALSE,
  3,
  5.0,
  'helpdesk@college.edu',
  '+1 (800) 555-CAMPUS'
)
ON CONFLICT (id) DO UPDATE
SET
  portal_name = EXCLUDED.portal_name,
  academic_year = EXCLUDED.academic_year,
  updated_at = NOW();
