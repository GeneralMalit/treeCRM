"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildUnifiedTree,
  ENDORSEMENT_HALO_COLOR,
  getEmployeeGraphAccent,
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
import { layoutUnifiedTree } from "./graphLayout";
import { createSimulation, type ForceSimulation } from "./forceSimulation";

type UnifiedTreeCanvasProps = {
  employees: EmployeeTreeEmployee[];
  scope: EmployeeTreeScope;
  focusEmployeeId: string | null;
  selectedNodeId: string | null;
  canGoBack: boolean;
  onDrillDown: (employeeId: string) => void;
  onGoBack: () => void;
  onSelectEmployee: (employee: EmployeeTreeEmployee) => void;
  onSelectCase: (
    employee: EmployeeTreeEmployee,
    customer: EmployeeTreeCustomer,
    caseItem: EmployeeTreeCase,
  ) => void;
};

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.08;
const BOUNDING_BOX_PADDING = 80;

function renderLegendSwatch(
  label: string,
  style: { border?: string; background?: string; boxShadow?: string },
) {
  return (
    <Stack key={label} direction="row" spacing={0.6} alignItems="center">
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
  focusEmployeeId,
  selectedNodeId,
  canGoBack,
  onDrillDown,
  onGoBack,
  onSelectEmployee,
  onSelectCase,
}: UnifiedTreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetStartRef = useRef({ x: 0, y: 0 });

  // Build the data model and compute seed positions.
  const model = useMemo(
    () => buildUnifiedTree(scope, employees, focusEmployeeId),
    [scope, employees, focusEmployeeId],
  );
  const seedLayout = useMemo(() => layoutUnifiedTree(model), [model]);

  // Force simulation state.
  const simulationRef = useRef<ForceSimulation | null>(null);
  const [simPositions, setSimPositions] = useState<
    ReadonlyArray<{ id: string; x: number; y: number; radius: number }>
  >([]);
  const [bounds, setBounds] = useState({ minX: -400, minY: -400, maxX: 400, maxY: 400 });

  const nodeById = useMemo(() => {
    const map = new Map<string, UnifiedTreeNode>();
    for (const nl of seedLayout.nodes) {
      map.set(nl.node.id, nl.node);
    }
    return map;
  }, [seedLayout.nodes]);

  // Reset pan/zoom on viewer or focus change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPanOffset({ x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoom(1);
  }, [scope.viewerId, focusEmployeeId]);

  // Create / update simulation.
  useEffect(() => {
    const simNodes = seedLayout.nodes.map((nl) => ({
      id: nl.node.id,
      x: nl.x,
      y: nl.y,
      radius: nl.radius,
      pinned: nl.node.parentId === null,
      parentId: nl.node.parentId,
    }));

    const simEdges = seedLayout.edges.map((e) => ({
      source: e.fromId,
      target: e.toId,
    }));

    if (!simulationRef.current) {
      const sim = createSimulation(simNodes, simEdges);
      simulationRef.current = sim;

      sim.onTick((nodes) => {
        const positions = nodes.map((n) => ({
          id: n.id,
          x: n.x,
          y: n.y,
          radius: n.radius,
        }));
        setSimPositions(positions);

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const n of nodes) {
          minX = Math.min(minX, n.x - n.radius - BOUNDING_BOX_PADDING);
          minY = Math.min(minY, n.y - n.radius - BOUNDING_BOX_PADDING);
          maxX = Math.max(maxX, n.x + n.radius + BOUNDING_BOX_PADDING);
          maxY = Math.max(maxY, n.y + n.radius + BOUNDING_BOX_PADDING);
        }
        if (minX !== Infinity) {
          setBounds({ minX, minY, maxX, maxY });
        }
      });
    } else {
      simulationRef.current.updateGraph(simNodes, simEdges);
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedLayout]);

  // Cleanup.
  useEffect(() => {
    return () => {
      simulationRef.current?.stop();
      simulationRef.current = null;
    };
  }, []);

  // Pointer handlers.
  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      setIsPanning(true);
      panStartRef.current = { x: event.clientX, y: event.clientY };
      panOffsetStartRef.current = { ...panOffset };
      (event.target as Element).setPointerCapture?.(event.pointerId);
    },
    [panOffset],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isPanning) return;
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;
      setPanOffset({
        x: panOffsetStartRef.current.x + dx / zoom,
        y: panOffsetStartRef.current.y + dy / zoom,
      });
    },
    [isPanning, zoom],
  );

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Native wheel handler.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((currentZoom) =>
        Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom + delta)),
      );
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, []);

  const handleResetView = useCallback(() => {
    setPanOffset({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const handleNodeClick = useCallback(
    (node: UnifiedTreeNode, event: React.MouseEvent) => {
      event.stopPropagation();

      // Drill down into expandable employee nodes.
      if (node.kind === "employee" && node.expandable && node.employee) {
        onDrillDown(node.employee.id);
        onSelectEmployee(node.employee);
        return;
      }

      if (node.kind === "employee" && node.employee) {
        onSelectEmployee(node.employee);
        return;
      }

      if (node.kind === "case" && node.employee && node.customer && node.caseItem) {
        onSelectCase(node.employee, node.customer, node.caseItem);
      }
    },
    [onDrillDown, onSelectCase, onSelectEmployee],
  );

  // Position lookup.
  const positionById = useMemo(
    () => new Map(simPositions.map((p) => [p.id, p])),
    [simPositions],
  );

  const visibleEdges = useMemo(
    () =>
      seedLayout.edges
        .map((edge) => {
          const from = positionById.get(edge.fromId);
          const to = positionById.get(edge.toId);
          if (!from || !to) return null;
          return { ...edge, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y };
        })
        .filter(
          (edge): edge is {
            id: string; fromId: string; toId: string; style: "dashed" | "solid";
            fromX: number; fromY: number; toX: number; toY: number;
          } => Boolean(edge),
        ),
    [positionById, seedLayout.edges],
  );

  const vbWidth = (bounds.maxX - bounds.minX) || 800;
  const vbHeight = (bounds.maxY - bounds.minY) || 600;
  const vbCx = (bounds.minX + bounds.maxX) / 2;
  const vbCy = (bounds.minY + bounds.maxY) / 2;

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
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={1}
        >
          <Box>
            <Typography variant="h6">Tree View</Typography>
            <Typography variant="body2" color="text.secondary">
              Click employee nodes to drill down. Use ← Back to return.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            {canGoBack && (
              <Button size="small" variant="contained" onClick={onGoBack} sx={{ minWidth: 0 }}>
                ← Back
              </Button>
            )}
            <Button size="small" variant="outlined" onClick={() => setShowLegend((current) => !current)}>
              {showLegend ? "Hide Legend" : "Show Legend"}
            </Button>
            <Button size="small" variant="outlined" onClick={handleResetView}>
              Reset View
            </Button>
            <Typography variant="caption" color="text.secondary">
              {Math.round(zoom * 100)}%
            </Typography>
          </Stack>
        </Stack>

        {showLegend && (
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
            {renderLegendSwatch("Customer/Case", {
              border: "2px solid #64748B",
              background: "#F8FAFC",
            })}
            {renderLegendSwatch("Open", {
              border: "1px solid #D1D5DB",
              background: STATUS_FILL_COLORS.Open,
            })}
            {renderLegendSwatch("In Progress", {
              border: "1px solid #D1D5DB",
              background: STATUS_FILL_COLORS["In Progress"],
            })}
            {renderLegendSwatch("Resolved", {
              border: "1px solid #D1D5DB",
              background: STATUS_FILL_COLORS.Resolved,
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
        )}

        <Box
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
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
              {visibleEdges.map((edge) => (
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

              {simPositions.map((pos) => {
                const node = nodeById.get(pos.id);
                if (!node) return null;

                const { x, y, radius } = pos;
                const isSelected = selectedNodeId === node.id;

                return (
                  <g
                    key={node.id}
                    onClick={(event) => handleNodeClick(node, event)}
                    style={{ cursor: "pointer" }}
                  >
                    <title>
                      {node.kind === "case" && node.caseItem
                        ? `${node.label} | ${node.caseItem.title} | ${node.caseItem.status}`
                        : node.label}
                    </title>

                    {node.haloColor && (
                      <circle
                        cx={x} cy={y} r={radius + 8}
                        fill="none" stroke={node.haloColor}
                        strokeWidth={4 / zoom} opacity={0.6}
                      />
                    )}

                    {isSelected && (
                      <circle
                        cx={x} cy={y} r={radius + 11}
                        fill="none" stroke="#0F172A"
                        strokeWidth={2 / zoom} opacity={0.75}
                      />
                    )}

                    <circle
                      cx={x} cy={y} r={radius}
                      fill={node.fillColor}
                      stroke={node.accentColor}
                      strokeWidth={(isSelected ? 4 : 3) / zoom}
                    />

                    {node.expandable && (
                      <>
                        <circle
                          cx={x + radius * 0.7} cy={y + radius * 0.7}
                          r={8 / zoom} fill="#FFFFFF"
                          stroke="#94A3B8" strokeWidth={1.5 / zoom}
                        />
                        <text
                          x={x + radius * 0.7}
                          y={y + radius * 0.7 + 4 / zoom}
                          textAnchor="middle"
                          fontSize={Math.max(12, 12 / zoom)}
                          fontWeight="700" fill="#475569"
                        >
                          {node.expanded ? "−" : "+"}
                        </text>
                      </>
                    )}

                    {node.kind === "employee" && (
                      <>
                        <text
                          x={x} y={y + 4 / zoom}
                          textAnchor="middle"
                          fontSize={Math.max(11, 11 / zoom)}
                          fontWeight="700" fill="#0F172A"
                        >
                          {node.employee?.role === "Executive"
                            ? "Exec"
                            : truncateGraphLabel(node.employee?.role ?? "", 5)}
                        </text>
                        <text
                          x={x} y={y + radius + 16 / zoom}
                          textAnchor="middle"
                          fontSize={Math.max(12, 12 / zoom)}
                          fontWeight="700" fill="#0F172A"
                        >
                          {truncateGraphLabel(node.label, 20)}
                        </text>
                      </>
                    )}

                    {node.kind === "case" && (
                      <>
                        <text
                          x={x} y={y + 3 / zoom}
                          textAnchor="middle"
                          fontSize={Math.max(10, 10 / zoom)}
                          fontWeight="700" fill="#0F172A"
                        >
                          {truncateGraphLabel(node.label, 14)}
                        </text>
                        <text
                          x={x} y={y + radius + 14 / zoom}
                          textAnchor="middle"
                          fontSize={Math.max(9, 9 / zoom)}
                          fill="#475569"
                        >
                          {truncateGraphLabel(node.subtitle, 12)}
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
