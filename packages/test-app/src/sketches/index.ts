/**
 * Sketch Registry
 *
 * Central registry for all sketch ports.
 * Each sketch exports a factory function and optional interaction handler.
 */
import type { Generator } from "@medli/spec";
import { RemoteFetchGenerator } from "@medli/generator-remote";
import { createParticlePlotter } from "./particle-plotter";
import { createTrees } from "./trees";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of creating a sketch instance.
 * All sketches return a generator, plus optional control methods.
 */
export interface SketchInstance {
  generator: Generator;
  /** ParticlePlotter: control mouse state */
  setMouseState?: (pressed: boolean, x: number, y: number) => void;
  /** Trees: reset/restart the sketch */
  reset?: () => void;
  /** Cleanup function for generators that need it (e.g., RemoteFetchGenerator) */
  destroy?: () => void;
}

/**
 * Sketch module interface - what each sketch entry provides.
 */
export interface SketchModule {
  /** Display name for the sketch */
  name: string;
  /** Short description */
  description: string;
  /** Create a sketch instance */
  create: () => SketchInstance;
  /** Set up interaction handlers for this sketch */
  setupInteractions: (
    element: HTMLCanvasElement | SVGSVGElement,
    instance: SketchInstance
  ) => void;
}

// ============================================================================
// Interaction Handlers
// ============================================================================

/**
 * Particle Plotter interaction handler.
 * Tracks pointer position and pressed state for continuous particle spawning.
 * Uses native PointerEvent API for unified mouse/touch handling.
 */
function setupParticlePlotterInteractions(
  element: HTMLCanvasElement | SVGSVGElement,
  instance: SketchInstance
): void {
  if (!instance.setMouseState) return;
  const setMouseState = instance.setMouseState;

  let isPressed = false;

  function updateMousePosition(clientX: number, clientY: number) {
    // Convert to element-relative CSS pixel coordinates
    // Sketches work in CSS pixel space - renderers handle DPR scaling
    const rect = element.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    setMouseState(true, x, y);
  }

  // Pointer events provide unified mouse/touch handling
  element.addEventListener("pointerdown", (e) => {
    const event = e as PointerEvent;
    isPressed = true;
    updateMousePosition(event.clientX, event.clientY);
  });

  element.addEventListener("pointermove", (e) => {
    const event = e as PointerEvent;
    if (isPressed) {
      updateMousePosition(event.clientX, event.clientY);
    }
  });

  element.addEventListener("pointerup", () => {
    isPressed = false;
    setMouseState(false, 0, 0);
  });

  element.addEventListener("pointerleave", () => {
    isPressed = false;
    setMouseState(false, 0, 0);
  });

  element.addEventListener("pointercancel", () => {
    isPressed = false;
    setMouseState(false, 0, 0);
  });
}

/**
 * Trees interaction handler.
 * Click/tap to reset the tree growth.
 */
function setupTreesInteractions(
  element: HTMLCanvasElement | SVGSVGElement,
  instance: SketchInstance
): void {
  if (!instance.reset) return;
  const reset = instance.reset;

  element.addEventListener("click", () => {
    reset();
  });
}

/**
 * Remote Pendulum - no interactions needed (server-driven animation).
 */
function setupRemotePendulumInteractions(
  _element: HTMLCanvasElement | SVGSVGElement,
  _instance: SketchInstance
): void {
  // No interactions - the pendulum animation is driven by the server
}

/**
 * Create a remote pendulum sketch instance.
 * Uses RemoteFetchGenerator to poll /frame.json for server-generated frames.
 */
function createRemotePendulum(): SketchInstance {
  const generator = RemoteFetchGenerator.fromUrl("http://localhost:3001", {
    pollInterval: 10, // Poll frequently for smooth animation
  });

  return {
    generator,
    destroy: () => generator.destroy(),
  };
}

// ============================================================================
// Sketch Registry
// ============================================================================

/**
 * Registry of all available sketches.
 * Keys are URL-safe identifiers used in query params.
 */
export const sketches: Record<string, SketchModule> = {
  "particle-plotter": {
    name: "Particle Plotter",
    description: "Mouse-driven particles flowing through mathematical fields",
    create: createParticlePlotter,
    setupInteractions: setupParticlePlotterInteractions,
  },
  trees: {
    name: "Trees",
    description: "Procedural tree generation with branching and shadows",
    create: createTrees,
    setupInteractions: setupTreesInteractions,
  },
  "remote-pendulum": {
    name: "Double Pendulum (Remote)",
    description: "Server-generated chaotic double pendulum simulation",
    create: createRemotePendulum,
    setupInteractions: setupRemotePendulumInteractions,
  },
};

/**
 * Get list of available sketch IDs.
 */
export function getSketchIds(): string[] {
  return Object.keys(sketches);
}

/**
 * Get a sketch module by ID.
 */
export function getSketch(id: string): SketchModule | undefined {
  return sketches[id];
}
