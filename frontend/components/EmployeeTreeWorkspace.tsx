"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UnifiedTreeCanvas } from "@/components/graph/UnifiedTreeCanvas";
import {
  addInternalNote,
  fetchCaseManagementDetails,
  updateCaseStatusPriority,
  updateCaseTags,
  type CaseTagOption,
  type InternalNote,
} from "@/lib/caseManagement";
import {
  decideCaseEndorsement,
  endorseCaseToEmployee,
  fetchCaseWorkflowDetails,
  reassignCase,
  type CaseWorkflowDetails,
  type CaseWorkflowEndorsement,
  type EndorsementDecision,
  type EndorsementStatus,
} from "@/lib/caseWorkflow";
import {
  clearStoredAccessToken,
  getLandingRoute,
  getStoredAccessToken,
  logout,
  me,
} from "@/lib/auth";
import {
  fetchEmployeeTree,
  type CasePriority,
  type CaseStatus,
  type EmployeeTreeCase,
  type EmployeeTreeCustomer,
  type EmployeeTreeEmployee,
  type EmployeeTreeScope,
  type PerformanceMetrics,
  type TeamMetricsSummary,
} from "@/lib/employeeTree";
import {
  fetchEmployeeCaseMessages,
  fetchInternalChatContacts,
  fetchInternalChatMessages,
  postEmployeeCaseMessage,
  postInternalChatMessage,
  type EmployeeCaseChatMessage,
  type InternalChatContact,
  type InternalChatMessage,
} from "@/lib/employeeChat";
import {
  disconnectRealtimeSocket,
  getRealtimeSocket,
  joinCaseRoom,
  joinInternalRoom,
  leaveCaseRoom,
  leaveInternalRoom,
  type CaseChatSocketMessage,
  type InternalChatSocketMessage,
  type NotificationSocketEvent,
  type RealtimeSocket,
} from "@/lib/realtime";
import type { Role } from "@/lib/roles";

type EmployeeTreeWorkspaceProps = {
  allowedRoles: Role[];
  title: string;
  description: string;
};

type ReadyState = {
  user: {
    email: string;
    role: Role;
    name?: string;
  };
  tree: {
    scope: EmployeeTreeScope;
    data: EmployeeTreeEmployee[];
  };
};

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ReadyState };

type SelectedNode =
  | { kind: "employee"; employee: EmployeeTreeEmployee }
  | {
    kind: "case";
    employee: EmployeeTreeEmployee;
    customer: EmployeeTreeCustomer;
    caseItem: EmployeeTreeCase;
  };

type ActionFeedback = {
  type: "success" | "error";
  message: string;
};

function upsertCaseChatMessage(
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

function upsertInternalMessage(
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

function upsertWorkflowEndorsement(
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

const statusStyleMap: Record<
  EmployeeTreeCase["status"],
  { border: string; background: string; chipColor: "primary" | "warning" | "success" | "default" }
> = {
  Open: {
    border: "#3B82F6",
    background: "#EFF6FF",
    chipColor: "primary",
  },
  "In Progress": {
    border: "#D97706",
    background: "#FFFBEB",
    chipColor: "warning",
  },
  Resolved: {
    border: "#16A34A",
    background: "#F0FDF4",
    chipColor: "success",
  },
  Dropped: {
    border: "#6B7280",
    background: "#F8FAFC",
    chipColor: "default",
  },
};

const endorsedCaseStyle = {
  border: "#FACC15",
  background: "#FEF9C3",
  chipColor: "warning" as const,
};

const CASE_STATUSES: CaseStatus[] = ["Open", "In Progress", "Resolved", "Dropped"];
const CASE_PRIORITIES: CasePriority[] = ["High", "Medium", "Low"];

function getCaseVisualStyle(caseItem: EmployeeTreeCase) {
  if (caseItem.hasPendingEndorsement) {
    return endorsedCaseStyle;
  }

  return statusStyleMap[caseItem.status];
}

function formatUserDisplayName(user: { name?: string | null; email: string; role: Role }): string {
  return `${user.name?.trim() || user.email} (${user.role})`;
}

function safeFormatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatContactInfoValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || typeof value === "undefined") {
    return "N/A";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "N/A";
  }
}

function getContactInfoEntries(contactInfo: Record<string, unknown>): Array<{ key: string; value: string }> {
  return Object.entries(contactInfo)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ key, value: formatContactInfoValue(value) }));
}

function formatCustomerSatisfaction(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  return `${value.toFixed(1)}%`;
}

function formatAllocationModeLabel(mode: TeamMetricsSummary["allocationMode"]): string {
  if (mode === "manager_assignment") {
    return "Manager assignments";
  }

  if (mode === "derived_balanced_fallback") {
    return "Balanced fallback";
  }

  return "No manager mapping";
}

function renderMetricsSummary(metrics: PerformanceMetrics): string {
  return `Ongoing ${metrics.ongoingCases} | Resolved Today ${metrics.resolvedToday} | CSAT ${formatCustomerSatisfaction(metrics.customerSatisfaction)}`;
}

function getEndorsementStatusChipColor(
  status: EndorsementStatus,
): "warning" | "success" | "error" | "default" {
  switch (status) {
    case "Pending":
      return "warning";
    case "Accepted":
      return "success";
    case "Rejected":
      return "error";
    case "Cancelled":
      return "default";
    default:
      return "default";
  }
}

function pickInitialSelectedNode(employeeNodes: EmployeeTreeEmployee[]): SelectedNode | null {
  const [firstEmployee] = employeeNodes;
  if (!firstEmployee) {
    return null;
  }

  for (const customer of firstEmployee.customers) {
    const firstCase = customer.cases[0];
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

function pickCaseNodeById(employeeNodes: EmployeeTreeEmployee[], caseId: string): SelectedNode | null {
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

function findSelectedNodeInTree(
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

export function EmployeeTreeWorkspace({ allowedRoles, title, description }: EmployeeTreeWorkspaceProps) {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [focusStack, setFocusStack] = useState<string[]>([]);
  const [caseMetaCaseId, setCaseMetaCaseId] = useState<string | null>(null);
  const [caseMetaLoading, setCaseMetaLoading] = useState(false);
  const [caseMetaError, setCaseMetaError] = useState<string | null>(null);
  const [caseTags, setCaseTags] = useState<CaseTagOption[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [customTagDraft, setCustomTagDraft] = useState("");
  const [customTagDraftList, setCustomTagDraftList] = useState<string[]>([]);
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([]);
  const [statusDraft, setStatusDraft] = useState<CaseStatus>("Open");
  const [priorityDraft, setPriorityDraft] = useState<CasePriority>("Medium");
  const [noteDraft, setNoteDraft] = useState("");
  const [savingCaseFields, setSavingCaseFields] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [caseChatMessages, setCaseChatMessages] = useState<EmployeeCaseChatMessage[]>([]);
  const [caseChatLoading, setCaseChatLoading] = useState(false);
  const [caseChatError, setCaseChatError] = useState<string | null>(null);
  const [caseChatDraft, setCaseChatDraft] = useState("");
  const [sendingCaseChat, setSendingCaseChat] = useState(false);
  const [caseChatFeedback, setCaseChatFeedback] = useState<ActionFeedback | null>(null);
  const [internalChatContacts, setInternalChatContacts] = useState<InternalChatContact[]>([]);
  const [selectedInternalChatContactId, setSelectedInternalChatContactId] = useState("");
  const [internalChatMessages, setInternalChatMessages] = useState<InternalChatMessage[]>([]);
  const [internalChatLoading, setInternalChatLoading] = useState(false);
  const [internalChatError, setInternalChatError] = useState<string | null>(null);
  const [internalChatDraft, setInternalChatDraft] = useState("");
  const [sendingInternalChat, setSendingInternalChat] = useState(false);
  const [internalChatFeedback, setInternalChatFeedback] = useState<ActionFeedback | null>(null);
  const [notificationFeed, setNotificationFeed] = useState<NotificationSocketEvent[]>([]);
  const [workflowCaseId, setWorkflowCaseId] = useState<string | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowDetails, setWorkflowDetails] = useState<CaseWorkflowDetails | null>(null);
  const [selectedEndorseTargetId, setSelectedEndorseTargetId] = useState("");
  const [sendingEndorsement, setSendingEndorsement] = useState(false);
  const [decidingEndorsementId, setDecidingEndorsementId] = useState<string | null>(null);
  const [endorsementFeedback, setEndorsementFeedback] = useState<ActionFeedback | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState("");
  const [reassignReasonDraft, setReassignReasonDraft] = useState("");
  const [reassigningCase, setReassigningCase] = useState(false);
  const [reassignFeedback, setReassignFeedback] = useState<ActionFeedback | null>(null);
  const socketRef = useRef<RealtimeSocket | null>(null);
  const currentUserRef = useRef<ReadyState["user"] | null>(null);

  const employeeNodes = useMemo(
    () => (state.status === "ready" ? state.data.tree.data : []),
    [state],
  );
  const selectedCaseId = selectedNode?.kind === "case" ? selectedNode.caseItem.id : null;
  const sessionRole = state.status === "ready" ? state.data.user.role : null;
  const isCsrSession = sessionRole === "CSR";
  const canReviewEndorsements =
    sessionRole === "Manager" || sessionRole === "Executive" || sessionRole === "Admin";
  const canReassignCases =
    sessionRole === "Manager" || sessionRole === "Executive" || sessionRole === "Admin";
  const isEmployeeSession = state.status === "ready" && state.data.user.role !== "Customer";
  const viewerId = state.status === "ready" ? state.data.tree.scope.viewerId : null;
  const viewerDisplayName =
    state.status === "ready"
      ? (state.data.user.name?.trim() || state.data.user.email)
      : null;
  const selectedInternalContact = useMemo(
    () => internalChatContacts.find((contact) => contact.id === selectedInternalChatContactId) ?? null,
    [internalChatContacts, selectedInternalChatContactId],
  );
  const unifiedSelectedNodeId = useMemo(() => {
    if (!selectedNode) return null;
    if (selectedNode.kind === "employee") return selectedNode.employee.id;
    if (selectedNode.kind === "case") return `case:${selectedNode.caseItem.id}`;
    return null;
  }, [selectedNode]);

  const refreshTreeForCurrentUser = useCallback(
    async (accessToken: string, user: ReadyState["user"], preferredCaseId?: string) => {
      const tree = await fetchEmployeeTree(accessToken);
      const nextState: ReadyState = {
        user,
        tree,
      };

      setSelectedNode((currentSelectedNode) => {
        if (preferredCaseId) {
          const preferred = pickCaseNodeById(tree.data, preferredCaseId);
          if (preferred) {
            return preferred;
          }
        }

        return findSelectedNodeInTree(tree.data, currentSelectedNode);
      });

      setState({ status: "ready", data: nextState });
    },
    [],
  );

  const refreshCaseWorkflow = useCallback(async (accessToken: string, caseId: string) => {
    const details = await fetchCaseWorkflowDetails(accessToken, caseId);
    setWorkflowCaseId(caseId);
    setWorkflowDetails(details);
    setSelectedEndorseTargetId((current) => {
      if (current && details.endorsementTargets.some((target) => target.id === current)) {
        return current;
      }

      return details.endorsementTargets[0]?.id ?? "";
    });
    setReassignTargetId((current) => {
      const availableCandidates = details.reassignmentCandidates.filter(
        (candidate) => candidate.id !== details.case.assignedTo,
      );

      if (current && availableCandidates.some((candidate) => candidate.id === current)) {
        return current;
      }

      return availableCandidates[0]?.id ?? "";
    });

    return details;
  }, []);

  useEffect(() => {
    currentUserRef.current = state.status === "ready" ? state.data.user : null;
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const accessToken = getStoredAccessToken();
      if (!accessToken) {
        router.replace("/login");
        return;
      }

      try {
        const currentUser = await me(accessToken);
        if (cancelled) {
          return;
        }

        if (!allowedRoles.includes(currentUser.role)) {
          router.replace(getLandingRoute(currentUser.role));
          return;
        }

        const tree = await fetchEmployeeTree(accessToken);
        if (cancelled) {
          return;
        }

        const nextState: ReadyState = {
          user: {
            email: currentUser.email,
            role: currentUser.role,
            ...(currentUser.name ? { name: currentUser.name } : {}),
          },
          tree,
        };

        setSelectedNode(pickInitialSelectedNode(tree.data));
        setState({ status: "ready", data: nextState });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load workspace.",
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [allowedRoles, router]);

  // Reset expanded nodes when tree data reloads
  useEffect(() => {
    if (state.status !== "ready") {
      setFocusStack([]);
    }
  }, [state]);

  const currentFocusEmployeeId = focusStack.length > 0 ? focusStack[focusStack.length - 1] : null;

  const handleDrillDown = useCallback((employeeId: string) => {
    setFocusStack((prev) => {
      const currentEmployeeId = prev.length > 0 ? prev[prev.length - 1] : viewerId;
      if (currentEmployeeId === employeeId) {
        return prev;
      }

      return [...prev, employeeId];
    });
  }, [viewerId]);

  const handleGoBack = useCallback(() => {
    setFocusStack((prev) => prev.slice(0, -1));
  }, []);

  const handleSelectEmployeeNode = useCallback((employee: EmployeeTreeEmployee) => {
    setSelectedNode({ kind: "employee", employee });
  }, []);

  const handleSelectCaseNode = useCallback(
    (employee: EmployeeTreeEmployee, customer: EmployeeTreeCustomer, caseItem: EmployeeTreeCase) => {
      setSelectedNode({ kind: "case", employee, customer, caseItem });
    },
    [],
  );

  useEffect(() => {
    if (!isCsrSession || !selectedCaseId) {
      setCaseMetaCaseId(null);
      setCaseMetaLoading(false);
      setCaseMetaError(null);
      setCaseTags([]);
      setSelectedTagIds([]);
      setCustomTagDraft("");
      setCustomTagDraftList([]);
      setInternalNotes([]);
      setStatusDraft("Open");
      setPriorityDraft("Medium");
      setNoteDraft("");
      setActionFeedback(null);
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    setCaseMetaCaseId(selectedCaseId);
    setCaseMetaLoading(true);
    setCaseMetaError(null);
    setActionFeedback(null);

    fetchCaseManagementDetails(accessToken, selectedCaseId)
      .then((details) => {
        if (cancelled) {
          return;
        }

        setCaseTags(details.tags);
        setSelectedTagIds(details.tags.filter((tag) => tag.selected).map((tag) => tag.id));
        setCustomTagDraft("");
        setCustomTagDraftList([]);
        setInternalNotes(details.internalNotes);
        setStatusDraft(details.case.status);
        setPriorityDraft(details.case.priority);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setCaseMetaError(error instanceof Error ? error.message : "Failed to load case management details.");
      })
      .finally(() => {
        if (!cancelled) {
          setCaseMetaLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isCsrSession, selectedCaseId, router]);

  useEffect(() => {
    if (!isEmployeeSession || !selectedCaseId) {
      setWorkflowCaseId(null);
      setWorkflowLoading(false);
      setWorkflowError(null);
      setWorkflowDetails(null);
      setSelectedEndorseTargetId("");
      setEndorsementFeedback(null);
      setDecidingEndorsementId(null);
      setReassignTargetId("");
      setReassignReasonDraft("");
      setReassignFeedback(null);
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    setWorkflowCaseId(selectedCaseId);
    setWorkflowLoading(true);
    setWorkflowError(null);
    setEndorsementFeedback(null);
    setReassignFeedback(null);

    fetchCaseWorkflowDetails(accessToken, selectedCaseId)
      .then((details) => {
        if (cancelled) {
          return;
        }

        setWorkflowDetails(details);
        setSelectedEndorseTargetId((current) => {
          if (current && details.endorsementTargets.some((target) => target.id === current)) {
            return current;
          }

          return details.endorsementTargets[0]?.id ?? "";
        });
        setReassignTargetId((current) => {
          const availableCandidates = details.reassignmentCandidates.filter(
            (candidate) => candidate.id !== details.case.assignedTo,
          );

          if (current && availableCandidates.some((candidate) => candidate.id === current)) {
            return current;
          }

          return availableCandidates[0]?.id ?? "";
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setWorkflowError(error instanceof Error ? error.message : "Failed to load case workflow details.");
      })
      .finally(() => {
        if (!cancelled) {
          setWorkflowLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isEmployeeSession, router, selectedCaseId]);

  useEffect(() => {
    if (!isCsrSession || !selectedCaseId) {
      setCaseChatMessages([]);
      setCaseChatLoading(false);
      setCaseChatError(null);
      setCaseChatDraft("");
      setCaseChatFeedback(null);
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    setCaseChatLoading(true);
    setCaseChatError(null);
    setCaseChatFeedback(null);

    fetchEmployeeCaseMessages(accessToken, selectedCaseId)
      .then((messages) => {
        if (cancelled) {
          return;
        }

        setCaseChatMessages(messages);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setCaseChatError(error instanceof Error ? error.message : "Failed to load case chat messages.");
      })
      .finally(() => {
        if (!cancelled) {
          setCaseChatLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isCsrSession, selectedCaseId, router]);

  useEffect(() => {
    if (!isEmployeeSession) {
      setInternalChatContacts([]);
      setSelectedInternalChatContactId("");
      setInternalChatMessages([]);
      setInternalChatLoading(false);
      setInternalChatError(null);
      setInternalChatDraft("");
      setInternalChatFeedback(null);
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    setInternalChatError(null);
    setInternalChatFeedback(null);

    fetchInternalChatContacts(accessToken)
      .then((contacts) => {
        if (cancelled) {
          return;
        }

        setInternalChatContacts(contacts);
        setSelectedInternalChatContactId((current) => {
          if (current && contacts.some((contact) => contact.id === current)) {
            return current;
          }

          return contacts[0]?.id ?? "";
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setInternalChatError(error instanceof Error ? error.message : "Failed to load internal chat contacts.");
      });

    return () => {
      cancelled = true;
    };
  }, [isEmployeeSession, router]);

  useEffect(() => {
    if (!isEmployeeSession || !selectedInternalChatContactId) {
      setInternalChatMessages([]);
      setInternalChatLoading(false);
      setInternalChatError(null);
      setInternalChatDraft("");
      setInternalChatFeedback(null);
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    setInternalChatLoading(true);
    setInternalChatError(null);
    setInternalChatFeedback(null);

    fetchInternalChatMessages(accessToken, selectedInternalChatContactId)
      .then((thread) => {
        if (cancelled) {
          return;
        }

        setInternalChatMessages(thread.messages);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setInternalChatError(error instanceof Error ? error.message : "Failed to load internal chat messages.");
      })
      .finally(() => {
        if (!cancelled) {
          setInternalChatLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isEmployeeSession, selectedInternalChatContactId, router]);

  useEffect(() => {
    if (!isEmployeeSession || !viewerId || !viewerDisplayName) {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      return;
    }

    const socket = getRealtimeSocket(accessToken);
    socketRef.current = socket;

    const handleConnect = () => {
      if (isCsrSession && selectedCaseId) {
        void joinCaseRoom(socket, selectedCaseId).catch((error) => {
          setCaseChatError(error instanceof Error ? error.message : "Failed to join case chat room.");
        });
      }

      if (selectedInternalChatContactId) {
        void joinInternalRoom(socket, selectedInternalChatContactId).catch((error) => {
          setInternalChatError(
            error instanceof Error ? error.message : "Failed to join internal chat room.",
          );
        });
      }
    };

    const handleCaseMessage = (payload: CaseChatSocketMessage) => {
      if (!isCsrSession || payload.caseId !== selectedCaseId) {
        return;
      }

      const mappedMessage: EmployeeCaseChatMessage = {
        id: payload.id,
        caseId: payload.caseId,
        senderId: payload.senderId,
        senderRole: payload.senderRole,
        senderName: payload.senderId === viewerId ? "You" : payload.senderName,
        messageText: payload.messageText,
        createdAt: payload.createdAt,
        isCustomer: payload.isCustomer,
        isSelf: payload.senderId === viewerId,
      };

      setCaseChatMessages((current) => upsertCaseChatMessage(current, mappedMessage));
    };

    const handleInternalMessage = (payload: InternalChatSocketMessage) => {
      const isFromCurrentPeer =
        (payload.senderId === selectedInternalChatContactId && payload.recipientId === viewerId) ||
        (payload.senderId === viewerId && payload.recipientId === selectedInternalChatContactId);

      if (!isFromCurrentPeer) {
        return;
      }

      const mappedMessage: InternalChatMessage = {
        id: payload.id,
        senderId: payload.senderId,
        senderRole: payload.senderRole,
        senderName: payload.senderId === viewerId ? "You" : payload.senderName,
        recipientId: payload.recipientId,
        recipientRole: payload.recipientRole,
        recipientName: payload.recipientId === viewerId ? viewerDisplayName : payload.recipientName,
        messageText: payload.messageText,
        createdAt: payload.createdAt,
        isSelf: payload.senderId === viewerId,
      };

      setInternalChatMessages((current) => upsertInternalMessage(current, mappedMessage));
    };

    const handleNotification = (payload: NotificationSocketEvent) => {
      setNotificationFeed((current) => [payload, ...current].slice(0, 6));

      if (
        payload.type !== "case_endorsement" &&
        payload.type !== "case_endorsement_decision" &&
        payload.type !== "case_endorsement_cancelled" &&
        payload.type !== "case_reassignment"
      ) {
        return;
      }

      const accessToken = getStoredAccessToken();
      const currentUser = currentUserRef.current;
      if (!accessToken || !currentUser) {
        return;
      }

      void refreshTreeForCurrentUser(accessToken, currentUser, selectedCaseId ?? undefined).catch(() => undefined);

      if (selectedCaseId) {
        void refreshCaseWorkflow(accessToken, selectedCaseId)
          .then(() => {
            setWorkflowError(null);
          })
          .catch((error) => {
            setWorkflowError(
              error instanceof Error ? error.message : "Failed to refresh case workflow details.",
            );
          });
      }
    };

    socket.on("connect", handleConnect);
    socket.on("chat:case:message", handleCaseMessage);
    socket.on("chat:internal:message", handleInternalMessage);
    socket.on("notification:new", handleNotification);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("chat:case:message", handleCaseMessage);
      socket.off("chat:internal:message", handleInternalMessage);
      socket.off("notification:new", handleNotification);
    };
  }, [
    isCsrSession,
    isEmployeeSession,
    selectedCaseId,
    selectedInternalChatContactId,
    viewerDisplayName,
    viewerId,
    refreshCaseWorkflow,
    refreshTreeForCurrentUser,
  ]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isCsrSession || !selectedCaseId) {
      return;
    }

    void joinCaseRoom(socket, selectedCaseId).catch((error) => {
      setCaseChatError(error instanceof Error ? error.message : "Failed to join case chat room.");
    });

    return () => {
      void leaveCaseRoom(socket, selectedCaseId).catch(() => undefined);
    };
  }, [isCsrSession, selectedCaseId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isEmployeeSession || !selectedInternalChatContactId) {
      return;
    }

    void joinInternalRoom(socket, selectedInternalChatContactId).catch((error) => {
      setInternalChatError(error instanceof Error ? error.message : "Failed to join internal chat room.");
    });

    return () => {
      void leaveInternalRoom(socket, selectedInternalChatContactId).catch(() => undefined);
    };
  }, [isEmployeeSession, selectedInternalChatContactId]);

  const handleLogout = async () => {
    const accessToken = getStoredAccessToken();
    if (accessToken) {
      await logout(accessToken).catch(() => undefined);
    }

    disconnectRealtimeSocket();
    clearStoredAccessToken();
    router.replace("/login");
  };

  const summary = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    return state.data.tree.scope;
  }, [state]);

  const handleSaveCaseFields = async () => {
    if (state.status !== "ready" || state.data.user.role !== "CSR" || !selectedCaseId) {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setSavingCaseFields(true);
    setActionFeedback(null);
    try {
      const updatedCase = await updateCaseStatusPriority(accessToken, selectedCaseId, {
        status: statusDraft,
        priority: priorityDraft,
      });

      await refreshTreeForCurrentUser(accessToken, state.data.user, updatedCase.id);
      setStatusDraft(updatedCase.status);
      setPriorityDraft(updatedCase.priority);
      setActionFeedback({ type: "success", message: "Case status and priority updated." });
    } catch (error) {
      setActionFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update case fields.",
      });
    } finally {
      setSavingCaseFields(false);
    }
  };

  const appendCustomTagDraft = useCallback((rawValue: string) => {
    const normalized = rawValue.trim().replace(/\s+/g, " ");
    if (!normalized) {
      return false;
    }

    if (normalized.length < 2 || normalized.length > 40) {
      setActionFeedback({
        type: "error",
        message: "Custom tag names must be 2-40 characters after trimming.",
      });
      return false;
    }

    const normalizedKey = normalized.toLowerCase();
    const existsInDraft = customTagDraftList.some((entry) => entry.toLowerCase() === normalizedKey);
    const existingTag = caseTags.find((tag) => tag.name.toLowerCase() === normalizedKey);

    if (existsInDraft) {
      setActionFeedback({
        type: "error",
        message: "That custom tag is already in the draft list.",
      });
      return false;
    }

    if (existingTag) {
      if (selectedTagIds.includes(existingTag.id)) {
        setActionFeedback({
          type: "error",
          message: "That shared tag is already selected.",
        });
        return false;
      }

      setSelectedTagIds((current) => [...current, existingTag.id]);
      setCustomTagDraft("");
      setActionFeedback(null);
      return true;
    }

    if (customTagDraftList.length >= 10) {
      setActionFeedback({
        type: "error",
        message: "You can add up to 10 custom tags per save.",
      });
      return false;
    }

    setCustomTagDraftList((current) => [...current, normalized]);
    setCustomTagDraft("");
    setActionFeedback(null);
    return true;
  }, [caseTags, customTagDraftList, selectedTagIds]);

  const handleAddCustomTagDraft = () => {
    appendCustomTagDraft(customTagDraft);
  };

  const handleSaveTags = async () => {
    if (state.status !== "ready" || state.data.user.role !== "CSR" || !selectedCaseId) {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setSavingTags(true);
    setActionFeedback(null);
    try {
      const normalizedPendingDraft = customTagDraft.trim().replace(/\s+/g, " ");
      let nextTagIds = selectedTagIds;
      let nextCustomTagNames = customTagDraftList;

      if (normalizedPendingDraft) {
        if (normalizedPendingDraft.length < 2 || normalizedPendingDraft.length > 40) {
          setActionFeedback({
            type: "error",
            message: "Custom tag names must be 2-40 characters after trimming.",
          });
          return;
        }

        const normalizedKey = normalizedPendingDraft.toLowerCase();
        if (nextCustomTagNames.some((entry) => entry.toLowerCase() === normalizedKey)) {
          setActionFeedback({
            type: "error",
            message: "That custom tag is already in the draft list.",
          });
          return;
        }

        const matchingExistingTag = caseTags.find((tag) => tag.name.toLowerCase() === normalizedKey);
        if (matchingExistingTag) {
          if (!nextTagIds.includes(matchingExistingTag.id)) {
            nextTagIds = [...nextTagIds, matchingExistingTag.id];
          }
        } else {
          if (nextCustomTagNames.length >= 10) {
            setActionFeedback({
              type: "error",
              message: "You can add up to 10 custom tags per save.",
            });
            return;
          }

          nextCustomTagNames = [...nextCustomTagNames, normalizedPendingDraft];
        }
      }

      const tags = await updateCaseTags(accessToken, selectedCaseId, {
        tagIds: nextTagIds,
        customTagNames: nextCustomTagNames,
      });
      setCaseTags(tags);
      setSelectedTagIds(tags.filter((tag) => tag.selected).map((tag) => tag.id));
      setCustomTagDraft("");
      setCustomTagDraftList([]);
      setActionFeedback({ type: "success", message: "Case tags updated." });
    } catch (error) {
      setActionFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update tags.",
      });
    } finally {
      setSavingTags(false);
    }
  };

  const handleAddInternalNote = async () => {
    if (state.status !== "ready" || state.data.user.role !== "CSR" || !selectedCaseId) {
      return;
    }

    const trimmedNote = noteDraft.trim();
    if (!trimmedNote) {
      setActionFeedback({ type: "error", message: "Internal note cannot be empty." });
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setSavingNote(true);
    setActionFeedback(null);
    try {
      const createdNote = await addInternalNote(accessToken, selectedCaseId, trimmedNote);
      setInternalNotes((current) => [createdNote, ...current]);
      setNoteDraft("");
      setActionFeedback({ type: "success", message: "Internal note added." });
    } catch (error) {
      setActionFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to add internal note.",
      });
    } finally {
      setSavingNote(false);
    }
  };

  const handleCreateEndorsement = async () => {
    if (state.status !== "ready" || state.data.user.role !== "CSR" || !selectedCaseId) {
      return;
    }

    if (!selectedEndorseTargetId) {
      setEndorsementFeedback({
        type: "error",
        message: "Select a manager or executive to review this escalation request.",
      });
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setSendingEndorsement(true);
    setEndorsementFeedback(null);
    try {
      const endorsement = await endorseCaseToEmployee(accessToken, selectedCaseId, selectedEndorseTargetId);

      setWorkflowDetails((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          case: {
            ...current.case,
            hasPendingEndorsement: true,
            pendingEndorsementCount: current.case.pendingEndorsementCount + 1,
          },
          endorsements: upsertWorkflowEndorsement(current.endorsements, endorsement),
        };
      });

      await refreshTreeForCurrentUser(accessToken, state.data.user, selectedCaseId);
      await refreshCaseWorkflow(accessToken, selectedCaseId);
      setEndorsementFeedback({
        type: "success",
        message: "Escalation request submitted successfully. Assignment remains unchanged unless you reassign it separately.",
      });
    } catch (error) {
      setEndorsementFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to submit escalation request.",
      });
    } finally {
      setSendingEndorsement(false);
    }
  };

  const handleDecideEndorsement = async (endorsementId: string, decision: EndorsementDecision) => {
    if (state.status !== "ready" || !selectedCaseId) {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setDecidingEndorsementId(endorsementId);
    setEndorsementFeedback(null);
    try {
      const decisionResult = await decideCaseEndorsement(accessToken, endorsementId, decision);
      const updatedEndorsement = decisionResult.endorsement;

      setWorkflowDetails((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          endorsements: upsertWorkflowEndorsement(current.endorsements, updatedEndorsement),
        };
      });

      await refreshCaseWorkflow(accessToken, selectedCaseId);
      await refreshTreeForCurrentUser(accessToken, state.data.user, selectedCaseId);
      setEndorsementFeedback({
        type: "success",
        message: `Escalation request ${decision.toLowerCase()} successfully. Assignment unchanged: ${decisionResult.caseAssignmentChanged ? "No" : "Yes"}.`,
      });
    } catch (error) {
      setEndorsementFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update endorsement.",
      });
    } finally {
      setDecidingEndorsementId(null);
    }
  };

  const handleReassignCase = async () => {
    if (state.status !== "ready" || !canReassignCases || !selectedCaseId) {
      return;
    }

    if (!reassignTargetId) {
      setReassignFeedback({ type: "error", message: "Select a CSR to receive this case." });
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setReassigningCase(true);
    setReassignFeedback(null);
    try {
      await reassignCase(
        accessToken,
        selectedCaseId,
        reassignTargetId,
        reassignReasonDraft.trim() || undefined,
      );

      await refreshTreeForCurrentUser(accessToken, state.data.user, selectedCaseId);
      await refreshCaseWorkflow(accessToken, selectedCaseId);
      setReassignReasonDraft("");
      setReassignFeedback({ type: "success", message: "Case reassigned successfully." });
    } catch (error) {
      setReassignFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to reassign case.",
      });
    } finally {
      setReassigningCase(false);
    }
  };

  const handleSendCaseChatMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (state.status !== "ready" || state.data.user.role !== "CSR" || !selectedCaseId) {
      return;
    }

    const trimmedMessage = caseChatDraft.trim();
    if (!trimmedMessage) {
      setCaseChatFeedback({ type: "error", message: "Message cannot be empty." });
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setSendingCaseChat(true);
    setCaseChatFeedback(null);
    try {
      const createdMessage = await postEmployeeCaseMessage(accessToken, selectedCaseId, trimmedMessage);
      setCaseChatMessages((current) => upsertCaseChatMessage(current, createdMessage));
      setCaseChatDraft("");
      setCaseChatFeedback({ type: "success", message: "Message sent to customer." });
    } catch (error) {
      setCaseChatFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to send case chat message.",
      });
    } finally {
      setSendingCaseChat(false);
    }
  };

  const handleSendInternalMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (state.status !== "ready" || !selectedInternalChatContactId) {
      return;
    }

    const trimmedMessage = internalChatDraft.trim();
    if (!trimmedMessage) {
      setInternalChatFeedback({ type: "error", message: "Message cannot be empty." });
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setSendingInternalChat(true);
    setInternalChatFeedback(null);
    try {
      const createdMessage = await postInternalChatMessage(
        accessToken,
        selectedInternalChatContactId,
        trimmedMessage,
      );
      setInternalChatMessages((current) => upsertInternalMessage(current, createdMessage));
      setInternalChatDraft("");
      setInternalChatFeedback({ type: "success", message: "Internal message sent." });
    } catch (error) {
      setInternalChatFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to send internal message.",
      });
    } finally {
      setSendingInternalChat(false);
    }
  };

  const renderDetailPane = () => {
    if (state.status !== "ready") {
      return (
        <Typography variant="body2" color="text.secondary">
          Select a node to see details.
        </Typography>
      );
    }

    if (!selectedNode) {
      return (
        <Typography variant="body2" color="text.secondary">
          No nodes available for the current scope.
        </Typography>
      );
    }

    if (selectedNode.kind === "employee") {
      const caseCount = selectedNode.employee.customers.reduce((total, customer) => total + customer.cases.length, 0);
      const selectedEmployeeTeamMetrics =
        summary?.teamMetrics && selectedNode.employee.id === summary.teamMetrics.managerId
          ? summary.teamMetrics
          : null;

      return (
        <Stack spacing={1.5}>
          <Typography variant="h6">Employee</Typography>
          <Typography>Name: {selectedNode.employee.name ?? "No name set"}</Typography>
          <Typography>Email: {selectedNode.employee.email}</Typography>
          <Typography>Role: {selectedNode.employee.role}</Typography>
          <Typography>Customers: {selectedNode.employee.customers.length}</Typography>
          <Typography>Cases: {caseCount}</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Chip size="small" color="primary" label={`Ongoing: ${selectedNode.employee.metrics.ongoingCases}`} />
            <Chip
              size="small"
              color="success"
              label={`Resolved Today: ${selectedNode.employee.metrics.resolvedToday}`}
            />
            <Chip
              size="small"
              color="info"
              label={`CSAT: ${formatCustomerSatisfaction(selectedNode.employee.metrics.customerSatisfaction)}`}
            />
          </Stack>
          {selectedEmployeeTeamMetrics && (
            <Alert severity="info">
              Team Metrics ({formatAllocationModeLabel(selectedEmployeeTeamMetrics.allocationMode)}):{" "}
              {renderMetricsSummary(selectedEmployeeTeamMetrics.metrics)} | CSRs{" "}
              {selectedEmployeeTeamMetrics.csrCount}
            </Alert>
          )}
          <Typography color="text.secondary">
            Created: {safeFormatDate(selectedNode.employee.createdAt)}
          </Typography>
        </Stack>
      );
    }

    const caseStyle = getCaseVisualStyle(selectedNode.caseItem);
    const contactInfoEntries = getContactInfoEntries(selectedNode.customer.contactInfo);
    const selectedTags = caseTags.filter((tag) => selectedTagIds.includes(tag.id));
    const isSelectedCaseMetaCurrent = caseMetaCaseId === selectedNode.caseItem.id;
    const isSelectedWorkflowCurrent = workflowCaseId === selectedNode.caseItem.id;
    const workflowEndorsements = workflowDetails?.endorsements ?? [];
    const pendingEndorsementsForViewer = workflowEndorsements.filter((endorsement) => endorsement.isPendingForViewer);
    const canEndorseCase =
      isCsrSession &&
      isSelectedWorkflowCurrent &&
      workflowDetails?.case.hasPendingEndorsement === false;
    const reassignCandidates = (workflowDetails?.reassignmentCandidates ?? []).filter(
      (candidate) => candidate.id !== workflowDetails?.case.assignedTo,
    );

    return (
      <Stack spacing={1.5}>
        <Typography variant="h6">Customer / Case</Typography>
        <Typography>Customer Name: {selectedNode.customer.company}</Typography>
        <Typography>Customer User ID: {selectedNode.customer.userId}</Typography>
        <Typography>Linked Employee: {selectedNode.employee.name ?? selectedNode.employee.email}</Typography>
        <Typography>Case Reference: {selectedNode.caseItem.title}</Typography>
        <Stack direction="row" spacing={1}>
          <Chip size="small" color={caseStyle.chipColor} label={`Status: ${selectedNode.caseItem.status}`} variant="filled" />
          {selectedNode.caseItem.hasPendingEndorsement && (
            <Chip
              size="small"
              color="warning"
              variant="filled"
              label={`Endorsed (${selectedNode.caseItem.pendingEndorsementCount})`}
            />
          )}
        </Stack>
        <Typography color="text.secondary">
          Last Updated: {safeFormatDate(selectedNode.caseItem.updatedAt)}
        </Typography>
        <Typography color="text.secondary">
          Created: {safeFormatDate(selectedNode.caseItem.createdAt)}
        </Typography>
        <Typography variant="body2">Description</Typography>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1,
            border: `1px solid ${caseStyle.border}`,
            backgroundColor: caseStyle.background,
          }}
        >
          <Typography variant="body2">
            {selectedNode.caseItem.description || "No description was provided."}
          </Typography>
        </Box>
        <Typography variant="body2">Contact Info</Typography>
        {contactInfoEntries.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No contact info was provided.
          </Typography>
        )}
        {contactInfoEntries.length > 0 && (
          <Stack spacing={0.75}>
            {contactInfoEntries.map((entry) => (
              <Typography key={entry.key} variant="body2">
                {entry.key}: {entry.value}
              </Typography>
            ))}
          </Stack>
        )}
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.5,
            fontFamily: "monospace",
            fontSize: "0.75rem",
            borderRadius: 1,
            backgroundColor: "#F3F4F6",
            overflowX: "auto",
          }}
        >
          {JSON.stringify(selectedNode.customer.contactInfo, null, 2)}
        </Box>

        <Divider />
        <Typography variant="subtitle1">Escalation Workflow</Typography>
        <Typography variant="body2" color="text.secondary">
          Approval only. Approving or rejecting an escalation request does not reassign the case.
        </Typography>

        {workflowLoading && isSelectedWorkflowCurrent && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Loading escalation history and reassignment controls...
            </Typography>
          </Stack>
        )}

        {workflowError && isSelectedWorkflowCurrent && <Alert severity="error">{workflowError}</Alert>}
        {endorsementFeedback && <Alert severity={endorsementFeedback.type}>{endorsementFeedback.message}</Alert>}
        {reassignFeedback && <Alert severity={reassignFeedback.type}>{reassignFeedback.message}</Alert>}

        {isSelectedWorkflowCurrent && workflowDetails && (
          <Stack spacing={1.25}>
            <Typography variant="body2">
              Assigned To:{" "}
              {workflowDetails.case.assignedToUser
                ? formatUserDisplayName(workflowDetails.case.assignedToUser)
                : "Unassigned"}
            </Typography>

            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Chip
                size="small"
                variant="outlined"
                label={`Pending Escalations: ${workflowDetails.case.pendingEndorsementCount}`}
              />
              {workflowDetails.endorsements[0] && (
                <Chip
                  size="small"
                  color={getEndorsementStatusChipColor(workflowDetails.endorsements[0].status)}
                  variant="outlined"
                  label={`Latest: ${workflowDetails.endorsements[0].status}`}
                />
              )}
            </Stack>

            <Typography variant="subtitle2">Escalation Timeline</Typography>
            {workflowEndorsements.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No escalation requests recorded for this case.
              </Typography>
            )}

            {workflowEndorsements.length > 0 && (
              <Stack spacing={1}>
                {workflowEndorsements.map((endorsement) => (
                  <Box
                    key={endorsement.id}
                    sx={{
                      p: 1.1,
                      borderRadius: 1,
                      border: "1px solid #E5E7EB",
                      backgroundColor: endorsement.status === "Pending" ? "#FEF9C3" : "#F9FAFB",
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {endorsement.endorsedBy.name || endorsement.endorsedBy.email}
                        {" -> "}
                        {endorsement.endorsedTo.name || endorsement.endorsedTo.email}
                      </Typography>
                      <Chip
                        size="small"
                        color={getEndorsementStatusChipColor(endorsement.status)}
                        label={endorsement.status}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {safeFormatDate(endorsement.createdAt)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}

            {isCsrSession && (
              <>
                <Divider />
                <Typography variant="subtitle2">Request Escalation Approval</Typography>
                <Typography variant="caption" color="text.secondary">
                  Approval does not reassign this case.
                </Typography>
                <FormControl
                  fullWidth
                  size="small"
                  disabled={sendingEndorsement || workflowLoading || !canEndorseCase}
                >
                  <InputLabel id="endorsement-target-select-label">Manager or Executive</InputLabel>
                  <Select
                    labelId="endorsement-target-select-label"
                    label="Manager or Executive"
                    value={selectedEndorseTargetId}
                    onChange={(event) => setSelectedEndorseTargetId(event.target.value)}
                  >
                    {workflowDetails.endorsementTargets.map((target) => (
                      <MenuItem key={target.id} value={target.id}>
                        {target.name || target.email} ({target.role})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={handleCreateEndorsement}
                  disabled={
                    sendingEndorsement ||
                    workflowLoading ||
                    !canEndorseCase ||
                    !selectedEndorseTargetId
                  }
                >
                  {sendingEndorsement ? "Submitting..." : "Submit Escalation Request"}
                </Button>
                {!canEndorseCase && workflowDetails.case.hasPendingEndorsement && (
                  <Typography variant="caption" color="text.secondary">
                    A pending escalation request already exists for this case.
                  </Typography>
                )}
              </>
            )}

            {canReviewEndorsements && pendingEndorsementsForViewer.length > 0 && (
              <>
                <Divider />
                <Typography variant="subtitle2">Pending Escalation Requests For You</Typography>
                <Typography variant="caption" color="text.secondary">
                  Approval does not reassign this case. Use the separate reassignment action if needed.
                </Typography>
                <Stack spacing={1}>
                  {pendingEndorsementsForViewer.map((endorsement) => (
                    <Box
                      key={endorsement.id}
                      sx={{
                        p: 1.1,
                        borderRadius: 1,
                        border: "1px solid #E5E7EB",
                        backgroundColor: "#FEFCE8",
                      }}
                    >
                      <Typography variant="body2">
                        From: {endorsement.endorsedBy.name || endorsement.endorsedBy.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {safeFormatDate(endorsement.createdAt)}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          disabled={decidingEndorsementId === endorsement.id}
                          onClick={() => handleDecideEndorsement(endorsement.id, "Accepted")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          disabled={decidingEndorsementId === endorsement.id}
                          onClick={() => handleDecideEndorsement(endorsement.id, "Rejected")}
                        >
                          Reject
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </>
            )}

            {canReassignCases && (
              <>
                <Divider />
                <Typography variant="subtitle2">Optional Reassignment (Separate Action)</Typography>
                <Typography variant="caption" color="text.secondary">
                  Use this only if you want to transfer ownership after reviewing the escalation request.
                </Typography>
                <FormControl fullWidth size="small" disabled={reassigningCase || workflowLoading}>
                  <InputLabel id="reassign-target-select-label">Assign To CSR</InputLabel>
                  <Select
                    labelId="reassign-target-select-label"
                    label="Assign To CSR"
                    value={reassignTargetId}
                    onChange={(event) => setReassignTargetId(event.target.value)}
                  >
                    {reassignCandidates.map((candidate) => (
                      <MenuItem key={candidate.id} value={candidate.id}>
                        {candidate.name || candidate.email} ({candidate.role})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label="Reassignment Reason (Optional)"
                  value={reassignReasonDraft}
                  onChange={(event) => setReassignReasonDraft(event.target.value)}
                  disabled={reassigningCase || workflowLoading}
                />
                <Button
                  variant="contained"
                  onClick={handleReassignCase}
                  disabled={reassigningCase || workflowLoading || !reassignTargetId}
                >
                  {reassigningCase ? "Reassigning..." : "Reassign Case"}
                </Button>
              </>
            )}
          </Stack>
        )}

        {isCsrSession && (
          <>
            <Divider />
            <Typography variant="subtitle1">Case Management</Typography>

            {caseMetaLoading && isSelectedCaseMetaCurrent && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  Loading tags and internal notes...
                </Typography>
              </Stack>
            )}

            {caseMetaError && isSelectedCaseMetaCurrent && <Alert severity="error">{caseMetaError}</Alert>}
            {actionFeedback && <Alert severity={actionFeedback.type}>{actionFeedback.message}</Alert>}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <FormControl fullWidth size="small">
                <InputLabel id="case-status-select-label">Status</InputLabel>
                <Select
                  labelId="case-status-select-label"
                  label="Status"
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value as CaseStatus)}
                  disabled={savingCaseFields || caseMetaLoading || !isSelectedCaseMetaCurrent}
                >
                  {CASE_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel id="case-priority-select-label">Priority</InputLabel>
                <Select
                  labelId="case-priority-select-label"
                  label="Priority"
                  value={priorityDraft}
                  onChange={(event) => setPriorityDraft(event.target.value as CasePriority)}
                  disabled={savingCaseFields || caseMetaLoading || !isSelectedCaseMetaCurrent}
                >
                  {CASE_PRIORITIES.map((priority) => (
                    <MenuItem key={priority} value={priority}>
                      {priority}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Button
              variant="contained"
              onClick={handleSaveCaseFields}
              disabled={savingCaseFields || caseMetaLoading || !isSelectedCaseMetaCurrent}
            >
              {savingCaseFields ? "Saving..." : "Save Status and Priority"}
            </Button>

            <Divider />
            <Typography variant="subtitle2">Manual Tags</Typography>
            <Typography variant="caption" color="text.secondary">
              Select existing tags or stage new shared tags to create during save.
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel id="case-tags-select-label">Tags</InputLabel>
              <Select
                labelId="case-tags-select-label"
                label="Tags"
                multiple
                value={selectedTagIds}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSelectedTagIds(typeof nextValue === "string" ? nextValue.split(",") : nextValue);
                }}
                disabled={savingTags || caseMetaLoading || !isSelectedCaseMetaCurrent}
                renderValue={(selected) => {
                  const selectedIds = selected as string[];
                  const selectedNames = caseTags
                    .filter((tag) => selectedIds.includes(tag.id))
                    .map((tag) => tag.name);
                  return selectedNames.length > 0 ? selectedNames.join(", ") : "No tags selected";
                }}
              >
                {caseTags.map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    <Checkbox checked={selectedTagIds.includes(tag.id)} size="small" />
                    <ListItemText primary={tag.name} secondary={tag.color} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                size="small"
                fullWidth
                label="Custom Tag Name"
                value={customTagDraft}
                onChange={(event) => setCustomTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddCustomTagDraft();
                  }
                }}
                placeholder="Type a shared tag and press Enter"
                disabled={savingTags || caseMetaLoading || !isSelectedCaseMetaCurrent}
              />
              <Button
                variant="outlined"
                onClick={handleAddCustomTagDraft}
                disabled={savingTags || caseMetaLoading || !isSelectedCaseMetaCurrent}
              >
                Add Custom Tag
              </Button>
            </Stack>

            {customTagDraftList.length > 0 && (
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                {customTagDraftList.map((tagName) => (
                  <Chip
                    key={tagName}
                    size="small"
                    label={tagName}
                    color="warning"
                    variant="outlined"
                    onDelete={() =>
                      setCustomTagDraftList((current) => current.filter((entry) => entry !== tagName))
                    }
                  />
                ))}
              </Stack>
            )}

            {selectedTags.length > 0 && (
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                {selectedTags.map((tag) => (
                  <Chip
                    key={tag.id}
                    size="small"
                    label={tag.name}
                    variant="outlined"
                    sx={{ borderColor: tag.color, color: tag.color }}
                  />
                ))}
              </Stack>
            )}

            <Button
              variant="outlined"
              onClick={handleSaveTags}
              disabled={savingTags || caseMetaLoading || !isSelectedCaseMetaCurrent}
            >
              {savingTags ? "Saving..." : "Save Tags"}
            </Button>

            <Divider />
            <Typography variant="subtitle2">Internal Notes</Typography>
            <TextField
              multiline
              minRows={3}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Add an internal note for this case..."
              disabled={savingNote || caseMetaLoading || !isSelectedCaseMetaCurrent}
            />
            <Button
              variant="outlined"
              onClick={handleAddInternalNote}
              disabled={savingNote || caseMetaLoading || !isSelectedCaseMetaCurrent}
            >
              {savingNote ? "Adding..." : "Add Internal Note"}
            </Button>

            {internalNotes.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No internal notes yet.
              </Typography>
            )}

            {internalNotes.length > 0 && (
              <Stack spacing={1}>
                {internalNotes.map((note) => (
                  <Box
                    key={note.id}
                    sx={{
                      p: 1.25,
                      borderRadius: 1,
                      border: "1px solid #E5E7EB",
                      backgroundColor: "#F9FAFB",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {note.senderRole} | {safeFormatDate(note.createdAt)}
                    </Typography>
                    <Typography variant="body2">{note.messageText}</Typography>
                  </Box>
                ))}
              </Stack>
            )}

            <Divider />
            <Typography variant="subtitle2">Customer Chat</Typography>

            {caseChatLoading && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  Loading conversation...
                </Typography>
              </Stack>
            )}

            {caseChatError && <Alert severity="error">{caseChatError}</Alert>}
            {caseChatFeedback && <Alert severity={caseChatFeedback.type}>{caseChatFeedback.message}</Alert>}

            <Stack
              spacing={1}
              sx={{
                maxHeight: 220,
                overflowY: "auto",
                border: "1px solid #E5E7EB",
                borderRadius: 1,
                p: 1,
                backgroundColor: "#F9FAFB",
              }}
            >
              {caseChatMessages.length === 0 && !caseChatLoading && (
                <Typography variant="body2" color="text.secondary">
                  No customer messages yet.
                </Typography>
              )}

              {caseChatMessages.map((message) => (
                <Box
                  key={message.id}
                  sx={{
                    alignSelf: message.isSelf ? "flex-end" : "flex-start",
                    maxWidth: "88%",
                    p: 1.1,
                    borderRadius: 1,
                    border: "1px solid #E5E7EB",
                    backgroundColor: message.isSelf ? "#DBEAFE" : "#F3F4F6",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {message.senderName} ({message.senderRole}) | {safeFormatDate(message.createdAt)}
                  </Typography>
                  <Typography variant="body2">{message.messageText}</Typography>
                </Box>
              ))}
            </Stack>

            <Stack component="form" spacing={1} onSubmit={handleSendCaseChatMessage}>
              <TextField
                multiline
                minRows={2}
                label="Reply to Customer"
                value={caseChatDraft}
                onChange={(event) => setCaseChatDraft(event.target.value)}
                disabled={sendingCaseChat || caseChatLoading}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={sendingCaseChat || caseChatLoading}
              >
                {sendingCaseChat ? "Sending..." : "Send Reply"}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Stack spacing={1.25}>
            <Typography variant="h5">{title}</Typography>
            <Typography color="text.secondary">{description}</Typography>

            {state.status === "loading" && <Alert severity="info">Validating session and loading tree...</Alert>}
            {state.status === "error" && <Alert severity="error">{state.message}</Alert>}
            {state.status === "ready" && (
              <Alert severity="success">
                Signed in as {state.data.user.name ? `${state.data.user.name} (${state.data.user.email})` : state.data.user.email}
                {" - "}
                role: {state.data.user.role}
              </Alert>
            )}

            {summary && (
              <Stack spacing={1}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Chip size="small" label={`Employees: ${summary.employeeCount}`} />
                  <Chip size="small" label={`Customers: ${summary.customerCount}`} />
                  <Chip size="small" label={`Cases: ${summary.caseCount}`} />
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Chip size="small" color="primary" label={`Ongoing: ${summary.metrics.ongoingCases}`} />
                  <Chip size="small" color="success" label={`Resolved Today: ${summary.metrics.resolvedToday}`} />
                  <Chip
                    size="small"
                    color="info"
                    label={`CSAT: ${formatCustomerSatisfaction(summary.metrics.customerSatisfaction)}`}
                  />
                </Stack>

                {summary.teamMetrics && (
                  <Alert severity="info">
                    Team Metrics ({formatAllocationModeLabel(summary.teamMetrics.allocationMode)}):{" "}
                    {renderMetricsSummary(summary.teamMetrics.metrics)} | CSRs {summary.teamMetrics.csrCount}
                  </Alert>
                )}

                {summary.managerAggregates && (
                  <Stack spacing={0.75}>
                    <Alert severity="warning">
                      Executive Manager Rollup ({formatAllocationModeLabel(summary.managerAggregates.allocationMode)}
                      ): {renderMetricsSummary(summary.managerAggregates.metrics)} | Managers{" "}
                      {summary.managerAggregates.managerCount} | CSRs {summary.managerAggregates.csrCount} | Unassigned{" "}
                      {summary.managerAggregates.unassignedCsrCount}
                    </Alert>
                    {summary.managerAggregates.managers.length > 0 && (
                      <Stack spacing={0.5}>
                        {summary.managerAggregates.managers.map((managerAggregate) => (
                          <Box
                            key={managerAggregate.managerId}
                            sx={{
                              p: 1,
                              borderRadius: 1,
                              border: "1px solid #E5E7EB",
                              backgroundColor: "#F9FAFB",
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {managerAggregate.managerName || managerAggregate.managerEmail} | CSRs{" "}
                              {managerAggregate.csrCount}
                            </Typography>
                            <Typography variant="body2">
                              {renderMetricsSummary(managerAggregate.metrics)}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    )}
                    {summary.managerAggregates.unassignedCsrCount > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Unassigned CSR Pool: {renderMetricsSummary(summary.managerAggregates.unassignedMetrics)}
                      </Typography>
                    )}
                  </Stack>
                )}
              </Stack>
            )}

            <Stack direction="row" spacing={1.5}>
              <Button variant="contained" onClick={handleLogout}>
                Logout
              </Button>
              <Button component={Link} href="/" variant="outlined">
                Home
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
          <Paper elevation={1} sx={{ p: 2, flex: 1.3 }}>
            {state.status === "loading" && <Typography color="text.secondary">Loading tree data...</Typography>}

            {state.status === "ready" && state.data.tree.data.length === 0 && (
              <Alert severity="info">No assigned records are currently available in your scope.</Alert>
            )}

            {state.status === "ready" && state.data.tree.data.length > 0 && (
              <UnifiedTreeCanvas
                employees={employeeNodes}
                scope={state.data.tree.scope}
                focusEmployeeId={currentFocusEmployeeId}
                selectedNodeId={unifiedSelectedNodeId}
                canGoBack={focusStack.length > 0}
                onDrillDown={handleDrillDown}
                onGoBack={handleGoBack}
                onSelectEmployee={handleSelectEmployeeNode}
                onSelectCase={handleSelectCaseNode}
              />
            )}
          </Paper>

          <Stack spacing={2} sx={{ flex: 1 }}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="h6">Details Panel</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Click any graph node to inspect details.
              </Typography>
              <Divider sx={{ mb: 1.5 }} />
              {renderDetailPane()}
            </Paper>

            {isEmployeeSession && (
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6">Internal Employee Chat</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Real-time direct chat with managers, executives, and CSRs based on role access.
                </Typography>
                <Divider sx={{ mb: 1.5 }} />

                {internalChatContacts.length === 0 && !internalChatError && (
                  <Alert severity="info" sx={{ mb: 1.25 }}>
                    No internal chat contacts are currently available in your scope.
                  </Alert>
                )}

                {internalChatError && (
                  <Alert severity="error" sx={{ mb: 1.25 }}>
                    {internalChatError}
                  </Alert>
                )}

                {notificationFeed.length > 0 && (
                  <Stack spacing={0.75} sx={{ mb: 1.25 }}>
                    <Typography variant="subtitle2">Latest Notifications</Typography>
                    {notificationFeed.map((notification) => (
                      <Box
                        key={notification.id}
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          border: "1px solid #E5E7EB",
                          backgroundColor: "#FFFBEB",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {notification.type} | {safeFormatDate(notification.createdAt)}
                        </Typography>
                        <Typography variant="body2">{notification.message}</Typography>
                      </Box>
                    ))}
                  </Stack>
                )}

                <Stack spacing={1.25}>
                  <FormControl fullWidth size="small" disabled={internalChatContacts.length === 0}>
                    <InputLabel id="internal-chat-contact-select-label">Chat Contact</InputLabel>
                    <Select
                      labelId="internal-chat-contact-select-label"
                      label="Chat Contact"
                      value={selectedInternalChatContactId}
                      onChange={(event) => setSelectedInternalChatContactId(event.target.value)}
                    >
                      {internalChatContacts.map((contact) => (
                        <MenuItem key={contact.id} value={contact.id}>
                          {contact.name || contact.email} ({contact.role})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedInternalContact && (
                    <Typography variant="caption" color="text.secondary">
                      Chatting with {selectedInternalContact.name || selectedInternalContact.email} (
                      {selectedInternalContact.role})
                    </Typography>
                  )}

                  {internalChatLoading && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">
                        Loading internal messages...
                      </Typography>
                    </Stack>
                  )}

                  <Stack
                    spacing={1}
                    sx={{
                      maxHeight: 220,
                      overflowY: "auto",
                      border: "1px solid #E5E7EB",
                      borderRadius: 1,
                      p: 1,
                      backgroundColor: "#F9FAFB",
                    }}
                  >
                    {internalChatMessages.length === 0 && !internalChatLoading && (
                      <Typography variant="body2" color="text.secondary">
                        No internal messages in this conversation yet.
                      </Typography>
                    )}

                    {internalChatMessages.map((message) => (
                      <Box
                        key={message.id}
                        sx={{
                          alignSelf: message.isSelf ? "flex-end" : "flex-start",
                          maxWidth: "88%",
                          p: 1.1,
                          borderRadius: 1,
                          border: "1px solid #E5E7EB",
                          backgroundColor: message.isSelf ? "#E0F2FE" : "#F3F4F6",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {message.senderName} ({message.senderRole}) | {safeFormatDate(message.createdAt)}
                        </Typography>
                        <Typography variant="body2">{message.messageText}</Typography>
                      </Box>
                    ))}
                  </Stack>

                  {internalChatFeedback && (
                    <Alert severity={internalChatFeedback.type}>{internalChatFeedback.message}</Alert>
                  )}

                  <Stack component="form" spacing={1} onSubmit={handleSendInternalMessage}>
                    <TextField
                      multiline
                      minRows={2}
                      label="Internal Message"
                      value={internalChatDraft}
                      onChange={(event) => setInternalChatDraft(event.target.value)}
                      disabled={
                        sendingInternalChat || internalChatLoading || !selectedInternalChatContactId
                      }
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={
                        sendingInternalChat || internalChatLoading || !selectedInternalChatContactId
                      }
                    >
                      {sendingInternalChat ? "Sending..." : "Send Internal Message"}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Container>
  );
}
