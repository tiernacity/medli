/**
 * Harness: Object Generator → SVG Renderer
 */
import type { Generator, Point } from "@medli/spec";
import { SvgRenderer } from "@medli/renderer-svg";

export function createRenderer(element: SVGSVGElement, generator: Generator) {
  const renderer = new SvgRenderer(element, generator);
  return {
    start: () => renderer.loop(),
    stop: () => renderer.stop(),
    toViewportCoords: (point: Point) => renderer.toViewportCoords(point),
  };
}
