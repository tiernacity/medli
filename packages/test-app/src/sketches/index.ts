/**
 * Sketch Registry
 *
 * Central registry for all p5.js-style sketch ports.
 * Each sketch exports a factory function and optional interaction handler.
 */
import type { ProceduralGenerator } from "@medli/generator-procedural";
import Hammer from "hammerjs";
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
  generator: ProceduralGenerator;
  /** ParticlePlotter: control mouse state */
  setMouseState?: (pressed: boolean, x: number, y: number) => void;
  /** Trees: reset/restart the sketch */
  reset?: () => void;
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
  create: (
    getCanvasSize: () => { width: number; height: number }
  ) => SketchInstance;
  /** Set up interaction handlers for this sketch */
  setupInteractions: (
    hammer: Hammer.Manager,
    element: HTMLCanvasElement | SVGSVGElement,
    instance: SketchInstance
  ) => void;
}

// ============================================================================
// Interaction Handlers
// ============================================================================

/**
 * Particle Plotter interaction handler.
 * Tracks mouse/touch position and pressed state for continuous particle spawning.
 */
function setupParticlePlotterInteractions(
  hammer: Hammer.Manager,
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

  // Hammer.js events
  hammer.on("press", (event) => {
    isPressed = true;
    updateMousePosition(event.center.x, event.center.y);
  });

  hammer.on("pressup", () => {
    isPressed = false;
    setMouseState(false, 0, 0);
  });

  hammer.on("panstart", (event) => {
    isPressed = true;
    updateMousePosition(event.center.x, event.center.y);
  });

  hammer.on("panmove", (event) => {
    if (isPressed) {
      updateMousePosition(event.center.x, event.center.y);
    }
  });

  hammer.on("panend pancancel", () => {
    isPressed = false;
    setMouseState(false, 0, 0);
  });

  // Native mouse events for robustness
  element.addEventListener("mousedown", (event) => {
    isPressed = true;
    updateMousePosition(event.clientX, event.clientY);
  });

  element.addEventListener("mousemove", (event) => {
    if (isPressed) {
      updateMousePosition(event.clientX, event.clientY);
    }
  });

  element.addEventListener("mouseup", () => {
    isPressed = false;
    setMouseState(false, 0, 0);
  });

  element.addEventListener("mouseleave", () => {
    isPressed = false;
    setMouseState(false, 0, 0);
  });

  // Touch events for mobile
  element.addEventListener("touchstart", (event) => {
    event.preventDefault();
    isPressed = true;
    const touch = event.touches[0];
    updateMousePosition(touch.clientX, touch.clientY);
  });

  element.addEventListener("touchmove", (event) => {
    event.preventDefault();
    if (isPressed && event.touches.length > 0) {
      const touch = event.touches[0];
      updateMousePosition(touch.clientX, touch.clientY);
    }
  });

  element.addEventListener("touchend", () => {
    isPressed = false;
    setMouseState(false, 0, 0);
  });

  element.addEventListener("touchcancel", () => {
    isPressed = false;
    setMouseState(false, 0, 0);
  });
}

/**
 * Trees interaction handler.
 * Click/tap to reset the tree growth.
 */
function setupTreesInteractions(
  _hammer: Hammer.Manager,
  element: HTMLCanvasElement | SVGSVGElement,
  instance: SketchInstance
): void {
  if (!instance.reset) return;
  const reset = instance.reset;

  element.addEventListener("click", () => {
    reset();
  });
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
