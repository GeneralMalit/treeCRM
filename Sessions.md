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
- [x] Enable CSR ? Manager/Executive endorsements
- [x] Highlight endorsed cases in yellow
- [x] Allow Manager/Executive to accept/reject endorsements
- [x] Enable Managers to reassign cases to other CSRs
- [x] Send notifications for endorsements and reassignments

**Target Outcome:**
- Endorsement workflow functional
- Case reassignment works
- Visual cues and notifications update in real-time

**Summary (March 7, 2026):**
- Added Session 8 backend workflow APIs:
  - `GET /employee/cases/:caseId/workflow`
  - `POST /employee/cases/:caseId/endorsements`
  - `PATCH /employee/endorsements/:endorsementId`
  - `PATCH /employee/cases/:caseId/reassign`
- Implemented CSR endorsement flow to Manager/Executive users with duplicate-pending safeguards and system timeline messages.
- Implemented Manager/Executive/Admin endorsement decisions (accept/reject) with role checks and decision notifications to affected users.
- Implemented case reassignment to CSR users with optional reason, automatic pending-endorsement cancellation, and reassignment notifications.
- Extended `/employee/tree` case payloads with pending-endorsement metadata so endorsed cases can be highlighted in the UI.
- Updated employee workspace UI to:
  - render endorsed cases in yellow in tree nodes and case details
  - show escalation timeline/details in the case panel
  - allow CSR endorsement actions
  - allow Manager/Executive endorsement decisions
  - allow case reassignment controls for Manager/Executive/Admin sessions
- Added realtime-driven visual refresh on endorsement/reassignment notification events so case highlights and assignment state update without manual reload.
- Validation completed:
  - backend `npm run lint` + `npm run build`
  - frontend `npm run lint` + `npm run build`

---

## Session 9 — Metrics & Dashboards

**Objective:** Track performance metrics and display dashboards.

### Tasks
- [x] Calculate CSR metrics (ongoing cases, resolved today, customer satisfaction)
- [x] Display CSR metrics in tree nodes
- [x] Managers can view team metrics
- [x] Executives can view aggregated manager metrics
- [x] Update backend API for metrics calculation

**Target Outcome:**
- Performance metrics visible to employees
- Managers/executives can monitor workloads
- Metrics update dynamically with case changes


**Summary (March 7, 2026):**
- Extended `GET /employee/tree` to calculate live metrics for each employee node:
  - `ongoingCases` (Open + In Progress)
  - `resolvedToday` (Resolved cases updated since UTC day start)
  - `customerSatisfaction` (temporary proxy: `resolvedCases / (resolvedCases + droppedCases)` as a percentage)
  - plus supporting totals (`totalCases`, `resolvedCases`, `droppedCases`, `completedCases`)
- Added CSR metrics directly to tree employee nodes and to the employee details panel.
- Added manager team-metrics payload + UI display for manager sessions.
- Added executive/admin manager-aggregate payload + UI rollup, including per-manager cards and unassigned CSR visibility.
- Added fallback manager-team allocation mode (`derived_balanced_fallback`) when explicit manager-to-CSR assignments are missing, so dashboards still show actionable metrics without manual setup.
- Follow-up queued for Session 10: replace the proxy customer satisfaction metric with explicit customer CSAT capture (customer submits a 1-5 rating on resolved cases in the portal, stored per case and aggregated per CSR).
- Updated frontend type-safe tree parsing (`frontend/lib/employeeTree.ts`) for new metrics/team/aggregate structures.
- Validation completed:
  - backend `npm run lint` + `npm run build`
  - frontend `npm run lint` + `npm run build`

---

## Session 10 ? Admin Panel & Deployment

**Objective:** Finalize admin tools and deploy the system.

### Tasks
- [x] Create admin panel for user and role management
- [x] Configure tags, priorities, system settings
- [x] Implement explicit customer satisfaction capture (1-5 customer rating on resolved tickets) and use it as the source for CSR `customerSatisfaction` metrics
- [x] Conduct end-to-end testing:
  - Customer ? CSR workflow
  - Chat
  - Endorsements
  - Reassignments
  - Notifications
- [ ] Deploy frontend ? Vercel
- [ ] Deploy backend ? Render
- [x] Connect backend to Supabase
- [x] Enable RLS and add policies for Session 3 public tables (`users`, `customers`, `cases`, `tags`, `case_tags`, `messages`, `endorsements`, `notifications`)
- [ ] Verify live system works

**Target Outcome:**
- Admin panel functional
- All workflows tested successfully
- Application deployed and operational
- System ready for use

**Summary (March 7, 2026):**
- Added a full `/admin` workspace with authenticated Admin-only controls for:
  - user creation, role updates, and account deletion
  - tag creation/update/delete
  - system settings management (`availabilityRefreshMinutes`, `defaultCasePriority`, `priorityStyleMap`)
- Added backend admin settings APIs:
  - `GET /admin/settings`
  - `PATCH /admin/settings`
- Added `public.system_settings` persistence and wired ticket creation to use configured default case priority.
- Added explicit customer CSAT capture:
  - DB fields on `public.cases`: `customer_satisfaction_rating` (1-5) + `customer_satisfaction_submitted_at`
  - API endpoint: `POST /portal/tickets/:caseId/customer-satisfaction`
  - Portal UI for resolved-ticket rating submission and CSAT visibility.
- Replaced proxy CSAT computation with explicit customer ratings in `/employee/tree` metrics (aggregated as a percentage of real 1-5 ratings).
- Applied Supabase migrations via MCP:
  - `session_10_admin_deployment` (version `20260307004844`) for CSAT columns, `system_settings`, and Session 3-table RLS policies.
  - `session_10_manager_assignments` (version `20260307011346`) adding `users.manager_id` support.
- Validation completed:
  - backend `npm run lint` + `npm run build`
  - frontend `npm run lint` + `npm run build`
  - end-to-end workflow smoke test `npm run test:session10` (customer workflow, chat, endorsements, reassignment, notifications, CSAT metrics).
- Remaining Session 10 work requires deployment-account access:
  - Deploy frontend to Vercel
  - Deploy backend to Render
  - Verify the live hosted system end-to-end.


---


## Session 11 ? Deployment & Live Verification

**Objective:** Complete production deployment and validate the hosted stack.

### Tasks
- [x] Authenticate Vercel CLI locally (ercel login) and verify account access (ercel whoami).
- [x] Deploy frontend to Vercel.
- [x] Set frontend production environment variable NEXT_PUBLIC_API_URL to the deployed backend URL.
- [x] Prepare Render access (CLI or dashboard), then deploy backend to Render.
- [x] Configure backend production environment variables on Render (PORT, FRONTEND_ORIGIN, SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET).
- [x] Verify deployed backend connectivity (/health, /health/supabase) against production settings.
- [x] Verify live hosted workflows end-to-end:
  - Customer ? CSR ticket workflow
  - Realtime chat
  - Endorsements
  - Reassignments
  - Notifications
  - Customer CSAT capture and metric rollups
- [x] Optional hardening follow-up: enable RLS + policies for public.internal_messages.

**Target Outcome:**
- Frontend and backend deployed successfully
- Hosted environment variables configured correctly
- Live end-to-end workflows validated in production
- Deployment handoff complete


**Summary (March 7, 2026):**
- Backend now on Render with FRONTEND_ORIGIN matched to the Vercel URL, all env vars configured, and /health + /health/supabase returning status: ok.
- Frontend lives at https://treecrm-frontend.vercel.app/ with NEXT_PUBLIC_API_URL/NEXT_PUBLIC_SOCKET_URL pointing to the Render backend so auth, chat, endorsement, reassignment, notification, and CSAT flows all work in production.
- Session 11 also delivered RLS for public.internal_messages as documented in docs/session_11_internal_messages_rls.sql, ensuring internal chats remain limited to employees.


**Execution Reminder (MCP First):**
- For Session 2 auth testing and user setup, use the Supabase MCP server first (create users, set role metadata, verify auth paths) before manual Dashboard workflows.


---

## Session 12 - Skill Tree Graph, Escalation Clarification, and CSR Custom Tags

**Objective:** Implement the Session 12 execution plan for the employee skill-tree UI redesign, approval-only escalation semantics, and CSR custom tag creation.

### Plan Document Location
- docs/session_12_skill_tree_plan.md
- Absolute path: d:\Desktop\Main\Files\Programming\Projects\treeCRM\docs\session_12_skill_tree_plan.md

### Tasks
- [x] Implement skill-tree style employee graph UI (CSR radial case rings + manager/executive hierarchy focus flow).
- [x] Keep escalation as approval-only (no automatic reassignment on endorsement approval).
- [x] Enable CSR custom tag creation during case tag updates.
- [x] Run lint/build/smoke validation.
- [ ] Complete production verification.

**Execution Reference:** See docs/session_12_skill_tree_plan.md for the full decision-complete implementation details.

**Summary (March 7, 2026):**
- Replaced the old list-style employee tree in the workspace with graph-driven canvases:
  - CSR sessions now render a focused radial skill tree with customer context nodes and priority-based case rings.
  - Manager/Executive/Admin sessions now render an employee hierarchy graph first, then open a focused CSR skill tree on CSR selection.
- Extended `GET /employee/tree` to include employee hierarchy metadata (`managerId`) so the frontend can render explicit reporting links.
- Locked endorsement decisions to approval-only semantics in both API and UI:
  - `PATCH /employee/endorsements/:endorsementId` now returns `caseAssignmentChanged: false`.
  - Workflow copy now explicitly states approval does not reassign the case.
  - System timeline messages now state that assignment remains unchanged unless a separate reassignment is performed.
- Extended `PUT /employee/cases/:caseId/tags` so CSR users can submit `customTagNames` alongside `tagIds`, with case-insensitive resolution against shared tags and automatic creation of missing shared tags.
- Updated the CSR case-management panel to stage custom tags inline, add them with Enter/button interactions, and clear drafts after save.
- Local validation completed successfully:
  - backend `npm run lint`
  - backend `npm run build`
  - backend `npm run test:session10` (now includes Session 12 assertions for custom tags and approval-without-reassignment)
  - frontend `npm run lint`
  - frontend `npm run build`
- Production verification is still pending because the local workspace is configured against `http://localhost:4000` / `http://localhost:3000`, not the deployed Session 11 URLs.

---

## Session 13 - Unified Infinite-Canvas Tree Visualization

**Objective:** Replace the split employee hierarchy and CSR graph views with a single progressive infinite-canvas tree so drilling through the org/customer/case structure happens in one workspace.

### Tasks
- [x] Merge the separate employee hierarchy and CSR skill-tree panels into one canvas-based tree.
- [x] Add unified tree data types and builder logic for employee, customer, and case nodes.
- [x] Add layout logic for hierarchy fan-out and priority-ring case placement.
- [x] Add expand/collapse, pan/zoom, and reset-view interactions in the unified canvas.
- [x] Keep selection behavior wired to the existing detail and chat panels.
- [ ] Complete manual role-based regression testing in the deployed environment.

**Target Outcome:**
- Employee workspace uses one infinite canvas instead of two disconnected graph modes
- CSR, Manager, Executive, and Admin flows drill progressively through the same tree
- Case priority remains visually encoded while navigation friction is reduced

**Summary (March 7, 2026):**
- Replaced the two-panel employee graph experience with a unified infinite-canvas tree workspace.
- Added shared unified tree model types and `buildUnifiedTree()` so employee, customer, and case relationships are emitted from one source of truth for the canvas.
- Added `layoutUnifiedTree()` to position hierarchy nodes with fan-out spacing and render case children in priority-based rings around the expanded customer context.
- Added `UnifiedTreeCanvas.tsx` with pan/zoom, expand/collapse controls, priority arcs, and reset-view behavior while preserving existing selection callbacks for employee/customer/case detail panels.
- Updated `EmployeeTreeWorkspace.tsx` to track expanded node state instead of switching between separate focused graph modes.
- Local validation reported in the walkthrough:
  - frontend lint: 0 errors, 2 non-blocking warnings
  - frontend build: successful TypeScript + Next.js compilation
- Outstanding follow-up:
  - verify CSR drill flow (CSR -> customer -> cases) against the deployed stack
  - verify Manager drill flow (Manager -> CSR -> customer -> cases)
  - verify Executive drill flow (Executive -> Manager -> CSR -> customer -> cases)
  - confirm pan/zoom and reset-view behavior across desktop and mobile-sized viewports

---

## Session 14 - Tree View UX Fixes, CSR Visibility Rules, and Customer/Case Unification

**Objective:** Resolve Tree View readability issues, simplify node semantics, and align CSR visibility behavior with active ownership expectations.

### Plan Document Location
- docs/session_14_tree_view_ui_fixes_plan.md
- Absolute path: d:\Desktop\Main\Files\Programming\Projects\treeCRM\docs\session_14_tree_view_ui_fixes_plan.md

### Tasks
- [x] Hide resolved assigned cases from CSR tree visibility while preserving metrics history.
- [x] Replace separate customer layer in the unified canvas with direct combined customer/case nodes.
- [x] Add collision-aware dynamic layout spacing with expansion animation push-back.
- [x] Remove in-node ongoing/resolved metric text and hide priority visuals in the tree.
- [x] Merge customer and case details into one combined details panel flow.
- [x] Remove redundant "Skill Tree Graph" framing and declutter legend with collapsed toggle.
- [x] Extend Session 10 smoke test assertions for CSR/manager resolved visibility behavior.
- [x] Run backend/frontend lint + build checks and rerun Session 10 smoke test.
- [ ] Complete deployed-environment manual regression pass.

**Target Outcome:**
- Tree View remains readable during dense expansion
- CSR sees only active assigned customer/case nodes (resolved hidden)
- Customer/case interaction is unified into one node and one details context
- Priority remains operational for CSR case management but not visually emphasized in tree navigation

**Summary (March 8, 2026):**
- Updated backend `/employee/tree` case scoping into metrics scope vs. tree-visibility scope, with CSR tree visibility excluding resolved cases only.
- Kept aggregate and employee metrics computed from all in-scope assigned cases, preventing historical metric regressions.
- Refactored unified tree model to remove separate customer nodes and emit direct combined customer/case case nodes in the active canvas flow.
- Replaced fixed-case-ring placement with collision-aware relaxed layout and animated transitions so expansion events push nearby nodes apart while preserving hierarchy shape.
- Simplified tree visuals by removing in-node employee metric strings and hiding priority-specific visuals from the tree and legend.
- Updated details panel to a combined customer/case view including customer name, user ID, linked employee, created/updated dates, description, contact info entries, and raw JSON.
- Removed outer "Skill Tree Graph" heading, retaining a single "Tree View" label and introducing a collapsed legend toggle with reduced key density.
- Extended `backend/scripts/session10E2eSmokeTest.ts` to assert CSR resolved-case hiding and manager resolved-case visibility.
- Validation completed locally:
  - backend `npm run lint`
  - backend `npm run build`
  - frontend `npm run lint`
  - frontend `npm run build`
  - backend `npm run test:session10`
