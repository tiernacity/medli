/**
 * Object Generator
 *
 * three.js-style API where you create a Scene and add objects to it.
 * Scene implements Generator so it can be passed directly to renderers.
 *
 * This test pattern exercises the material system:
 * - Multiple fill colors (red, green, blue)
 * - Multiple stroke colors (yellow, cyan)
 * - Multiple stroke widths (2, 4)
 * - Material parent references for style inheritance (equivalent to push/pop)
 * - Style inheritance verification
 */
import {
  Scene,
  Background,
  Circle,
  Line,
  Material,
} from "@medli/generator-object";

// Create scene as the root generator
export const generator = new Scene();

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

// Draw a red circle in top-left quadrant
const circle1 = new Circle(25, 25, 15);
circle1.material = material1;
generator.add(circle1);

// Draw diagonal lines forming an X through the circle
const line1a = new Line(10, 10, 40, 40);
line1a.material = material1;
generator.add(line1a);

const line1b = new Line(40, 10, 10, 40);
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

// Draw a green circle in top-right quadrant
const circle2 = new Circle(75, 25, 15);
circle2.material = material2;
generator.add(circle2);

// Draw horizontal and vertical lines through the circle
const line2a = new Line(60, 25, 90, 25);
line2a.material = material2;
generator.add(line2a);

const line2b = new Line(75, 10, 75, 40);
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

// Draw blue circle in bottom-left quadrant
const circle3 = new Circle(25, 75, 15);
circle3.material = material3;
generator.add(circle3);

// Draw a triangle around the circle using lines
const line3a = new Line(10, 90, 40, 90); // Bottom edge
line3a.material = material3;
generator.add(line3a);

const line3b = new Line(40, 90, 25, 60); // Right edge
line3b.material = material3;
generator.add(line3b);

const line3c = new Line(25, 60, 10, 90); // Left edge
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

// Draw green circle in bottom-right quadrant
const circle4 = new Circle(75, 75, 15);
circle4.material = material4;
generator.add(circle4);

// Draw a square around the circle using lineOffset
const line4a = Line.fromOffset(60, 60, 30, 0); // Top edge
line4a.material = material4;
generator.add(line4a);

const line4b = Line.fromOffset(90, 60, 0, 30); // Right edge
line4b.material = material4;
generator.add(line4b);

const line4c = Line.fromOffset(90, 90, -30, 0); // Bottom edge
line4c.material = material4;
generator.add(line4c);

const line4d = Line.fromOffset(60, 90, 0, -30); // Left edge
line4d.material = material4;
generator.add(line4d);

// === Section 5: Additional nested context to verify deep nesting ===
// In procedural, this is another push/pop inside the already-popped context
const material5 = new Material({
  fill: "#ff6b6b", // Coral/light red
  stroke: "#ffffff", // White stroke
  strokeWidth: 1,
});
generator.add(material5);

// Small circle in the center
const circle5 = new Circle(50, 50, 8);
circle5.material = material5;
generator.add(circle5);

// Cross through center
const line5a = new Line(42, 50, 58, 50);
line5a.material = material5;
generator.add(line5a);

const line5b = new Line(50, 42, 50, 58);
line5b.material = material5;
generator.add(line5b);

/**
 * Set the background color.
 * Consistent function API matching the procedural generator.
 */
export function background(color: string): void {
  bg.color = color;
}

// Re-export for convenience
export { Scene, Background, Circle, Line, Material };
