/**
 * Transparency Demo Scene
 *
 * Tests transparency on fill and stroke colors using rgba() CSS strings.
 * Uses overlapping shapes to visually verify alpha blending works correctly.
 *
 * Coordinate System:
 * - Origin at center (0, 0)
 * - Y-up: positive Y goes up visually
 * - Viewport: -50 to +50 on both axes (halfWidth: 50, halfHeight: 50)
 *
 * This test pattern exercises:
 * - Transparent fills on circles and rectangles
 * - Transparent strokes on lines, rectangles, and circles
 * - Alpha blending with overlapping shapes
 * - All shape types: circle, rectangle, line
 */
import { ProceduralGenerator } from "@medli/generator-procedural";
import {
  Scene,
  Background,
  Circle,
  Rectangle,
  Line,
  Material,
} from "@medli/generator-object";
import type { TestScene } from "./types";

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
 * p5.js-style API where you define a draw function that runs each frame.
 */
const procedural = new ProceduralGenerator((p) => {
  p.background(bgColor);

  // Set viewport: coordinate space from -50 to +50 on both axes
  p.viewport(50, 50);

  // === Section 1: Three overlapping circles with transparent fills ===
  // These circles overlap in the center to show alpha blending
  p.strokeWidth(2);
  p.stroke("rgba(0, 0, 0, 0.8)"); // Dark semi-transparent stroke

  // Red circle (left)
  p.fill("rgba(255, 0, 0, 0.5)"); // 50% red
  p.circle(-15, 20, 20);

  // Green circle (right)
  p.fill("rgba(0, 255, 0, 0.5)"); // 50% green
  p.circle(15, 20, 20);

  // Blue circle (top center, overlapping both)
  p.fill("rgba(0, 0, 255, 0.5)"); // 50% blue
  p.circle(0, 35, 20);

  // === Section 2: Two overlapping rectangles with transparent fills AND strokes ===
  // Orange rectangle (left)
  p.fill("rgba(255, 165, 0, 0.5)"); // 50% orange
  p.stroke("rgba(255, 255, 255, 0.7)"); // 70% white stroke
  p.strokeWidth(3);
  p.rectangle(-20, -20, 30, 25);

  // Purple rectangle (right, overlapping)
  p.fill("rgba(128, 0, 128, 0.5)"); // 50% purple
  p.stroke("rgba(255, 255, 0, 0.7)"); // 70% yellow stroke
  p.rectangle(5, -25, 30, 25);

  // === Section 3: Lines with transparent strokes crossing over shapes ===
  // These lines cross over the shapes to show stroke alpha blending
  p.strokeWidth(4);

  // Cyan line (diagonal across circles)
  p.stroke("rgba(0, 255, 255, 0.6)"); // 60% cyan
  p.line(-45, 45, 45, 5);

  // Magenta line (diagonal across rectangles)
  p.stroke("rgba(255, 0, 255, 0.6)"); // 60% magenta
  p.line(-45, -5, 45, -45);

  // White line (horizontal through middle)
  p.stroke("rgba(255, 255, 255, 0.4)"); // 40% white
  p.line(-45, 0, 45, 0);
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

// Set scene-level default material properties (root defaults)
object.fill = "#000000";
object.stroke = "#000000";
object.strokeWidth = 1;

// Attach the shared background
object.setBackground(bg);

// === Section 1: Three overlapping circles with transparent fills ===
// Material for circles with semi-transparent fills and dark stroke
const materialCircleBase = new Material({
  stroke: "rgba(0, 0, 0, 0.8)", // Dark semi-transparent stroke
  strokeWidth: 2,
});
object.add(materialCircleBase);

// Red circle (left)
const materialRed = new Material({
  fill: "rgba(255, 0, 0, 0.5)", // 50% red
  stroke: "rgba(0, 0, 0, 0.8)",
  strokeWidth: 2,
});
object.add(materialRed);
const circleRed = new Circle(-15, 20, 20);
circleRed.material = materialRed;
object.add(circleRed);

// Green circle (right)
const materialGreen = new Material({
  fill: "rgba(0, 255, 0, 0.5)", // 50% green
  stroke: "rgba(0, 0, 0, 0.8)",
  strokeWidth: 2,
});
object.add(materialGreen);
const circleGreen = new Circle(15, 20, 20);
circleGreen.material = materialGreen;
object.add(circleGreen);

// Blue circle (top center, overlapping both)
const materialBlue = new Material({
  fill: "rgba(0, 0, 255, 0.5)", // 50% blue
  stroke: "rgba(0, 0, 0, 0.8)",
  strokeWidth: 2,
});
object.add(materialBlue);
const circleBlue = new Circle(0, 35, 20);
circleBlue.material = materialBlue;
object.add(circleBlue);

// === Section 2: Two overlapping rectangles with transparent fills AND strokes ===
// Orange rectangle (left)
const materialOrange = new Material({
  fill: "rgba(255, 165, 0, 0.5)", // 50% orange
  stroke: "rgba(255, 255, 255, 0.7)", // 70% white stroke
  strokeWidth: 3,
});
object.add(materialOrange);
const rectOrange = new Rectangle(-20, -20, 30, 25);
rectOrange.material = materialOrange;
object.add(rectOrange);

// Purple rectangle (right, overlapping)
const materialPurple = new Material({
  fill: "rgba(128, 0, 128, 0.5)", // 50% purple
  stroke: "rgba(255, 255, 0, 0.7)", // 70% yellow stroke
  strokeWidth: 3,
});
object.add(materialPurple);
const rectPurple = new Rectangle(5, -25, 30, 25);
rectPurple.material = materialPurple;
object.add(rectPurple);

// === Section 3: Lines with transparent strokes crossing over shapes ===
// Cyan line (diagonal across circles)
const materialCyan = new Material({
  stroke: "rgba(0, 255, 255, 0.6)", // 60% cyan
  strokeWidth: 4,
});
object.add(materialCyan);
const lineCyan = new Line(-45, 45, 45, 5);
lineCyan.material = materialCyan;
object.add(lineCyan);

// Magenta line (diagonal across rectangles)
const materialMagenta = new Material({
  stroke: "rgba(255, 0, 255, 0.6)", // 60% magenta
  strokeWidth: 4,
});
object.add(materialMagenta);
const lineMagenta = new Line(-45, -5, 45, -45);
lineMagenta.material = materialMagenta;
object.add(lineMagenta);

// White line (horizontal through middle)
const materialWhite = new Material({
  stroke: "rgba(255, 255, 255, 0.4)", // 40% white
  strokeWidth: 4,
});
object.add(materialWhite);
const lineWhite = new Line(-45, 0, 45, 0);
lineWhite.material = materialWhite;
object.add(lineWhite);

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
  name: "Transparency",
  description:
    "Tests transparency on fill and stroke colors with overlapping shapes",
  procedural,
  object,
  setBackground,
};
