---
name: update-push
description: Keep Sessions.md and OVERVIEW.md aligned after finishing work by recording the completed sessions, checking the overview for necessary updates, then staging, committing (2–5 sentences), and pushing the consolidated notes.
---

## Workflow

1. **Capture completed work in Sessions.md**
   - Open `Sessions.md` and find the rows or sections that describe the sessions you just finished.
   - Append or edit the notes so they include the actual outcome, participants, action items, blockers, and any follow-up meetings.
   - If the session updates cover multiple days, label them clearly with dates so the history remains readable.

2. **Validate OVERVIEW.md**
   - Review `OVERVIEW.md` to verify that the current plan, milestones, and status statements (e.g., “In Review,” “Next Up,” etc.) still reflect the work you completed.
   - Update the overview whenever the session work changes priorities, reveals blockers, or completes a milestone; if it already matches reality, add a brief confirmation to the overview so future readers know it was reviewed.
   - Document any dependencies, risks, or outstanding questions that arose during the session so they surface in the overview.

3. **Confirm consistency**
   - Re-open both files to ensure formatting and tone follow what previous entries use, and that no sections were accidentally truncated.
   - Triple-check for TODOs or follow-ups that need separate tickets and note them inline if nothing else is available.
   - find semantic versioning and based on the changes, decide whether to update the version and how to update it.

4. **Stage, commit, and push**
   - Run `git status` and then `git add -A` to stage all changes in Sessions, Overview, or other supporting files.
   - Commit with a message consisting of 2–5 sentences that summarize the update, focus on the delivered functionality, and describe why the codebase or plan moved forward.
   - Finish by running `git push` so the shared repository reflects the new documentation.

## Notes

- Use this skill whenever sessions are completed, goals shift, or the overview narrative needs reconciling with reality.
- Keep the commit message narrative, not just a single line; covering who, what, and why in consecutive sentences helps future reviewers of the changelog.
