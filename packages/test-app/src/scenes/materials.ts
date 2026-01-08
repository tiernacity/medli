/**
 * Materials Scene
 *
 * Tests the material system: fill, stroke, strokeWidth, and push/pop style management.
 * Both generators share the same bgColor state for synchronized background updates.
 *
 * Coordinate System:
 * - Origin at center (0, 0)
 * - Y-up: positive Y goes up visually
 * - Viewport: -50 to +50 on both axes (halfWidth: 50, halfHeight: 50)
 *
 * Quadrant reference (Y-up):
 * - Top-left: x < 0, y > 0
 * - Top-right: x > 0, y > 0
 * - Bottom-left: x < 0, y < 0
 * - Bottom-right: x > 0, y < 0
 *
 * This test pattern exercises:
 * - Section 1: Red fills with yellow stroke (top-left quadrant)
 * - Section 2: Green fills with cyan stroke (top-right quadrant)
 * - Section 3: Push/pop for isolated blue context (bottom-left quadrant)
 * - Section 4: Verify restored style - green/cyan (bottom-right quadrant)
 */
import { ProceduralGenerator } from "@medli/generator-procedural";
import {
  Scene,
  Background,
  Circle,
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
 * The draw function receives a sketch context with procedural functions.
 */
const procedural = new ProceduralGenerator((p) => {
  p.background(bgColor);

  // Set viewport: coordinate space from -50 to +50 on both axes
  p.viewport(50, 50);

  // === Section 1: Red fills with yellow stroke ===
  // Set initial style - thick yellow stroke, red fill
  p.fill("#e94560"); // Red
  p.stroke("#ffc107"); // Yellow
  p.strokeWidth(2);

  // Draw a red circle in top-left quadrant (x < 0, y > 0)
  p.circle(-25, 25, 15);

  // Draw diagonal lines forming an X through the circle
  p.line(-40, 40, -10, 10);
  p.line(-10, 40, -40, 10);

  // === Section 2: Green fills with cyan stroke ===
  // Change to green fill, cyan stroke
  p.fill("#0f9b0f"); // Green
  p.stroke("#00d9ff"); // Cyan
  p.strokeWidth(4); // Thicker stroke

  // Draw a green circle in top-right quadrant (x > 0, y > 0)
  p.circle(25, 25, 15);

  // Draw horizontal and vertical lines through the circle
  p.line(10, 25, 40, 25);
  p.line(25, 40, 25, 10);

  // === Section 3: Push/pop for isolated blue context ===
  // Save current style (green fill, cyan stroke, width 4)
  p.push();

  // Change to blue fill in nested context
  p.fill("#4361ee"); // Blue
  p.stroke("#ffc107"); // Back to yellow stroke
  p.strokeWidth(2); // Thinner stroke

  // Draw blue circle in bottom-left quadrant (x < 0, y < 0)
  p.circle(-25, -25, 15);

  // Draw a triangle around the circle using lines
  p.line(-40, -40, -10, -40); // Bottom edge
  p.line(-10, -40, -25, -10); // Right edge
  p.line(-25, -10, -40, -40); // Left edge

  // Pop restores green fill, cyan stroke, width 4
  p.pop();

  // === Section 4: Verify restored style (green/cyan) ===
  // Should be back to green fill, cyan stroke, width 4

  // Draw green circle in bottom-right quadrant (x > 0, y < 0)
  p.circle(25, -25, 15);

  // Draw a square around the circle using lineOffset
  p.lineOffset(10, -10, 30, 0); // Top edge
  p.lineOffset(40, -10, 0, -30); // Right edge
  p.lineOffset(40, -40, -30, 0); // Bottom edge
  p.lineOffset(10, -40, 0, 30); // Left edge
});

// =============================================================================
// OBJECT GENERATOR
// =============================================================================

/**
 * Object Generator
 *
 * three.js-style API where you create a Scene and add objects to it.
 * Scene implements Generator so it can be passed directly to renderers.
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

// === Section 1: Red fills with yellow stroke ===
// Material for red circle + X pattern with yellow stroke, width 2
const material1 = new Material({
  fill: "#e94560", // Red
  stroke: "#ffc107", // Yellow
  strokeWidth: 2,
});
object.add(material1);

// Draw a red circle in top-left quadrant (x < 0, y > 0)
const circle1 = new Circle(-25, 25, 15);
circle1.material = material1;
object.add(circle1);

// Draw diagonal lines forming an X through the circle
const line1a = new Line(-40, 40, -10, 10);
line1a.material = material1;
object.add(line1a);

const line1b = new Line(-10, 40, -40, 10);
line1b.material = material1;
object.add(line1b);

// === Section 2: Green fills with cyan stroke ===
// Material for green circle + cross pattern with cyan stroke, width 4
const material2 = new Material({
  fill: "#0f9b0f", // Green
  stroke: "#00d9ff", // Cyan
  strokeWidth: 4,
});
object.add(material2);

// Draw a green circle in top-right quadrant (x > 0, y > 0)
const circle2 = new Circle(25, 25, 15);
circle2.material = material2;
object.add(circle2);

// Draw horizontal and vertical lines through the circle
const line2a = new Line(10, 25, 40, 25);
line2a.material = material2;
object.add(line2a);

const line2b = new Line(25, 40, 25, 10);
line2b.material = material2;
object.add(line2b);

// === Section 3: Push/pop for isolated blue context ===
// In procedural: push() saves green/cyan/4, then changes to blue/yellow/2
// In object API: create a new material that overrides everything
const material3 = new Material({
  fill: "#4361ee", // Blue
  stroke: "#ffc107", // Yellow
  strokeWidth: 2,
});
object.add(material3);

// Draw blue circle in bottom-left quadrant (x < 0, y < 0)
const circle3 = new Circle(-25, -25, 15);
circle3.material = material3;
object.add(circle3);

// Draw a triangle around the circle using lines
const line3a = new Line(-40, -40, -10, -40); // Bottom edge
line3a.material = material3;
object.add(line3a);

const line3b = new Line(-10, -40, -25, -10); // Right edge
line3b.material = material3;
object.add(line3b);

const line3c = new Line(-25, -10, -40, -40); // Left edge
line3c.material = material3;
object.add(line3c);

// === Section 4: Verify restored style (green/cyan) ===
// After pop() in procedural, it's back to green fill, cyan stroke, width 4
// In object API, we create another material with those same styles
const material4 = new Material({
  fill: "#0f9b0f", // Green (restored)
  stroke: "#00d9ff", // Cyan (restored)
  strokeWidth: 4, // Width 4 (restored)
});
object.add(material4);

// Draw green circle in bottom-right quadrant (x > 0, y < 0)
const circle4 = new Circle(25, -25, 15);
circle4.material = material4;
object.add(circle4);

// Draw a square around the circle using lineOffset
const line4a = Line.fromOffset(10, -10, 30, 0); // Top edge
line4a.material = material4;
object.add(line4a);

const line4b = Line.fromOffset(40, -10, 0, -30); // Right edge
line4b.material = material4;
object.add(line4b);

const line4c = Line.fromOffset(40, -40, -30, 0); // Bottom edge
line4c.material = material4;
object.add(line4c);

const line4d = Line.fromOffset(10, -40, 0, 30); // Left edge
line4d.material = material4;
object.add(line4d);

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
  name: "Materials",
  description: "Tests fill, stroke, strokeWidth, and push/pop style management",
  procedural,
  object,
  setBackground,
};
