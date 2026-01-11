/**
 * Full-Screen Demo Page Controller
 *
 * Loads sketches dynamically based on URL query parameters.
 *
 * Usage:
 *   /full-screen.html?sketch=particle-plotter&renderer=canvas
 *   /full-screen.html?sketch=trees&renderer=svg
 *   /full-screen.html?sketch=particle-plotter&renderer=webgl
 *   /full-screen.html?sketch=trees&renderer=webgpu
 *
 * Parameters:
 *   - sketch: Sketch ID (required, defaults to "particle-plotter")
 *   - renderer: "canvas", "svg", "webgl", or "webgpu" (optional, defaults to "canvas")
 */
import { CanvasRenderer } from "@medli/renderer-canvas";
import { SvgRenderer } from "@medli/renderer-svg";
import { WebGLRenderer } from "@medli/renderer-webgl";
import { WebGPURenderer } from "@medli/renderer-webgpu";
import { getSketch, getSketchIds } from "./sketches";

// ============================================================================
// Parse URL Parameters
// ============================================================================

const params = new URLSearchParams(window.location.search);
const sketchId = params.get("sketch") ?? "particle-plotter";
const rendererType =
  (params.get("renderer") as "canvas" | "svg" | "webgl" | "webgpu") ?? "canvas";

// ============================================================================
// Validate Sketch
// ============================================================================

const sketchModule = getSketch(sketchId);

if (!sketchModule) {
  const validSketches = getSketchIds().join(", ");
  document.body.innerHTML = `
    <div style="padding: 2rem; font-family: system-ui, sans-serif;">
      <h1>Sketch not found: ${sketchId}</h1>
      <p>Available sketches: ${validSketches}</p>
      <p>
        <a href="?sketch=particle-plotter">Particle Plotter</a> |
        <a href="?sketch=trees">Trees</a>
      </p>
    </div>
  `;
  throw new Error(`Unknown sketch: ${sketchId}`);
}

// ============================================================================
// Setup Canvas/SVG Element
// ============================================================================

// Get the appropriate element based on renderer type
const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
const svgElement = document.querySelector<SVGSVGElement>("#svg");

// Show/hide elements based on renderer type
if (rendererType === "svg") {
  if (canvas) canvas.style.display = "none";
  if (svgElement) svgElement.style.display = "block";
} else {
  // Canvas, WebGL, and WebGPU use the canvas element
  if (canvas) canvas.style.display = "block";
  if (svgElement) svgElement.style.display = "none";
}

const element = rendererType === "svg" ? svgElement : canvas;

if (!element) {
  throw new Error(`No ${rendererType} element found`);
}

// ============================================================================
// Create Sketch Instance
// ============================================================================

const instance = sketchModule.create(
  element as HTMLCanvasElement | SVGSVGElement
);

// ============================================================================
// Create Renderer
// ============================================================================

let renderer: CanvasRenderer | SvgRenderer | WebGLRenderer | WebGPURenderer;

if (rendererType === "svg" && svgElement) {
  renderer = new SvgRenderer(svgElement, instance.generator);
} else if (rendererType === "webgl" && canvas) {
  renderer = new WebGLRenderer(canvas, instance.generator);
} else if (rendererType === "webgpu" && canvas) {
  renderer = new WebGPURenderer(canvas, instance.generator);
} else if (canvas) {
  renderer = new CanvasRenderer(canvas, instance.generator);
} else {
  throw new Error("No valid element for renderer");
}

// ============================================================================
// Update Page Title
// ============================================================================

document.title = `${sketchModule.name} - Medli`;

// ============================================================================
// Start Render Loop
// ============================================================================

renderer.loop();

// ============================================================================
// Cleanup on page unload
// ============================================================================

window.addEventListener("beforeunload", () => {
  renderer.destroy();
  instance.destroy();
});

// ============================================================================
// Export for debugging
// ============================================================================

declare global {
  interface Window {
    sketchInfo: {
      id: string;
      name: string;
      renderer: string;
      instance: typeof instance;
    };
  }
}

window.sketchInfo = {
  id: sketchId,
  name: sketchModule.name,
  renderer: rendererType,
  instance,
};
