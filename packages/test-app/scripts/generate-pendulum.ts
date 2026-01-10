/**
 * Double pendulum Frame generator.
 * HTTP server that generates Frame JSON on-demand.
 * State derived from wall clock - deterministic, no persistence needed.
 *
 * Usage: generate-pendulum.ts [port]
 */

import type { Frame } from "@medli/spec";
import {
  Scene,
  Background,
  Material,
  Circle,
  Line,
  Group,
} from "@medli/generator-object";
import { createServer } from "http";

// =============================================================================
// Physics constants
// =============================================================================

const G = 9.81; // Gravity (m/s^2)
const L1 = 30; // Length of first arm (viewport units)
const L2 = 30; // Length of second arm (viewport units)
const M1 = 1; // Mass of first bob
const M2 = 1; // Mass of second bob

// Initial state (angles in radians, angular velocities)
const INITIAL_THETA1 = Math.PI / 2 + 0.5; // ~135 degrees
const INITIAL_THETA2 = Math.PI / 2 - 0.3; // ~80 degrees
const INITIAL_OMEGA1 = 0;
const INITIAL_OMEGA2 = 0;

// Simulation parameters
const DT = 0.002; // Integration timestep (seconds)
const CYCLE_MS = 120000; // Cycle length (2 minutes) - simulation restarts

// =============================================================================
// Double pendulum differential equations
// =============================================================================

interface PendulumState {
  theta1: number; // Angle of first arm (from vertical)
  theta2: number; // Angle of second arm (from first bob)
  omega1: number; // Angular velocity of first arm
  omega2: number; // Angular velocity of second arm
}

/**
 * Compute derivatives for double pendulum equations of motion.
 * Uses Lagrangian mechanics formulation.
 */
function derivatives(state: PendulumState): PendulumState {
  const { theta1, theta2, omega1, omega2 } = state;

  const delta = theta2 - theta1;
  const den1 = (M1 + M2) * L1 - M2 * L1 * Math.cos(delta) * Math.cos(delta);
  const den2 = (L2 / L1) * den1;

  // Angular acceleration of first pendulum
  const alpha1 =
    (M2 * L1 * omega1 * omega1 * Math.sin(delta) * Math.cos(delta) +
      M2 * G * Math.sin(theta2) * Math.cos(delta) +
      M2 * L2 * omega2 * omega2 * Math.sin(delta) -
      (M1 + M2) * G * Math.sin(theta1)) /
    den1;

  // Angular acceleration of second pendulum
  const alpha2 =
    (-M2 * L2 * omega2 * omega2 * Math.sin(delta) * Math.cos(delta) +
      (M1 + M2) * G * Math.sin(theta1) * Math.cos(delta) -
      (M1 + M2) * L1 * omega1 * omega1 * Math.sin(delta) -
      (M1 + M2) * G * Math.sin(theta2)) /
    den2;

  return {
    theta1: omega1,
    theta2: omega2,
    omega1: alpha1,
    omega2: alpha2,
  };
}

/**
 * Runge-Kutta 4th order integration step.
 */
function rk4Step(state: PendulumState, dt: number): PendulumState {
  const k1 = derivatives(state);

  const s2: PendulumState = {
    theta1: state.theta1 + (k1.theta1 * dt) / 2,
    theta2: state.theta2 + (k1.theta2 * dt) / 2,
    omega1: state.omega1 + (k1.omega1 * dt) / 2,
    omega2: state.omega2 + (k1.omega2 * dt) / 2,
  };
  const k2 = derivatives(s2);

  const s3: PendulumState = {
    theta1: state.theta1 + (k2.theta1 * dt) / 2,
    theta2: state.theta2 + (k2.theta2 * dt) / 2,
    omega1: state.omega1 + (k2.omega1 * dt) / 2,
    omega2: state.omega2 + (k2.omega2 * dt) / 2,
  };
  const k3 = derivatives(s3);

  const s4: PendulumState = {
    theta1: state.theta1 + k3.theta1 * dt,
    theta2: state.theta2 + k3.theta2 * dt,
    omega1: state.omega1 + k3.omega1 * dt,
    omega2: state.omega2 + k3.omega2 * dt,
  };
  const k4 = derivatives(s4);

  return {
    theta1:
      state.theta1 +
      ((k1.theta1 + 2 * k2.theta1 + 2 * k3.theta1 + k4.theta1) * dt) / 6,
    theta2:
      state.theta2 +
      ((k1.theta2 + 2 * k2.theta2 + 2 * k3.theta2 + k4.theta2) * dt) / 6,
    omega1:
      state.omega1 +
      ((k1.omega1 + 2 * k2.omega1 + 2 * k3.omega1 + k4.omega1) * dt) / 6,
    omega2:
      state.omega2 +
      ((k1.omega2 + 2 * k2.omega2 + 2 * k3.omega2 + k4.omega2) * dt) / 6,
  };
}

/**
 * Simulate pendulum forward from initial state for given duration.
 */
function simulate(durationSeconds: number): PendulumState {
  let state: PendulumState = {
    theta1: INITIAL_THETA1,
    theta2: INITIAL_THETA2,
    omega1: INITIAL_OMEGA1,
    omega2: INITIAL_OMEGA2,
  };

  const steps = Math.floor(durationSeconds / DT);
  for (let i = 0; i < steps; i++) {
    state = rk4Step(state, DT);
  }

  return state;
}

// Groups that control rotation - stored for animation updates
let pendulum1Group: Group; // Rotates by theta1
let pendulum2Group: Group; // Rotates by (theta2 - theta1) relative to parent

/**
 * Initialize scene with materials and shapes using hierarchical transforms.
 *
 * The pendulum uses a nested Group hierarchy where rotations and translations
 * position the shapes automatically:
 *
 * pendulum1Group (rotation = theta1 - PI/2, at pivot origin)
 *   ├─ Circle (pivot point at 0,0)
 *   ├─ Line (arm1 from [0,0] to [L1,0] in local coords)
 *   └─ translateToEndGroup (position = {x: L1, y: 0})
 *        └─ pendulum2Group (rotation = theta2 - theta1, relative angle)
 *             ├─ Circle (bob1 at 0,0)
 *             ├─ Line (arm2 from [0,0] to [L2,0])
 *             └─ translateToBob2Group (position = {x: L2, y: 0})
 *                  └─ Circle (bob2 at 0,0)
 *
 * Physics angles (theta1, theta2) are measured from vertical (down).
 * To convert to Group rotation (where 0 = right, PI/2 = up):
 * - A pendulum hanging straight down (theta=0) should point in -Y direction
 * - rotation = theta - PI/2 converts from "angle from down" to standard rotation
 */
function initializeScene(): Scene {
  const scene = new Scene({
    halfWidth: 80,
    halfHeight: 80,
    scaleMode: "fit",
  });

  // Background
  scene.add(new Background("#1a1a2e"));

  // Materials
  const armMaterial = new Material({
    fill: "transparent",
    stroke: "#333333",
    strokeWidth: 2,
  });

  const pivotMaterial = new Material({
    fill: "#666666",
    stroke: "transparent",
  });

  const bobsMaterial = new Material({
    fill: "#e74c3c",
    stroke: "#c0392b",
    strokeWidth: 2,
  });

  // Build hierarchy from inside out

  // Bob2 at the end of arm2 (at local origin of its group)
  const bob2 = new Circle(0, 0, 6);
  bob2.material = bobsMaterial;

  // Group that translates to bob2 position (end of arm2)
  const translateToBob2 = new Group();
  translateToBob2.position = { x: L2, y: 0 };
  translateToBob2.add(bob2);

  // Arm2 extends from origin to L2 in local X direction
  const arm2 = new Line(0, 0, L2, 0);
  arm2.material = armMaterial;

  // Bob1 at the joint (at local origin of pendulum2Group)
  const bob1 = new Circle(0, 0, 6);
  bob1.material = bobsMaterial;

  // Pendulum2 rotation group (rotates by relative angle theta2 - theta1)
  pendulum2Group = new Group();
  pendulum2Group.add(bob1);
  pendulum2Group.add(arm2);
  pendulum2Group.add(translateToBob2);

  // Group that translates to end of arm1 (where pendulum2 attaches)
  const translateToEnd = new Group();
  translateToEnd.position = { x: L1, y: 0 };
  translateToEnd.add(pendulum2Group);

  // Arm1 extends from origin to L1 in local X direction
  const arm1 = new Line(0, 0, L1, 0);
  arm1.material = armMaterial;

  // Pivot circle at origin
  const pivot = new Circle(0, 0, 3);
  pivot.material = pivotMaterial;

  // Pendulum1 rotation group (rotates by theta1 from vertical)
  pendulum1Group = new Group();
  pendulum1Group.add(pivot);
  pendulum1Group.add(arm1);
  pendulum1Group.add(translateToEnd);

  scene.add(pendulum1Group);

  return scene;
}

// Create scene once at startup
const scene = initializeScene();

// Base viewport configuration
const BASE_HALF_HEIGHT = 80;
const BASE_HALF_WIDTH = 80;

/**
 * Generate Frame for the current pendulum state.
 * Optionally adapts viewport to match target aspect ratio.
 *
 * Uses hierarchical transforms: only the Group rotations need updating.
 * The nested structure handles all positioning automatically.
 */
function generateFrame(targetWidth?: number, targetHeight?: number): Frame {
  // Derive elapsed time from wall clock (cyclic)
  const now = Date.now();
  const elapsedMs = now % CYCLE_MS;
  const elapsedSeconds = elapsedMs / 1000;

  // Simulate to current state
  const state = simulate(elapsedSeconds);

  // Update Group rotations only - transforms handle positioning
  // theta is measured from vertical (down), rotation 0 = right in standard coords
  // So theta=0 (hanging down) needs rotation = -PI/2 to point downward (-Y)
  pendulum1Group.rotation = state.theta1 - Math.PI / 2;

  // pendulum2Group uses relative angle since it's nested inside pendulum1
  pendulum2Group.rotation = state.theta2 - state.theta1;

  // Adapt viewport if both target dimensions are provided
  if (targetWidth !== undefined && targetHeight !== undefined) {
    const aspectRatio = targetWidth / targetHeight;
    const adaptedHalfWidth = BASE_HALF_HEIGHT * aspectRatio;
    scene.setViewport({
      halfWidth: adaptedHalfWidth,
      halfHeight: BASE_HALF_HEIGHT,
      scaleMode: "fit",
    });
  } else {
    // Use default viewport
    scene.setViewport({
      halfWidth: BASE_HALF_WIDTH,
      halfHeight: BASE_HALF_HEIGHT,
      scaleMode: "fit",
    });
  }

  return scene.frame({ time: now, targetDimensions: [100, 100] });
}

// =============================================================================
// Main: HTTP server that serves current frame on-demand
// =============================================================================

const port = parseInt(process.argv[2] ?? "3001", 10);

const server = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  // Parse query params for target dimensions
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const targetWidthStr = url.searchParams.get("targetWidth");
  const targetHeightStr = url.searchParams.get("targetHeight");

  // Only use dimensions if BOTH are present and valid
  let targetWidth: number | undefined;
  let targetHeight: number | undefined;
  if (targetWidthStr && targetHeightStr) {
    const w = parseFloat(targetWidthStr);
    const h = parseFloat(targetHeightStr);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      targetWidth = w;
      targetHeight = h;
    }
  }

  res.end(JSON.stringify(generateFrame(targetWidth, targetHeight)));
});

server.listen(port, () => {
  console.log(`Serving frames at http://localhost:${port}`);
});
