/**
 * Unified harness module for creating renderer instances
 */
import type { Generator } from "@medli/spec";
import type { Point } from "@medli/renderer-common";
import { SvgRenderer } from "@medli/renderer-svg";
import { CanvasRenderer } from "@medli/renderer-canvas";

export type RendererType = "svg" | "canvas";
export type GeneratorType = "procedural" | "object";

export interface HarnessInstance {
  start: () => void;
  stop: () => void;
  toViewportCoords: (point: Point) => Point;
}

export function createHarness(
  element: HTMLCanvasElement | SVGSVGElement,
  generator: Generator,
  rendererType: RendererType
): HarnessInstance {
  const renderer =
    rendererType === "svg"
      ? new SvgRenderer(element as SVGSVGElement, generator)
      : new CanvasRenderer(element as HTMLCanvasElement, generator);

  return {
    start: () => renderer.loop(),
    stop: () => renderer.stop(),
    toViewportCoords: (point: Point) => renderer.toViewportCoords(point),
  };
}
