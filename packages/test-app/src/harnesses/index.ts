/**
 * Unified harness module for creating renderer instances
 */
import type { Generator, BaseRendererMetrics } from "@medli/spec";
import type { Point } from "@medli/renderer-common";
import { SvgRenderer } from "@medli/renderer-svg";
import { CanvasRenderer } from "@medli/renderer-canvas";
import { WebGLRenderer } from "@medli/renderer-webgl";
import { WebGPURenderer } from "@medli/renderer-webgpu";
import { withOptimization } from "@medli/generator-optimizer";
import { withValidation } from "@medli/generator-validator";

export type RendererType = "svg" | "canvas" | "webgl" | "webgpu";
export type GeneratorType = "procedural" | "object";

export interface HarnessInstance {
  start: () => void;
  stop: () => void;
  toViewportCoords: (point: Point) => Point;
  getMetrics: () => BaseRendererMetrics;
}

export function createHarness(
  element: HTMLCanvasElement | SVGSVGElement,
  generator: Generator,
  rendererType: RendererType
): HarnessInstance {
  // Pipeline: raw generator -> validator -> optimizer -> validator -> renderer
  const optimizedGenerator = withValidation(
    withOptimization(withValidation(generator))
  );

  let renderer;
  if (rendererType === "svg") {
    renderer = new SvgRenderer(element as SVGSVGElement, optimizedGenerator);
  } else if (rendererType === "webgl") {
    renderer = new WebGLRenderer(
      element as HTMLCanvasElement,
      optimizedGenerator
    );
  } else if (rendererType === "webgpu") {
    renderer = new WebGPURenderer(
      element as HTMLCanvasElement,
      optimizedGenerator
    );
  } else {
    renderer = new CanvasRenderer(
      element as HTMLCanvasElement,
      optimizedGenerator
    );
  }

  return {
    start: () => renderer.loop(),
    stop: () => renderer.stop(),
    toViewportCoords: (point: Point) => renderer.toViewportCoords(point),
    getMetrics: () => renderer.metrics,
  };
}
