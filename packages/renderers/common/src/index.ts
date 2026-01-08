import type { Generator, Renderer, Viewport } from "@medli/spec";

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

/**
 * Result of computing viewport-to-element transform.
 * Apply as: translate(translateX, translateY) then scale(scaleX, -scaleY)
 * The negative scaleY flips Y axis from Y-up (viewport) to Y-down (screen).
 */
export interface ViewportTransformResult {
  /** X translation to center of element */
  translateX: number;
  /** Y translation to center of element */
  translateY: number;
  /** X scale factor */
  scaleX: number;
  /** Y scale factor (apply as -scaleY to flip Y axis) */
  scaleY: number;
}

/**
 * Compute the transform from viewport coordinates to element coordinates.
 *
 * Transforms from:
 * - Origin at center (0,0), Y-up, viewport units
 * To:
 * - Origin at top-left, Y-down, pixel units
 *
 * @param viewport - The viewport configuration from Frame
 * @param elementWidth - Current width of the target element in pixels
 * @param elementHeight - Current height of the target element in pixels
 * @returns Transform parameters to apply to rendering context
 */
export function computeViewportTransform(
  viewport: Viewport,
  elementWidth: number,
  elementHeight: number
): ViewportTransformResult {
  const viewportWidth = viewport.halfWidth * 2;
  const viewportHeight = viewport.halfHeight * 2;

  let scaleX: number;
  let scaleY: number;

  switch (viewport.scaleMode) {
    case "fit": {
      // Uniform scale to fit, letterbox/pillarbox
      const scale = Math.min(
        elementWidth / viewportWidth,
        elementHeight / viewportHeight
      );
      scaleX = scale;
      scaleY = scale;
      break;
    }
    case "fill": {
      // Uniform scale to fill, crop outside
      const scale = Math.max(
        elementWidth / viewportWidth,
        elementHeight / viewportHeight
      );
      scaleX = scale;
      scaleY = scale;
      break;
    }
    case "stretch": {
      // Non-uniform scale to exactly fill
      scaleX = elementWidth / viewportWidth;
      scaleY = elementHeight / viewportHeight;
      break;
    }
  }

  return {
    translateX: elementWidth / 2,
    translateY: elementHeight / 2,
    scaleX,
    scaleY,
  };
}
