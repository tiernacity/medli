/**
 * Trees - Full screen canvas demo
 *
 * Port of the Processing sketch from https://openprocessing.org/sketch/627398
 * Using medli's procedural generator and canvas renderer.
 */
import { CanvasRenderer } from "@medli/renderer-canvas";
import { createTrees } from "./sketches/trees";

// Get canvas element
const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;

// Sync canvas buffer size with CSS size (for crisp rendering)
function syncCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

// Keep canvas buffer in sync with CSS size
const resizeObserver = new ResizeObserver(syncCanvasSize);
resizeObserver.observe(canvas);
syncCanvasSize();

// Create the trees generator
const { generator, reset } = createTrees(() => ({
  width: canvas.width,
  height: canvas.height,
}));

// Create renderer
const renderer = new CanvasRenderer(canvas, generator);

// Click to reset (like the original)
canvas.addEventListener("click", () => {
  // Clear the canvas manually before reset
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "hsl(40, 4%, 100%)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  reset();
});

// Fill initial background
const ctx = canvas.getContext("2d");
if (ctx) {
  ctx.fillStyle = "hsl(40, 4%, 100%)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Start the render loop
renderer.loop();
