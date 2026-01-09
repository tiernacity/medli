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

/**
 * Convert pendulum state to Cartesian coordinates.
 * Origin at pivot point, Y-up coordinate system.
 */
function stateToPositions(state: PendulumState) {
  // First bob position (from pivot)
  // Note: theta is measured from vertical (down), so we use -cos for y and sin for x
  const x1 = L1 * Math.sin(state.theta1);
  const y1 = -L1 * Math.cos(state.theta1);

  // Second bob position (from first bob)
  const x2 = x1 + L2 * Math.sin(state.theta2);
  const y2 = y1 - L2 * Math.cos(state.theta2);

  return {
    pivot: { x: 0, y: 0 },
    bob1: { x: x1, y: y1 },
    bob2: { x: x2, y: y2 },
  };
}

// Shapes are stored here so generateFrame can update their positions
let arm1: Line;
let arm2: Line;
let pivotCircle: Circle;
let bob1Circle: Circle;
let bob2Circle: Circle;

/**
 * Initialize scene with materials and shapes.
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

  // Create shapes at initial positions
  arm1 = new Line(0, 0, 0, 0);
  arm1.material = armMaterial;

  arm2 = new Line(0, 0, 0, 0);
  arm2.material = armMaterial;

  pivotCircle = new Circle(0, 0, 3);
  pivotCircle.material = pivotMaterial;

  bob1Circle = new Circle(0, 0, 6);
  bob1Circle.material = bobsMaterial;

  bob2Circle = new Circle(0, 0, 6);
  bob2Circle.material = bobsMaterial;

  scene.add(arm1);
  scene.add(arm2);
  scene.add(pivotCircle);
  scene.add(bob1Circle);
  scene.add(bob2Circle);

  return scene;
}

// Create scene once at startup
const scene = initializeScene();

/**
 * Generate Frame for the current pendulum state.
 */
function generateFrame(): Frame {
  // Derive elapsed time from wall clock (cyclic)
  const now = Date.now();
  const elapsedMs = now % CYCLE_MS;
  const elapsedSeconds = elapsedMs / 1000;

  // Simulate to current state
  const state = simulate(elapsedSeconds);
  const pos = stateToPositions(state);

  // Update shape positions
  arm1.x1 = pos.pivot.x;
  arm1.y1 = pos.pivot.y;
  arm1.x2 = pos.bob1.x;
  arm1.y2 = pos.bob1.y;

  arm2.x1 = pos.bob1.x;
  arm2.y1 = pos.bob1.y;
  arm2.x2 = pos.bob2.x;
  arm2.y2 = pos.bob2.y;

  pivotCircle.x = pos.pivot.x;
  pivotCircle.y = pos.pivot.y;

  bob1Circle.x = pos.bob1.x;
  bob1Circle.y = pos.bob1.y;

  bob2Circle.x = pos.bob2.x;
  bob2Circle.y = pos.bob2.y;

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
  res.end(JSON.stringify(generateFrame()));
});

server.listen(port, () => {
  console.log(`Serving frames at http://localhost:${port}`);
});
