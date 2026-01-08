/**
 * Object Generator
 *
 * three.js-style API where you create a Scene and add objects to it.
 * Scene implements Generator so it can be passed directly to renderers.
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
 * - Material system (fill, stroke, strokeWidth, parent references)
 * - Transform system (shapes have position, rotation, scale directly)
 * - Group for collective transforms on multiple shapes (Groups have NO material)
 */
import {
  Scene,
  Background,
  Circle,
  Line,
  Material,
  Group,
} from "@medli/generator-object";

// Create scene as the root generator with viewport settings
export const generator = new Scene({
  halfWidth: 50,
  halfHeight: 50,
  scaleMode: "fit",
});

// Set scene-level default material properties (root defaults)
generator.fill = "#000000";
generator.stroke = "#000000";
generator.strokeWidth = 1;

// Create and attach a background
const bg = new Background("#1a1a2e");
generator.setBackground(bg);

// === Section 1: Red fills with yellow stroke ===
// Material for red circle + X pattern with yellow stroke, width 2
const material1 = new Material({
  fill: "#e94560", // Red
  stroke: "#ffc107", // Yellow
  strokeWidth: 2,
});
generator.add(material1);

// Draw a red circle in top-left quadrant (x < 0, y > 0)
const circle1 = new Circle(-25, 25, 15);
circle1.material = material1;
generator.add(circle1);

// Draw diagonal lines forming an X through the circle
const line1a = new Line(-40, 40, -10, 10);
line1a.material = material1;
generator.add(line1a);

const line1b = new Line(-10, 40, -40, 10);
line1b.material = material1;
generator.add(line1b);

// === Section 2: Green fills with cyan stroke ===
// Material for green circle + cross pattern with cyan stroke, width 4
const material2 = new Material({
  fill: "#0f9b0f", // Green
  stroke: "#00d9ff", // Cyan
  strokeWidth: 4,
});
generator.add(material2);

// Draw a green circle in top-right quadrant (x > 0, y > 0)
const circle2 = new Circle(25, 25, 15);
circle2.material = material2;
generator.add(circle2);

// Draw horizontal and vertical lines through the circle
const line2a = new Line(10, 25, 40, 25);
line2a.material = material2;
generator.add(line2a);

const line2b = new Line(25, 40, 25, 10);
line2b.material = material2;
generator.add(line2b);

// === Section 3: Push/pop for isolated blue context ===
// In procedural: push() saves green/cyan/4, then changes to blue/yellow/2
// In object API: create a new material that overrides everything
const material3 = new Material({
  fill: "#4361ee", // Blue
  stroke: "#ffc107", // Yellow
  strokeWidth: 2,
});
generator.add(material3);

// Draw blue circle in bottom-left quadrant (x < 0, y < 0)
const circle3 = new Circle(-25, -25, 15);
circle3.material = material3;
generator.add(circle3);

// Draw a triangle around the circle using lines
const line3a = new Line(-40, -40, -10, -40); // Bottom edge
line3a.material = material3;
generator.add(line3a);

const line3b = new Line(-10, -40, -25, -10); // Right edge
line3b.material = material3;
generator.add(line3b);

const line3c = new Line(-25, -10, -40, -40); // Left edge
line3c.material = material3;
generator.add(line3c);

// === Section 4: Verify restored style (green/cyan) ===
// After pop() in procedural, it's back to green fill, cyan stroke, width 4
// In object API, we create another material with those same styles
const material4 = new Material({
  fill: "#0f9b0f", // Green (restored)
  stroke: "#00d9ff", // Cyan (restored)
  strokeWidth: 4, // Width 4 (restored)
});
generator.add(material4);

// Draw green circle in bottom-right quadrant (x > 0, y < 0)
const circle4 = new Circle(25, -25, 15);
circle4.material = material4;
generator.add(circle4);

// Draw a square around the circle using lineOffset
const line4a = Line.fromOffset(10, -10, 30, 0); // Top edge
line4a.material = material4;
generator.add(line4a);

const line4b = Line.fromOffset(40, -10, 0, -30); // Right edge
line4b.material = material4;
generator.add(line4b);

const line4c = Line.fromOffset(40, -40, -30, 0); // Bottom edge
line4c.material = material4;
generator.add(line4c);

const line4d = Line.fromOffset(10, -40, 0, 30); // Left edge
line4d.material = material4;
generator.add(line4d);

// === Section 5: Transform demonstration ===
// Draw a shape at center (no transform, matches procedural section 5)
const material5 = new Material({
  fill: "#ff6b6b", // Coral/light red
  stroke: "#ffffff", // White stroke
  strokeWidth: 1,
});
generator.add(material5);

// Small circle at the center (no transform)
const circle5 = new Circle(0, 0, 8);
circle5.material = material5;
generator.add(circle5);

// Cross through center (no transform)
const line5a = new Line(-8, 0, 8, 0);
line5a.material = material5;
generator.add(line5a);

const line5b = new Line(0, 8, 0, -8);
line5b.material = material5;
generator.add(line5b);

// === Section 6: Translate transform ===
// Draw a shape translated from origin using shape's position property
const material6 = new Material({
  fill: "#9b59b6", // Purple
  stroke: "#ffffff", // White stroke
  strokeWidth: 1,
});
generator.add(material6);

// Circle at (0, 0) with position (-35, 35)
// Visual result: circle appears in top-left area
const circle6 = new Circle(0, 0, 5);
circle6.position = { x: -35, y: 35 };
circle6.material = material6;
generator.add(circle6);

// === Section 7: Rotate transform ===
// Draw a rotated line using shape's transform properties
const material7 = new Material({
  fill: "#f39c12", // Orange
  stroke: "#f39c12", // Orange stroke
  strokeWidth: 2,
});
generator.add(material7);

// Line from (-8,-8) to (8,8) in local space, positioned at (25, 25), rotated 45 degrees
// After rotation: appears as different diagonal
const line7 = new Line(-8, -8, 8, 8);
line7.position = { x: 25, y: 25 };
line7.rotation = Math.PI / 4; // 45 degrees
line7.material = material7;
generator.add(line7);

// === Section 8: Scale transform ===
// Draw a scaled circle using shape's transform properties
const material8 = new Material({
  fill: "#1abc9c", // Teal
  stroke: "#ffffff", // White stroke
  strokeWidth: 1,
});
generator.add(material8);

// Circle of radius 10 at origin, positioned at (35, -35), scaled by 0.5
// Visual result: circle appears with radius 5 in bottom-right area
const circle8 = new Circle(0, 0, 10);
circle8.position = { x: 35, y: -35 };
circle8.scale = 0.5;
circle8.material = material8;
generator.add(circle8);

// === Section 9: Combined transforms (translate + rotate) ===
// Draw a rotated cross at a specific position using Group (demonstrates collective transforms)
const material9 = new Material({
  fill: "#e74c3c", // Red
  stroke: "#ffffff", // White stroke
  strokeWidth: 1,
});
generator.add(material9);

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
generator.add(group9);

/**
 * Set the background color.
 * Consistent function API matching the procedural generator.
 */
export function background(color: string): void {
  bg.color = color;
}

// Re-export for convenience
export { Scene, Background, Circle, Line, Material };
