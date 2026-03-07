# TreeCRM - Full Vision & System Overview

## Core Concept
TreeCRM is a visual customer service management platform that combines traditional ticketing with a hierarchical graphical interface for support operations.

It has two primary experiences:
1. Employee Interface (Tree View): for CSRs, Managers, Executives, and Administrators to visualize and manage workflows.
2. Customer Portal: for customers to create tickets, track progress, and communicate with support.

Its central innovation is the organizational tree interface, which shows relationships among employees, customers, and cases. Instead of relying only on dashboards, tables, and queues, TreeCRM presents support operations as a living structure so overloads, bottlenecks, and priority issues are visible quickly.

## System Philosophy
Most CRM/support tools are list- and dashboard-heavy, which forces heavy mental interpretation. TreeCRM prioritizes visual cognition by representing operations as a hierarchy users can understand at a glance.

Benefits by role:
- Managers: spot overloaded CSRs, unresolved-case clusters, and priority issues.
- Executives: monitor department health, escalation patterns, and structural inefficiencies.
- CSRs: organize cases visually, prioritize naturally, and track customer relationships.
- Administrators: control structure/configuration, maintain integrity, and manage org changes.
- Customers: get clear ticket tracking, transparent agent communication, and simple status visibility.

Goal: reduce cognitive friction in support management while retaining ticketing-system simplicity.

## System Architecture
TreeCRM is a three-layer system:
1. Frontend interface.
2. Backend logic server.
3. Database and authentication.

## Technology Stack
### Frontend
Built with Next.js. Uses:
- Next.js (React framework)
- Tailwind CSS (layout/styling)
- Material UI (components)
- React Query or Axios (data fetching/caching)
- Socket.io WebSocket client

Includes two app experiences (Employee Interface and Customer Portal) that share auth/API access but have different UIs. Deployed on Vercel.

### Backend
Built with Node.js + Express. The backend is intentionally scaffolded in JavaScript during Session 1 for fast initialization, then migrated to TypeScript in Session 2 before deeper auth and domain logic work.

Handles business logic beyond basic database operations, including:
- role-based access control
- case endorsements
- case reassignment
- performance metric calculation
- notification generation
- chat routing
- ticket workflow management

Current backend structure also includes:
- auth routes for register, login, session inspection, and logout
- admin-protected CRUD routes under `/data/*` for core CRM models
- authenticated Socket.io room orchestration for case chat, internal employee chat, and user-level notification push
- employee chat APIs for case conversations (`/employee/cases/:caseId/messages`) and internal direct threads (`/employee/internal-chat/*`)

Uses Supabase PostgreSQL, with realtime chat/notifications via Socket.io. Deployed on Render free tier.

### Database
Uses Supabase PostgreSQL as system source of truth. Supabase also provides:
- authentication
- database access control
- optional realtime subscriptions
- file storage for attachments

Current implemented core schema includes:
- `users` synchronized from Supabase Auth metadata
- `customers`
- `cases`
- `tags`
- `case_tags`
- `messages`
- `endorsements`
- `notifications`

Current implementation note:
- the backend is presently configured with a publishable Supabase key for regular operations
- full Auth-user administration from the backend still requires `SUPABASE_SERVICE_ROLE_KEY`
- RLS policy rollout for the new public tables is planned as a later hardening step

## System Interfaces
TreeCRM has two main interfaces: Employee Interface (Tree System) and Customer Portal.

## Employee Interface (Tree System)
Primary operational control center with a hierarchical tree showing organization and active cases.

**Status (March 6, 2026):** Session 4 delivered a working tree supporting CSR/Manager/Executive dashboards, consuming live data, expand/collapse navigation, and priority-styled case detail panels. CSR tree now lets CSR users update case status, priority, tags, and internal notes while keeping the visual hierarchy in sync with backend changes.


Example structure:
```text
Executive
   + Manager
        + CSR
             + Customers
                  + Cases
```

Each level owns responsibility for nodes beneath it:
- Managers oversee CSRs.
- CSRs manage customers.
- Customers contain cases.

### Tree Nodes
Three major node types:
- Employee nodes
- Customer nodes
- Case nodes

Shared interactions:
- expand/collapse
- click for details
- visual status indicators

Clicking a node opens a side panel with detailed information.

## Employee Roles
### Customer Service Representative (CSR)
Frontline agent interacting directly with customers and handling cases.

Responsibilities:
- manage assigned customers
- respond to customer messages
- update case status
- apply case tags
- set case priority
- add internal notes
- endorse cases upward

CSR tree view (self as root):
```text
CSR (You)
   + Customer A
   ?   + Case 1
   ?   + Case 2
   + Customer B
   ?   + Case 3
   + Customer C
```

Cases are arranged visually by priority using semicircles:
- high: closest
- medium: middle
- low/untagged: outer

### Manager
Oversees CSRs; usually does not directly manage customers unless escalated.

Capabilities:
- view supervised CSRs
- inspect CSR workloads
- reassign cases between CSRs
- override CSR ownership
- view CSR metrics

Scope is restricted to their own team (cannot view other managers' CSRs).

Manager metrics in node detail panel:
- number of ongoing cases
- cases handled today
- customer satisfaction score

### Executive
Oversees managers and broader operations.

Capabilities:
- view managers and their teams
- expand manager nodes to inspect CSRs
- override any case
- accept escalated cases
- observe team-level metrics

Focus is operational oversight rather than day-to-day handling.

### Administrator
Maintains system with full data/configuration access.

Capabilities:
- create/manage user accounts
- configure tagging systems
- modify system settings
- adjust availability intervals
- override any case
- access all metrics

Typically not part of normal case handling.

## Case System
A case is the core support ticket unit linked to a customer.

Case fields:
- Case ID
- title
- status
- priority
- tags
- assigned employee
- customer info
- message history
- action timeline
- internal notes

Case lifecycle:
```text
Open -> In Progress -> Resolved -> Dropped
```
Status changes are visible internally and externally.

### Case Tags
Manual categorization (examples: Emergency, Billing, Technical, VIP, FAQ, Account). Tags may optionally affect node color, and tag rules are configurable.

### Case Endorsements
CSR escalation paths include:
```text
CSR -> Manager
CSR -> Executive
```

On endorsement:
- case node turns yellow
- endorsed employee receives notification
- CSR keeps working until accepted
- if rejected, node returns to normal

### Case Reassignment
Managers/executives can reassign:
```text
CSR A -> CSR B
CSR -> Manager
CSR -> Executive
```

On reassignment:
- case disappears from prior owner
- appears under new owner
- notification is sent

Example:
```text
Case #3241 has been reassigned
Reason: workload redistribution
```

## Notifications
Personal notifications (bell with unread count) trigger on:
- case reassignment
- case endorsement
- chat messages
- status updates

## Employee Availability
Node color indicates presence:
- white: logged in
- grey: offline

Availability refreshes every 15 minutes; administrators can change this interval.

## Internal Communication
Internal chat supports:
```text
CSR <-> CSR
CSR <-> Manager
Manager <-> Executive
```

Chat context includes employee name, role, schedule, and active cases. Internal chats are separate from customer conversations.

**Status (March 6, 2026):** Realtime internal employee chat is now implemented for employee roles with role-filtered contacts, persisted direct messages (`public.internal_messages`), and notification fan-out through Socket.io user rooms.

## Customer Portal
Customers do not see the org tree; they use a simplified portal.

Capabilities:
- log in
- submit tickets
- view tickets
- track status
- communicate with support
- review ticket history

Customers cannot access internal data.

**Status (March 6, 2026):** Session 6 customer portal scope is complete. Customers can create tickets, view ticket detail/timeline, and exchange messages with support. Session 7 added realtime delivery so new CSR replies appear without manual refresh.

### Customer Ticket Page
Includes three sections:

1. Ticket Information
```text
Ticket #58213
Status: In Progress
Assigned Agent: John Smith
Priority: High
```

2. Chat Conversation (customer-CSR messaging)
```text
Customer: My internet stopped working
CSR: Hello, I'm checking this for you now
Customer: Thanks
CSR: We identified the issue and are fixing it
```
Messages include sender, role, and timestamp.

3. Ticket Timeline
```text
Ticket created
Assigned to CSR
Status changed to In Progress
Resolved
```

Customers also see visual status progress:
```text
Created -> Assigned -> In Progress -> Resolved
```

### Creating a Ticket
Ticket form fields:
- Subject
- Description
- Attachments
- Category

After submission:
1. Case is created in the database.
2. It is assigned to a CSR.
3. It appears in the CSR tree.

## Real-Time Interaction
Realtime behavior via live updates:
```text
Customer message -> CSR notification
CSR reply -> Customer sees message instantly
```

**Status (March 6, 2026):** This behavior is now live via Socket.io on both customer ticket pages and employee workspace chat panels.

## Current Risks & Dependencies
- Session 3 public-table RLS hardening is now implemented (`users`, `customers`, `cases`, `tags`, `case_tags`, `messages`, `endorsements`, `notifications`).
- Session 6 smoke test reliability can be impacted by Supabase email-rate limits when creating multiple fresh auth users quickly.
- `public.internal_messages` still has RLS disabled (outside the Session 3-scope hardening list and still pending).
- Next dependency is Session 11 deployment completion (Vercel + Render) and live hosted verification.

## Performance Metrics
Managers and executives track CSR metrics:
- ongoing cases
- cases handled today
- customer satisfaction score

Metrics are surfaced in employee nodes.

**Status (March 7, 2026):** Session 10 CSAT follow-up is now implemented.
- Backend `/employee/tree` now returns role-scoped performance metrics for each employee node (`ongoingCases`, `resolvedToday`, `customerSatisfaction`, and supporting totals).
- CSR nodes in the tree now surface metrics directly, with matching detail-panel visibility.
- Manager sessions now include team metrics rollups.
- Executive/Admin sessions now include manager aggregate rollups, per-manager metric cards, and unassigned-CSR visibility.
- Customer satisfaction is now sourced from explicit customer CSAT submissions (1-5 ratings on resolved tickets), aggregated into employee metrics.

## End Goal
TreeCRM aims to be a complete support management platform that merges ticketing simplicity with visual organizational monitoring.

Outcomes:
- customers get a familiar support experience
- employees get a visual workload-management system
- managers get operational visibility
- executives get structural insight

Result: the full support system becomes understandable at a glance, enabling faster decisions and better service outcomes.




## Development Reminder (MCP First)
For Supabase-related work in this repo, use the Supabase MCP server first before manual Dashboard steps. Use MCP for creating test users, setting role metadata, and auth verification whenever possible.

