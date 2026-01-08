/**
 * Procedural Generator
 *
 * p5.js-style API where you define a draw function that runs each frame.
 * The draw function receives a sketch context with procedural functions.
 *
 * This test pattern exercises the material system:
 * - Multiple fill colors (red, green, blue)
 * - Multiple stroke colors (yellow, cyan)
 * - Multiple stroke widths (2, 4)
 * - push/pop nesting for style isolation
 * - Style inheritance verification
 */
import { ProceduralGenerator } from "@medli/generator-procedural";

// Mutable state that the draw function will read
let currentColor = "#1a1a2e";

// Create generator with a draw function that exercises material features
export const generator = new ProceduralGenerator((p) => {
  p.background(currentColor);

  // === Section 1: Red fills with yellow stroke ===
  // Set initial style - thick yellow stroke, red fill
  p.fill("#e94560"); // Red
  p.stroke("#ffc107"); // Yellow
  p.strokeWidth(2);

  // Draw a red circle in top-left quadrant
  p.circle(25, 25, 15);

  // Draw diagonal lines forming an X through the circle
  p.line(10, 10, 40, 40);
  p.line(40, 10, 10, 40);

  // === Section 2: Green fills with cyan stroke ===
  // Change to green fill, cyan stroke
  p.fill("#0f9b0f"); // Green
  p.stroke("#00d9ff"); // Cyan
  p.strokeWidth(4); // Thicker stroke

  // Draw a green circle in top-right quadrant
  p.circle(75, 25, 15);

  // Draw horizontal and vertical lines through the circle
  p.line(60, 25, 90, 25);
  p.line(75, 10, 75, 40);

  // === Section 3: Push/pop for isolated blue context ===
  // Save current style (green fill, cyan stroke, width 4)
  p.push();

  // Change to blue fill in nested context
  p.fill("#4361ee"); // Blue
  p.stroke("#ffc107"); // Back to yellow stroke
  p.strokeWidth(2); // Thinner stroke

  // Draw blue circle in bottom-left quadrant
  p.circle(25, 75, 15);

  // Draw a triangle around the circle using lines
  p.line(10, 90, 40, 90); // Bottom edge
  p.line(40, 90, 25, 60); // Right edge
  p.line(25, 60, 10, 90); // Left edge

  // Pop restores green fill, cyan stroke, width 4
  p.pop();

  // === Section 4: Verify restored style (green/cyan) ===
  // Should be back to green fill, cyan stroke, width 4

  // Draw green circle in bottom-right quadrant
  p.circle(75, 75, 15);

  // Draw a square around the circle using lineOffset
  p.lineOffset(60, 60, 30, 0); // Top edge
  p.lineOffset(90, 60, 0, 30); // Right edge
  p.lineOffset(90, 90, -30, 0); // Bottom edge
  p.lineOffset(60, 90, 0, -30); // Left edge

  // === Section 5: Additional nested context to verify deep nesting ===
  p.push();
  p.fill("#ff6b6b"); // Coral/light red
  p.stroke("#ffffff"); // White stroke
  p.strokeWidth(1);

  // Small circle in the center
  p.circle(50, 50, 8);

  // Cross through center
  p.line(42, 50, 58, 50);
  p.line(50, 42, 50, 58);

  p.pop();
});

/**
 * Set the background color (p5.js-style function call).
 * This updates the color that will be used on the next frame.
 */
export function background(color: string): void {
  currentColor = color;
}
