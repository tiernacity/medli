/**
 * Stress Batch Scene
 *
 * Tests WebGL batching efficiency by creating patterns of shapes that
 * force frequent shape type switches (worst-case for batching).
 *
 * Shape count is configurable via URL param: ?shapes=500 (default 100)
 *
 * Pattern:
 * - Shapes are drawn in horizontal "stripes" alternating between circles and rectangles
 * - Each shape gets a unique fill color (cycling through a palette)
 * - All shapes share a consistent stroke (black, width 1)
 * - This tests whether batching can still optimize by grouping on other properties
 *
 * Coordinate System:
 * - Origin at center (0, 0)
 * - Y-up: positive Y goes up visually
 * - Viewport: -50 to +50 on both axes (halfWidth: 50, halfHeight: 50)
 */
import { ProceduralGenerator } from "@medli/generator-procedural";
import {
  Scene,
  Background,
  Circle,
  Rectangle,
  Material,
} from "@medli/generator-object";
import type { TestScene } from "./types";

// Read shape count from URL parameters
function getShapeCount(): number {
  if (typeof window === "undefined") return 100;
  const params = new URLSearchParams(window.location.search);
  const shapesParam = params.get("shapes");
  if (shapesParam) {
    const parsed = parseInt(shapesParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 100; // Default
}

// Color palette for varying fill colors
const FILL_COLORS = [
  "#e94560", // Red
  "#ff9800", // Orange
  "#ffc107", // Yellow
  "#4caf50", // Green
  "#00bcd4", // Cyan
  "#2196f3", // Blue
  "#9c27b0", // Purple
  "#e91e63", // Pink
];

// Consistent stroke for all shapes
const STROKE_COLOR = "#000000";
const STROKE_WIDTH = 1;

// Shared mutable state for background color
let bgColor = "#f5f5f5";

// Background object for object generator (needs reference for updates)
const bg = new Background(bgColor);

// Shape size
const SHAPE_SIZE = 6;

// =============================================================================
// CALCULATE SHAPE POSITIONS
// =============================================================================

/**
 * Calculate positions for shapes in a grid pattern.
 * Returns array of { x, y, colorIndex, isCircle } objects.
 */
function calculateShapePositions(shapeCount: number) {
  const positions: Array<{
    x: number;
    y: number;
    colorIndex: number;
    isCircle: boolean;
  }> = [];

  // Calculate grid dimensions to fit shapes in viewport
  const margin = 5;
  const viewportSize = 100 - margin * 2; // -50 to +50, minus margins
  const spacing = SHAPE_SIZE * 1.5;

  const cols = Math.floor(viewportSize / spacing);
  const rows = Math.ceil(shapeCount / cols);

  // Center the grid
  const gridWidth = (cols - 1) * spacing;
  const gridHeight = (rows - 1) * spacing;
  const startX = -gridWidth / 2;
  const startY = gridHeight / 2; // Start from top (Y-up coordinate system)

  for (let i = 0; i < shapeCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const x = startX + col * spacing;
    const y = startY - row * spacing; // Y decreases as row increases (Y-up)

    // Alternate shape type by row (creates horizontal stripes)
    const isCircle = row % 2 === 0;

    // Cycle through fill colors
    const colorIndex = i % FILL_COLORS.length;

    positions.push({ x, y, colorIndex, isCircle });
  }

  return positions;
}

// =============================================================================
// PROCEDURAL GENERATOR
// =============================================================================

/**
 * Procedural Generator
 *
 * p5.js-style API where you define a draw function that runs each frame.
 */
const procedural = new ProceduralGenerator((p) => {
  p.background(bgColor);

  // Set viewport: coordinate space from -50 to +50 on both axes
  p.viewport(50, 50);

  // Get shape count and positions
  const shapeCount = getShapeCount();
  const positions = calculateShapePositions(shapeCount);

  // Set consistent stroke for all shapes
  p.stroke(STROKE_COLOR);
  p.strokeWidth(STROKE_WIDTH);

  // Draw shapes in stripes (alternating circles and rectangles by row)
  // This creates worst-case batching scenario: constant shape type switches
  for (const pos of positions) {
    // Set fill color (varies per shape)
    p.fill(FILL_COLORS[pos.colorIndex]);

    if (pos.isCircle) {
      p.circle(pos.x, pos.y, SHAPE_SIZE / 2);
    } else {
      p.rectangle(pos.x, pos.y, SHAPE_SIZE, SHAPE_SIZE);
    }
  }
});

// =============================================================================
// OBJECT GENERATOR
// =============================================================================

/**
 * Object Generator
 *
 * three.js-style API where you create a Scene and add objects to it.
 */
const object = new Scene({
  halfWidth: 50,
  halfHeight: 50,
  scaleMode: "fit",
});

// Set scene-level default material properties
object.fill = "#000000";
object.stroke = STROKE_COLOR;
object.strokeWidth = STROKE_WIDTH;

// Attach the shared background
object.setBackground(bg);

// Create materials for each fill color (all share same stroke)
const materials = FILL_COLORS.map(
  (fill) =>
    new Material({
      fill,
      stroke: STROKE_COLOR,
      strokeWidth: STROKE_WIDTH,
    })
);

// Add all materials to scene
for (const mat of materials) {
  object.add(mat);
}

// Get shape count and positions
const shapeCount = getShapeCount();
const positions = calculateShapePositions(shapeCount);

// Draw shapes in stripes (alternating circles and rectangles by row)
for (const pos of positions) {
  const material = materials[pos.colorIndex];

  if (pos.isCircle) {
    const circle = new Circle(pos.x, pos.y, SHAPE_SIZE / 2);
    circle.material = material;
    object.add(circle);
  } else {
    const rect = new Rectangle(pos.x, pos.y, SHAPE_SIZE, SHAPE_SIZE);
    rect.material = material;
    object.add(rect);
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
  name: "Stress Batch",
  description:
    "Tests WebGL batching efficiency with alternating shape types (worst-case for batching)",
  procedural,
  object,
  setBackground,
};
