/**
 * Sketch type definitions.
 */
import type { Generator } from "@medli/spec";

/**
 * Result of creating a sketch instance.
 * Contains the generator and a cleanup function.
 */
export interface SketchInstance {
  generator: Generator;
  /** Cleanup function to release resources */
  destroy: () => void;
}

/**
 * Sketch module interface - what each sketch exports.
 */
export interface SketchModule {
  /** Display name for the sketch */
  name: string;
  /** Short description */
  description: string;
  /** Create a sketch instance with interaction handling */
  create: (element: HTMLCanvasElement | SVGSVGElement) => SketchInstance;
}
