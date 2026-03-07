# Session 12 Execution Plan - Skill Tree Graph, Escalation Semantics, CSR Custom Tags

## 1. Summary
This plan defines a decision-complete implementation for three issues:
1. Replace the current cluttered list-like tree with a true skill-tree style graphical view.
2. Lock escalation as approval-only (accept/reject does not transfer case ownership).
3. Allow CSR users to add custom tags during case management.

This document is intended for direct execution in the next session without additional design decisions.

## 2. Locked Product Decisions
1. Graph engine: Custom SVG in frontend.
2. Escalation model: Approval-only endorsements.
3. Custom tags: Global shared tags in existing `public.tags` table.
4. Customer case chat: CSR-only remains unchanged.
5. Reassignment: Separate explicit action for Manager/Executive/Admin.

## 3. Current State Snapshot
1. Main workspace component: [EmployeeTreeWorkspace.tsx](d:/Desktop/Main/Files/Programming/Projects/treeCRM/frontend/components/EmployeeTreeWorkspace.tsx)
2. Current tree data client: [employeeTree.ts](d:/Desktop/Main/Files/Programming/Projects/treeCRM/frontend/lib/employeeTree.ts)
3. Case management client (tags endpoint currently UUID-only): [caseManagement.ts](d:/Desktop/Main/Files/Programming/Projects/treeCRM/frontend/lib/caseManagement.ts)
4. Workflow client (endorse/reassign): [caseWorkflow.ts](d:/Desktop/Main/Files/Programming/Projects/treeCRM/frontend/lib/caseWorkflow.ts)
5. Backend employee routes: [employeeTreeRoutes.ts](d:/Desktop/Main/Files/Programming/Projects/treeCRM/backend/src/routes/employeeTreeRoutes.ts)

## 4. Target UX Spec

### 4.1 CSR Skill Tree
1. Root node is CSR, placed near bottom center.
2. Customer nodes appear as directly connected parent nodes for context/filtering.
3. Selecting a customer shows case nodes in radial rings around CSR.
4. Ring rules:
   1. Inner ring = High priority.
   2. Middle ring = Medium priority.
   3. Outer ring = Low priority.
5. Visual encoding:
   1. Node outline color = priority.
   2. Node fill color = case status.
   3. Pending endorsement = glow/halo effect.
   4. Edge from CSR to case = solid line.
6. Node click selects node and syncs right-side details panel.

### 4.2 Manager, Executive, Admin View
1. Primary canvas shows employee hierarchy only.
2. Hierarchy edges are dashed.
3. CSR subtrees are not expanded by default.
4. Clicking CSR node opens focused CSR skill-tree canvas.
5. Details panel remains the same and reflects current selected node.

### 4.3 Endorsement and Reassignment Semantics
1. Endorsement decision is approval-only.
2. Approve/reject does not change `cases.assigned_to`.
3. Reassignment remains separate in reassign panel.
4. UI copy must explicitly state approval does not reassign case.

### 4.4 CSR Custom Tags
1. CSR can type custom tag names in case management panel.
2. Custom names are resolved against existing tags case-insensitively.
3. Missing names are created in `public.tags` then linked in `public.case_tags`.
4. New tags are shared globally.
5. Existing tag selection remains intact.

## 5. Data Contracts and API Changes

### 5.1 Endpoint to Extend
1. Route: `PUT /employee/cases/:caseId/tags`
2. Current request: `{ "tagIds": ["uuid", "..."] }`
3. New request:
```json
{
  "tagIds": ["uuid", "..."],
  "customTagNames": ["Compliance", "Urgent Follow-up"]
}
```

### 5.2 Validation Rules
1. `tagIds` must be UUID array.
2. `customTagNames` optional.
3. Each custom name trimmed.
4. Name length 2 to 40.
5. Max custom names per request: 10.
6. Case-insensitive dedupe before DB operations.
7. Reject empty/invalid names with 400.

### 5.3 Backend Tag Resolution Algorithm
1. Verify case exists and is assigned to CSR viewer.
2. Validate known `tagIds`.
3. Query tags by lower(name) against `customTagNames`.
4. Create missing names with defaults:
   1. `color = '#6B7280'`
   2. `affects_node_color = false`
5. Final assigned tags = union(known IDs + resolved/created IDs).
6. Replace case tags in `case_tags`.
7. Return full tags list with `selected` flags.

### 5.4 Workflow Response Clarification
1. Route: `PATCH /employee/endorsements/:endorsementId`
2. Add response field:
```json
{
  "status": "ok",
  "data": {
    "endorsement": { "...": "..." },
    "caseAssignmentChanged": false
  }
}
```
3. System message text update:
   1. Approved/rejected message must say assignment is unchanged unless manually reassigned.

## 6. Frontend Architecture Changes

### 6.1 New Files
1. `frontend/components/graph/SkillTreeCanvas.tsx`
2. `frontend/components/graph/HierarchyCanvas.tsx`
3. `frontend/components/graph/graphLayout.ts`
4. `frontend/lib/employeeGraph.ts` (derived/graph-oriented types and mappers)

### 6.2 Existing Files to Modify
1. [EmployeeTreeWorkspace.tsx](d:/Desktop/Main/Files/Programming/Projects/treeCRM/frontend/components/EmployeeTreeWorkspace.tsx)
2. [caseManagement.ts](d:/Desktop/Main/Files/Programming/Projects/treeCRM/frontend/lib/caseManagement.ts)
3. [caseWorkflow.ts](d:/Desktop/Main/Files/Programming/Projects/treeCRM/frontend/lib/caseWorkflow.ts)

### 6.3 Graph Rendering Rules
1. SVG responsive via `viewBox`.
2. Use memoized layout functions.
3. Node hit targets minimum 36px.
4. Labels truncated with tooltip when too long.
5. Selected node gets stroke halo and z-order priority.

### 6.4 Colors and Legends
1. Priority outline:
   1. High `#DC2626`
   2. Medium `#EAB308`
   3. Low `#9CA3AF`
2. Status fill:
   1. Open `#DBEAFE`
   2. In Progress `#FEF3C7`
   3. Resolved `#DCFCE7`
   4. Dropped `#E5E7EB`
3. Endorsed pending halo: `#FACC15`.
4. Add legend block near graph title.

### 6.5 Layout Algorithms

#### 6.5.1 CSR Focus Layout
1. Root anchor near bottom center.
2. Ring radii:
   1. High ring `r=120`
   2. Medium ring `r=180`
   3. Low ring `r=240`
3. Ring angular sweep from `-155deg` to `-25deg`.
4. Cases evenly distributed within ring by index.
5. Customer node band placed between CSR and case rings.
6. Edge style solid.

#### 6.5.2 Hierarchy Layout
1. Build employee tree by role and manager relationships.
2. Y-levels:
   1. Executive level 0
   2. Manager level 1
   3. CSR level 2
3. Parent x is average child x.
4. Leaf spacing fixed then compacted by subtree widths.
5. Edge style dashed.

## 7. Workspace Integration Plan
1. Keep current `SelectedNode` type to avoid details panel rewrite.
2. Replace old list-tree render section with graph canvases.
3. Selection sync:
   1. Graph click sets `selectedNode`.
   2. Existing detail/chat/workflow panels consume same selected state.
4. For Manager/Executive/Admin:
   1. Show hierarchy canvas first.
   2. On CSR click, render focused CSR skill tree below or side-by-side.
5. Keep existing chat panels and workflow cards operational.

## 8. Endorsement and Reassignment UX Text Changes
1. Replace “Accept/Reject endorsement” language with “Approve/Reject escalation request”.
2. Add helper text:
   1. “Approval does not reassign this case.”
3. Reassign panel title:
   1. “Optional Reassignment (separate action)”.
4. Keep pending endorsement chips and history list.

## 9. CSR Custom Tag UX
1. Add custom tag text input and add-on-enter behavior.
2. Show draft custom tag chips before save.
3. Allow removing draft chips.
4. Save sends both selected existing IDs and custom names.
5. Success response refreshes tags and clears custom input.
6. Error states:
   1. duplicate name in request
   2. too long
   3. invalid characters if enforced
   4. backend conflicts

## 10. Backend Implementation Details

### 10.1 File
[employeeTreeRoutes.ts](d:/Desktop/Main/Files/Programming/Projects/treeCRM/backend/src/routes/employeeTreeRoutes.ts)

### 10.2 New/Changed Functions
1. `parseTagUpdateBody`:
   1. accept `customTagNames`
   2. normalize and validate
   3. return `{ tagIds, customTagNames }`
2. `resolveOrCreateCustomTags(client, customTagNames)`:
   1. fetch existing by lower(name)
   2. create missing with defaults
   3. return final rows
3. update tags route:
   1. merge IDs
   2. replace case_tags
   3. return updated selected map

### 10.3 Safety
1. Use service-role client (already in route stack).
2. Prevent case access beyond assigned CSR.
3. Keep idempotent behavior for repeated custom names.

## 11. Frontend Implementation Details

### 11.1 File
[EmployeeTreeWorkspace.tsx](d:/Desktop/Main/Files/Programming/Projects/treeCRM/frontend/components/EmployeeTreeWorkspace.tsx)

### 11.2 Refactor Steps
1. Extract current tree rendering block into helper component.
2. Introduce graph render section using new canvases.
3. Wire selection callbacks to existing state setters.
4. Keep details panel unchanged.
5. Add custom tag state:
   1. `customTagDraft`
   2. `customTagDraftList`
6. Update save handler to pass `customTagNames`.

### 11.3 Client Contract Updates
1. Update [caseManagement.ts](d:/Desktop/Main/Files/Programming/Projects/treeCRM/frontend/lib/caseManagement.ts) `updateCaseTags` signature.
2. Update [caseWorkflow.ts](d:/Desktop/Main/Files/Programming/Projects/treeCRM/frontend/lib/caseWorkflow.ts) decision parse for `caseAssignmentChanged`.

## 12. Test Plan

### 12.1 Backend Tests
1. Lint and build:
   1. `npm run lint`
   2. `npm run build`
2. Session smoke:
   1. `npm run test:session10`
3. Add targeted route tests (script or test harness):
   1. tags route creates new custom tags
   2. tags route dedupes case-insensitive names
   3. endorsement decision does not modify `assigned_to`
   4. manager/executive cannot use CSR-only case chat endpoints

### 12.2 Frontend Tests
1. Lint and build:
   1. `npm run lint`
   2. `npm run build`
2. Manual UX validation:
   1. CSR radial rings render correctly by priority.
   2. Status fill colors are correct.
   3. Manager hierarchy canvas renders with dashed links.
   4. CSR focus tree appears on CSR click.
   5. Custom tags can be created and immediately selected.
   6. Approval message shows no reassignment.
   7. Reassign action still works independently.

### 12.3 Production Validation
1. Deployed app role checks:
   1. CSR account
   2. Manager account
   3. Executive account
2. End-to-end:
   1. create ticket
   2. endorse
   3. approve
   4. verify assignee unchanged
   5. optional manual reassign
   6. verify notifications and timeline entries

## 13. Rollout Order
1. Backend tag API extension and endorsement response update.
2. Frontend tag UX integration.
3. Graph component introduction and workspace swap.
4. Full lint/build/smoke validation local.
5. Deploy backend.
6. Deploy frontend.
7. Production verification pass.

## 14. Risks and Mitigations
1. Risk: Graph clutter for high node counts.
   1. Mitigation: focused CSR rendering only on click, customer filter, node cap with warning.
2. Risk: Tag spam in global catalog.
   1. Mitigation: strict validation, dedupe, per-request cap.
3. Risk: Selection regressions after graph rewrite.
   1. Mitigation: preserve `SelectedNode` contract and details pane logic.
4. Risk: Confusion between approval and reassignment.
   1. Mitigation: explicit copy and response field `caseAssignmentChanged`.

## 15. Definition of Done
1. Tree view is visually skill-tree style and role-appropriate.
2. Endorsement approval never reassigns automatically.
3. CSR can add custom tags inline and persist them.
4. Lint/build/tests pass locally.
5. Production manual checks pass for CSR, Manager, Executive workflows.

## 16. Execution Checklist for Next Session
1. Create branch for Session 12 implementation.
2. Implement backend tag contract extension.
3. Implement endorsement response and copy clarifications.
4. Add graph components and layout utilities.
5. Integrate new canvases into workspace.
6. Add custom tag UI and request payload support.
7. Run backend lint/build/test.
8. Run frontend lint/build.
9. Perform local role-based manual checks.
10. Deploy and run production validation checklist.
