# Admin Provisioning Validation Evidence

Validated on `2026-03-19 19:33:34 +08:00`.

## Command outputs

### Backend targeted regression

Command:

```bash
cd backend && npm run test -- --run test/routes/coreDataRoutes.test.ts test/routes/coreDataRoutes.coverage.test.ts
```

Result:

- `2` test files passed
- `62` tests passed
- Duration: `668ms`

### Backend full test run

Command:

```bash
cd backend && npm run test
```

Result:

- `13` test files passed
- `114` tests passed
- Duration: `2.20s`

### Frontend full test run

Command:

```bash
cd frontend && npm run test
```

Result:

- `15` test files passed
- `30` tests passed
- Duration: `9.93s`

### Frontend build smoke

Command:

```bash
cd frontend && npm run build
```

Result:

- Production build completed successfully

### Install validation

Commands:

```bash
cd backend && npm ci
cd frontend && npm ci
```

Result:

- Both installs completed successfully
- Backend reported `292` packages added
- Frontend reported `583` packages added

## Manual QA notes

- Admin account used for browser validation: `session2.admin@example.com`
- Additional manager created during smoke: `session2.manager2@example.com`
- CSR reassigned during smoke: `41422aa8-7e67-4d98-8556-5ca7e1d447c6`
- Employee tree check confirmed the CSR persisted under `MCP Test Manager 2`
- Admin workspace loaded without console/runtime errors after the MUI/Emotion provider fix
- Self-demotion, self-delete, and last-admin demotion errors surfaced as specific user-facing messages

## Handoff notes

- The normal UI path for deleting the final admin still hits the self-delete guard first.
- The dedicated last-admin delete branch is covered by backend route tests.
