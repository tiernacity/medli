/**
 * Object Generator
 *
 * three.js-style API where you create a Scene and add objects to it.
 * Scene implements Generator so it can be passed directly to renderers.
 */
import { Scene, Background } from "@medli/generator-object";

// Create scene as the root generator
export const generator = new Scene();

// Create and attach a background
const bg = new Background();
generator.setBackground(bg);

/**
 * Set the background color.
 * Consistent function API matching the procedural generator.
 */
export function background(color: string): void {
  bg.color = color;
}

// Re-export for convenience
export { Scene, Background };
