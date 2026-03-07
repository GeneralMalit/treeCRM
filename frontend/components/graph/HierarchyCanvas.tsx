"use client";

import { Box, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import {
  buildHierarchyGraph,
  getEmployeeDisplayName,
  getEmployeeGraphAccent,
  truncateGraphLabel,
} from "@/lib/employeeGraph";
import type { EmployeeTreeEmployee, EmployeeTreeScope } from "@/lib/employeeTree";
import { layoutHierarchyGraph } from "./graphLayout";

type HierarchyCanvasProps = {
  employees: EmployeeTreeEmployee[];
  scope: EmployeeTreeScope;
  selectedEmployeeId: string | null;
  focusedCsrId: string | null;
  onSelectEmployee: (employee: EmployeeTreeEmployee) => void;
};

function renderLegendItem(label: string, color: string) {
  return (
    <Stack key={label} direction="row" spacing={0.75} alignItems="center">
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: "999px",
          backgroundColor: color,
          border: "1px solid rgba(15, 23, 42, 0.18)",
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

export function HierarchyCanvas({
  employees,
  scope,
  selectedEmployeeId,
  focusedCsrId,
  onSelectEmployee,
}: HierarchyCanvasProps) {
  const graph = useMemo(() => buildHierarchyGraph(scope, employees), [scope, employees]);
  const layout = useMemo(() => layoutHierarchyGraph(graph), [graph]);

  if (employees.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No employee nodes are currently available in this scope.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid #D5DDE6",
        background:
          "linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(239,246,255,0.94) 48%, rgba(248,250,252,0.98) 100%)",
      }}
    >
      <Stack spacing={1.25}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={1}
        >
          <Box>
            <Typography variant="h6">Employee Hierarchy</Typography>
            <Typography variant="body2" color="text.secondary">
              Dashed edges show reporting flow. Select a CSR node to open its focused skill tree.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
            {renderLegendItem("Executive", getEmployeeGraphAccent("Executive"))}
            {renderLegendItem("Manager", getEmployeeGraphAccent("Manager"))}
            {renderLegendItem("CSR", getEmployeeGraphAccent("CSR"))}
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box
                sx={{
                  width: 18,
                  borderTop: "2px dashed #64748B",
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Hierarchy edge
              </Typography>
            </Stack>
          </Stack>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Focused CSR:{" "}
          {focusedCsrId
            ? getEmployeeDisplayName(
                employees.find((employee) => employee.id === focusedCsrId) ?? {
                  name: null,
                  email: "Unknown CSR",
                },
              )
            : "Select a CSR node to inspect its radial case rings"}
        </Typography>

        <Box
          sx={{
            borderRadius: 2,
            overflow: "hidden",
            border: "1px solid #D7E3F0",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(241,245,249,0.94) 100%)",
          }}
        >
          <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width="100%" height="100%" role="img">
            <title>Employee hierarchy graph</title>
            <defs>
              <pattern id="hierarchy-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#E2E8F0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0" y="0" width={layout.width} height={layout.height} fill="url(#hierarchy-grid)" />

            {layout.edges.map((edge) => (
              <line
                key={edge.id}
                x1={edge.from.x}
                y1={edge.from.y}
                x2={edge.to.x}
                y2={edge.to.y}
                stroke="#64748B"
                strokeWidth="2"
                strokeDasharray="8 10"
                opacity="0.9"
              />
            ))}

            {layout.nodes.map((nodeLayout) => {
              const { employee } = nodeLayout.node;
              const isSelected = selectedEmployeeId === employee.id;
              const isFocused = focusedCsrId === employee.id;
              const accent = getEmployeeGraphAccent(employee.role);

              return (
                <g
                  key={employee.id}
                  onClick={() => onSelectEmployee(employee)}
                  style={{ cursor: "pointer" }}
                >
                  <title>{getEmployeeDisplayName(employee)}</title>
                  {(isSelected || isFocused) && (
                    <circle
                      cx={nodeLayout.x}
                      cy={nodeLayout.y}
                      r={nodeLayout.radius + 12}
                      fill="none"
                      stroke={isSelected ? "#0F172A" : accent}
                      strokeWidth="2"
                      opacity="0.7"
                    />
                  )}
                  <circle
                    cx={nodeLayout.x}
                    cy={nodeLayout.y}
                    r={nodeLayout.radius}
                    fill="#FFFFFF"
                    stroke={accent}
                    strokeWidth={isSelected ? 4 : 3}
                  />
                  <text
                    x={nodeLayout.x}
                    y={nodeLayout.y - 3}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill="#0F172A"
                  >
                    {employee.role === "Executive" ? "Exec" : truncateGraphLabel(employee.role, 5)}
                  </text>
                  <text
                    x={nodeLayout.x}
                    y={nodeLayout.y + 12}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#475569"
                  >
                    {nodeLayout.node.caseCount} cases
                  </text>
                  <text
                    x={nodeLayout.x}
                    y={nodeLayout.y + nodeLayout.radius + 18}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill="#0F172A"
                  >
                    {truncateGraphLabel(getEmployeeDisplayName(employee), 22)}
                  </text>
                  <text
                    x={nodeLayout.x}
                    y={nodeLayout.y + nodeLayout.radius + 34}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#475569"
                  >
                    {nodeLayout.node.customerCount} customers
                  </text>
                </g>
              );
            })}
          </svg>
        </Box>
      </Stack>
    </Box>
  );
}
