// Import generators (for color control)
import { background as setProceduralBg } from "./generators/procedural";
import { background as setObjectBg } from "./generators/object";

// Import harnesses
import { createRenderer as createProcSvg } from "./harnesses/proc-svg";
import { createRenderer as createProcCanvas } from "./harnesses/proc-canvas";
import { createRenderer as createObjSvg } from "./harnesses/obj-svg";
import { createRenderer as createObjCanvas } from "./harnesses/obj-canvas";

// Import source code as raw text
import genProceduralSource from "./generators/procedural.ts?raw";
import genObjectSource from "./generators/object.ts?raw";
import harnessProcSvgSource from "./harnesses/proc-svg.ts?raw";
import harnessProcCanvasSource from "./harnesses/proc-canvas.ts?raw";
import harnessObjSvgSource from "./harnesses/obj-svg.ts?raw";
import harnessObjCanvasSource from "./harnesses/obj-canvas.ts?raw";

// DOM elements
const colorInput = document.getElementById("bg-color") as HTMLInputElement;
const colorValue = document.getElementById("color-value") as HTMLSpanElement;

// Canvas elements need buffer size synced with CSS size for crisp rendering
const canvasElements = [
  document.querySelector<HTMLCanvasElement>("#proc-canvas")!,
  document.querySelector<HTMLCanvasElement>("#obj-canvas")!,
];

// Sync canvas buffer size with CSS size
function syncCanvasSize(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

// Use ResizeObserver to keep canvas buffer in sync with CSS size
const resizeObserver = new ResizeObserver(() => {
  canvasElements.forEach(syncCanvasSize);
});
canvasElements.forEach((canvas) => {
  syncCanvasSize(canvas);
  resizeObserver.observe(canvas);
});

// Create all renderers
const renderers = [
  createProcSvg(document.querySelector<SVGSVGElement>("#proc-svg")!),
  createProcCanvas(document.querySelector<HTMLCanvasElement>("#proc-canvas")!),
  createObjSvg(document.querySelector<SVGSVGElement>("#obj-svg")!),
  createObjCanvas(document.querySelector<HTMLCanvasElement>("#obj-canvas")!),
];

// Populate source code displays
const sourceMap: Record<string, string> = {
  "gen-procedural-code": genProceduralSource,
  "gen-object-code": genObjectSource,
  "harness-proc-svg": harnessProcSvgSource,
  "harness-proc-canvas": harnessProcCanvasSource,
  "harness-obj-svg": harnessObjSvgSource,
  "harness-obj-canvas": harnessObjCanvasSource,
};

for (const [id, source] of Object.entries(sourceMap)) {
  const container = document.getElementById(id);
  if (container) {
    const pre = container.querySelector("pre");
    if (pre) pre.textContent = source;
  }
}

// Toggle code visibility
document.querySelectorAll<HTMLButtonElement>("[data-toggle]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.toggle;
    if (!targetId) return;
    const codeContainer = document.getElementById(targetId);
    if (!codeContainer) return;
    const isVisible = codeContainer.classList.toggle("visible");
    btn.textContent = isVisible
      ? btn.textContent?.includes("Harness")
        ? "Hide Harness"
        : "Hide Code"
      : btn.textContent?.includes("Harness")
        ? "Show Harness"
        : "Show Code";
  });
});

// Set background color on both generators
function setBackgroundColor(color: string) {
  setProceduralBg(color);
  setObjectBg(color);
}

// Initial setup
setBackgroundColor(colorInput.value);
renderers.forEach((r) => r.start());

// Update on color change
colorInput.addEventListener("input", () => {
  const color = colorInput.value;
  colorValue.textContent = color;
  setBackgroundColor(color);
});
