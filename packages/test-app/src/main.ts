// Import app modules
import { createApp as createProcSvg } from "./apps/proc-svg";
import { createApp as createProcCanvas } from "./apps/proc-canvas";
import { createApp as createObjSvg } from "./apps/obj-svg";
import { createApp as createObjCanvas } from "./apps/obj-canvas";

// Import source code as raw text (auto-updates with Vite HMR)
import procSvgSource from "./apps/proc-svg.ts?raw";
import procCanvasSource from "./apps/proc-canvas.ts?raw";
import objSvgSource from "./apps/obj-svg.ts?raw";
import objCanvasSource from "./apps/obj-canvas.ts?raw";

// Get DOM elements
const colorInput = document.getElementById("bg-color") as HTMLInputElement;
const colorValue = document.getElementById("color-value") as HTMLSpanElement;

// Create all apps
const apps = [
  createProcSvg(document.getElementById("proc-svg") as SVGSVGElement),
  createProcCanvas(document.getElementById("proc-canvas") as HTMLCanvasElement),
  createObjSvg(document.getElementById("obj-svg") as SVGSVGElement),
  createObjCanvas(document.getElementById("obj-canvas") as HTMLCanvasElement),
];

// Populate source code displays
const sourceMap: Record<string, string> = {
  "proc-svg-code": procSvgSource,
  "proc-canvas-code": procCanvasSource,
  "obj-svg-code": objSvgSource,
  "obj-canvas-code": objCanvasSource,
};

for (const [id, source] of Object.entries(sourceMap)) {
  const container = document.getElementById(id);
  if (container) {
    const pre = container.querySelector("pre");
    if (pre) {
      pre.textContent = source;
    }
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
    btn.textContent = isVisible ? "Hide Code" : "Show Code";
  });
});

// Set initial color and start all apps
const initialColor = colorInput.value;
apps.forEach((app) => {
  app.setBackgroundColor(initialColor);
  app.start();
});

// Update all apps on color change
colorInput.addEventListener("input", () => {
  const color = colorInput.value;
  colorValue.textContent = color;
  apps.forEach((app) => app.setBackgroundColor(color));
});
