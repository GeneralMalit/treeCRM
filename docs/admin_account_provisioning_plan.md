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
- [ ] Extend create payload to accept optional `managerId`.
- [ ] Extend update payload to accept optional `managerId` including explicit `null`.
- [ ] Validate role rules:
- [ ] `CSR` requires `managerId`.
- [ ] `Manager`, `Executive`, and `Admin` force `managerId = null`.
- [ ] Validate `managerId` references an existing `Manager` user.
- [ ] Return clear validation errors for:
- [ ] missing `managerId` on CSR.
- [ ] invalid manager UUID.
- [ ] manager user not found.
- [ ] manager user exists but role is not `Manager`.

Definition of done:
- [ ] Backend accepts `managerId` in create/update.
- [ ] Invalid team assignments are blocked with clear errors.
- [ ] Non-CSR roles cannot retain stale manager assignments.

## A2 - Persist manager assignment correctly
- [ ] Keep auth-user creation via `auth.admin.createUser(...)`.
- [ ] Persist `public.users.manager_id` after user creation when needed.
- [ ] Handle auth-to-public sync lag gracefully (bounded retry or sync-pending response path).
- [ ] Update both auth metadata and `public.users.manager_id` during user patch.
- [ ] Ensure responses include effective manager assignment state.

Definition of done:
- [ ] CSR users are persisted with valid `manager_id`.
- [ ] Role changes away from CSR clear `manager_id`.
- [ ] Create/update responses reflect final assignment state.

## A3 - Admin safety guardrails
- [ ] Block self-demotion from `Admin`.
- [ ] Block self-delete for current admin.
- [ ] Add last-admin protection check.
- [ ] Block demotion of final remaining admin.
- [ ] Block deletion of final remaining admin.
- [ ] Return user-facing error messages for all blocked operations.

Definition of done:
- [ ] Current admin cannot lock themselves out.
- [ ] System always retains at least one admin account.

## A4 - Admin UI workflow split
- [ ] Replace generic `Users & Roles` section with:
- [ ] `Employee Workspace Accounts`.
- [ ] `Admin Management`.
- [ ] Keep existing tags/settings sections intact.
- [ ] Keep one shared refresh/data source for both user sections.
- [ ] Show employees and admins in separate lists/areas.

Definition of done:
- [ ] Admin workspace clearly separates employee provisioning from admin management.
- [ ] Existing tags/settings behavior remains unchanged.

## A5 - Employee provisioning UX (`CSR`, `Manager`, `Executive`)
- [ ] Limit employee create-role options to `CSR`, `Manager`, `Executive`.
- [ ] Do not expose `Customer` or `Admin` in employee-provisioning form.
- [ ] Show manager selector only when role is `CSR`.
- [ ] Require manager selection for CSR creation.
- [ ] In edit mode, allow manager reassignment only for CSR users.
- [ ] Hide and clear manager field for non-CSR employee roles.
- [ ] Display assigned manager name for CSR rows.

Definition of done:
- [ ] CSR creation/edit always includes valid manager assignment.
- [ ] Manager/executive accounts are created without manager assignment.

## A6 - Additional admin management UX
- [ ] Add dedicated create-admin form (email, temp password, optional name).
- [ ] Support promoting existing non-admin users to `Admin`.
- [ ] Support admin profile edits (name/email).
- [ ] Support admin demote/delete actions with guardrails.
- [ ] Disable/hide self-demote and self-delete actions in UI.
- [ ] Surface backend guardrail errors in actionable text.

Definition of done:
- [ ] Existing admin can add/promote additional admins from UI.
- [ ] UI and backend both enforce self-lockout and last-admin protections.

## A7 - Frontend API/types updates
- [ ] Extend `AdminUser` parsing to include `managerId` from `manager_id`.
- [ ] Extend create helper payload typing to include `managerId`.
- [ ] Extend update helper payload typing to include `managerId`.
- [ ] Preserve current auth/error handling behavior in admin API helpers.

Definition of done:
- [ ] Frontend models and payloads support manager assignment end-to-end.
- [ ] Existing admin API calls continue to work for unchanged fields.

## A8 - Backend tests
- [ ] Add tests for CSR create with valid manager.
- [ ] Add tests for CSR create/update rejection without valid manager.
- [ ] Add tests that role changes clear CSR manager assignment.
- [ ] Add tests for self-demotion rejection.
- [ ] Add tests for self-delete rejection.
- [ ] Add tests for last-admin demote/delete rejection.
- [ ] Add tests for allowed additional-admin creation/promotion.
- [ ] Update Supabase mocks for manager lookup and admin-count checks.

Definition of done:
- [ ] New backend guardrails and manager rules are covered by route tests.
- [ ] Coverage includes both success and failure branches.

## A9 - Frontend tests
- [ ] Add tests for split admin workspace sections.
- [ ] Add tests that employee form exposes only workspace roles.
- [ ] Add tests that manager selector is CSR-only.
- [ ] Add tests that CSR create requires manager choice.
- [ ] Add tests for admin create/promote flows.
- [ ] Add tests for self-lockout controls and displayed errors.
- [ ] Add tests for `adminPanel` parsing and payload serialization with `managerId`.

Definition of done:
- [ ] Frontend behavior and payload contracts are regression-protected.

## A10 - Validation and acceptance run
- [ ] Preflight: pull latest `main` and confirm clean base before test run.
- [ ] Preflight: verify required env files/secrets are present for both `backend` and `frontend`.
- [ ] Preflight: confirm local Postgres/Supabase stack is running and reachable.
- [ ] Preflight: confirm local app URLs are known (frontend + backend API).
- [ ] Install deps validation:
- [ ] run backend install (`cd backend && npm ci` or `npm install` if lock mismatch).
- [ ] run frontend install (`cd frontend && npm ci` or `npm install` if lock mismatch).
- [ ] Targeted backend regression run:
- [ ] execute `cd backend && npm run test -- --run test/routes/coreDataRoutes.test.ts test/routes/coreDataRoutes.coverage.test.ts`.
- [ ] record pass/fail and failing test names (if any) in session notes.
- [ ] Full backend run:
- [ ] execute `cd backend && npm run test`.
- [ ] record total tests passed and duration.
- [ ] Targeted frontend regression run:
- [ ] execute `cd frontend && npm run test -- --run test/lib/adminPanel.test.ts test/components/AdminWorkspace.test.tsx`.
- [ ] record pass/fail and any snapshot/query failures.
- [ ] Full frontend run:
- [ ] execute `cd frontend && npm run test`.
- [ ] record total tests passed and duration.
- [ ] Frontend build smoke check:
- [ ] execute `cd frontend && npm run build`.
- [ ] confirm no type/build errors.
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
- [ ] Backend targeted + full tests pass locally.
- [ ] Frontend targeted + full tests pass locally.
- [ ] Frontend build passes locally.
- [ ] Manual provisioning/bootstrap scenarios pass end-to-end in local environment.
- [ ] Self-lockout and last-admin protections are verified in both UI behavior and backend responses.
- [ ] Evidence artifacts (logs/screenshots/notes) are captured for next-session continuity.
