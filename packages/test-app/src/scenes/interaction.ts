/**
 * Interaction Demo Scene
 *
 * Tests interactive repositioning of a circle via tap/click.
 * Demonstrates mutable state that can be updated externally.
 *
 * Coordinate System:
 * - Origin at center (0, 0)
 * - Y-up: positive Y goes up visually
 * - Viewport: -50 to +50 on both axes (halfWidth: 50, halfHeight: 50)
 *
 * This test pattern exercises:
 * - External state mutation via setCirclePosition()
 * - Synchronization between procedural and object generators
 * - Interactive positioning within the viewport coordinate system
 */
import { ProceduralGenerator } from "@medli/generator-procedural";
import { Scene, Background, Circle, Material } from "@medli/generator-object";
import type { TestScene } from "./types";

// Shared mutable state for background color
let bgColor = "#1a1a2e";

// Mutable state for circle position
let circleX = 0;
let circleY = 0;

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

  // Draw the interactive circle
  p.fill("#3498db");
  p.stroke("#2980b9");
  p.strokeWidth(2);
  p.circle(circleX, circleY, 10);
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

// Create the interactive circle
const circleMaterial = new Material({
  fill: "#3498db",
  stroke: "#2980b9",
  strokeWidth: 2,
});
object.add(circleMaterial);

const circle = new Circle(circleX, circleY, 10);
circle.material = circleMaterial;
object.add(circle);

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
// SET CIRCLE POSITION FUNCTION
// =============================================================================

/**
 * Set the circle position for both generators.
 * Updates the shared circleX/circleY state and the Circle object.
 */
export function setCirclePosition(x: number, y: number): void {
  circleX = x;
  circleY = y;
  circle.center = { x, y };
}

// =============================================================================
// SCENE EXPORT
// =============================================================================

export const scene: TestScene = {
  name: "Interaction",
  description: "Tests interactive repositioning of a circle via tap/click",
  procedural,
  object,
  setBackground,
};
