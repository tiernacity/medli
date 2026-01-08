/**
 * Procedural Generator
 *
 * p5.js-style API where you define a draw function that runs each frame.
 * The draw function receives a sketch context with procedural functions.
 */
import { ProceduralGenerator } from "@medli/generator-procedural";

// Mutable state that the draw function will read
let currentColor = "#000000";

// Create generator with a draw function that uses the current color
export const generator = new ProceduralGenerator((p) => {
  p.background(currentColor);
  // Draw a circle at center (50, 50) with radius 25
  p.circle(50, 50, 25);
});

/**
 * Set the background color (p5.js-style function call).
 * This updates the color that will be used on the next frame.
 */
export function background(color: string): void {
  currentColor = color;
}
