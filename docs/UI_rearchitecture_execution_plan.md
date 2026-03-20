# UI Rearchitecture Execution Plan

This document replaces the lighter UI plan with a decision-complete execution checklist for smaller agents. The goal is to fix the underlying information architecture problem across admin, employee, and portal experiences without changing backend behavior, auth rules, or business logic unless a UI fix exposes a real breakage.

## Summary

- [x] Replace the current "one giant workspace page" pattern with a shared authenticated shell.
- [x] Preserve current root URLs: `/admin`, `/employee/csr`, `/employee/manager`, `/employee/executive`, `/portal`, `/portal/[ticketId]`.
- [x] Add role-specific subpages under those existing roots instead of forcing everything into one screen.
- [x] Move create/edit flows out of giant inline forms and into dialogs or drawers.
- [x] Replace repeated card stacks with tables, lists, bounded sections, and route-level separation of concerns.
- [x] Keep data fetching, payload shapes, auth guards, and backend integrations intact unless a UI-only implementation is impossible without a tiny supporting adjustment.

## Non-Negotiable Rules

- [x] Do not add new UI dependencies.
- [x] Use only existing MUI primitives already in the project.
- [x] Do not introduce `@mui/x-data-grid`.
- [x] Do not change backend endpoints, request payloads, or response contracts.
- [x] Do not change role definitions in [frontend/lib/roles.ts](../frontend/lib/roles.ts).
- [x] Do not invent a second design system while implementing the shell.
- [x] Do not keep legacy giant-page workflows alive after their split replacement exists.
- [x] Do not leave duplicated logout/header/action patterns scattered per page once shell components exist.
- [x] Do not use freeform color inputs for tags in the redesigned admin UI.
- [x] Do not use repeated stacked cards for large collections of users, tags, messages, or tickets.

## Current Problems Confirmed In Repo

- [x] Admin is currently one large control center in [frontend/components/AdminWorkspace.tsx](../frontend/components/AdminWorkspace.tsx).
- [x] Employee roles currently share the same overloaded workspace pattern through [frontend/components/EmployeeTreeWorkspace.tsx](../frontend/components/EmployeeTreeWorkspace.tsx).
- [x] Portal index currently shows ticket creation and ticket management as peer surfaces in [frontend/app/portal/page.tsx](../frontend/app/portal/page.tsx).
- [x] Portal detail currently gives equal visual weight to metadata, timeline, and conversation when conversation should dominate in [frontend/app/portal/[ticketId]/page.tsx](../frontend/app/portal/[ticketId]/page.tsx).
- [x] Role wrappers and placeholder screens repeat the same oversized panel pattern in [frontend/components/RoleDashboard.tsx](../frontend/components/RoleDashboard.tsx), [frontend/app/employee/page.tsx](../frontend/app/employee/page.tsx), and [frontend/app/customer/page.tsx](../frontend/app/customer/page.tsx).
- [x] Login is visually sparse and disconnected from the rest of the app in [frontend/app/login/page.tsx](../frontend/app/login/page.tsx).
- [x] The app has no persistent authenticated navigation, no role-specific shell, and weak separation of concerns.

## Target Navigation Model

- [x] Use a shared authenticated shell across admin, employee, and portal experiences.
- [x] Keep public pages outside that shell.
- [x] Use a persistent left sidebar on desktop.
- [x] Use a temporary drawer sidebar on mobile.
- [x] Use a top bar for page title, role context, and page-level actions.
- [x] Use route-level separation for distinct workflows.
- [x] Use tabs only inside a page when the content belongs to the same workflow and same dataset.
- [x] Preserve current root routes and expand beneath them instead of reorganizing the whole app into a new top-level route structure.

## Final Route Map

### Admin

- [x] Keep `/admin` as admin landing page.
- [x] Add `/admin/users`.
- [x] Add `/admin/tags`.
- [x] Add `/admin/settings`.

### Employee

- [x] Keep `/employee/csr`.
- [x] Keep `/employee/manager`.
- [x] Keep `/employee/executive`.
- [x] Add `/employee/csr/workspace`.
- [x] Add `/employee/csr/messages`.
- [x] Add `/employee/manager/overview`.
- [x] Add `/employee/manager/workspace`.
- [x] Add `/employee/manager/messages`.
- [x] Add `/employee/executive/overview`.
- [x] Add `/employee/executive/workspace`.
- [x] Add `/employee/executive/messages`.
- [x] Make `/employee/csr` redirect to `/employee/csr/workspace`.
- [x] Make `/employee/manager` redirect to `/employee/manager/overview`.
- [x] Make `/employee/executive` redirect to `/employee/executive/overview`.

### Portal

- [x] Keep `/portal`.
- [x] Keep `/portal/[ticketId]`.
- [x] Do not add extra portal routes unless absolutely necessary.

## Shell Components To Create

- [x] Create `frontend/components/shell/AuthenticatedShell.tsx`.
- [x] Create `frontend/components/shell/ShellSidebar.tsx`.
- [x] Create `frontend/components/shell/ShellTopbar.tsx`.
- [x] Create `frontend/components/shell/ShellPageHeader.tsx`.
- [x] Create `frontend/components/shell/ShellSection.tsx`.
- [x] Create `frontend/components/shell/ShellStatStrip.tsx`.
- [x] Create `frontend/components/shell/ShellEmptyState.tsx`.
- [x] Create a shared nav item type for the shell.
- [x] Create role-specific nav configs for admin, CSR, manager, executive, and customer.
- [x] Create helper logic for active-route matching.
- [x] Keep shell concerns UI-only and avoid embedding business logic into shell components.

## Shell Behavior Requirements

- [x] Sidebar width on desktop must be `264px`.
- [x] Top bar height must be `64px`.
- [x] Main content must scroll independently and never push the sidebar off screen.
- [x] Mobile sidebar must open via hamburger button in top bar.
- [x] Top bar must contain page title and page-level actions.
- [x] Logout must move into top bar or user menu, not stay duplicated in page bodies.
- [x] Home link should be removed from authenticated content pages if shell nav makes it redundant.
- [x] Page headers must be separate from content sections.
- [x] No authenticated page should begin with a giant standalone card containing the title and action buttons.

## Shared Visual Rules

- [x] Keep background calm and workspace-oriented.
- [x] Keep section surfaces flat or very low elevation.
- [x] Use section boundaries, spacing, and typography for hierarchy instead of decorative cards.
- [x] Limit each page to no more than two primary work surfaces.
- [x] Remove nested `Paper` inside `Paper` unless the nested component is a genuinely distinct artifact.
- [x] Treat `Chip` as metadata only, not as primary layout.
- [x] Do not allow dense metadata chips to become a wall of badges.
- [x] Standardize content padding:
- [x] Mobile page padding `16px`.
- [x] Tablet page padding `24px`.
- [x] Desktop page padding `32px`.
- [x] Section spacing `24px`.
- [x] Use tables or list rows for collections larger than 8 items.
- [x] Use dialogs or drawers for create/edit flows.
- [x] Do not place large create forms above long collections.
- [x] Do not use freeform hex text entry for tag colors.

## Tag Color Preset Rules

- [x] Define a constant `TAG_COLOR_PRESETS` with exactly 16 colors.
- [x] Use these preset values only:
- [x] `#64748b`
- [x] `#ef4444`
- [x] `#f97316`
- [x] `#f59e0b`
- [x] `#eab308`
- [x] `#84cc16`
- [x] `#22c55e`
- [x] `#10b981`
- [x] `#14b8a6`
- [x] `#06b6d4`
- [x] `#0ea5e9`
- [x] `#3b82f6`
- [x] `#6366f1`
- [x] `#8b5cf6`
- [x] `#d946ef`
- [x] `#ec4899`
- [x] Present colors as clickable swatches.
- [x] Keep stored tag color values compatible with existing hex format.
- [x] Remove the large freeform color field from the admin primary UI.

## P0 - Shared Structure And Admin Decomposition

### P0 Goal

- [x] Establish the authenticated shell and fix the worst information architecture failure first: admin.

### P0.1 Shared Layout Foundation

- [x] Create authenticated shell components and supporting nav config types.
- [x] Add role-level layout files:
- [x] `frontend/app/admin/layout.tsx`
- [x] `frontend/app/portal/layout.tsx`
- [x] `frontend/app/employee/csr/layout.tsx`
- [x] `frontend/app/employee/manager/layout.tsx`
- [x] `frontend/app/employee/executive/layout.tsx`
- [x] Ensure public pages still use [frontend/app/layout.tsx](../frontend/app/layout.tsx) without authenticated chrome.
- [x] Make sure shell works on desktop and mobile.
- [x] Move generic authenticated actions into shell patterns.
- [x] Stop duplicating logout and page-title blocks in every role screen.

### P0.2 Admin Page Split

- [x] Stop using [frontend/components/AdminWorkspace.tsx](../frontend/components/AdminWorkspace.tsx) as the whole admin product.
- [x] Break admin UI into separate page-focused components.
- [x] Keep existing handlers and data functions where possible.
- [x] Reuse existing API calls:
- [x] `fetchAdminUsers`
- [x] `fetchAdminTags`
- [x] `fetchAdminSettings`
- [x] `createAdminUser`
- [x] `updateAdminUser`
- [x] `deleteAdminUser`
- [x] `createAdminTag`
- [x] `updateAdminTag`
- [x] `deleteAdminTag`
- [x] `updateAdminSettings`

### P0.3 Admin Overview Page

- [x] Turn `/admin` into an overview page, not an editing surface.
- [x] Show only high-value summary information:
- [x] total users
- [x] employee count
- [x] admin count
- [x] tag count
- [x] Add shortcut cards or shortcut buttons to `Users`, `Tags`, and `Settings`.
- [x] Show at most one status/info alert.
- [x] Do not render create or edit forms on overview.
- [x] Do not render full user lists on overview.

### P0.4 Admin Users Page

- [x] Create `/admin/users`.
- [x] Add page header with title, description, and page actions.
- [x] Add toolbar with:
- [x] search input
- [x] role filter
- [x] create-user button
- [x] Render a dense MUI table for users.
- [x] Required columns:
- [x] Name
- [x] Email
- [x] Role
- [x] Manager
- [x] Actions
- [x] Use one unified user table for both employee and admin users.
- [x] Do not split users into separate giant stacked sections.
- [x] Move user creation into a dialog.
- [x] Dialog must support role-aware fields:
- [x] name
- [x] email
- [x] temporary password
- [x] role
- [x] assigned manager if role is CSR
- [x] Move editing into a drawer or dialog.
- [x] Editing must not render every row as a fully expanded form.
- [x] Row actions must support:
- [x] edit
- [x] delete
- [x] promote to admin when allowed
- [x] Search/filter behavior may be client-side initially.
- [x] Do not change backend APIs to support search/filter at this stage.
- [x] Keep rows compact and scannable for high user counts.

### P0.5 Admin Tags Page

- [x] Create `/admin/tags`.
- [x] Replace stacked tag cards/forms with a compact list or table.
- [x] Required columns:
- [x] Name
- [x] Color
- [x] Applies To
- [x] Actions
- [x] Show color as swatch plus hex text if needed.
- [x] Use preset swatches for create/edit.
- [x] Create-tag flow must use dialog.
- [x] Edit-tag flow must use dialog or drawer.
- [x] Do not keep the current freeform color `TextField` as the primary control.
- [x] Keep `affectsNodeColor` support intact.
- [x] Make the "applies to" state clearly readable as compact text or a chip.

### P0.6 Admin Settings Page

- [x] Create `/admin/settings`.
- [x] Move system settings and priority style configuration here exclusively.
- [x] Remove settings from users/tags screens.
- [x] Keep payload shape unchanged.
- [x] Render priority style map in 3 compact rows:
- [x] High
- [x] Medium
- [x] Low
- [x] Each row must allow editing:
- [x] label
- [x] foreground/text color
- [x] background color
- [x] Use compact color presets or compact inputs, not giant controls.
- [x] Keep save action in a stable visible location.
- [x] Do not force users to scroll through unrelated admin content to save settings.

### P0.7 Admin Cleanup Requirements

- [x] Remove the current single-page admin mega layout after the new pages are in place.
- [x] Delete duplicated UI blocks that become obsolete.
- [x] Do not leave old admin sections accessible only through dead code.
- [x] Keep all current admin behavior working after the split.

### P0 Acceptance

- [x] Admin has persistent navigation.
- [x] Admin no longer renders users, tags, and settings all on one page.
- [x] User create/edit flows are dialog/drawer based.
- [x] Tag color input is simplified to presets.
- [x] Admin layout remains usable with 300 to 1000 users because the main collection is table-based.
- [x] No backend/admin logic regression is introduced.

## P1 - Portal And Employee Restructure

### P1 Goal

- [x] Remove the same cluttered one-page pattern from portal and employee workflows.

### P1.1 Portal Index Redesign

- [x] Refactor [frontend/app/portal/page.tsx](../frontend/app/portal/page.tsx) into a ticket index page.
- [x] Make the ticket list the primary surface.
- [x] Move new-ticket creation into a dialog opened from a top-level action.
- [x] Remove the permanent side-by-side giant form and ticket list layout.
- [x] Keep ticket sorting logic unchanged.
- [x] Ticket list rows/cards must show:
- [x] subject
- [x] status
- [x] priority
- [x] category
- [x] updated date
- [x] assigned employee
- [x] primary action to open detail
- [x] Empty state must encourage creating the first ticket via button, not via giant empty form.
- [x] Keep page usable if ticket list grows very large.

### P1.2 Portal Detail Redesign

- [x] Refactor [frontend/app/portal/[ticketId]/page.tsx](../frontend/app/portal/[ticketId]/page.tsx).
- [x] Make conversation the dominant surface.
- [x] Use a two-column desktop layout:
- [x] left column for conversation thread and composer
- [x] right column for metadata, status flow, attachments, CSAT
- [x] Move timeline below metadata in the right column.
- [x] Do not give timeline equal visual importance to conversation.
- [x] Keep realtime message behavior unchanged.
- [x] Keep customer satisfaction submission unchanged.
- [x] Keep attachments display behavior unchanged unless compacting presentation.

### P1.3 Employee Route Structure

- [x] Add role-specific subpages beneath existing employee role roots.
- [x] Keep auth guards and role restrictions unchanged.
- [x] Do not create one generic employee page that all roles use without role-aware navigation.
- [x] CSR nav items:
- [x] Workspace
- [x] Messages
- [x] Manager nav items:
- [x] Overview
- [x] Workspace
- [x] Messages
- [x] Executive nav items:
- [x] Overview
- [x] Workspace
- [x] Messages

### P1.4 Employee Overview Pages

- [x] Create overview pages for manager and executive only.
- [x] Move summary chips/alerts/aggregates out of the main tree workspace into overview.
- [x] Replace stacked alert-heavy summaries with compact stat strips and small metric tables/lists.
- [x] Show shortcuts to workspace and messages.
- [x] Do not include the full tree or full chat UI on overview.
- [x] CSR must not get overview unless a real product reason appears later.

### P1.5 Employee Workspace Page

- [x] Refactor tree screen into a focused workspace page.
- [x] Keep only two primary surfaces:
- [x] tree canvas
- [x] selected-node detail panel
- [x] Remove internal employee chat from workspace page.
- [x] Keep case actions, endorsements, reassignment, and detail interactions tied to selected node.
- [x] If the detail panel is still large, use internal tabs only for same-workflow content:
- [x] Summary
- [x] Case
- [x] Customer
- [x] Do not stack unrelated sections vertically forever beside the tree.
- [x] Keep `UnifiedTreeCanvas` as the core interactive surface.

### P1.6 Employee Messages Page

- [x] Move internal employee chat into a dedicated messages page.
- [x] Use a two-column layout:
- [x] left thread/contact list
- [x] right conversation view
- [x] Keep realtime internal chat behavior unchanged.
- [x] Show latest notifications in a compact activity area.
- [x] Do not keep notifications as multiple large blocks above the chat composer.
- [x] Make conversation scroll area bounded and readable.
- [x] Keep message composer anchored near the conversation thread.

### P1.7 Employee Cleanup Requirements

- [x] Remove obsolete chat UI from `EmployeeTreeWorkspace` once messages page exists.
- [x] Remove obsolete summary stacks from workspace once overview page exists.
- [x] Keep existing fetch/update flows intact.
- [x] Avoid mixing navigation concerns back into the content component.

### P1 Acceptance

- [x] Portal index is mainly a ticket list.
- [x] New ticket flow is dialog-based.
- [x] Portal detail is conversation-first.
- [x] Employee tree no longer competes with internal chat on the same page.
- [x] Manager and executive summaries live on overview pages, not on the tree screen.
- [x] Employee pages feel purpose-driven rather than all-in-one.

## P2 - Cleanup, Public Surfaces, Polish, And Validation

### P2 Goal

- [x] Finish remaining low-priority surfaces and harden the new structure.

### P2.1 Login Cleanup

- [x] Refine [frontend/app/login/page.tsx](../frontend/app/login/page.tsx).
- [x] Keep the auth screen simple and compact.
- [x] Reduce dead space.
- [x] Make login/register segmentation clearer.
- [x] Do not over-design this page.
- [x] Keep it consistent with the calmer CRM visual system.

### P2.2 Role Dashboard And Placeholder Cleanup

- [x] Audit [frontend/components/RoleDashboard.tsx](../frontend/components/RoleDashboard.tsx).
- [x] Retire it where the new shell/pages make it obsolete.
- [x] Keep it only if a simple guarded placeholder still genuinely needs it.
- [x] Audit [frontend/app/employee/page.tsx](../frontend/app/employee/page.tsx).
- [x] Audit [frontend/app/customer/page.tsx](../frontend/app/customer/page.tsx).
- [x] Remove or replace placeholder pages that no longer fit the route model.

### P2.3 Legacy Pattern Removal

- [x] Search for repeated page-header-plus-panel-stack patterns and remove them.
- [x] Search for duplicate logout/home action rows and remove them.
- [x] Search for inline oversized create forms left behind after dialogs/drawers are introduced.
- [x] Search for nested `Paper` blocks that no longer represent clear boundaries.
- [x] Remove dead components, dead helpers, and unused section styles created by the old layouts.
- [x] Remove redundant route-path subtitles from authenticated sidebar nav items.
- [x] Make the top-right action cluster collapse cleanly on narrower desktop widths instead of compressing buttons into a cramped row.
- [x] Keep sidebar labels focused on destination names, not sub-addresses.

### P2.4 Responsive Hardening

- [x] Verify mobile sidebar drawer behavior.
- [x] Verify no page has horizontal overflow.
- [x] Verify tables remain usable on tablet widths.
- [x] Verify dialog/drawer flows are usable on smaller screens.
- [x] Verify tree workspace remains navigable on laptop-sized screens.

### P2.5 Validation

- [x] Run `npm run lint`.
- [x] Run `npm run test`.
- [x] Run `npm run build`.
- [x] Run `npx playwright test`.
- [x] Manually test admin login and navigation.
- [x] Manually test CSR login and navigation.
- [x] Manually test manager login and navigation.
- [x] Manually test executive login and navigation.
- [x] Manually test customer login and portal flows.
- [x] Capture before/after screenshots for admin, employee workspace, employee messages, portal list, and portal detail.

### P2 Acceptance

- [x] Authenticated areas share one coherent shell.
- [x] Admin, employee, and portal no longer feel like giant one-page prototypes.
- [x] Screens are separated by responsibility.
- [x] Large datasets are presented in tables/lists rather than repeated cards.
- [x] The UI can scale to hundreds or thousands of users without turning into an endless vertical form stack.
- [x] No meaningful product logic changed beyond small UI-supporting fixes where unavoidable.

## Suggested Delegation Strategy For Smaller Agents

- [x] Agent 1 handles shared shell primitives and authenticated layout files only.
- [x] Agent 2 handles admin split and admin table/dialog flows only.
- [x] Agent 3 handles portal list/detail restructure only.
- [x] Agent 4 handles employee route split, overview pages, workspace cleanup, and messages page only.
- [x] Agent 5 handles validation, responsive fixes, and dead-code cleanup after the feature agents finish.
- [x] Do not let multiple agents edit the same top-level layout file simultaneously.
- [x] Do not let smaller agents redesign visuals independently; they must follow this document's shell and separation rules.

## Explicit Defaults And Assumptions

- [x] Shared authenticated shell is the approved direction.
- [x] Existing root URLs are preserved.
- [x] New routes are added beneath existing roots.
- [x] No new dependency is allowed for tables, routing helpers, icons, or color pickers.
- [x] Create/edit flows should default to MUI `Dialog` unless a right-side `Drawer` clearly fits better.
- [x] Search/filter on admin users can be client-side initially.
- [x] No pagination backend work is required in this phase.
- [x] The first goal is structural clarity and scale-readiness, not perfect final visual polish.
- [x] If a smaller agent must choose between "keep everything visible" and "move secondary functionality into a subpage/dialog", the correct choice is the latter.
- [x] If a smaller agent must choose between "repeated cards" and "dense list/table", the correct choice is the latter for medium-to-large collections.

## Definition Of Done

- [x] Admin is split into Overview, Users, Tags, and Settings.
- [x] Employee role experiences are split into focused pages.
- [x] Portal list/detail structure is conversation- and list-first.
- [x] Shared authenticated shell is live across authenticated areas.
- [x] Giant monolithic pages are removed or reduced to page-specific focused components.
- [x] Validation passes and the app is visibly more production-ready for real operational use.
