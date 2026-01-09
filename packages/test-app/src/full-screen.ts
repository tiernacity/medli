/**
 * Full-Screen Demo Page Controller
 *
 * Loads sketches dynamically based on URL query parameters.
 *
 * Usage:
 *   /full-screen.html?sketch=particle-plotter&renderer=canvas
 *   /full-screen.html?sketch=trees&renderer=svg
 *
 * Parameters:
 *   - sketch: Sketch ID (required, defaults to "particle-plotter")
 *   - renderer: "canvas" or "svg" (optional, defaults to "canvas")
 */
import { CanvasRenderer } from "@medli/renderer-canvas";
import { SvgRenderer } from "@medli/renderer-svg";
import Hammer from "hammerjs";
import { getSketch, getSketchIds } from "./sketches";

// ============================================================================
// Parse URL Parameters
// ============================================================================

const params = new URLSearchParams(window.location.search);
const sketchId = params.get("sketch") ?? "particle-plotter";
const rendererType = (params.get("renderer") as "canvas" | "svg") ?? "canvas";

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
  if (canvas) canvas.style.display = "block";
  if (svgElement) svgElement.style.display = "none";
}

const element = rendererType === "svg" ? svgElement : canvas;

if (!element) {
  throw new Error(`No ${rendererType} element found`);
}

// ============================================================================
// Canvas Size Sync (for Canvas renderer)
// ============================================================================

function syncCanvasSize() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

if (rendererType === "canvas" && canvas) {
  const resizeObserver = new ResizeObserver(syncCanvasSize);
  resizeObserver.observe(canvas);
  syncCanvasSize();
}

// ============================================================================
// Get Canvas Size Function
// ============================================================================

function getCanvasSize(): { width: number; height: number } {
  if (rendererType === "canvas" && canvas) {
    return { width: canvas.width, height: canvas.height };
  } else if (svgElement) {
    // For SVG, use the element's bounding rect with DPR
    const rect = svgElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      width: Math.round(rect.width * dpr),
      height: Math.round(rect.height * dpr),
    };
  }
  return { width: 800, height: 600 };
}

// ============================================================================
// Create Sketch Instance
// ============================================================================

const instance = sketchModule.create(getCanvasSize);

// ============================================================================
// Create Renderer
// ============================================================================

let renderer: CanvasRenderer | SvgRenderer;

if (rendererType === "svg" && svgElement) {
  renderer = new SvgRenderer(svgElement, instance.generator);
} else if (canvas) {
  renderer = new CanvasRenderer(canvas, instance.generator);
} else {
  throw new Error("No valid element for renderer");
}

// ============================================================================
// Setup Interactions
// ============================================================================

const hammer = new Hammer(element as HTMLElement, {
  recognizers: [
    [Hammer.Press, { time: 0 }],
    [Hammer.Pan, { threshold: 0 }],
  ],
});

sketchModule.setupInteractions(
  hammer,
  element as HTMLCanvasElement | SVGSVGElement,
  instance
);

// ============================================================================
// Update Page Title
// ============================================================================

document.title = `${sketchModule.name} - Medli`;

// ============================================================================
// Start Render Loop
// ============================================================================

renderer.loop();

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
