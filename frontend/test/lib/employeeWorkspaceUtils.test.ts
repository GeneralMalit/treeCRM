import { describe, expect, it } from "vitest";
import {
  findSelectedNodeInTree,
  pickCaseNodeById,
  pickInitialSelectedNode,
  upsertCaseChatMessage,
  upsertWorkflowEndorsement,
} from "@/lib/employeeWorkspaceUtils";
import { employeeTreeEmployees } from "../fixtures/tree";

describe("employeeWorkspaceUtils", () => {
  it("dedupes chat messages by id and sorts them", () => {
    expect(
      upsertCaseChatMessage(
        [
          {
            id: "msg-2",
            caseId: "case-1",
            senderId: "csr-1",
            senderRole: "CSR",
            senderName: "CSR One",
            messageText: "Later",
            createdAt: "2026-03-08T01:00:00.000Z",
            isCustomer: false,
            isSelf: true,
          },
        ],
        {
          id: "msg-1",
          caseId: "case-1",
          senderId: "customer-1",
          senderRole: "Customer",
          senderName: "Customer",
          messageText: "Earlier",
          createdAt: "2026-03-08T00:00:00.000Z",
          isCustomer: true,
          isSelf: false,
        },
      ).map((message) => message.id),
    ).toEqual(["msg-1", "msg-2"]);
  });

  it("keeps workflow endorsements sorted newest first", () => {
    expect(
      upsertWorkflowEndorsement(
        [
          {
            id: "endorsement-1",
            caseId: "case-1",
            status: "Pending",
            createdAt: "2026-03-08T00:00:00.000Z",
            endorsedBy: { id: "csr-1", name: "CSR One", email: "csr@example.com", role: "CSR" },
            endorsedTo: { id: "manager-1", name: "Manager", email: "manager@example.com", role: "Manager" },
            isPendingForViewer: false,
          },
        ],
        {
          id: "endorsement-2",
          caseId: "case-1",
          status: "Accepted",
          createdAt: "2026-03-08T01:00:00.000Z",
          endorsedBy: { id: "csr-1", name: "CSR One", email: "csr@example.com", role: "CSR" },
          endorsedTo: { id: "manager-1", name: "Manager", email: "manager@example.com", role: "Manager" },
          isPendingForViewer: true,
        },
      ).map((endorsement) => endorsement.id),
    ).toEqual(["endorsement-2", "endorsement-1"]);
  });

  it("finds and restores selected nodes in the current tree", () => {
    const initial = pickInitialSelectedNode(employeeTreeEmployees);
    expect(initial?.kind).toBe("case");
    expect(pickCaseNodeById(employeeTreeEmployees, "case-1")?.kind).toBe("case");
    expect(findSelectedNodeInTree(employeeTreeEmployees, initial)?.kind).toBe("case");
  });
});
