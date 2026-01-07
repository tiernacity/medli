/**
 * Harness: Object Generator → SVG Renderer
 */
import { generator } from "../generators/object";
import { SvgRenderer } from "@medli/renderer-svg";

export function createRenderer(element: SVGSVGElement) {
  const renderer = new SvgRenderer(element, generator);
  return {
    start: () => renderer.loop(),
    stop: () => renderer.stop(),
  };
}
