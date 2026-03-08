import type { CaseWorkflowEndorsement } from "./caseWorkflow";
import type { EmployeeCaseChatMessage, InternalChatMessage } from "./employeeChat";
import type { EmployeeTreeCase, EmployeeTreeCustomer, EmployeeTreeEmployee } from "./employeeTree";
import type { Role } from "./roles";

export type SelectedNode =
  | { kind: "employee"; employee: EmployeeTreeEmployee }
  | {
      kind: "case";
      employee: EmployeeTreeEmployee;
      customer: EmployeeTreeCustomer;
      caseItem: EmployeeTreeCase;
    };

export function upsertCaseChatMessage(
  messages: EmployeeCaseChatMessage[],
  nextMessage: EmployeeCaseChatMessage,
): EmployeeCaseChatMessage[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  byId.set(nextMessage.id, nextMessage);

  return [...byId.values()].sort((a, b) => {
    const byDate = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (byDate !== 0) {
      return byDate;
    }

    return a.id.localeCompare(b.id);
  });
}

export function upsertInternalMessage(
  messages: InternalChatMessage[],
  nextMessage: InternalChatMessage,
): InternalChatMessage[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  byId.set(nextMessage.id, nextMessage);

  return [...byId.values()].sort((a, b) => {
    const byDate = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (byDate !== 0) {
      return byDate;
    }

    return a.id.localeCompare(b.id);
  });
}

export function upsertWorkflowEndorsement(
  endorsements: CaseWorkflowEndorsement[],
  nextEndorsement: CaseWorkflowEndorsement,
): CaseWorkflowEndorsement[] {
  const byId = new Map(endorsements.map((endorsement) => [endorsement.id, endorsement]));
  byId.set(nextEndorsement.id, nextEndorsement);

  return [...byId.values()].sort((a, b) => {
    const byDate = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (byDate !== 0) {
      return byDate;
    }

    return b.id.localeCompare(a.id);
  });
}

export function formatUserDisplayName(user: { name?: string | null; email: string; role: Role }): string {
  return `${user.name?.trim() || user.email} (${user.role})`;
}

export function pickInitialSelectedNode(employeeNodes: EmployeeTreeEmployee[]): SelectedNode | null {
  const [firstEmployee] = employeeNodes;
  if (!firstEmployee) {
    return null;
  }

  for (const customer of firstEmployee.customers) {
    const [firstCase] = customer.cases;
    if (firstCase) {
      return {
        kind: "case",
        employee: firstEmployee,
        customer,
        caseItem: firstCase,
      };
    }
  }

  return { kind: "employee", employee: firstEmployee };
}

export function pickCaseNodeById(employeeNodes: EmployeeTreeEmployee[], caseId: string): SelectedNode | null {
  for (const employee of employeeNodes) {
    for (const customer of employee.customers) {
      const caseItem = customer.cases.find((entry) => entry.id === caseId);
      if (caseItem) {
        return {
          kind: "case",
          employee,
          customer,
          caseItem,
        };
      }
    }
  }

  return null;
}

export function findSelectedNodeInTree(
  employeeNodes: EmployeeTreeEmployee[],
  selectedNode: SelectedNode | null,
): SelectedNode | null {
  if (!selectedNode) {
    return pickInitialSelectedNode(employeeNodes);
  }

  if (selectedNode.kind === "employee") {
    const employee = employeeNodes.find((node) => node.id === selectedNode.employee.id);
    return employee ? { kind: "employee", employee } : pickInitialSelectedNode(employeeNodes);
  }

  return pickCaseNodeById(employeeNodes, selectedNode.caseItem.id) ?? pickInitialSelectedNode(employeeNodes);
}
