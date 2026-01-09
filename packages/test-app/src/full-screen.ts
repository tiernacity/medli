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
// Get Canvas Size Function
// ============================================================================
// Note: CanvasRenderer handles buffer size sync internally via ResizeObserver

/**
 * Returns the logical (CSS pixel) dimensions of the rendering surface.
 * Sketches should work in CSS pixel space - the renderer handles DPR scaling.
 */
function getCanvasSize(): { width: number; height: number } {
  if (rendererType === "canvas" && canvas) {
    // Return CSS dimensions, not buffer dimensions
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  } else if (svgElement) {
    const rect = svgElement.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
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

sketchModule.setupInteractions(
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
