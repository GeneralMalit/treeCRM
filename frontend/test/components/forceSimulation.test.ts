import { describe, expect, it, vi, afterEach } from "vitest";
import { createSimulation } from "@/components/graph/forceSimulation";
import { TREE_PHYSICS } from "@/components/graph/treePhysicsManifest";

const rafCallbacks: FrameRequestCallback[] = [];

afterEach(() => {
  rafCallbacks.length = 0;
  vi.restoreAllMocks();
});

describe("forceSimulation", () => {
  it("ticks, reheats, updates, and stops cleanly", () => {
    const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    const cancelAnimationFrameMock = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameMock);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const simulation = createSimulation(
      [
        { id: "root", x: 0, y: 0, radius: 28, pinned: true, parentId: null },
        { id: "child", x: 100, y: 0, radius: 22, pinned: false, parentId: "root" },
      ],
      [{ source: "root", target: "child" }],
    );

    const tickCallback = vi.fn();
    simulation.onTick(tickCallback);

    expect(requestAnimationFrameMock).toHaveBeenCalled();
    expect(rafCallbacks).toHaveLength(1);

    rafCallbacks.shift()?.(0);

    expect(tickCallback).toHaveBeenCalled();
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(1);

    simulation.updateGraph(
      [
        { id: "root", x: 0, y: 0, radius: 28, pinned: true, parentId: null },
        { id: "child", x: 120, y: 15, radius: 22, pinned: false, parentId: "root-2" },
        { id: "leaf", x: 140, y: 20, radius: 20, pinned: false, parentId: "child" },
      ],
      [{ source: "root", target: "child" }],
    );

    simulation.updateGraph(
      [
        { id: "root", x: 0, y: 0, radius: 28, pinned: true, parentId: null },
        { id: "child", x: 120, y: 15, radius: 22, pinned: false, parentId: "root-2" },
      ],
      [{ source: "root", target: "missing" }],
    );

    simulation.reheat();
    simulation.stop();

    expect(cancelAnimationFrameMock).toHaveBeenCalled();
  });

  it("applies the physics branches during a tick", () => {
    const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(Math, "random").mockReturnValue(0.6);

    const simulation = createSimulation(
      [
        { id: "root", x: 0, y: 0, radius: 28, pinned: true, parentId: null },
        { id: "child-a", x: 0, y: 0, radius: 22, pinned: false, parentId: "root" },
        { id: "child-b", x: 0, y: 0, radius: 22, pinned: false, parentId: "root" },
        { id: "sibling", x: 1, y: 0, radius: 22, pinned: true, parentId: "root" },
      ],
      [
        { source: "root", target: "child-a" },
        { source: "root", target: "missing" },
      ],
    );

    const tickCallback = vi.fn();
    simulation.onTick(tickCallback);

    rafCallbacks.shift()?.(0);

    const [root, childA, childB, sibling] = tickCallback.mock.calls.at(-1)?.[0] ?? [];

    expect(tickCallback).toHaveBeenCalled();
    expect(root.vx).toBe(0);
    expect(root.vy).toBe(0);
    expect(sibling.vx).toBe(0);
    expect(sibling.vy).toBe(0);
    expect(childA.x).not.toBe(0);
    expect(childB.x).not.toBe(0);
    expect(Math.hypot(childA.vx, childA.vy)).toBeLessThanOrEqual(TREE_PHYSICS.maxSpeed);

    simulation.stop();
  });

  it("reuses existing nodes and reseeds moved children on graph updates", () => {
    const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    const cancelAnimationFrameMock = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameMock);
    vi.spyOn(Math, "random").mockReturnValue(0.6);

    const simulation = createSimulation(
      [
        { id: "root", x: 0, y: 0, radius: 28, pinned: true, parentId: null },
        { id: "child", x: 40, y: 40, radius: 22, pinned: false, parentId: "root" },
      ],
      [{ source: "root", target: "child" }],
    );

    const tickCallback = vi.fn();
    simulation.onTick(tickCallback);

    simulation.updateGraph(
      [
        { id: "root", x: 0, y: 0, radius: 28, pinned: true, parentId: null },
        { id: "child", x: 120, y: 15, radius: 22, pinned: false, parentId: "root" },
        { id: "leaf", x: 180, y: 20, radius: 20, pinned: false, parentId: "child" },
      ],
      [{ source: "root", target: "child" }],
    );

    simulation.updateGraph(
      [
        { id: "root", x: 0, y: 0, radius: 28, pinned: true, parentId: null },
        { id: "child", x: 120, y: 15, radius: 22, pinned: false, parentId: "new-parent" },
        { id: "leaf", x: 180, y: 20, radius: 20, pinned: false, parentId: "child" },
      ],
      [{ source: "root", target: "child" }],
    );

    rafCallbacks.shift()?.(0);

    expect(tickCallback).toHaveBeenCalled();
    expect(cancelAnimationFrameMock).not.toHaveBeenCalled();

    simulation.stop();
  });
});
