import type {
  HierarchyGraphModel,
  HierarchyGraphNode,
  SkillTreeGraphModel,
} from "@/lib/employeeGraph";
import type { EmployeeTreeCase, EmployeeTreeCustomer, EmployeeTreeEmployee } from "@/lib/employeeTree";
import { TREE_PHYSICS } from "./treePhysicsManifest";

export type GraphPoint = {
  x: number;
  y: number;
};

export type HierarchyNodeLayout = {
  node: HierarchyGraphNode;
  x: number;
  y: number;
  radius: number;
};

export type HierarchyEdgeLayout = {
  id: string;
  from: GraphPoint;
  to: GraphPoint;
};

export type HierarchyCanvasLayout = {
  width: number;
  height: number;
  nodes: HierarchyNodeLayout[];
  edges: HierarchyEdgeLayout[];
};

export type SkillTreeCaseNodeLayout = {
  caseItem: EmployeeTreeCase;
  x: number;
  y: number;
  radius: number;
};

export type SkillTreeCustomerNodeLayout = {
  customer: EmployeeTreeCustomer;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SkillTreeRingLayout = {
  priority: "High" | "Medium" | "Low";
  radius: number;
  startAngle: number;
  endAngle: number;
};

export type SkillTreeCanvasLayout = {
  width: number;
  height: number;
  root: {
    employee: EmployeeTreeEmployee;
    x: number;
    y: number;
    radius: number;
  };
  customers: SkillTreeCustomerNodeLayout[];
  caseNodes: SkillTreeCaseNodeLayout[];
  rings: SkillTreeRingLayout[];
};

const HIERARCHY_MARGIN_X = 96;
const HIERARCHY_MARGIN_Y = 88;
const HIERARCHY_LEAF_SPACING = 170;
const HIERARCHY_TOP_ROW_Y = 96;
const HIERARCHY_MANAGER_ROW_Y = 242;
const HIERARCHY_CSR_ROW_Y = 392;

const SKILL_TREE_WIDTH = 860;
const SKILL_TREE_HEIGHT = 620;
const SKILL_TREE_CENTER_X = 430;
const SKILL_TREE_CENTER_Y = 500;
const SKILL_TREE_START_ANGLE = -155;
const SKILL_TREE_END_ANGLE = -25;

function polarToCartesian(centerX: number, centerY: number, radius: number, angleDegrees: number): GraphPoint {
  const angleRadians = (angleDegrees * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians),
  };
}

function distributeAngles(count: number, startAngle: number, endAngle: number): number[] {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return [(startAngle + endAngle) / 2];
  }

  const step = (endAngle - startAngle) / (count - 1);
  return Array.from({ length: count }, (_, index) => startAngle + step * index);
}

export function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function getHierarchyY(level: number): number {
  switch (level) {
    case 0:
      return HIERARCHY_TOP_ROW_Y;
    case 1:
      return HIERARCHY_MANAGER_ROW_Y;
    default:
      return HIERARCHY_CSR_ROW_Y;
  }
}

export function layoutHierarchyGraph(model: HierarchyGraphModel): HierarchyCanvasLayout {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const childrenByParentId = new Map<string | null, HierarchyGraphNode[]>();

  for (const node of model.nodes) {
    const parentId = node.parentId && nodeById.has(node.parentId) ? node.parentId : null;
    const children = childrenByParentId.get(parentId) ?? [];
    children.push(node);
    childrenByParentId.set(parentId, children);
  }

  for (const children of childrenByParentId.values()) {
    children.sort((left, right) => left.label.localeCompare(right.label));
  }

  const positions = new Map<string, GraphPoint>();
  let currentLeafX = HIERARCHY_MARGIN_X;

  const placeNode = (node: HierarchyGraphNode): number => {
    const children = childrenByParentId.get(node.id) ?? [];
    if (children.length === 0) {
      const x = currentLeafX;
      currentLeafX += HIERARCHY_LEAF_SPACING;
      positions.set(node.id, { x, y: getHierarchyY(node.level) });
      return x;
    }

    const childXs = children.map((child) => placeNode(child));
    const x = childXs.reduce((total, value) => total + value, 0) / childXs.length;
    positions.set(node.id, { x, y: getHierarchyY(node.level) });
    return x;
  };

  const roots = childrenByParentId.get(null) ?? [];
  roots.forEach((root, index) => {
    placeNode(root);
    if (index < roots.length - 1) {
      currentLeafX += HIERARCHY_LEAF_SPACING * 0.4;
    }
  });

  const nodes = model.nodes
    .map<HierarchyNodeLayout>((node) => {
      const position = positions.get(node.id) ?? {
        x: HIERARCHY_MARGIN_X,
        y: getHierarchyY(node.level),
      };

      return {
        node,
        x: position.x,
        y: position.y,
        radius: 28,
      };
    })
    .sort((left, right) => left.node.level - right.node.level || left.node.label.localeCompare(right.node.label));

  const edges = model.edges
    .map<HierarchyEdgeLayout | null>((edge) => {
      const from = positions.get(edge.fromId);
      const to = positions.get(edge.toId);
      if (!from || !to) {
        return null;
      }

      return {
        id: edge.id,
        from: { x: from.x, y: from.y + 28 },
        to: { x: to.x, y: to.y - 28 },
      };
    })
    .filter((edge): edge is HierarchyEdgeLayout => edge !== null);

  return {
    width: Math.max(860, currentLeafX + HIERARCHY_MARGIN_X),
    height: HIERARCHY_CSR_ROW_Y + HIERARCHY_MARGIN_Y,
    nodes,
    edges,
  };
}

function distributeHorizontalPositions(count: number, minX: number, maxX: number): number[] {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return [(minX + maxX) / 2];
  }

  const step = (maxX - minX) / (count - 1);
  return Array.from({ length: count }, (_, index) => minX + index * step);
}

export function layoutSkillTreeGraph(model: SkillTreeGraphModel): SkillTreeCanvasLayout {
  const customerPositions = distributeHorizontalPositions(model.customers.length, 150, SKILL_TREE_WIDTH - 150);
  const customers = model.customers.map<SkillTreeCustomerNodeLayout>((customer, index) => ({
    customer,
    x: customerPositions[index] ?? SKILL_TREE_CENTER_X,
    y: 322,
    width: 128,
    height: 40,
  }));

  const ringConfigurations: SkillTreeRingLayout[] = [
    { priority: "High", radius: 120, startAngle: SKILL_TREE_START_ANGLE, endAngle: SKILL_TREE_END_ANGLE },
    { priority: "Medium", radius: 180, startAngle: SKILL_TREE_START_ANGLE, endAngle: SKILL_TREE_END_ANGLE },
    { priority: "Low", radius: 240, startAngle: SKILL_TREE_START_ANGLE, endAngle: SKILL_TREE_END_ANGLE },
  ];

  const caseNodes: SkillTreeCaseNodeLayout[] = [];
  for (const ring of ringConfigurations) {
    const caseItems = model.casesByPriority[ring.priority];
    const angles = distributeAngles(caseItems.length, ring.startAngle, ring.endAngle);

    caseItems.forEach((caseItem, index) => {
      const point = polarToCartesian(SKILL_TREE_CENTER_X, SKILL_TREE_CENTER_Y, ring.radius, angles[index] ?? 0);
      caseNodes.push({
        caseItem,
        x: point.x,
        y: point.y,
        radius: 22,
      });
    });
  }

  return {
    width: SKILL_TREE_WIDTH,
    height: SKILL_TREE_HEIGHT,
    root: {
      employee: model.employee,
      x: SKILL_TREE_CENTER_X,
      y: SKILL_TREE_CENTER_Y,
      radius: 28,
    },
    customers,
    caseNodes,
    rings: ringConfigurations,
  };
}

/* ---------- Unified Tree Layout ---------- */

import type { UnifiedTreeModel, UnifiedTreeNode } from "@/lib/employeeGraph";

export type UnifiedNodeLayout = {
  node: UnifiedTreeNode;
  x: number;
  y: number;
  radius: number;
};

export type UnifiedEdgeLayout = {
  id: string;
  fromId: string;
  toId: string;
  style: "dashed" | "solid";
};

export type UnifiedCanvasLayout = {
  nodes: UnifiedNodeLayout[];
  edges: UnifiedEdgeLayout[];
  /** Bounding box for zoom-to-fit. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const MIN_NODE_GAP = TREE_PHYSICS.minNodeGap;
const RELAXATION_ITERATIONS = 90;
const SPRING_STRENGTH = 0.12;
const UNIFIED_FAN_RADIUS_BASE = TREE_PHYSICS.fanRadiusBase;
const UNIFIED_FAN_RADIUS_STEP = TREE_PHYSICS.fanRadiusStep;
const UNIFIED_FAN_START = TREE_PHYSICS.fanStartAngle;
const UNIFIED_FAN_END = TREE_PHYSICS.fanEndAngle;
const UNIFIED_NODE_RADIUS_EMPLOYEE = TREE_PHYSICS.employeeRadius;
const UNIFIED_NODE_RADIUS_CASE = TREE_PHYSICS.caseRadius;

function getNodeRadius(kind: UnifiedTreeNode["kind"]): number {
  switch (kind) {
    case "employee":
      return UNIFIED_NODE_RADIUS_EMPLOYEE;
    case "case":
      return UNIFIED_NODE_RADIUS_CASE;
  }
}

function getCollisionRadius(node: UnifiedTreeNode): number {
  const base = getNodeRadius(node.kind);
  const labelPadding = node.kind === "employee" ? 38 : 30;
  const labelDensity = Math.min(18, Math.max(0, node.label.length - 8) * 0.85);
  return base + labelPadding + labelDensity;
}

function getFanRadius(childCount: number): number {
  if (childCount <= 1) {
    return UNIFIED_FAN_RADIUS_BASE;
  }

  return UNIFIED_FAN_RADIUS_BASE + (childCount - 1) * UNIFIED_FAN_RADIUS_STEP;
}

export function layoutUnifiedTree(model: UnifiedTreeModel): UnifiedCanvasLayout {
  const positions = new Map<string, GraphPoint>();
  const basePositions = new Map<string, GraphPoint>();
  const nodeLayouts: UnifiedNodeLayout[] = [];
  const edgeLayouts: UnifiedEdgeLayout[] = [];
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));

  if (model.nodes.length === 0) {
    return { nodes: [], edges: [], minX: -400, minY: -400, maxX: 400, maxY: 400 };
  }

  const childrenByParent = new Map<string | null, UnifiedTreeNode[]>();
  for (const node of model.nodes) {
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort((left, right) => left.label.localeCompare(right.label));
  }

  const root = model.nodes.find((node) => node.id === model.rootId);
  if (!root) {
    return { nodes: [], edges: [], minX: -400, minY: -400, maxX: 400, maxY: 400 };
  }

  positions.set(root.id, { x: 0, y: 0 });
  basePositions.set(root.id, { x: 0, y: 0 });

  function placeChildren(parentId: string, parentX: number, parentY: number): void {
    const children = childrenByParent.get(parentId) ?? [];
    if (children.length === 0) {
      return;
    }

    const fanRadius = getFanRadius(children.length);
    const angles = distributeAngles(children.length, UNIFIED_FAN_START, UNIFIED_FAN_END);

    children.forEach((child, index) => {
      const angle = angles[index] ?? ((UNIFIED_FAN_START + UNIFIED_FAN_END) / 2);
      const position = polarToCartesian(parentX, parentY, fanRadius, angle);
      positions.set(child.id, position);
      basePositions.set(child.id, position);
      placeChildren(child.id, position.x, position.y);
    });
  }

  placeChildren(root.id, 0, 0);

  // Collision relaxation around base layout.
  const nodeIds = model.nodes.map((node) => node.id);
  for (let iteration = 0; iteration < RELAXATION_ITERATIONS; iteration += 1) {
    for (const nodeId of nodeIds) {
      if (nodeId === root.id) {
        continue;
      }

      const current = positions.get(nodeId);
      const anchor = basePositions.get(nodeId);
      if (!current || !anchor) {
        continue;
      }

      current.x += (anchor.x - current.x) * SPRING_STRENGTH;
      current.y += (anchor.y - current.y) * SPRING_STRENGTH;
    }

    for (let i = 0; i < nodeIds.length; i += 1) {
      const leftId = nodeIds[i];
      const leftNode = nodeById.get(leftId);
      const leftPosition = positions.get(leftId);
      if (!leftNode || !leftPosition) {
        continue;
      }

      for (let j = i + 1; j < nodeIds.length; j += 1) {
        const rightId = nodeIds[j];
        const rightNode = nodeById.get(rightId);
        const rightPosition = positions.get(rightId);
        if (!rightNode || !rightPosition) {
          continue;
        }

        const dx = rightPosition.x - leftPosition.x;
        const dy = rightPosition.y - leftPosition.y;
        const distance = Math.hypot(dx, dy) || 0.0001;
        const requiredDistance = Math.max(
          MIN_NODE_GAP,
          getCollisionRadius(leftNode) + getCollisionRadius(rightNode),
        );

        if (distance >= requiredDistance) {
          continue;
        }

        const overlap = requiredDistance - distance;
        const ux = dx / distance;
        const uy = dy / distance;

        if (leftId === root.id) {
          rightPosition.x += ux * overlap;
          rightPosition.y += uy * overlap;
          continue;
        }

        if (rightId === root.id) {
          leftPosition.x -= ux * overlap;
          leftPosition.y -= uy * overlap;
          continue;
        }

        const halfShift = overlap / 2;
        leftPosition.x -= ux * halfShift;
        leftPosition.y -= uy * halfShift;
        rightPosition.x += ux * halfShift;
        rightPosition.y += uy * halfShift;
      }
    }

    const rootPosition = positions.get(root.id);
    if (rootPosition) {
      rootPosition.x = 0;
      rootPosition.y = 0;
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of model.nodes) {
    const position = positions.get(node.id);
    if (!position) {
      continue;
    }

    const radius = getNodeRadius(node.kind);
    nodeLayouts.push({ node, x: position.x, y: position.y, radius });

    const collisionRadius = getCollisionRadius(node);
    minX = Math.min(minX, position.x - collisionRadius - 30);
    minY = Math.min(minY, position.y - collisionRadius - 30);
    maxX = Math.max(maxX, position.x + collisionRadius + 30);
    maxY = Math.max(maxY, position.y + collisionRadius + 30);
  }

  for (const edge of model.edges) {
    if (!positions.has(edge.fromId) || !positions.has(edge.toId)) {
      continue;
    }

    edgeLayouts.push({
      id: edge.id,
      fromId: edge.fromId,
      toId: edge.toId,
      style: edge.style,
    });
  }

  if (minX === Infinity) {
    minX = -400;
    minY = -400;
    maxX = 400;
    maxY = 400;
  }

  // Add padding
  minX -= 120;
  minY -= 120;
  maxX += 120;
  maxY += 120;

  return { nodes: nodeLayouts, edges: edgeLayouts, minX, minY, maxX, maxY };
}
