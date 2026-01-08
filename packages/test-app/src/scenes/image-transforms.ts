/**
 * Image Transforms Scene
 *
 * Tests image rendering with various transforms applied.
 * Exercises translate, rotate, scale, and combined transforms on images.
 *
 * Coordinate System:
 * - Origin at center (0, 0)
 * - Y-up: positive Y goes up visually
 * - Viewport: -50 to +50 on both axes (halfWidth: 50, halfHeight: 50)
 *
 * Test Layout (5 test cases in a grid):
 * - Top-left (-35, 25): No transform (baseline)
 * - Top-right (35, 25): Translate transform
 * - Center (0, 0): Rotate transform (45 degrees)
 * - Bottom-left (-35, -25): Scale transform (0.5)
 * - Bottom-right (35, -25): Combined (rotate 30 degrees + scale 1.5)
 */
import { ProceduralGenerator } from "@medli/generator-procedural";
import { Scene, Background, Image } from "@medli/generator-object";
import type { TestScene } from "./types";

// Shared mutable state for background color
let bgColor = "#1a1a2e";

// Background object for object generator (needs reference for updates)
const bg = new Background(bgColor);

// Image configuration
const IMAGE_SRC = "/test-img.png";
const IMAGE_SIZE = 20; // 20x20 viewport units

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

  // === Test 1: No Transform (baseline) ===
  // Image at position (-35, 25) with no transform applied
  p.image(IMAGE_SRC, -35, 25, IMAGE_SIZE, IMAGE_SIZE);

  // === Test 2: Translate ===
  // Image drawn at origin (0, 0) but translated to (35, 25)
  p.push();
  p.translate(35, 25);
  p.image(IMAGE_SRC, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
  p.pop();

  // === Test 3: Rotate ===
  // Image at center, rotated 45 degrees (Math.PI / 4)
  p.push();
  p.rotate(Math.PI / 4);
  p.image(IMAGE_SRC, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
  p.pop();

  // === Test 4: Scale ===
  // Image at (-35, -25), scaled to 0.5
  p.push();
  p.translate(-35, -25);
  p.scale(0.5);
  p.image(IMAGE_SRC, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
  p.pop();

  // === Test 5: Combined (rotate + scale) ===
  // Image at (35, -25), rotated 30 degrees AND scaled to 1.5
  p.push();
  p.translate(35, -25);
  p.rotate(Math.PI / 6); // 30 degrees
  p.scale(1.5);
  p.image(IMAGE_SRC, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
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

// === Test 1: No Transform (baseline) ===
// Image at position (-35, 25) with no transform applied
const image1 = new Image(IMAGE_SRC, -35, 25, IMAGE_SIZE, IMAGE_SIZE);
object.add(image1);

// === Test 2: Translate ===
// Image at origin (0, 0) with position set to (35, 25)
const image2 = new Image(IMAGE_SRC, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
image2.position = { x: 35, y: 25 };
object.add(image2);

// === Test 3: Rotate ===
// Image at center, rotated 45 degrees (Math.PI / 4)
const image3 = new Image(IMAGE_SRC, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
image3.rotation = Math.PI / 4;
object.add(image3);

// === Test 4: Scale ===
// Image at (-35, -25), scaled to 0.5
const image4 = new Image(IMAGE_SRC, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
image4.position = { x: -35, y: -25 };
image4.scale = 0.5;
object.add(image4);

// === Test 5: Combined (rotate + scale) ===
// Image at (35, -25), rotated 30 degrees AND scaled to 1.5
const image5 = new Image(IMAGE_SRC, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
image5.position = { x: 35, y: -25 };
image5.rotation = Math.PI / 6; // 30 degrees
image5.scale = 1.5;
object.add(image5);

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
  name: "Image Transforms",
  description:
    "Tests image rendering with translate, rotate, scale, and combined transforms",
  procedural,
  object,
  setBackground,
};
