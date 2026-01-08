/**
 * Image Crop Scene
 *
 * Tests image cropping functionality.
 * Exercises the crop parameters to display portions of source images.
 *
 * Coordinate System:
 * - Origin at center (0, 0)
 * - Y-up: positive Y goes up visually
 * - Viewport: -50 to +50 on both axes (halfWidth: 50, halfHeight: 50)
 *
 * Test Layout (2 test cases side by side):
 * - Left (-25, 0): Top-left quadrant crop - shows upper-left 16x16 of 32x32 image
 * - Right (25, 0): Center crop - shows middle 16x16 of 32x32 image
 *
 * Test image is 32x32 pixels with distinct regions for visual verification.
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
const DISPLAY_SIZE = 30; // Display cropped images at 30x30 viewport units

// Source image is 32x32 pixels
const SOURCE_SIZE = 32;
const HALF_SOURCE = SOURCE_SIZE / 2; // 16 pixels

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

  // === Test 1: Top-left quadrant crop ===
  // Crop the top-left 16x16 pixels of the 32x32 source image
  // In image coordinates: (0, 0) to (16, 16)
  p.image(
    IMAGE_SRC,
    -25,
    0, // Position in viewport (left side)
    DISPLAY_SIZE,
    DISPLAY_SIZE, // Display size
    0,
    0, // Crop origin (top-left corner of source)
    HALF_SOURCE,
    HALF_SOURCE // Crop size (16x16 pixels)
  );

  // === Test 2: Center crop ===
  // Crop the center 16x16 pixels of the 32x32 source image
  // In image coordinates: (8, 8) to (24, 24)
  p.image(
    IMAGE_SRC,
    25,
    0, // Position in viewport (right side)
    DISPLAY_SIZE,
    DISPLAY_SIZE, // Display size
    HALF_SOURCE / 2,
    HALF_SOURCE / 2, // Crop origin (8, 8 - center region start)
    HALF_SOURCE,
    HALF_SOURCE // Crop size (16x16 pixels)
  );
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

// === Test 1: Top-left quadrant crop ===
// Crop the top-left 16x16 pixels of the 32x32 source image
const image1 = new Image(
  IMAGE_SRC,
  -25,
  0, // Position in viewport (left side)
  DISPLAY_SIZE,
  DISPLAY_SIZE, // Display size
  0,
  0, // Crop origin (top-left corner of source)
  HALF_SOURCE,
  HALF_SOURCE // Crop size (16x16 pixels)
);
object.add(image1);

// === Test 2: Center crop ===
// Crop the center 16x16 pixels of the 32x32 source image
const image2 = new Image(
  IMAGE_SRC,
  25,
  0, // Position in viewport (right side)
  DISPLAY_SIZE,
  DISPLAY_SIZE, // Display size
  HALF_SOURCE / 2,
  HALF_SOURCE / 2, // Crop origin (8, 8 - center region start)
  HALF_SOURCE,
  HALF_SOURCE // Crop size (16x16 pixels)
);
object.add(image2);

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
  name: "Image Crop",
  description:
    "Tests image cropping with top-left quadrant and center region crops",
  procedural,
  object,
  setBackground,
};
