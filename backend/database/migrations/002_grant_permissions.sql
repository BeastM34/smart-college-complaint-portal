-- ==============================================================================
-- Smart College Complaint Portal - Migration 002: Server-Side Schema Privileges
-- Grants schema privileges exclusively to service_role for backend operations.
--
-- SECURITY NOTE:
-- broad privileges for 'anon' and 'authenticated' roles are deliberately OMITTED.
-- Granting broad access to anon/authenticated before Row Level Security (RLS)
-- is enabled would expose public schema tables directly via PostgREST.
-- Granular access for authenticated users and public endpoints will be configured
-- strictly during Phase 2C (Row Level Security & Access Policies).
-- ==============================================================================

-- 1. Grant schema usage and privileges to trusted backend service_role only
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- 2. Ensure future tables created in schema public also grant access to service_role
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

-- NOTE: Final authenticated/anon access will be configured alongside RLS policies in Phase 2C.
