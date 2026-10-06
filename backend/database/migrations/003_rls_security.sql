-- ==============================================================================
-- Smart College Complaint Portal - Migration 003: Row Level Security (RLS) & Policies
-- Database: Supabase PostgreSQL
--
-- SECURITY ARCHITECTURE:
-- 1. Default-Deny: RLS enabled on all 9 application tables.
-- 2. Role Model: auth.uid() -> profiles.id -> profiles.role ('student', 'staff', 'admin').
-- 3. Recursion-Proof: Helper functions use SECURITY DEFINER with fixed search_path.
-- 4. Server-Side Bypass: service_role (SUPABASE_SECRET_KEY) bypasses RLS for trusted operations.
-- 5. Zero Anon Privileges: The 'anon' role is granted no table-level permissions.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Functions (Recursion-Safe Role Lookups)
-- ------------------------------------------------------------------------------

-- Returns current authenticated user's application role ('student', 'staff', 'admin', or NULL)
-- Uses SECURITY DEFINER to bypass RLS on profiles, preventing recursive policy evaluation.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid()
    AND status = 'active';

  RETURN v_role;
END;
$$;

-- Helper boolean functions for clean, readable policy expressions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT (public.get_current_user_role() = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT (public.get_current_user_role() = 'staff');
$$;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT (public.get_current_user_role() = 'student');
$$;

-- Restrict function execution: only authenticated and service_role may call role helpers
REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_student() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Integrity Protection Triggers (Defense-in-Depth against Privilege Escalation)
-- ------------------------------------------------------------------------------

-- Trigger function: Prevents non-admin authenticated users from altering privileged profile fields
CREATE OR REPLACE FUNCTION public.prevent_profile_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Unauthorized: Account role cannot be modified by non-administrators.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Unauthorized: Account status cannot be modified by non-administrators.';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Unauthorized: User identifier cannot be altered.';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Unauthorized: Email address cannot be modified directly via profile update.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_escalation();

-- Trigger function: Prevents unauthorized modification of complaint ownership and assignment
CREATE OR REPLACE FUNCTION public.prevent_complaint_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    -- Student restrictions
    IF public.get_current_user_role() = 'student' THEN
      IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
        RAISE EXCEPTION 'Unauthorized: Cannot reassign complaint ownership (student_id).';
      END IF;
      IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
        RAISE EXCEPTION 'Unauthorized: Students cannot modify assigned staff.';
      END IF;
      IF NEW.priority IS DISTINCT FROM OLD.priority THEN
        RAISE EXCEPTION 'Unauthorized: Students cannot alter complaint priority.';
      END IF;
      -- On reopening, student may transition resolved/rejected complaint back to pending
      IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status != 'pending' THEN
        RAISE EXCEPTION 'Unauthorized: Students cannot transition complaint status to %.', NEW.status;
      END IF;
    END IF;

    -- Staff restrictions
    IF public.get_current_user_role() = 'staff' THEN
      IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
        RAISE EXCEPTION 'Unauthorized: Staff cannot modify complaint student_id.';
      END IF;
      IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
        RAISE EXCEPTION 'Unauthorized: Staff cannot reassign complaint to another user.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_complaint_tampering ON public.complaints;
CREATE TRIGGER trg_prevent_complaint_tampering
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.prevent_complaint_tampering();

-- ------------------------------------------------------------------------------
-- 3. Enable Row Level Security (RLS) on all 9 Application Tables
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. Table 1: Profiles Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "profiles_insert_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_insert_self_or_admin"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (id = auth.uid() AND role IN ('student', 'staff') AND status = 'active')
  OR public.is_admin()
);

DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  id = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
CREATE POLICY "profiles_delete_admin_only"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 5. Table 2: Categories Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "categories_select_active_or_admin" ON public.categories;
CREATE POLICY "categories_select_active_or_admin"
ON public.categories
FOR SELECT
TO authenticated
USING (
  active = true
  OR public.is_admin()
);

DROP POLICY IF EXISTS "categories_insert_admin_only" ON public.categories;
CREATE POLICY "categories_insert_admin_only"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_update_admin_only" ON public.categories;
CREATE POLICY "categories_update_admin_only"
ON public.categories
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_delete_admin_only" ON public.categories;
CREATE POLICY "categories_delete_admin_only"
ON public.categories
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. Table 3: Complaints Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "complaints_select_policy" ON public.complaints;
CREATE POLICY "complaints_select_policy"
ON public.complaints
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  OR assigned_to = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "complaints_insert_policy" ON public.complaints;
CREATE POLICY "complaints_insert_policy"
ON public.complaints
FOR INSERT
TO authenticated
WITH CHECK (
  (student_id = auth.uid() AND status = 'pending' AND (assigned_to IS NULL OR public.is_admin()))
  OR public.is_admin()
);

DROP POLICY IF EXISTS "complaints_update_policy" ON public.complaints;
CREATE POLICY "complaints_update_policy"
ON public.complaints
FOR UPDATE
TO authenticated
USING (
  student_id = auth.uid()
  OR assigned_to = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  student_id = auth.uid()
  OR assigned_to = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "complaints_delete_admin_only" ON public.complaints;
CREATE POLICY "complaints_delete_admin_only"
ON public.complaints
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 7. Table 4: Complaint Comments Policies
-- ------------------------------------------------------------------------------
-- Internal comments (is_internal = true) are strictly restricted to administrators.
-- Students and staff can only view public comments on complaints they are authorized to access.
DROP POLICY IF EXISTS "complaint_comments_select_policy" ON public.complaint_comments;
CREATE POLICY "complaint_comments_select_policy"
ON public.complaint_comments
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_comments.complaint_id
        AND (c.student_id = auth.uid() OR c.assigned_to = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "complaint_comments_insert_policy" ON public.complaint_comments;
CREATE POLICY "complaint_comments_insert_policy"
ON public.complaint_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.is_admin()
    OR (
      is_internal = false
      AND EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_comments.complaint_id
          AND (c.student_id = auth.uid() OR c.assigned_to = auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "complaint_comments_update_admin_only" ON public.complaint_comments;
CREATE POLICY "complaint_comments_update_admin_only"
ON public.complaint_comments
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "complaint_comments_delete_admin_only" ON public.complaint_comments;
CREATE POLICY "complaint_comments_delete_admin_only"
ON public.complaint_comments
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 8. Table 5: Complaint Timeline Policies
-- ------------------------------------------------------------------------------
-- Append-only audit trail: no client UPDATE or DELETE policies exist (default-deny).
DROP POLICY IF EXISTS "complaint_timeline_select_policy" ON public.complaint_timeline;
CREATE POLICY "complaint_timeline_select_policy"
ON public.complaint_timeline
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_timeline.complaint_id
        AND (c.student_id = auth.uid() OR c.assigned_to = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "complaint_timeline_insert_policy" ON public.complaint_timeline;
CREATE POLICY "complaint_timeline_insert_policy"
ON public.complaint_timeline
FOR INSERT
TO authenticated
WITH CHECK (
  updated_by = auth.uid()
  AND (
    public.is_admin()
    OR (
      is_internal = false
      AND EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_timeline.complaint_id
          AND (c.student_id = auth.uid() OR c.assigned_to = auth.uid())
      )
    )
  )
);

-- ------------------------------------------------------------------------------
-- 9. Table 6: Complaint Attachments Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "complaint_attachments_select_policy" ON public.complaint_attachments;
CREATE POLICY "complaint_attachments_select_policy"
ON public.complaint_attachments
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_attachments.complaint_id
      AND (c.student_id = auth.uid() OR c.assigned_to = auth.uid())
  )
);

DROP POLICY IF EXISTS "complaint_attachments_insert_policy" ON public.complaint_attachments;
CREATE POLICY "complaint_attachments_insert_policy"
ON public.complaint_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_attachments.complaint_id
        AND (c.student_id = auth.uid() OR c.assigned_to = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "complaint_attachments_delete_policy" ON public.complaint_attachments;
CREATE POLICY "complaint_attachments_delete_policy"
ON public.complaint_attachments
FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_attachments.complaint_id
        AND c.student_id = auth.uid()
    )
  )
);

-- ------------------------------------------------------------------------------
-- 10. Table 7: Notifications Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_select_own_or_admin"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "notifications_insert_admin_only" ON public.notifications;
CREATE POLICY "notifications_insert_admin_only"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "notifications_update_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_update_own_or_admin"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  user_id = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "notifications_delete_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_delete_own_or_admin"
ON public.notifications
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin()
);

-- ------------------------------------------------------------------------------
-- 11. Table 8: Broadcast Notifications Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "broadcast_notifications_select_policy" ON public.broadcast_notifications;
CREATE POLICY "broadcast_notifications_select_policy"
ON public.broadcast_notifications
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.is_staff()
  OR audience = 'all_students'
  OR (
    audience = 'department'
    AND target_department = (SELECT department FROM public.profiles WHERE id = auth.uid())
  )
  OR (
    audience = 'student'
    AND target_student_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "broadcast_notifications_insert_admin_only" ON public.broadcast_notifications;
CREATE POLICY "broadcast_notifications_insert_admin_only"
ON public.broadcast_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  AND sent_by = auth.uid()
);

DROP POLICY IF EXISTS "broadcast_notifications_update_admin_only" ON public.broadcast_notifications;
CREATE POLICY "broadcast_notifications_update_admin_only"
ON public.broadcast_notifications
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "broadcast_notifications_delete_admin_only" ON public.broadcast_notifications;
CREATE POLICY "broadcast_notifications_delete_admin_only"
ON public.broadcast_notifications
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 12. Table 9: System Settings Policies
-- ------------------------------------------------------------------------------
-- Singleton configuration: all authenticated users may view settings; only admins may update.
DROP POLICY IF EXISTS "system_settings_select_authenticated" ON public.system_settings;
CREATE POLICY "system_settings_select_authenticated"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "system_settings_update_admin_only" ON public.system_settings;
CREATE POLICY "system_settings_update_admin_only"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 13. Role Table Grants (Least Privilege Principle)
-- ------------------------------------------------------------------------------

-- Ensure schema usage
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Strictly REVOKE all privileges from anon
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

-- Grant minimal required permissions to authenticated role (governed by RLS)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaint_comments TO authenticated;
GRANT SELECT, INSERT ON public.complaint_timeline TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.complaint_attachments TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_notifications TO authenticated;
GRANT SELECT, UPDATE ON public.system_settings TO authenticated;

-- Grant sequence usage for automatic ticket numbers
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure service_role retains full access for server-side trusted operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
