# TreeCRM — Development Session Checklist

This checklist tracks the completion of each TreeCRM development session. Each session includes **tasks to accomplish** and a **target outcome**. Tick boxes as items are completed.

---

## Session 1 — Project Initialization & Infrastructure Setup

**Objective:** Establish development environment and connections.

### Tasks
- [x] Initialize Next.js project with TypeScript, Tailwind CSS, Material UI.
- [x] Configure ESLint and Prettier.
- [x] Create placeholder pages: `/login`, `/customer`, `/employee`.
- [x] Initialize Express backend with core routes (`/health`, `/version`).
- [x] Install dependencies: express, cors, dotenv, jsonwebtoken, socket.io, supabase-js.
- [x] Create `.env` files with `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`.
- [x] Connect frontend to backend health route.
- [x] Create initial folder structure for frontend and backend.
- [x] Verify Supabase connection.

**Target Outcome:**
- Frontend runs locally
- Backend runs locally
- Supabase database connection works
- Initial API request succeeds

**Summary (Confirmed on March 5, 2026):**
- Frontend scaffold completed and built successfully (`npm run build` in `frontend`).
- Backend started successfully and responded correctly:
  - `GET /health` -> `200 OK` with `status: "ok"`.
  - `GET /version` -> `200 OK` with backend version and Node runtime.
- Supabase connectivity verified:
  - `GET /health/supabase` -> `200 OK` with message confirming Supabase auth endpoint reachability and valid API key.
- Frontend-backend integration confirmed via homepage health check wiring to backend `/health`.

---

## Session 2 — Authentication System

**Objective:** Migrate backend to TypeScript, then implement user authentication and role-based routing.

### Tasks
- [x] Migrate backend from JavaScript to TypeScript (`src/**/*.ts`, `tsconfig`, scripts, lint config).
- [x] Implement Supabase Auth (email/password)
- [x] Add role metadata: CSR, Manager, Executive, Admin, Customer
- [x] Build login page
- [x] Redirect users by role:
  - Customer ? `/portal`
  - CSR ? `/employee/csr`
  - Manager ? `/employee/manager`
  - Executive ? `/employee/executive`
  - Admin ? `/admin`
- [x] Implement Express middleware: `requireAuth`, `requireRole`
- [x] Test login/logout flows

**Target Outcome:**
- Backend runs on TypeScript cleanly
- Users can login/register
- Roles determine access to pages
- JWT auth works
- Role-based access enforced

**Summary (March 5, 2026):**
- Backend migrated to TypeScript with `tsconfig`, TypeScript lint/build scripts, and successful `npm run lint` + `npm run build`.
- Supabase auth routes implemented: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`.
- Role metadata and RBAC implemented for `CSR`, `Manager`, `Executive`, `Admin`, and `Customer`.
- Frontend `/login` now supports login/register and redirects by role to `/portal`, `/employee/csr`, `/employee/manager`, `/employee/executive`, `/admin`.
- Role-based access checks verified (`Customer` token: `/portal` -> 200, `/admin` -> 403).
- Live login/logout validation completed via Supabase MCP-provisioned confirmed test user (`session2.customer@example.com`) with expected auth/RBAC responses.
- Full role matrix verified via Supabase MCP users:
  - `Customer` -> `/portal` allowed, other protected role routes denied.
  - `CSR` -> `/employee/csr` allowed, other protected role routes denied.
  - `Manager` -> `/employee/manager` allowed, other protected role routes denied.
  - `Executive` -> `/employee/executive` allowed, other protected role routes denied.
  - `Admin` -> `/admin` allowed, other protected role routes denied.

**Optional: Split Frontend and Backend into Separate GitHub Repositories**
- Keep monorepo as default unless separate release cycles or teams require a split.
- Create two empty GitHub repos: `treecrm-frontend` and `treecrm-backend`.
- From the current repo, extract `frontend` history into a branch:
  - `git subtree split --prefix=frontend -b split/frontend`
- Push extracted frontend history to the new repo:
  - `git push https://github.com/<org-or-user>/treecrm-frontend.git split/frontend:main`
- Extract `backend` history into a branch:
  - `git subtree split --prefix=backend -b split/backend`
- Push extracted backend history to the new repo:
  - `git push https://github.com/<org-or-user>/treecrm-backend.git split/backend:main`
- Reconfigure deployments:
  - Vercel -> `treecrm-frontend`
  - Render -> `treecrm-backend`
- Keep this monorepo as integration repo, archive it, or convert it to a meta repo with links to both services.

---

## Session 3 — Core Database Models

**Objective:** Build database schema for TreeCRM.

### Tasks
- [x] Users table (id, email, name, role, created_at)
- [x] Customers table (id, user_id, company, contact_info, created_at)
- [x] Cases table (id, customer_id, assigned_to, title, description, status, priority, created_at, updated_at)
- [x] Tags table (id, name, color, affects_node_color)
- [x] CaseTags table (many-to-many between cases and tags)
- [x] Messages table (id, case_id, sender_id, sender_role, message_type, message_text, created_at)
- [x] Endorsements table (id, case_id, endorsed_by, endorsed_to, status, created_at)
- [x] Notifications table (id, user_id, type, message, read, created_at)
- [x] Test CRUD operations for each table

**Target Outcome:**
- Database schema exists
- Backend can create/read/update/delete records
- Supabase queries functional

**Summary (March 6, 2026):**
- Supabase migration `session_3_core_models` applied successfully via MCP and created the full Session 3 schema in `public`.
- Added tables: `users`, `customers`, `cases`, `tags`, `case_tags`, `messages`, `endorsements`, `notifications`.
- Added relational constraints, indexes, auth-user sync triggers, and automatic `cases.updated_at` handling.
- Added admin-protected backend CRUD routes under `/data/*` for all Session 3 tables.
- Added a backend smoke test script that exercised create/read/update/delete flows across the full Session 3 model set.
- Live CRUD verification succeeded on March 6, 2026, including auth-backed user creation plus full CRUD coverage for customers, cases, tags, case-tags, messages, endorsements, and notifications.
- Follow-up resolved in Session 4: admin `/data/*` routes now require and use `SUPABASE_SERVICE_ROLE_KEY`, including Supabase Auth admin create/update/delete flows.
- Security follow-up still pending: Supabase advisors report RLS is disabled on the new public tables. This was left unchanged to avoid breaking the current backend, which does not yet use a service-role key or Supabase JWT-based RLS.

---

## Session 4 — Employee Tree Interface

**Objective:** Build hierarchical tree interface.

### Tasks
- [x] Create TreeView component (employee -> customer -> case)
- [x] Implement expand/collapse nodes
- [x] Fetch hierarchical data from backend API
- [x] Configure backend with `SUPABASE_SERVICE_ROLE_KEY` for server-side admin CRUD/auth operations
- [x] Display employee, customer, and case nodes
- [x] Clicking node opens side panel with details
- [x] Style nodes using priority colors

**Target Outcome:**
- Tree renders dynamically
- Nodes expand/collapse
- Details appear in side panel

**Summary (March 6, 2026):**
- Added backend route GET /employee/tree with role-scoped hierarchy payloads (CSR, Manager, Executive, Admin) returning employee -> customer -> case nodes.
- Implemented new frontend EmployeeTreeWorkspace for CSR/Manager/Executive pages with interactive tree rendering, expand/collapse controls, and a node detail side panel.
- Added priority-based visual styling for case nodes (High, Medium, Low) and status/priority chips in both tree rows and detail panel.
- Wired frontend to fetch tree data from the backend API with auth token handling and role-aware route guarding.
- Updated admin backend data operations to use Supabase service-role admin flows for /data/*, including user create/update/delete through Supabase Auth admin APIs.
- Validation completed: backend npm run lint + npm run build, frontend npm run lint + npm run build.

---

## Session 5 — Case Management

**Objective:** Enable CSRs to manage cases.

### Tasks
- [x] Implement status updates (Open, In Progress, Resolved, Dropped)
- [x] Implement priority semicircle layout
- [x] Add manual tagging system
- [x] Add internal notes
- [x] Update backend APIs for case updates

**Target Outcome:**
- CSRs can update case status, priority, tags, notes
- Tree updates accordingly
- Backend reflects changes

**Summary (March 6, 2026):**
- Added CSR-scoped backend case management APIs under /employee/cases/:caseId/* for loading manage data, updating status/priority, saving tags, and creating internal notes.
- Enforced ownership checks so CSRs can only manage cases assigned to their own user ID.
- Added frontend case management client module for typed calls to new backend endpoints.
- Upgraded CSR tree UI with a priority semicircle case layout (High inner arc, Medium middle arc, Low outer arc).
- Added CSR details-panel controls to edit case status/priority, assign manual tags, and add/view internal notes.
- Validation completed: backend npm run lint + npm run build, frontend npm run lint + npm run build.

---

## Session 6 — Customer Portal

**Objective:** Build customer-facing interface.

### Tasks
- [x] Create dashboard listing all tickets
- [x] Implement ticket detail page (status, timeline, messages)
- [x] Build ticket submission form (subject, description, category, attachments)
- [x] Connect portal to backend API
- [x] Ensure tickets appear in CSR tree
**Target Outcome:**
- Customers can create tickets
- Customers can view/update status and chat
- Tickets reflect in CSR interface

**Summary (March 6, 2026):**
- Added new customer portal backend routes under /portal/tickets for authenticated Customer users:
  - GET /portal/tickets (dashboard list)
  - POST /portal/tickets (ticket creation with subject, description, category, attachments)
  - GET /portal/tickets/:caseId (ticket detail with status, timeline, and conversation)
  - POST /portal/tickets/:caseId/messages (customer chat messages)
- Added automatic customer profile provisioning (customers row) for authenticated customer users when missing.
- Added automatic CSR assignment during ticket creation using least-active-load selection across CSR users, so newly created tickets immediately appear in the CSR employee tree.
- Added timeline enrichment by recording system messages when CSR status changes (PATCH /employee/cases/:caseId), enabling customer-visible status transition history.
- Added frontend customer portal implementation:
  - /portal dashboard page with ticket list and ticket submission form
  - /portal/[ticketId] detail page showing ticket metadata, status flow, timeline, and message thread with send-message action
  - new frontend/lib/customerPortal.ts typed API client
- Added Supabase migration 20260306_session_6_customer_portal.sql to extend public.cases with:
  - category text not null default 'General'
  - attachments jsonb not null default '[]'::jsonb
  - integrity check cases_attachments_must_be_array
  - cases_category_idx index
- Follow-up completed (March 6, 2026): applied via Supabase MCP as migration `session_6_customer_portal` (version `20260306102029`).
---

## Session 7 — Chat System

**Objective:** Enable real-time communication.

### Tasks
- [x] Integrate Socket.io for real-time chat
- [x] Implement customer ? CSR messaging
- [x] Implement internal employee chat (CSR ? Manager/Executive)
- [x] Store messages in database
- [x] Trigger notifications for new messages

**Target Outcome:**
- Real-time chat works
- Messages appear instantly
- Notifications triggered

**Summary (March 6, 2026):**
- Added authenticated Socket.io realtime infrastructure on the backend with role-aware room joins:
  - case rooms (`case:<caseId>`) for customer/assigned CSR ticket chat
  - internal rooms (`internal:<userA>:<userB>`) for employee direct chat
  - user rooms (`user:<userId>`) for realtime notification delivery
- Added new backend employee chat APIs:
  - `GET /employee/cases/:caseId/messages`
  - `POST /employee/cases/:caseId/messages`
  - `GET /employee/internal-chat/contacts`
  - `GET /employee/internal-chat/:peerUserId/messages`
  - `POST /employee/internal-chat/:peerUserId/messages`
- Extended customer ticket messaging endpoint (`POST /portal/tickets/:caseId/messages`) to emit realtime case message events and create notifications for assigned CSRs.
- Implemented notification creation + realtime push for both chat channels:
  - customer -> CSR case messages
  - CSR -> customer case messages
  - employee internal direct messages
- Added Supabase migration `20260306_session_7_chat_system.sql` and applied via MCP as migration `session_7_chat_system` (version `20260306105648`) to create `public.internal_messages` with indexes.
- Updated frontend chat experience:
  - customer ticket detail page now joins case rooms and receives CSR replies in realtime
  - CSR case detail now includes realtime customer chat thread + reply form
  - employee workspace now includes realtime internal chat panel with role-filtered contacts, live conversation updates, and latest notification feed
- Validation completed:
  - backend `npm run lint` + `npm run build`
  - frontend `npm run lint` + `npm run build`

---

## Session 8 — Endorsements & Reassignment

**Objective:** Implement case escalation workflow.

### Tasks
- [ ] Enable CSR ? Manager/Executive endorsements
- [ ] Highlight endorsed cases in yellow
- [ ] Allow Manager/Executive to accept/reject endorsements
- [ ] Enable Managers to reassign cases to other CSRs
- [ ] Send notifications for endorsements and reassignments

**Target Outcome:**
- Endorsement workflow functional
- Case reassignment works
- Visual cues and notifications update in real-time

---

## Session 9 — Metrics & Dashboards

**Objective:** Track performance metrics and display dashboards.

### Tasks
- [ ] Calculate CSR metrics (ongoing cases, resolved today, customer satisfaction)
- [ ] Display CSR metrics in tree nodes
- [ ] Managers can view team metrics
- [ ] Executives can view aggregated manager metrics
- [ ] Update backend API for metrics calculation

**Target Outcome:**
- Performance metrics visible to employees
- Managers/executives can monitor workloads
- Metrics update dynamically with case changes

---

## Session 10 — Admin Panel & Deployment

**Objective:** Finalize admin tools and deploy the system.

### Tasks
- [ ] Create admin panel for user and role management
- [ ] Configure tags, priorities, system settings
- [ ] Conduct end-to-end testing:
  - Customer ? CSR workflow
  - Chat
  - Endorsements
  - Reassignments
  - Notifications
- [ ] Deploy frontend ? Vercel
- [ ] Deploy backend ? Render
- [ ] Connect backend to Supabase
- [ ] Enable RLS and add policies for Session 3 public tables (`users`, `customers`, `cases`, `tags`, `case_tags`, `messages`, `endorsements`, `notifications`)
- [ ] Verify live system works

**Target Outcome:**
- Admin panel functional
- All workflows tested successfully
- Application deployed and operational
- System ready for use

---



**Execution Reminder (MCP First):**
- For Session 2 auth testing and user setup, use the Supabase MCP server first (create users, set role metadata, verify auth paths) before manual Dashboard workflows.




