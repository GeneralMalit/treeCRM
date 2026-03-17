# treeCRM Remediation Plan (GitHub Issue Checklist Format)

## How to use this file
- Create one GitHub issue per section (`P0-1`, `P0-2`, etc.).
- Copy the corresponding checklist into the issue body.
- Link each checklist item to a PR when implemented.

## Priority legend
- `P0` = immediate critical risk reduction (security/data integrity)
- `P1` = high-priority reliability/correctness hardening
- `P2` = maintainability and quality improvements

## PoC scope decision (2026-03-15)
- Keep in scope: security basics and core data-integrity paths that can break demos (`P0-2` subset, `P1-1` subset, `P1-2` subset).
- Drop from scope: production incident-response operations, large refactors, and maintainability-only work that does not change PoC capability.
- Convention used below: checklist items marked `DROPPED (PoC scope)` are intentionally out of scope for this project phase.

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
- [x] Rotate `SUPABASE_SECRET_KEY` (legacy `SUPABASE_SERVICE_ROLE_KEY` equivalent)
- [x] Rotate `JWT_SECRET`
- [x] DROPPED (PoC scope): Rotate/reset exposed user passwords (PoC has no real external user base; avoid operational overhead)
- [x] Keep real secrets local-only in untracked `backend/.env`; keep any shared notes/templates sanitized
- [x] Add/update sanitized `.env.example` placeholders only
- [x] DROPPED (PoC scope): Purge secret-bearing history using approved process (high operational cost; not required for PoC demonstration)
- [x] Enable secret scanning in CI for PRs/pushes

Definition of done:
- [x] Service credentials used by this PoC are rotated once
- [x] Repo has no active plaintext secrets in tracked files
- [x] CI blocks newly introduced secrets
- [x] Local environment smoke-tested with rotated credentials (`npm run test:live` passed on 2026-03-18); deployment smoke remains a manual Render/Vercel step

### P0-3 Enforce email verification before app JWT issuance
- [x] Update register/login flow to avoid issuing app JWT to unverified users
- [x] Enforce verified status in auth flow (or verified claim checks)
- [x] Add test: unverified user denied protected access
- [x] Add test: verified user can authenticate successfully

Definition of done:
- [x] Unverified users cannot use app JWT for protected routes
- [x] Verified authentication flow remains intact

### P0-4 Operational containment (Dropped for PoC scope)
- [x] DROPPED (PoC scope): Invalidate sessions/tokens issued before secret rotation (production incident-response control)
- [x] DROPPED (PoC scope): Audit recent privileged-account creations (requires ongoing ops process)
- [x] DROPPED (PoC scope): Disable/suspend suspicious privileged accounts (ops-runbook task for production)
- [x] DROPPED (PoC scope): Add temporary monitoring/alerts for registration and role-assignment anomalies (non-essential for demo objective)

Definition of done:
- [x] DROPPED (PoC scope): Old token invalidation rollout
- [x] DROPPED (PoC scope): Temporary anomaly monitoring rollout

## P1 (1-2 weeks)

### P1-1 Make CSR message send atomic/idempotent
- [x] Validate dependencies before write operations
- [x] Implement transactional RPC path for CSR/customer message write + case-touch (`20260316_session_20_atomic_case_writes.sql`); apply migration in Supabase envs
- [x] DROPPED (PoC scope): Add idempotency key support for retries (use transaction-first approach for PoC)
- [x] Add tests for transient failure + retry behavior
- [x] Add test to confirm no duplicate messages on client retry

Definition of done:
- [x] API response and persisted state remain consistent via compensating rollback when case touch fails
- [x] Basic retry path does not create duplicate messages

### P1-2 Make ticket creation fully atomic
- [x] Implement transactional RPC path for case + bootstrap-message creation (`20260316_session_20_atomic_case_writes.sql`); apply migration in Supabase envs
- [x] Backend returns success only after the atomic path commits (with fallback retained for pre-migration environments)
- [x] Add handling for legacy partial-write cleanup if needed
- [x] DROPPED (PoC scope): Add integration tests for failure injection and retries (valuable but not required for PoC milestone)

Definition of done:
- [x] No partially initialized/orphaned tickets
- [x] DROPPED (PoC scope): Exhaustive retry/failure-injection coverage

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

### P2-1 Decompose monolithic backend route modules (Dropped for PoC scope)
- [x] DROPPED (PoC scope): Split `employeeTreeRoutes.ts` responsibilities by feature
- [x] DROPPED (PoC scope): Split `coreDataRoutes.ts` responsibilities by feature
- [x] DROPPED (PoC scope): Move business logic to service/repository layer
- [x] DROPPED (PoC scope): Move validation/parsing to shared schema/util modules
- [x] DROPPED (PoC scope): Keep handlers thin (parse -> authorize -> service -> response)
- [x] DROPPED (PoC scope): Add/update unit tests for extracted services

Definition of done:
- [x] DROPPED (PoC scope): Route decomposition outcomes

### P2-2 Decompose monolithic frontend workspace component (Dropped for PoC scope)
- [x] DROPPED (PoC scope): Extract `useEmployeeTreeData` hook
- [x] DROPPED (PoC scope): Extract `useCaseWorkflow` hook
- [x] DROPPED (PoC scope): Extract `useRealtimeChat` hook
- [x] DROPPED (PoC scope): Split large workspace UI into focused presentational components
- [x] DROPPED (PoC scope): Add tests for new hooks/components

Definition of done:
- [x] DROPPED (PoC scope): Frontend decomposition outcomes

### P2-3 Centralize shared constants and guard utilities (Dropped for PoC scope)
- [x] DROPPED (PoC scope): Create single source for role/status/priority contracts
- [x] DROPPED (PoC scope): Refactor backend/frontend to import shared contracts
- [x] DROPPED (PoC scope): Consolidate duplicate helper guards (e.g., `isRecord`)
- [x] DROPPED (PoC scope): Add lint/review rule to prevent constant/helper duplication

Definition of done:
- [x] DROPPED (PoC scope): Shared contract consolidation outcomes

### P2-4 Repository artifact hygiene
- [x] Stop tracking `backend/dist/**`
- [x] Add `backend/dist` to `.gitignore`
- [x] DROPPED (PoC scope): Ensure build artifacts are generated only in CI/release (not critical for PoC capability)
- [x] Verify PR diffs no longer include compiled backend outputs

Definition of done:
- [x] Generated artifacts are not version-controlled
- [x] Source TS remains single source of truth

### P2-5 Improve E2E test maintainability (Dropped for PoC scope)
- [x] DROPPED (PoC scope): Extract shared Playwright mock helpers/fixtures
- [x] DROPPED (PoC scope): Move repeated response payloads to factories
- [x] DROPPED (PoC scope): Replace brittle hardcoded footer assertions with metadata-driven checks
- [x] DROPPED (PoC scope): Refactor duplicated e2e setup in customer/CSR flow specs

Definition of done:
- [x] DROPPED (PoC scope): E2E maintainability outcomes

## Cross-cutting validation checklist
- [x] Registration cannot assign privileged roles
- [x] PoC service credentials rotated and plaintext secrets removed from tracked files
- [x] Unverified users cannot access protected routes
- [x] Core chat/ticket flows are atomic in normal operation paths
- [x] Coverage thresholds enforced in CI
- [x] DROPPED (PoC scope): Shared constants/utils centralized
- [x] Generated artifacts removed from VCS

## Milestones
- [x] Milestone A (Day 1-3): remaining PoC-scope P0 items completed for local PoC verification (deployment smoke kept as manual Render/Vercel step)
- [x] Milestone B (Week 1-2): remaining PoC-scope P1 items completed
- [x] DROPPED (PoC scope): Milestone C (Week 3-6) P2 refactors
