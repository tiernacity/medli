/**
 * Pipeline Benchmark
 *
 * Tests WebGPU renderer performance with different pipeline configurations.
 *
 * Usage:
 *   /benchmark.html?shapes=500&pipeline=none
 *   /benchmark.html?shapes=500&pipeline=validator
 *   /benchmark.html?shapes=500&pipeline=optimizer
 *   /benchmark.html?shapes=500&pipeline=both
 *
 * Parameters:
 *   - shapes: Number of shapes (default: 500)
 *   - pipeline: "none", "validator", "optimizer", "both" (default: "both")
 */
import type { Generator } from "@medli/spec";
import { WebGPURenderer } from "@medli/renderer-webgpu";
import { withOptimization } from "@medli/generator-optimizer";
import { withValidation } from "@medli/generator-validator";
import { ProceduralGenerator } from "@medli/generator-procedural";

// =============================================================================
// Parse URL Parameters
// =============================================================================

const params = new URLSearchParams(window.location.search);
const shapeCount = parseInt(params.get("shapes") ?? "500", 10);
const pipelineMode = (params.get("pipeline") ?? "both") as
  | "none"
  | "validator"
  | "optimizer"
  | "both";

// =============================================================================
// Color Palette
// =============================================================================

const palette = [
  "#e94560",
  "#ff9800",
  "#ffc107",
  "#4caf50",
  "#00d9ff",
  "#4361ee",
  "#9b59b6",
  "#ff6b6b",
];

// =============================================================================
// Create Stress Test Generator
// =============================================================================

function getOrbitalParams(index: number, total: number) {
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const angleOffset = index * goldenRatio * Math.PI * 2;
  const normalizedIndex = index / total;
  const orbitRadius = 5 + normalizedIndex * 40;
  const speed = 2 - normalizedIndex * 1.5;
  const circleRadius = Math.max(1, 3 - total / 200);
  return { angleOffset, orbitRadius, speed, circleRadius };
}

const rawGenerator = new ProceduralGenerator((p) => {
  p.background("#1a1a2e");
  p.viewport(50, 50);
  p.strokeWidth(0);

  for (let i = 0; i < shapeCount; i++) {
    const params = getOrbitalParams(i, shapeCount);
    const angle = params.angleOffset + (p.time / 1000) * params.speed;
    const x = Math.cos(angle) * params.orbitRadius;
    const y = Math.sin(angle) * params.orbitRadius;

    const color = palette[i % palette.length];
    p.fill(color);
    p.stroke(color);
    p.circle(x, y, params.circleRadius);
  }
});

// =============================================================================
// Apply Pipeline Based on Mode
// =============================================================================

function buildPipeline(
  gen: Generator,
  mode: "none" | "validator" | "optimizer" | "both"
): Generator {
  switch (mode) {
    case "none":
      return gen;
    case "validator":
      return withValidation(gen);
    case "optimizer":
      return withOptimization(gen);
    case "both":
      return withOptimization(withValidation(gen));
  }
}

const generator = buildPipeline(rawGenerator, pipelineMode);

// =============================================================================
// Setup Canvas and Renderer
// =============================================================================

const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
if (!canvas) throw new Error("No canvas element found");

const renderer = new WebGPURenderer(canvas, generator);

// =============================================================================
// Update Metrics Display
// =============================================================================

const metricsEl = document.querySelector<HTMLElement>("#metrics");
const configEl = metricsEl?.querySelector<HTMLElement>(".config");
const fpsEl = metricsEl?.querySelector<HTMLElement>(".fps");
const timesEl = metricsEl?.querySelector<HTMLElement>(".times");

if (configEl) {
  configEl.textContent = `WebGPU | ${shapeCount} shapes | pipeline: ${pipelineMode}`;
}

// Rolling FPS samples for stability
const fpsSamples: number[] = [];
const maxSamples = 60;

function updateMetrics() {
  const m = renderer.metrics;

  // Update FPS with rolling average
  if (m.fps !== undefined) {
    fpsSamples.push(m.fps);
    if (fpsSamples.length > maxSamples) fpsSamples.shift();
    const avgFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;

    if (fpsEl) {
      fpsEl.textContent = `${avgFps.toFixed(1)} FPS`;
      fpsEl.classList.remove("good", "ok", "bad");
      if (avgFps >= 55) fpsEl.classList.add("good");
      else if (avgFps >= 30) fpsEl.classList.add("ok");
      else fpsEl.classList.add("bad");
    }
  }

  if (timesEl) {
    timesEl.innerHTML = `
      <span>Gen: ${m.generatorTime.toFixed(2)}ms</span>
      <span>Trav: ${m.traversalTime.toFixed(2)}ms</span>
      <span>Render: ${m.renderTime.toFixed(2)}ms</span>
      <span>Total: ${m.frameTime.toFixed(2)}ms</span>
    `;
  }

  requestAnimationFrame(updateMetrics);
}

// =============================================================================
// Start
// =============================================================================

renderer.loop();
updateMetrics();

// =============================================================================
// Export for Debugging
// =============================================================================

declare global {
  interface Window {
    benchmark: {
      renderer: typeof renderer;
      shapeCount: number;
      pipelineMode: string;
    };
  }
}

window.benchmark = {
  renderer,
  shapeCount,
  pipelineMode,
};
