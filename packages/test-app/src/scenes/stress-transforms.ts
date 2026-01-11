/**
 * Stress Transforms Scene
 *
 * Stress tests deeply nested transform chains with recursive group patterns.
 *
 * URL Parameters:
 * - ?depth=N (default 5) - How many levels deep the nesting goes
 * - ?shapes=N (default 3) - How many circles at each level
 *
 * Structure (example with depth=3, shapes=2):
 * ```
 * Root Group (translate to center-ish, rotate 15deg, scale 0.9)
 *   ├── Circle 1
 *   ├── Circle 2
 *   └── Child Group (translate offset, rotate 30deg, scale 0.85)
 *         ├── Circle 1
 *         ├── Circle 2
 *         └── Child Group (translate offset, rotate 45deg, scale 0.8)
 *               ├── Circle 1
 *               └── Circle 2
 * ```
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
  Material,
  Group,
} from "@medli/generator-object";
import type { TestScene } from "./types";

// Read URL parameters
function getUrlParam(name: string, defaultValue: number): number {
  if (typeof window === "undefined") return defaultValue;
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  if (value === null) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

const depth = getUrlParam("depth", 5);
const shapesPerLevel = getUrlParam("shapes", 3);

// Color palette that cycles by depth level
const colors = [
  "#e94560", // Red
  "#f39c12", // Orange
  "#f1c40f", // Yellow
  "#2ecc71", // Green
  "#00d9ff", // Cyan
  "#4361ee", // Blue
  "#9b59b6", // Purple
  "#e91e63", // Pink
];

function getColorForDepth(level: number): string {
  return colors[level % colors.length];
}

// Shared mutable state for background color
let bgColor = "#1a1a2e";

// Background object for object generator (needs reference for updates)
const bg = new Background(bgColor);

// =============================================================================
// PROCEDURAL GENERATOR
// =============================================================================

/**
 * Procedural Generator
 *
 * Uses nested push/pop with translate, rotate, scale at each level.
 * Draws circles in a radial pattern at each nesting depth.
 */
const procedural = new ProceduralGenerator((p) => {
  p.background(bgColor);

  // Set viewport: coordinate space from -50 to +50 on both axes
  p.viewport(50, 50);

  // Recursive function to draw nested transform groups
  function drawLevel(currentDepth: number, maxDepth: number): void {
    if (currentDepth > maxDepth) return;

    const color = getColorForDepth(currentDepth);

    // Set material for this level
    p.push();
    p.fill(color);
    p.stroke("#ffffff");
    p.strokeWidth(1);

    // Draw circles in a radial pattern at this level
    // Base radius decreases with depth
    const circleRadius = Math.max(2, 8 - currentDepth * 0.8);
    const spreadRadius = Math.max(5, 15 - currentDepth * 1.5);

    for (let i = 0; i < shapesPerLevel; i++) {
      const angle = (i / shapesPerLevel) * Math.PI * 2;
      const cx = Math.cos(angle) * spreadRadius;
      const cy = Math.sin(angle) * spreadRadius;
      p.circle(cx, cy, circleRadius);
    }

    p.pop();

    // Recurse into child level with new transforms
    if (currentDepth < maxDepth) {
      p.push();

      // Apply transforms for the child group:
      // - Translate outward in a spiral pattern
      const spiralAngle = currentDepth * 0.7; // Radians offset per level
      const translateX = Math.cos(spiralAngle) * 8;
      const translateY = Math.sin(spiralAngle) * 8;
      p.translate(translateX, translateY);

      // - Rotate incrementally (15 degrees * level)
      p.rotate((currentDepth * 15 * Math.PI) / 180);

      // - Scale down progressively
      const scaleFactor = 0.75;
      p.scale(scaleFactor);

      drawLevel(currentDepth + 1, maxDepth);

      p.pop();
    }
  }

  // Start the recursive drawing from the center
  p.push();
  // Initial transform to center the pattern slightly offset
  p.translate(0, 0);
  drawLevel(0, depth - 1);
  p.pop();
});

// =============================================================================
// OBJECT GENERATOR
// =============================================================================

/**
 * Object Generator
 *
 * Uses nested Groups with position, rotation, scale properties.
 * Mirrors the procedural generator's output exactly.
 */
const object = new Scene({
  halfWidth: 50,
  halfHeight: 50,
  scaleMode: "fit",
});

// Set scene-level default material properties (root defaults)
object.fill = "#000000";
object.stroke = "#000000";
object.strokeWidth = 1;

// Attach the shared background
object.setBackground(bg);

// Create materials for each depth level
const materials: Material[] = [];
for (let i = 0; i < depth; i++) {
  const material = new Material({
    fill: getColorForDepth(i),
    stroke: "#ffffff",
    strokeWidth: 1,
  });
  object.add(material);
  materials.push(material);
}

// Recursive function to build nested groups
function buildLevel(
  currentDepth: number,
  maxDepth: number,
  _parentGroup: Group | null
): Group {
  const group = new Group();

  // Apply transforms for this level (except root which stays at origin)
  if (currentDepth > 0) {
    // Translate outward in a spiral pattern
    const spiralAngle = (currentDepth - 1) * 0.7;
    const translateX = Math.cos(spiralAngle) * 8;
    const translateY = Math.sin(spiralAngle) * 8;
    group.position = { x: translateX, y: translateY };

    // Rotate incrementally
    group.rotation = ((currentDepth - 1) * 15 * Math.PI) / 180;

    // Scale down progressively
    group.scale = 0.75;
  }

  const material = materials[currentDepth];

  // Draw circles in a radial pattern at this level
  const circleRadius = Math.max(2, 8 - currentDepth * 0.8);
  const spreadRadius = Math.max(5, 15 - currentDepth * 1.5);

  for (let i = 0; i < shapesPerLevel; i++) {
    const angle = (i / shapesPerLevel) * Math.PI * 2;
    const cx = Math.cos(angle) * spreadRadius;
    const cy = Math.sin(angle) * spreadRadius;

    const circle = new Circle(cx, cy, circleRadius);
    circle.material = material;
    group.add(circle);
  }

  // Recurse into child level
  if (currentDepth < maxDepth) {
    const childGroup = buildLevel(currentDepth + 1, maxDepth, group);
    group.add(childGroup);
  }

  return group;
}

// Build the nested structure and add to scene
const rootGroup = buildLevel(0, depth - 1, null);
object.add(rootGroup);

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
  name: "Stress Transforms",
  description: `Stress test deeply nested transform chains (depth=${depth}, shapes=${shapesPerLevel})`,
  procedural,
  object,
  setBackground,
};
