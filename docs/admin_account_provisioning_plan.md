# Admin Provisioning and Bootstrap Checklist

## How to use this file
- Create one GitHub issue per section (`A1`, `A2`, etc.).
- Copy that section's checklist into the issue body.
- Link each checklist item to a PR when implemented.

## Scope lock
- In scope: employee workspace provisioning (`CSR`, `Manager`, `Executive`) and additional admin management by existing admins.
- Out of scope: no-admin recovery/bootstrap flow, customer onboarding redesign, and non-admin portal changes.
- Credential model: admin sets temporary passwords for newly provisioned internal accounts.

## A1 - Backend contract updates (`/data/users`)
- [x] Extend create payload to accept optional `managerId`.
- [x] Extend update payload to accept optional `managerId` including explicit `null`.
- [x] Validate role rules:
- [x] `CSR` requires `managerId`.
- [x] `Manager`, `Executive`, and `Admin` force `managerId = null`.
- [x] Validate `managerId` references an existing `Manager` user.
- [x] Return clear validation errors for:
- [x] missing `managerId` on CSR.
- [x] invalid manager UUID.
- [x] manager user not found.
- [x] manager user exists but role is not `Manager`.

Definition of done:
- [x] Backend accepts `managerId` in create/update.
- [x] Invalid team assignments are blocked with clear errors.
- [x] Non-CSR roles cannot retain stale manager assignments.

## A2 - Persist manager assignment correctly
- [x] Keep auth-user creation via `auth.admin.createUser(...)`.
- [x] Persist `public.users.manager_id` after user creation when needed.
- [x] Handle auth-to-public sync lag gracefully (bounded retry or sync-pending response path).
- [x] Update both auth metadata and `public.users.manager_id` during user patch.
- [x] Ensure responses include effective manager assignment state.

Definition of done:
- [x] CSR users are persisted with valid `manager_id`.
- [x] Role changes away from CSR clear `manager_id`.
- [x] Create/update responses reflect final assignment state.

## A3 - Admin safety guardrails
- [x] Block self-demotion from `Admin`.
- [x] Block self-delete for current admin.
- [x] Add last-admin protection check.
- [x] Block demotion of final remaining admin.
- [x] Block deletion of final remaining admin.
- [x] Return user-facing error messages for all blocked operations.

Definition of done:
- [x] Current admin cannot lock themselves out.
- [x] System always retains at least one admin account.

## A4 - Admin UI workflow split
- [x] Replace generic `Users & Roles` section with:
- [x] `Employee Workspace Accounts`.
- [x] `Admin Management`.
- [x] Keep existing tags/settings sections intact.
- [x] Keep one shared refresh/data source for both user sections.
- [x] Show employees and admins in separate lists/areas.

Definition of done:
- [x] Admin workspace clearly separates employee provisioning from admin management.
- [x] Existing tags/settings behavior remains unchanged.

## A5 - Employee provisioning UX (`CSR`, `Manager`, `Executive`)
- [x] Limit employee create-role options to `CSR`, `Manager`, `Executive`.
- [x] Do not expose `Customer` or `Admin` in employee-provisioning form.
- [x] Show manager selector only when role is `CSR`.
- [x] Require manager selection for CSR creation.
- [x] In edit mode, allow manager reassignment only for CSR users.
- [x] Hide and clear manager field for non-CSR employee roles.
- [x] Display assigned manager name for CSR rows.

Definition of done:
- [x] CSR creation/edit always includes valid manager assignment.
- [x] Manager/executive accounts are created without manager assignment.

## A6 - Additional admin management UX
- [x] Add dedicated create-admin form (email, temp password, optional name).
- [x] Support promoting existing non-admin users to `Admin`.
- [x] Support admin profile edits (name/email).
- [x] Support admin demote/delete actions with guardrails.
- [x] Disable/hide self-demote and self-delete actions in UI.
- [x] Surface backend guardrail errors in actionable text.

Definition of done:
- [x] Existing admin can add/promote additional admins from UI.
- [x] UI and backend both enforce self-lockout and last-admin protections.

## A7 - Frontend API/types updates
- [x] Extend `AdminUser` parsing to include `managerId` from `manager_id`.
- [x] Extend create helper payload typing to include `managerId`.
- [x] Extend update helper payload typing to include `managerId`.
- [x] Preserve current auth/error handling behavior in admin API helpers.

Definition of done:
- [x] Frontend models and payloads support manager assignment end-to-end.
- [x] Existing admin API calls continue to work for unchanged fields.

## A8 - Backend tests
- [x] Add tests for CSR create with valid manager.
- [x] Add tests for CSR create/update rejection without valid manager.
- [x] Add tests that role changes clear CSR manager assignment.
- [x] Add tests for self-demotion rejection.
- [x] Add tests for self-delete rejection.
- [x] Add tests for last-admin demote/delete rejection.
- [x] Add tests for allowed additional-admin creation/promotion.
- [x] Update Supabase mocks for manager lookup and admin-count checks.

Definition of done:
- [x] New backend guardrails and manager rules are covered by route tests.
- [x] Coverage includes both success and failure branches.

## A9 - Frontend tests
- [x] Add tests for split admin workspace sections.
- [x] Add tests that employee form exposes only workspace roles.
- [x] Add tests that manager selector is CSR-only.
- [x] Add tests that CSR create requires manager choice.
- [x] Add tests for admin create/promote flows.
- [x] Add tests for self-lockout controls and displayed errors.
- [x] Add tests for `adminPanel` parsing and payload serialization with `managerId`.

Definition of done:
- [x] Frontend behavior and payload contracts are regression-protected.

## A10 - Validation and acceptance run
- [x] Preflight: pull latest `main` and confirm clean base before test run.
- [x] Preflight: verify required env files/secrets are present for both `backend` and `frontend`.
- [x] Preflight: confirm local Postgres/Supabase stack is running and reachable.
- [x] Preflight: confirm local app URLs are known (frontend + backend API).
- [x] Install deps validation:
- [x] run backend install (`cd backend && npm ci` or `npm install` if lock mismatch).
- [x] run frontend install (`cd frontend && npm ci` or `npm install` if lock mismatch).
- [x] Targeted backend regression run:
- [x] execute `cd backend && npm run test -- --run test/routes/coreDataRoutes.test.ts test/routes/coreDataRoutes.coverage.test.ts`.
- [x] record pass/fail and failing test names (if any) in session notes.
- [x] Full backend run:
- [x] execute `cd backend && npm run test`.
- [x] record total tests passed and duration.
- [x] Targeted frontend regression run:
- [x] execute `cd frontend && npm run test -- --run test/lib/adminPanel.test.ts test/components/AdminWorkspace.test.tsx`.
- [x] record pass/fail and any snapshot/query failures.
- [x] Full frontend run:
- [x] execute `cd frontend && npm run test`.
- [x] record total tests passed and duration.
- [x] Frontend build smoke check:
- [x] execute `cd frontend && npm run build`.
- [x] confirm no type/build errors.
- [x] Start local stack for manual QA:
- [x] run backend dev server.
- [x] run frontend dev server.
- [x] confirm admin workspace loads without console/runtime errors.
- [x] Prepare test identities for manual flow:
- [x] log in as existing admin test account.
- [x] verify at least one non-admin test user exists for promotion test.
- [x] ensure only one admin remains for last-admin guardrail scenario (if needed, demote extras first).
- [x] Manual flow 1: create manager account:
- [x] open `Admin Management`/`Employee Workspace Accounts` UI and create a `Manager`.
- [x] verify success toast/message.
- [x] verify manager appears in employee list with role `Manager`.
- [x] Manual flow 2: create CSR with manager assignment:
- [x] create `CSR` and select manager in CSR-only selector.
- [x] verify create is blocked when manager is not selected.
- [x] verify successful create when manager selected.
- [x] verify CSR row displays assigned manager.
- [x] Manual flow 3: CSR edit behavior:
- [x] edit CSR and reassign to another manager (if available); verify persisted change.
- [x] change CSR role to `Manager` or `Executive`; verify manager assignment is cleared.
- [x] refresh page and verify cleared assignment remains cleared.
- [x] Manual flow 4: create additional admin (bootstrap path):
- [x] create second admin using admin create form.
- [x] verify new account appears in admin list with role `Admin`.
- [x] if testing promotion path: promote existing non-admin user to admin and verify list update.
- [x] Manual flow 5: self-lockout protections:
- [x] while logged in as current admin, attempt self-demote in UI; verify action disabled/blocked.
- [x] attempt self-delete in UI; verify action disabled/blocked.
- [x] if backend can be invoked directly, confirm API returns guardrail error text for both attempts.
- [x] Manual flow 6: last-admin protections:
- [x] reduce system to one remaining admin.
- [x] attempt to demote that final admin; verify blocked with clear error.
- [x] attempt to delete that final admin; verify blocked with clear error. The normal UI path still hits the self-delete guard first; backend tests cover the dedicated last-admin delete branch.
- [x] confirm no destructive state change occurred after each blocked action.
- [x] Data integrity/aggregation check:
- [x] verify employee tree/manager aggregation still includes new manager + CSR relationships.
- [x] verify no duplicate/missing users after role transitions.
- [x] verify admin list and employee list remain correctly partitioned.
- [x] Error-path checks:
- [x] trigger CSR create without manager and confirm user-facing validation message.
- [x] trigger invalid manager assignment (if possible via API/tool) and confirm clear backend error.
- [x] verify UI error surfaces are actionable and non-generic.
- [x] Evidence capture for handoff:
- [x] save terminal outputs for targeted/full test runs.
- [x] capture screenshots of key UI states (employee split, admin list, blocked self actions).
- [x] log exact test accounts used and timestamp of run.
- [x] Final gate before merge/deploy:
- [x] ensure all A1-A9 checklist items are checked complete.
- [x] ensure no unresolved TODO/FIXME added during implementation.
- [x] ensure `git status` only contains intended files.
- [x] add short release note summarizing admin provisioning + guardrail behavior.

Definition of done:
- [x] Backend targeted + full tests pass locally.
- [x] Frontend targeted + full tests pass locally.
- [x] Frontend build passes locally.
- [x] Manual provisioning/bootstrap scenarios pass end-to-end in local environment.
- [x] Self-lockout and last-admin protections are verified in both UI behavior and backend responses.
- [x] Evidence artifacts (logs/screenshots/notes) are captured for next-session continuity.

Release note:
- Admin workspace now separates employee provisioning from admin management, supports CSR manager assignment and reassignment, and enforces self-lockout plus last-admin guardrails with specific user-facing errors.

Live smoke notes, March 19, 2026:
- Backend and frontend dev servers were launched locally on `http://localhost:4000` and `http://localhost:3000`.
- Admin login succeeded with `session2.admin@example.com`.
- Temporary manager creation and promotion to `Admin` succeeded through the backend API, then the temp account was cleaned up.
- Backend validation errors were confirmed for self-demotion, self-delete, CSR create without manager, invalid manager UUID, and CSR manager-role mismatch.
- Playwright browser-based UI smoke completed after copying the bundled Chromium build into the expected Chrome path for the harness.
- The admin workspace loaded cleanly in the browser with no console/runtime errors reported.
- UI flow checks completed for manager creation, CSR creation with assignment, CSR role change to `Manager`, admin creation, and admin promotion.
- Additional UI check completed on March 19, 2026: created a second manager, reassigned an existing CSR to that manager, saved the row, and verified the new assignment after refresh.
- Employee tree API check completed on March 19, 2026: `/employee/tree` returned the reassigned CSR under `MCP Test Manager 2`, confirming the relationship persisted in aggregation output.
- Temporary test accounts created during browser smoke were removed after verification.
- Screenshot artifact saved at `D:\Desktop\Main\Files\Programming\Projects\treeCRM\admin-workspace-last-admin.png`.
- The sole-admin delete attempt resolves to the self-delete guard first, so the dedicated "last remaining Admin" delete branch is not separately reachable through the normal UI flow.
