/**
 * Harness: Procedural Generator → SVG Renderer
 */
import type { Generator } from "@medli/spec";
import { SvgRenderer } from "@medli/renderer-svg";

export function createRenderer(element: SVGSVGElement, generator: Generator) {
  const renderer = new SvgRenderer(element, generator);
  return {
    start: () => renderer.loop(),
    stop: () => renderer.stop(),
  };
}
