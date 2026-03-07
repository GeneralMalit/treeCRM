"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    buildUnifiedTree,
    ENDORSEMENT_HALO_COLOR,
    getEmployeeGraphAccent,
    PRIORITY_OUTLINE_COLORS,
    STATUS_FILL_COLORS,
    truncateGraphLabel,
    type UnifiedTreeNode,
} from "@/lib/employeeGraph";
import type {
    EmployeeTreeCase,
    EmployeeTreeCustomer,
    EmployeeTreeEmployee,
    EmployeeTreeScope,
} from "@/lib/employeeTree";
import { describeArc, layoutUnifiedTree } from "./graphLayout";

type UnifiedTreeCanvasProps = {
    employees: EmployeeTreeEmployee[];
    scope: EmployeeTreeScope;
    expandedNodeIds: ReadonlySet<string>;
    selectedNodeId: string | null;
    onToggleExpand: (nodeId: string) => void;
    onSelectEmployee: (employee: EmployeeTreeEmployee) => void;
    onSelectCustomer: (employee: EmployeeTreeEmployee, customer: EmployeeTreeCustomer) => void;
    onSelectCase: (
        employee: EmployeeTreeEmployee,
        customer: EmployeeTreeCustomer,
        caseItem: EmployeeTreeCase,
    ) => void;
};

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.08;

function renderLegendSwatch(
    label: string,
    style: { border?: string; background?: string; boxShadow?: string },
) {
    return (
        <Stack key={label} direction="row" spacing={0.5} alignItems="center">
            <Box
                sx={{
                    width: 12,
                    height: 12,
                    borderRadius: "999px",
                    border: style.border ?? "1px solid transparent",
                    backgroundColor: style.background ?? "transparent",
                    boxShadow: style.boxShadow,
                }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                {label}
            </Typography>
        </Stack>
    );
}

export function UnifiedTreeCanvas({
    employees,
    scope,
    expandedNodeIds,
    selectedNodeId,
    onToggleExpand,
    onSelectEmployee,
    onSelectCustomer,
    onSelectCase,
}: UnifiedTreeCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const panOffsetStartRef = useRef({ x: 0, y: 0 });

    // Build model + layout
    const model = useMemo(
        () => buildUnifiedTree(scope, employees, expandedNodeIds),
        [scope, employees, expandedNodeIds],
    );
    const layout = useMemo(() => layoutUnifiedTree(model), [model]);

    // Reset view when tree data changes (role, data reload)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        setPanOffset({ x: 0, y: 0 });
        setZoom(1);
    }, [scope.viewerId]);

    // ---- Pan handlers ----
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0) return;
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panOffsetStartRef.current = { ...panOffset };
        (e.target as Element).setPointerCapture?.(e.pointerId);
    }, [panOffset]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isPanning) return;
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPanOffset({
            x: panOffsetStartRef.current.x + dx / zoom,
            y: panOffsetStartRef.current.y + dy / zoom,
        });
    }, [isPanning, zoom]);

    const handlePointerUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    // ---- Zoom handler ----
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setZoom((prev) => {
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta));
        });
    }, []);

    const handleResetView = useCallback(() => {
        setPanOffset({ x: 0, y: 0 });
        setZoom(1);
    }, []);

    // ---- Node click ----
    const handleNodeClick = useCallback(
        (node: UnifiedTreeNode, e: React.MouseEvent) => {
            e.stopPropagation();

            // Toggle expansion if expandable
            if (node.expandable) {
                onToggleExpand(node.id);
            }

            // Fire selection callback
            if (node.kind === "employee" && node.employee) {
                onSelectEmployee(node.employee);
            } else if (node.kind === "customer" && node.employee && node.customer) {
                onSelectCustomer(node.employee, node.customer);
            } else if (node.kind === "case" && node.employee && node.customer && node.caseItem) {
                onSelectCase(node.employee, node.customer, node.caseItem);
            }
        },
        [onToggleExpand, onSelectEmployee, onSelectCustomer, onSelectCase],
    );

    // Compute visible viewBox (large virtual canvas, transform handles offset)
    const vbWidth = (layout.maxX - layout.minX) * 1.2;
    const vbHeight = (layout.maxY - layout.minY) * 1.2;
    const vbCx = (layout.minX + layout.maxX) / 2;
    const vbCy = (layout.minY + layout.maxY) / 2;

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
                    "linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(236,253,245,0.92) 52%, rgba(240,249,255,0.98) 100%)",
            }}
        >
            <Stack spacing={1}>
                {/* Header + legend */}
                <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                    spacing={1}
                >
                    <Box>
                        <Typography variant="h6">Tree View</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Drag to pan, scroll to zoom. Click a node to expand/collapse and see details.
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center">
                        <Button size="small" variant="outlined" onClick={handleResetView}>
                            Reset View
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                            {Math.round(zoom * 100)}%
                        </Typography>
                    </Stack>
                </Stack>

                {/* Legend */}
                <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
                    {renderLegendSwatch("Executive", {
                        border: `2px solid ${getEmployeeGraphAccent("Executive")}`,
                        background: "#FFFFFF",
                    })}
                    {renderLegendSwatch("Manager", {
                        border: `2px solid ${getEmployeeGraphAccent("Manager")}`,
                        background: "#FFFFFF",
                    })}
                    {renderLegendSwatch("CSR", {
                        border: `2px solid ${getEmployeeGraphAccent("CSR")}`,
                        background: "#FFFFFF",
                    })}
                    {renderLegendSwatch("Customer", {
                        border: "2px solid #64748B",
                        background: "#F8FAFC",
                    })}
                    {renderLegendSwatch("High", {
                        border: `2px solid ${PRIORITY_OUTLINE_COLORS.High}`,
                        background: "#FFFFFF",
                    })}
                    {renderLegendSwatch("Medium", {
                        border: `2px solid ${PRIORITY_OUTLINE_COLORS.Medium}`,
                        background: "#FFFFFF",
                    })}
                    {renderLegendSwatch("Low", {
                        border: `2px solid ${PRIORITY_OUTLINE_COLORS.Low}`,
                        background: "#FFFFFF",
                    })}
                    {renderLegendSwatch("In Progress", {
                        border: "1px solid #D1D5DB",
                        background: STATUS_FILL_COLORS["In Progress"],
                    })}
                    {renderLegendSwatch("Endorsed", {
                        border: "1px solid #FFFFFF",
                        background: "#FFFFFF",
                        boxShadow: `0 0 0 3px ${ENDORSEMENT_HALO_COLOR}`,
                    })}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ width: 16, borderTop: "2px dashed #64748B" }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                            Hierarchy
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ width: 16, borderTop: "2px solid #94A3B8" }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                            Owns
                        </Typography>
                    </Stack>
                </Stack>

                {/* Canvas */}
                <Box
                    ref={containerRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onWheel={handleWheel}
                    sx={{
                        borderRadius: 2,
                        overflow: "hidden",
                        border: "1px solid #D7E3F0",
                        background:
                            "radial-gradient(circle at center, rgba(255,255,255,0.96) 0%, rgba(240,249,255,0.92) 45%, rgba(236,253,245,0.94) 100%)",
                        cursor: isPanning ? "grabbing" : "grab",
                        userSelect: "none",
                        touchAction: "none",
                        minHeight: 480,
                        maxHeight: 720,
                    }}
                >
                    <svg
                        viewBox={`${vbCx - vbWidth / 2} ${vbCy - vbHeight / 2} ${vbWidth} ${vbHeight}`}
                        width="100%"
                        height="100%"
                        style={{ display: "block", minHeight: 480, maxHeight: 720 }}
                        role="img"
                    >
                        <title>Unified tree view</title>
                        <defs>
                            <pattern
                                id="unified-grid"
                                width={28 / zoom}
                                height={28 / zoom}
                                patternUnits="userSpaceOnUse"
                                patternTransform={`translate(${panOffset.x} ${panOffset.y})`}
                            >
                                <path
                                    d={`M ${28 / zoom} 0 L 0 0 0 ${28 / zoom}`}
                                    fill="none"
                                    stroke="#E2E8F0"
                                    strokeWidth={1 / zoom}
                                />
                            </pattern>
                        </defs>
                        <rect
                            x={vbCx - vbWidth / 2}
                            y={vbCy - vbHeight / 2}
                            width={vbWidth}
                            height={vbHeight}
                            fill="url(#unified-grid)"
                        />

                        <g transform={`translate(${panOffset.x} ${panOffset.y}) scale(${zoom})`}>
                            {/* Priority ring arcs */}
                            {layout.arcs.map((arc, i) => (
                                <path
                                    key={`arc-${arc.parentNodeId}-${arc.priority}-${i}`}
                                    d={describeArc(arc.cx, arc.cy, arc.radius, arc.startAngle, arc.endAngle)}
                                    stroke={PRIORITY_OUTLINE_COLORS[arc.priority]}
                                    strokeWidth={2 / zoom}
                                    strokeDasharray={`${6 / zoom} ${8 / zoom}`}
                                    fill="none"
                                    opacity={0.45}
                                />
                            ))}

                            {/* Edges */}
                            {layout.edges.map((edge) => (
                                <line
                                    key={edge.id}
                                    x1={edge.fromX}
                                    y1={edge.fromY}
                                    x2={edge.toX}
                                    y2={edge.toY}
                                    stroke={edge.style === "dashed" ? "#64748B" : "#94A3B8"}
                                    strokeWidth={2 / zoom}
                                    strokeDasharray={edge.style === "dashed" ? `${8 / zoom} ${10 / zoom}` : undefined}
                                    opacity={0.85}
                                />
                            ))}

                            {/* Nodes */}
                            {layout.nodes.map((nl) => {
                                const isSelected = selectedNodeId === nl.node.id;
                                const isExpanded = nl.node.expanded;
                                const r = nl.radius;

                                return (
                                    <g
                                        key={nl.node.id}
                                        onClick={(e) => handleNodeClick(nl.node, e)}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <title>{nl.node.label}</title>

                                        {/* Endorsement halo */}
                                        {nl.node.haloColor && (
                                            <circle
                                                cx={nl.x}
                                                cy={nl.y}
                                                r={r + 8}
                                                fill="none"
                                                stroke={nl.node.haloColor}
                                                strokeWidth={4 / zoom}
                                                opacity={0.6}
                                            />
                                        )}

                                        {/* Selection halo */}
                                        {isSelected && (
                                            <circle
                                                cx={nl.x}
                                                cy={nl.y}
                                                r={r + 11}
                                                fill="none"
                                                stroke="#0F172A"
                                                strokeWidth={2 / zoom}
                                                opacity={0.75}
                                            />
                                        )}

                                        {/* Main circle */}
                                        <circle
                                            cx={nl.x}
                                            cy={nl.y}
                                            r={r}
                                            fill={nl.node.fillColor}
                                            stroke={nl.node.accentColor}
                                            strokeWidth={(isSelected ? 4 : 3) / zoom}
                                        />

                                        {/* Expand indicator — small "+" or "−" badge */}
                                        {nl.node.expandable && (
                                            <>
                                                <circle
                                                    cx={nl.x + r * 0.7}
                                                    cy={nl.y + r * 0.7}
                                                    r={8 / zoom}
                                                    fill="#FFFFFF"
                                                    stroke="#94A3B8"
                                                    strokeWidth={1.5 / zoom}
                                                />
                                                <text
                                                    x={nl.x + r * 0.7}
                                                    y={nl.y + r * 0.7 + 4 / zoom}
                                                    textAnchor="middle"
                                                    fontSize={12 / zoom}
                                                    fontWeight="700"
                                                    fill="#475569"
                                                >
                                                    {isExpanded ? "−" : "+"}
                                                </text>
                                            </>
                                        )}

                                        {/* Label (inside for employee/case, outside for customer) */}
                                        {nl.node.kind === "employee" && (
                                            <>
                                                <text
                                                    x={nl.x}
                                                    y={nl.y - 4}
                                                    textAnchor="middle"
                                                    fontSize={11 / zoom}
                                                    fontWeight="700"
                                                    fill="#0F172A"
                                                >
                                                    {nl.node.employee?.role === "Executive"
                                                        ? "Exec"
                                                        : truncateGraphLabel(nl.node.employee?.role ?? "", 5)}
                                                </text>
                                                <text
                                                    x={nl.x}
                                                    y={nl.y + 10}
                                                    textAnchor="middle"
                                                    fontSize={9 / zoom}
                                                    fill="#475569"
                                                >
                                                    {nl.node.metricsSummary
                                                        ? truncateGraphLabel(nl.node.metricsSummary, 18)
                                                        : ""}
                                                </text>
                                                {/* Name below circle */}
                                                <text
                                                    x={nl.x}
                                                    y={nl.y + r + 16 / zoom}
                                                    textAnchor="middle"
                                                    fontSize={12 / zoom}
                                                    fontWeight="700"
                                                    fill="#0F172A"
                                                >
                                                    {truncateGraphLabel(nl.node.label, 20)}
                                                </text>
                                            </>
                                        )}

                                        {nl.node.kind === "customer" && (
                                            <>
                                                <text
                                                    x={nl.x}
                                                    y={nl.y + 3}
                                                    textAnchor="middle"
                                                    fontSize={10 / zoom}
                                                    fontWeight="600"
                                                    fill="#0F172A"
                                                >
                                                    {truncateGraphLabel(nl.node.label, 12)}
                                                </text>
                                                <text
                                                    x={nl.x}
                                                    y={nl.y + r + 14 / zoom}
                                                    textAnchor="middle"
                                                    fontSize={10 / zoom}
                                                    fill="#475569"
                                                >
                                                    {nl.node.subtitle}
                                                </text>
                                            </>
                                        )}

                                        {nl.node.kind === "case" && (
                                            <>
                                                <text
                                                    x={nl.x}
                                                    y={nl.y + 3}
                                                    textAnchor="middle"
                                                    fontSize={9 / zoom}
                                                    fontWeight="700"
                                                    fill="#0F172A"
                                                >
                                                    {truncateGraphLabel(nl.node.label, 10)}
                                                </text>
                                                <text
                                                    x={nl.x}
                                                    y={nl.y + r + 13 / zoom}
                                                    textAnchor="middle"
                                                    fontSize={9 / zoom}
                                                    fill="#475569"
                                                >
                                                    {nl.node.subtitle}
                                                </text>
                                            </>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
                </Box>
            </Stack>
        </Box>
    );
}
