/**
 * Procedural Generator
 *
 * p5.js-style API where you define a draw function that runs each frame.
 * The draw function receives a sketch context with procedural functions.
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
 * - Material system (fill, stroke, strokeWidth, push/pop)
 * - Transform system (translate, rotate, scale)
 * - Composition of transforms with push/pop state management
 */
import { ProceduralGenerator } from "@medli/generator-procedural";

// Mutable state that the draw function will read
let currentColor = "#1a1a2e";

// Create generator with a draw function that exercises material and transform features
export const generator = new ProceduralGenerator((p) => {
  p.background(currentColor);

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

  // === Section 10: Image rendering test ===
  // Draw a test image in the lower-left corner area
  // The image is 32x32 pixels, we'll render it at 20x20 viewport units
  p.image("/test-img.png", -45, -45, 20, 20);
});

/**
 * Set the background color (p5.js-style function call).
 * This updates the color that will be used on the next frame.
 */
export function background(color: string): void {
  currentColor = color;
}
