/**
 * Force-directed graph simulation engine.
 *
 * Runs a continuous physics loop where nodes repel each other (Coulomb),
 * edges act as springs (Hooke), collisions are enforced, and a gentle
 * center-gravity prevents drift. The simulation cools via an alpha
 * parameter and sleeps when settled.
 *
 * All tunable constants come from treePhysicsManifest.ts.
 */

import { TREE_PHYSICS } from "./treePhysicsManifest";

/* ---------- Types ---------- */

export type SimNode = {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    pinned: boolean;
    parentId: string | null;
};

export type SimEdge = {
    source: string;
    target: string;
};

export type TickCallback = (nodes: ReadonlyArray<Readonly<SimNode>>) => void;

/* ---------- Simulation ---------- */

export type ForceSimulation = {
    /** Replace the full node/edge set. New nodes enter at their parent's position. */
    updateGraph: (
        nodes: Array<{ id: string; x: number; y: number; radius: number; pinned: boolean; parentId: string | null }>,
        edges: SimEdge[],
    ) => void;
    /** Reheat the simulation so it runs again. */
    reheat: () => void;
    /** Register a tick callback (called each animation frame while active). */
    onTick: (callback: TickCallback) => void;
    /** Stop the simulation and cancel the animation frame. */
    stop: () => void;
};

export function createSimulation(
    initialNodes: Array<{ id: string; x: number; y: number; radius: number; pinned: boolean; parentId: string | null }>,
    initialEdges: SimEdge[],
): ForceSimulation {
    let nodes: SimNode[] = initialNodes.map((n) => ({
        ...n,
        vx: 0,
        vy: 0,
    }));
    let edges: SimEdge[] = [...initialEdges];

    let alpha = 1.0;
    let rafId: number | null = null;
    let tickCallback: TickCallback | null = null;

    /* ---- Force: Repulsion (Coulomb) ---- */

    function applyRepulsion(): void {
        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j];
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 1) {
                    dx = (Math.random() - 0.5) * 4;
                    dy = (Math.random() - 0.5) * 4;
                    dist = Math.sqrt(dx * dx + dy * dy);
                }
                if (dist > TREE_PHYSICS.repulsionMaxDistance) {
                    continue;
                }

                const force = (TREE_PHYSICS.repulsionStrength * alpha) / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                if (!a.pinned) {
                    a.vx -= fx;
                    a.vy -= fy;
                }
                if (!b.pinned) {
                    b.vx += fx;
                    b.vy += fy;
                }
            }
        }
    }

    /* ---- Force: Springs (Hooke) ---- */

    function applySpringForces(): void {
        const nodeById = new Map(nodes.map((n) => [n.id, n]));

        for (const edge of edges) {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            if (!source || !target) {
                continue;
            }

            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
            const displacement = dist - TREE_PHYSICS.springRestLength;
            const force = TREE_PHYSICS.springStrength * displacement * alpha;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!source.pinned) {
                source.vx += fx;
                source.vy += fy;
            }
            if (!target.pinned) {
                target.vx -= fx;
                target.vy -= fy;
            }
        }
    }

    /* ---- Force: Center gravity ---- */

    function applyCenterGravity(): void {
        for (const node of nodes) {
            if (node.pinned) {
                continue;
            }

            node.vx -= node.x * TREE_PHYSICS.centerGravity * alpha;
            node.vy -= node.y * TREE_PHYSICS.centerGravity * alpha;
        }
    }

    /* ---- Collision enforcement ---- */

    function enforceCollisions(): void {
        for (let iter = 0; iter < TREE_PHYSICS.collisionIterations; iter++) {
            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
                    const minDist = a.radius + b.radius + TREE_PHYSICS.collisionPadding;

                    if (dist >= minDist) {
                        continue;
                    }

                    // Push apart to exactly minDist.
                    const overlap = minDist - dist;
                    const ux = dx / dist;
                    const uy = dy / dist;

                    if (a.pinned && !b.pinned) {
                        b.x += ux * overlap;
                        b.y += uy * overlap;
                    } else if (b.pinned && !a.pinned) {
                        a.x -= ux * overlap;
                        a.y -= uy * overlap;
                    } else if (!a.pinned && !b.pinned) {
                        const half = overlap / 2;
                        a.x -= ux * half;
                        a.y -= uy * half;
                        b.x += ux * half;
                        b.y += uy * half;
                    }
                }
            }
        }
    }

    /* ---- Velocity integration ---- */

    function integrateVelocities(): void {
        for (const node of nodes) {
            if (node.pinned) {
                node.vx = 0;
                node.vy = 0;
                continue;
            }

            node.vx *= TREE_PHYSICS.velocityDamping;
            node.vy *= TREE_PHYSICS.velocityDamping;

            const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
            if (speed > TREE_PHYSICS.maxSpeed) {
                const scale = TREE_PHYSICS.maxSpeed / speed;
                node.vx *= scale;
                node.vy *= scale;
            }

            node.x += node.vx;
            node.y += node.vy;
        }
    }

    /* ---- Main loop ---- */

    function tick(): void {
        if (alpha < TREE_PHYSICS.alphaMin) {
            rafId = null;
            return;
        }

        applyRepulsion();
        applySpringForces();
        applyCenterGravity();
        integrateVelocities();
        enforceCollisions();

        alpha *= TREE_PHYSICS.alphaDecay;

        if (tickCallback) {
            tickCallback(nodes);
        }

        rafId = requestAnimationFrame(tick);
    }

    function ensureRunning(): void {
        if (rafId === null) {
            rafId = requestAnimationFrame(tick);
        }
    }

    /* ---- Public API ---- */

    function updateGraph(
        nextNodes: Array<{ id: string; x: number; y: number; radius: number; pinned: boolean; parentId: string | null }>,
        nextEdges: SimEdge[],
    ): void {
        const existingById = new Map(nodes.map((n) => [n.id, n]));

        nodes = nextNodes.map((incoming) => {
            const existing = existingById.get(incoming.id);
            if (existing) {
                const shouldReseedPosition = incoming.pinned || existing.parentId !== incoming.parentId;
                return {
                    ...existing,
                    x: shouldReseedPosition ? incoming.x : existing.x,
                    y: shouldReseedPosition ? incoming.y : existing.y,
                    vx: shouldReseedPosition ? 0 : existing.vx,
                    vy: shouldReseedPosition ? 0 : existing.vy,
                    radius: incoming.radius,
                    pinned: incoming.pinned,
                    parentId: incoming.parentId,
                };
            }

            const parent = incoming.parentId ? existingById.get(incoming.parentId) : null;
            return {
                id: incoming.id,
                x: parent ? parent.x + (Math.random() - 0.5) * 10 : incoming.x,
                y: parent ? parent.y + (Math.random() - 0.5) * 10 : incoming.y,
                vx: 0,
                vy: 0,
                radius: incoming.radius,
                pinned: incoming.pinned,
                parentId: incoming.parentId,
            };
        });

        edges = [...nextEdges];
        alpha = TREE_PHYSICS.alphaReheat;
        ensureRunning();
    }

    function reheat(): void {
        alpha = TREE_PHYSICS.alphaReheat;
        ensureRunning();
    }

    function onTick(callback: TickCallback): void {
        tickCallback = callback;
    }

    function stop(): void {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        tickCallback = null;
    }

    ensureRunning();

    return { updateGraph, reheat, onTick, stop };
}
