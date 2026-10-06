# Smart College Complaint Portal - Backend API

> **Node.js + Express + TypeScript + Supabase PostgreSQL Backend**  
> Integrated with the Smart College Complaint Portal (Phase 8D) frontend architecture and designed for deployment on Render.

---

## 1. Overview & Technology Stack

The backend service provides a secure REST API over HTTPS for the Smart College Complaint Portal. It connects to a Supabase PostgreSQL database, supporting multi-role grievance workflows, audit histories, and institutional metrics.

### Technology Stack
* **Runtime**: Node.js (`v18+` LTS, `v20+`, or `v22+`)
* **Framework**: Express.js (`express`)
* **Language**: TypeScript (`typescript`)
* **Database Driver**: `@supabase/supabase-js` (`^2.117.2`)
* **Database**: Supabase PostgreSQL
* **Development Runner**: `tsx` (TypeScript execute with live reload)
* **Configuration**: `dotenv` for environment management
* **Security & Network**: `cors` with environment-configurable origins

---

## 2. Project Directory Structure

```text
backend/
├── database/
│   ├── migrations/
│   │   └── 001_initial_schema.sql      # Initial DDL relational schema (profiles, complaints, etc.)
│   └── seeds/
│       └── 001_initial_data.sql        # Safe initial seed data (categories & default settings)
├── src/
│   ├── config/
│   │   ├── env.ts                      # Validated environment configuration
│   │   ├── cors.ts                     # Origin validation for local & Vercel frontends
│   │   └── supabase.ts                 # Supabase client factory (admin & user-scoped)
│   ├── controllers/
│   │   └── healthController.ts         # Service status & database connectivity controller
│   ├── middleware/
│   │   └── errorMiddleware.ts          # 404 handler and centralized safe error handler
│   ├── routes/
│   │   ├── index.ts                    # Master API router mounting all modules
│   │   ├── healthRoutes.ts             # Active GET /api/health endpoint
│   │   ├── authRoutes.ts               # Placeholder for Supabase Auth (Phase 3)
│   │   ├── userRoutes.ts               # Placeholder for User Directory & Profiles
│   │   ├── complaintRoutes.ts          # Placeholder for Complaint Management
│   │   ├── categoryRoutes.ts           # Placeholder for Category & SLA Management
│   │   ├── notificationRoutes.ts       # Placeholder for Notifications & Broadcasts
│   │   ├── analyticsRoutes.ts          # Placeholder for Institutional Analytics
│   │   └── settingsRoutes.ts           # Placeholder for System Settings & Policies
│   ├── services/                       # Reserved for future business services
│   ├── utils/
│   │   └── supabaseTest.ts             # Safe database connection test helper
│   ├── scripts/
│   │   └── testConnection.ts           # CLI database connectivity verification script
│   ├── types/
│   │   └── index.ts                    # Common API response interfaces
│   ├── app.ts                          # Express application setup
│   └── server.ts                       # HTTP server listener and graceful shutdown
├── .env.example                        # Template for environment variables
├── .env                                # Local environment file (DO NOT COMMIT)
├── .gitignore                          # Git ignore rules (node_modules, dist, .env)
├── package.json                        # Project dependencies and lifecycle scripts
├── tsconfig.json                       # Strict TypeScript compiler options
└── README.md                           # This documentation
```

---

## 3. Environment Configuration & Security

### Required Environment Variables

Copy `.env.example` to create your local `.env`:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Configure your `backend/.env` with the following variables:

```ini
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Supabase Project Configuration (Phase 2A)
# Obtain these from your Supabase Dashboard -> Project Settings -> API
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key

# CRITICAL SECURITY NOTE:
# SUPABASE_SECRET_KEY is SERVER-ONLY and must NEVER be exposed to the React frontend
# or committed to source control. It is used exclusively for server-side trusted operations.
SUPABASE_SECRET_KEY=your-supabase-secret-or-service-role-key

# Optional: Supabase JWKS URL for JWT signature verification (Phase 3 Auth)
SUPABASE_JWKS_URL=https://your-project-id.supabase.co/auth/v1/.well-known/jwks.json
```

### Security Directives
> [!CAUTION]
> * **NEVER** expose `SUPABASE_SECRET_KEY` to the React frontend or check it into Git.
> * `backend/.env` is ignored by `.gitignore` in both the root and backend folders.
> * Never print raw credentials or secret tokens in application logs or console statements.

---

## 4. Database Setup & Migrations

The database schema is defined declaratively in SQL. You do **not** need to manually build tables in the Supabase Table Editor.

### Step 1: Apply Initial Schema Migration
1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and navigate to the **SQL Editor**.
2. Open the file [`backend/database/migrations/001_initial_schema.sql`](file:///C:/Users/ACER/.gemini/antigravity/scratch/smart-college-complaint-portal/backend/database/migrations/001_initial_schema.sql).
3. Paste the contents into the Supabase SQL Editor and click **Run**.
4. This creates:
   * `profiles` (references `auth.users.id`, no password fields)
   * `categories` (with unique slugs and SLA targets)
   * `complaints` (with automatic `TKT-YYYY-XXXX` sequential ticket numbering)
   * `complaint_comments` (public discussion and internal admin notes)
   * `complaint_timeline` (audit trail of status progressions)
   * `complaint_attachments` (metadata only; ready for Supabase Storage in Phase 2B)
   * `notifications` (user in-portal alerts)
   * `broadcast_notifications` (campus administrative announcements)
   * `system_settings` (singleton institutional preferences)
   * Automatic `updated_at` triggers and performance indexes.

### Step 2: Apply Initial Seed Data
1. In the Supabase **SQL Editor**, open [`backend/database/seeds/001_initial_data.sql`](file:///C:/Users/ACER/.gemini/antigravity/scratch/smart-college-complaint-portal/backend/database/seeds/001_initial_data.sql).
2. Paste the contents and click **Run**.
3. This populates the 8 default campus categories and initial system settings without creating fake user credentials or passwords.

---

## 5. Verifying Database Connection

### Option A: Command Line Verification
Run the database connectivity verification script:
```bash
npm run db:check
```
* If Supabase keys are configured in `backend/.env` and reachable, it prints:
  ```text
  ================================================================
   SUPABASE DATABASE CONNECTIVITY VERIFICATION
  ================================================================
   Target Environment : development
   Supabase URL       : your-project-id.***
   Secret Key Status  : Configured (Server-Only)
  ----------------------------------------------------------------
   [SUCCESS] Successfully connected to Supabase PostgreSQL database.
  ```

### Option B: Health API Endpoint
Start the server and query the health endpoint:
```bash
# Start server
npm run dev

# In another terminal or browser:
curl http://localhost:5000/api/health
```
Response (`200 OK`):
```json
{
  "success": true,
  "message": "Smart College Complaint Portal API is running",
  "environment": "development",
  "timestamp": "2026-10-06T00:40:00.000Z",
  "version": "1.0.0",
  "database": {
    "configured": true,
    "connected": true,
    "status": "connected",
    "message": "Successfully connected to Supabase PostgreSQL database."
  }
}
```

---

## 6. Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts development server with live watch/reload via `tsx`. |
| `npm run build` | Compiles TypeScript source to CommonJS JavaScript in `dist/`. |
| `npm start` | Executes the compiled production bundle (`node dist/server.js`). |
| `npm run db:check` | Verifies Supabase credentials and database connectivity. |
| `npm run test:attachments` | Executes comprehensive automated test suite for Supabase Storage and attachments. |
| `npm run test:rls` | Executes static & live security audit for Row Level Security (RLS) policies. |
| `npm run test:auth` | Executes automated audit suite for Supabase Auth, tokens, role guards, and endpoints. |

---

## 7. Supabase Storage & Complaint Attachments (Phase 2B)

The attachment system connects the database metadata table (`complaint_attachments`) to a dedicated Supabase Storage bucket.

### Architecture & Security Guarantees
* **Private Bucket**: `complaint-attachments` is created with `public: false`. Public internet access is disabled at the bucket level.
* **Ephemeral In-Memory Processing**: File uploads are buffered strictly in RAM using `multer.memoryStorage()`. No files are written to Render's local ephemeral filesystem.
* **Strict Validation**:
  * **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
  * **Maximum File Size**: 5 MB (`5,242,880` bytes).
  * **Empty File Rejection**: 0-byte buffers are rejected.
  * **Path Sanitization**: Directory traversal patterns (`../`, `..\`) and unsafe characters are stripped.
* **Deterministic Path Structure**:
  ```text
  complaints/{complaint_id}/{unique_uuid}-{sanitized_filename}
  ```
* **Failure Rollback Guarantee**: If database metadata persistence fails after file upload to Supabase Storage, the uploaded storage object is automatically deleted immediately, guaranteeing zero orphaned files.
* **Short-Lived Signed URLs**: Access to private attachment objects is granted exclusively via cryptographically signed URLs with a 5-minute (300 seconds) expiration window.

### Attachment API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/complaints/:complaintId/attachments` | Uploads multipart file (`file` form field), uploads to Supabase Storage, registers metadata in `complaint_attachments`, and returns metadata with a signed URL. |
| `GET` | `/api/complaints/:complaintId/attachments` | Lists all attachments linked to the complaint, each enriched with an active signed URL for display. |
| `GET` | `/api/complaints/:complaintId/attachments/:attachmentId` | Fetches attachment metadata and fresh signed URL. Pass `?download=true` to automatically redirect to download. |
| `DELETE` | `/api/complaints/:complaintId/attachments/:attachmentId` | Deletes object from Supabase Storage and removes metadata row from PostgreSQL. |

### Running Attachment Automated Tests
```bash
npm run test:attachments
```

---

## 8. Database Security & Row Level Security (RLS) (Phase 2C)

Migration [`backend/database/migrations/003_rls_security.sql`](file:///C:/Users/ACER/.gemini/antigravity/scratch/smart-college-complaint-portal/backend/database/migrations/003_rls_security.sql) implements granular access control across the 9 application tables.

### Security Architecture & Principles
1. **Default-Deny**: Row Level Security is explicitly enabled on all 9 application tables (`profiles`, `categories`, `complaints`, `complaint_comments`, `complaint_timeline`, `complaint_attachments`, `notifications`, `broadcast_notifications`, `system_settings`).
2. **Identity Model**: `auth.uid() -> profiles.id -> profiles.role` (`student`, `staff`, `admin`).
3. **Anti-Recursion Role Helpers**: Role lookups are evaluated using `SECURITY DEFINER` functions (`public.get_current_user_role()`, `public.is_admin()`, `public.is_staff()`, `public.is_student()`) with fixed `search_path = public, pg_temp` and 0 arguments, preventing recursive policy evaluation on `profiles`.
4. **Privilege Escalation Triggers**:
   * `trg_prevent_profile_escalation`: Prevents non-administrators from altering their `role`, `status`, `id`, or `email`.
   * `trg_prevent_complaint_tampering`: Prevents students from changing `student_id`, `assigned_to`, `priority`, or status; prevents staff from altering `student_id` or reassigning to other staff.
5. **Confidentiality of Internal Dialogue**: Internal notes (`is_internal = true`) on `complaint_comments` and `complaint_timeline` are strictly hidden from students and non-admin staff.
6. **Append-Only Audit Trail**: `complaint_timeline` permits `SELECT` and `INSERT` only; client `UPDATE` and `DELETE` operations are completely disabled.
7. **Attachment Authorization**: Access to `complaint_attachments` metadata strictly inherits parent complaint ownership (`student_id = auth.uid() OR assigned_to = auth.uid() OR public.is_admin()`).
8. **Notification Isolation**: Notifications are strictly accessible by their recipient (`user_id = auth.uid() OR public.is_admin()`).
9. **Broadcast Targeting**: Students only receive broadcasts intended for `all_students`, their department, or their specific student ID.
10. **System Settings Singleton**: Authenticated users can read public configuration; only administrators may execute `UPDATE`.
11. **PostgreSQL Role Grants**:
    * `anon`: Zero table access (`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;`).
    * `authenticated`: Least-privilege table grants governed by RLS.
    * `service_role`: Full server-side bypass preserved for backend operations using `SUPABASE_SECRET_KEY`.

### Role Registration Hardening (Migration 004)
Migration [`backend/database/migrations/004_role_registration_hardening.sql`](file:///C:/Users/ACER/.gemini/antigravity/scratch/smart-college-complaint-portal/backend/database/migrations/004_role_registration_hardening.sql) implements defense-in-depth hardening against unauthorized staff or admin self-registration:
1. **Student-Only Self-Registration**: Public/user registration via Supabase Auth allows self-insertion of a profile strictly when `id = auth.uid() AND role = 'student' AND status = 'active'`.
2. **Staff & Admin Self-Assignment Denied**: Non-admin users attempting to supply `role = 'staff'` or `role = 'admin'` on profile creation are denied by the RLS `WITH CHECK` policy and rejected by `trg_prevent_profile_escalation`.
3. **Admin Provisioning Invariant**: Staff and administrator accounts can only be created or promoted by an administrator (`public.is_admin()`) or via server-side `service_role` operations.
4. **Trigger Interception on INSERT & UPDATE**: The `trg_prevent_profile_escalation` trigger now intercepts both `BEFORE INSERT OR UPDATE`, enforcing role, status, ID, and email immutability for non-administrators.

> [!NOTE]
> **Phase 2C Boundary & Authentication Limitation**:  
> Supabase Auth (login/register) is scheduled for implementation in **Phase 3**. The RLS policies authored in this phase establish the required database-level security rules for authenticated JWT sessions once Supabase Auth is integrated.

### Running Security & RLS Tests
```bash
npm run test:rls
```

---

## 9. Supabase Authentication & Multi-Role Sessions (Phase 3)

Phase 3 integrates real Supabase Authentication, JWT access-token middleware, user-scoped PostgREST execution for RLS, and multi-role session management.

### Architecture & Security Principles
1. **Single Auth Provider**: Supabase Auth owns all passwords, credentials, tokens, and session lifecycles. No passwords or hashes are stored in `public.profiles`.
2. **Key Isolation**:
   * `SUPABASE_PUBLISHABLE_KEY`: Used for public client operations (signup, login). Safe for browser use; never confers administrative bypass.
   * `SUPABASE_SECRET_KEY`: Server-only secret key used exclusively for trusted backend administrative tasks (`auth.admin.createUser`, provisioning staff/admins). Never exposed to the frontend.
3. **User-Scoped vs. Service-Role Clients**:
   * **User-Scoped Client (`createUserScopedSupabaseClient`)**: Injects `Authorization: Bearer <access_token>`, allowing PostgreSQL to evaluate `auth.uid()` and enforce RLS policies dynamically.
   * **Admin Client (`getSupabaseAdmin`)**: Uses `SUPABASE_SECRET_KEY` for background maintenance, provisioning, and verified administrative workflows.
4. **Authoritative Role Model**:
   * Roles (`student`, `staff`, `admin`) are resolved directly from `public.profiles`.
   * Client-supplied role headers or request parameters are strictly rejected during self-registration.
5. **Privileged Provisioning Workflow**:
   * Students cannot self-register as staff or admin.
   * Staff and administrator accounts are provisioned via `POST /api/auth/provision`, strictly guarded by `requireAuth` + `requireAdmin`.
6. **Authentication Middleware (`requireAuth`)**:
   * Validates `Authorization: Bearer <access_token>` against Supabase Auth via `supabase.auth.getUser(token)`.
   * Injects `req.user`, `req.token`, `req.profile`, and user-scoped `req.supabase`.
   * Enforces account active status (`profile.status === 'active'`; deactivated accounts receive `403 Forbidden`).

### Authentication API Endpoints (`/api/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Public | Student self-registration. Strictly enforces `role = 'student'`. |
| `POST` | `/api/auth/login` | Public | Authenticates credentials with Supabase Auth; returns session tokens and profile. |
| `POST` | `/api/auth/logout` | Authenticated | Invalidates user session in Supabase Auth. |
| `GET` | `/api/auth/me` | Authenticated | Retrieves current authenticated identity and authoritative profile from `public.profiles`. |
| `POST` | `/api/auth/refresh` | Public | Refreshes session tokens via Supabase Auth using `refresh_token`. |
| `POST` | `/api/auth/provision` | Admin Only | Privileged endpoint to provision `staff` or `admin` accounts. |

### Running Authentication Automated Tests
```bash
npm run test:auth
```

---

## 10. Render Deployment Considerations

The backend is built specifically to deploy seamlessly on [Render](https://render.com) as a Web Service:

1. **Root Directory**: Set to `backend`.
2. **Build Command**: `npm install && npm run build`
3. **Start Command**: `npm start`
4. **Port Binding**: Render injects `PORT` (e.g. 10000). The backend reads `process.env.PORT` automatically.
5. **Environment Variables on Render**:
   * `NODE_ENV=production`
   * `FRONTEND_URL=https://your-app.vercel.app`
   * `SUPABASE_URL=https://your-project.supabase.co`
   * `SUPABASE_PUBLISHABLE_KEY=your-publishable-key`
   * `SUPABASE_SECRET_KEY=your-secret-key`
6. **Graceful Shutdown**: The server handles `SIGTERM` and `SIGINT` signals, closing connections cleanly during zero-downtime rolling deploys.



