# TreeCRM Cleanup Audit Plan

## Summary
Create a code-only cleanup backlog for the repo, then split it into small, low-thinking tasks that a Medium-effort model can execute safely.

## Work Orchestration
- Step 1: Audit the codebase and list cleanup candidates only.
- Step 2: Group candidates by area:
  - frontend
  - backend
  - tests
  - shared utilities
- Step 3: Classify each item as one of:
  - safe mechanical cleanup
  - refactor with no behavior change
  - cleanup that needs targeted verification
- Step 4: Assign the actual implementation work in small batches to a Medium model.
- Step 5: Verify each batch with lint and targeted tests before moving on.
- Step 6: Repeat until the cleanup backlog is exhausted.

## Cleanup Targets
- Remove dead code, dead exports, and unused helpers.
- Reduce duplicated logic in routes, lib files, and workspace components.
- Replace broad casts and `any` usage where it is low-risk.
- Remove debug logging and leftover cleanup markers.
- Simplify large files by extracting shared helpers only when it clearly reduces complexity.
- Tighten test code where it mirrors implementation too closely.
- Keep behavior unchanged unless a candidate reveals a real bug.

## Verification
- Run repo lint before and after each batch.
- Run targeted tests for any touched backend route, frontend page, or shared helper.
- Run full test/build only after meaningful cleanup batches.
- If a change is ambiguous, mark it for review instead of merging it into the same batch.

## Assumptions
- Scope is code only, not docs or generated files.
- Cleanup should not change product behavior unless necessary.
- Existing lint/test/build tooling is enough.
- The next step is to turn the audit into a ranked cleanup backlog, then hand off small batches to a lower model.
