/**
 * Optional Clear Scene
 *
 * Demonstrates the optional clear feature where shapes accumulate over time.
 * When background is undefined, the canvas is not cleared between frames,
 * allowing shapes to persist and create visual trails.
 *
 * Coordinate System:
 * - Origin at center (0, 0)
 * - Y-up: positive Y goes up visually
 * - Viewport: -50 to +50 on both axes (halfWidth: 50, halfHeight: 50)
 *
 * This test pattern exercises:
 * - No background clearing (background undefined)
 * - Time-based animation using the time parameter
 * - Accumulating shapes that form a spiral pattern
 */
import { ProceduralGenerator } from "@medli/generator-procedural";
import { Scene, Circle, Material } from "@medli/generator-object";
import type { TestScene } from "./types";

// =============================================================================
// PROCEDURAL GENERATOR
// =============================================================================

/**
 * Procedural Generator
 *
 * Creates a spiral trail of circles by NOT calling p.background().
 * Each frame draws a circle at a time-based position, and since
 * the background is not cleared, circles accumulate.
 */
const procedural = new ProceduralGenerator((p) => {
  // DO NOT call p.background() - leaving it undefined means no clear
  // This allows shapes to accumulate across frames

  // Set viewport: coordinate space from -50 to +50 on both axes
  p.viewport(50, 50);

  // Style for the accumulating circles
  p.fill("#ff6b6b");
  p.stroke("#ff6b6b"); // Match fill to hide stroke
  p.strokeWidth(0);

  // Calculate position based on time
  // Using a spiral pattern: radius increases with time while angle rotates
  const timeSeconds = p.time / 1000;
  const angle = timeSeconds * 3; // Rotation speed
  const radius = 5 + (timeSeconds % 10) * 4; // Spiral outward, reset every ~10 seconds

  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;

  // Draw a small circle at the calculated position
  p.circle(x, y, 2);

  // Draw a second circle with different timing for visual interest
  const angle2 = timeSeconds * 2 + Math.PI;
  const radius2 = 5 + ((timeSeconds + 5) % 10) * 4;
  const x2 = Math.cos(angle2) * radius2;
  const y2 = Math.sin(angle2) * radius2;

  p.fill("#4ecdc4");
  p.circle(x2, y2, 2);
});

// =============================================================================
// OBJECT GENERATOR
// =============================================================================

/**
 * Object Generator
 *
 * Creates matching spiral trail using the object-based API.
 * Background is not set, so shapes accumulate across frames.
 *
 * Note: The object generator creates new Circle instances each frame
 * in the frame() method to match the procedural behavior.
 */
class AccumulatingScene extends Scene {
  private material1: Material;
  private material2: Material;

  constructor() {
    super({
      halfWidth: 50,
      halfHeight: 50,
      scaleMode: "fit",
    });

    // DO NOT set background - leaving undefined means no clear

    // Create materials for the circles
    // Stroke color matches fill, strokeWidth is 0 (matches procedural approach)
    this.material1 = new Material({
      fill: "#ff6b6b",
      stroke: "#ff6b6b",
      strokeWidth: 0,
    });

    this.material2 = new Material({
      fill: "#4ecdc4",
      stroke: "#4ecdc4",
      strokeWidth: 0,
    });
  }

  frame(time: number) {
    // Clear existing children and rebuild each frame
    // This is necessary because circle positions change with time
    while (this["children"].length > 0) {
      this["children"].pop();
    }

    // Add materials
    this.add(this.material1);
    this.add(this.material2);

    // Calculate position based on time (matching procedural)
    const timeSeconds = time / 1000;
    const angle = timeSeconds * 3;
    const radius = 5 + (timeSeconds % 10) * 4;

    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    // Create circle at calculated position
    const circle1 = new Circle(x, y, 2);
    circle1.material = this.material1;
    this.add(circle1);

    // Second circle with different timing
    const angle2 = timeSeconds * 2 + Math.PI;
    const radius2 = 5 + ((timeSeconds + 5) % 10) * 4;
    const x2 = Math.cos(angle2) * radius2;
    const y2 = Math.sin(angle2) * radius2;

    const circle2 = new Circle(x2, y2, 2);
    circle2.material = this.material2;
    this.add(circle2);

    return super.frame(time);
  }
}

const object = new AccumulatingScene();

// =============================================================================
// SET BACKGROUND FUNCTION
// =============================================================================

/**
 * Set the background color for both generators.
 * For this scene, setting a background would defeat the purpose,
 * but we provide the function for API consistency.
 *
 * Note: This is intentionally a no-op to preserve the accumulation effect.
 */
function setBackground(_color: string): void {
  // Intentionally does nothing - the whole point of this scene
  // is to demonstrate what happens with no background clearing
}

// =============================================================================
// SCENE EXPORT
// =============================================================================

export const scene: TestScene = {
  name: "Optional Clear",
  description:
    "Demonstrates accumulating shapes when background is undefined (no clearing)",
  procedural,
  object,
  setBackground,
};
