/**
 * Particle Plotter - Full screen canvas demo
 *
 * Recreates the Processing sketch from https://openprocessing.org/sketch/751983
 * Using medli's procedural generator and canvas renderer.
 */
import { CanvasRenderer } from "@medli/renderer-canvas";
import Hammer from "hammerjs";
import { createParticlePlotter } from "./sketches/particle-plotter";

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

// Create the particle plotter with initial canvas dimensions
const { generator, setMouseState } = createParticlePlotter(() => ({
  width: canvas.width,
  height: canvas.height,
}));

// Create renderer
const renderer = new CanvasRenderer(canvas, generator);

// Set up Hammer.js for mouse/touch interaction
const hammer = new Hammer(canvas, {
  recognizers: [
    [Hammer.Press, { time: 0 }], // Instant press detection
    [Hammer.Pan, { threshold: 0 }], // Track movement with no threshold
  ],
});

// Track mouse position and pressed state
let isPressed = false;

hammer.on("press", (event) => {
  isPressed = true;
  updateMousePosition(event.center.x, event.center.y);
});

hammer.on("pressup", () => {
  isPressed = false;
  setMouseState(false, 0, 0);
});

hammer.on("panstart", (event) => {
  isPressed = true;
  updateMousePosition(event.center.x, event.center.y);
});

hammer.on("panmove", (event) => {
  if (isPressed) {
    updateMousePosition(event.center.x, event.center.y);
  }
});

hammer.on("panend pancancel", () => {
  isPressed = false;
  setMouseState(false, 0, 0);
});

// Also track regular mouse events for continuous position updates
canvas.addEventListener("mousedown", (event) => {
  isPressed = true;
  updateMousePosition(event.clientX, event.clientY);
});

canvas.addEventListener("mousemove", (event) => {
  if (isPressed) {
    updateMousePosition(event.clientX, event.clientY);
  }
});

canvas.addEventListener("mouseup", () => {
  isPressed = false;
  setMouseState(false, 0, 0);
});

canvas.addEventListener("mouseleave", () => {
  isPressed = false;
  setMouseState(false, 0, 0);
});

// Touch events for mobile
canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  isPressed = true;
  const touch = event.touches[0];
  updateMousePosition(touch.clientX, touch.clientY);
});

canvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  if (isPressed && event.touches.length > 0) {
    const touch = event.touches[0];
    updateMousePosition(touch.clientX, touch.clientY);
  }
});

canvas.addEventListener("touchend touchcancel", () => {
  isPressed = false;
  setMouseState(false, 0, 0);
});

function updateMousePosition(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  // Convert to canvas buffer coordinates
  const x = (clientX - rect.left) * dpr;
  const y = (clientY - rect.top) * dpr;
  setMouseState(true, x, y);
}

// Start the render loop
renderer.loop();
