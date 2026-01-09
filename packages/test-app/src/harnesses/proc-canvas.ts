/**
 * Harness: Procedural Generator → Canvas Renderer
 */
import type { Generator } from "@medli/spec";
import type { Point } from "@medli/renderer-common";
import { CanvasRenderer } from "@medli/renderer-canvas";

export function createRenderer(
  element: HTMLCanvasElement,
  generator: Generator
) {
  const renderer = new CanvasRenderer(element, generator);
  return {
    start: () => renderer.loop(),
    stop: () => renderer.stop(),
    toViewportCoords: (point: Point) => renderer.toViewportCoords(point),
  };
}
