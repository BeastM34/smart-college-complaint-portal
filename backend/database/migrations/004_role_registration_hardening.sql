-- ==============================================================================
-- Smart College Complaint Portal - Migration 004: Role Registration Hardening
-- Database: Supabase PostgreSQL
--
-- OBJECTIVE:
-- Harden user registration and role assignment so that normal authenticated
-- users cannot self-register as 'staff' or 'admin', and cannot escalate their
-- privileges under any circumstances.
--
-- SECURITY ARCHITECTURE:
-- 1. Public Signup / Self-Registration: Strictly restricted to role = 'student'.
-- 2. Staff Accounts: Must be provisioned or promoted by an administrator.
-- 3. Admin Accounts: Must be provisioned or promoted by an administrator.
-- 4. Defense-in-Depth: Both RLS WITH CHECK policy and BEFORE INSERT/UPDATE trigger
--    enforce the strict student-only self-registration invariant.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Harden profiles INSERT RLS Policy
-- ------------------------------------------------------------------------------
-- Replace previous policy that permitted role IN ('student', 'staff')
-- with a strict student-only self-registration rule.
DROP POLICY IF EXISTS "profiles_insert_self_or_admin" ON public.profiles;

CREATE POLICY "profiles_insert_self_or_admin"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (id = auth.uid() AND role = 'student' AND status = 'active')
  OR public.is_admin()
);

-- ------------------------------------------------------------------------------
-- 2. Harden Integrity Protection Trigger (BEFORE INSERT OR UPDATE)
-- ------------------------------------------------------------------------------
-- Extend prevent_profile_escalation to validate both INSERT and UPDATE operations.
CREATE OR REPLACE FUNCTION public.prevent_profile_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If invoked in an authenticated client session that is not an administrator
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    -- On INSERT: Non-admin users can ONLY create student profiles for their own auth.uid()
    IF TG_OP = 'INSERT' THEN
      IF NEW.role != 'student' THEN
        RAISE EXCEPTION 'Unauthorized: Self-registration is strictly restricted to student accounts. Staff and administrator accounts must be provisioned by an administrator.';
      END IF;
      IF NEW.status != 'active' THEN
        RAISE EXCEPTION 'Unauthorized: Newly registered accounts must have active status.';
      END IF;
      IF NEW.id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: Profile identifier must match authenticated user identity.';
      END IF;
    END IF;

    -- On UPDATE: Non-admin users cannot alter role, status, id, or email
    IF TG_OP = 'UPDATE' THEN
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
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger fires on BOTH INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_prevent_profile_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_escalation
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_escalation();
