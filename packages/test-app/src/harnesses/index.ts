/**
 * Unified harness module for creating renderer instances
 */
import type { Generator } from "@medli/spec";
import type { Point } from "@medli/renderer-common";
import { SvgRenderer } from "@medli/renderer-svg";
import { CanvasRenderer } from "@medli/renderer-canvas";
import { WebGLRenderer } from "@medli/renderer-webgl";

export type RendererType = "svg" | "canvas" | "webgl";
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
  let renderer;
  if (rendererType === "svg") {
    renderer = new SvgRenderer(element as SVGSVGElement, generator);
  } else if (rendererType === "webgl") {
    renderer = new WebGLRenderer(element as HTMLCanvasElement, generator);
  } else {
    renderer = new CanvasRenderer(element as HTMLCanvasElement, generator);
  }

  return {
    start: () => renderer.loop(),
    stop: () => renderer.stop(),
    toViewportCoords: (point: Point) => renderer.toViewportCoords(point),
  };
}
