/**
 * Stress Shapes Scene
 *
 * Performance testing scene that generates a configurable number of shapes.
 * Shape count is read from URL param: ?shapes=1000 (default 100)
 *
 * Coordinate System:
 * - Origin at center (0, 0)
 * - Y-up: positive Y goes up visually
 * - Viewport: -50 to +50 on both axes (halfWidth: 50, halfHeight: 50)
 *
 * This stress test:
 * - Generates circles in a grid pattern filling the viewport
 * - Uses varying colors cycling through a palette
 * - Both generators produce identical output
 */
import { ProceduralGenerator } from "@medli/generator-procedural";
import { Scene, Background, Circle, Material } from "@medli/generator-object";
import type { TestScene } from "./types";

// Read shape count from URL param, default to 100
function getShapeCount(): number {
  if (typeof window === "undefined") return 100;
  const params = new URLSearchParams(window.location.search);
  const shapesParam = params.get("shapes");
  if (shapesParam) {
    const count = parseInt(shapesParam, 10);
    if (!isNaN(count) && count > 0) {
      return count;
    }
  }
  return 100;
}

const SHAPE_COUNT = getShapeCount();

// Color palette for cycling through
const PALETTE = [
  "#e94560", // Red
  "#0f9b0f", // Green
  "#4361ee", // Blue
  "#ffc107", // Yellow
  "#9b59b6", // Purple
  "#1abc9c", // Teal
  "#ff9800", // Orange
  "#00d9ff", // Cyan
];

// Viewport bounds
const HALF_WIDTH = 50;
const HALF_HEIGHT = 50;
const PADDING = 2; // Padding from edges

// Calculate grid dimensions based on shape count
function calculateGridDimensions(count: number): {
  cols: number;
  rows: number;
} {
  // Try to make a roughly square grid
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

// Calculate circle radius based on grid spacing
function calculateRadius(cols: number, rows: number): number {
  const usableWidth = (HALF_WIDTH - PADDING) * 2;
  const usableHeight = (HALF_HEIGHT - PADDING) * 2;
  const cellWidth = usableWidth / cols;
  const cellHeight = usableHeight / rows;
  // Radius is slightly smaller than half the cell size to leave gaps
  return Math.min(cellWidth, cellHeight) * 0.4;
}

// Shared mutable state for background color
let bgColor = "#1a1a2e";

// Background object for object generator (needs reference for updates)
const bg = new Background(bgColor);

// Get grid dimensions
const { cols, rows } = calculateGridDimensions(SHAPE_COUNT);
const radius = calculateRadius(cols, rows);

// =============================================================================
// PROCEDURAL GENERATOR
// =============================================================================

const procedural = new ProceduralGenerator((p) => {
  p.background(bgColor);

  // Set viewport: coordinate space from -50 to +50 on both axes
  p.viewport(HALF_WIDTH, HALF_HEIGHT);

  // Thin white stroke for all circles
  p.stroke("#ffffff");
  p.strokeWidth(0.5);

  // Calculate grid spacing
  const usableWidth = (HALF_WIDTH - PADDING) * 2;
  const usableHeight = (HALF_HEIGHT - PADDING) * 2;
  const cellWidth = usableWidth / cols;
  const cellHeight = usableHeight / rows;

  // Starting position (top-left of grid)
  const startX = -HALF_WIDTH + PADDING + cellWidth / 2;
  const startY = HALF_HEIGHT - PADDING - cellHeight / 2;

  let shapeIndex = 0;
  for (let row = 0; row < rows && shapeIndex < SHAPE_COUNT; row++) {
    for (let col = 0; col < cols && shapeIndex < SHAPE_COUNT; col++) {
      // Calculate position
      const x = startX + col * cellWidth;
      const y = startY - row * cellHeight;

      // Cycle through palette colors
      const color = PALETTE[shapeIndex % PALETTE.length];
      p.fill(color);

      // Draw circle
      p.circle(x, y, radius);

      shapeIndex++;
    }
  }
});

// =============================================================================
// OBJECT GENERATOR
// =============================================================================

const object = new Scene({
  halfWidth: HALF_WIDTH,
  halfHeight: HALF_HEIGHT,
  scaleMode: "fit",
});

// Set scene-level default material properties (root defaults)
object.fill = "#000000";
object.stroke = "#000000";
object.strokeWidth = 1;

// Attach the shared background
object.setBackground(bg);

// Create materials for each palette color
const materials = PALETTE.map(
  (color) =>
    new Material({
      fill: color,
      stroke: "#ffffff",
      strokeWidth: 0.5,
    })
);

// Add all materials to scene
materials.forEach((material) => object.add(material));

// Calculate grid spacing
const usableWidth = (HALF_WIDTH - PADDING) * 2;
const usableHeight = (HALF_HEIGHT - PADDING) * 2;
const cellWidth = usableWidth / cols;
const cellHeight = usableHeight / rows;

// Starting position (top-left of grid)
const startX = -HALF_WIDTH + PADDING + cellWidth / 2;
const startY = HALF_HEIGHT - PADDING - cellHeight / 2;

// Generate circles in grid
let shapeIndex = 0;
for (let row = 0; row < rows && shapeIndex < SHAPE_COUNT; row++) {
  for (let col = 0; col < cols && shapeIndex < SHAPE_COUNT; col++) {
    // Calculate position
    const x = startX + col * cellWidth;
    const y = startY - row * cellHeight;

    // Create circle with appropriate material
    const circle = new Circle(x, y, radius);
    circle.material = materials[shapeIndex % PALETTE.length];
    object.add(circle);

    shapeIndex++;
  }
}

// =============================================================================
// SET BACKGROUND FUNCTION
// =============================================================================

/**
 * Set the background color for both generators.
 * Updates the shared bgColor state and the Background object.
 */
function setBackground(color: string): void {
  bgColor = color;
  bg.color = color;
}

// =============================================================================
// SCENE EXPORT
// =============================================================================

export const scene: TestScene = {
  name: "Stress Shapes",
  description: `Performance stress test with ${SHAPE_COUNT} circles in a grid (use ?shapes=N to configure)`,
  procedural,
  object,
  setBackground,
};
