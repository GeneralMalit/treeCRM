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
- [ ] Return clear validation errors for:
- [x] missing `managerId` on CSR.
- [ ] invalid manager UUID.
- [ ] manager user not found.
- [ ] manager user exists but role is not `Manager`.

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
- [ ] Add tests for CSR create with valid manager.
- [x] Add tests for CSR create/update rejection without valid manager.
- [ ] Add tests that role changes clear CSR manager assignment.
- [x] Add tests for self-demotion rejection.
- [x] Add tests for self-delete rejection.
- [x] Add tests for last-admin demote/delete rejection.
- [ ] Add tests for allowed additional-admin creation/promotion.
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
- [ ] Preflight: pull latest `main` and confirm clean base before test run.
- [ ] Preflight: verify required env files/secrets are present for both `backend` and `frontend`.
- [ ] Preflight: confirm local Postgres/Supabase stack is running and reachable.
- [ ] Preflight: confirm local app URLs are known (frontend + backend API).
- [ ] Install deps validation:
- [ ] run backend install (`cd backend && npm ci` or `npm install` if lock mismatch).
- [ ] run frontend install (`cd frontend && npm ci` or `npm install` if lock mismatch).
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
- [ ] Start local stack for manual QA:
- [ ] run backend dev server.
- [ ] run frontend dev server.
- [ ] confirm admin workspace loads without console/runtime errors.
- [ ] Prepare test identities for manual flow:
- [ ] log in as existing admin test account.
- [ ] verify at least one non-admin test user exists for promotion test.
- [ ] ensure only one admin remains for last-admin guardrail scenario (if needed, demote extras first).
- [ ] Manual flow 1: create manager account:
- [ ] open `Admin Management`/`Employee Workspace Accounts` UI and create a `Manager`.
- [ ] verify success toast/message.
- [ ] verify manager appears in employee list with role `Manager`.
- [ ] Manual flow 2: create CSR with manager assignment:
- [ ] create `CSR` and select manager in CSR-only selector.
- [ ] verify create is blocked when manager is not selected.
- [ ] verify successful create when manager selected.
- [ ] verify CSR row displays assigned manager.
- [ ] Manual flow 3: CSR edit behavior:
- [ ] edit CSR and reassign to another manager (if available); verify persisted change.
- [ ] change CSR role to `Manager` or `Executive`; verify manager assignment is cleared.
- [ ] refresh page and verify cleared assignment remains cleared.
- [ ] Manual flow 4: create additional admin (bootstrap path):
- [ ] create second admin using admin create form.
- [ ] verify new account appears in admin list with role `Admin`.
- [ ] if testing promotion path: promote existing non-admin user to admin and verify list update.
- [ ] Manual flow 5: self-lockout protections:
- [ ] while logged in as current admin, attempt self-demote in UI; verify action disabled/blocked.
- [ ] attempt self-delete in UI; verify action disabled/blocked.
- [ ] if backend can be invoked directly, confirm API returns guardrail error text for both attempts.
- [ ] Manual flow 6: last-admin protections:
- [ ] reduce system to one remaining admin.
- [ ] attempt to demote that final admin; verify blocked with clear error.
- [ ] attempt to delete that final admin; verify blocked with clear error.
- [ ] confirm no destructive state change occurred after each blocked action.
- [ ] Data integrity/aggregation check:
- [ ] verify employee tree/manager aggregation still includes new manager + CSR relationships.
- [ ] verify no duplicate/missing users after role transitions.
- [ ] verify admin list and employee list remain correctly partitioned.
- [ ] Error-path checks:
- [ ] trigger CSR create without manager and confirm user-facing validation message.
- [ ] trigger invalid manager assignment (if possible via API/tool) and confirm clear backend error.
- [ ] verify UI error surfaces are actionable and non-generic.
- [ ] Evidence capture for handoff:
- [ ] save terminal outputs for targeted/full test runs.
- [ ] capture screenshots of key UI states (employee split, admin list, blocked self actions).
- [ ] log exact test accounts used and timestamp of run.
- [ ] Final gate before merge/deploy:
- [ ] ensure all A1-A9 checklist items are checked complete.
- [ ] ensure no unresolved TODO/FIXME added during implementation.
- [ ] ensure `git status` only contains intended files.
- [ ] add short release note summarizing admin provisioning + guardrail behavior.

Definition of done:
- [x] Backend targeted + full tests pass locally.
- [x] Frontend targeted + full tests pass locally.
- [x] Frontend build passes locally.
- [ ] Manual provisioning/bootstrap scenarios pass end-to-end in local environment.
- [ ] Self-lockout and last-admin protections are verified in both UI behavior and backend responses.
- [ ] Evidence artifacts (logs/screenshots/notes) are captured for next-session continuity.
