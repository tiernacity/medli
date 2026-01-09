/**
 * Double pendulum Frame generator.
 * Outputs Frame JSON to stdout.
 * State derived from wall clock - deterministic, no persistence needed.
 */

import type { Frame, RootMaterial, ChildMaterial, Line, Circle } from "@medli/spec";

// =============================================================================
// Physics constants
// =============================================================================

const G = 9.81;           // Gravity (m/s^2)
const L1 = 30;            // Length of first arm (viewport units)
const L2 = 30;            // Length of second arm (viewport units)
const M1 = 1;             // Mass of first bob
const M2 = 1;             // Mass of second bob

// Initial state (angles in radians, angular velocities)
const INITIAL_THETA1 = Math.PI / 2 + 0.5;  // ~135 degrees
const INITIAL_THETA2 = Math.PI / 2 - 0.3;  // ~80 degrees
const INITIAL_OMEGA1 = 0;
const INITIAL_OMEGA2 = 0;

// Simulation parameters
const DT = 0.002;         // Integration timestep (seconds)
const CYCLE_MS = 120000;  // Cycle length (2 minutes) - simulation restarts

// =============================================================================
// Double pendulum differential equations
// =============================================================================

interface PendulumState {
  theta1: number;  // Angle of first arm (from vertical)
  theta2: number;  // Angle of second arm (from first bob)
  omega1: number;  // Angular velocity of first arm
  omega2: number;  // Angular velocity of second arm
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
  const alpha1 = (
    M2 * L1 * omega1 * omega1 * Math.sin(delta) * Math.cos(delta) +
    M2 * G * Math.sin(theta2) * Math.cos(delta) +
    M2 * L2 * omega2 * omega2 * Math.sin(delta) -
    (M1 + M2) * G * Math.sin(theta1)
  ) / den1;

  // Angular acceleration of second pendulum
  const alpha2 = (
    -M2 * L2 * omega2 * omega2 * Math.sin(delta) * Math.cos(delta) +
    (M1 + M2) * G * Math.sin(theta1) * Math.cos(delta) -
    (M1 + M2) * L1 * omega1 * omega1 * Math.sin(delta) -
    (M1 + M2) * G * Math.sin(theta2)
  ) / den2;

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
    theta1: state.theta1 + k1.theta1 * dt / 2,
    theta2: state.theta2 + k1.theta2 * dt / 2,
    omega1: state.omega1 + k1.omega1 * dt / 2,
    omega2: state.omega2 + k1.omega2 * dt / 2,
  };
  const k2 = derivatives(s2);

  const s3: PendulumState = {
    theta1: state.theta1 + k2.theta1 * dt / 2,
    theta2: state.theta2 + k2.theta2 * dt / 2,
    omega1: state.omega1 + k2.omega1 * dt / 2,
    omega2: state.omega2 + k2.omega2 * dt / 2,
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
    theta1: state.theta1 + (k1.theta1 + 2*k2.theta1 + 2*k3.theta1 + k4.theta1) * dt / 6,
    theta2: state.theta2 + (k1.theta2 + 2*k2.theta2 + 2*k3.theta2 + k4.theta2) * dt / 6,
    omega1: state.omega1 + (k1.omega1 + 2*k2.omega1 + 2*k3.omega1 + k4.omega1) * dt / 6,
    omega2: state.omega2 + (k1.omega2 + 2*k2.omega2 + 2*k3.omega2 + k4.omega2) * dt / 6,
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

  // Build shapes
  const arm1: Line = {
    type: "line",
    start: pos.pivot,
    end: pos.bob1,
  };

  const arm2: Line = {
    type: "line",
    start: pos.bob1,
    end: pos.bob2,
  };

  const pivotCircle: Circle = {
    type: "circle",
    center: pos.pivot,
    radius: 3,
  };

  const bob1Circle: Circle = {
    type: "circle",
    center: pos.bob1,
    radius: 6,
  };

  const bob2Circle: Circle = {
    type: "circle",
    center: pos.bob2,
    radius: 6,
  };

  // Material for arms (stroke only)
  const armMaterial: ChildMaterial = {
    type: "material",
    id: "arms",
    ref: "root",
    fill: "transparent",
    stroke: "#333333",
    strokeWidth: 2,
    children: [arm1, arm2],
  };

  // Material for pivot (small, dark)
  const pivotMaterial: ChildMaterial = {
    type: "material",
    id: "pivot",
    ref: "root",
    fill: "#666666",
    stroke: "transparent",
    children: [pivotCircle],
  };

  // Material for bobs (colored)
  const bobsMaterial: ChildMaterial = {
    type: "material",
    id: "bobs",
    ref: "root",
    fill: "#e74c3c",
    stroke: "#c0392b",
    strokeWidth: 2,
    children: [bob1Circle, bob2Circle],
  };

  // Root material
  const root: RootMaterial = {
    type: "material",
    id: "root",
    fill: "#000000",
    stroke: "#000000",
    strokeWidth: 1,
    children: [armMaterial, pivotMaterial, bobsMaterial],
  };

  return {
    viewport: {
      halfWidth: 80,
      halfHeight: 80,
      scaleMode: "fit",
    },
    background: "#1a1a2e",
    root,
  };
}

// =============================================================================
// Main: generate frame and output to stdout
// =============================================================================

const frame = generateFrame();
console.log(JSON.stringify(frame));
