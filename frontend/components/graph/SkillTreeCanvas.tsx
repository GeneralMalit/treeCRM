"use client";

import { Box, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import {
  buildSkillTreeGraph,
  ENDORSEMENT_HALO_COLOR,
  getEmployeeDisplayName,
  PRIORITY_OUTLINE_COLORS,
  STATUS_FILL_COLORS,
  truncateGraphLabel,
} from "@/lib/employeeGraph";
import type { EmployeeTreeCase, EmployeeTreeCustomer, EmployeeTreeEmployee } from "@/lib/employeeTree";
import { describeArc, layoutSkillTreeGraph } from "./graphLayout";

type SkillTreeCanvasProps = {
  employee: EmployeeTreeEmployee;
  activeCustomerId: string | null;
  selectedEmployeeId: string | null;
  selectedCustomerId: string | null;
  selectedCaseId: string | null;
  onSelectEmployee: (employee: EmployeeTreeEmployee) => void;
  onSelectCustomer: (employee: EmployeeTreeEmployee, customer: EmployeeTreeCustomer) => void;
  onSelectCase: (
    employee: EmployeeTreeEmployee,
    customer: EmployeeTreeCustomer,
    caseItem: EmployeeTreeCase,
  ) => void;
};

function renderLegendSwatch(
  label: string,
  style: {
    border?: string;
    background?: string;
    boxShadow?: string;
  },
) {
  return (
    <Stack key={label} direction="row" spacing={0.75} alignItems="center">
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: "999px",
          border: style.border ?? "1px solid transparent",
          backgroundColor: style.background ?? "transparent",
          boxShadow: style.boxShadow,
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

export function SkillTreeCanvas({
  employee,
  activeCustomerId,
  selectedEmployeeId,
  selectedCustomerId,
  selectedCaseId,
  onSelectEmployee,
  onSelectCustomer,
  onSelectCase,
}: SkillTreeCanvasProps) {
  const graph = useMemo(() => buildSkillTreeGraph(employee, activeCustomerId), [employee, activeCustomerId]);
  const layout = useMemo(() => layoutSkillTreeGraph(graph), [graph]);

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid #D5DDE6",
        background:
          "linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(236,253,245,0.92) 52%, rgba(240,249,255,0.98) 100%)",
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
            <Typography variant="h6">CSR Skill Tree</Typography>
            <Typography variant="body2" color="text.secondary">
              {getEmployeeDisplayName(employee)} with customer context above and case rings by priority.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
            {renderLegendSwatch("High outline", {
              border: `2px solid ${PRIORITY_OUTLINE_COLORS.High}`,
              background: "#FFFFFF",
            })}
            {renderLegendSwatch("In Progress fill", {
              border: "1px solid #D1D5DB",
              background: STATUS_FILL_COLORS["In Progress"],
            })}
            {renderLegendSwatch("Pending halo", {
              border: "1px solid #FFFFFF",
              background: "#FFFFFF",
              boxShadow: `0 0 0 4px ${ENDORSEMENT_HALO_COLOR}`,
            })}
          </Stack>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Customer focus: {graph.activeCustomer ? graph.activeCustomer.company : "No customers assigned"}
        </Typography>

        <Box
          sx={{
            borderRadius: 2,
            overflow: "hidden",
            border: "1px solid #D7E3F0",
            background:
              "radial-gradient(circle at top, rgba(255,255,255,0.95) 0%, rgba(240,249,255,0.92) 45%, rgba(236,253,245,0.94) 100%)",
          }}
        >
          <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width="100%" height="100%" role="img">
            <title>CSR skill tree graph</title>
            <defs>
              <pattern id="skill-tree-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#E2E8F0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0" y="0" width={layout.width} height={layout.height} fill="url(#skill-tree-grid)" />

            {layout.rings.map((ring) => (
              <path
                key={ring.priority}
                d={describeArc(layout.root.x, layout.root.y, ring.radius, ring.startAngle, ring.endAngle)}
                stroke={PRIORITY_OUTLINE_COLORS[ring.priority]}
                strokeWidth="2"
                strokeDasharray="6 8"
                fill="none"
                opacity="0.55"
              />
            ))}

            {layout.customers.map((customerNode) => {
              const isSelected = selectedCustomerId === customerNode.customer.id;
              const hasCases = customerNode.customer.cases.length > 0;

              return (
                <g
                  key={customerNode.customer.id}
                  onClick={() => onSelectCustomer(employee, customerNode.customer)}
                  style={{ cursor: "pointer" }}
                >
                  <title>{customerNode.customer.company}</title>
                  <line
                    x1={layout.root.x}
                    y1={layout.root.y - layout.root.radius}
                    x2={customerNode.x}
                    y2={customerNode.y + customerNode.height / 2}
                    stroke={isSelected ? "#1D4ED8" : "#94A3B8"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    opacity={0.85}
                  />
                  <rect
                    x={customerNode.x - customerNode.width / 2}
                    y={customerNode.y - customerNode.height / 2}
                    width={customerNode.width}
                    height={customerNode.height}
                    rx="16"
                    fill={isSelected ? "#DBEAFE" : "#FFFFFF"}
                    stroke={isSelected ? "#2563EB" : "#94A3B8"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  <text
                    x={customerNode.x}
                    y={customerNode.y - 2}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="600"
                    fill="#0F172A"
                  >
                    {truncateGraphLabel(customerNode.customer.company, 18)}
                  </text>
                  <text
                    x={customerNode.x}
                    y={customerNode.y + 13}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#475569"
                  >
                    {hasCases ? `${customerNode.customer.cases.length} case(s)` : "No cases"}
                  </text>
                </g>
              );
            })}

            {graph.activeCustomer &&
              layout.caseNodes.map((caseNode) => {
                const caseItem = caseNode.caseItem;
                const isSelected = selectedCaseId === caseItem.id;
                const strokeColor = PRIORITY_OUTLINE_COLORS[caseItem.priority];
                const fillColor = STATUS_FILL_COLORS[caseItem.status];

                return (
                  <g
                    key={caseItem.id}
                    onClick={() => onSelectCase(employee, graph.activeCustomer as EmployeeTreeCustomer, caseItem)}
                    style={{ cursor: "pointer" }}
                  >
                    <title>{caseItem.title}</title>
                    <line
                      x1={layout.root.x}
                      y1={layout.root.y}
                      x2={caseNode.x}
                      y2={caseNode.y}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 2.5 : 1.75}
                    />
                    {caseItem.hasPendingEndorsement && (
                      <circle
                        cx={caseNode.x}
                        cy={caseNode.y}
                        r={caseNode.radius + 7}
                        fill="none"
                        stroke={ENDORSEMENT_HALO_COLOR}
                        strokeWidth="4"
                        opacity="0.65"
                      />
                    )}
                    {isSelected && (
                      <circle
                        cx={caseNode.x}
                        cy={caseNode.y}
                        r={caseNode.radius + 10}
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth="2"
                        opacity="0.8"
                      />
                    )}
                    <circle
                      cx={caseNode.x}
                      cy={caseNode.y}
                      r={caseNode.radius}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth="3"
                    />
                    <text
                      x={caseNode.x}
                      y={caseNode.y + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill="#0F172A"
                    >
                      {truncateGraphLabel(caseItem.title, 10)}
                    </text>
                    <text
                      x={caseNode.x}
                      y={caseNode.y + caseNode.radius + 16}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#475569"
                    >
                      {truncateGraphLabel(caseItem.status, 12)}
                    </text>
                  </g>
                );
              })}

            {selectedEmployeeId === employee.id && (
              <circle
                cx={layout.root.x}
                cy={layout.root.y}
                r={layout.root.radius + 12}
                fill="none"
                stroke="#0F172A"
                strokeWidth="2"
                opacity="0.75"
              />
            )}

            <g onClick={() => onSelectEmployee(employee)} style={{ cursor: "pointer" }}>
              <title>{getEmployeeDisplayName(employee)}</title>
              <circle
                cx={layout.root.x}
                cy={layout.root.y}
                r={layout.root.radius}
                fill="#0F766E"
                stroke="#064E3B"
                strokeWidth="4"
              />
              <text
                x={layout.root.x}
                y={layout.root.y + 4}
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="#F8FAFC"
              >
                CSR
              </text>
              <text
                x={layout.root.x}
                y={layout.root.y + 52}
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                fill="#0F172A"
              >
                {truncateGraphLabel(getEmployeeDisplayName(employee), 24)}
              </text>
            </g>
          </svg>
        </Box>
      </Stack>
    </Box>
  );
}
