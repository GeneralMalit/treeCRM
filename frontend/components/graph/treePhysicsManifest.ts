/**
 * Tree View Physics Manifest
 *
 * All tunable constants for the force-directed tree simulation.
 * Edit these values to change how the tree behaves.
 *
 * After changing values, save the file and the dev server will hot-reload.
 */

export const TREE_PHYSICS = {
    /* ---- Repulsion (Coulomb) ----
     * Every node pushes every other node away.
     * Higher strength = nodes flee harder.
     * maxDistance = beyond this range, repulsion is ignored (performance). */
    repulsionStrength: 200,
    repulsionMaxDistance: 1000,

    /* ---- Springs (Hooke) ----
     * Each edge acts as a spring pulling its two endpoints together.
     * restLength = the "natural" length the spring wants to be.
     * strength = how aggressively it pulls. */
    springStrength: 0.16,
    springRestLength: 280,

    /* ---- Collision ----
     * Hard overlap prevention. After all forces are applied, any pair
     * of nodes closer than (radiusA + radiusB + collisionPadding) gets
     * pushed apart instantly.
     * collisionPadding = extra gap beyond the node circles (accounts for labels). */
    collisionPadding: 40,
    collisionIterations: 3,

    /* ---- Center Gravity ----
     * Gentle pull toward (0,0) to prevent the whole graph from drifting.
     * Higher = snappier centering, but fights the layout more. */
    centerGravity: 0.006,

    /* ---- Velocity ----
     * damping = velocity multiplier each tick. <1 means friction. 0.80 = heavy damping.
     * maxSpeed = hard cap on per-tick movement (prevents explosions). */
    velocityDamping: 0.78,
    maxSpeed: 10,

    /* ---- Alpha (cooling) ----
     * The simulation starts "hot" (alpha=1) and cools down.
     * decay = multiplied each tick. Lower = cools faster.
     * min = simulation sleeps below this. Set to 0 to never sleep.
     * reheat = alpha set to this value when nodes change (expand/collapse). */
    alphaDecay: 0.993,
    alphaMin: 0,
    alphaReheat: 0.8,

    /* ---- Layout seed ----
     * These control the INITIAL positions before the simulation takes over.
     * fanRadiusBase = distance from parent to first child ring.
     * fanRadiusStep = added per extra child.
     * fanStartAngle / fanEndAngle = arc range in degrees (negative = above parent).
     * minNodeGap = relaxation minimum distance in seed layout. */
    fanRadiusBase: 240,
    fanRadiusStep: 24,
    fanStartAngle: -170,
    fanEndAngle: -10,
    minNodeGap: 212,

    /* ---- Node sizing ----
     * employeeRadius = radius of employee circles.
     * caseRadius = radius of case circles. */
    employeeRadius: 35,
    caseRadius: 30,
} as const;

export type TreePhysicsConfig = typeof TREE_PHYSICS;
