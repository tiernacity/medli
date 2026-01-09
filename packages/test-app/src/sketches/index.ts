/**
 * Sketch Registry
 *
 * Central registry for all available sketches.
 * Each sketch exports a SketchModule with name, description, and create function.
 */
import { particlePlotter } from "./particle-plotter";
import { trees } from "./trees";
import { remotePendulum } from "./remote-pendulum";

export type { SketchModule, SketchInstance } from "./types";

/**
 * Registry of all available sketches.
 * Keys are URL-safe identifiers used in query params.
 */
export const sketches = {
  "particle-plotter": particlePlotter,
  trees: trees,
  "remote-pendulum": remotePendulum,
} as const;

export type SketchId = keyof typeof sketches;

/**
 * Get list of available sketch IDs.
 */
export function getSketchIds(): SketchId[] {
  return Object.keys(sketches) as SketchId[];
}

/**
 * Get a sketch module by ID.
 */
export function getSketch(id: string) {
  return sketches[id as SketchId];
}
