/**
 * Transforms Scene
 *
 * Tests translate, rotate, scale, and combined transforms.
 * Extracted from full-demo.ts sections 5-9.
 *
 * Coordinate System:
 * - Origin at center (0, 0)
 * - Y-up: positive Y goes up visually
 * - Viewport: -50 to +50 on both axes (halfWidth: 50, halfHeight: 50)
 *
 * Test Layout:
 * - Section 5: Center (0, 0) - baseline coral cross, no transform
 * - Section 6: Top-left (-35, 35) - purple circle with translate
 * - Section 7: Top-right (25, 25) - orange diagonal with rotate
 * - Section 8: Bottom-right (35, -35) - teal circle with scale
 * - Section 9: Bottom-left (-35, -35) - red cross with translate + rotate
 */
import { ProceduralGenerator } from "@medli/generator-procedural";
import {
  Scene,
  Background,
  Circle,
  Line,
  Material,
  Group,
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

  // === Section 5: Transform demonstration ===
  // Draw a shape at center, then use transforms to draw rotated copies
  p.push();
  p.fill("#ff6b6b"); // Coral/light red
  p.stroke("#ffffff"); // White stroke
  p.strokeWidth(1);

  // Original small circle at the center (no transform)
  p.circle(0, 0, 8);

  // Cross through center (no transform)
  p.line(-8, 0, 8, 0);
  p.line(0, 8, 0, -8);

  p.pop();

  // === Section 6: Translate transform ===
  // Draw a shape translated from origin
  p.push();
  p.fill("#9b59b6"); // Purple
  p.stroke("#ffffff"); // White stroke
  p.strokeWidth(1);

  // Translate to position (-35, 35) and draw a small circle at origin
  // Visual result: circle appears in top-left area
  p.translate(-35, 35);
  p.circle(0, 0, 5);

  p.pop();

  // === Section 7: Rotate transform ===
  // Draw a rotated line pattern
  p.push();
  p.fill("#f39c12"); // Orange
  p.stroke("#f39c12"); // Orange stroke
  p.strokeWidth(2);

  // Translate to center of top-right area (25, 25), rotate 45 degrees, draw line
  // The line is drawn from (-8,-8) to (8,8) in local space
  // After rotation: appears as diagonal line
  p.translate(25, 25);
  p.rotate(Math.PI / 4); // 45 degrees
  p.line(-8, -8, 8, 8); // Diagonal in local space becomes different diagonal after rotation

  p.pop();

  // === Section 8: Scale transform ===
  // Draw a scaled circle
  p.push();
  p.fill("#1abc9c"); // Teal
  p.stroke("#ffffff"); // White stroke
  p.strokeWidth(1);

  // Translate to bottom-right area (35, -35), scale by 0.5, draw a circle
  // Circle of radius 10 at origin appears as radius 5 circle
  p.translate(35, -35);
  p.scale(0.5);
  p.circle(0, 0, 10); // Appears as radius 5

  p.pop();

  // === Section 9: Combined transforms (translate + rotate) ===
  // Draw a rotated shape at a specific position
  p.push();
  p.fill("#e74c3c"); // Red
  p.stroke("#ffffff"); // White stroke
  p.strokeWidth(1);

  // Position at (-35, -35) (bottom-left area), rotate 30 degrees, draw cross
  // This tests transform composition
  p.translate(-35, -35);
  p.rotate(Math.PI / 6); // 30 degrees

  // Draw a small cross at local origin
  p.line(-5, 0, 5, 0);
  p.line(0, -5, 0, 5);

  p.pop();
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

// === Section 5: Transform demonstration ===
// Draw a shape at center (no transform, matches procedural section 5)
const material5 = new Material({
  fill: "#ff6b6b", // Coral/light red
  stroke: "#ffffff", // White stroke
  strokeWidth: 1,
});
object.add(material5);

// Small circle at the center (no transform)
const circle5 = new Circle(0, 0, 8);
circle5.material = material5;
object.add(circle5);

// Cross through center (no transform)
const line5a = new Line(-8, 0, 8, 0);
line5a.material = material5;
object.add(line5a);

const line5b = new Line(0, 8, 0, -8);
line5b.material = material5;
object.add(line5b);

// === Section 6: Translate transform ===
// Draw a shape translated from origin using shape's position property
const material6 = new Material({
  fill: "#9b59b6", // Purple
  stroke: "#ffffff", // White stroke
  strokeWidth: 1,
});
object.add(material6);

// Circle at (0, 0) with position (-35, 35)
// Visual result: circle appears in top-left area
const circle6 = new Circle(0, 0, 5);
circle6.position = { x: -35, y: 35 };
circle6.material = material6;
object.add(circle6);

// === Section 7: Rotate transform ===
// Draw a rotated line using shape's transform properties
const material7 = new Material({
  fill: "#f39c12", // Orange
  stroke: "#f39c12", // Orange stroke
  strokeWidth: 2,
});
object.add(material7);

// Line from (-8,-8) to (8,8) in local space, positioned at (25, 25), rotated 45 degrees
// After rotation: appears as different diagonal
const line7 = new Line(-8, -8, 8, 8);
line7.position = { x: 25, y: 25 };
line7.rotation = Math.PI / 4; // 45 degrees
line7.material = material7;
object.add(line7);

// === Section 8: Scale transform ===
// Draw a scaled circle using shape's transform properties
const material8 = new Material({
  fill: "#1abc9c", // Teal
  stroke: "#ffffff", // White stroke
  strokeWidth: 1,
});
object.add(material8);

// Circle of radius 10 at origin, positioned at (35, -35), scaled by 0.5
// Visual result: circle appears with radius 5 in bottom-right area
const circle8 = new Circle(0, 0, 10);
circle8.position = { x: 35, y: -35 };
circle8.scale = 0.5;
circle8.material = material8;
object.add(circle8);

// === Section 9: Combined transforms (translate + rotate) ===
// Draw a rotated cross at a specific position using Group (demonstrates collective transforms)
const material9 = new Material({
  fill: "#e74c3c", // Red
  stroke: "#ffffff", // White stroke
  strokeWidth: 1,
});
object.add(material9);

// Group at (-35, -35) (bottom-left area), rotated 30 degrees, containing a cross made of two lines
// This demonstrates using Group for collective transforms on multiple shapes
// Groups don't have materials - shapes reference materials directly
const group9 = new Group();
group9.position = { x: -35, y: -35 };
group9.rotation = Math.PI / 6; // 30 degrees
const line9a = new Line(-5, 0, 5, 0);
line9a.material = material9;
const line9b = new Line(0, -5, 0, 5);
line9b.material = material9;
group9.add(line9a);
group9.add(line9b);
object.add(group9);

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
  name: "Transforms",
  description: "Tests translate, rotate, scale, and combined transforms",
  procedural,
  object,
  setBackground,
};
