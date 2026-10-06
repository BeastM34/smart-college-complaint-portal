# Smart College Complaint Portal — Production Deployment Guide

## 1. Prerequisites

Before deploying the Smart College Complaint Portal, verify that the target environment meets the following requirements:

- **Node.js**: `v20.x` LTS (or minimum `v18.18+`)
- **Package Manager**: `npm v9.x` or higher
- **Supabase Project**: A hosted Supabase project (or self-hosted Supabase instance with PostgreSQL 15+, PostgREST, GoTrue Auth, and Storage)
- **Domain & DNS**: Valid domains/subdomains for:
  - Frontend SPA (e.g., `https://portal.yourcollege.edu`)
  - Backend API (e.g., `https://api-portal.yourcollege.edu`)
- **SSL/TLS Certificates**: HTTPS is mandatory in production for secure token transmission and CORS security.

---

## 2. Frontend Deployment Setup

The frontend is a single-page application (SPA) built with React 19, TypeScript, Tailwind CSS, and Vite.

### 2.1 Required Environment Variables

Create a production environment file (`.env.production` or configure in your deployment platform's environment settings):

```env
# URL where the backend API is hosted (must NOT include a trailing slash)
VITE_API_BASE_URL=https://api-portal.yourcollege.edu/api

# Public Supabase project URL
VITE_SUPABASE_URL=https://<your-supabase-project-id>.supabase.co

# Public Supabase publishable / anon key (safe for browser distribution)
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

> **Security Note**: Never place the `SUPABASE_SECRET_KEY` or `SERVICE_ROLE_KEY` in frontend environment variables. Only public `VITE_*` variables may be bundled into client assets.

### 2.2 Production Build Command

From the root project directory:

```bash
# Install dependencies
npm ci

# Typecheck and compile production bundle
npm run build
```

- Output Directory: `dist/`
- Build artifacts include hashed JavaScript chunks, CSS stylesheets, static assets, and SPA rewrite rules (`_redirects`).

### 2.3 Hosting Options & SPA Routing Fallbacks

Single-page applications route all view navigation on the client side. Any direct navigation or page refresh on a route like `/admin/complaints/CMP-1001` or `/student/dashboard` must return `index.html` with status HTTP 200 rather than an HTTP 404.

#### Option A: Vercel
1. Set Build Command: `npm run build`
2. Set Output Directory: `dist`
3. Configure Environment Variables (`VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`)
4. The repository includes `vercel.json` in the root:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### Option B: Netlify
1. Set Build Command: `npm run build`
2. Set Publish Directory: `dist`
3. The build automatically copies `public/_redirects` to `dist/_redirects`:
```text
/*    /index.html   200
```

#### Option C: Cloudflare Pages
1. Set Framework Preset: `Vite`
2. Set Build Command: `npm run build`
3. Set Output Directory: `dist`
4. The `_redirects` file copied from `public/` is natively honored by Cloudflare Pages.

#### Option D: AWS S3 + CloudFront
1. Upload contents of `dist/` to an S3 bucket configured for static website hosting or origin access control (OAC).
2. On the CloudFront Distribution, add a **Custom Error Response**:
   - HTTP Error Code: `404: Not Found`
   - Customize Error Response: `Yes`
   - Response Page Path: `/index.html`
   - HTTP Response Code: `200: OK`
3. Repeat the error response mapping for HTTP Error Code `403: Forbidden`.

#### Option E: Nginx (Self-Hosted Web Server)
```nginx
server {
    listen 80;
    server_name portal.yourcollege.edu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name portal.yourcollege.edu;

    ssl_certificate /etc/letsencrypt/live/portal.yourcollege.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.yourcollege.edu/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/smart-college-complaint-portal/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        # Redirect all requests to index.html for client-side routing
        try_files $uri $uri/ /index.html;
    }

    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

---

## 3. Backend Deployment Setup

The backend is an Express TypeScript application running in Node.js, interfacing with Supabase PostgreSQL and Supabase Storage.

### 3.1 Required Environment Variables

Create `backend/.env` (or configure in your container/cloud platform):

```env
# Server Port
PORT=5000

# Environment Mode
NODE_ENV=production

# Fully qualified URL of the frontend (for strict CORS validation, no trailing slash)
FRONTEND_URL=https://portal.yourcollege.edu

# Supabase Project Base URL
SUPABASE_URL=https://<your-supabase-project-id>.supabase.co

# Supabase Publishable / Anon Key (for public client operations)
SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>

# Supabase Service Role / Secret Key (server-side administrative access only)
SUPABASE_SECRET_KEY=<your-supabase-secret-key>

# Optional: Supabase JWKS URL for offline/asymmetric JWT verification
# SUPABASE_JWKS_URL=https://<your-supabase-project-id>.supabase.co/auth/v1/.well-known/jwks.json
```

### 3.2 Build and Start Commands

```bash
# Navigate to backend directory
cd backend

# Install production and build dependencies
npm ci

# Compile TypeScript to JavaScript in backend/dist/
npm run build

# Start production server
node dist/server.js
```

### 3.3 Hosting Options

#### Option A: Render (Web Service)
- **Environment**: Node
- **Build Command**: `cd backend && npm ci && npm run build`
- **Start Command**: `cd backend && node dist/server.js`
- **Health Check Path**: `/api/health`
- **Auto-Deploy**: Enabled on `main` branch

#### Option B: Railway / Fly.io / DigitalOcean App Platform
- Use identical build (`cd backend && npm ci && npm run build`) and start commands (`node backend/dist/server.js`).
- Expose port `5000` (or allow the platform's dynamic `PORT` variable, which the server automatically detects).

#### Option C: Process Manager (PM2 on Linux VM)
Create `backend/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'complaint-portal-api',
      script: 'dist/server.js',
      cwd: '/var/www/smart-college-complaint-portal/backend',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      max_memory_restart: '500M',
      kill_timeout: 5000,
      listen_timeout: 10000,
      error_file: '/var/log/portal-api/err.log',
      out_file: '/var/log/portal-api/out.log',
    },
  ],
};
```

Run with PM2:
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

#### Option D: systemd Service Unit (`/etc/systemd/system/portal-backend.service`)
```ini
[Unit]
Description=Smart College Complaint Portal Backend API
After=network.target

[Service]
Type=simple
User=portalapp
WorkingDirectory=/var/www/smart-college-complaint-portal/backend
Environment=NODE_ENV=production
EnvironmentFile=/var/www/smart-college-complaint-portal/backend/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=portal-api

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable portal-backend
sudo systemctl start portal-backend
```

### 3.4 Reverse Proxy Configuration (Nginx for Backend API)

```nginx
server {
    listen 80;
    server_name api-portal.yourcollege.edu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api-portal.yourcollege.edu;

    ssl_certificate /etc/letsencrypt/live/api-portal.yourcollege.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-portal.yourcollege.edu/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Maximum attachment payload size (10MB to accommodate base64 attachment envelopes)
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Direct health check location
    location /api/health {
        proxy_pass http://127.0.0.1:5000/api/health;
        access_log off;
    }
}
```

### 3.5 Health Check & Monitoring

- **Endpoint**: `GET /api/health`
- **Expected Status**: `200 OK`
- **Response Format**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-07T00:00:00.000Z",
    "uptime": 12345.67,
    "environment": "production",
    "services": {
      "database": "connected"
    }
  }
  ```
- **Monitoring Integration**:
  - Configure uptime checks (e.g., UptimeRobot, BetterUptime, Datadog Synthetic Monitoring) with 30-second or 60-second intervals against `https://api-portal.yourcollege.edu/api/health`.
  - Alert on non-200 responses or latencies > 2000ms.

---

## 4. Supabase Setup & Configuration

### 4.1 Database Migrations Execution Order

Execute the migration scripts located in `backend/database/migrations/` sequentially in the Supabase SQL Editor or via Supabase CLI:

1. **`001_initial_schema.sql`**
   - Creates custom types: `user_role`, `complaint_status`, `complaint_priority`, `notification_type`
   - Creates database tables: `profiles`, `complaints`, `categories`, `timeline_events`, `complaint_comments`, `system_settings`, `attachments`, `notifications`
   - Creates indices, auto-updating timestamp triggers, and sequential ticket generation sequences (`CMP-1001` format)

2. **`002_grant_permissions.sql`**
   - Grants minimal necessary schema usage and CRUD privileges to `authenticated`, `anon`, and `service_role` roles.

3. **`003_rls_security.sql`**
   - Enables Row Level Security (RLS) on all public tables:
     - `profiles`: Self-read/update, admin full access, authenticated staff directory read.
     - `complaints`: Students read/create own records; staff read assigned records; admins have full access.
     - `timeline_events`: Students read public events on own complaints; staff read events on assigned; admins read all including internal events.
     - `complaint_comments`: Students read non-internal comments on own complaints; staff read non-internal on assigned; admins read/create all.
     - `notifications`: Users read/update own notifications only.
     - `categories`: Authenticated users read active categories; admins manage all.
     - `system_settings`: Authenticated users read public configuration; admins update.

4. **`004_role_registration_hardening.sql`**
   - Implements safe auth trigger `handle_new_user()` on `auth.users` insert.
   - Restricts initial role assignment to `student` by default unless explicitly provisioned by administrator.

5. **Seed Data: `backend/database/seeds/001_initial_data.sql`**
   - Inserts standard campus categories (Hostel, Electrical, Infrastructure, Sanitation, Academic, Library, Canteen, Transport) with SLAs.
   - Inserts singleton default record into `system_settings`.

### 4.2 Storage Bucket Configuration

1. In Supabase Dashboard, navigate to **Storage** -> **New Bucket**.
2. **Bucket Name**: `complaint-attachments`
3. **Public Bucket**: **OFF** (Must be strictly private; files are accessed exclusively through short-lived signed URLs).
4. **File Size Limit**: `5 MB` (`5242880` bytes)
5. **Allowed MIME Types**:
   - `image/jpeg`
   - `image/png`
   - `image/webp`
   - `image/gif`
   - `application/pdf`
6. Access control: The backend signs download URLs with a 300-second (5 minute) TTL via the endpoint `GET /api/complaints/:id/attachments/:attachmentId/signed-url`.

### 4.3 Supabase Authentication Configuration

1. In Supabase Dashboard, navigate to **Authentication** -> **Providers** -> **Email**.
   - Enable Email provider.
   - Configure password minimum length (minimum 8 characters).
2. Navigate to **Authentication** -> **URL Configuration**:
   - **Site URL**: `https://portal.yourcollege.edu`
   - **Redirect URLs**: Add `https://portal.yourcollege.edu/**`
3. Email Templates:
   - Customize confirmation, invite, and password reset email templates with institutional branding.

### 4.4 Provisioning Initial Administrator Account

To promote an initial user to the `admin` role, register the user via the frontend or Supabase Auth, then run the following SQL query in the Supabase SQL Editor:

```sql
-- Replace with the actual email of the administrator
UPDATE profiles
SET role = 'admin'
WHERE email = 'admin@college.edu';
```

Verify the role promotion:
```sql
SELECT id, email, role, full_name, is_active FROM profiles WHERE email = 'admin@college.edu';
```

---

## 5. Production Verification Checklist

### 5.1 Pre-Deployment Verification

- [ ] All 15 automated test suites pass (229 backend + 196 frontend + 108 integration = 533 tests passing).
- [ ] Frontend production build succeeds (`npm run build`) with 0 errors.
- [ ] Backend TypeScript build succeeds (`npm --prefix backend run build`) with 0 errors.
- [ ] `.env` and sensitive files are excluded in `.gitignore`.
- [ ] No hardcoded secrets, API keys, or service role keys in client source code.
- [ ] Supabase migrations (001–004) and initial seed data applied to production database.
- [ ] Storage bucket `complaint-attachments` created as private with 5MB limit.
- [ ] CORS allowed origin set strictly to production frontend URL.

### 5.2 Post-Deployment Smoke Tests

- [ ] `GET https://api-portal.yourcollege.edu/api/health` returns HTTP 200 `healthy`.
- [ ] Frontend application loads at `https://portal.yourcollege.edu`.
- [ ] Navigating directly to subpaths (e.g. `/student/dashboard`, `/login`) loads correctly without 404.
- [ ] User registration and email login operate properly.
- [ ] Submitting a complaint with attachment creates a record with sequential ticket number (`CMP-XXXX`).
- [ ] Staff and Admin dashboards load and filter complaints according to role boundaries.
- [ ] Status updates and comments produce timeline events and trigger user notifications.
- [ ] Viewing attachments returns a valid signed URL that renders properly.

### 5.3 Rollback Procedures

#### Frontend Rollback:
- **Vercel / Netlify / Cloudflare**: Instantly revert to the previous successful deployment via dashboard "Instant Rollback" or deploy history.
- **S3 / Nginx**: Re-deploy the previously tagged `dist/` archive.

#### Backend Rollback:
- **Render / Railway / Cloud**: Redeploy the previous Git commit hash or Docker image tag.
- **PM2**: `pm2 restart complaint-portal-api` after checking out the previous stable release.

#### Database Rollback:
- Before running migrations, perform a full Supabase backup.
- In the event of schema rollback requirements, apply targeted down-migrations rather than dropping tables.

---

## 6. Troubleshooting Common Deployment Issues

| Issue | Root Cause | Resolution |
| :--- | :--- | :--- |
| **CORS Error in Browser** | `FRONTEND_URL` on backend does not match frontend origin or has trailing slash. | Ensure `FRONTEND_URL` in backend `.env` exactly equals `https://portal.yourcollege.edu` without a trailing `/`. |
| **404 on Direct Page Refresh** | Web server is trying to serve static file for SPA path instead of `index.html`. | Verify SPA fallback configuration (`_redirects`, `vercel.json`, or Nginx `try_files $uri /index.html;`). |
| **401 Unauthorized on API Calls** | Token missing or expired; Supabase session not refreshed. | Check browser cookies/local storage for session; ensure `VITE_SUPABASE_URL` matches backend project. |
| **Attachment Upload Fails (413 Payload Too Large)** | Reverse proxy max body size exceeded. | In Nginx config, increase `client_max_body_size 10M;`. |
| **Attachment Link Fails (403 Forbidden)** | Storage bucket is misconfigured or signed URL expired. | Verify `complaint-attachments` bucket exists in Supabase and backend has `SUPABASE_SECRET_KEY` configured. |
| **Database Connection Error on Health Check** | Supabase network access blocked or keys invalid. | Verify `SUPABASE_URL` and `SUPABASE_SECRET_KEY` on backend; check Supabase project status in dashboard. |
