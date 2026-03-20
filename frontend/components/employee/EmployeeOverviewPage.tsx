"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShellEmptyState } from "@/components/shell/ShellEmptyState";
import { ShellPageHeader } from "@/components/shell/ShellPageHeader";
import { ShellSection } from "@/components/shell/ShellSection";
import { ShellStatStrip } from "@/components/shell/ShellStatStrip";
import { getLandingRoute, getStoredAccessToken, me } from "@/lib/auth";
import { fetchEmployeeTree, type EmployeeTreeEmployee, type EmployeeTreeScope } from "@/lib/employeeTree";
import type { Role } from "@/lib/roles";

type EmployeeOverviewPageProps = {
  role: Exclude<Role, "Customer" | "Admin" | "CSR">;
  title: string;
  description: string;
  workspaceHref: string;
  messagesHref: string;
};

function formatCustomerSatisfaction(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  return `${value.toFixed(1)}%`;
}

function getDisplayName(employee: EmployeeTreeEmployee): string {
  return employee.name?.trim() || employee.email;
}

export function EmployeeOverviewPage({
  role,
  title,
  description,
  workspaceHref,
  messagesHref,
}: EmployeeOverviewPageProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<EmployeeTreeEmployee[]>([]);
  const [scope, setScope] = useState<EmployeeTreeScope | null>(null);

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

        if (currentUser.role !== role) {
          router.replace(getLandingRoute(currentUser.role));
          return;
        }

        const tree = await fetchEmployeeTree(accessToken);
        if (cancelled) {
          return;
        }

        setUserName(currentUser.name?.trim() || null);
        setUserEmail(currentUser.email);
        setTreeData(tree.data);
        setScope(tree.scope);
        setStatus("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Failed to load overview.");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [role, router]);

  const stats = useMemo(() => {
    if (!scope) {
      return [];
    }

    return [
      { label: "Employees", value: String(scope.employeeCount), detail: "Visible in scope" },
      { label: "Customers", value: String(scope.customerCount), detail: "Assigned accounts" },
      { label: "Cases", value: String(scope.caseCount), detail: "Open and historical" },
      { label: "Ongoing", value: String(scope.metrics.ongoingCases), detail: "Currently active" },
    ];
  }, [scope]);

  const managerRows = useMemo(() => {
    if (!scope) {
      return [];
    }

    if (role === "Manager") {
      return treeData.filter((employee) => employee.role === "CSR").map((employee) => ({
        id: employee.id,
        name: getDisplayName(employee),
        email: employee.email,
        count: employee.customers.length,
        ongoing: employee.metrics.ongoingCases,
        resolvedToday: employee.metrics.resolvedToday,
        csat: employee.metrics.customerSatisfaction,
      }));
    }

    if (scope.managerAggregates) {
      return scope.managerAggregates.managers.map((manager) => ({
        id: manager.managerId,
        name: manager.managerName?.trim() || manager.managerEmail,
        email: manager.managerEmail,
        count: manager.csrCount,
        ongoing: manager.metrics.ongoingCases,
        resolvedToday: manager.metrics.resolvedToday,
        csat: manager.metrics.customerSatisfaction,
      }));
    }

    return treeData
      .filter((employee) => employee.role === "Manager")
      .map((employee) => ({
        id: employee.id,
        name: getDisplayName(employee),
        email: employee.email,
        count: employee.customers.length,
        ongoing: employee.metrics.ongoingCases,
        resolvedToday: employee.metrics.resolvedToday,
        csat: employee.metrics.customerSatisfaction,
      }));
  }, [role, scope, treeData]);

  return (
    <Stack spacing={3}>
      <ShellPageHeader
      title={title}
      description={description}
      actions={
        <>
          <Button component={Link} href={workspaceHref} variant="outlined">
            Workspace
          </Button>
          <Button component={Link} href={messagesHref} variant="contained">
            Messages
          </Button>
        </>
      }
      />

      {status === "loading" ? <Alert severity="info">Loading overview...</Alert> : null}
      {status === "error" ? <Alert severity="error">{message ?? "Failed to load overview."}</Alert> : null}
      {status === "ready" && userEmail ? (
        <Typography variant="body2" color="text.secondary">
          Signed in as {userName ? `${userName} (${userEmail})` : userEmail}
        </Typography>
      ) : null}

      {scope ? <ShellStatStrip items={stats} /> : null}

      {status === "ready" ? (
        <ShellSection>
          <Stack spacing={1.5}>
            <Typography variant="h6" fontWeight={700}>
              Summary
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {role === "Manager"
                ? "Your overview keeps team workload and assigned CSRs visible."
                : "Your overview keeps manager coverage and aggregate health visible."}
            </Typography>
            {scope?.teamMetrics ? (
              <Typography variant="body2" color="text.secondary">
                Team allocation mode: {scope.teamMetrics.allocationMode} | CSRs: {scope.teamMetrics.csrCount} | Ongoing cases:{" "}
                {scope.teamMetrics.metrics.ongoingCases}
              </Typography>
            ) : null}
            {scope?.managerAggregates ? (
              <Typography variant="body2" color="text.secondary">
                Managers: {scope.managerAggregates.managerCount} | Unassigned CSRs: {scope.managerAggregates.unassignedCsrCount}
              </Typography>
            ) : null}
          </Stack>
        </ShellSection>
      ) : null}

      {status === "ready" && managerRows.length > 0 ? (
        <ShellSection>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>
              {role === "Manager" ? "Assigned CSRs" : "Manager roster"}
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: "none" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>{role === "Manager" ? "Customers" : "CSRs"}</TableCell>
                    <TableCell>Ongoing</TableCell>
                    <TableCell>Resolved today</TableCell>
                    <TableCell>CSAT</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {managerRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{row.ongoing}</TableCell>
                      <TableCell>{row.resolvedToday}</TableCell>
                      <TableCell>{formatCustomerSatisfaction(row.csat)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </ShellSection>
      ) : null}

      {status === "ready" && managerRows.length === 0 ? (
        <ShellEmptyState
          title="Nothing to show yet"
          description="No direct reports are visible in this scope."
        />
      ) : null}
    </Stack>
  );
}
