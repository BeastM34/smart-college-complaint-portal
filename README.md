# Smart College Complaint Portal

> **A responsive, multi-role campus grievance management and institutional analytics platform.**
> Built with React 19, TypeScript, Vite 8, and Tailwind CSS v4.

---

## 1. Project Overview

The **Smart College Complaint Portal** is a web application designed to streamline, track, and resolve campus-wide student grievances. It bridges the communication gap between students, facility maintenance technicians, and collegiate administration.

The portal provides role-based interfaces for **Students**, **Staff Members**, and **Administrators**, featuring ticket tracking, complaint categorization, automated department routing, multi-tier status progression, communication threads, and dynamic institutional analytics.

### Current Implementation Baseline
* **Architecture**: Modern Single Page Application (SPA) with a service-oriented client-side storage architecture (`localStorage`).
* **Backend Status**: Backend is **NOT** implemented yet (Client-side / Demo architecture). External email, SMS, push notifications, and GPS tracking are simulated.
* **Test Verification**: **196 / 196 automated tests passed** (100% pass rate) across End-to-End, Analytics, Security/Integration, and UI state suites.
* **Build Status**: Production TypeScript compilation and Vite bundling verified cleanly (`0 errors`).

---

## 2. Problem Statement & Objectives

### The Problem
Traditional college grievance management often relies on manual physical suggestion boxes, informal verbal reports, or disjointed email threads. This results in:
* Lack of student visibility into complaint resolution progress.
* Missing accountability and slow response times across campus departments.
* Loss of critical details such as location, photographs, and timestamps.
* Absence of data-driven metrics for institutional management to identify chronic facility failures.

### Main Objectives
1. **Empower Students**: Provide an intuitive, multi-step complaint lodging interface with real-time status tracking, audit timelines, and feedback collection.
2. **Streamline Staff Operations**: Provide department technicians with isolated work queues, ticket progress controls, and direct student communication.
3. **Equip Administrators**: Provide full visibility over campus operations with triage controls, technician assignment, priority overrides, user administration, broadcast messaging, and dynamic analytics.
4. **Enforce Institutional Policies**: Apply SLA parameters, attachment constraints, registration switches, and maintenance mode restrictions at the service layer.

---

## 3. Core Features by Role

### 👨‍🎓 Student Portal
* **Account Registration & Authentication**: Student self-registration with institutional email, Student ID, department, and academic year.
* **Multi-Step Complaint Lodging**: 4-step wizard capturing category, location (building, floor, room), detailed description, priority, and optional visual attachments.
* **Intelligent Auto-Assignment**: Automatic routing to responsible departments (Electrical, IT, Plumbing, Maintenance, Housekeeping) based on category rules.
* **Grievance Tracking**: Searchable, filterable complaint list with status indicators (`pending`, `assigned`, `in_progress`, `resolved`, `rejected`).
* **Ticket Timeline & Public Dialogue**: Complete chronological audit trail with two-way public comment threads between students and assigned staff.
* **Grievance Reopening & Satisfaction Feedback**: Option to reopen unresolved tickets (governed by institutional policy) and provide satisfaction ratings upon resolution.
* **Profile & Notification Center**: In-portal notification alerts and profile management.

### 🛠️ Staff Portal
* **Department & Ticket Work Queue**: Filtered queue displaying tickets assigned directly to the technician's unique ID.
* **Status Progression**: Step-by-step ticket advancement (`assigned` → `in_progress` → `resolved` / `rejected`).
* **Work Logging & Student Communication**: Public comment updates to inform students of ongoing repairs.
* **Technician Dashboard**: Quick metrics on pending assignments, active tasks, and resolved complaints.
* **Staff Profile Management**: Technician designation and departmental profile settings.

### 🏛️ Administrator Portal
* **Operational Dashboard**: Campus-wide KPIs, active ticket count, critical issue alerts, and recent grievance stream.
* **Central Complaint Management**: Complete ticket triage, manual technician assignment, department transfers, priority adjustments, and bulk status updates.
* **Internal Admin Notes**: Private administrative notes on complaint records that remain strictly invisible to students and technicians.
* **Dynamic Institutional Analytics**: Live metrics calculated from complaint records (zero mock fallback) across 5 reporting ranges (`7d`, `30d`, `3m`, `6m`, `1y`):
  * Active queue volume and resolution rate percentage.
  * Average resolution time in hours with calendar month clamping.
  * Category distribution, priority breakdown, and status distribution.
  * Department resolution performance table and historical trend charts.
* **User Management**: Campus directory with role badges, search, filter, and account activation/deactivation controls (with last-admin protection).
* **Category Management**: Configuration of complaint categories, SLA targets, and active/inactive toggles.
* **Campus Broadcast Announcements**: Targeted broadcast notifications (all students, specific department, or individual student).
* **System Settings & Demo Mode**: Central control of registration, maintenance mode, attachment rules (max files and size in MB), and instant Demo Mode reset.

---

## 4. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework & Core** | React 19 (`react`, `react-dom`), TypeScript (`~6.0`) |
| **Build Tooling** | Vite 8 (`vite`, `@vitejs/plugin-react`), TSX runner (`tsx`) |
| **Styling & Design System** | Tailwind CSS v4 (`@tailwindcss/vite`, `tailwindcss`), PostCSS |
| **Routing** | React Router v7 (`react-router-dom`) with declarative layout routing |
| **Forms & Validation** | React Hook Form (`react-hook-form`), Zod schema validation (`zod`) |
| **Icons & UI Utilities** | Lucide React (`lucide-react`), `clsx`, `tailwind-merge` |
| **Client Storage** | Browser `localStorage` with typed storage abstraction and quota protection |

---

## 5. System Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│   Pages (Student, Staff, Admin, Public) & Layouts      │
│   Reusable UI Components, Modals, Forms & SVG Charts   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    State & Context                     │
│    AuthContext (Session)  │  ThemeContext (Dark/Light)  │
│    ToastContext (Alerts)  │  Custom Hooks (useAuth...) │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                     Service Layer                      │
│   authService       │ complaintService │ userService   │
│   categoryService   │ settingsService  │ analyticsSvc  │
│   notificationSvc   │ (Enforces validation & RBAC)     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│               Storage Abstraction Layer                │
│    storage.ts (getStorageItem, setStorageItem)         │
│    StorageQuotaError Detection & Serialization Guard   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  Persistence Layer                     │
│             Browser HTML5 localStorage                 │
│   (scp_complaints, scp_users, scp_settings, etc.)      │
└────────────────────────────────────────────────────────┘
```

### Architecture Key Principles
1. **Service-Layer Enforcement**: Authorization, role boundaries, and business rules (e.g., student complaint isolation, staff ID checks, internal note shielding) are enforced at the service layer, not solely by hiding UI buttons.
2. **Clean Abstraction**: The storage layer is decoupled behind typed service methods, allowing seamless future migration from `localStorage` to REST or GraphQL APIs.
3. **Quota Protection**: All browser storage writes check serialization bounds. Quota exhaustion triggers typed `StorageQuotaError` exceptions, preserving form state and preventing broken navigation.

---

## 6. Project Directory Structure

```text
smart-college-complaint-portal/
├── docs/                                # Technical handover and college report documentation
│   ├── PROJECT_HANDOVER.md              # In-depth technical specifications and handover guide
│   └── COLLEGE_DOCUMENTATION_REFERENCE.md # Structured collegiate project report material
├── public/                              # Static public assets (favicons, SVGs)
├── scripts/                             # Automated test and validation suites
│   ├── package_zip.ps1                  # Project packaging script
│   ├── test_phase3_integration.ts       # 66 Integration, security & RBAC tests
│   ├── test_phase8a_ui.ts               # 24 UI state, theme & layout tests
│   ├── test_phase8b_analytics.ts        # 57 Dynamic analytics calculation tests
│   └── test_phase8c_e2e.ts              # 49 End-to-end, workflow & quota tests
├── src/
│   ├── assets/                          # Images and visual brand assets
│   ├── components/
│   │   ├── charts/                      # SVG analytics charts (trend, donut, bar, table)
│   │   ├── common/                      # Reusable atoms (Button, Card, Input, Modal, Badge...)
│   │   ├── complaints/                  # Complaint cards, filters, and timeline components
│   │   └── layout/                      # Header, Sidebar, MobileDrawer, ThemeToggle
│   ├── context/                         # AuthContext, ThemeContext, ToastContext
│   ├── data/                            # Initial seed data (MOCK_USERS, MOCK_COMPLAINTS...)
│   ├── hooks/                           # Custom React hooks (useAuth, useComplaints...)
│   ├── layouts/                         # PublicLayout, StudentLayout, StaffLayout, AdminLayout
│   ├── pages/
│   │   ├── admin/                       # Dashboard, Complaints, Analytics, Users, Categories, Settings
│   │   ├── public/                      # Home, Login, Register, ForgotPassword, Maintenance
│   │   ├── staff/                       # Dashboard, Complaints, Details, Profile, Notifications
│   │   └── student/                     # Dashboard, NewComplaint, MyComplaints, Details, Profile
│   ├── routes/                          # AppRoutes and ProtectedRoute (Role & Maintenance guards)
│   ├── services/                        # Business logic, RBAC, and data storage services
│   ├── types/                           # Central TypeScript interfaces and data models
│   └── utils/                           # Tailwind class merging (cn.ts) and storage abstraction
├── index.html                           # HTML5 root template
├── package.json                         # Project dependencies, scripts, and engine metadata
├── tsconfig.json                        # TypeScript strict compiler configuration
└── vite.config.ts                       # Vite bundler and path aliasing configuration
```

---

## 7. Installation & Quick Start

### Prerequisites
* **Node.js**: `v18.0.0` or higher (Node.js 20+ recommended)
* **npm**: `v9.0.0` or higher

### Installation
```bash
# Clone or navigate to the project directory
cd smart-college-complaint-portal

# Install project dependencies
npm install
```

### Development Server
```bash
# Start Vite development server
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

### Production Build
```bash
# Type-check and compile production bundle
npm run build

# Preview the production build locally
npm run preview
```
The compiled, minified bundle will be output to the `dist/` directory.

---

## 8. Test Execution & Verification

The project includes 4 comprehensive automated test suites run directly against TypeScript source files using `tsx`:

```bash
# Run all end-to-end, workflow, and storage quota tests (49 tests)
npm run test:e2e

# Run dynamic analytics and reporting calculation tests (57 tests)
npm run test:analytics

# Run security, authorization, and settings integration tests (66 tests)
npm run test:integration

# Run UI state, theme, and component structure tests (24 tests)
npm run test:ui
```

### Verified Test Summary
| Suite | Script | Tests | Pass Rate |
| :--- | :--- | :---: | :---: |
| **Phase 8C E2E & Quota** | `scripts/test_phase8c_e2e.ts` | 49 / 49 | 100% |
| **Phase 8B Analytics** | `scripts/test_phase8b_analytics.ts` | 57 / 57 | 100% |
| **Phase 3 Integration & Security** | `scripts/test_phase3_integration.ts` | 66 / 66 | 100% |
| **Phase 8A UI State** | `scripts/test_phase8a_ui.ts` | 24 / 24 | 100% |
| **Total Automated Tests** | | **196 / 196** | **100%** |
| **TypeScript / Build** | `tsc && vite build` | **0 errors** | **Clean** |

---

## 9. Demo Credentials & Presentation Walkthrough

The portal comes pre-seeded with realistic institutional mock accounts for demonstration and evaluation.

### Available Demo Credentials

| Role | Email Address | Password | Account Context |
| :--- | :--- | :--- | :--- |
| **Student** | `student@college.edu` | `student123` | Alex Johnson (3rd Year, Computer Science) |
| **Student (Alt)** | `priya.sharma@college.edu` | `password123` | Priya Sharma (2nd Year, ECE) |
| **Staff (Electrical)** | `ramesh.kumar@college.edu` | `staff123` | Ramesh Kumar (Electrical Technician) |
| **Staff (IT Support)** | `amit.patil@college.edu` | `staff123` | Amit Patil (IT Support Specialist) |
| **Staff (Plumbing)** | `suresh.sharma@college.edu` | `staff123` | Suresh Sharma (Plumbing Technician) |
| **Administrator** | `admin@college.edu` | `admin123` | Dr. Sarah Connor (Campus Administration) |

### Recommended Presentation Flow
1. **Student Journey**:
   * Sign in as `student@college.edu`.
   * View the Student Dashboard with active ticket summaries.
   * Click **Submit Complaint** to navigate the 4-step wizard:
     * Select *Electrical & Power*, specify *Hostel Block 3, Room 204*, set *High* priority, and add description.
     * Submit ticket (auto-assigned to Electrical Department).
   * View ticket details and timeline; post a public clarification comment.
2. **Staff Journey**:
   * Sign out and log in as `ramesh.kumar@college.edu` (Electrical Staff).
   * Open the Staff Dashboard to view assigned electrical tickets.
   * Progress ticket from `assigned` to `in_progress`, then to `resolved`. Post a work completion update.
3. **Student Follow-Up**:
   * Log back in as `student@college.edu`. Observe the resolution notification and updated timeline.
   * Submit satisfaction feedback (*Satisfied*).
4. **Administrator Journey**:
   * Sign in as `admin@college.edu`.
   * Review global dashboard KPIs and triage unassigned complaints.
   * Open **Analytics Dashboard** to explore live metrics, date filters (`7d`, `30d`, `6m`), and department resolution rates.
   * Inspect **Users**, **Categories**, and **Settings** (toggle Maintenance Mode or attachment rules).
5. **UI & Theme**:
   * Toggle between **Light** and **Dark** themes.
   * Resize viewport to demonstrate responsive mobile navigation drawer.

---

## 10. Demo Mode & State Management

* **Seed Data**: Initializing the application loads pre-configured students, technicians, administrators, complaints, categories, and settings.
* **Persistent Changes**: Any complaint submitted, status progressed, comment posted, or user updated persists in your browser's `localStorage`.
* **Instant Demo Reset**:
  * Navigate to **Admin → Settings → Reset Demo Data**.
  * Clicking reset restores all portal collections (`scp_complaints`, `scp_users`, `scp_notifications`, `scp_categories`, `scp_settings`, `scp_broadcasts`) back to their clean initial state while preserving the active admin session.

---

## 11. Known Architectural Limitations

> [!NOTE]
> This application is currently implemented as an academic and demonstration system. The following boundaries exist:

1. **Client-Side Persistence**: Data is persisted in browser `localStorage`. Data does not synchronize across separate physical devices or incognito sessions.
2. **Storage Quota & Base64 Attachments**: Browser `localStorage` enforces an origin quota of ~5 MB. File attachments are encoded as Base64 strings (expanding binary size by ~33%). Uploading multiple large images will reach the quota. The application gracefully catches this with `StorageQuotaError`, preserves user input, and guides the user to reset demo data.
3. **No Real Backend Service**: REST API endpoints, relational database servers, and server-side background tasks are not yet implemented.
4. **Simulated External Gateways**: Outgoing email (SMTP), SMS gateways, mobile push notifications, and GPS map integrations are simulated in-portal.
5. **Testing Environment**: Automated testing is performed at the service, integration, state, and node layer via TSX (196 tests). Real browser-driver automated testing (e.g., Playwright/Selenium) was not configured in the host environment; browser verification was performed via manual QA.

---

## 12. Future Backend Migration Blueprint

The current service architecture is intentionally designed for a seamless transition to a production cloud backend:

```text
React 19 Frontend (SPA)
        ↓  HTTPS / REST or GraphQL
API Gateway / Authentication (JWT Bearer Tokens)
        ↓
Backend Services (Node.js / Express, NestJS, or Python FastAPI)
   ├── Complaint Management Service
   ├── User & RBAC Service
   ├── Notification & Broadcast Dispatcher
   └── Analytics Aggregation Engine
        ├── Relational Database (PostgreSQL / MySQL)
        └── Cloud Object Storage (AWS S3 / Google Cloud Storage) for Attachments
```

To migrate, developers need only replace the client-side `localStorage` logic in `src/services/` with asynchronous `fetch` or `axios` API calls pointing to the backend endpoints.

---

## 13. Deployment Guidance

The current application can be deployed as a static web application to any standard static hosting platform:

1. **Build**: Run `npm run build` to generate the production bundle in `dist/`.
2. **Hosting Platforms**: Vercel, Netlify, Cloudflare Pages, GitHub Pages, AWS S3 + CloudFront, or Firebase Hosting.
3. **Single Page Application (SPA) Rewrite**: Configure your web server to redirect all requests (`/*`) to `/index.html` to support React Router client-side routing.
   * **Netlify**: Create a `public/_redirects` file with `/*  /index.html  200`.
   * **Vercel**: Include a `vercel.json` with a rewrite rule to `/index.html`.
   * **Nginx**: Use `try_files $uri $uri/ /index.html;`.

---

## 14. License & Academic Attribution

Developed for institutional grievance tracking and academic evaluation.
All sample personal details, student records, and email addresses in demo data are fictional.
