/**
 * Harness: Procedural Generator → Canvas Renderer
 */
import { generator } from "../generators/procedural";
import { CanvasRenderer } from "@medli/renderer-canvas";

export function createRenderer(element: HTMLCanvasElement) {
  const renderer = new CanvasRenderer(element, generator);
  return {
    start: () => renderer.loop(),
    stop: () => renderer.stop(),
  };
}
