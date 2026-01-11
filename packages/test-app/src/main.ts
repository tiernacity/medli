// Import scene registry
import {
  scenes,
  defaultSceneId,
  type SceneId,
  setCirclePosition,
} from "./scenes";

// Import unified harness
import {
  createHarness,
  type RendererType,
  type GeneratorType,
  type HarnessInstance,
} from "./harnesses";

// Import source code as raw text
import fullDemoSource from "./scenes/full-demo.ts?raw";
import materialsSource from "./scenes/materials.ts?raw";
import transformsSource from "./scenes/transforms.ts?raw";
import imageTransformsSource from "./scenes/image-transforms.ts?raw";
import imageCropSource from "./scenes/image-crop.ts?raw";
import optionalClearSource from "./scenes/optional-clear.ts?raw";
import transparencySource from "./scenes/transparency.ts?raw";
import interactionSource from "./scenes/interaction.ts?raw";

// Map scene IDs to their source code
const sceneSources: Record<string, string> = {
  "full-demo": fullDemoSource,
  materials: materialsSource,
  transforms: transformsSource,
  "image-transforms": imageTransformsSource,
  "image-crop": imageCropSource,
  "optional-clear": optionalClearSource,
  transparency: transparencySource,
  interaction: interactionSource,
};

// Parse query parameters
const params = new URLSearchParams(window.location.search);
const sceneParam = params.get("scene");
const generatorParams = params.getAll("generator");
const rendererParams = params.getAll("renderer");

// Validate params
const validGenerators = generatorParams.filter(
  (g): g is GeneratorType => g === "procedural" || g === "object"
);
const validRenderers = rendererParams.filter(
  (r): r is RendererType => r === "svg" || r === "canvas" || r === "webgl"
);

// Redirect to explicit URL if any params are missing or invalid
const needsRedirect =
  !sceneParam ||
  !(sceneParam in scenes) ||
  validGenerators.length === 0 ||
  validRenderers.length === 0;

if (needsRedirect) {
  const url = new URL(window.location.href);
  url.searchParams.set(
    "scene",
    sceneParam && sceneParam in scenes ? sceneParam : defaultSceneId
  );

  if (validGenerators.length === 0) {
    url.searchParams.append("generator", "procedural");
    url.searchParams.append("generator", "object");
  }
  if (validRenderers.length === 0) {
    url.searchParams.append("renderer", "svg");
    url.searchParams.append("renderer", "canvas");
    url.searchParams.append("renderer", "webgl");
  }

  window.location.replace(url.toString());
  throw new Error("Redirecting..."); // Stop execution during redirect
}

const sceneId = sceneParam as SceneId;
const scene = scenes[sceneId];
const selectedGenerators = validGenerators;
const selectedRenderers = validRenderers;

// DOM elements
const demosSelect = document.getElementById(
  "demos-select"
) as HTMLSelectElement;
const colorInput = document.getElementById("bg-color") as HTMLInputElement;
const colorValue = document.getElementById("color-value") as HTMLSpanElement;
const sceneCode = document.getElementById("scene-code") as HTMLPreElement;
const rendererGrid = document.getElementById("renderer-grid") as HTMLDivElement;

// Custom dropdown elements
const sceneDropdown = document.getElementById(
  "scene-dropdown"
) as HTMLDivElement;
const sceneButton = document.getElementById(
  "scene-button"
) as HTMLButtonElement;
const sceneMenu = document.getElementById("scene-menu") as HTMLDivElement;
const generatorDropdown = document.getElementById(
  "generator-dropdown"
) as HTMLDivElement;
const generatorButton = document.getElementById(
  "generator-button"
) as HTMLButtonElement;
const generatorMenu = document.getElementById(
  "generator-menu"
) as HTMLDivElement;
const rendererDropdown = document.getElementById(
  "renderer-dropdown"
) as HTMLDivElement;
const rendererButton = document.getElementById(
  "renderer-button"
) as HTMLButtonElement;
const rendererMenu = document.getElementById("renderer-menu") as HTMLDivElement;

// Populate scene dropdown menu
for (const [id, sceneData] of Object.entries(scenes)) {
  const item = document.createElement("div");
  item.className = "dropdown-item" + (id === sceneId ? " selected" : "");
  item.dataset.value = id;
  item.textContent = sceneData.name;
  sceneMenu.appendChild(item);
}
sceneButton.textContent = scenes[sceneId].name;

// Set selected state on generator items
const generatorItems =
  generatorMenu.querySelectorAll<HTMLDivElement>(".dropdown-item");
for (const item of generatorItems) {
  if (selectedGenerators.includes(item.dataset.value as GeneratorType)) {
    item.classList.add("selected");
  }
}
generatorButton.textContent =
  selectedGenerators.length === 2
    ? "All"
    : selectedGenerators
        .map((g) => (g === "procedural" ? "Procedural" : "Object"))
        .join(", ");

// Set selected state on renderer items
const rendererItems =
  rendererMenu.querySelectorAll<HTMLDivElement>(".dropdown-item");
for (const item of rendererItems) {
  if (selectedRenderers.includes(item.dataset.value as RendererType)) {
    item.classList.add("selected");
  }
}
rendererButton.textContent =
  selectedRenderers.length === 3
    ? "All"
    : selectedRenderers.map((r) => r.toUpperCase()).join(", ");

// Build URL with current selections (always explicit, no defaults)
function buildUrl(
  newSceneId: string,
  generators: GeneratorType[],
  renderers: RendererType[]
): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("scene");
  url.searchParams.delete("generator");
  url.searchParams.delete("renderer");

  url.searchParams.set("scene", newSceneId);

  for (const g of generators) {
    url.searchParams.append("generator", g);
  }

  for (const r of renderers) {
    url.searchParams.append("renderer", r);
  }

  return url.toString();
}

// Dropdown toggle behavior
function setupDropdown(
  dropdown: HTMLDivElement,
  button: HTMLButtonElement,
  menu: HTMLDivElement,
  onSelect: (value: string, item: HTMLDivElement) => void
) {
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    // Close other dropdowns
    document.querySelectorAll(".dropdown.open").forEach((d) => {
      if (d !== dropdown) d.classList.remove("open");
    });
    dropdown.classList.toggle("open");
  });

  menu.addEventListener("click", (e) => {
    const item = (e.target as HTMLElement).closest(
      ".dropdown-item"
    ) as HTMLDivElement | null;
    if (item) {
      onSelect(item.dataset.value!, item);
    }
  });
}

// Close dropdowns when clicking outside
document.addEventListener("click", () => {
  document
    .querySelectorAll(".dropdown.open")
    .forEach((d) => d.classList.remove("open"));
});

// Scene dropdown (single-select)
setupDropdown(sceneDropdown, sceneButton, sceneMenu, (value) => {
  window.location.href = buildUrl(value, selectedGenerators, selectedRenderers);
});

// Generator dropdown (multi-select with toggle)
setupDropdown(
  generatorDropdown,
  generatorButton,
  generatorMenu,
  (value, item) => {
    const isSelected = item.classList.contains("selected");
    const currentSelected = Array.from(generatorItems)
      .filter((i) => i.classList.contains("selected"))
      .map((i) => i.dataset.value as GeneratorType);

    let newSelected: GeneratorType[];
    if (isSelected && currentSelected.length > 1) {
      // Deselect (but keep at least one)
      newSelected = currentSelected.filter((v) => v !== value);
    } else if (!isSelected) {
      // Select
      newSelected = [...currentSelected, value as GeneratorType];
    } else {
      // Can't deselect the last one
      return;
    }
    window.location.href = buildUrl(sceneId, newSelected, selectedRenderers);
  }
);

// Renderer dropdown (multi-select with toggle)
setupDropdown(rendererDropdown, rendererButton, rendererMenu, (value, item) => {
  const isSelected = item.classList.contains("selected");
  const currentSelected = Array.from(rendererItems)
    .filter((i) => i.classList.contains("selected"))
    .map((i) => i.dataset.value as RendererType);

  let newSelected: RendererType[];
  if (isSelected && currentSelected.length > 1) {
    // Deselect (but keep at least one)
    newSelected = currentSelected.filter((v) => v !== value);
  } else if (!isSelected) {
    // Select
    newSelected = [...currentSelected, value as RendererType];
  } else {
    // Can't deselect the last one
    return;
  }
  window.location.href = buildUrl(sceneId, selectedGenerators, newSelected);
});

// Handle demos dropdown - navigate to full-screen demo pages
demosSelect.addEventListener("change", () => {
  const demoPage = demosSelect.value;
  if (demoPage) {
    window.location.href = demoPage;
  }
});

// Display scene source code
const currentSceneSource = sceneSources[sceneId] || fullDemoSource;
sceneCode.textContent = currentSceneSource;

// Build the dynamic renderer grid
// Layout: generators as rows, renderers as columns
rendererGrid.style.display = "grid";
rendererGrid.style.gridTemplateColumns = `repeat(${selectedRenderers.length}, 1fr)`;
rendererGrid.style.gap = "20px";

interface GridCell {
  element: HTMLCanvasElement | SVGSVGElement;
  harness: HarnessInstance;
  generator: GeneratorType;
  renderer: RendererType;
}

const gridCells: GridCell[] = [];

for (const generatorType of selectedGenerators) {
  for (const rendererType of selectedRenderers) {
    const generator =
      generatorType === "procedural" ? scene.procedural : scene.object;

    // Create the cell card
    const card = document.createElement("div");
    card.className = "renderer-card";

    // Header
    const header = document.createElement("div");
    header.className = "renderer-header";
    const generatorLabel =
      generatorType === "procedural" ? "Procedural" : "Object";
    const rendererLabel =
      rendererType === "svg"
        ? "SVG"
        : rendererType === "webgl"
          ? "WebGL"
          : "Canvas";
    header.innerHTML = `<span>${generatorLabel} / ${rendererLabel}</span>`;
    card.appendChild(header);

    // Output container
    const output = document.createElement("div");
    output.className = "renderer-output";

    // Create the appropriate element
    let element: HTMLCanvasElement | SVGSVGElement;
    const testId = `${generatorType}-${rendererType}`;

    if (rendererType === "svg") {
      element = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      element.setAttribute("data-testid", testId);
    } else {
      // Both Canvas and WebGL use HTMLCanvasElement
      element = document.createElement("canvas");
      element.setAttribute("data-testid", testId);
    }

    output.appendChild(element);
    card.appendChild(output);

    rendererGrid.appendChild(card);

    // Create harness and wire up
    const harness = createHarness(element, generator, rendererType);

    gridCells.push({
      element,
      harness,
      generator: generatorType,
      renderer: rendererType,
    });
  }
}

/**
 * Expose metrics API for performance analysis.
 * - window.medli.reportMetrics() - logs formatted metrics to console
 * - window.medli.getMetrics() - returns structured metrics object
 */
declare global {
  interface Window {
    medli?: {
      reportMetrics: () => void;
      getMetrics: () => Record<
        string,
        ReturnType<HarnessInstance["getMetrics"]>
      >;
    };
  }
}

window.medli = {
  reportMetrics: () => {
    console.log("\n=== Medli Renderer Metrics ===");
    for (const cell of gridCells) {
      const label = `${cell.generator}/${cell.renderer}`;
      const m = cell.harness.getMetrics();
      console.log(`\n[${label}]`);
      console.log(`  FPS: ${m.fps?.toFixed(1) ?? "calculating..."}`);
      console.log(`  Frame time: ${m.frameTime.toFixed(2)}ms`);
      console.log(`  Generator: ${m.generatorTime.toFixed(2)}ms`);
      console.log(`  Traversal: ${m.traversalTime.toFixed(2)}ms`);
      console.log(`  Resource: ${m.resourceTime.toFixed(2)}ms`);
      console.log(`  Render: ${m.renderTime.toFixed(2)}ms`);
      console.log(`  Shapes: ${m.shapeCount}`);
      console.log(`  Frame count: ${m.frameCount}`);
      // WebGL-specific metrics
      if ("batchCount" in m) {
        console.log(`  Batch count: ${m.batchCount}`);
      }
      if ("gpuTime" in m) {
        const gpuTime = m.gpuTime as number | undefined;
        console.log(
          `  GPU time: ${gpuTime !== undefined ? gpuTime.toFixed(2) + "ms" : "N/A"}`
        );
      }
      if ("gpuTimerAvailable" in m) {
        console.log(`  GPU timer available: ${m.gpuTimerAvailable}`);
      }
      // SVG-specific metrics
      if ("snapshotTime" in m) {
        const snapshotTime = m.snapshotTime as number | undefined;
        console.log(
          `  Snapshot time: ${snapshotTime !== undefined ? snapshotTime.toFixed(2) + "ms" : "N/A"}`
        );
      }
    }
    console.log("\n==============================\n");
  },
  getMetrics: () => {
    const result: Record<string, ReturnType<HarnessInstance["getMetrics"]>> =
      {};
    for (const cell of gridCells) {
      const label = `${cell.generator}/${cell.renderer}`;
      result[label] = cell.harness.getMetrics();
    }
    return result;
  },
};

// Set up native pointer events for interaction scene
if (sceneId === "interaction") {
  for (const cell of gridCells) {
    cell.element.addEventListener("pointerup", (e) => {
      const event = e as PointerEvent;
      const rect = cell.element.getBoundingClientRect();
      const elementX = event.clientX - rect.left;
      const elementY = event.clientY - rect.top;

      // Transform to viewport coordinates
      const [x, y] = cell.harness.toViewportCoords([elementX, elementY]);

      // Update the circle position
      setCirclePosition(x, y);
    });
  }
}

// Initial setup
scene.setBackground(colorInput.value);
gridCells.forEach((cell) => cell.harness.start());

// Update on color change
colorInput.addEventListener("input", () => {
  const color = colorInput.value;
  colorValue.textContent = color;
  scene.setBackground(color);
});
