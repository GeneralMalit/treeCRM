"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  addInternalNote,
  fetchCaseManagementDetails,
  updateCaseStatusPriority,
  updateCaseTags,
  type CaseTagOption,
  type InternalNote,
} from "@/lib/caseManagement";
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
} from "@/lib/employeeTree";
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
    scope: {
      viewerId: string;
      viewerRole: Role;
      employeeCount: number;
      customerCount: number;
      caseCount: number;
    };
    data: EmployeeTreeEmployee[];
  };
};

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ReadyState };

type SelectedNode =
  | { kind: "employee"; employee: EmployeeTreeEmployee }
  | { kind: "customer"; employee: EmployeeTreeEmployee; customer: EmployeeTreeCustomer }
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

const priorityStyleMap: Record<
  EmployeeTreeCase["priority"],
  { border: string; background: string; chipColor: "error" | "warning" | "info" }
> = {
  High: {
    border: "#B91C1C",
    background: "#FEF2F2",
    chipColor: "error",
  },
  Medium: {
    border: "#B45309",
    background: "#FFFBEB",
    chipColor: "warning",
  },
  Low: {
    border: "#1D4ED8",
    background: "#EFF6FF",
    chipColor: "info",
  },
};

const CASE_STATUSES: CaseStatus[] = ["Open", "In Progress", "Resolved", "Dropped"];
const CASE_PRIORITIES: CasePriority[] = ["High", "Medium", "Low"];
const PRIORITY_RING_LAYOUT: Array<{ priority: CasePriority; label: string; width: string }> = [
  { priority: "High", label: "High Priority (Inner Arc)", width: "58%" },
  { priority: "Medium", label: "Medium Priority (Middle Arc)", width: "78%" },
  { priority: "Low", label: "Low Priority (Outer Arc)", width: "96%" },
];

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

function buildDefaultExpandedTree(employeeNodes: EmployeeTreeEmployee[]): Record<string, boolean> {
  const expanded: Record<string, boolean> = {};
  for (const employee of employeeNodes) {
    expanded[`employee:${employee.id}`] = true;
  }

  return expanded;
}

function pickInitialSelectedNode(employeeNodes: EmployeeTreeEmployee[]): SelectedNode | null {
  const [firstEmployee] = employeeNodes;
  if (!firstEmployee) {
    return null;
  }

  const firstCustomer = firstEmployee.customers[0];
  if (!firstCustomer) {
    return { kind: "employee", employee: firstEmployee };
  }

  const firstCase = firstCustomer.cases[0];
  if (!firstCase) {
    return { kind: "customer", employee: firstEmployee, customer: firstCustomer };
  }

  return {
    kind: "case",
    employee: firstEmployee,
    customer: firstCustomer,
    caseItem: firstCase,
  };
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

  if (selectedNode.kind === "customer") {
    const employee = employeeNodes.find((node) => node.id === selectedNode.employee.id);
    if (!employee) {
      return pickInitialSelectedNode(employeeNodes);
    }

    const customer = employee.customers.find((node) => node.id === selectedNode.customer.id);
    return customer ? { kind: "customer", employee, customer } : pickInitialSelectedNode(employeeNodes);
  }

  return pickCaseNodeById(employeeNodes, selectedNode.caseItem.id) ?? pickInitialSelectedNode(employeeNodes);
}

export function EmployeeTreeWorkspace({ allowedRoles, title, description }: EmployeeTreeWorkspaceProps) {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [caseMetaCaseId, setCaseMetaCaseId] = useState<string | null>(null);
  const [caseMetaLoading, setCaseMetaLoading] = useState(false);
  const [caseMetaError, setCaseMetaError] = useState<string | null>(null);
  const [caseTags, setCaseTags] = useState<CaseTagOption[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([]);
  const [statusDraft, setStatusDraft] = useState<CaseStatus>("Open");
  const [priorityDraft, setPriorityDraft] = useState<CasePriority>("Medium");
  const [noteDraft, setNoteDraft] = useState("");
  const [savingCaseFields, setSavingCaseFields] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);

  const selectedCaseId = selectedNode?.kind === "case" ? selectedNode.caseItem.id : null;
  const isCsrSession = state.status === "ready" && state.data.user.role === "CSR";

  const refreshTreeForCurrentUser = useCallback(
    async (accessToken: string, user: ReadyState["user"], preferredCaseId?: string) => {
      const tree = await fetchEmployeeTree(accessToken);
      const nextState: ReadyState = {
        user,
        tree,
      };

      setExpandedNodes((current) => ({
        ...buildDefaultExpandedTree(tree.data),
        ...current,
      }));

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

        setExpandedNodes(buildDefaultExpandedTree(tree.data));
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

  useEffect(() => {
    if (!isCsrSession || !selectedCaseId) {
      setCaseMetaCaseId(null);
      setCaseMetaLoading(false);
      setCaseMetaError(null);
      setCaseTags([]);
      setSelectedTagIds([]);
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

  const handleLogout = async () => {
    const accessToken = getStoredAccessToken();
    if (accessToken) {
      await logout(accessToken).catch(() => undefined);
    }

    clearStoredAccessToken();
    router.replace("/login");
  };

  const summary = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    return state.data.tree.scope;
  }, [state]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((current) => ({
      ...current,
      [nodeId]: !current[nodeId],
    }));
  };

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
      const tags = await updateCaseTags(accessToken, selectedCaseId, selectedTagIds);
      setCaseTags(tags);
      setSelectedTagIds(tags.filter((tag) => tag.selected).map((tag) => tag.id));
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

      return (
        <Stack spacing={1.5}>
          <Typography variant="h6">Employee</Typography>
          <Typography>Name: {selectedNode.employee.name ?? "No name set"}</Typography>
          <Typography>Email: {selectedNode.employee.email}</Typography>
          <Typography>Role: {selectedNode.employee.role}</Typography>
          <Typography>Customers: {selectedNode.employee.customers.length}</Typography>
          <Typography>Cases: {caseCount}</Typography>
          <Typography color="text.secondary">
            Created: {safeFormatDate(selectedNode.employee.createdAt)}
          </Typography>
        </Stack>
      );
    }

    if (selectedNode.kind === "customer") {
      return (
        <Stack spacing={1.5}>
          <Typography variant="h6">Customer</Typography>
          <Typography>Company: {selectedNode.customer.company}</Typography>
          <Typography>Customer User ID: {selectedNode.customer.userId}</Typography>
          <Typography>Linked Employee: {selectedNode.employee.name ?? selectedNode.employee.email}</Typography>
          <Typography>Cases: {selectedNode.customer.cases.length}</Typography>
          <Typography color="text.secondary">
            Created: {safeFormatDate(selectedNode.customer.createdAt)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Contact Info
          </Typography>
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
        </Stack>
      );
    }

    const caseStyle = priorityStyleMap[selectedNode.caseItem.priority];
    const selectedTags = caseTags.filter((tag) => selectedTagIds.includes(tag.id));
    const isSelectedCaseMetaCurrent = caseMetaCaseId === selectedNode.caseItem.id;

    return (
      <Stack spacing={1.5}>
        <Typography variant="h6">Case</Typography>
        <Typography>Title: {selectedNode.caseItem.title}</Typography>
        <Stack direction="row" spacing={1}>
          <Chip size="small" label={`Status: ${selectedNode.caseItem.status}`} variant="outlined" />
          <Chip
            size="small"
            color={caseStyle.chipColor}
            label={`Priority: ${selectedNode.caseItem.priority}`}
            variant="filled"
          />
        </Stack>
        <Typography>Employee: {selectedNode.employee.name ?? selectedNode.employee.email}</Typography>
        <Typography>Customer: {selectedNode.customer.company}</Typography>
        <Typography color="text.secondary">
          Updated: {safeFormatDate(selectedNode.caseItem.updatedAt)}
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
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Chip size="small" label={`Employees: ${summary.employeeCount}`} />
                <Chip size="small" label={`Customers: ${summary.customerCount}`} />
                <Chip size="small" label={`Cases: ${summary.caseCount}`} />
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
            <Typography variant="h6">Tree View</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Employee to customer to case hierarchy.
            </Typography>
            <Divider sx={{ mb: 1.5 }} />

            {state.status === "loading" && <Typography color="text.secondary">Loading tree data...</Typography>}

            {state.status === "ready" && state.data.tree.data.length === 0 && (
              <Alert severity="info">No assigned records are currently available in your scope.</Alert>
            )}

            {state.status === "ready" &&
              state.data.tree.data.map((employee) => {
                const employeeNodeId = `employee:${employee.id}`;
                const isEmployeeExpanded = expandedNodes[employeeNodeId] ?? false;
                const isEmployeeSelected =
                  selectedNode?.kind === "employee" && selectedNode.employee.id === employee.id;

                return (
                  <Box key={employee.id} sx={{ mb: 1.5 }}>
                    <Button
                      fullWidth
                      variant={isEmployeeSelected ? "contained" : "text"}
                      color={isEmployeeSelected ? "primary" : "inherit"}
                      onClick={() => setSelectedNode({ kind: "employee", employee })}
                      sx={{ justifyContent: "flex-start", textTransform: "none", gap: 1 }}
                    >
                      {employee.customers.length > 0 && (
                        <Box
                          component="span"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleNode(employeeNodeId);
                          }}
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            px: 0.5,
                            borderRadius: 0.5,
                            border: "1px solid #CBD5E1",
                            minWidth: "1.6rem",
                            textAlign: "center",
                          }}
                        >
                          {isEmployeeExpanded ? "-" : "+"}
                        </Box>
                      )}
                      <Typography component="span" sx={{ fontWeight: 600 }}>
                        {employee.name ?? employee.email}
                      </Typography>
                      <Chip size="small" label={employee.role} />
                    </Button>

                    {isEmployeeExpanded &&
                      employee.customers.map((customer) => {
                        const customerNodeId = `customer:${employee.id}:${customer.id}`;
                        const isCustomerExpanded = expandedNodes[customerNodeId] ?? false;
                        const isCustomerSelected =
                          selectedNode?.kind === "customer" &&
                          selectedNode.employee.id === employee.id &&
                          selectedNode.customer.id === customer.id;

                        return (
                          <Box key={customer.id} sx={{ pl: 3, mt: 1 }}>
                            <Button
                              fullWidth
                              variant={isCustomerSelected ? "contained" : "text"}
                              color={isCustomerSelected ? "secondary" : "inherit"}
                              onClick={() =>
                                setSelectedNode({
                                  kind: "customer",
                                  employee,
                                  customer,
                                })
                              }
                              sx={{ justifyContent: "flex-start", textTransform: "none", gap: 1 }}
                            >
                              {customer.cases.length > 0 && (
                                <Box
                                  component="span"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleNode(customerNodeId);
                                  }}
                                  sx={{
                                    fontFamily: "monospace",
                                    fontWeight: 700,
                                    px: 0.5,
                                    borderRadius: 0.5,
                                    border: "1px solid #CBD5E1",
                                    minWidth: "1.6rem",
                                    textAlign: "center",
                                  }}
                                >
                                  {isCustomerExpanded ? "-" : "+"}
                                </Box>
                              )}
                              <Typography component="span">{customer.company}</Typography>
                              <Chip size="small" label={`${customer.cases.length} case(s)`} />
                            </Button>

                            {isCustomerExpanded && (
                              <Box sx={{ pl: 3, mt: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Priority Semicircle Layout
                                </Typography>

                                {PRIORITY_RING_LAYOUT.map((ring) => {
                                  const casesInRing = customer.cases.filter(
                                    (caseItem) => caseItem.priority === ring.priority,
                                  );

                                  return (
                                    <Box
                                      key={`${customer.id}-${ring.priority}`}
                                      sx={{
                                        mt: 1,
                                        mx: "auto",
                                        width: ring.width,
                                        border: `2px solid ${priorityStyleMap[ring.priority].border}`,
                                        borderBottom: "none",
                                        borderRadius: "999px 999px 0 0",
                                        backgroundColor: priorityStyleMap[ring.priority].background,
                                        p: 1.25,
                                      }}
                                    >
                                      <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        sx={{ mb: 0.75 }}
                                      >
                                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                          {ring.label}
                                        </Typography>
                                        <Chip size="small" label={`${casesInRing.length}`} />
                                      </Stack>

                                      {casesInRing.length === 0 && (
                                        <Typography variant="caption" color="text.secondary">
                                          No cases on this arc.
                                        </Typography>
                                      )}

                                      {casesInRing.length > 0 && (
                                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                          {casesInRing.map((caseItem) => {
                                            const isCaseSelected =
                                              selectedNode?.kind === "case" &&
                                              selectedNode.employee.id === employee.id &&
                                              selectedNode.customer.id === customer.id &&
                                              selectedNode.caseItem.id === caseItem.id;

                                            const caseStyle = priorityStyleMap[caseItem.priority];

                                            return (
                                              <Button
                                                key={caseItem.id}
                                                onClick={() =>
                                                  setSelectedNode({
                                                    kind: "case",
                                                    employee,
                                                    customer,
                                                    caseItem,
                                                  })
                                                }
                                                variant={isCaseSelected ? "contained" : "outlined"}
                                                color={isCaseSelected ? "info" : "inherit"}
                                                size="small"
                                                sx={{
                                                  textTransform: "none",
                                                  borderColor: caseStyle.border,
                                                  backgroundColor: isCaseSelected
                                                    ? undefined
                                                    : caseStyle.background,
                                                  "&:hover": {
                                                    borderColor: caseStyle.border,
                                                    backgroundColor: isCaseSelected
                                                      ? undefined
                                                      : caseStyle.background,
                                                  },
                                                }}
                                              >
                                                <Stack direction="row" spacing={0.5} alignItems="center">
                                                  <Typography component="span" sx={{ fontSize: "0.78rem" }}>
                                                    {caseItem.title}
                                                  </Typography>
                                                  <Chip
                                                    size="small"
                                                    variant="outlined"
                                                    label={caseItem.status}
                                                    sx={{ height: 20 }}
                                                  />
                                                </Stack>
                                              </Button>
                                            );
                                          })}
                                        </Stack>
                                      )}
                                    </Box>
                                  );
                                })}
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                  </Box>
                );
              })}
          </Paper>

          <Paper elevation={1} sx={{ p: 2, flex: 1 }}>
            <Typography variant="h6">Details Panel</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Click any node in the tree to inspect details.
            </Typography>
            <Divider sx={{ mb: 1.5 }} />
            {renderDetailPane()}
          </Paper>
        </Stack>
      </Stack>
    </Container>
  );
}
