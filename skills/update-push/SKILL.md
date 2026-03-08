---
name: update-push
description: Update `Sessions.md` and `OVERVIEW.md` after completing repo work, apply a deterministic semantic-version decision, then stage all changes, commit with a fixed three-sentence narrative message, and push the current branch. Use when session notes, project status, validation results, or release/version state must be reconciled and published without workflow variation.
---

# Update Push

Follow this workflow in order. Do not skip or reorder steps unless the user explicitly says to do so.

## Inputs to inspect every time

Open these files first, in this order:

1. `Sessions.md`
2. `OVERVIEW.md`
3. repo-root `package.json` if it exists
4. repo-root `README.md` if it exists

Run `git status --short` before editing anything so the current worktree state is visible.

## Step 1: Record the completed work in `Sessions.md`

Find the most recent session that matches the completed work.

If the work extends an existing open session, update that session.
If the work is a new milestone, append a new session section at the end using the established format already present in the file.

Always record:

- objective
- tasks completed
- target outcome
- dated summary
- validation commands actually run
- blockers or follow-up work
- versioning decision if the session changed release state

Do not leave vague notes such as "updated stuff" or "fixed issues."
Write concrete outcomes, commands, and dates.

## Step 2: Reconcile `OVERVIEW.md`

Review `OVERVIEW.md` after updating `Sessions.md`.

Update the overview when any of these changed:

- current product status
- risks or dependencies
- outstanding follow-up
- testing or deployment posture
- release/versioning posture

If the overview is still correct, add a short dated confirmation note so future readers know it was reviewed after the session.

Always mention new risks, remaining manual verification, or environment dependencies if they still exist.

## Step 3: Apply the semantic-version decision deterministically

Use this decision order exactly:

1. If the repo has no canonical version source, do not invent one unless the user asked for versioning work.
2. If the work only changed notes, docs, session history, comments, or CI metadata with no shipped behavior change, do not bump the version.
3. If the work changed implementation but is strictly a backward-compatible fix to existing behavior, bump `patch`.
4. If the work added backward-compatible functionality, bump `minor`.
5. If the work introduced a breaking change to public behavior, contracts, routes, config expectations, or user flows, bump `major`.

When a version bump is required and the repo already defines the canonical version source, update that source first and then run the repo's documented sync path if one exists.

Always write the version decision into `Sessions.md`.
If no bump is made, state why no bump was made.

## Step 4: Confirm consistency

Re-open `Sessions.md` and `OVERVIEW.md` after editing.

Check for:

- accidental truncation
- broken section ordering
- missing dates
- missing validation notes
- mismatch between overview status and session summary
- mismatch between version decision and repo version source

If the repo has a version-sync script or README version text, verify they still match the final version decision.

## Step 5: Stage all changes

Run these commands in order:

```powershell
git status --short
git add -A
git status --short
```

Do not stage selectively unless the user explicitly requests a partial commit.

## Step 6: Commit with a fixed message shape

Commit with exactly three sentences:

1. Sentence 1: state the primary delivered work.
2. Sentence 2: state the codebase or product impact.
3. Sentence 3: state the documentation, versioning, validation, or workflow consequence.

Keep the message narrative. Do not use bullet points, prefixes, or a single-line title.

Template:

```text
<Delivered functionality>. <Why the codebase or product moved forward>. <How docs/versioning/validation/repo state were aligned>.
```

## Step 7: Push the current branch

Detect the current branch with:

```powershell
git branch --show-current
```

Push that branch to `origin`:

```powershell
git push origin <current-branch>
```

If `origin` does not exist, stop and report that clearly instead of guessing another remote.

## Non-negotiable rules

- Do not claim a command was run if it was not run.
- Do not say the overview was reviewed unless it was actually opened after the session update.
- Do not bump versions based on mood or aesthetics.
- Do not vary the commit-message structure from the three-sentence format.
- Do not omit blockers, follow-up work, or remaining manual verification when they still exist.
