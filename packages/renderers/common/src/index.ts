import type { Generator, Renderer } from "@medli/spec";

/**
 * Base class for renderers providing common animation loop functionality.
 *
 * Subclasses must implement the `render(time)` method to draw the frame.
 * The `loop()` and `stop()` methods handle requestAnimationFrame management.
 */
export abstract class BaseRenderer implements Renderer {
  protected generator: Generator;
  private animationId: number | null = null;

  constructor(generator: Generator) {
    this.generator = generator;
  }

  /** Render a single frame. Subclasses implement this. */
  abstract render(time: number): void;

  /** Start the animation loop. */
  loop(): void {
    const animate = (time: number) => {
      this.render(time);
      this.animationId = requestAnimationFrame(animate);
    };
    this.animationId = requestAnimationFrame(animate);
  }

  /** Stop the animation loop. */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
