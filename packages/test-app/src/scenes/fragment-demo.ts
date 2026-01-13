/**
 * Fragment Demo Scene
 *
 * Demonstrates the Fragment feature for reusable, composable scene graphs.
 * Shows:
 * - Basic fragment creation and embedding
 * - Cross-generator composition
 * - Nested fragments
 * - Style inheritance from embedding context
 *
 * Coordinate System:
 * - Origin at center (0, 0)
 * - Y-up: positive Y goes up visually
 * - Viewport: -50 to +50 on both axes (halfWidth: 50, halfHeight: 50)
 */
import { ProceduralGenerator, type Sketch } from "@medli/generator-procedural";
import {
  Scene,
  Background,
  Circle,
  Rectangle,
  Line,
  Material,
  Group,
  FragmentScene,
} from "@medli/generator-object";
import type { Fragment } from "@medli/spec";
import type { TestScene } from "./types";

// Shared mutable state for background color
let bgColor = "#1a1a2e";

// Background object for object generator (needs reference for updates)
const bg = new Background(bgColor);

// =============================================================================
// SHARED FRAGMENT DEFINITIONS
// These fragments are created once and reused across both generators
// =============================================================================

/**
 * Create a star-like shape fragment using procedural API.
 * The fragment draws a small star pattern that inherits fill/stroke from context.
 */
function createStarFragment(sketch: Sketch): Fragment {
  return sketch.createFragment((ctx: Sketch) => {
    // Draw a simple star pattern: circle with 4 lines radiating out
    ctx.circle(0, 0, 4);
    ctx.line(-8, 0, 8, 0); // Horizontal line
    ctx.line(0, -8, 0, 8); // Vertical line
    ctx.line(-5, -5, 5, 5); // Diagonal 1
    ctx.line(-5, 5, 5, -5); // Diagonal 2
  });
}

/**
 * Create a simple diamond fragment using FragmentScene (object API).
 * Returns a FragmentScene that can be embedded.
 */
function createDiamondFragment(): FragmentScene {
  const frag = new FragmentScene();

  // Create a diamond shape using a rotated rectangle
  // The rectangle will inherit styles from embedding context
  const diamond = new Rectangle(0, 0, 8, 8);
  diamond.rotation = Math.PI / 4; // 45 degrees
  frag.add(diamond);

  // Add a small circle in center
  const center = new Circle(0, 0, 2);
  frag.add(center);

  return frag;
}

/**
 * Create a nested fragment that contains another fragment.
 * Demonstrates namespace compounding.
 */
function createNestedFragment(sketch: Sketch): Fragment {
  return sketch.createFragment((ctx: Sketch) => {
    // Outer frame - a rectangle
    ctx.rectangle(0, 0, 20, 20);

    // Inner fragment embedded at center
    const innerFrag = ctx.createFragment((inner: Sketch) => {
      inner.circle(0, 0, 5);
      inner.line(-4, 0, 4, 0);
      inner.line(0, -4, 0, 4);
    });
    ctx.embed(innerFrag, "inner");
  });
}

// =============================================================================
// PROCEDURAL GENERATOR
// =============================================================================

/**
 * Procedural Generator demonstrating Fragment features.
 */
const procedural = new ProceduralGenerator((p) => {
  p.background(bgColor);
  p.viewport(50, 50);

  // === Section 1: Basic Fragment Embedding (Top-left quadrant) ===
  // Create a star fragment and embed it multiple times with different colors

  // Create the star fragment once
  const starFragment = createStarFragment(p);

  // Embed with RED context
  p.push();
  p.fill("#e94560");
  p.stroke("#ffc107");
  p.strokeWidth(2);
  p.translate(-35, 35);
  p.embed(starFragment, "starRed");
  p.pop();

  // Embed with GREEN context
  p.push();
  p.fill("#0f9b0f");
  p.stroke("#00d9ff");
  p.strokeWidth(2);
  p.translate(-15, 35);
  p.embed(starFragment, "starGreen");
  p.pop();

  // === Section 2: Cross-Generator Composition (Top-right quadrant) ===
  // Embed a FragmentScene (object generator) into procedural generator

  const diamondFragment = createDiamondFragment();

  // Embed with BLUE context
  p.push();
  p.fill("#4361ee");
  p.stroke("#ffffff");
  p.strokeWidth(1);
  p.translate(15, 35);
  p.embed(diamondFragment, "diamondBlue");
  p.pop();

  // Embed same fragment with PURPLE context
  p.push();
  p.fill("#9b59b6");
  p.stroke("#ffffff");
  p.strokeWidth(1);
  p.translate(35, 35);
  p.embed(diamondFragment, "diamondPurple");
  p.pop();

  // === Section 3: Nested Fragments (Bottom-left quadrant) ===
  // Fragment containing another fragment

  const nestedFragment = createNestedFragment(p);

  // Embed with ORANGE context
  p.push();
  p.fill("#ff9800");
  p.stroke("#ffffff");
  p.strokeWidth(1);
  p.translate(-25, -25);
  p.embed(nestedFragment, "nestedOrange");
  p.pop();

  // === Section 4: Style Inheritance Demo (Bottom-right quadrant) ===
  // Same fragment embedded in three different material contexts
  // Shows clear fill/stroke inheritance

  // Create a simple fragment for style demo
  const styleFragment = p.createFragment((ctx: Sketch) => {
    ctx.circle(0, 0, 6);
    ctx.rectangle(0, 0, 10, 10);
  });

  // RED context
  p.push();
  p.fill("#e74c3c");
  p.stroke("#ffffff");
  p.strokeWidth(2);
  p.translate(10, -15);
  p.embed(styleFragment, "styleRed");
  p.pop();

  // GREEN context
  p.push();
  p.fill("#27ae60");
  p.stroke("#ffffff");
  p.strokeWidth(2);
  p.translate(25, -15);
  p.embed(styleFragment, "styleGreen");
  p.pop();

  // BLUE context
  p.push();
  p.fill("#3498db");
  p.stroke("#ffffff");
  p.strokeWidth(2);
  p.translate(40, -15);
  p.embed(styleFragment, "styleBlue");
  p.pop();

  // Add labels (just simple shapes to mark sections)
  // Top-left corner marker
  p.push();
  p.fill("#ffffff");
  p.stroke("#ffffff");
  p.strokeWidth(1);
  p.circle(-45, 45, 2);
  p.pop();

  // Bottom-right corner marker
  p.push();
  p.fill("#ffffff");
  p.stroke("#ffffff");
  p.strokeWidth(1);
  p.circle(45, -45, 2);
  p.pop();
});

// =============================================================================
// OBJECT GENERATOR
// =============================================================================

/**
 * Object Generator demonstrating Fragment features.
 * Must produce identical output to procedural generator.
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

// === Section 1: Basic Fragment Embedding (Top-left quadrant) ===
// Create materials for each context
const materialRed = new Material({
  fill: "#e94560",
  stroke: "#ffc107",
  strokeWidth: 2,
});
object.add(materialRed);

const materialGreen = new Material({
  fill: "#0f9b0f",
  stroke: "#00d9ff",
  strokeWidth: 2,
});
object.add(materialGreen);

// Helper to create star group with material
function createStarGroupWithMaterial(
  material: Material,
  x: number,
  y: number
): Group {
  const group = new Group();
  group.position = { x, y };

  const circle = new Circle(0, 0, 4);
  circle.material = material;
  group.add(circle);

  // Lines radiating out
  const line1 = new Line(-8, 0, 8, 0); // Horizontal
  line1.material = material;
  group.add(line1);

  const line2 = new Line(0, -8, 0, 8); // Vertical
  line2.material = material;
  group.add(line2);

  const line3 = new Line(-5, -5, 5, 5); // Diagonal 1
  line3.material = material;
  group.add(line3);

  const line4 = new Line(-5, 5, 5, -5); // Diagonal 2
  line4.material = material;
  group.add(line4);

  return group;
}

// Star 1 (RED) at (-35, 35)
const star1Group = createStarGroupWithMaterial(materialRed, -35, 35);
object.add(star1Group);

// Star 2 (GREEN) at (-15, 35)
const star2Group = createStarGroupWithMaterial(materialGreen, -15, 35);
object.add(star2Group);

// === Section 2: Cross-Generator Composition (Top-right quadrant) ===
// Diamond shapes

const materialBlue = new Material({
  fill: "#4361ee",
  stroke: "#ffffff",
  strokeWidth: 1,
});
object.add(materialBlue);

const materialPurple = new Material({
  fill: "#9b59b6",
  stroke: "#ffffff",
  strokeWidth: 1,
});
object.add(materialPurple);

// Helper to create diamond group
function createDiamondGroup(material: Material, x: number, y: number): Group {
  const group = new Group();
  group.position = { x, y };

  // Diamond = rotated rectangle
  const diamond = new Rectangle(0, 0, 8, 8);
  diamond.rotation = Math.PI / 4;
  diamond.material = material;
  group.add(diamond);

  // Center circle
  const center = new Circle(0, 0, 2);
  center.material = material;
  group.add(center);

  return group;
}

// Diamond BLUE at (15, 35)
const diamond1Group = createDiamondGroup(materialBlue, 15, 35);
object.add(diamond1Group);

// Diamond PURPLE at (35, 35)
const diamond2Group = createDiamondGroup(materialPurple, 35, 35);
object.add(diamond2Group);

// === Section 3: Nested Fragments (Bottom-left quadrant) ===

const materialOrange = new Material({
  fill: "#ff9800",
  stroke: "#ffffff",
  strokeWidth: 1,
});
object.add(materialOrange);

// Nested pattern: rectangle with circle and cross inside
const nestedGroup = new Group();
nestedGroup.position = { x: -25, y: -25 };

const outerRect = new Rectangle(0, 0, 20, 20);
outerRect.material = materialOrange;
nestedGroup.add(outerRect);

const innerCircle = new Circle(0, 0, 5);
innerCircle.material = materialOrange;
nestedGroup.add(innerCircle);

const innerLineH = new Line(-4, 0, 4, 0);
innerLineH.material = materialOrange;
nestedGroup.add(innerLineH);

const innerLineV = new Line(0, -4, 0, 4);
innerLineV.material = materialOrange;
nestedGroup.add(innerLineV);

object.add(nestedGroup);

// === Section 4: Style Inheritance Demo (Bottom-right quadrant) ===

const materialStyleRed = new Material({
  fill: "#e74c3c",
  stroke: "#ffffff",
  strokeWidth: 2,
});
object.add(materialStyleRed);

const materialStyleGreen = new Material({
  fill: "#27ae60",
  stroke: "#ffffff",
  strokeWidth: 2,
});
object.add(materialStyleGreen);

const materialStyleBlue = new Material({
  fill: "#3498db",
  stroke: "#ffffff",
  strokeWidth: 2,
});
object.add(materialStyleBlue);

// Helper to create style demo group (circle + rectangle)
function createStyleDemoGroup(material: Material, x: number, y: number): Group {
  const group = new Group();
  group.position = { x, y };

  const circle = new Circle(0, 0, 6);
  circle.material = material;
  group.add(circle);

  const rect = new Rectangle(0, 0, 10, 10);
  rect.material = material;
  group.add(rect);

  return group;
}

// RED at (10, -15)
const styleRed = createStyleDemoGroup(materialStyleRed, 10, -15);
object.add(styleRed);

// GREEN at (25, -15)
const styleGreen = createStyleDemoGroup(materialStyleGreen, 25, -15);
object.add(styleGreen);

// BLUE at (40, -15)
const styleBlue = createStyleDemoGroup(materialStyleBlue, 40, -15);
object.add(styleBlue);

// Corner markers
const materialWhite = new Material({
  fill: "#ffffff",
  stroke: "#ffffff",
  strokeWidth: 1,
});
object.add(materialWhite);

const markerTL = new Circle(-45, 45, 2);
markerTL.material = materialWhite;
object.add(markerTL);

const markerBR = new Circle(45, -45, 2);
markerBR.material = materialWhite;
object.add(markerBR);

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
  name: "Fragment Demo",
  description:
    "Demonstrates fragment embedding, cross-generator composition, nesting, and style inheritance",
  procedural,
  object,
  setBackground,
};
