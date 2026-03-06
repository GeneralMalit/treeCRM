"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearStoredAccessToken,
  getLandingRoute,
  getStoredAccessToken,
  logout,
  me,
} from "@/lib/auth";
import { fetchEmployeeTree, type EmployeeTreeCase, type EmployeeTreeCustomer, type EmployeeTreeEmployee } from "@/lib/employeeTree";
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

export function EmployeeTreeWorkspace({ allowedRoles, title, description }: EmployeeTreeWorkspaceProps) {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

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

                            {isCustomerExpanded &&
                              customer.cases.map((caseItem) => {
                                const isCaseSelected =
                                  selectedNode?.kind === "case" &&
                                  selectedNode.employee.id === employee.id &&
                                  selectedNode.customer.id === customer.id &&
                                  selectedNode.caseItem.id === caseItem.id;

                                const caseStyle = priorityStyleMap[caseItem.priority];

                                return (
                                  <Box key={caseItem.id} sx={{ pl: 3, mt: 1 }}>
                                    <Button
                                      fullWidth
                                      onClick={() =>
                                        setSelectedNode({
                                          kind: "case",
                                          employee,
                                          customer,
                                          caseItem,
                                        })
                                      }
                                      variant={isCaseSelected ? "contained" : "text"}
                                      color={isCaseSelected ? "info" : "inherit"}
                                      sx={{
                                        justifyContent: "space-between",
                                        textTransform: "none",
                                        borderLeft: `4px solid ${caseStyle.border}`,
                                        backgroundColor: isCaseSelected ? undefined : caseStyle.background,
                                        "&:hover": {
                                          backgroundColor: isCaseSelected ? undefined : caseStyle.background,
                                        },
                                      }}
                                    >
                                      <Typography component="span" sx={{ textAlign: "left", mr: 1 }}>
                                        {caseItem.title}
                                      </Typography>
                                      <Stack direction="row" spacing={0.75}>
                                        <Chip size="small" variant="outlined" label={caseItem.status} />
                                        <Chip size="small" color={caseStyle.chipColor} label={caseItem.priority} />
                                      </Stack>
                                    </Button>
                                  </Box>
                                );
                              })}
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
