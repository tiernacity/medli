// Import scene registry
import { scenes, defaultSceneId, type SceneId } from "./scenes";

// Import harnesses
import { createRenderer as createProcSvg } from "./harnesses/proc-svg";
import { createRenderer as createProcCanvas } from "./harnesses/proc-canvas";
import { createRenderer as createObjSvg } from "./harnesses/obj-svg";
import { createRenderer as createObjCanvas } from "./harnesses/obj-canvas";

// Import hammer.js for interaction
import Hammer from "hammerjs";
import { setCirclePosition } from "./scenes/interaction";

// Import source code as raw text
import fullDemoSource from "./scenes/full-demo.ts?raw";
import materialsSource from "./scenes/materials.ts?raw";
import transformsSource from "./scenes/transforms.ts?raw";
import imageTransformsSource from "./scenes/image-transforms.ts?raw";
import transparencySource from "./scenes/transparency.ts?raw";
import interactionSource from "./scenes/interaction.ts?raw";
import harnessProcSvgSource from "./harnesses/proc-svg.ts?raw";
import harnessProcCanvasSource from "./harnesses/proc-canvas.ts?raw";
import harnessObjSvgSource from "./harnesses/obj-svg.ts?raw";
import harnessObjCanvasSource from "./harnesses/obj-canvas.ts?raw";

// Map scene IDs to their source code
const sceneSources: Record<string, string> = {
  "full-demo": fullDemoSource,
  materials: materialsSource,
  transforms: transformsSource,
  "image-transforms": imageTransformsSource,
  transparency: transparencySource,
  interaction: interactionSource,
};

// Get scene from URL parameter, fallback to default
const params = new URLSearchParams(window.location.search);
const sceneParam = params.get("scene");
const sceneId: SceneId =
  sceneParam && sceneParam in scenes ? (sceneParam as SceneId) : defaultSceneId;
const scene = scenes[sceneId];

// DOM elements
const sceneSelect = document.getElementById(
  "scene-select"
) as HTMLSelectElement;
const demosSelect = document.getElementById(
  "demos-select"
) as HTMLSelectElement;
const colorInput = document.getElementById("bg-color") as HTMLInputElement;
const colorValue = document.getElementById("color-value") as HTMLSpanElement;

// Populate scene selector dropdown
for (const [id, sceneData] of Object.entries(scenes)) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = sceneData.name;
  if (id === sceneId) option.selected = true;
  sceneSelect.appendChild(option);
}

// Handle scene selection change
sceneSelect.addEventListener("change", () => {
  const newSceneId = sceneSelect.value;
  const url = new URL(window.location.href);
  if (newSceneId === defaultSceneId) {
    url.searchParams.delete("scene");
  } else {
    url.searchParams.set("scene", newSceneId);
  }
  window.location.href = url.toString();
});

// Handle demos dropdown - navigate to full-screen demo pages
demosSelect.addEventListener("change", () => {
  const demoPage = demosSelect.value;
  if (demoPage) {
    window.location.href = demoPage;
  }
});

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

// Create all renderers with scene's generators
const renderers = [
  createProcSvg(
    document.querySelector<SVGSVGElement>("#proc-svg")!,
    scene.procedural
  ),
  createProcCanvas(
    document.querySelector<HTMLCanvasElement>("#proc-canvas")!,
    scene.procedural
  ),
  createObjSvg(
    document.querySelector<SVGSVGElement>("#obj-svg")!,
    scene.object
  ),
  createObjCanvas(
    document.querySelector<HTMLCanvasElement>("#obj-canvas")!,
    scene.object
  ),
];

// Set up hammer.js for interaction scene
if (sceneId === "interaction") {
  // Get the canvas and svg elements
  const procSvg = document.querySelector<SVGSVGElement>("#proc-svg")!;
  const procCanvas = document.querySelector<HTMLCanvasElement>("#proc-canvas")!;
  const objSvg = document.querySelector<SVGSVGElement>("#obj-svg")!;
  const objCanvas = document.querySelector<HTMLCanvasElement>("#obj-canvas")!;

  // The renderers array matches: [proc-svg, proc-canvas, obj-svg, obj-canvas]
  const elements = [procSvg, procCanvas, objSvg, objCanvas];

  elements.forEach((el, i) => {
    const hammer = new Hammer(el as HTMLElement);
    hammer.on("tap", (event) => {
      const renderer = renderers[i];
      // Get element-relative coordinates
      const rect = el.getBoundingClientRect();
      let elementX = event.center.x - rect.left;
      let elementY = event.center.y - rect.top;

      // For canvas elements, scale by DPI (buffer size != CSS size)
      if (el instanceof HTMLCanvasElement) {
        const dpr = window.devicePixelRatio || 1;
        elementX *= dpr;
        elementY *= dpr;
      }

      // Transform to viewport coordinates
      const [x, y] = renderer.toViewportCoords([elementX, elementY]);

      // Update the circle position
      setCirclePosition(x, y);
    });
  });
}

// Populate source code displays with current scene's source
const currentSceneSource = sceneSources[sceneId] || fullDemoSource;
const sourceMap: Record<string, string> = {
  "gen-procedural-code": currentSceneSource,
  "gen-object-code": currentSceneSource,
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

// Initial setup
scene.setBackground(colorInput.value);
renderers.forEach((r) => r.start());

// Update on color change
colorInput.addEventListener("input", () => {
  const color = colorInput.value;
  colorValue.textContent = color;
  scene.setBackground(color);
});
