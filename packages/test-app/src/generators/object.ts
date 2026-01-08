/**
 * Object Generator
 *
 * three.js-style API where you create a Scene and add objects to it.
 * Scene implements Generator so it can be passed directly to renderers.
 */
import { Scene, Background, Circle, Line } from "@medli/generator-object";

// Create scene as the root generator
export const generator = new Scene();

// Create and attach a background
const bg = new Background();
generator.setBackground(bg);

// Add a circle at center (50, 50) with radius 25
const circle = new Circle(50, 50, 25);
generator.add(circle);

// Add a diagonal line from (10, 10) to (40, 40) using start/end constructor
const line1 = new Line(10, 10, 40, 40);
generator.add(line1);

// Add a line from (60, 10) with offset (30, 30) using fromOffset factory
const line2 = Line.fromOffset(60, 10, 30, 30);
generator.add(line2);

/**
 * Set the background color.
 * Consistent function API matching the procedural generator.
 */
export function background(color: string): void {
  bg.color = color;
}

// Re-export for convenience
export { Scene, Background, Circle, Line };
