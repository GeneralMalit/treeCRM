import { describe, expect, it } from "vitest";
import type { CaseWorkflowEndorsement } from "@/lib/caseWorkflow";
import {
  findSelectedNodeInTree,
  formatUserDisplayName,
  pickCaseNodeById,
  pickInitialSelectedNode,
  upsertCaseChatMessage,
  upsertInternalMessage,
  upsertWorkflowEndorsement,
} from "@/lib/employeeWorkspaceUtils";
import { employeeTreeEmployees } from "../fixtures/tree";

describe("employee workspace utilities", () => {
  it("upserts and sorts chat messages by time then id", () => {
    expect(
      upsertCaseChatMessage(
        [
          { id: "m-2", caseId: "case-1", senderId: null, senderRole: "Customer", senderName: "Customer", messageText: "B", createdAt: "2026-03-08T01:00:00.000Z", isCustomer: true },
        ],
        { id: "m-1", caseId: "case-1", senderId: null, senderRole: "Customer", senderName: "Customer", messageText: "A", createdAt: "2026-03-08T01:00:00.000Z", isCustomer: true },
      ).map((message) => message.id),
    ).toEqual(["m-1", "m-2"]);

    expect(
      upsertInternalMessage(
        [
          { id: "i-1", senderId: "a", senderRole: "CSR", senderName: "CSR", recipientId: "b", recipientRole: "CSR", recipientName: "Peer", messageText: "A", createdAt: "2026-03-08T00:00:00.000Z" },
        ],
        { id: "i-1", senderId: "a", senderRole: "CSR", senderName: "CSR", recipientId: "b", recipientRole: "CSR", recipientName: "Peer", messageText: "Updated", createdAt: "2026-03-08T01:00:00.000Z" },
      )[0].messageText,
    ).toBe("Updated");
  });

  it("upserts endorsements and picks tree nodes", () => {
    expect(
      upsertWorkflowEndorsement(
        [
          {
            id: "e-1",
            caseId: "case-1",
            status: "Pending",
            createdAt: "2026-03-08T00:00:00.000Z",
            endorsedBy: { id: "a", name: "A", email: "a@example.com", role: "CSR" },
            endorsedTo: { id: "b", name: "B", email: "b@example.com", role: "Manager" },
            isPendingForViewer: true,
          } satisfies CaseWorkflowEndorsement,
        ],
        {
          id: "e-2",
          caseId: "case-1",
          status: "Pending",
          createdAt: "2026-03-08T01:00:00.000Z",
          endorsedBy: { id: "a", name: "A", email: "a@example.com", role: "CSR" },
          endorsedTo: { id: "b", name: "B", email: "b@example.com", role: "Manager" },
          isPendingForViewer: true,
        } satisfies CaseWorkflowEndorsement,
      ).map((endorsement) => endorsement.id),
    ).toEqual(["e-2", "e-1"]);

    expect(formatUserDisplayName({ name: "  CSR One ", email: "csr@example.com", role: "CSR" })).toBe(
      "CSR One (CSR)",
    );
    expect(formatUserDisplayName({ name: "   ", email: "csr@example.com", role: "CSR" })).toBe(
      "csr@example.com (CSR)",
    );
    expect(pickInitialSelectedNode([])).toBeNull();
    expect(pickInitialSelectedNode(employeeTreeEmployees)?.kind).toBe("case");
    expect(pickCaseNodeById(employeeTreeEmployees, "missing")).toBeNull();
    expect(pickCaseNodeById(employeeTreeEmployees, "case-1")?.kind).toBe("case");
    expect(findSelectedNodeInTree(employeeTreeEmployees, { kind: "employee", employee: employeeTreeEmployees[0] })?.kind).toBe("employee");
    expect(findSelectedNodeInTree(employeeTreeEmployees, { kind: "employee", employee: { ...employeeTreeEmployees[0], id: "missing" } })?.kind).toBe("case");
    expect(findSelectedNodeInTree(employeeTreeEmployees, { kind: "case", employee: employeeTreeEmployees[0], customer: employeeTreeEmployees[0].customers[0], caseItem: { ...employeeTreeEmployees[0].customers[0].cases[0], id: "missing-case" } })?.kind).toBe("case");
  });

  it("keeps message and endorsement ordering stable on ties", () => {
    expect(
      upsertCaseChatMessage(
        [
          { id: "m-b", caseId: "case-1", senderId: null, senderRole: "Customer", senderName: "Customer", messageText: "B", createdAt: "2026-03-08T01:00:00.000Z", isCustomer: true },
          { id: "m-a", caseId: "case-1", senderId: null, senderRole: "Customer", senderName: "Customer", messageText: "A", createdAt: "2026-03-08T01:00:00.000Z", isCustomer: true },
        ],
        { id: "m-c", caseId: "case-1", senderId: null, senderRole: "Customer", senderName: "Customer", messageText: "C", createdAt: "2026-03-08T01:00:00.000Z", isCustomer: true },
      ).map((message) => message.id),
    ).toEqual(["m-a", "m-b", "m-c"]);

    expect(
      upsertInternalMessage(
        [
          { id: "i-b", senderId: "a", senderRole: "CSR", senderName: "CSR", recipientId: "b", recipientRole: "CSR", recipientName: "Peer", messageText: "B", createdAt: "2026-03-08T01:00:00.000Z" },
          { id: "i-a", senderId: "a", senderRole: "CSR", senderName: "CSR", recipientId: "b", recipientRole: "CSR", recipientName: "Peer", messageText: "A", createdAt: "2026-03-08T01:00:00.000Z" },
        ],
        { id: "i-c", senderId: "a", senderRole: "CSR", senderName: "CSR", recipientId: "b", recipientRole: "CSR", recipientName: "Peer", messageText: "C", createdAt: "2026-03-08T01:00:00.000Z" },
      ).map((message) => message.id),
    ).toEqual(["i-a", "i-b", "i-c"]);

    expect(
      upsertWorkflowEndorsement(
        [
          {
            id: "e-b",
            caseId: "case-1",
            status: "Pending",
            createdAt: "2026-03-08T01:00:00.000Z",
            endorsedBy: { id: "a", name: "A", email: "a@example.com", role: "CSR" },
            endorsedTo: { id: "b", name: "B", email: "b@example.com", role: "Manager" },
            isPendingForViewer: true,
          } satisfies CaseWorkflowEndorsement,
          {
            id: "e-a",
            caseId: "case-1",
            status: "Pending",
            createdAt: "2026-03-08T01:00:00.000Z",
            endorsedBy: { id: "a", name: "A", email: "a@example.com", role: "CSR" },
            endorsedTo: { id: "b", name: "B", email: "b@example.com", role: "Manager" },
            isPendingForViewer: true,
          } satisfies CaseWorkflowEndorsement,
        ],
        {
          id: "e-c",
          caseId: "case-1",
          status: "Pending",
          createdAt: "2026-03-08T01:00:00.000Z",
          endorsedBy: { id: "a", name: "A", email: "a@example.com", role: "CSR" },
          endorsedTo: { id: "b", name: "B", email: "b@example.com", role: "Manager" },
          isPendingForViewer: true,
        } satisfies CaseWorkflowEndorsement,
      ).map((endorsement) => endorsement.id),
    ).toEqual(["e-c", "e-b", "e-a"]);
  });
});
