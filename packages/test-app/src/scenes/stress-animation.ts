/**
 * Stress Animation Scene
 *
 * Performance stress test scene that animates many circles orbiting the center.
 * Use for performance testing and benchmarking renderer implementations.
 *
 * URL Parameters:
 * - ?shapes=500 - Number of shapes to render (default: 100)
 *
 * Coordinate System:
 * - Origin at center (0, 0)
 * - Y-up: positive Y goes up visually
 * - Viewport: -50 to +50 on both axes (halfWidth: 50, halfHeight: 50)
 *
 * This test pattern exercises:
 * - Many simultaneous animated shapes
 * - Time-based animation (using p.time / context.time)
 * - Varying orbital speeds and distances
 * - Color palette cycling
 */
import { ProceduralGenerator } from "@medli/generator-procedural";
import { Scene, Background, Circle, Material } from "@medli/generator-object";
import type { RenderContext } from "@medli/spec";
import type { TestScene } from "./types";

// =============================================================================
// CONFIGURATION
// =============================================================================

// Read shape count from URL parameter, default to 100
const params = new URLSearchParams(window.location.search);
const shapeCount = parseInt(params.get("shapes") || "100", 10);

// Color palette for cycling through
const palette = [
  "#e94560", // Red
  "#ff9800", // Orange
  "#ffc107", // Yellow
  "#4caf50", // Green
  "#00d9ff", // Cyan
  "#4361ee", // Blue
  "#9b59b6", // Purple
  "#ff6b6b", // Coral
];

// Shared mutable state for background color
let bgColor = "#1a1a2e";

// Background object for object generator (needs reference for updates)
const bg = new Background(bgColor);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate orbital parameters for a shape based on its index.
 * Each shape has a unique orbit radius, speed, and phase offset.
 */
function getOrbitalParams(index: number, total: number) {
  // Distribute shapes across different orbital distances
  // Use golden ratio for even distribution
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const angleOffset = index * goldenRatio * Math.PI * 2;

  // Varying orbital radii from 5 to 45 (within viewport -50 to +50)
  const normalizedIndex = index / total;
  const orbitRadius = 5 + normalizedIndex * 40;

  // Varying speeds - inner orbits faster, outer slower (Kepler-ish)
  const speed = 2 - normalizedIndex * 1.5;

  // Circle radius - smaller for more shapes
  const circleRadius = Math.max(1, 3 - total / 200);

  return { angleOffset, orbitRadius, speed, circleRadius };
}

/**
 * Calculate position at a given time for a shape with given orbital params.
 */
function calculatePosition(
  time: number,
  params: ReturnType<typeof getOrbitalParams>
) {
  const angle = params.angleOffset + (time / 1000) * params.speed;
  const x = Math.cos(angle) * params.orbitRadius;
  const y = Math.sin(angle) * params.orbitRadius;
  return { x, y };
}

// =============================================================================
// PROCEDURAL GENERATOR
// =============================================================================

/**
 * Procedural Generator
 *
 * p5.js-style API where we draw all circles each frame based on p.time.
 */
const procedural = new ProceduralGenerator((p) => {
  p.background(bgColor);
  p.viewport(50, 50);
  p.strokeWidth(0);

  for (let i = 0; i < shapeCount; i++) {
    const orbitalParams = getOrbitalParams(i, shapeCount);
    const pos = calculatePosition(p.time, orbitalParams);

    // Cycle through palette based on index
    const color = palette[i % palette.length];
    p.fill(color);
    p.stroke(color);

    p.circle(pos.x, pos.y, orbitalParams.circleRadius);
  }
});

// =============================================================================
// OBJECT GENERATOR
// =============================================================================

/**
 * Object Generator
 *
 * three.js-style API where we update circle positions each frame.
 * Extends Scene to override frame() and update positions based on time.
 */
class StressScene extends Scene {
  private circles: Circle[] = [];
  private materials: Material[] = [];
  private orbitalParamsCache: ReturnType<typeof getOrbitalParams>[] = [];

  constructor() {
    super({
      halfWidth: 50,
      halfHeight: 50,
      scaleMode: "fit",
    });

    // Set background
    this.setBackground(bg);

    // Create materials for each palette color
    for (const color of palette) {
      const material = new Material({
        fill: color,
        stroke: color,
        strokeWidth: 0,
      });
      this.materials.push(material);
      this.add(material);
    }

    // Pre-create all circles and cache their orbital params
    for (let i = 0; i < shapeCount; i++) {
      const orbitalParams = getOrbitalParams(i, shapeCount);
      this.orbitalParamsCache.push(orbitalParams);

      // Start at position for time=0
      const pos = calculatePosition(0, orbitalParams);
      const circle = new Circle(pos.x, pos.y, orbitalParams.circleRadius);

      // Assign material based on palette index
      circle.material = this.materials[i % palette.length];

      this.circles.push(circle);
      this.add(circle);
    }
  }

  frame(context: RenderContext) {
    const { time } = context;

    // Update each circle's position based on current time
    for (let i = 0; i < this.circles.length; i++) {
      const orbitalParams = this.orbitalParamsCache[i];
      const pos = calculatePosition(time, orbitalParams);

      // Update the circle's geometry position directly
      this.circles[i].x = pos.x;
      this.circles[i].y = pos.y;
    }

    return super.frame(context);
  }
}

const object = new StressScene();

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
  name: "Stress Animation",
  description: `Performance stress test with ${shapeCount} orbiting circles (use ?shapes=N to change)`,
  procedural,
  object,
  setBackground,
};
