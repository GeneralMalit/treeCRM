# treeCRM Remediation Plan (GitHub Issue Checklist Format)

## How to use this file
- Create one GitHub issue per section (`P0-1`, `P0-2`, etc.).
- Copy the corresponding checklist into the issue body.
- Link each checklist item to a PR when implemented.

## Priority legend
- `P0` = immediate critical risk reduction (security/data integrity)
- `P1` = high-priority reliability/correctness hardening
- `P2` = maintainability and quality improvements

## P0 (24-72 hours)

### P0-1 Block self-service privilege escalation
- [x] Force role to `Customer` for public `/auth/register`
- [x] Strip/ignore client-provided `role` on register payload
- [x] Add admin-only endpoint for privileged role assignment
- [x] Add authz checks for role assignment endpoint
- [x] Add test: register with `role=Admin` still creates `Customer`
- [x] Add test: non-admin caller cannot assign privileged role
- [x] Verify in CI all auth/role tests pass

Definition of done:
- [x] Public registration cannot create `Admin`/`Manager`/`Executive`
- [x] Only authorized admins can assign privileged roles

### P0-2 Rotate leaked secrets and remove plaintext credentials
- [ ] Rotate `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Rotate `JWT_SECRET`
- [ ] Rotate/reset exposed user passwords
- [ ] Remove real secrets from `backend/.env` and `secrets.md`
- [x] Add/update sanitized `.env.example` placeholders only
- [ ] Purge secret-bearing history using approved process
- [x] Enable secret scanning in CI for PRs/pushes

Definition of done:
- [ ] No leaked credentials remain valid
- [ ] Repo has no active plaintext production secrets
- [ ] CI blocks newly introduced secrets

### P0-3 Enforce email verification before app JWT issuance
- [x] Update register/login flow to avoid issuing app JWT to unverified users
- [x] Enforce verified status in auth flow (or verified claim checks)
- [x] Add test: unverified user denied protected access
- [x] Add test: verified user can authenticate successfully

Definition of done:
- [x] Unverified users cannot use app JWT for protected routes
- [x] Verified authentication flow remains intact

### P0-4 Operational containment
- [ ] Invalidate sessions/tokens issued before secret rotation
- [ ] Audit recent privileged-account creations
- [ ] Disable/suspend suspicious privileged accounts
- [ ] Add temporary monitoring/alerts for registration and role-assignment anomalies

Definition of done:
- [ ] Old tokens cannot authenticate
- [ ] Monitoring is active for suspicious auth events

## P1 (1-2 weeks)

### P1-1 Make CSR message send atomic/idempotent
- [x] Validate dependencies before write operations
- [ ] Wrap multi-step write path in transaction/RPC where feasible
- [ ] Add idempotency key support for retries
- [x] Add tests for transient failure + retry behavior
- [ ] Add test to confirm no duplicate messages on client retry

Definition of done:
- [ ] API response and persisted state remain consistent
- [ ] Retries do not create duplicate messages

### P1-2 Make ticket creation fully atomic
- [ ] Move case + bootstrap message creation into one transactional operation
- [ ] Return success only after full transaction commit
- [x] Add handling for legacy partial-write cleanup if needed
- [ ] Add integration tests for failure injection and retries

Definition of done:
- [ ] No partially initialized/orphaned tickets
- [ ] Retry behavior does not produce duplicate tickets

### P1-3 Strengthen regression guardrails
- [x] Add explicit tests for security-critical auth and role flows
- [x] Add regression tests for partial-write scenarios
- [x] Add `coverage.thresholds` in `backend/vitest.config.ts`
- [x] Add `coverage.thresholds` in `frontend/vitest.config.ts`
- [x] Enforce thresholds in CI pipeline

Definition of done:
- [x] CI fails on critical regression
- [x] Coverage cannot silently regress below threshold

## P2 (2-6 weeks)

### P2-1 Decompose monolithic backend route modules
- [ ] Split `employeeTreeRoutes.ts` responsibilities by feature
- [ ] Split `coreDataRoutes.ts` responsibilities by feature
- [ ] Move business logic to service/repository layer
- [ ] Move validation/parsing to shared schema/util modules
- [ ] Keep handlers thin (parse -> authorize -> service -> response)
- [ ] Add/update unit tests for extracted services

Definition of done:
- [ ] Route modules have reduced scope and size
- [ ] Core business logic is testable outside HTTP layer

### P2-2 Decompose monolithic frontend workspace component
- [ ] Extract `useEmployeeTreeData` hook
- [ ] Extract `useCaseWorkflow` hook
- [ ] Extract `useRealtimeChat` hook
- [ ] Split large workspace UI into focused presentational components
- [ ] Add tests for new hooks/components

Definition of done:
- [ ] `EmployeeTreeWorkspace.tsx` is composition-focused
- [ ] Behavior parity maintained with improved modularity

### P2-3 Centralize shared constants and guard utilities
- [ ] Create single source for role/status/priority contracts
- [ ] Refactor backend/frontend to import shared contracts
- [ ] Consolidate duplicate helper guards (e.g., `isRecord`)
- [ ] Add lint/review rule to prevent constant/helper duplication

Definition of done:
- [ ] One authoritative definition per shared domain constant
- [ ] No duplicate low-level guard implementations across modules

### P2-4 Repository artifact hygiene
- [x] Stop tracking `backend/dist/**`
- [x] Add `backend/dist` to `.gitignore`
- [ ] Ensure build artifacts are generated only in CI/release
- [x] Verify PR diffs no longer include compiled backend outputs

Definition of done:
- [x] Generated artifacts are not version-controlled
- [x] Source TS remains single source of truth

### P2-5 Improve E2E test maintainability
- [ ] Extract shared Playwright mock helpers/fixtures
- [ ] Move repeated response payloads to factories
- [ ] Replace brittle hardcoded footer assertions with metadata-driven checks
- [ ] Refactor duplicated e2e setup in customer/CSR flow specs

Definition of done:
- [ ] E2E suites have less duplication and clearer setup
- [ ] Non-functional metadata changes cause fewer test failures

## Cross-cutting validation checklist
- [x] Registration cannot assign privileged roles
- [ ] Leaked credentials rotated and old tokens invalidated
- [x] Unverified users cannot access protected routes
- [ ] Chat/ticket flows are atomic or safely idempotent
- [x] Coverage thresholds enforced in CI
- [ ] Shared constants/utils centralized
- [x] Generated artifacts removed from VCS

## Milestones
- [ ] Milestone A (Day 1-3): all P0 completed and deployed
- [ ] Milestone B (Week 1-2): all P1 completed and validated
- [ ] Milestone C (Week 3-6): all P2 refactors completed
