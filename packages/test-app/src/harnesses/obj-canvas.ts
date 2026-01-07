/**
 * Harness: Object Generator → Canvas Renderer
 */
import { generator } from "../generators/object";
import { CanvasRenderer } from "@medli/renderer-canvas";

export function createRenderer(element: HTMLCanvasElement) {
  const renderer = new CanvasRenderer(element, generator);
  return {
    start: () => renderer.loop(),
    stop: () => renderer.stop(),
  };
}
